/**
 * Search & discovery service - hybrid full-text + trigram retrieval.
 *
 * Retrieval strategy (per entity):
 *   1. Full-text (tsvector @@ tsquery, 'simple' config) for token / word-order
 *      independent / multi-word matching. The last query token is prefix-matched
 *      (`:*`) so search-as-you-type works ("sho" -> "shoe").
 *   2. word_similarity() trigram fallback for typos and words buried inside long
 *      names ("shoe" inside "Men's Leather Derby Shoe").
 *   3. Surface widening: merchants also match on category name + tags; products
 *      also match on their MERCHANT's name so cross-entity queries like
 *      "lady m combo meal" resolve to Lady M's "Combo Meal".
 *
 * Ranking blends ts_rank (token relevance, weighted x4) with word_similarity
 * (fuzzy closeness) so exact/near-exact matches lead and typos still surface.
 *
 *   /search   - the above, optional geo bbox + category/type filters.
 *   /nearby   - bounding-box-only merchant list (no text query).
 *
 * Visibility filter is the canonical `isActive=true AND adminActiveOverride=true`
 * that merchant.service.getMerchants uses, so search is neither a superset nor a
 * subset of the listing.
 */

const { prisma } = require('../../config/database');
const { Prisma } = require('@prisma/client');

const SEARCH_LIMIT = 25;
// word_similarity threshold for the fuzzy fallback. Lower than the classic
// similarity() 0.15 because word_similarity is asymmetric and already rewards
// the best-matching extent; 0.3 keeps typos in without flooding noise.
const WSIM_THRESHOLD = 0.3;
// ts_rank carries more signal than a fuzzy score, so weight it up when blending.
const FTS_WEIGHT = 4;

// Approximate degrees per km at Nigeria's latitude (~10°N). Good enough for
// a bounding-box filter; the lat/lng pair below corrects for both axes.
const KM_PER_DEG_LAT = 110.574;
const kmPerDegLng = (lat) => 111.32 * Math.cos((lat * Math.PI) / 180);

const buildBoundingBox = (lat, lng, radiusKm) => {
  const dLat = radiusKm / KM_PER_DEG_LAT;
  const dLng = radiusKm / kmPerDegLng(lat);
  return {
    latMin: lat - dLat,
    latMax: lat + dLat,
    lngMin: lng - dLng,
    lngMax: lng + dLng,
  };
};

const toRad = (d) => (d * Math.PI) / 180;
const haversineKm = (la1, lo1, la2, lo2) => {
  const R = 6371;
  const dLat = toRad(la2 - la1);
  const dLng = toRad(lo2 - lo1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(la1)) * Math.cos(toRad(la2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

// Customer-facing visibility filter - must match what merchant.service.getMerchants
// uses so search results aren't a superset/subset of the listing.
const MERCHANT_VISIBLE_FILTER = {
  isActive: true,
  adminActiveOverride: true,
  status: 'APPROVED',
};

const includeMerchantCategory = {
  category: { select: { id: true, name: true, slug: true, color: true, icon: true, attributeSchema: true } },
};

/**
 * Build a prefix tsquery string from raw user input.
 *   "lady m combo meal" -> "lady & m & combo & meal:*"
 * Tokens are reduced to alphanumerics (so user text can never inject tsquery
 * operators), ANDed together, and the final token is prefix-matched for
 * type-ahead. Returns '' when the input has no usable tokens; to_tsquery('') is
 * a valid empty query that simply matches nothing.
 */
const toPrefixTsQuery = (raw) => {
  const tokens = (raw.toLowerCase().match(/[a-z0-9]+/g) || []);
  if (tokens.length === 0) return '';
  return tokens
    .map((tok, i) => (i === tokens.length - 1 ? `${tok}:*` : tok))
    .join(' & ');
};

// Escape LIKE/ILIKE wildcards so a query like "50%" is matched literally.
const likeContains = (raw) => `%${raw.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/**
 * Attach straight-line distance (km) from the user to each merchant-bearing
 * result, when we have a user location. Mutates nothing; returns a new array.
 */
const withDistance = (rows, lat, lng, pickCoords) => {
  if (lat == null || lng == null) return rows;
  const ulat = Number(lat);
  const ulng = Number(lng);
  return rows.map((row) => {
    const c = pickCoords(row);
    if (c?.lat == null || c?.lng == null) return row;
    return { ...row, _distanceKm: haversineKm(ulat, ulng, c.lat, c.lng) };
  });
};

/**
 * Unified search across merchants and products.
 * Returns `{ results: [{ kind:'merchant'|'product', ... }], query, category }`.
 */
const search = async ({ q, type, category, lat, lng, radius }) => {
  const query = (q || '').trim();
  const cat = (category || '').trim() || null;
  const radiusKm = Number(radius) || 10;
  const hasGeo = lat != null && lng != null;

  const wantsMerchants = !type || type === 'merchant';
  const wantsProducts = !type || type === 'product';

  // ── Merchants ────────────────────────────────────────────
  let merchants = [];
  if (wantsMerchants) {
    if (query) {
      const tsq = toPrefixTsQuery(query);
      const like = likeContains(query);
      const bbox = hasGeo ? buildBoundingBox(Number(lat), Number(lng), radiusKm) : null;
      const bboxFragment = bbox
        ? Prisma.sql`AND m."lat" BETWEEN ${bbox.latMin} AND ${bbox.latMax} AND m."lng" BETWEEN ${bbox.lngMin} AND ${bbox.lngMax}`
        : Prisma.empty;
      // Push the category scope into the ranked query so the LIMIT is taken from
      // within-category matches, not filtered after the fact in hydration.
      const catFragment = cat ? Prisma.sql`AND mc."slug" = ${cat}` : Prisma.empty;

      // Combined query-time vector (name + description + category name) so a
      // descriptive query like "Lady M restaurant" matches a merchant named
      // "Lady M" in the "Restaurant" category.
      const rows = await prisma.$queryRaw(Prisma.sql`
        WITH q AS (SELECT to_tsquery('simple', ${tsq}) AS tsq)
        SELECT m.id,
          ts_rank(
            setweight(to_tsvector('simple', coalesce(m."name", '')), 'A') ||
            setweight(to_tsvector('simple', coalesce(m."description", '')), 'B') ||
            setweight(to_tsvector('simple', coalesce(mc."name", '')), 'C'),
            q.tsq
          ) * ${FTS_WEIGHT} + word_similarity(${query}, m."name") AS score
        FROM "merchants" m
        LEFT JOIN "merchant_categories" mc ON mc.id = m."categoryId"
        CROSS JOIN q
        WHERE m."isActive" = true
          AND m."adminActiveOverride" = true
          AND m."status" = 'APPROVED'
          AND (
            m."search_vector" @@ q.tsq
            OR to_tsvector('simple',
                 coalesce(m."name", '') || ' ' ||
                 coalesce(m."description", '') || ' ' ||
                 coalesce(mc."name", '')
               ) @@ q.tsq
            OR word_similarity(${query}, m."name") > ${WSIM_THRESHOLD}
            OR EXISTS (
              SELECT 1 FROM "merchant_tags" mt
              JOIN "tags" tg ON tg.id = mt."tagId"
              WHERE mt."merchantId" = m.id AND tg."name" ILIKE ${like}
            )
          )
          ${catFragment}
          ${bboxFragment}
        ORDER BY score DESC
        LIMIT ${SEARCH_LIMIT}
      `);

      const ids = rows.map((r) => r.id);
      const scoreById = new Map(rows.map((r) => [r.id, Number(r.score)]));
      if (ids.length > 0) {
        const hydrated = await prisma.merchant.findMany({
          where: {
            id: { in: ids },
            ...MERCHANT_VISIBLE_FILTER,
            ...(cat && { category: { slug: cat } }),
          },
          include: includeMerchantCategory,
        });
        merchants = hydrated
          .map((m) => ({ ...m, _score: scoreById.get(m.id) ?? 0 }))
          .sort((a, b) => b._score - a._score);
      }
    } else {
      // No text query → straight findMany with bbox / category filters.
      const where = {
        ...MERCHANT_VISIBLE_FILTER,
        ...(cat && { category: { slug: cat } }),
      };
      if (hasGeo) {
        const bbox = buildBoundingBox(Number(lat), Number(lng), radiusKm);
        where.lat = { gte: bbox.latMin, lte: bbox.latMax };
        where.lng = { gte: bbox.lngMin, lte: bbox.lngMax };
      }
      merchants = await prisma.merchant.findMany({
        where,
        take: SEARCH_LIMIT,
        include: includeMerchantCategory,
        orderBy: [{ averageRating: 'desc' }, { totalOrders: 'desc' }],
      });
    }
  }

  // ── Products ────────────────────────────────────────────
  let products = [];
  if (wantsProducts && query) {
    const tsq = toPrefixTsQuery(query);
    // Scope products to the category of their merchant when a category is given,
    // applied inside the ranked query (see merchant note above).
    const catFragment = cat ? Prisma.sql`AND mc."slug" = ${cat}` : Prisma.empty;

    // Match products on their own vector OR on "<merchant name> <product name>"
    // so "lady m combo meal" finds Lady M's "Combo Meal". ts_rank blends the
    // product-vector relevance with the merchant-name relevance.
    const rows = await prisma.$queryRaw(Prisma.sql`
      WITH q AS (SELECT to_tsquery('simple', ${tsq}) AS tsq)
      SELECT p.id,
        (
          ts_rank(p."search_vector", q.tsq) +
          ts_rank(to_tsvector('simple', coalesce(m."name", '')), q.tsq)
        ) * ${FTS_WEIGHT} + word_similarity(${query}, p."name") AS score
      FROM "products" p
      JOIN "merchants" m ON m.id = p."merchantId"
      LEFT JOIN "merchant_categories" mc ON mc.id = m."categoryId"
      CROSS JOIN q
      WHERE p."isAvailable" = true
        AND m."isActive" = true
        AND m."adminActiveOverride" = true
        AND m."status" = 'APPROVED'
        AND (
          p."search_vector" @@ q.tsq
          OR to_tsvector('simple',
               coalesce(m."name", '') || ' ' || coalesce(p."name", '')
             ) @@ q.tsq
          OR word_similarity(${query}, p."name") > ${WSIM_THRESHOLD}
        )
        ${catFragment}
      ORDER BY score DESC
      LIMIT ${SEARCH_LIMIT}
    `);

    const ids = rows.map((r) => r.id);
    const scoreById = new Map(rows.map((r) => [r.id, Number(r.score)]));
    if (ids.length > 0) {
      const hydrated = await prisma.product.findMany({
        where: {
          id: { in: ids },
          isAvailable: true,
          merchant: {
            ...MERCHANT_VISIBLE_FILTER,
            ...(cat && { category: { slug: cat } }),
          },
        },
        include: {
          variants: { orderBy: { price: 'asc' }, take: 1 },
          merchant: {
            select: {
              id: true, name: true, lat: true, lng: true,
              logoUrl: true, isOpen: true, averageRating: true,
              category: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      });
      products = hydrated
        .map((p) => ({ ...p, _score: scoreById.get(p.id) ?? 0 }))
        .sort((a, b) => b._score - a._score);
    }
  }

  // Attach distance for the UI (merchants by own coords, products by merchant's).
  merchants = withDistance(merchants, lat, lng, (m) => ({ lat: m.lat, lng: m.lng }));
  products = withDistance(products, lat, lng, (p) => ({ lat: p.merchant?.lat, lng: p.merchant?.lng }));

  return {
    results: [
      ...merchants.map((m) => ({ kind: 'merchant', ...m })),
      ...products.map((p) => ({ kind: 'product', ...p })),
    ],
    query,
    category: cat,
  };
};

/**
 * Geo-filtered merchant list. Bounding-box pre-filter then in-memory Haversine
 * sort (the bbox is coarse). PostGIS `ST_DWithin` substitution is a follow-up
 * when the dataset grows.
 */
const nearby = async ({ type, category, lat, lng, radius }) => {
  if (lat == null || lng == null) {
    return { merchants: [], note: 'lat and lng are required for nearby' };
  }
  const radiusKm = Number(radius) || 10;
  const bbox = buildBoundingBox(Number(lat), Number(lng), radiusKm);
  const cat = (category || '').trim() || null;

  const where = {
    ...MERCHANT_VISIBLE_FILTER,
    lat: { gte: bbox.latMin, lte: bbox.latMax },
    lng: { gte: bbox.lngMin, lte: bbox.lngMax },
    ...(cat && { category: { slug: cat } }),
    ...(type && { type }),
  };

  let merchants = await prisma.merchant.findMany({
    where,
    take: SEARCH_LIMIT,
    include: includeMerchantCategory,
  });

  merchants = merchants
    .map((m) => ({ ...m, _distanceKm: haversineKm(Number(lat), Number(lng), m.lat, m.lng) }))
    .filter((m) => m._distanceKm <= radiusKm)
    .sort((a, b) => a._distanceKm - b._distanceKm);

  return { merchants };
};

module.exports = { search, nearby };

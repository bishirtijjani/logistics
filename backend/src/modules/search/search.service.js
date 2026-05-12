/**
 * Search & discovery service — Phase 6 implementation.
 *
 * Backed by PostgreSQL pg_trgm for fuzzy ranking on merchant and product
 * names (GIN indexes added in the Phase 6 migration). The previous skeleton
 * filtered on a non-existent `isApproved` column — corrected to the
 * canonical `isActive=true AND adminActiveOverride=true` filter that the
 * rest of the codebase uses to surface merchants to customers.
 *
 *   /search   — fuzzy across merchant.name + product.name, optional geo bbox.
 *   /nearby   — bounding-box-only merchant list (no text query).
 *
 * We rank with `similarity()` (returned as `_score`) so the mobile can sort
 * client-side if it wants to interleave merchants and products in one list.
 * Falls back to plain `findMany` when `q` is missing (no fuzzy needed).
 */

const { prisma } = require('../../config/database');
const { Prisma } = require('@prisma/client');

const SEARCH_LIMIT = 25;
const TRGM_THRESHOLD = 0.15; // similarity ≥ 0.15 ≈ "feels close to" the query

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

// Customer-facing visibility filter — must match what merchant.service.getMerchants
// uses so search results aren't a superset/subset of the listing.
const MERCHANT_VISIBLE_FILTER = {
  isActive: true,
  adminActiveOverride: true,
};

const includeMerchantCategory = {
  category: { select: { id: true, name: true, slug: true, color: true, icon: true, attributeSchema: true } },
};

/**
 * Unified search across merchants and products.
 * Returns `{ results: [{ kind:'merchant'|'product', ... }], query, category }`.
 *
 * When `q` is present we use pg_trgm `similarity()` and ORDER BY score DESC
 * to surface the closest matches first. When `q` is missing we just list
 * merchants matching the geo/category filter (useful for "everything around me").
 */
const search = async ({ q, type, category, lat, lng, radius }) => {
  const query = (q || '').trim();
  const cat = (category || '').trim() || null;
  const radiusKm = Number(radius) || 10;

  const wantsMerchants = !type || type === 'merchant';
  const wantsProducts = !type || type === 'product';

  // ── Merchants ────────────────────────────────────────────
  let merchants = [];
  if (wantsMerchants) {
    if (query) {
      // pg_trgm-ranked. We resolve ids via raw SQL then hydrate via Prisma so
      // the include/select stays in sync with the rest of the codebase.
      const bbox = lat != null && lng != null
        ? buildBoundingBox(Number(lat), Number(lng), radiusKm)
        : null;

      const bboxFragment = bbox
        ? Prisma.sql`AND "lat" BETWEEN ${bbox.latMin} AND ${bbox.latMax} AND "lng" BETWEEN ${bbox.lngMin} AND ${bbox.lngMax}`
        : Prisma.empty;

      const rows = await prisma.$queryRaw`
        SELECT id, similarity("name", ${query}) AS score
        FROM "merchants"
        WHERE
          "isActive" = true
          AND "adminActiveOverride" = true
          AND similarity("name", ${query}) > ${TRGM_THRESHOLD}
          ${bboxFragment}
        ORDER BY score DESC
        LIMIT ${SEARCH_LIMIT}
      `;
      const ids = rows.map((r) => r.id);
      const scoreById = new Map(rows.map((r) => [r.id, Number(r.score)]));

      if (ids.length > 0) {
        let hydrated = await prisma.merchant.findMany({
          where: {
            id: { in: ids },
            ...MERCHANT_VISIBLE_FILTER,
            ...(cat && { category: { slug: cat } }),
          },
          include: includeMerchantCategory,
        });
        hydrated = hydrated
          .map((m) => ({ ...m, _score: scoreById.get(m.id) ?? 0 }))
          .sort((a, b) => b._score - a._score);
        merchants = hydrated;
      }
    } else {
      // No text query → straight findMany with bbox / category filters.
      const where = {
        ...MERCHANT_VISIBLE_FILTER,
        ...(cat && { category: { slug: cat } }),
      };
      if (lat != null && lng != null) {
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
    const rows = await prisma.$queryRaw`
      SELECT p.id, similarity(p."name", ${query}) AS score
      FROM "products" p
      INNER JOIN "merchants" m ON p."merchantId" = m.id
      WHERE
        p."isAvailable" = true
        AND m."isActive" = true
        AND m."adminActiveOverride" = true
        AND similarity(p."name", ${query}) > ${TRGM_THRESHOLD}
      ORDER BY score DESC
      LIMIT ${SEARCH_LIMIT}
    `;
    const ids = rows.map((r) => r.id);
    const scoreById = new Map(rows.map((r) => [r.id, Number(r.score)]));

    if (ids.length > 0) {
      let hydrated = await prisma.product.findMany({
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
              category: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      });
      hydrated = hydrated
        .map((p) => ({ ...p, _score: scoreById.get(p.id) ?? 0 }))
        .sort((a, b) => b._score - a._score);
      products = hydrated;
    }
  }

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
 * Geo-filtered merchant list. Bounding-box only in V1 (Haversine distance
 * is computed in-memory below so we can sort by it). PostGIS `ST_DWithin`
 * substitution is a follow-up when dataset grows.
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

  // Sort by actual Haversine distance (the bbox is coarse).
  const toRad = (d) => (d * Math.PI) / 180;
  const haversineKm = (la1, lo1, la2, lo2) => {
    const R = 6371;
    const dLat = toRad(la2 - la1);
    const dLng = toRad(lo2 - lo1);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(la1)) * Math.cos(toRad(la2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  };
  merchants = merchants
    .map((m) => ({ ...m, _distanceKm: haversineKm(Number(lat), Number(lng), m.lat, m.lng) }))
    .filter((m) => m._distanceKm <= radiusKm)
    .sort((a, b) => a._distanceKm - b._distanceKm);

  return { merchants };
};

module.exports = { search, nearby };

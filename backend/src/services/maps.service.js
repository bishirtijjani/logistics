/**
 * Google Maps service - distance, geocoding, and directions.
 */

const axios = require("axios");
const { config } = require("../config");
const { prisma } = require("../config/database");
const { logger } = require("../utils/logger");
const { AppError } = require("../utils/api-error");
const { GEO_RESTRICTION, isInArea } = require("../config/geo-restriction");

const MAPS_BASE = "https://maps.googleapis.com/maps/api";

// Geocoding `components` filter. Restricts to the operating state when enabled,
// otherwise just to the country. See config/geo-restriction.js to undo.
const geocodeComponents = () =>
  GEO_RESTRICTION.enabled
    ? `country:${GEO_RESTRICTION.country}|administrative_area:${GEO_RESTRICTION.adminArea}`
    : `country:${GEO_RESTRICTION.country}`;

// ---- Local Katsina places index ----------------------------------------
// A curated/open-data list of Katsina wards, OSM places and neighbourhoods so
// short prefixes ("tudun") return Katsina suggestions INSTANTLY, instead of
// being buried under Kano in Google's prominence ranking. Built by
// scripts/build-katsina-places.js. Google stays as the live source for
// businesses + anything not in this list (see autocomplete below).
const KATSINA_PLACES = (() => {
  try {
    return require("../data/katsina-places.json").places || [];
  } catch {
    return [];
  }
})();

const normalizePlace = (s) =>
  (s || "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Descriptor words people tack onto a landmark that aren't part of its name in
// our index - so "kofar kaura roundabout" or "sabon gari junction" still match
// "Kofar Kaura" / "Sabon Gari". Stripped only for matching, never from what we
// display. Kept deliberately narrow: words like "market"/"gate" are often part
// of the real name, so they're not treated as generic.
const GENERIC_TOKENS = new Set([
  "roundabout", "round", "about", "junction", "junc", "jn", "road", "rd",
  "street", "st", "close", "avenue", "ave", "way", "lane", "crescent",
  "area", "by", "near", "beside", "opposite", "behind",
]);

const tokenize = (s) => normalizePlace(s).split(" ").filter(Boolean);

const placeById = new Map();
const placeIndex = KATSINA_PLACES.map((p) => {
  placeById.set(p.id, p);
  return { p, norm: normalizePlace(p.name) };
});

const toLocalSuggestion = (p) => ({
  placeId: `local:${p.id}`,
  description: p.lga ? `${p.name}, ${p.lga}, Katsina` : `${p.name}, Katsina`,
  mainText: p.name,
  secondaryText: p.lga ? `${p.lga}, Katsina` : "Katsina",
});

// Admin-curated places (custom_places) are resolved the same way as the local
// index but DB-backed, so the admin can add any location without a developer.
const toCustomSuggestion = (p) => ({
  placeId: `local:custom:${p.id}`,
  description: p.lga ? `${p.name}, ${p.lga}, Katsina` : `${p.name}, Katsina`,
  mainText: p.name,
  secondaryText: p.lga ? `${p.lga}, Katsina` : "Katsina",
});

/**
 * Prefix/substring search over the local Katsina index. Ranks, best first:
 *   0 exact
 *   1 whole-name prefix ("kofar ka" -> "Kofar Kaura")
 *   2 any-word prefix ("kaura" -> "Kofar Kaura")
 *   3 substring
 *   4 every meaningful word of the name appears among the meaningful words of
 *     the query, order-independent, once descriptor words are dropped from both
 *     ("kofar kaura roundabout" / "kaura kofar junction" -> "Kofar Kaura").
 *     Without this a query longer than the name matched nothing, so adding
 *     "roundabout"/"junction"/etc. silently dropped the local result. Matching
 *     on whole tokens (not raw substrings) keeps "Kofa" from matching inside
 *     "kofar".
 * then by name length and alphabetically.
 */
const localSearch = (query, limit = 6) => {
  const q = normalizePlace(query);
  if (!q) return [];
  // Drop descriptor words ("roundabout", "junction", ...) for the token match,
  // but never let the query collapse to nothing (a search for just "junction"
  // must not match every multi-word place).
  const qCore = tokenize(q).filter((w) => !GENERIC_TOKENS.has(w));
  const scored = [];
  for (const { p, norm } of placeIndex) {
    const nameTokens = norm.split(" ");
    const nameCore = nameTokens.filter((w) => !GENERIC_TOKENS.has(w));
    let score = -1;
    if (norm === q) score = 0;
    else if (norm.startsWith(q)) score = 1;
    else if (nameTokens.some((w) => w.startsWith(q))) score = 2;
    else if (norm.includes(q)) score = 3;
    else if (
      qCore.length > 0 &&
      nameCore.length > 0 &&
      nameCore.every((w) => qCore.includes(w))
    ) {
      score = 4;
    }
    if (score >= 0) scored.push({ p, score });
  }
  scored.sort(
    (a, b) =>
      a.score - b.score ||
      a.p.name.length - b.p.name.length ||
      a.p.name.localeCompare(b.p.name),
  );
  return scored.slice(0, limit).map(({ p }) => toLocalSuggestion(p));
};

/**
 * Search admin-curated places (custom_places). Same scoring as localSearch
 * (exact > name-prefix > word-prefix > substring > whole-word set match), but
 * matches across BOTH the display name and the aliases the admin recorded, so
 * a spot is findable by its Hausa name, faculty code, or common shorthand.
 * Ranks ahead of Google - these are the places we explicitly curated, so a
 * local hit should never be buried under a Kano namesake.
 */
const searchCustomPlaces = async (query, limit = 6) => {
  const q = normalizePlace(query);
  if (!q) return [];
  const qCore = tokenize(q).filter((w) => !GENERIC_TOKENS.has(w));
  let active;
  try {
    active = await prisma.customPlace.findMany({ where: { isActive: true } });
  } catch (error) {
    // No custom_places table yet (pre-migration) or a DB blip must NEVER break
    // autocomplete - fall back to the static index + Google exactly as before.
    logger.warn("Custom place search unavailable", { error: error.message });
    return [];
  }
  if (active.length === 0) return [];

  const scoreName = (n) => {
    const norm = normalizePlace(n);
    if (!norm) return -1;
    if (norm === q) return 0;
    if (norm.startsWith(q)) return 1;
    const tokens = norm.split(" ");
    if (tokens.some((w) => w.startsWith(q))) return 2;
    if (norm.includes(q)) return 3;
    const core = tokens.filter((w) => !GENERIC_TOKENS.has(w));
    if (qCore.length > 0 && core.length > 0 && core.every((w) => qCore.includes(w))) return 4;
    return -1;
  };

  const scored = [];
  for (const p of active) {
    let score = scoreName(p.name);
    if (score < 0 && Array.isArray(p.aliases)) {
      for (const a of p.aliases) {
        const s = scoreName(a);
        if (s >= 0 && (score < 0 || s < score)) score = s;
      }
    }
    if (score >= 0) scored.push({ p, score });
  }

  scored.sort(
    (a, b) =>
      a.score - b.score ||
      a.p.name.length - b.p.name.length ||
      a.p.name.localeCompare(b.p.name),
  );
  return scored.slice(0, limit).map(({ p }) => toCustomSuggestion(p));
};

/**
 * Active custom places inside a bounding box - for rendering labelled markers
 * on the customer/rider maps without loading the whole catalogue.
 */
const getCustomPlacesInBounds = async (raw) => {
  let { north, south, east, west } = raw;
  if (south > north) [south, north] = [north, south];
  if (west > east) [west, east] = [east, west];
  try {
    return await prisma.customPlace.findMany({
      where: {
        isActive: true,
        lat: { gte: south, lte: north },
        lng: { gte: west, lte: east },
      },
      orderBy: { name: "asc" },
      take: 200,
      select: { id: true, name: true, type: true, lat: true, lng: true, address: true },
    });
  } catch (error) {
    logger.warn("Custom places bounds query unavailable", { error: error.message });
    return [];
  }
};

/**
 * Get distance and duration between two points using Distance Matrix API.
 */
const getDistance = async (originLat, originLng, destLat, destLng) => {
  try {
    const response = await axios.get(`${MAPS_BASE}/distancematrix/json`, {
      params: {
        origins: `${originLat},${originLng}`,
        destinations: `${destLat},${destLng}`,
        key: config.GOOGLE_MAPS_API_KEY,
        units: "metric",
      },
      // Without a timeout, axios waits forever on a stalled upstream and the
      // /requests/quote call hangs with it - the client just spins. Cap it so
      // a slow/hung Maps response fails fast and surfaces a real error.
      timeout: 10000,
    });

    // Surface the actual Maps failure reason (REQUEST_DENIED, ZERO_RESULTS,
    // OVER_QUERY_LIMIT, ...) so logs explain *why* a quote couldn't price.
    const topStatus = response.data.status;
    const element = response.data.rows?.[0]?.elements?.[0];

    if (topStatus && topStatus !== "OK") {
      throw new Error(`Distance Matrix ${topStatus}: ${response.data.error_message || "no detail"}`);
    }
    if (!element || element.status !== "OK") {
      throw new Error(`Unable to calculate distance (element status: ${element?.status || "missing"})`);
    }

    return {
      distanceMeters: element.distance.value,
      distanceKm: element.distance.value / 1000,
      distanceText: element.distance.text,
      durationSeconds: element.duration.value,
      durationText: element.duration.text,
    };
  } catch (error) {
    logger.error("Google Maps distance failed", { error: error.message });
    throw AppError.internal("Unable to calculate distance");
  }
};

/**
 * Geocode an address to lat/lng coordinates.
 */
const geocodeAddress = async (address) => {
  try {
    const response = await axios.get(`${MAPS_BASE}/geocode/json`, {
      params: {
        address,
        key: config.GOOGLE_MAPS_API_KEY,
        components: geocodeComponents(),
      },
    });

    const result = response.data.results?.[0];
    if (!result) throw new Error("Address not found");

    const lat = result.geometry.location.lat;
    const lng = result.geometry.location.lng;
    return {
      lat,
      lng,
      formattedAddress: result.formatted_address,
      placeId: result.place_id,
      // True when the resolved point sits outside the operating area. Always
      // false when the restriction is disabled. See config/geo-restriction.js.
      outOfArea: !isInArea(lat, lng),
    };
  } catch (error) {
    logger.error("Geocoding failed", { address, error: error.message });
    throw AppError.badRequest("Unable to geocode address");
  }
};

// A Google "plus code" (e.g. "2H6X+JF") - the open-location grid reference
// Google falls back to when a point has no street address. Meaningless to a
// rider, so we never surface it as the address (see reverseGeocode). The token
// is a base-20 alphabet + "+", optionally trailed by "City, Country".
const PLUS_CODE_RE = /^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}\b[\s,]*/i;

const isPlusCodeResult = (r) =>
  (r.types || []).includes("plus_code") ||
  PLUS_CODE_RE.test((r.formatted_address || "").trim());

// Drop a leading plus-code token if one slipped into an otherwise-real address
// ("2H6X+JF Tudun Yan Lihidda, Katsina" -> "Tudun Yan Lihidda, Katsina").
const stripPlusCode = (addr) => (addr || "").replace(PLUS_CODE_RE, "").trim();

/**
 * Reverse geocode lat/lng to an address.
 */
const reverseGeocode = async (lat, lng) => {
  try {
    const response = await axios.get(`${MAPS_BASE}/geocode/json`, {
      params: {
        latlng: `${lat},${lng}`,
        key: config.GOOGLE_MAPS_API_KEY,
      },
    });

    const results = response.data.results || [];
    if (results.length === 0) throw new Error("Location not found");

    // Google puts a bare plus-code result first when the point has no street
    // address ("2H6X+JF Katsina, Nigeria"). Skip those and use the most
    // specific real address (results are ordered specific -> general); only
    // fall back to a plus code if it's genuinely all Google returned.
    const result = results.find((r) => !isPlusCodeResult(r)) || results[0];
    const formattedAddress = stripPlusCode(result.formatted_address) || result.formatted_address;

    return {
      formattedAddress,
      placeId: result.place_id,
      // True when the queried point sits outside the operating area. Lets the
      // clients warn instead of accepting an out-of-state pin. Always false
      // when the restriction is disabled. See config/geo-restriction.js.
      outOfArea: !isInArea(lat, lng),
    };
  } catch (error) {
    logger.error("Reverse geocoding failed", { lat, lng });
    throw AppError.badRequest("Unable to determine address");
  }
};

/**
 * Get directions between two points.
 */
const getDirections = async (originLat, originLng, destLat, destLng) => {
  try {
    const response = await axios.get(`${MAPS_BASE}/directions/json`, {
      params: {
        origin: `${originLat},${originLng}`,
        destination: `${destLat},${destLng}`,
        key: config.GOOGLE_MAPS_API_KEY,
        mode: "driving",
      },
    });

    const route = response.data.routes?.[0];
    if (!route) throw new Error("No route found");

    return {
      polyline: route.overview_polyline?.points,
      distanceMeters: route.legs?.[0]?.distance?.value,
      durationSeconds: route.legs?.[0]?.duration?.value,
      steps: route.legs?.[0]?.steps?.map((s) => ({
        instruction: s.html_instructions,
        distance: s.distance.text,
        duration: s.duration.text,
      })),
    };
  } catch (error) {
    logger.error("Directions failed", { error: error.message });
    throw AppError.internal("Unable to get directions");
  }
};

// Map a legacy autocomplete prediction to our suggestion shape.
const fromPrediction = (p) => ({
  placeId: p.place_id,
  description: p.description,
  mainText: p.structured_formatting?.main_text,
  secondaryText: p.structured_formatting?.secondary_text,
});

// Map a geocoding result to our suggestion shape (split the formatted address
// into a main/secondary line so the dropdown reads like an autocomplete row).
const fromGeocode = (r) => {
  const parts = (r.formatted_address || "").split(", ");
  return {
    placeId: r.place_id,
    description: r.formatted_address,
    mainText: parts[0] || r.formatted_address,
    secondaryText: parts.slice(1).join(", "),
  };
};

/**
 * Places Autocomplete, restricted to the operating area (Katsina).
 *
 * Why it's not just one Autocomplete call: Google ranks autocomplete by
 * prominence, and Kano (a far bigger city next door) buries Katsina's
 * namesakes - a search like "Tudun Wada" returns five Kano/Kaduna rows and zero
 * Katsina ones. A circle/box restriction can't fix this (Kano sits inside any
 * box around Katsina). So when the restriction is on we merge TWO sources:
 *   1. Autocomplete - keep only predictions whose text already names the state
 *      as a distinct term (good for prominent Katsina POIs/businesses).
 *   2. Geocoding with components=administrative_area:Katsina - a HARD state
 *      filter that surfaces the Katsina areas/streets autocomplete buried,
 *      skipping the bare "Katsina, Nigeria" whole-state fallback.
 * Results are de-duped by placeId. See config/geo-restriction.js to undo.
 */
const autocomplete = async (query, sessionToken) => {
  try {
    const acParams = {
      input: query,
      key: config.GOOGLE_MAPS_API_KEY,
      components: `country:${GEO_RESTRICTION.country.toLowerCase()}`,
    };
    if (GEO_RESTRICTION.enabled) {
      // Bias autocomplete toward the area (helps, but doesn't restrict).
      acParams.location = `${GEO_RESTRICTION.search.center.lat},${GEO_RESTRICTION.search.center.lng}`;
      acParams.radius = GEO_RESTRICTION.search.radiusMeters;
    }
    const acReq = axios.get(`${MAPS_BASE}/place/autocomplete/json`, { params: acParams });

    // Admin-curated places always rank first - they are the exact, curated
    // points (campus buildings, estates) that search must never bury.
    const customReq = searchCustomPlaces(query);

    // Restriction off: plain autocomplete, all of the country.
    if (!GEO_RESTRICTION.enabled) {
      const [customRes, response] = await Promise.all([customReq, acReq]);
      if (response.data.status !== "OK" && response.data.status !== "ZERO_RESULTS") {
        throw new Error(response.data.error_message || "Autocomplete failed");
      }
      const out = [...customRes];
      const seen = new Set(out.map((r) => r.placeId));
      for (const p of response.data.predictions || []) {
        if (seen.has(p.place_id)) continue;
        seen.add(p.place_id);
        out.push(fromPrediction(p));
      }
      return out.slice(0, 8);
    }

    // Restriction on: run autocomplete + state-scoped geocoding in parallel.
    const gcReq = axios.get(`${MAPS_BASE}/geocode/json`, {
      params: { address: query, key: config.GOOGLE_MAPS_API_KEY, components: geocodeComponents() },
    });
    const [customRes, acRes, gcRes] = await Promise.all([customReq, acReq, gcReq]);

    if (acRes.data.status !== "OK" && acRes.data.status !== "ZERO_RESULTS") {
      throw new Error(acRes.data.error_message || "Autocomplete failed");
    }

    const state = GEO_RESTRICTION.label.toLowerCase();
    const out = [];
    const seen = new Set();

    // 0) Admin-curated custom places first - exact, curated, DB-backed.
    const localNames = [];
    for (const r of customRes) {
      out.push(r);
      seen.add(r.placeId);
      localNames.push(normalizePlace(r.mainText));
    }

    // 1) Local Katsina index - instant, natural prefix matches for known
    //    districts/areas/neighbourhoods.
    const localResults = localSearch(query);
    for (const r of localResults) {
      out.push(r);
      seen.add(r.placeId);
      localNames.push(normalizePlace(r.mainText));
    }

    // 1) Autocomplete predictions already tagged with the state (as a term or in
    //    the secondary line) - NOT a description substring, so "Katsina Road,
    //    Kaduna" is not falsely kept. These cover businesses/POIs by name.
    for (const p of acRes.data.predictions || []) {
      const secondary = (p.structured_formatting?.secondary_text || "").toLowerCase();
      const terms = (p.terms || []).map((t) => (t.value || "").trim().toLowerCase());
      if ((secondary.includes(state) || terms.includes(state)) && !seen.has(p.place_id)) {
        seen.add(p.place_id);
        out.push(fromPrediction(p));
      }
    }

    // 2) Geocoding matches inside Katsina, skipping the whole-state fallback
    //    (administrative_area_level_1) and any row that just restates a local
    //    result (e.g. local "Tudun Wada" vs geocoded "Tudun Wada 831101").
    for (const r of gcRes.data.results || []) {
      if ((r.types || []).includes("administrative_area_level_1")) continue;
      if (seen.has(r.place_id)) continue;
      const gk = normalizePlace((r.formatted_address || "").split(", ")[0]);
      if (localNames.some((ln) => gk === ln || gk.startsWith(`${ln} `))) continue;
      seen.add(r.place_id);
      out.push(fromGeocode(r));
    }

    return out.slice(0, 8);
  } catch (error) {
    logger.error("Autocomplete failed", { query, error: error.message });
    throw AppError.internal("Unable to search places");
  }
};

/**
 * Resolve a local-index pick ("local:<id>") to coordinates. Wards/OSM entries
 * carry coordinates; curated neighbourhoods don't, so those are geocoded live
 * (state-scoped) on selection - we never persist Google content, just resolve
 * on demand. Falls back to the entry's own coords if geocoding finds nothing.
 */
const localPlaceDetails = async (id) => {
  const entry = placeById.get(id);
  if (!entry) throw AppError.badRequest("Unknown place");

  let { lat, lng } = entry;
  let formattedAddress = entry.lga
    ? `${entry.name}, ${entry.lga}, Katsina, Nigeria`
    : `${entry.name}, Katsina, Nigeria`;

  if (lat == null || lng == null) {
    const response = await axios.get(`${MAPS_BASE}/geocode/json`, {
      params: {
        address: `${entry.name}, Katsina`,
        key: config.GOOGLE_MAPS_API_KEY,
        components: geocodeComponents(),
      },
    });
    const r = (response.data.results || []).find(
      (x) => !(x.types || []).includes("administrative_area_level_1"),
    );
    if (r) {
      lat = r.geometry.location.lat;
      lng = r.geometry.location.lng;
      formattedAddress = r.formatted_address;
    }
  }

  if (lat == null || lng == null) throw AppError.badRequest("Could not locate place");
  return { lat, lng, formattedAddress, placeId: `local:${id}`, outOfArea: !isInArea(lat, lng) };
};

/**
 * Place Details - get lat/lng and formatted address for a place ID using Places Details API.
 */
const placeDetails = async (placeId, sessionToken) => {
  // Local-index pick: resolve from our dataset (and live geocode if needed).
  if (typeof placeId === "string" && placeId.startsWith("local:")) {
    // Admin-curated, DB-backed place (custom_places).
    if (placeId.startsWith("local:custom:")) {
      const id = placeId.slice("local:custom:".length);
      const place = await prisma.customPlace.findUnique({ where: { id } });
      if (!place || !place.isActive) throw AppError.badRequest("Unknown place");
      return {
        lat: place.lat,
        lng: place.lng,
        formattedAddress:
          place.address ||
          (place.lga ? `${place.name}, ${place.lga}, Katsina, Nigeria` : `${place.name}, Katsina, Nigeria`),
        placeId: `local:custom:${place.id}`,
        outOfArea: !isInArea(place.lat, place.lng),
      };
    }
    return localPlaceDetails(placeId.slice("local:".length));
  }
  try {
    const response = await axios.get(`${MAPS_BASE}/place/details/json`, {
      params: {
        place_id: placeId,
        key: config.GOOGLE_MAPS_API_KEY,
        fields: "geometry,formatted_address,name",
      },
    });

    if (response.data.status !== "OK") {
      throw new Error(response.data.error_message || "Place details failed");
    }

    const result = response.data.result;
    const lat = result.geometry.location.lat;
    const lng = result.geometry.location.lng;
    return {
      lat,
      lng,
      formattedAddress: result.formatted_address,
      placeId: placeId,
      // The real operating-area gate: search is only biased, so a picked place
      // can still land outside Katsina. Clients use this to reject it. Always
      // false when the restriction is disabled. See config/geo-restriction.js.
      outOfArea: !isInArea(lat, lng),
    };
  } catch (error) {
    logger.error("Place details failed", { placeId, error: error.message });
    throw AppError.internal("Unable to get place details");
  }
};

module.exports = {
  getDistance,
  geocodeAddress,
  reverseGeocode,
  getDirections,
  autocomplete,
  placeDetails,
  getCustomPlacesInBounds,
};

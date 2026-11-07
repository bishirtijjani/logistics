/**
 * Geo-restriction - confine maps & place-search to a single operating area
 * (currently ). This is the ONE place that controls server-side
 * search/geocoding scope for every app (customer, rider, merchant, admin),
 * since they all proxy Google through maps.service.
 *
 * How the gate works: a circle or rectangle can never trace a state border, so
 * those only ever get us "roughly Katsina-ish". The real gate is the actual
 * Katsina boundary polygon below + a point-in-polygon test (isInArea). Search
 * is biased to the area for relevance, but the binding decision (a picked place
 * or a dropped pin) is validated against the polygon, so an out-of-state point
 * can never be committed.
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ EASY UNDO: set `enabled: false` below (or GEO_RESTRICTION_DISABLED=true │
 * │ in the environment) and search/geocoding reopen to all of Nigeria, and │
 * │ isInArea() returns true everywhere. No other code changes required.    │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * Boundary source: geoBoundaries gbOpen NGA ADM1 (Katsina), simplified with
 * Ramer-Douglas-Peucker to ~85 points at ~4-decimal (~11 m) precision. Stored
 * as [lng, lat] pairs (GeoJSON order). To refresh, re-run the same simplify.
 */

//  outer boundary, [lng, lat] pairs, closed ring.
const KATSINA_POLYGON = [
  [6.8894,11.3836], [7.0062,11.3618], [7.0087,11.2938], [6.9677,11.2452], [7.069,11.2033], [7.1521,11.1288],
  [7.2003,11.1517], [7.2197,11.1942], [7.1948,11.2576], [7.2896,11.2843], [7.3578,11.2643], [7.3979,11.378],
  [7.5203,11.3616], [7.6075,11.2718], [7.7062,11.31], [7.72,11.369], [7.7506,11.3791], [7.6945,11.4203],
  [7.6752,11.4833], [7.6796,11.5237], [7.7185,11.569], [7.7049,11.5925], [7.7669,11.6286], [7.9023,11.6532],
  [7.8608,11.762], [7.8651,11.8735], [7.8262,11.9533], [7.8798,12.0443], [7.8542,12.1551], [7.8781,12.2534],
  [7.8645,12.2807], [7.8924,12.3303], [8.0024,12.3936], [8.1567,12.4403], [8.1904,12.5052], [8.1799,12.5641],
  [8.2462,12.5944], [8.1532,12.6554], [8.1445,12.7213], [8.1849,12.7351], [8.1523,12.7968], [8.1278,12.8011],
  [8.3375,12.836], [8.4354,12.8152], [8.5632,12.8341], [8.6038,12.7373], [8.6518,12.7331], [8.688,12.6882],
  [8.7448,12.6667], [8.8646,12.669], [8.9513,12.7381], [8.9829,12.8068], [9.0473,12.8162], [9.0409,12.8461],
  [8.9775,12.8375], [8.6636,12.9433], [8.615,13.0219], [8.5419,13.075], [8.4086,13.0883], [8.2872,13.1983],
  [8.1233,13.3031], [8.0406,13.3213], [7.8197,13.3523], [7.3797,13.0997], [7.2189,13.1256], [7.0906,12.9953],
  [7.0513,12.9955], [7.0607,12.7398], [6.989,12.6734], [7.0445,12.6589], [7.0933,12.2826], [7.1504,12.2316],
  [7.1568,12.1851], [7.1172,12.094], [7.2466,11.9326], [7.1998,11.9005], [7.1408,11.9113], [7.1418,11.8493],
  [7.06,11.7899], [7.0173,11.8156], [6.9012,11.7976], [6.852,11.6207], [6.8568,11.589], [6.904,11.5532],
  [6.8894,11.3836],
];

const GEO_RESTRICTION = {
  // Master switch. Set to false to open search/geocoding to all of Nigeria.
  enabled: true,

  label: 'Katsina',
  country: 'NG',

  // Google Geocoding `components` administrative_area filter - precise to the
  // state, used by geocodeAddress().
  adminArea: 'Katsina',

  // Autocomplete is BIASED (not strictly bounded) to this circle so nearby
  // Katsina results rank first while real point-in-polygon validation happens
  // when a place is actually picked. Centre/radius roughly cover the state.
  search: {
    center: { lat: 12.4, lng: 7.6 },
    radiusMeters: 150000,
  },

  polygon: KATSINA_POLYGON,
};

/**
 * Point-in-polygon (ray casting). Returns true for any point when the
 * restriction is disabled, so callers don't need to branch on `enabled`.
 */
const isInArea = (lat, lng) => {
  if (!GEO_RESTRICTION.enabled) return true;
  if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
    return false;
  }
  const poly = GEO_RESTRICTION.polygon;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersects =
      (yi > lat) !== (yj > lat) &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
};

module.exports = { GEO_RESTRICTION, isInArea };

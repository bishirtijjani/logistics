/**
 * Geo-restriction (web) - keeps the map view inside the operating area
 * (currently Katsina State). Place SEARCH is biased + gated on the backend
 * (config/geo-restriction.js, which also returns `outOfArea` on resolved
 * coordinates); this file snaps the map centre / pin back to the nearest
 * in-area point when a user pans outside, and exposes the boundary so the
 * picker can draw the operating area.
 *
 * A bounding box can't trace a state border, so the gate is the real Katsina
 * polygon + a point-in-polygon test. clampToBounds projects an out-of-area
 * point onto the nearest point inside the polygon.
 *
 * EASY UNDO: set `enabled: false` and the map roams freely again.
 */

// Katsina State outer boundary, [lng, lat] pairs, closed ring. Mirror of the
// backend polygon in backend/src/config/geo-restriction.js - keep them in sync.
const POLYGON = [
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
]

// Approximate area centroid, used to nudge a snapped border point inward so it
// lands strictly inside the polygon rather than exactly on the edge.
const CENTROID = { lng: 7.7484, lat: 12.1779 }

export const GEO_RESTRICTION = {
  enabled: false, // TEMP: disabled for Abuja dev-team E2E testing — re-enable before iprime handoff
  label: 'Katsina',
  // Default map centre (Katsina city).
  center: { lat: 13.0059, lng: 7.6019 },
  polygon: POLYGON,
  // Boundary as {lat, lng} path, for drawing the operating area overlay.
  polygonPath: POLYGON.map(([lng, lat]) => ({ lat, lng })),
}

/** Point-in-polygon (ray casting). x = lng, y = lat. */
const pointInPolygon = (lat, lng) => {
  let inside = false
  for (let i = 0, j = POLYGON.length - 1; i < POLYGON.length; j = i++) {
    const xi = POLYGON[i][0], yi = POLYGON[i][1]
    const xj = POLYGON[j][0], yj = POLYGON[j][1]
    const intersects =
      (yi > lat) !== (yj > lat) &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}

/** Nearest point to (lat,lng) on segment a->b, with a,b as [lng,lat]. */
const nearestOnSegment = (lng, lat, a, b) => {
  const ax = a[0], ay = a[1], bx = b[0], by = b[1]
  const dx = bx - ax, dy = by - ay
  const len2 = dx * dx + dy * dy
  let t = len2 === 0 ? 0 : ((lng - ax) * dx + (lat - ay) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return { lng: ax + t * dx, lat: ay + t * dy }
}

/** Closest point inside the polygon to (lat,lng): project to the nearest edge, nudge inward. */
const nearestInside = (lat, lng) => {
  let best = null
  let bestD = Infinity
  for (let i = 0, j = POLYGON.length - 1; i < POLYGON.length; j = i++) {
    const p = nearestOnSegment(lng, lat, POLYGON[j], POLYGON[i])
    const d = (p.lng - lng) ** 2 + (p.lat - lat) ** 2
    if (d < bestD) {
      bestD = d
      best = p
    }
  }
  // Walk from the nearest boundary point toward the centroid until strictly
  // inside - one small nudge isn't enough near concave stretches of the border.
  let latIn = best.lat
  let lngIn = best.lng
  for (let f = 0.01; f <= 1; f += 0.04) {
    lngIn = best.lng + (CENTROID.lng - best.lng) * f
    latIn = best.lat + (CENTROID.lat - best.lat) * f
    if (pointInPolygon(latIn, lngIn)) break
  }
  return { lat: latIn, lng: lngIn }
}

/** Snap a {lat, lng} to the nearest point inside the area (no-op when disabled / already inside). */
export const clampToBounds = ({ lat, lng }) => {
  if (!GEO_RESTRICTION.enabled || pointInPolygon(lat, lng)) return { lat, lng }
  return nearestInside(lat, lng)
}

/** True when the point sits outside the operating area (false when disabled). */
export const isOutOfBounds = ({ lat, lng }) => {
  if (!GEO_RESTRICTION.enabled) return false
  return !pointInPolygon(lat, lng)
}

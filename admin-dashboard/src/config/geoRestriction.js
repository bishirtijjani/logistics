/**
 * Geo-restriction (web) - keeps the map view inside the operating area
 * (currently Katsina State). Place SEARCH is restricted on the backend
 * (config/geo-restriction.js); this only snaps the map centre / pin back when
 * a user pans outside the area.
 *
 * EASY UNDO: set `enabled: false` and the map roams freely again.
 */
export const GEO_RESTRICTION = {
  enabled: true,
  label: 'Katsina',
  // Default map centre (Katsina city).
  center: { lat: 13.0059, lng: 7.6019 },
  // Rough Katsina State bounding box used to clamp the map centre / picked pin.
  bounds: { minLat: 11.1, maxLat: 13.42, minLng: 6.55, maxLng: 9.05 },
}

/** Clamp a {lat, lng} to the operating bounds (no-op when disabled). */
export const clampToBounds = ({ lat, lng }) => {
  if (!GEO_RESTRICTION.enabled) return { lat, lng }
  const b = GEO_RESTRICTION.bounds
  return {
    lat: Math.min(Math.max(lat, b.minLat), b.maxLat),
    lng: Math.min(Math.max(lng, b.minLng), b.maxLng),
  }
}

/** True when the point sits outside the operating bounds (false when disabled). */
export const isOutOfBounds = ({ lat, lng }) => {
  if (!GEO_RESTRICTION.enabled) return false
  const b = GEO_RESTRICTION.bounds
  return lat < b.minLat || lat > b.maxLat || lng < b.minLng || lng > b.maxLng
}

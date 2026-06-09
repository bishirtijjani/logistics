/**
 * Geo-restriction (client) - keeps the map view inside the operating area
 * (currently Katsina State). Place SEARCH is restricted separately on the
 * backend (config/geo-restriction.js); this only governs the map camera so a
 * user can't pan/drop a pin outside the area.
 *
 * EASY UNDO: set `enabled: false` and the map roams freely again.
 */
export const GEO_RESTRICTION = {
  enabled: true,
  label: "Katsina",
  // Default map centre (Katsina city).
  center: { latitude: 13.0059, longitude: 7.6019 },
  // Rough Katsina State bounding box used to clamp the map centre / picked pin.
  bounds: { minLat: 11.1, maxLat: 13.42, minLng: 6.55, maxLng: 9.05 },
};

/** Clamp a {latitude, longitude} to the operating bounds (no-op when disabled). */
export const clampToBounds = ({ latitude, longitude }) => {
  if (!GEO_RESTRICTION.enabled) return { latitude, longitude };
  const b = GEO_RESTRICTION.bounds;
  return {
    latitude: Math.min(Math.max(latitude, b.minLat), b.maxLat),
    longitude: Math.min(Math.max(longitude, b.minLng), b.maxLng),
  };
};

/** True when the point sits outside the operating bounds (false when disabled). */
export const isOutOfBounds = ({ latitude, longitude }) => {
  if (!GEO_RESTRICTION.enabled) return false;
  const b = GEO_RESTRICTION.bounds;
  return (
    latitude < b.minLat || latitude > b.maxLat ||
    longitude < b.minLng || longitude > b.maxLng
  );
};

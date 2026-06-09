/**
 * Geo-restriction - confine maps & place-search to a single operating area
 * (currently Katsina State). This is the ONE place that controls server-side
 * search/geocoding scope for every app (customer, rider, merchant, admin),
 * since they all proxy Google through maps.service.
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ EASY UNDO: set `enabled: false` below (or GEO_RESTRICTION_DISABLED=true │
 * │ in the environment) and search/geocoding immediately reopen to all of  │
 * │ Nigeria. No other code changes or redeploys of the apps required.      │
 * └──────────────────────────────────────────────────────────────────────┘
 */

const GEO_RESTRICTION = {
  // Master switch. Env override wins so it can be flipped without a code change.
  enabled: process.env.GEO_RESTRICTION_DISABLED === 'true' ? false : true,

  label: 'Katsina',
  country: 'NG',

  // Google Geocoding `components` administrative_area filter - precise to the
  // state, used by geocodeAddress().
  adminArea: 'Katsina',

  // Autocomplete can only be restricted by a circle (legacy Places API), so we
  // bias+strictbound to a circle that approximately covers Katsina State.
  // Centered on the state interior rather than the capital so the radius reaches
  // the southern LGAs without excessive bleed into neighbouring states.
  search: {
    center: { lat: 12.4, lng: 7.6 },
    radiusMeters: 150000,
  },
};

module.exports = { GEO_RESTRICTION };

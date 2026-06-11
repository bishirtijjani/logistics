/**
 * Google Maps service - distance, geocoding, and directions.
 */

const axios = require("axios");
const { config } = require("../config");
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
    });

    const element = response.data.rows?.[0]?.elements?.[0];

    if (!element || element.status !== "OK") {
      throw new Error("Unable to calculate distance");
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

    const result = response.data.results?.[0];
    if (!result) throw new Error("Location not found");

    return {
      formattedAddress: result.formatted_address,
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

/**
 * Places Autocomplete - using legacy Places Autocomplete API.
 */
const autocomplete = async (query, sessionToken) => {
  try {
    // BIAS (not strict-bound) results toward the operating area. A circle can't
    // trace the state border, and `strictbounds` on a circle big enough to
    // cover Katsina also admits a lot of neighbouring towns, so strict mode here
    // gives a false sense of restriction. Instead we bias for relevance and do
    // the real point-in-polygon gate at placeDetails() time, once we have
    // coordinates. See config/geo-restriction.js to undo.
    //
    // Note: the legacy Autocomplete API rejects combined `types` like
    // "geocode|establishment" - it accepts a single type or none. We omit it so
    // both addresses and businesses come back.
    const restriction = GEO_RESTRICTION.enabled
      ? {
          location: `${GEO_RESTRICTION.search.center.lat},${GEO_RESTRICTION.search.center.lng}`,
          radius: GEO_RESTRICTION.search.radiusMeters,
        }
      : {};
    const response = await axios.get(`${MAPS_BASE}/place/autocomplete/json`, {
      params: {
        input: query,
        key: config.GOOGLE_MAPS_API_KEY,
        components: `country:${GEO_RESTRICTION.country.toLowerCase()}`,
        ...restriction,
      },
    });

    if (response.data.status !== "OK" && response.data.status !== "ZERO_RESULTS") {
      throw new Error(response.data.error_message || "Autocomplete failed");
    }

    let predictions = response.data.predictions || [];

    // Keep only suggestions whose STATE component is the operating area, so a
    // search like "Tudun Wada" returns the Katsina one, not the Kano/Kaduna
    // namesakes. Geographic restriction can't do this (Kano sits inside any box
    // around Katsina); the admin component in `terms`/`secondary_text` can.
    // We match the state as a distinct comma-separated term (or the secondary
    // text), NOT a substring of the whole description, so "Katsina Road, Kaduna"
    // is correctly excluded. See config/geo-restriction.js to undo.
    if (GEO_RESTRICTION.enabled) {
      const state = GEO_RESTRICTION.label.toLowerCase();
      const inState = (p) => {
        const secondary = (p.structured_formatting?.secondary_text || "").toLowerCase();
        if (secondary.includes(state)) return true;
        const terms = (p.terms || []).map((t) => (t.value || "").trim().toLowerCase());
        return terms.includes(state);
      };
      predictions = predictions.filter(inState);
    }

    return predictions.map((p) => ({
      placeId: p.place_id,
      description: p.description,
      mainText: p.structured_formatting?.main_text,
      secondaryText: p.structured_formatting?.secondary_text,
    }));
  } catch (error) {
    logger.error("Autocomplete failed", { query, error: error.message });
    throw AppError.internal("Unable to search places");
  }
};

/**
 * Place Details - get lat/lng and formatted address for a place ID using Places Details API.
 */
const placeDetails = async (placeId, sessionToken) => {
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
};

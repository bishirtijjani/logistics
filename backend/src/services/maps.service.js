/**
 * Google Maps service — distance, geocoding, and directions.
 */

const axios = require('axios');
const { config } = require('../config');
const { logger } = require('../utils/logger');
const { AppError } = require('../utils/api-error');

const MAPS_BASE = 'https://maps.googleapis.com/maps/api';

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
        units: 'metric',
      },
    });

    const element = response.data.rows?.[0]?.elements?.[0];

    if (!element || element.status !== 'OK') {
      throw new Error('Unable to calculate distance');
    }

    return {
      distanceMeters: element.distance.value,
      distanceKm: element.distance.value / 1000,
      distanceText: element.distance.text,
      durationSeconds: element.duration.value,
      durationText: element.duration.text,
    };
  } catch (error) {
    logger.error('Google Maps distance failed', { error: error.message });
    throw AppError.internal('Unable to calculate distance');
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
        components: 'country:NG',
      },
    });

    const result = response.data.results?.[0];
    if (!result) throw new Error('Address not found');

    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formattedAddress: result.formatted_address,
      placeId: result.place_id,
    };
  } catch (error) {
    logger.error('Geocoding failed', { address, error: error.message });
    throw AppError.badRequest('Unable to geocode address');
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
    if (!result) throw new Error('Location not found');

    return {
      formattedAddress: result.formatted_address,
      placeId: result.place_id,
    };
  } catch (error) {
    logger.error('Reverse geocoding failed', { lat, lng });
    throw AppError.badRequest('Unable to determine address');
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
        mode: 'driving',
      },
    });

    const route = response.data.routes?.[0];
    if (!route) throw new Error('No route found');

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
    logger.error('Directions failed', { error: error.message });
    throw AppError.internal('Unable to get directions');
  }
};

module.exports = {
  getDistance,
  geocodeAddress,
  reverseGeocode,
  getDirections,
};

/**
 * Maps controller — proxies Google Maps API calls to keep API key server-side.
 */

const mapsService = require("../../services/maps.service");
const { ApiResponse } = require("../../utils/api-response");

const autocomplete = async (req, res, next) => {
  try {
    const { query, sessionToken } = req.query;
    const predictions = await mapsService.autocomplete(query, sessionToken);
    res.json(ApiResponse.success("Places retrieved", predictions));
  } catch (error) {
    next(error);
  }
};

const placeDetails = async (req, res, next) => {
  try {
    const { placeId, sessionToken } = req.query;
    const details = await mapsService.placeDetails(placeId, sessionToken);
    res.json(ApiResponse.success("Place details retrieved", details));
  } catch (error) {
    next(error);
  }
};

const reverseGeocode = async (req, res, next) => {
  try {
    const { lat, lng } = req.query;
    const result = await mapsService.reverseGeocode(Number(lat), Number(lng));
    res.json(ApiResponse.success("Address retrieved", result));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  autocomplete,
  placeDetails,
  reverseGeocode,
};

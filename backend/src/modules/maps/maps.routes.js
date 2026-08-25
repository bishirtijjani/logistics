/**
 * Maps routes - /maps
 */

const { Router } = require("express");
const mapsController = require("./maps.controller");
const { validate } = require("../../middlewares/validate.middleware");
const { authenticate } = require("../../middlewares/auth.middleware");
const { mapsLimiter } = require("../../middlewares/rate-limit.middleware");
const {
  autocompleteSchema,
  placeDetailsSchema,
  reverseGeocodeSchema,
  customPlacesSchema,
} = require("./maps.validator");

const router = Router();

// All maps routes require an authenticated user. The Google-backed routes
// additionally share a per-user rate-limit budget (60 req/min) - the Places
// API costs real money, so anonymous open access was a quota-bleed risk.
// /custom-places is a pure DB read (no Google cost) and is fetched on every
// map pan, so it is deliberately exempt from mapsLimiter.
router.use(authenticate);

router.get(
  "/custom-places",
  validate(customPlacesSchema, "query"),
  mapsController.customPlaces,
);

router.use(mapsLimiter);

router.get(
  "/autocomplete",
  validate(autocompleteSchema, "query"),
  mapsController.autocomplete,
);

router.get(
  "/place-details",
  validate(placeDetailsSchema, "query"),
  mapsController.placeDetails,
);

router.get(
  "/reverse-geocode",
  validate(reverseGeocodeSchema, "query"),
  mapsController.reverseGeocode,
);

module.exports = router;

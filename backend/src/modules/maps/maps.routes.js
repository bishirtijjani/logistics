/**
 * Maps routes — /api/maps
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
} = require("./maps.validator");

const router = Router();

// All maps routes require an authenticated user AND share a per-user
// rate-limit budget (60 req/min). The Google Maps Places API costs real
// money, so anonymous open access was a quota-bleed risk.
router.use(authenticate, mapsLimiter);

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

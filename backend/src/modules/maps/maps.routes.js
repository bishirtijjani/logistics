/**
 * Maps routes — /api/maps
 */

const { Router } = require("express");
const mapsController = require("./maps.controller");
const { validate } = require("../../middlewares/validate.middleware");
const { authenticate } = require("../../middlewares/auth.middleware");
const {
  autocompleteSchema,
  placeDetailsSchema,
  reverseGeocodeSchema,
} = require("./maps.validator");

const router = Router();

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

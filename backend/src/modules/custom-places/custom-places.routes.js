/**
 * Custom places routes - mounted under /admin by admin.routes.js (inherit
 * authenticate + authorize('ADMIN')). Permission: MANAGE_SETTINGS - map places
 * are a platform-geography concern, the same bucket as banners/settings.
 */

const { Router } = require('express');
const customPlacesController = require('./custom-places.controller');
const { validate } = require('../../middlewares/validate.middleware');
const {
  createCustomPlaceSchema,
  updateCustomPlaceSchema,
  listCustomPlacesSchema,
} = require('./custom-places.validator');

const router = Router();

router.get('/', validate(listCustomPlacesSchema, 'query'), customPlacesController.listCustomPlaces);
router.post('/', validate(createCustomPlaceSchema), customPlacesController.createCustomPlace);
router.put('/:placeId', validate(updateCustomPlaceSchema), customPlacesController.updateCustomPlace);
router.delete('/:placeId', customPlacesController.deleteCustomPlace);

module.exports = router;

/**
 * Custom places controller - admin CRUD for admin-curated map locations.
 */

const { ApiResponse } = require('../../utils/api-response');
const customPlacesService = require('./custom-places.service');

const listCustomPlaces = async (req, res, next) => {
  try {
    const { items, total, page, limit } = await customPlacesService.listCustomPlaces(req.query);
    res.json(ApiResponse.paginated('Custom places', items, page, limit, total));
  } catch (error) {
    next(error);
  }
};

const createCustomPlace = async (req, res, next) => {
  try {
    const place = await customPlacesService.createCustomPlace(
      req.body,
      req.user.id,
      req.ip,
      req.headers['user-agent'],
    );
    res.json(ApiResponse.success('Custom place created', place));
  } catch (error) {
    next(error);
  }
};

const updateCustomPlace = async (req, res, next) => {
  try {
    const place = await customPlacesService.updateCustomPlace(
      req.params.placeId,
      req.body,
      req.user.id,
      req.ip,
      req.headers['user-agent'],
    );
    res.json(ApiResponse.success('Custom place updated', place));
  } catch (error) {
    next(error);
  }
};

const deleteCustomPlace = async (req, res, next) => {
  try {
    await customPlacesService.deleteCustomPlace(
      req.params.placeId,
      req.user.id,
      req.ip,
      req.headers['user-agent'],
    );
    res.json(ApiResponse.success('Custom place deleted', null));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listCustomPlaces,
  createCustomPlace,
  updateCustomPlace,
  deleteCustomPlace,
};

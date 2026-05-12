const addressService = require('./address.service');
const { ApiResponse } = require('../../utils/api-response');

const list = async (req, res, next) => {
  try {
    const data = await addressService.list(req.user.id);
    res.json(ApiResponse.success('Addresses retrieved', data));
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const data = await addressService.create(req.user.id, req.body);
    res.status(201).json(ApiResponse.success('Address saved', data));
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const data = await addressService.update(req.user.id, req.params.id, req.body);
    res.json(ApiResponse.success('Address updated', data));
  } catch (err) { next(err); }
};

const setDefault = async (req, res, next) => {
  try {
    const data = await addressService.setDefault(req.user.id, req.params.id);
    res.json(ApiResponse.success('Default address updated', data));
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const data = await addressService.remove(req.user.id, req.params.id);
    res.json(ApiResponse.success('Address deleted', data));
  } catch (err) { next(err); }
};

module.exports = { list, create, update, setDefault, remove };

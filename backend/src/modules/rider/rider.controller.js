/**
 * Rider controller — HTTP handlers for rider operations.
 */

const riderService = require('./rider.service');
const { ApiResponse } = require('../../utils/api-response');

const register = async (req, res, next) => {
  try {
    const rider = await riderService.registerRider(req.user.id, req.body);
    res.status(201).json(ApiResponse.success('Rider registration submitted for approval', rider));
  } catch (error) {
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const profile = await riderService.getProfile(req.user.id);
    res.json(ApiResponse.success('Rider profile', profile));
  } catch (error) {
    next(error);
  }
};

const updateAvailability = async (req, res, next) => {
  try {
    const result = await riderService.updateAvailability(req.user.id, req.body.availability);
    res.json(ApiResponse.success('Availability updated', result));
  } catch (error) {
    next(error);
  }
};

const updateLocation = async (req, res, next) => {
  try {
    const result = await riderService.updateLocation(req.user.id, req.body);
    res.json(ApiResponse.success('Location updated', result));
  } catch (error) {
    next(error);
  }
};

const acceptJob = async (req, res, next) => {
  try {
    const order = await riderService.acceptJob(req.user.id, req.body.orderId);
    res.json(ApiResponse.success('Job accepted', order));
  } catch (error) {
    next(error);
  }
};

const getEarnings = async (req, res, next) => {
  try {
    const earnings = await riderService.getEarnings(req.user.id);
    res.json(ApiResponse.success('Earnings summary', earnings));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  getProfile,
  updateAvailability,
  updateLocation,
  acceptJob,
  getEarnings,
};

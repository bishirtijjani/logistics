/**
 * Admin controller — HTTP handlers for admin operations.
 */

const adminService = require('./admin.service');
const { ApiResponse } = require('../../utils/api-response');

const getPendingRiders = async (req, res, next) => {
  try {
    const { riders, total, page, limit } = await adminService.getPendingRiders(req.query);
    res.json(ApiResponse.paginated('Pending riders', riders, page, limit, total));
  } catch (error) {
    next(error);
  }
};

const reviewRider = async (req, res, next) => {
  try {
    const result = await adminService.reviewRider(req.params.riderId, req.body.decision);
    res.json(ApiResponse.success('Rider reviewed', result));
  } catch (error) {
    next(error);
  }
};

const updateUserStatus = async (req, res, next) => {
  try {
    const result = await adminService.updateUserStatus(req.params.userId, req.body.status);
    res.json(ApiResponse.success('User status updated', result));
  } catch (error) {
    next(error);
  }
};

const getTransactions = async (req, res, next) => {
  try {
    const { transactions, total, page, limit } = await adminService.getTransactionOverview(req.query);
    res.json(ApiResponse.paginated('Transactions', transactions, page, limit, total));
  } catch (error) {
    next(error);
  }
};

const getDashboard = async (req, res, next) => {
  try {
    const stats = await adminService.getDashboardStats();
    res.json(ApiResponse.success('Dashboard stats', stats));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPendingRiders,
  reviewRider,
  updateUserStatus,
  getTransactions,
  getDashboard,
};

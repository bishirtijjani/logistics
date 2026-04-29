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

const getAllUsers = async (req, res, next) => {
  try {
    const { users, total, page, limit } = await adminService.getAllUsers(req.query);
    res.json(ApiResponse.paginated('All users', users, page, limit, total));
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

// ============================================================
// Admin Request Management Controllers
// ============================================================

const getAllRequests = async (req, res, next) => {
  try {
    const { requests, total, page, limit } = await adminService.getAllRequests(req.query);
    res.json(ApiResponse.paginated('All requests', requests, page, limit, total));
  } catch (error) {
    next(error);
  }
};

const reassignRider = async (req, res, next) => {
  try {
    const result = await adminService.reassignRider(req.params.requestId, req.body.newRiderId);
    res.json(ApiResponse.success('Rider reassigned', result));
  } catch (error) {
    next(error);
  }
};

const forceCancelRequest = async (req, res, next) => {
  try {
    const result = await adminService.forceCancelRequest(req.params.requestId, req.body.reason);
    res.json(ApiResponse.success('Request cancelled', result));
  } catch (error) {
    next(error);
  }
};

const adminUpdateRequestStatus = async (req, res, next) => {
  try {
    const result = await adminService.adminUpdateRequestStatus(
      req.params.requestId,
      req.body.status,
      req.body.reason
    );
    res.json(ApiResponse.success('Request status updated', result));
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Admin Merchant Management Controllers
// ============================================================

const getAllMerchants = async (req, res, next) => {
  try {
    const { merchants, total, page, limit } = await adminService.getAllMerchants(req.query);
    res.json(ApiResponse.paginated('All merchants', merchants, page, limit, total));
  } catch (error) {
    next(error);
  }
};

const approveMerchant = async (req, res, next) => {
  try {
    const result = await adminService.approveMerchant(req.params.merchantId);
    res.json(ApiResponse.success('Merchant approved', result));
  } catch (error) {
    next(error);
  }
};

const rejectMerchant = async (req, res, next) => {
  try {
    const result = await adminService.rejectMerchant(req.params.merchantId, req.body.reason);
    res.json(ApiResponse.success('Merchant rejected', result));
  } catch (error) {
    next(error);
  }
};

const suspendMerchant = async (req, res, next) => {
  try {
    const result = await adminService.suspendMerchant(req.params.merchantId, req.body.reason);
    res.json(ApiResponse.success('Merchant suspended', result));
  } catch (error) {
    next(error);
  }
};

const unsuspendMerchant = async (req, res, next) => {
  try {
    const result = await adminService.unsuspendMerchant(req.params.merchantId);
    res.json(ApiResponse.success('Merchant unsuspended', result));
  } catch (error) {
    next(error);
  }
};

const updateMerchantCommission = async (req, res, next) => {
  try {
    const result = await adminService.updateMerchantCommission(
      req.params.merchantId,
      req.body.commissionRate
    );
    res.json(ApiResponse.success('Merchant commission updated', result));
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Admin Rider Management Controllers
// ============================================================

const getAllRiders = async (req, res, next) => {
  try {
    const { riders, total, page, limit } = await adminService.getAllRiders(req.query);
    res.json(ApiResponse.paginated('All riders', riders, page, limit, total));
  } catch (error) {
    next(error);
  }
};

const getRiderEarnings = async (req, res, next) => {
  try {
    const result = await adminService.getRiderEarnings(req.params.riderId, req.query);
    res.json(ApiResponse.success('Rider earnings', result));
  } catch (error) {
    next(error);
  }
};

const getRiderDeliveryHistory = async (req, res, next) => {
  try {
    const { deliveries, total, page, limit } = await adminService.getRiderDeliveryHistory(
      req.params.riderId,
      req.query
    );
    res.json(ApiResponse.paginated('Rider delivery history', deliveries, page, limit, total));
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Platform Settings Controllers
// ============================================================

const getPlatformSettings = async (req, res, next) => {
  try {
    const settings = await adminService.getPlatformSettings();
    res.json(ApiResponse.success('Platform settings', settings));
  } catch (error) {
    next(error);
  }
};

const updatePlatformSettings = async (req, res, next) => {
  try {
    const result = await adminService.updatePlatformSettings(req.body);
    res.json(ApiResponse.success('Platform settings updated', result));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPendingRiders,
  reviewRider,
  getAllUsers,
  updateUserStatus,
  getTransactions,
  getDashboard,
  getAllRequests,
  reassignRider,
  forceCancelRequest,
  adminUpdateRequestStatus,
  getAllMerchants,
  approveMerchant,
  rejectMerchant,
  suspendMerchant,
  unsuspendMerchant,
  updateMerchantCommission,
  getAllRiders,
  getRiderEarnings,
  getRiderDeliveryHistory,
  getPlatformSettings,
  updatePlatformSettings,
};

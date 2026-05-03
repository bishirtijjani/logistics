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

// ============================================================
// Audit Log Controllers
// ============================================================

const getAuditLogs = async (req, res, next) => {
  try {
    const { logs, total, page, limit } = await adminService.getAuditLogs(req.query);
    res.json(ApiResponse.paginated('Audit logs', logs, page, limit, total));
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Platform Analytics Controllers
// ============================================================

const getRevenueAnalytics = async (req, res, next) => {
  try {
    const analytics = await adminService.getRevenueAnalytics(req.query);
    res.json(ApiResponse.success('Revenue analytics', analytics));
  } catch (error) {
    next(error);
  }
};

const getOrderAnalytics = async (req, res, next) => {
  try {
    const analytics = await adminService.getOrderAnalytics(req.query);
    res.json(ApiResponse.success('Order analytics', analytics));
  } catch (error) {
    next(error);
  }
};

const getCustomerAnalytics = async (req, res, next) => {
  try {
    const analytics = await adminService.getCustomerAnalytics(req.query);
    res.json(ApiResponse.success('Customer analytics', analytics));
  } catch (error) {
    next(error);
  }
};

const getGeographicAnalytics = async (req, res, next) => {
  try {
    const analytics = await adminService.getGeographicAnalytics(req.query);
    res.json(ApiResponse.success('Geographic analytics', analytics));
  } catch (error) {
    next(error);
  }
};

const getRealtimeMetrics = async (req, res, next) => {
  try {
    const metrics = await adminService.getRealtimeMetrics();
    res.json(ApiResponse.success('Real-time metrics', metrics));
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Financial Operations - Withdrawal Management Controllers
// ============================================================

const getPendingWithdrawals = async (req, res, next) => {
  try {
    const { withdrawals, total, page, limit } = await adminService.getPendingWithdrawals(req.query);
    res.json(ApiResponse.paginated('Pending withdrawals', withdrawals, page, limit, total));
  } catch (error) {
    next(error);
  }
};

const approveWithdrawal = async (req, res, next) => {
  try {
    const result = await adminService.approveWithdrawal(req.params.withdrawalId);
    res.json(ApiResponse.success('Withdrawal approved', result));
  } catch (error) {
    next(error);
  }
};

const rejectWithdrawal = async (req, res, next) => {
  try {
    const result = await adminService.rejectWithdrawal(req.params.withdrawalId, req.body.reason);
    res.json(ApiResponse.success('Withdrawal rejected', result));
  } catch (error) {
    next(error);
  }
};

const getWithdrawalHistory = async (req, res, next) => {
  try {
    const { withdrawals, total, page, limit } = await adminService.getWithdrawalHistory(req.query);
    res.json(ApiResponse.paginated('Withdrawal history', withdrawals, page, limit, total));
  } catch (error) {
    next(error);
  }
};

const getDisputes = async (req, res, next) => {
  try {
    const { disputes, total, page, limit } = await adminService.getDisputes(req.query);
    res.json(ApiResponse.paginated('Disputes', disputes, page, limit, total));
  } catch (error) {
    next(error);
  }
};

const resolveDispute = async (req, res, next) => {
  try {
    const result = await adminService.resolveDispute(req.params.disputeId, req.body.resolution, req.body.notes);
    res.json(ApiResponse.success('Dispute resolved', result));
  } catch (error) {
    next(error);
  }
};

const getSupportTickets = async (req, res, next) => {
  try {
    const { tickets, total, page, limit } = await adminService.getSupportTickets(req.query);
    res.json(ApiResponse.paginated('Support tickets', tickets, page, limit, total));
  } catch (error) {
    next(error);
  }
};

const updateTicketStatus = async (req, res, next) => {
  try {
    const result = await adminService.updateTicketStatus(req.params.ticketId, req.body.status, req.body.notes);
    res.json(ApiResponse.success('Ticket status updated', result));
  } catch (error) {
    next(error);
  }
};

const getPlatformCampaigns = async (req, res, next) => {
  try {
    const { campaigns, total, page, limit } = await adminService.getPlatformCampaigns(req.query);
    res.json(ApiResponse.paginated('Platform campaigns', campaigns, page, limit, total));
  } catch (error) {
    next(error);
  }
};

const getDiscountCodes = async (req, res, next) => {
  try {
    const { discounts, total, page, limit } = await adminService.getDiscountCodes(req.query);
    res.json(ApiResponse.paginated('Discount codes', discounts, page, limit, total));
  } catch (error) {
    next(error);
  }
};

const approveDiscountCode = async (req, res, next) => {
  try {
    const result = await adminService.approveDiscountCode(req.params.discountId);
    res.json(ApiResponse.success('Discount code approved', result));
  } catch (error) {
    next(error);
  }
};

const rejectDiscountCode = async (req, res, next) => {
  try {
    const result = await adminService.rejectDiscountCode(req.params.discountId, req.body.reason);
    res.json(ApiResponse.success('Discount code rejected', result));
  } catch (error) {
    next(error);
  }
};

const getRiderPerformance = async (req, res, next) => {
  try {
    const { riders, total, page, limit } = await adminService.getRiderPerformance(req.query);
    res.json(ApiResponse.paginated('Rider performance', riders, page, limit, total));
  } catch (error) {
    next(error);
  }
};

const getRiderRealtimeLocation = async (req, res, next) => {
  try {
    const riders = await adminService.getRiderRealtimeLocation();
    res.json(ApiResponse.success('Rider locations', riders));
  } catch (error) {
    next(error);
  }
};

const getSafetyIncidents = async (req, res, next) => {
  try {
    const { incidents, total, page, limit } = await adminService.getSafetyIncidents(req.query);
    res.json(ApiResponse.paginated('Safety incidents', incidents, page, limit, total));
  } catch (error) {
    next(error);
  }
};

const getComplianceReport = async (req, res, next) => {
  try {
    const report = await adminService.getComplianceReport();
    res.json(ApiResponse.success('Compliance report', report));
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
  getAuditLogs,
  getRevenueAnalytics,
  getOrderAnalytics,
  getCustomerAnalytics,
  getGeographicAnalytics,
  getRealtimeMetrics,
  getPendingWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  getWithdrawalHistory,
  getDisputes,
  resolveDispute,
  getSupportTickets,
  updateTicketStatus,
  getPlatformCampaigns,
  getDiscountCodes,
  approveDiscountCode,
  rejectDiscountCode,
  getRiderPerformance,
  getRiderRealtimeLocation,
  getSafetyIncidents,
  getComplianceReport,
};

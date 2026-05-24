/**
 * Admin controller — HTTP handlers for admin operations.
 */

const adminService = require('./admin.service');
const supportController = require('../support/support.controller');
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

const getAllCustomers = async (req, res, next) => {
  try {
    const { customers, total, page, limit } = await adminService.getAllCustomers(req.query);
    res.json(ApiResponse.paginated('Customers', customers, page, limit, total));
  } catch (error) {
    next(error);
  }
};

const updateCustomerStatus = async (req, res, next) => {
  try {
    const result = await adminService.updateCustomerStatus(
      req.params.customerId,
      req.body.status,
      req.body.reason,
      req.user.id,
      req.ip,
      req.headers['user-agent'],
    );
    res.json(ApiResponse.success('Customer status updated', result));
  } catch (error) {
    next(error);
  }
};

const updateCustomer = async (req, res, next) => {
  try {
    const result = await adminService.updateCustomer(
      req.params.customerId,
      req.body,
      req.user.id,
      req.ip,
      req.headers['user-agent'],
    );
    res.json(ApiResponse.success('Customer updated', result));
  } catch (error) {
    next(error);
  }
};

const wipeCustomerKyc = async (req, res, next) => {
  try {
    const result = await adminService.wipeCustomerKyc(
      req.params.customerId,
      req.body.reason,
      req.user.id,
      req.ip,
      req.headers['user-agent'],
    );
    res.json(ApiResponse.success('Customer KYC wiped', result));
  } catch (error) {
    next(error);
  }
};

const getCustomerById = async (req, res, next) => {
  try {
    const customer = await adminService.getCustomerById(req.params.customerId);
    res.json(ApiResponse.success('Customer detail', customer));
  } catch (error) {
    next(error);
  }
};

const getCustomerRequests = async (req, res, next) => {
  try {
    const { requests, total, page, limit } = await adminService.getCustomerRequests({
      customerId: req.params.customerId,
      ...req.query,
    });
    res.json(ApiResponse.paginated('Customer requests', requests, page, limit, total));
  } catch (error) {
    next(error);
  }
};

const getCustomerTransactions = async (req, res, next) => {
  try {
    const { transactions, total, page, limit } = await adminService.getCustomerTransactions({
      customerId: req.params.customerId,
      ...req.query,
    });
    res.json(ApiResponse.paginated('Customer transactions', transactions, page, limit, total));
  } catch (error) {
    next(error);
  }
};

const getCustomerAddresses = async (req, res, next) => {
  try {
    const addresses = await adminService.getCustomerAddresses(req.params.customerId);
    res.json(ApiResponse.success('Customer addresses', addresses));
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

const getMerchantById = async (req, res, next) => {
  try {
    const merchant = await adminService.getMerchantById(req.params.merchantId);
    res.json(ApiResponse.success('Merchant detail', merchant));
  } catch (error) {
    next(error);
  }
};

const approveMerchant = async (req, res, next) => {
  try {
    const result = await adminService.approveMerchant(
      req.params.merchantId, req.user.id, req.ip, req.headers['user-agent']
    );
    res.json(ApiResponse.success('Merchant approved', result));
  } catch (error) {
    next(error);
  }
};

const rejectMerchant = async (req, res, next) => {
  try {
    const result = await adminService.rejectMerchant(
      req.params.merchantId, req.body.reason, req.user.id, req.ip, req.headers['user-agent']
    );
    res.json(ApiResponse.success('Merchant rejected', result));
  } catch (error) {
    next(error);
  }
};

const suspendMerchant = async (req, res, next) => {
  try {
    const result = await adminService.suspendMerchant(
      req.params.merchantId, req.body.reason, req.user.id, req.ip, req.headers['user-agent']
    );
    res.json(ApiResponse.success('Merchant suspended', result));
  } catch (error) {
    next(error);
  }
};

const unsuspendMerchant = async (req, res, next) => {
  try {
    const result = await adminService.unsuspendMerchant(
      req.params.merchantId, req.user.id, req.ip, req.headers['user-agent']
    );
    res.json(ApiResponse.success('Merchant unsuspended', result));
  } catch (error) {
    next(error);
  }
};

const updateMerchantCommission = async (req, res, next) => {
  try {
    const result = await adminService.updateMerchantCommission(
      req.params.merchantId,
      req.body.commissionRate,
      req.body.reason,
      req.user.id,
      req.ip,
      req.headers['user-agent']
    );
    res.json(ApiResponse.success('Merchant commission updated', result));
  } catch (error) {
    next(error);
  }
};

const updateMerchantProfile = async (req, res, next) => {
  try {
    const result = await adminService.updateMerchantProfile(
      req.params.merchantId, req.body, req.user.id, req.ip, req.headers['user-agent']
    );
    res.json(ApiResponse.success('Merchant profile updated', result));
  } catch (error) {
    next(error);
  }
};

const getMerchantCommissionHistory = async (req, res, next) => {
  try {
    const { history, total, page, limit } = await adminService.getMerchantCommissionHistory(
      req.params.merchantId, req.query
    );
    res.json(ApiResponse.paginated('Commission history', history, page, limit, total));
  } catch (error) {
    next(error);
  }
};

const setWithdrawalHold = async (req, res, next) => {
  try {
    const result = await adminService.setWithdrawalHold(
      req.params.merchantId,
      req.body.held,
      req.body.reason,
      req.user.id,
      req.ip,
      req.headers['user-agent']
    );
    res.json(ApiResponse.success('Withdrawal hold updated', result));
  } catch (error) {
    next(error);
  }
};

const bulkApproveWithdrawals = async (req, res, next) => {
  try {
    const result = await adminService.bulkApproveWithdrawals(
      req.body.withdrawalIds, req.user.id, req.ip, req.headers['user-agent']
    );
    res.json(ApiResponse.success('Bulk approval processed', result));
  } catch (error) {
    next(error);
  }
};

const getMerchantAnalytics = async (req, res, next) => {
  try {
    const result = await adminService.getMerchantAnalytics(req.params.merchantId, req.query);
    res.json(ApiResponse.success('Merchant analytics', result));
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Tag Management Controllers
// ============================================================

const getAllTags = async (req, res, next) => {
  try {
    const { tags, total, page, limit } = await adminService.getAllTags(req.query);
    res.json(ApiResponse.paginated('Tags', tags, page, limit, total));
  } catch (error) {
    next(error);
  }
};

const createTag = async (req, res, next) => {
  try {
    const tag = await adminService.createTag(req.body, req.user.id, req.ip, req.headers['user-agent']);
    res.status(201).json(ApiResponse.success('Tag created', tag));
  } catch (error) {
    next(error);
  }
};

const updateTag = async (req, res, next) => {
  try {
    const tag = await adminService.updateTag(req.params.tagId, req.body, req.user.id, req.ip, req.headers['user-agent']);
    res.json(ApiResponse.success('Tag updated', tag));
  } catch (error) {
    next(error);
  }
};

const deleteTag = async (req, res, next) => {
  try {
    await adminService.deleteTag(req.params.tagId, req.user.id, req.ip, req.headers['user-agent']);
    res.json(ApiResponse.success('Tag deleted'));
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Merchant Category Management
// ============================================================

const getAllCategories = async (req, res, next) => {
  try {
    const { categories, total, page, limit } = await adminService.getAllCategories({
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 50,
      isActive: req.query.isActive,
    });
    res.json(ApiResponse.paginated('Categories', categories, page, limit, total));
  } catch (error) {
    next(error);
  }
};

const createCategory = async (req, res, next) => {
  try {
    const category = await adminService.createCategory(
      req.body,
      req.user.id,
      req.ip,
      req.headers['user-agent'],
    );
    res.status(201).json(ApiResponse.success('Category created', category));
  } catch (error) {
    next(error);
  }
};

const updateCategory = async (req, res, next) => {
  try {
    const category = await adminService.updateCategory(
      req.params.categoryId,
      req.body,
      req.user.id,
      req.ip,
      req.headers['user-agent'],
    );
    res.json(ApiResponse.success('Category updated', category));
  } catch (error) {
    next(error);
  }
};

const updateCategoryAttributeSchema = async (req, res, next) => {
  try {
    const category = await adminService.updateCategoryAttributeSchema(
      req.params.categoryId,
      req.body.attributeSchema,
      req.user.id,
      req.ip,
      req.headers['user-agent'],
    );
    res.json(ApiResponse.success('Category attribute schema updated', category));
  } catch (error) {
    next(error);
  }
};

const deleteCategory = async (req, res, next) => {
  try {
    const result = await adminService.deleteCategory(
      req.params.categoryId,
      req.user.id,
      req.ip,
      req.headers['user-agent'],
    );
    res.json(
      ApiResponse.success(
        result.soft ? 'Category deactivated (still used by merchants)' : 'Category deleted',
        result,
      ),
    );
  } catch (error) {
    next(error);
  }
};

const setMerchantTags = async (req, res, next) => {
  try {
    const tags = await adminService.setMerchantTags(
      req.params.merchantId, req.body.tagIds, req.user.id, req.ip, req.headers['user-agent']
    );
    res.json(ApiResponse.success('Merchant tags updated', tags));
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Admin Rider Management Controllers
// ============================================================

// Phase 8 — Force a rider offline. Used by support to handle "rider went
// rogue" scenarios and by the Maestro `05-force-offline` flow.
const forceOfflineRider = async (req, res, next) => {
  try {
    const result = await adminService.forceOfflineRider(
      req.params.riderId,
      req.body?.reason,
      req.user.id,
      req.ip,
      req.get('user-agent'),
    );
    res.json(ApiResponse.success('Rider forced offline', result));
  } catch (error) {
    next(error);
  }
};

// Phase 8 — Staging-only helper used by the Maestro `08-offer-race-lost`
// flow. Service-layer guard refuses on production.
const seedTestOffer = async (req, res, next) => {
  try {
    const result = await adminService.seedTestOffer(req.body || {});
    res.json(ApiResponse.success('Test offer seeded', result));
  } catch (error) {
    next(error);
  }
};

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
    const result = await adminService.approveWithdrawal(
      req.params.withdrawalId, req.user.id, req.ip, req.headers['user-agent']
    );
    res.json(ApiResponse.success('Withdrawal approved', result));
  } catch (error) {
    next(error);
  }
};

const rejectWithdrawal = async (req, res, next) => {
  try {
    const result = await adminService.rejectWithdrawal(
      req.params.withdrawalId, req.body.reason, req.user.id, req.ip, req.headers['user-agent']
    );
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

// ============================================================
// Support tickets + disputes — delegated to the support module.
// The admin namespace keeps these paths so existing admin-dashboard URLs work.
// ============================================================

const getDisputes = (req, res, next) => {
  req.params.id = req.params.disputeId; // path-compat shim
  return supportController.adminListDisputes(req, res, next);
};

const resolveDispute = (req, res, next) => {
  req.params.id = req.params.disputeId;
  return supportController.adminResolveDispute(req, res, next);
};

const getDisputeDetail = (req, res, next) => {
  req.params.id = req.params.disputeId;
  return supportController.getDisputeById(req, res, next);
};

const postDisputeMessageAdmin = (req, res, next) => {
  req.params.id = req.params.disputeId;
  return supportController.postDisputeMessage(req, res, next);
};

const getSupportTickets = (req, res, next) => supportController.adminListTickets(req, res, next);

const updateTicketStatus = (req, res, next) => {
  req.params.id = req.params.ticketId;
  return supportController.adminUpdateTicketStatus(req, res, next);
};

const getTicketDetail = (req, res, next) => {
  req.params.id = req.params.ticketId;
  return supportController.getTicketById(req, res, next);
};

const postTicketMessageAdmin = (req, res, next) => {
  req.params.id = req.params.ticketId;
  return supportController.postTicketMessage(req, res, next);
};

const assignTicket = (req, res, next) => {
  req.params.id = req.params.ticketId;
  return supportController.adminAssignTicket(req, res, next);
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
  getAllCustomers,
  updateCustomerStatus,
  updateCustomer,
  wipeCustomerKyc,
  getCustomerById,
  getCustomerRequests,
  getCustomerTransactions,
  getCustomerAddresses,
  getTransactions,
  getDashboard,
  getAllRequests,
  reassignRider,
  forceCancelRequest,
  adminUpdateRequestStatus,
  getAllMerchants,
  getMerchantById,
  approveMerchant,
  rejectMerchant,
  suspendMerchant,
  unsuspendMerchant,
  updateMerchantCommission,
  updateMerchantProfile,
  getMerchantCommissionHistory,
  setWithdrawalHold,
  bulkApproveWithdrawals,
  getMerchantAnalytics,
  getAllTags,
  createTag,
  updateTag,
  deleteTag,
  getAllCategories,
  createCategory,
  updateCategory,
  updateCategoryAttributeSchema,
  deleteCategory,
  setMerchantTags,
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
  getDisputeDetail,
  postDisputeMessageAdmin,
  getSupportTickets,
  updateTicketStatus,
  getTicketDetail,
  postTicketMessageAdmin,
  assignTicket,
  getPlatformCampaigns,
  getDiscountCodes,
  approveDiscountCode,
  rejectDiscountCode,
  getRiderPerformance,
  getRiderRealtimeLocation,
  getSafetyIncidents,
  getComplianceReport,
  getVtuPlans,
  createVtuPlan,
  updateVtuPlan,
  deleteVtuPlan,
  bulkCreateVtuPlans,
  getVtuNetworks,
  createVtuNetwork,
  updateVtuNetwork,
  deleteVtuNetwork,
  // Phase 8 — Maestro support
  forceOfflineRider,
  seedTestOffer,
};

// ─── VTU Plan Controllers ─────────────────────────────────────────────────────

async function getVtuPlans(req, res, next) {
  try {
    const result = await adminService.listVtuPlans(req.query);
    res.json(ApiResponse.paginated('VTU plans', result.plans, result.page, result.limit, result.total));
  } catch (error) { next(error); }
}

async function createVtuPlan(req, res, next) {
  try {
    const plan = await adminService.createVtuPlan(req.body);
    res.status(201).json(ApiResponse.success('VTU plan created', plan));
  } catch (error) { next(error); }
}

async function updateVtuPlan(req, res, next) {
  try {
    const plan = await adminService.updateVtuPlan(req.params.planId, req.body);
    res.json(ApiResponse.success('VTU plan updated', plan));
  } catch (error) { next(error); }
}

async function deleteVtuPlan(req, res, next) {
  try {
    await adminService.deleteVtuPlan(req.params.planId);
    res.json(ApiResponse.success('VTU plan deleted'));
  } catch (error) { next(error); }
}

async function bulkCreateVtuPlans(req, res, next) {
  try {
    const result = await adminService.bulkCreateVtuPlans(req.body.plans);
    res.status(201).json(ApiResponse.success('VTU plans imported', result));
  } catch (error) { next(error); }
}

// ─── VTU Network Controllers ──────────────────────────────────────────────────

async function getVtuNetworks(req, res, next) {
  try {
    const networks = await adminService.listVtuNetworks(req.query);
    res.json(ApiResponse.success('Networks fetched', networks));
  } catch (error) { next(error); }
}

async function createVtuNetwork(req, res, next) {
  try {
    const network = await adminService.createVtuNetwork(req.body);
    res.status(201).json(ApiResponse.success('Network created', network));
  } catch (error) { next(error); }
}

async function updateVtuNetwork(req, res, next) {
  try {
    const network = await adminService.updateVtuNetwork(req.params.networkId, req.body);
    res.json(ApiResponse.success('Network updated', network));
  } catch (error) { next(error); }
}

async function deleteVtuNetwork(req, res, next) {
  try {
    await adminService.deleteVtuNetwork(req.params.networkId);
    res.json(ApiResponse.success('Network deleted'));
  } catch (error) { next(error); }
}

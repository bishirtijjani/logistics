/**
 * Admin controller - HTTP handlers for admin operations.
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
    const result = await adminService.reviewRider(
      req.params.riderId, req.body.decision, req.user.id, req.ip, req.headers['user-agent'], req.body.reason
    );
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

const updateRiderAccount = async (req, res, next) => {
  try {
    const result = await adminService.updateRiderAccount(
      req.params.riderId,
      req.body,
      req.user.id,
      req.ip,
      req.headers['user-agent'],
    );
    res.json(ApiResponse.success('Rider account updated', result));
  } catch (error) {
    next(error);
  }
};

const updateMerchantAccount = async (req, res, next) => {
  try {
    const result = await adminService.updateMerchantAccount(
      req.params.merchantId,
      req.body,
      req.user.id,
      req.ip,
      req.headers['user-agent'],
    );
    res.json(ApiResponse.success('Merchant account updated', result));
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

const getCustomerStats = async (req, res, next) => {
  try {
    const stats = await adminService.getCustomerStats();
    res.json(ApiResponse.success('Customer stats', stats));
  } catch (error) {
    next(error);
  }
};

// TEMPORARY testing aid - reveal a customer's PIN (audit-logged).
// Clear a customer's transaction PIN so they set a fresh one in-app. The admin
// never sees or chooses the PIN. Audit-logged.
const resetCustomerPin = async (req, res, next) => {
  try {
    const result = await adminService.resetCustomerPin(
      req.params.customerId,
      req.body.reason,
      req.user.id,
      req.ip,
      req.headers['user-agent'],
    );
    res.json(ApiResponse.success('Customer PIN reset', result));
  } catch (error) {
    next(error);
  }
};

const resetRiderPin = async (req, res, next) => {
  try {
    const result = await adminService.resetRiderPin(
      req.params.riderId,
      req.body.reason,
      req.user.id,
      req.ip,
      req.headers['user-agent'],
    );
    res.json(ApiResponse.success('Rider PIN reset', result));
  } catch (error) {
    next(error);
  }
};

const resetMerchantPin = async (req, res, next) => {
  try {
    const result = await adminService.resetMerchantPin(
      req.params.merchantId,
      req.body.reason,
      req.user.id,
      req.ip,
      req.headers['user-agent'],
    );
    res.json(ApiResponse.success('Merchant PIN reset', result));
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

const getCustomerTransactionById = async (req, res, next) => {
  try {
    const tx = await adminService.getCustomerTransactionById(req.params.customerId, req.params.transactionId);
    res.json(ApiResponse.success('Transaction', tx));
  } catch (error) {
    next(error);
  }
};

const refundTransaction = async (req, res, next) => {
  try {
    const result = await adminService.adminRefundTransaction(
      req.user.id,
      req.params.transactionId,
      req.body.reason,
      req.ip,
      req.headers['user-agent'],
    );
    res.json(ApiResponse.success(result.message || 'Refund processed', result));
  } catch (error) {
    next(error);
  }
};

const getCustomerUtilityPayments = async (req, res, next) => {
  try {
    const { payments, total, page, limit } = await adminService.getCustomerUtilityPayments(
      req.params.customerId,
      req.query,
    );
    res.json(ApiResponse.paginated('Customer utility payments', payments, page, limit, total));
  } catch (error) {
    next(error);
  }
};

const getCustomerUtilityPaymentById = async (req, res, next) => {
  try {
    const payment = await adminService.getCustomerUtilityPaymentById(
      req.params.customerId,
      req.params.paymentId,
    );
    res.json(ApiResponse.success('Utility payment', payment));
  } catch (error) {
    next(error);
  }
};

const getRiderById = async (req, res, next) => {
  try {
    const rider = await adminService.getRiderById(req.params.riderId);
    res.json(ApiResponse.success('Rider', rider));
  } catch (error) {
    next(error);
  }
};

const getRiderTransactions = async (req, res, next) => {
  try {
    const { transactions, total, page, limit } = await adminService.getRiderTransactions(
      req.params.riderId,
      req.query,
    );
    res.json(ApiResponse.paginated('Rider transactions', transactions, page, limit, total));
  } catch (error) {
    next(error);
  }
};

const getRiderTransactionById = async (req, res, next) => {
  try {
    const tx = await adminService.getRiderTransactionById(req.params.riderId, req.params.transactionId);
    res.json(ApiResponse.success('Transaction', tx));
  } catch (error) {
    next(error);
  }
};

const getRiderUtilityPayments = async (req, res, next) => {
  try {
    const { payments, total, page, limit } = await adminService.getRiderUtilityPayments(
      req.params.riderId,
      req.query,
    );
    res.json(ApiResponse.paginated('Rider utility payments', payments, page, limit, total));
  } catch (error) {
    next(error);
  }
};

const getRiderUtilityPaymentById = async (req, res, next) => {
  try {
    const payment = await adminService.getRiderUtilityPaymentById(
      req.params.riderId,
      req.params.paymentId,
    );
    res.json(ApiResponse.success('Utility payment', payment));
  } catch (error) {
    next(error);
  }
};

const getMerchantTransactions = async (req, res, next) => {
  try {
    const { transactions, total, page, limit } = await adminService.getMerchantTransactions(
      req.params.merchantId,
      req.query,
    );
    res.json(ApiResponse.paginated('Merchant transactions', transactions, page, limit, total));
  } catch (error) {
    next(error);
  }
};

const getMerchantTransactionById = async (req, res, next) => {
  try {
    const tx = await adminService.getMerchantTransactionById(
      req.params.merchantId,
      req.params.transactionId,
    );
    res.json(ApiResponse.success('Transaction', tx));
  } catch (error) {
    next(error);
  }
};

const getMerchantUtilityPayments = async (req, res, next) => {
  try {
    const { payments, total, page, limit } = await adminService.getMerchantUtilityPayments(
      req.params.merchantId,
      req.query,
    );
    res.json(ApiResponse.paginated('Merchant utility payments', payments, page, limit, total));
  } catch (error) {
    next(error);
  }
};

const getMerchantUtilityPaymentById = async (req, res, next) => {
  try {
    const payment = await adminService.getMerchantUtilityPaymentById(
      req.params.merchantId,
      req.params.paymentId,
    );
    res.json(ApiResponse.success('Utility payment', payment));
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

const getRequestById = async (req, res, next) => {
  try {
    const request = await adminService.getRequestById(req.params.requestId);
    res.json(ApiResponse.success('Request detail', request));
  } catch (error) {
    next(error);
  }
};

const getRequestStats = async (req, res, next) => {
  try {
    const stats = await adminService.getRequestStats();
    res.json(ApiResponse.success('Request stats', stats));
  } catch (error) {
    next(error);
  }
};

const exportRequests = async (req, res, next) => {
  try {
    const requests = await adminService.exportRequests(req.query);

    const headers = [
      'id', 'type', 'status', 'paymentMethod', 'subtotal', 'deliveryFee', 'platformFee',
      'discountAmount', 'total', 'customerName', 'customerPhone', 'customerEmail',
      'merchantName', 'riderName', 'pickupAddress', 'dropoffAddress',
      'cancelledBy', 'cancellationReason', 'createdAt', 'deliveredAt',
    ];
    const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = requests.map((r) => [
      r.id, r.type, r.status, r.paymentMethod, r.subtotal, r.deliveryFee, r.platformFee,
      r.discountAmount, r.total,
      `${r.customer?.firstName || ''} ${r.customer?.lastName || ''}`.trim(),
      r.customer?.phone, r.customer?.email,
      r.merchant?.name,
      `${r.rider?.user?.firstName || ''} ${r.rider?.user?.lastName || ''}`.trim(),
      r.pickupAddress, r.dropoffAddress,
      r.cancelledBy, r.cancellationReason,
      r.createdAt?.toISOString(), r.deliveredAt?.toISOString(),
    ].map(escape).join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="requests-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
};

const reassignRider = async (req, res, next) => {
  try {
    const result = await adminService.reassignRider(
      req.params.requestId, req.body.newRiderId, req.user.id, req.ip, req.headers['user-agent']
    );
    res.json(ApiResponse.success('Rider reassigned', result));
  } catch (error) {
    next(error);
  }
};

const forceCancelRequest = async (req, res, next) => {
  try {
    const result = await adminService.forceCancelRequest(
      req.params.requestId, req.body.reason, req.user.id, req.ip, req.headers['user-agent']
    );
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
      req.body.reason,
      req.user.id,
      req.ip,
      req.headers['user-agent']
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

const setMerchantBankAccount = async (req, res, next) => {
  try {
    const result = await adminService.setMerchantBankAccount(
      req.params.merchantId,
      {
        bankCode: req.body.bankCode,
        accountNumber: req.body.accountNumber,
        accountName: req.body.accountName,
      },
      req.user.id,
      req.ip,
      req.headers['user-agent']
    );
    res.json(ApiResponse.success('Bank account updated', result));
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

// Phase 8 - Force a rider offline. Used by support to handle "rider went
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

// Phase 8 - Staging-only helper used by the Maestro `08-offer-race-lost`
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

const getRiderStats = async (req, res, next) => {
  try {
    const result = await adminService.getRiderStats();
    res.json(ApiResponse.success('Rider stats', result));
  } catch (error) {
    next(error);
  }
};

const suspendRider = async (req, res, next) => {
  try {
    const result = await adminService.suspendRider(
      req.params.riderId, req.body.reason, req.user.id, req.ip, req.headers['user-agent']
    );
    res.json(ApiResponse.success('Rider suspended', result));
  } catch (error) {
    next(error);
  }
};

const unsuspendRider = async (req, res, next) => {
  try {
    const result = await adminService.unsuspendRider(
      req.params.riderId, req.user.id, req.ip, req.headers['user-agent']
    );
    res.json(ApiResponse.success('Rider unsuspended', result));
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
    const result = await adminService.updatePlatformSettings(req.body, req.user?.id || 'ADMIN');
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

const failWithdrawal = async (req, res, next) => {
  try {
    const reason = (req.body.reason || '').trim();
    if (reason.length < 3) {
      return res.status(400).json(ApiResponse.error('A reason is required'));
    }
    const result = await adminService.failWithdrawal(
      req.params.withdrawalId, reason,
      { adminUserId: req.user.id, ipAddress: req.ip, userAgent: req.headers['user-agent'] }
    );
    const message = result?.refunded
      ? 'Withdrawal marked failed and funds returned'
      : 'Withdrawal marked failed - funds were NOT auto-returned; needs reconciliation';
    res.json(ApiResponse.success(message, result));
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
// Support tickets + disputes - delegated to the support module.
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
    const result = await adminService.approveDiscountCode(
      req.params.discountId, req.user.id, req.ip, req.headers['user-agent']
    );
    res.json(ApiResponse.success('Discount code approved', result));
  } catch (error) {
    next(error);
  }
};

const rejectDiscountCode = async (req, res, next) => {
  try {
    const result = await adminService.rejectDiscountCode(
      req.params.discountId, req.body.reason, req.user.id, req.ip, req.headers['user-agent']
    );
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
  updateRiderAccount,
  updateMerchantAccount,
  wipeCustomerKyc,
  getCustomerById,
  getCustomerStats,
  resetCustomerPin,
  resetRiderPin,
  resetMerchantPin,
  getCustomerRequests,
  getCustomerTransactions,
  getCustomerTransactionById,
  refundTransaction,
  getCustomerAddresses,
  getCustomerUtilityPayments,
  getCustomerUtilityPaymentById,
  getTransactions,
  getDashboard,
  getAllRequests,
  getRequestById,
  getRequestStats,
  exportRequests,
  reassignRider,
  forceCancelRequest,
  adminUpdateRequestStatus,
  getAllMerchants,
  getMerchantById,
  getMerchantTransactions,
  getMerchantTransactionById,
  getMerchantUtilityPayments,
  getMerchantUtilityPaymentById,
  approveMerchant,
  rejectMerchant,
  suspendMerchant,
  unsuspendMerchant,
  updateMerchantCommission,
  updateMerchantProfile,
  getMerchantCommissionHistory,
  setWithdrawalHold,
  setMerchantBankAccount,
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
  getRiderById,
  getRiderStats,
  suspendRider,
  unsuspendRider,
  getRiderEarnings,
  getRiderDeliveryHistory,
  getRiderTransactions,
  getRiderTransactionById,
  getRiderUtilityPayments,
  getRiderUtilityPaymentById,
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
  failWithdrawal,
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
  getBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  getVtuPlans,
  createVtuPlan,
  updateVtuPlan,
  deleteVtuPlan,
  bulkCreateVtuPlans,
  getVtuNetworks,
  createVtuNetwork,
  updateVtuNetwork,
  deleteVtuNetwork,
  getVtuProviderBalance,
  // Phase 8 - Maestro support
  forceOfflineRider,
  seedTestOffer,
  // Staff management
  listStaff,
  createStaff,
  updateStaffPermissions,
  updateStaffProfile,
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

// ─── VTU Provider Balance ─────────────────────────────────────────────────────

async function getVtuProviderBalance(req, res, next) {
  try {
    const result = await adminService.getVtuProviderBalance();
    res.json(ApiResponse.success('VTU provider balance', result));
  } catch (error) { next(error); }
}

async function listStaff(req, res, next) {
  try {
    const staff = await adminService.listStaff();
    res.json(ApiResponse.success('Staff members', staff));
  } catch (error) {
    next(error);
  }
}

async function createStaff(req, res, next) {
  try {
    const staff = await adminService.createStaff(
      req.body, req.user, req.ip, req.headers['user-agent']
    );
    res.status(201).json(ApiResponse.success('Staff member created', staff));
  } catch (error) {
    next(error);
  }
}

async function updateStaffPermissions(req, res, next) {
  try {
    const result = await adminService.updateStaffPermissions(
      req.params.staffId, req.body.permissions, req.user, req.ip, req.headers['user-agent']
    );
    res.json(ApiResponse.success('Staff permissions updated', result));
  } catch (error) {
    next(error);
  }
}

async function updateStaffProfile(req, res, next) {
  try {
    const result = await adminService.updateStaffProfile(
      req.params.staffId, req.body, req.user, req.ip, req.headers['user-agent']
    );
    res.json(ApiResponse.success('Staff profile updated', result));
  } catch (error) {
    next(error);
  }
}

async function getBanners(req, res, next) {
  try {
    const banners = await adminService.getBanners();
    res.json(ApiResponse.success('Banners retrieved', banners));
  } catch (error) { next(error); }
}

async function createBanner(req, res, next) {
  try {
    const banner = await adminService.createBanner(req.body, req.user.id);
    res.status(201).json(ApiResponse.success('Banner created', banner));
  } catch (error) { next(error); }
}

async function updateBanner(req, res, next) {
  try {
    const banner = await adminService.updateBanner(req.params.bannerId, req.body, req.user.id);
    res.json(ApiResponse.success('Banner updated', banner));
  } catch (error) { next(error); }
}

async function deleteBanner(req, res, next) {
  try {
    await adminService.deleteBanner(req.params.bannerId, req.user.id);
    res.json(ApiResponse.success('Banner deleted'));
  } catch (error) { next(error); }
}

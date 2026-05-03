/**
 * Admin routes — /api/admin
 * All routes require ADMIN role.
 */

const { Router } = require('express');
const adminController = require('./admin.controller');
const { validate } = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/role.middleware');
const {
  reviewRiderSchema,
  updateUserStatusSchema,
  listPendingRidersSchema,
  transactionOverviewSchema,
  listAllRequestsSchema,
  reassignRiderSchema,
  forceCancelRequestSchema,
  adminUpdateRequestStatusSchema,
  listAllMerchantsSchema,
  approveMerchantSchema,
  rejectMerchantSchema,
  suspendMerchantSchema,
  unsuspendMerchantSchema,
  updateMerchantCommissionSchema,
  listAllRidersSchema,
  getRiderEarningsSchema,
  updatePlatformSettingsSchema,
} = require('./admin.validator');

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

// Dashboard
router.get('/dashboard', adminController.getDashboard);

// Request management
router.get('/requests', validate(listAllRequestsSchema, 'query'), adminController.getAllRequests);
router.patch('/requests/:requestId/reassign', validate(reassignRiderSchema), adminController.reassignRider);
router.patch('/requests/:requestId/cancel', validate(forceCancelRequestSchema), adminController.forceCancelRequest);
router.patch('/requests/:requestId/status', validate(adminUpdateRequestStatusSchema), adminController.adminUpdateRequestStatus);

// Merchant management
router.get('/merchants', validate(listAllMerchantsSchema, 'query'), adminController.getAllMerchants);
router.patch('/merchants/:merchantId/approve', validate(approveMerchantSchema), adminController.approveMerchant);
router.patch('/merchants/:merchantId/reject', validate(rejectMerchantSchema), adminController.rejectMerchant);
router.patch('/merchants/:merchantId/suspend', validate(suspendMerchantSchema), adminController.suspendMerchant);
router.patch('/merchants/:merchantId/unsuspend', validate(unsuspendMerchantSchema), adminController.unsuspendMerchant);
router.patch('/merchants/:merchantId/commission', validate(updateMerchantCommissionSchema), adminController.updateMerchantCommission);

// Rider management
router.get('/riders/pending', validate(listPendingRidersSchema, 'query'), adminController.getPendingRiders);
router.get('/riders', validate(listAllRidersSchema, 'query'), adminController.getAllRiders);
router.patch('/riders/:riderId/review', validate(reviewRiderSchema), adminController.reviewRider);
router.get('/riders/:riderId/earnings', validate(getRiderEarningsSchema, 'query'), adminController.getRiderEarnings);
router.get('/riders/:riderId/deliveries', adminController.getRiderDeliveryHistory);

// User management
router.get('/users', adminController.getAllUsers);
router.patch('/users/:userId/status', validate(updateUserStatusSchema), adminController.updateUserStatus);

// Transaction oversight
router.get('/transactions', validate(transactionOverviewSchema, 'query'), adminController.getTransactions);

// Platform settings
router.get('/settings', adminController.getPlatformSettings);
router.patch('/settings', validate(updatePlatformSettingsSchema), adminController.updatePlatformSettings);

// Audit logs
router.get('/audit-logs', adminController.getAuditLogs);

// Platform analytics
router.get('/analytics/revenue', adminController.getRevenueAnalytics);
router.get('/analytics/orders', adminController.getOrderAnalytics);
router.get('/analytics/customers', adminController.getCustomerAnalytics);
router.get('/analytics/geographic', adminController.getGeographicAnalytics);
router.get('/analytics/realtime', adminController.getRealtimeMetrics);

// Withdrawal management
router.get('/withdrawals/pending', adminController.getPendingWithdrawals);
router.patch('/withdrawals/:withdrawalId/approve', adminController.approveWithdrawal);
router.patch('/withdrawals/:withdrawalId/reject', adminController.rejectWithdrawal);
router.get('/withdrawals/history', adminController.getWithdrawalHistory);

// Dispute resolution
router.get('/disputes', adminController.getDisputes);
router.patch('/disputes/:disputeId/resolve', adminController.resolveDispute);

// Support management
router.get('/support/tickets', adminController.getSupportTickets);
router.patch('/support/tickets/:ticketId/status', adminController.updateTicketStatus);

// Marketing oversight
router.get('/marketing/campaigns', adminController.getPlatformCampaigns);
router.get('/marketing/discounts', adminController.getDiscountCodes);
router.patch('/marketing/discounts/:discountId/approve', adminController.approveDiscountCode);
router.patch('/marketing/discounts/:discountId/reject', adminController.rejectDiscountCode);

// Rider operations
router.get('/riders/performance', adminController.getRiderPerformance);
router.get('/riders/realtime', adminController.getRiderRealtimeLocation);

// Safety & compliance
router.get('/safety/incidents', adminController.getSafetyIncidents);
router.get('/safety/compliance', adminController.getComplianceReport);

module.exports = router;

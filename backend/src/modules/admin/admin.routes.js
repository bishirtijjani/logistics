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
  updateCustomerStatusSchema,
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
  updateMerchantProfileSchema,
  setWithdrawalHoldSchema,
  bulkApproveWithdrawalsSchema,
  createTagSchema,
  createCategorySchema,
  updateCategorySchema,
  updateAttributeSchemaSchema,
  listCategoriesSchema,
  updateTagSchema,
  setMerchantTagsSchema,
  listAllRidersSchema,
  getRiderEarningsSchema,
  updatePlatformSettingsSchema,
  customerRequestsSchema,
  customerTransactionsSchema,
  listAllCustomersSchema,
  paginationSchema,
  paginationStatusSchema,
  paginationDateRangeSchema,
  paginationStatusDateRangeSchema,
  getAllTagsSchema,
  getAuditLogsSchema,
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
router.get('/merchants/:merchantId', adminController.getMerchantById);
router.put('/merchants/:merchantId', validate(updateMerchantProfileSchema), adminController.updateMerchantProfile);
router.patch('/merchants/:merchantId/approve', validate(approveMerchantSchema), adminController.approveMerchant);
router.patch('/merchants/:merchantId/reject', validate(rejectMerchantSchema), adminController.rejectMerchant);
router.patch('/merchants/:merchantId/suspend', validate(suspendMerchantSchema), adminController.suspendMerchant);
router.patch('/merchants/:merchantId/unsuspend', validate(unsuspendMerchantSchema), adminController.unsuspendMerchant);
router.patch('/merchants/:merchantId/commission', validate(updateMerchantCommissionSchema), adminController.updateMerchantCommission);
router.get('/merchants/:merchantId/commission-history', validate(paginationSchema, 'query'), adminController.getMerchantCommissionHistory);
router.patch('/merchants/:merchantId/withdrawal-hold', validate(setWithdrawalHoldSchema), adminController.setWithdrawalHold);
router.get('/merchants/:merchantId/analytics', adminController.getMerchantAnalytics);
router.post('/merchants/:merchantId/tags', validate(setMerchantTagsSchema), adminController.setMerchantTags);

// Withdrawal bulk operations
router.post('/withdrawals/bulk-approve', validate(bulkApproveWithdrawalsSchema), adminController.bulkApproveWithdrawals);

// Tag management
router.get('/tags', validate(getAllTagsSchema, 'query'), adminController.getAllTags);
router.post('/tags', validate(createTagSchema), adminController.createTag);
router.put('/tags/:tagId', validate(updateTagSchema), adminController.updateTag);
router.delete('/tags/:tagId', adminController.deleteTag);

// Merchant category management
router.get('/categories', validate(listCategoriesSchema, 'query'), adminController.getAllCategories);
router.post('/categories', validate(createCategorySchema), adminController.createCategory);
router.put('/categories/:categoryId', validate(updateCategorySchema), adminController.updateCategory);
router.patch('/categories/:categoryId/attribute-schema', validate(updateAttributeSchemaSchema), adminController.updateCategoryAttributeSchema);
router.delete('/categories/:categoryId', adminController.deleteCategory);

// Rider management
router.get('/riders/pending', validate(listPendingRidersSchema, 'query'), adminController.getPendingRiders);
router.get('/riders', validate(listAllRidersSchema, 'query'), adminController.getAllRiders);
router.patch('/riders/:riderId/review', validate(reviewRiderSchema), adminController.reviewRider);
router.get('/riders/:riderId/earnings', validate(getRiderEarningsSchema, 'query'), adminController.getRiderEarnings);
router.get('/riders/:riderId/deliveries', validate(paginationSchema, 'query'), adminController.getRiderDeliveryHistory);

// Customer management
router.get('/customers', validate(listAllCustomersSchema, 'query'), adminController.getAllCustomers);
router.get('/customers/:customerId', adminController.getCustomerById);
router.get('/customers/:customerId/requests', validate(customerRequestsSchema, 'query'), adminController.getCustomerRequests);
router.get('/customers/:customerId/transactions', validate(customerTransactionsSchema, 'query'), adminController.getCustomerTransactions);
router.get('/customers/:customerId/addresses', adminController.getCustomerAddresses);
router.patch('/customers/:customerId/status', validate(updateCustomerStatusSchema), adminController.updateCustomerStatus);

// Transaction oversight
router.get('/transactions', validate(transactionOverviewSchema, 'query'), adminController.getTransactions);

// Platform settings
router.get('/settings', adminController.getPlatformSettings);
router.patch('/settings', validate(updatePlatformSettingsSchema), adminController.updatePlatformSettings);

// Audit logs
router.get('/audit-logs', validate(getAuditLogsSchema, 'query'), adminController.getAuditLogs);

// Platform analytics
router.get('/analytics/revenue', adminController.getRevenueAnalytics);
router.get('/analytics/orders', adminController.getOrderAnalytics);
router.get('/analytics/customers', adminController.getCustomerAnalytics);
router.get('/analytics/geographic', adminController.getGeographicAnalytics);
router.get('/analytics/realtime', adminController.getRealtimeMetrics);

// Withdrawal management
router.get('/withdrawals/pending', validate(paginationSchema, 'query'), adminController.getPendingWithdrawals);
router.patch('/withdrawals/:withdrawalId/approve', adminController.approveWithdrawal);
router.patch('/withdrawals/:withdrawalId/reject', adminController.rejectWithdrawal);
router.get('/withdrawals/history', validate(paginationStatusDateRangeSchema, 'query'), adminController.getWithdrawalHistory);

// Dispute resolution
router.get('/disputes', validate(paginationStatusSchema, 'query'), adminController.getDisputes);
router.patch('/disputes/:disputeId/resolve', adminController.resolveDispute);

// Support management
router.get('/support/tickets', validate(paginationStatusSchema, 'query'), adminController.getSupportTickets);
router.patch('/support/tickets/:ticketId/status', adminController.updateTicketStatus);

// Marketing oversight
router.get('/marketing/campaigns', validate(paginationSchema, 'query'), adminController.getPlatformCampaigns);
router.get('/marketing/discounts', validate(paginationStatusSchema, 'query'), adminController.getDiscountCodes);
router.patch('/marketing/discounts/:discountId/approve', adminController.approveDiscountCode);
router.patch('/marketing/discounts/:discountId/reject', adminController.rejectDiscountCode);

// Rider operations
router.get('/riders/performance', validate(paginationDateRangeSchema, 'query'), adminController.getRiderPerformance);
router.get('/riders/realtime', adminController.getRiderRealtimeLocation);

// Safety & compliance
router.get('/safety/incidents', validate(paginationStatusSchema, 'query'), adminController.getSafetyIncidents);
router.get('/safety/compliance', adminController.getComplianceReport);

// VTU plan management
router.get('/vtu-plans', adminController.getVtuPlans);
router.post('/vtu-plans', adminController.createVtuPlan);
router.post('/vtu-plans/bulk', adminController.bulkCreateVtuPlans);
router.put('/vtu-plans/:planId', adminController.updateVtuPlan);
router.delete('/vtu-plans/:planId', adminController.deleteVtuPlan);

module.exports = router;

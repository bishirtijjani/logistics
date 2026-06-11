/**
 * Admin routes - /admin
 * All routes require ADMIN role.
 */

const { Router } = require('express');
const adminController = require('./admin.controller');
const { validate } = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/role.middleware');
const {
  ticketMessageSchema: supportTicketMessageSchema,
  updateTicketStatusSchema: supportUpdateTicketStatusSchema,
  assignTicketSchema: supportAssignTicketSchema,
  ticketListQuerySchema: supportTicketListQuerySchema,
  disputeMessageSchema: supportDisputeMessageSchema,
  resolveDisputeSchema: supportResolveDisputeSchema,
  disputeListQuerySchema: supportDisputeListQuerySchema,
} = require('../support/support.validator');
const waitlistController = require('../waitlist/waitlist.controller');
const { listWaitlistQuerySchema } = require('../waitlist/waitlist.validator');
const {
  reviewRiderSchema,
  updateCustomerStatusSchema,
  updateCustomerSchema,
  wipeCustomerKycSchema,
  resetCustomerPinSchema,
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
  setMerchantBankAccountSchema,
  bulkApproveWithdrawalsSchema,
  createTagSchema,
  createCategorySchema,
  updateCategorySchema,
  updateAttributeSchemaSchema,
  listCategoriesSchema,
  updateTagSchema,
  setMerchantTagsSchema,
  listAllRidersSchema,
  suspendRiderSchema,
  unsuspendRiderSchema,
  forceOfflineRiderSchema,
  getRiderEarningsSchema,
  updatePlatformSettingsSchema,
  customerRequestsSchema,
  customerTransactionsSchema,
  refundTransactionSchema,
  utilityPaymentsQuerySchema,
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
router.put('/merchants/:merchantId/bank-account', validate(setMerchantBankAccountSchema), adminController.setMerchantBankAccount);
router.get('/merchants/:merchantId/analytics', adminController.getMerchantAnalytics);
router.get('/merchants/:merchantId/transactions', validate(customerTransactionsSchema, 'query'), adminController.getMerchantTransactions);
router.get('/merchants/:merchantId/transactions/:transactionId', adminController.getMerchantTransactionById);
router.get('/merchants/:merchantId/utility-payments', validate(utilityPaymentsQuerySchema, 'query'), adminController.getMerchantUtilityPayments);
router.get('/merchants/:merchantId/utility-payments/:paymentId', adminController.getMerchantUtilityPaymentById);
router.post('/merchants/:merchantId/pin/reset', validate(resetCustomerPinSchema), adminController.resetMerchantPin);
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
// NOTE: literal sub-paths (/pending, /stats) are declared before the
// parameterized /riders/:riderId/* routes so they are not shadowed.
router.get('/riders/pending', validate(listPendingRidersSchema, 'query'), adminController.getPendingRiders);
router.get('/riders/stats', adminController.getRiderStats);
router.get('/riders', validate(listAllRidersSchema, 'query'), adminController.getAllRiders);
router.get('/riders/:riderId', adminController.getRiderById);
router.patch('/riders/:riderId/review', validate(reviewRiderSchema), adminController.reviewRider);
router.patch('/riders/:riderId/suspend', validate(suspendRiderSchema), adminController.suspendRider);
router.patch('/riders/:riderId/unsuspend', validate(unsuspendRiderSchema), adminController.unsuspendRider);
router.get('/riders/:riderId/earnings', validate(getRiderEarningsSchema, 'query'), adminController.getRiderEarnings);
router.get('/riders/:riderId/deliveries', validate(paginationSchema, 'query'), adminController.getRiderDeliveryHistory);
router.get('/riders/:riderId/transactions', validate(customerTransactionsSchema, 'query'), adminController.getRiderTransactions);
router.get('/riders/:riderId/transactions/:transactionId', adminController.getRiderTransactionById);
router.get('/riders/:riderId/utility-payments', validate(utilityPaymentsQuerySchema, 'query'), adminController.getRiderUtilityPayments);
router.get('/riders/:riderId/utility-payments/:paymentId', adminController.getRiderUtilityPaymentById);
router.post('/riders/:riderId/pin/reset', validate(resetCustomerPinSchema), adminController.resetRiderPin);

// Customer management
router.get('/customers', validate(listAllCustomersSchema, 'query'), adminController.getAllCustomers);
// Static path must precede the /:customerId param route so "stats" isn't read as an id.
router.get('/customers/stats', adminController.getCustomerStats);
router.get('/customers/:customerId', adminController.getCustomerById);
router.get('/customers/:customerId/requests', validate(customerRequestsSchema, 'query'), adminController.getCustomerRequests);
router.get('/customers/:customerId/transactions', validate(customerTransactionsSchema, 'query'), adminController.getCustomerTransactions);
router.get('/customers/:customerId/transactions/:transactionId', adminController.getCustomerTransactionById);
router.get('/customers/:customerId/utility-payments', validate(utilityPaymentsQuerySchema, 'query'), adminController.getCustomerUtilityPayments);
router.get('/customers/:customerId/utility-payments/:paymentId', adminController.getCustomerUtilityPaymentById);
router.get('/customers/:customerId/addresses', adminController.getCustomerAddresses);
// Reset (clear) a user's transaction PIN so they set a fresh one in-app (audit-logged).
router.post('/customers/:customerId/pin/reset', validate(resetCustomerPinSchema), adminController.resetCustomerPin);
router.patch('/customers/:customerId/status', validate(updateCustomerStatusSchema), adminController.updateCustomerStatus);
router.patch('/customers/:customerId', validate(updateCustomerSchema), adminController.updateCustomer);
router.post('/customers/:customerId/wipe-kyc', validate(wipeCustomerKycSchema), adminController.wipeCustomerKyc);

// Transaction oversight
router.get('/transactions', validate(transactionOverviewSchema, 'query'), adminController.getTransactions);
// Admin manual refund of a single wallet transaction (VTU-aware; guardrails in service).
router.post('/transactions/:transactionId/refund', validate(refundTransactionSchema), adminController.refundTransaction);

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
router.patch('/withdrawals/:withdrawalId/fail', adminController.failWithdrawal);
router.get('/withdrawals/history', validate(paginationStatusDateRangeSchema, 'query'), adminController.getWithdrawalHistory);

// Dispute resolution - backed by modules/support
router.get('/disputes', validate(supportDisputeListQuerySchema, 'query'), adminController.getDisputes);
router.get('/disputes/:disputeId', adminController.getDisputeDetail);
router.patch('/disputes/:disputeId/resolve', validate(supportResolveDisputeSchema), adminController.resolveDispute);
router.post('/disputes/:disputeId/messages', validate(supportDisputeMessageSchema), adminController.postDisputeMessageAdmin);

// Support management - backed by modules/support
router.get('/support/tickets', validate(supportTicketListQuerySchema, 'query'), adminController.getSupportTickets);
router.get('/support/tickets/:ticketId', adminController.getTicketDetail);
router.patch('/support/tickets/:ticketId/status', validate(supportUpdateTicketStatusSchema), adminController.updateTicketStatus);
router.patch('/support/tickets/:ticketId/assign', validate(supportAssignTicketSchema), adminController.assignTicket);
router.post('/support/tickets/:ticketId/messages', validate(supportTicketMessageSchema), adminController.postTicketMessageAdmin);

// Pre-launch waitlist - backed by modules/waitlist
router.get('/waitlist', validate(listWaitlistQuerySchema, 'query'), waitlistController.adminListEntries);
router.get('/waitlist/summary', waitlistController.adminSummary);
router.delete('/waitlist/:id', waitlistController.adminDeleteEntry);

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

// VTU network/disco/cable-name catalogue (provider IDs admin can edit)
router.get('/vtu-networks', adminController.getVtuNetworks);
router.post('/vtu-networks', adminController.createVtuNetwork);
router.put('/vtu-networks/:networkId', adminController.updateVtuNetwork);
router.delete('/vtu-networks/:networkId', adminController.deleteVtuNetwork);

// Phase 8 - Rider force-offline (real admin use + Maestro 05-force-offline).
router.post('/riders/:riderId/force-offline', validate(forceOfflineRiderSchema), adminController.forceOfflineRider);

// Phase 8 - Staging-only Maestro helpers. The service-layer guard refuses
// to run on production, so leaving the route mounted in all environments
// is safe.
router.post('/test/seed-offer', adminController.seedTestOffer);

module.exports = router;

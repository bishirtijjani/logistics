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
  updateRiderAccountSchema,
  updateMerchantAccountSchema,
  wipeCustomerKycSchema,
  resetCustomerPinSchema,
  listPendingRidersSchema,
  transactionOverviewSchema,
  listAllRequestsSchema,
  exportAllRequestsSchema,
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
  createStaffSchema,
  updateStaffPermissionsSchema,
  updateStaffProfileSchema,
} = require('./admin.validator');
const { PERMISSIONS } = require('../../config/permissions');
const customPlacesRoutes = require('../custom-places/custom-places.routes');

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

// Dashboard
router.get('/dashboard', adminController.getDashboard);

// Request management
router.get('/requests', authorize('ADMIN', PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_MERCHANTS), validate(listAllRequestsSchema, 'query'), adminController.getAllRequests);
// Static paths before '/requests/:requestId' so they aren't captured as IDs.
router.get('/requests/stats', authorize('ADMIN', PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_MERCHANTS), adminController.getRequestStats);
router.get('/requests/export', authorize('ADMIN', PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_MERCHANTS), validate(exportAllRequestsSchema, 'query'), adminController.exportRequests);
router.get('/requests/:requestId', authorize('ADMIN', PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_MERCHANTS), adminController.getRequestById);
router.patch('/requests/:requestId/reassign', authorize('ADMIN', PERMISSIONS.MANAGE_USERS), validate(reassignRiderSchema), adminController.reassignRider);
router.patch('/requests/:requestId/cancel', authorize('ADMIN', PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_MERCHANTS), validate(forceCancelRequestSchema), adminController.forceCancelRequest);
router.patch('/requests/:requestId/status', authorize('ADMIN', PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_MERCHANTS), validate(adminUpdateRequestStatusSchema), adminController.adminUpdateRequestStatus);

// Merchant management
router.get('/merchants', authorize('ADMIN', PERMISSIONS.MANAGE_MERCHANTS), validate(listAllMerchantsSchema, 'query'), adminController.getAllMerchants);
router.get('/merchants/:merchantId', authorize('ADMIN', PERMISSIONS.MANAGE_MERCHANTS), adminController.getMerchantById);
router.put('/merchants/:merchantId', authorize('ADMIN', PERMISSIONS.MANAGE_MERCHANTS), validate(updateMerchantProfileSchema), adminController.updateMerchantProfile);
router.patch('/merchants/:merchantId/account', authorize('ADMIN', PERMISSIONS.MANAGE_MERCHANTS), validate(updateMerchantAccountSchema), adminController.updateMerchantAccount);
router.patch('/merchants/:merchantId/approve', authorize('ADMIN', PERMISSIONS.MANAGE_MERCHANTS), validate(approveMerchantSchema), adminController.approveMerchant);
router.patch('/merchants/:merchantId/reject', authorize('ADMIN', PERMISSIONS.MANAGE_MERCHANTS), validate(rejectMerchantSchema), adminController.rejectMerchant);
router.patch('/merchants/:merchantId/suspend', authorize('ADMIN', PERMISSIONS.MANAGE_MERCHANTS), validate(suspendMerchantSchema), adminController.suspendMerchant);
router.patch('/merchants/:merchantId/unsuspend', authorize('ADMIN', PERMISSIONS.MANAGE_MERCHANTS), validate(unsuspendMerchantSchema), adminController.unsuspendMerchant);
router.patch('/merchants/:merchantId/commission', authorize('ADMIN', PERMISSIONS.MANAGE_MERCHANTS), validate(updateMerchantCommissionSchema), adminController.updateMerchantCommission);
router.get('/merchants/:merchantId/commission-history', authorize('ADMIN', PERMISSIONS.MANAGE_MERCHANTS), validate(paginationSchema, 'query'), adminController.getMerchantCommissionHistory);
router.patch('/merchants/:merchantId/withdrawal-hold', authorize('ADMIN', PERMISSIONS.MANAGE_MERCHANTS, PERMISSIONS.MANAGE_FINANCE), validate(setWithdrawalHoldSchema), adminController.setWithdrawalHold);
router.put('/merchants/:merchantId/bank-account', authorize('ADMIN', PERMISSIONS.MANAGE_MERCHANTS), validate(setMerchantBankAccountSchema), adminController.setMerchantBankAccount);
router.get('/merchants/:merchantId/analytics', authorize('ADMIN', PERMISSIONS.MANAGE_MERCHANTS, PERMISSIONS.MANAGE_FINANCE), adminController.getMerchantAnalytics);
router.get('/merchants/:merchantId/transactions', authorize('ADMIN', PERMISSIONS.MANAGE_MERCHANTS, PERMISSIONS.MANAGE_FINANCE), validate(customerTransactionsSchema, 'query'), adminController.getMerchantTransactions);
router.get('/merchants/:merchantId/transactions/:transactionId', authorize('ADMIN', PERMISSIONS.MANAGE_MERCHANTS, PERMISSIONS.MANAGE_FINANCE), adminController.getMerchantTransactionById);
router.get('/merchants/:merchantId/utility-payments', authorize('ADMIN', PERMISSIONS.MANAGE_MERCHANTS, PERMISSIONS.MANAGE_FINANCE), validate(utilityPaymentsQuerySchema, 'query'), adminController.getMerchantUtilityPayments);
router.get('/merchants/:merchantId/utility-payments/:paymentId', authorize('ADMIN', PERMISSIONS.MANAGE_MERCHANTS, PERMISSIONS.MANAGE_FINANCE), adminController.getMerchantUtilityPaymentById);
router.post('/merchants/:merchantId/pin/reset', authorize('ADMIN', PERMISSIONS.MANAGE_MERCHANTS), validate(resetCustomerPinSchema), adminController.resetMerchantPin);
router.post('/merchants/:merchantId/tags', authorize('ADMIN', PERMISSIONS.MANAGE_MERCHANTS), validate(setMerchantTagsSchema), adminController.setMerchantTags);

// Withdrawal bulk operations
router.post('/withdrawals/bulk-approve', authorize('ADMIN', PERMISSIONS.MANAGE_FINANCE), validate(bulkApproveWithdrawalsSchema), adminController.bulkApproveWithdrawals);

// Tag management
router.get('/tags', authorize('ADMIN', PERMISSIONS.MANAGE_MERCHANTS), validate(getAllTagsSchema, 'query'), adminController.getAllTags);
router.post('/tags', authorize('ADMIN', PERMISSIONS.MANAGE_MERCHANTS), validate(createTagSchema), adminController.createTag);
router.put('/tags/:tagId', authorize('ADMIN', PERMISSIONS.MANAGE_MERCHANTS), validate(updateTagSchema), adminController.updateTag);
router.delete('/tags/:tagId', authorize('ADMIN', PERMISSIONS.MANAGE_MERCHANTS), adminController.deleteTag);

// Merchant category management
router.get('/categories', authorize('ADMIN', PERMISSIONS.MANAGE_MERCHANTS), validate(listCategoriesSchema, 'query'), adminController.getAllCategories);
router.post('/categories', authorize('ADMIN', PERMISSIONS.MANAGE_MERCHANTS), validate(createCategorySchema), adminController.createCategory);
router.put('/categories/:categoryId', authorize('ADMIN', PERMISSIONS.MANAGE_MERCHANTS), validate(updateCategorySchema), adminController.updateCategory);
router.patch('/categories/:categoryId/attribute-schema', authorize('ADMIN', PERMISSIONS.MANAGE_MERCHANTS), validate(updateAttributeSchemaSchema), adminController.updateCategoryAttributeSchema);
router.delete('/categories/:categoryId', authorize('ADMIN', PERMISSIONS.MANAGE_MERCHANTS), adminController.deleteCategory);

// Rider management
// NOTE: literal sub-paths (/pending, /stats, /performance, /realtime) are
// declared before the parameterized /riders/:riderId/* routes so they are not
// shadowed (Express matches top-down; /riders/realtime would otherwise be
// read as /riders/:riderId with riderId="realtime").
router.get('/riders/pending', authorize('ADMIN', PERMISSIONS.MANAGE_USERS), validate(listPendingRidersSchema, 'query'), adminController.getPendingRiders);
router.get('/riders/stats', authorize('ADMIN', PERMISSIONS.MANAGE_USERS), adminController.getRiderStats);
router.get('/riders/performance', authorize('ADMIN', PERMISSIONS.MANAGE_USERS), validate(paginationDateRangeSchema, 'query'), adminController.getRiderPerformance);
router.get('/riders/realtime', authorize('ADMIN', PERMISSIONS.MANAGE_USERS), adminController.getRiderRealtimeLocation);
router.get('/riders', authorize('ADMIN', PERMISSIONS.MANAGE_USERS), validate(listAllRidersSchema, 'query'), adminController.getAllRiders);
router.get('/riders/:riderId', authorize('ADMIN', PERMISSIONS.MANAGE_USERS), adminController.getRiderById);
router.get('/riders/:riderId/location', authorize('ADMIN', PERMISSIONS.MANAGE_USERS), adminController.getRiderLiveLocation);
router.patch('/riders/:riderId/review', authorize('ADMIN', PERMISSIONS.MANAGE_USERS), validate(reviewRiderSchema), adminController.reviewRider);
router.patch('/riders/:riderId/suspend', authorize('ADMIN', PERMISSIONS.MANAGE_USERS), validate(suspendRiderSchema), adminController.suspendRider);
router.patch('/riders/:riderId/unsuspend', authorize('ADMIN', PERMISSIONS.MANAGE_USERS), validate(unsuspendRiderSchema), adminController.unsuspendRider);
router.get('/riders/:riderId/earnings', authorize('ADMIN', PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_FINANCE), validate(getRiderEarningsSchema, 'query'), adminController.getRiderEarnings);
router.get('/riders/:riderId/deliveries', authorize('ADMIN', PERMISSIONS.MANAGE_USERS), validate(paginationSchema, 'query'), adminController.getRiderDeliveryHistory);
router.get('/riders/:riderId/transactions', authorize('ADMIN', PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_FINANCE), validate(customerTransactionsSchema, 'query'), adminController.getRiderTransactions);
router.get('/riders/:riderId/transactions/:transactionId', authorize('ADMIN', PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_FINANCE), adminController.getRiderTransactionById);
router.get('/riders/:riderId/utility-payments', authorize('ADMIN', PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_FINANCE), validate(utilityPaymentsQuerySchema, 'query'), adminController.getRiderUtilityPayments);
router.get('/riders/:riderId/utility-payments/:paymentId', authorize('ADMIN', PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_FINANCE), adminController.getRiderUtilityPaymentById);
router.post('/riders/:riderId/pin/reset', authorize('ADMIN', PERMISSIONS.MANAGE_USERS), validate(resetCustomerPinSchema), adminController.resetRiderPin);
router.patch('/riders/:riderId/account', authorize('ADMIN', PERMISSIONS.MANAGE_USERS), validate(updateRiderAccountSchema), adminController.updateRiderAccount);

// Customer management
router.get('/customers', authorize('ADMIN', PERMISSIONS.MANAGE_USERS), validate(listAllCustomersSchema, 'query'), adminController.getAllCustomers);
// Static path must precede the /:customerId param route so "stats" isn't read as an id.
router.get('/customers/stats', authorize('ADMIN', PERMISSIONS.MANAGE_USERS), adminController.getCustomerStats);
router.get('/customers/:customerId', authorize('ADMIN', PERMISSIONS.MANAGE_USERS), adminController.getCustomerById);
router.get('/customers/:customerId/requests', authorize('ADMIN', PERMISSIONS.MANAGE_USERS), validate(customerRequestsSchema, 'query'), adminController.getCustomerRequests);
router.get('/customers/:customerId/transactions', authorize('ADMIN', PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_FINANCE), validate(customerTransactionsSchema, 'query'), adminController.getCustomerTransactions);
router.get('/customers/:customerId/transactions/:transactionId', authorize('ADMIN', PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_FINANCE), adminController.getCustomerTransactionById);
router.get('/customers/:customerId/utility-payments', authorize('ADMIN', PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_FINANCE), validate(utilityPaymentsQuerySchema, 'query'), adminController.getCustomerUtilityPayments);
router.get('/customers/:customerId/utility-payments/:paymentId', authorize('ADMIN', PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_FINANCE), adminController.getCustomerUtilityPaymentById);
router.get('/customers/:customerId/addresses', authorize('ADMIN', PERMISSIONS.MANAGE_USERS), adminController.getCustomerAddresses);
// Reset (clear) a user's transaction PIN so they set a fresh one in-app (audit-logged).
router.post('/customers/:customerId/pin/reset', authorize('ADMIN', PERMISSIONS.MANAGE_USERS), validate(resetCustomerPinSchema), adminController.resetCustomerPin);
router.patch('/customers/:customerId/status', authorize('ADMIN', PERMISSIONS.MANAGE_USERS), validate(updateCustomerStatusSchema), adminController.updateCustomerStatus);
router.patch('/customers/:customerId', authorize('ADMIN', PERMISSIONS.MANAGE_USERS), validate(updateCustomerSchema), adminController.updateCustomer);
router.post('/customers/:customerId/wipe-kyc', authorize('ADMIN', PERMISSIONS.MANAGE_USERS), validate(wipeCustomerKycSchema), adminController.wipeCustomerKyc);

// Transaction oversight
router.get('/transactions', authorize('ADMIN', PERMISSIONS.MANAGE_FINANCE), validate(transactionOverviewSchema, 'query'), adminController.getTransactions);
// Admin manual refund of a single wallet transaction (VTU-aware; guardrails in service).
router.post('/transactions/:transactionId/refund', authorize('ADMIN', PERMISSIONS.MANAGE_FINANCE), validate(refundTransactionSchema), adminController.refundTransaction);

// Platform settings
router.get('/settings', authorize('ADMIN', PERMISSIONS.MANAGE_SETTINGS), adminController.getPlatformSettings);
router.patch('/settings', authorize('ADMIN', PERMISSIONS.MANAGE_SETTINGS), validate(updatePlatformSettingsSchema), adminController.updatePlatformSettings);

// Staff management
router.get('/staff', authorize('ADMIN', PERMISSIONS.MANAGE_STAFF), adminController.listStaff);
router.post('/staff', authorize('ADMIN', PERMISSIONS.MANAGE_STAFF), validate(createStaffSchema), adminController.createStaff);
router.patch('/staff/:staffId/permissions', authorize('ADMIN', PERMISSIONS.MANAGE_STAFF), validate(updateStaffPermissionsSchema), adminController.updateStaffPermissions);
router.patch('/staff/:staffId/profile', authorize('ADMIN', PERMISSIONS.MANAGE_STAFF), validate(updateStaffProfileSchema), adminController.updateStaffProfile);

// Audit logs
router.get('/audit-logs', authorize('ADMIN', PERMISSIONS.MANAGE_STAFF), validate(getAuditLogsSchema, 'query'), adminController.getAuditLogs);

// Platform analytics
router.get('/analytics/revenue', authorize('ADMIN', PERMISSIONS.MANAGE_FINANCE), adminController.getRevenueAnalytics);
router.get('/analytics/orders', authorize('ADMIN', PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_MERCHANTS), adminController.getOrderAnalytics);
router.get('/analytics/customers', authorize('ADMIN', PERMISSIONS.MANAGE_USERS), adminController.getCustomerAnalytics);
router.get('/analytics/geographic', authorize('ADMIN', PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_MERCHANTS), adminController.getGeographicAnalytics);
router.get('/analytics/realtime', authorize('ADMIN', PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_MERCHANTS), adminController.getRealtimeMetrics);

// Withdrawal management
router.get('/withdrawals/pending', authorize('ADMIN', PERMISSIONS.MANAGE_FINANCE), validate(paginationSchema, 'query'), adminController.getPendingWithdrawals);
router.patch('/withdrawals/:withdrawalId/approve', authorize('ADMIN', PERMISSIONS.MANAGE_FINANCE), adminController.approveWithdrawal);
router.patch('/withdrawals/:withdrawalId/reject', authorize('ADMIN', PERMISSIONS.MANAGE_FINANCE), adminController.rejectWithdrawal);
router.patch('/withdrawals/:withdrawalId/fail', authorize('ADMIN', PERMISSIONS.MANAGE_FINANCE), adminController.failWithdrawal);
router.get('/withdrawals/history', authorize('ADMIN', PERMISSIONS.MANAGE_FINANCE), validate(paginationStatusDateRangeSchema, 'query'), adminController.getWithdrawalHistory);

// Dispute resolution - backed by modules/support
router.get('/disputes', authorize('ADMIN', PERMISSIONS.MANAGE_SUPPORT), validate(supportDisputeListQuerySchema, 'query'), adminController.getDisputes);
router.get('/disputes/:disputeId', authorize('ADMIN', PERMISSIONS.MANAGE_SUPPORT), adminController.getDisputeDetail);
router.patch('/disputes/:disputeId/resolve', authorize('ADMIN', PERMISSIONS.MANAGE_SUPPORT), validate(supportResolveDisputeSchema), adminController.resolveDispute);
router.post('/disputes/:disputeId/messages', authorize('ADMIN', PERMISSIONS.MANAGE_SUPPORT), validate(supportDisputeMessageSchema), adminController.postDisputeMessageAdmin);

// Support management - backed by modules/support
router.get('/support/tickets', authorize('ADMIN', PERMISSIONS.MANAGE_SUPPORT), validate(supportTicketListQuerySchema, 'query'), adminController.getSupportTickets);
router.get('/support/tickets/:ticketId', authorize('ADMIN', PERMISSIONS.MANAGE_SUPPORT), adminController.getTicketDetail);
router.patch('/support/tickets/:ticketId/status', authorize('ADMIN', PERMISSIONS.MANAGE_SUPPORT), validate(supportUpdateTicketStatusSchema), adminController.updateTicketStatus);
router.patch('/support/tickets/:ticketId/assign', authorize('ADMIN', PERMISSIONS.MANAGE_SUPPORT), validate(supportAssignTicketSchema), adminController.assignTicket);
router.post('/support/tickets/:ticketId/messages', authorize('ADMIN', PERMISSIONS.MANAGE_SUPPORT), validate(supportTicketMessageSchema), adminController.postTicketMessageAdmin);

// Pre-launch waitlist - backed by modules/waitlist
router.get('/waitlist', authorize('ADMIN', PERMISSIONS.MANAGE_USERS), validate(listWaitlistQuerySchema, 'query'), waitlistController.adminListEntries);
router.get('/waitlist/summary', authorize('ADMIN', PERMISSIONS.MANAGE_USERS), waitlistController.adminSummary);
router.delete('/waitlist/:id', authorize('ADMIN', PERMISSIONS.MANAGE_USERS), waitlistController.adminDeleteEntry);

// Marketing oversight
router.get('/marketing/campaigns', authorize('ADMIN', PERMISSIONS.MANAGE_SETTINGS), validate(paginationSchema, 'query'), adminController.getPlatformCampaigns);
router.get('/marketing/discounts', authorize('ADMIN', PERMISSIONS.MANAGE_SETTINGS), validate(paginationStatusSchema, 'query'), adminController.getDiscountCodes);
router.patch('/marketing/discounts/:discountId/approve', authorize('ADMIN', PERMISSIONS.MANAGE_SETTINGS), adminController.approveDiscountCode);
router.patch('/marketing/discounts/:discountId/reject', authorize('ADMIN', PERMISSIONS.MANAGE_SETTINGS), adminController.rejectDiscountCode);

// Banner management
router.get('/marketing/banners', authorize('ADMIN', PERMISSIONS.MANAGE_SETTINGS), adminController.getBanners);
router.post('/marketing/banners', authorize('ADMIN', PERMISSIONS.MANAGE_SETTINGS), adminController.createBanner);
router.put('/marketing/banners/:bannerId', authorize('ADMIN', PERMISSIONS.MANAGE_SETTINGS), adminController.updateBanner);
router.delete('/marketing/banners/:bannerId', authorize('ADMIN', PERMISSIONS.MANAGE_SETTINGS), adminController.deleteBanner);

// Safety & compliance
router.get('/safety/incidents', authorize('ADMIN', PERMISSIONS.MANAGE_SUPPORT), validate(paginationStatusSchema, 'query'), adminController.getSafetyIncidents);
router.get('/safety/compliance', authorize('ADMIN', PERMISSIONS.MANAGE_SUPPORT), adminController.getComplianceReport);

// VTU plan management
router.get('/vtu-plans', authorize('ADMIN', PERMISSIONS.MANAGE_VTU), adminController.getVtuPlans);
router.post('/vtu-plans', authorize('ADMIN', PERMISSIONS.MANAGE_VTU), adminController.createVtuPlan);
router.post('/vtu-plans/bulk', authorize('ADMIN', PERMISSIONS.MANAGE_VTU), adminController.bulkCreateVtuPlans);
router.put('/vtu-plans/:planId', authorize('ADMIN', PERMISSIONS.MANAGE_VTU), adminController.updateVtuPlan);
router.delete('/vtu-plans/:planId', authorize('ADMIN', PERMISSIONS.MANAGE_VTU), adminController.deleteVtuPlan);

// Upstream VTU provider float balance (read-only). VTU or Finance managers may view it.
router.get('/vtu-provider-balance', authorize('ADMIN', PERMISSIONS.MANAGE_VTU, PERMISSIONS.MANAGE_FINANCE), adminController.getVtuProviderBalance);

// VTU network/disco/cable-name catalogue (provider IDs admin can edit)
router.get('/vtu-networks', authorize('ADMIN', PERMISSIONS.MANAGE_VTU), adminController.getVtuNetworks);
router.post('/vtu-networks', authorize('ADMIN', PERMISSIONS.MANAGE_VTU), adminController.createVtuNetwork);
router.put('/vtu-networks/:networkId', authorize('ADMIN', PERMISSIONS.MANAGE_VTU), adminController.updateVtuNetwork);
router.delete('/vtu-networks/:networkId', authorize('ADMIN', PERMISSIONS.MANAGE_VTU), adminController.deleteVtuNetwork);

// Custom map places - admin-curated locations Google doesn't know about
// (campus buildings, estates, villages). Mounted before the parameterized
// admin routes so nothing shadows them.
router.use('/places', authorize('ADMIN', PERMISSIONS.MANAGE_SETTINGS), customPlacesRoutes);

// Phase 8 - Rider force-offline (real admin use + Maestro 05-force-offline).
router.post('/riders/:riderId/force-offline', authorize('ADMIN', PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_SUPPORT), validate(forceOfflineRiderSchema), adminController.forceOfflineRider);


// Phase 8 - Staging-only Maestro helpers. The service-layer guard refuses
// to run on production, so leaving the route mounted in all environments
// is safe.
router.post('/test/seed-offer', adminController.seedTestOffer);

module.exports = router;

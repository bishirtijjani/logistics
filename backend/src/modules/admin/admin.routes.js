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
  listAllProvidersSchema,
  approveProviderSchema,
  rejectProviderSchema,
  suspendProviderSchema,
  unsuspendProviderSchema,
  updateProviderCommissionSchema,
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

// Provider management
router.get('/providers', validate(listAllProvidersSchema, 'query'), adminController.getAllProviders);
router.patch('/providers/:providerId/approve', validate(approveProviderSchema), adminController.approveProvider);
router.patch('/providers/:providerId/reject', validate(rejectProviderSchema), adminController.rejectProvider);
router.patch('/providers/:providerId/suspend', validate(suspendProviderSchema), adminController.suspendProvider);
router.patch('/providers/:providerId/unsuspend', validate(unsuspendProviderSchema), adminController.unsuspendProvider);
router.patch('/providers/:providerId/commission', validate(updateProviderCommissionSchema), adminController.updateProviderCommission);

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

module.exports = router;

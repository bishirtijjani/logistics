/**
 * Admin routes — /api/v1/admin
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
} = require('./admin.validator');

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

// Dashboard
router.get('/dashboard', adminController.getDashboard);

// Rider management
router.get('/riders/pending', validate(listPendingRidersSchema, 'query'), adminController.getPendingRiders);
router.patch('/riders/:riderId/review', validate(reviewRiderSchema), adminController.reviewRider);

// User management
router.patch('/users/:userId/status', validate(updateUserStatusSchema), adminController.updateUserStatus);

// Transaction oversight
router.get('/transactions', validate(transactionOverviewSchema, 'query'), adminController.getTransactions);

module.exports = router;

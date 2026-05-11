/**
 * Request routes — /api/requests
 * Unified request endpoints for all request types (FOOD, GROCERY, PHARMACY, PACKAGE)
 */

const { Router } = require('express');
const requestController = require('./request.controller');
const { validate } = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/role.middleware');
const { idempotency } = require('../../middlewares/idempotency.middleware');
const {
  createRequestSchema,
  updateStatusSchema,
  listRequestsSchema,
  rateRequestSchema,
  cancelRequestSchema,
} = require('./request.validator');

const router = Router();

// All request routes require authentication
router.use(authenticate);

// ============================================================
// Public endpoints (any authenticated user)
// ============================================================

// Get pricing quote before creating a request
router.get('/quote', requestController.getQuote);

// List requests (customers see theirs, riders see theirs, merchants see theirs)
router.get('/', validate(listRequestsSchema, 'query'), requestController.getRequests);

// Get single request details
router.get('/:requestId', requestController.getRequestById);

// ============================================================
// Customer endpoints
// ============================================================

// Create a new request (any type)
router.post('/', authorize('CUSTOMER'), idempotency, validate(createRequestSchema), requestController.createRequest);

// Cancel request (customer only, before pickup)
router.delete('/:requestId', authorize('CUSTOMER'), validate(cancelRequestSchema), requestController.cancelRequest);

// Rate completed request (customer only)
router.post('/:requestId/rate', authorize('CUSTOMER'), validate(rateRequestSchema), requestController.rateRequest);

// ============================================================
// Merchant endpoints
// ============================================================

// Update request status (merchant: ACCEPTED, PROCESSING, READY_FOR_PICKUP)
router.patch('/:requestId/status', authorize('MERCHANT', 'RIDER', 'ADMIN'), validate(updateStatusSchema), requestController.updateStatus);

// ============================================================
// Rider endpoints
// ============================================================

// Update request status (rider: RIDER_EN_ROUTE, PICKED_UP, IN_TRANSIT, DELIVERED)
// Note: This is handled by the same endpoint above with role authorization

// ============================================================
// Admin endpoints
// ============================================================

// Get all requests with advanced filtering (admin only)
router.get('/admin/all', authorize('ADMIN'), requestController.getAllRequestsAdmin);

// Reassign rider to request (admin only)
router.patch('/:requestId/reassign-rider', authorize('ADMIN'), requestController.reassignRider);

// Force cancel request with reason (admin only)
router.patch('/:requestId/force-cancel', authorize('ADMIN'), requestController.forceCancelRequest);

// Admin status override (admin only)
router.patch('/:requestId/admin-status', authorize('ADMIN'), requestController.adminUpdateStatus);

module.exports = router;

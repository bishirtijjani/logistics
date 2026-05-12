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
  quoteRequestSchema,
  postMessageSchema,
  listMessagesSchema,
} = require('./request.validator');

const router = Router();

// All request routes require authentication
router.use(authenticate);

// ============================================================
// Public endpoints (any authenticated user)
// ============================================================

// Server-truth quote — POST same shape as createRequest, returns pricing + validUntil
router.post('/quote', validate(quoteRequestSchema), requestController.getQuote);

// List requests (customers see theirs, riders see theirs, merchants see theirs)
router.get('/', validate(listRequestsSchema, 'query'), requestController.getRequests);

// Active request for the home banner. Single query against the
// (customerId, status) composite index. Returns the current active request
// or null. Must be registered BEFORE /:requestId so /active doesn't get
// captured as `requestId='active'`.
router.get('/active', requestController.getActiveRequest);

// Get single request details
router.get('/:requestId', requestController.getRequestById);

// Tracking — route polyline + live ETA from rider's last known position.
// Cached in Redis for 30s to keep Maps quota in check.
router.get('/:requestId/route', requestController.getRoute);

// In-app messaging — list + post (rider/customer/merchant, all in the request)
router.get('/:requestId/messages', validate(listMessagesSchema, 'query'), requestController.listMessages);
router.post('/:requestId/messages', validate(postMessageSchema), requestController.postMessage);

// ============================================================
// Customer endpoints
// ============================================================

// Create a new request (any type)
router.post('/', authorize('CUSTOMER'), idempotency, validate(createRequestSchema), requestController.createRequest);

// Cancellation quote — preview the fee/refund before the customer confirms.
router.get('/:requestId/cancel-quote', authorize('CUSTOMER'), requestController.getCancellationQuote);

// Cancel request (customer only, before pickup) — fee policy applied server-side.
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

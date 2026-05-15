/**
 * Support routes — /api/support
 * User-facing endpoints for tickets and disputes.
 *
 * Admin endpoints live under /api/admin/* and are wired in admin.routes.js
 * (delegated to this module's controller to keep paths backward-compatible).
 */

const { Router } = require('express');
const supportController = require('./support.controller');
const { validate } = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/role.middleware');
const { idempotency } = require('../../middlewares/idempotency.middleware');
const {
  createTicketSchema,
  ticketMessageSchema,
  ticketListQuerySchema,
  createDisputeSchema,
  disputeMessageSchema,
  disputeListQuerySchema,
} = require('./support.validator');

const router = Router();

router.use(authenticate);

// ============================================================
// Tickets
// ============================================================

router.post('/tickets', idempotency, validate(createTicketSchema), supportController.createTicket);
router.get('/tickets', validate(ticketListQuerySchema, 'query'), supportController.listMyTickets);
router.get('/tickets/:id', supportController.getTicketById);
router.post('/tickets/:id/messages', validate(ticketMessageSchema), supportController.postTicketMessage);
router.patch('/tickets/:id/close', supportController.closeTicket);

// ============================================================
// Disputes
// ============================================================

router.post('/disputes', authorize('CUSTOMER'), idempotency, validate(createDisputeSchema), supportController.createDispute);
router.get('/disputes', validate(disputeListQuerySchema, 'query'), supportController.listDisputes);
router.get('/disputes/:id', supportController.getDisputeById);
router.post('/disputes/:id/messages', validate(disputeMessageSchema), supportController.postDisputeMessage);

module.exports = router;

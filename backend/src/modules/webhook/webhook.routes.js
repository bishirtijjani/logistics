/**
 * Webhook routes — /api/webhooks
 *
 * These endpoints receive callbacks from external merchants.
 * They do NOT require JWT auth — they use merchant-specific verification.
 */

const { Router } = require('express');
const webhookController = require('./webhook.controller');

const router = Router();

// Monnify webhook — wallet funding notifications
router.post('/monnify', webhookController.handleMonnify);

// VTPass webhook — utility payment status updates (if applicable)
router.post('/vtpass', webhookController.handleVtpass);

module.exports = router;

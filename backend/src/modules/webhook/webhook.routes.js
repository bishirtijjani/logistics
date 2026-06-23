const { Router } = require('express');
const express = require('express');
const webhookController = require('./webhook.controller');

const router = Router();

// KatPay webhook - uses raw body parser for HMAC verification
router.post('/katpay', express.raw({ type: '*/*' }), webhookController.handleKatpay);

// BilalSada purchase callback - optional accelerator for VTU/bills delivery.
// Raw body parser for HMAC verification. Inert unless BILALSADASUB_WEBHOOK_SECRET
// is set; the sync + poll + reconcile flow settles every payment without it.
router.post('/bilalsada', express.raw({ type: '*/*' }), webhookController.handleBilalsada);

// WhatsApp Cloud API.
//   GET  - Meta's one-time verify handshake (echoes hub.challenge)
//   POST - Delivery status + inbound messages, signed with X-Hub-Signature-256.
// Raw body parser is already applied app-wide on /webhooks (see app.js) so the
// HMAC check in the controller sees the unmodified bytes Meta sent.
router.get('/whatsapp', webhookController.verifyWhatsapp);
router.post('/whatsapp', webhookController.handleWhatsapp);

module.exports = router;

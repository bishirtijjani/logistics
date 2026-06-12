const { Router } = require('express');
const express = require('express');
const webhookController = require('./webhook.controller');

const router = Router();

// KatPay webhook - uses raw body parser for HMAC verification
router.post('/katpay', express.raw({ type: '*/*' }), webhookController.handleKatpay);

// WhatsApp Cloud API.
//   GET  - Meta's one-time verify handshake (echoes hub.challenge)
//   POST - Delivery status + inbound messages, signed with X-Hub-Signature-256.
// Raw body parser is already applied app-wide on /webhooks (see app.js) so the
// HMAC check in the controller sees the unmodified bytes Meta sent.
router.get('/whatsapp', webhookController.verifyWhatsapp);
router.post('/whatsapp', webhookController.handleWhatsapp);

module.exports = router;

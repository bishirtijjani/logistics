const { Router } = require('express');
const express = require('express');
const webhookController = require('./webhook.controller');

const router = Router();

// KatPay webhook — uses raw body parser for HMAC verification
router.post('/katpay', express.raw({ type: '*/*' }), webhookController.handleKatpay);

// Monnify webhook (legacy)
router.post('/monnify', webhookController.handleMonnify);

// VTPass webhook
router.post('/vtpass', webhookController.handleVtpass);

module.exports = router;

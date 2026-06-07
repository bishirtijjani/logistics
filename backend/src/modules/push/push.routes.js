const { Router } = require('express');
const controller = require('./push.controller');
const { authenticate } = require('../../middlewares/auth.middleware');

const router = Router();

// Public — the VAPID public key is meant to be shared with browser clients.
router.get('/public-key', controller.getPublicKey);

// Authenticated — subscriptions are tied to the logged-in user.
router.post('/subscribe', authenticate, controller.subscribe);
router.post('/unsubscribe', authenticate, controller.unsubscribe);

module.exports = router;

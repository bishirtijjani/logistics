/**
 * Public contact routes — /contact
 *
 * Backs the "Send us a message" form on the marketing site. Public + rate
 * limited so abuse can't burn the SMTP quota.
 */

const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const controller = require('./contact.controller');
const { validate } = require('../../middlewares/validate.middleware');
const { ApiResponse } = require('../../utils/api-response');
const { createContactMessageSchema } = require('./contact.validator');

const router = Router();

// 3 messages per IP per 10 minutes — generous for a real visitor, brutal for
// a bot. We still take the hit on the SMTP send but bots get throttled fast.
const contactLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: ApiResponse.error("You've sent a lot of messages — please wait a few minutes and try again."),
});

router.post('/', contactLimiter, validate(createContactMessageSchema), controller.submitContactMessage);

module.exports = router;

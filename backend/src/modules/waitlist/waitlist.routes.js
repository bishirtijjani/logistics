/**
 * Public waitlist routes — /waitlist
 * The marketing website POSTs here when a visitor taps "Download" before the
 * mobile apps are live in the stores. Rate-limited so a script can't flood it.
 */

const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const controller = require('./waitlist.controller');
const { validate } = require('../../middlewares/validate.middleware');
const { ApiResponse } = require('../../utils/api-response');
const { createWaitlistEntrySchema } = require('./waitlist.validator');

const router = Router();

// 5 submissions per IP per 10 minutes. Generous enough for a household behind
// shared CGNAT to all sign up; tight enough to make scripted abuse pointless.
const waitlistLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: ApiResponse.error("That's a lot of sign-ups. Please try again in a few minutes."),
});

router.post('/', waitlistLimiter, validate(createWaitlistEntrySchema), controller.createEntry);

module.exports = router;

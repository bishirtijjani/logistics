/**
 * Public waitlist routes - /waitlist
 *
 * The marketing website POSTs here when a visitor taps "Download" before the
 * mobile apps are live in the stores. Spam protection is a hidden honeypot
 * field validated server-side - see waitlist.validator. No IP rate-limiting:
 * with Nigerian CGNAT a single bucket would block whole neighborhoods.
 */

const { Router } = require('express');
const controller = require('./waitlist.controller');
const { validate } = require('../../middlewares/validate.middleware');
const { createWaitlistEntrySchema } = require('./waitlist.validator');

const router = Router();

router.post('/', validate(createWaitlistEntrySchema), controller.createEntry);

module.exports = router;

/**
 * Public contact routes — /contact
 *
 * Backs the "Send us a message" form on the marketing site. Spam protection
 * is a hidden honeypot field validated server-side — see contact.validator.
 * No IP rate-limiting: with Nigerian CGNAT a single bucket would block whole
 * neighborhoods. SMTP-side and inbox-side filters handle anything that gets
 * past the honeypot.
 */

const { Router } = require('express');
const controller = require('./contact.controller');
const { validate } = require('../../middlewares/validate.middleware');
const { createContactMessageSchema } = require('./contact.validator');

const router = Router();

router.post('/', validate(createContactMessageSchema), controller.submitContactMessage);

module.exports = router;

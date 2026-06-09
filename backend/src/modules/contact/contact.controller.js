const contactService = require('./contact.service');
const { ApiResponse } = require('../../utils/api-response');
const { logger } = require('../../utils/logger');

const submitContactMessage = async (req, res, next) => {
  try {
    // Honeypot: if the hidden `website` field was filled, this is a bot.
    // Respond 200 like a normal success so the bot moves on; don't actually
    // send the email or notify anyone.
    if (req.body.website && req.body.website.trim() !== '') {
      logger.info('Contact honeypot triggered - silently dropped', { from: req.body.email, ip: req.ip });
      return res.status(201).json(
        ApiResponse.success(
          "Thanks - we got your message and a human will get back to you within one business day.",
          null,
        ),
      );
    }

    await contactService.submitContactMessage(req.body);
    res.status(201).json(
      ApiResponse.success(
        "Thanks - we got your message and a human will get back to you within one business day.",
        null,
      ),
    );
  } catch (err) {
    next(err);
  }
};

module.exports = { submitContactMessage };

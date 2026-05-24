/**
 * Contact service — forwards marketing-site contact-form messages to the
 * support inbox and sends a confirmation auto-reply to the submitter.
 *
 * No persistence: the inbox is the system of record. If the SMTP send fails
 * we surface the error to the caller (returns 500) so the form shows an
 * "email failed, try again or use the email link" state instead of a fake success.
 */

const emailService = require('../../services/email.service');
const { config } = require('../../config');
const { logger } = require('../../utils/logger');
const { AppError } = require('../../utils/api-error');

const submitContactMessage = async (input) => {
  if (!config.SMTP_USER || !config.SMTP_PASS) {
    // Dev convenience: log + succeed so the form doesn't 500 on a fresh
    // clone before SMTP is wired up. Prod always has SMTP_* set (validated at boot).
    logger.warn({ submission: input }, 'SMTP not configured — contact message logged only');
    return { delivered: false, devLog: true };
  }

  try {
    // Forward the message first; the confirmation is best-effort so a delivery
    // failure on the auto-reply (e.g. submitter typo'd email) doesn't lose the
    // support inquiry itself.
    await emailService.sendContactInquiryEmail({
      to: config.CONTACT_INBOX_EMAIL,
      name: input.name,
      email: input.email,
      message: input.message,
      source: input.source,
    });

    emailService
      .sendContactConfirmationEmail({ name: input.name, email: input.email })
      .catch((err) => {
        logger.warn({ err: err.message, email: input.email }, 'Contact confirmation email failed');
      });

    return { delivered: true };
  } catch (err) {
    logger.error({ err: err.message, email: input.email }, 'Contact form delivery failed');
    throw AppError.serviceUnavailable("We couldn't send your message right now. Please email hello@iprime.ng instead.");
  }
};

module.exports = { submitContactMessage };

/**
 * Messaging dispatcher - single entry point for outbound phone messages.
 *
 * Why this exists:
 *   - OTPs go via the active provider (WhatsApp by default, Termii on
 *     fallback) selected with the `OTP_PROVIDER` env flag. Flipping providers
 *     is a one-variable change - no code deploy required.
 *   - Transactional (non-OTP) SMS - welcome messages, electricity tokens,
 *     phone-change security notices - always tries Termii. WhatsApp's Cloud
 *     API requires a separately approved utility template per message type,
 *     so we don't route those through it. If Termii is unconfigured, these
 *     messages skip with a warning rather than throwing (callers wrap in
 *     `.catch()` and treat as best-effort).
 *
 * All other modules MUST go through this service. Direct calls to
 * whatsapp.service / termii.service exist only for the dispatcher itself
 * and the boot guard.
 */

const { config } = require("../config");
const { logger } = require("../utils/logger");
const whatsappService = require("./whatsapp.service");
const termiiService = require("./termii.service");

const activeOtpProvider = () => config.OTP_PROVIDER || "whatsapp";

/**
 * Boot guard. Delegates to whichever provider is currently active so we fail
 * fast on misconfiguration. Called once from server.js.
 */
const assertConfiguredForProd = () => {
  const provider = activeOtpProvider();
  logger.info(`Messaging: active OTP provider = ${provider}`);

  if (provider === "email") {
    termiiService.assertConfiguredForProd(); // dormant transactional channel
    return;
  }

  if (provider === "whatsapp") {
    whatsappService.assertConfiguredForProd();
  } else {
    termiiService.assertConfiguredForProd();
  }

  // Always run the Termii guard too - when WhatsApp is active, Termii is the
  // dormant transactional channel, and its own guard knows to log instead of
  // throw in that mode. Skipped if already invoked above to avoid double logs.
  if (provider !== "termii") {
    termiiService.assertConfiguredForProd();
  }
};

/**
 * Send a one-time passcode. Routes to the active provider - WhatsApp by
 * default. The same call covers signup, password reset, KYC phone proof,
 * and phone-change confirmation because the user-visible payload (a 6-digit
 * code) is identical across flows.
 */
const sendOtp = async (phoneNumber, code) => {
  const provider = activeOtpProvider();
  if (provider === "whatsapp") {
    return whatsappService.sendOtp(phoneNumber, code);
  }
  return termiiService.sendOtp(phoneNumber, code);
};

/**
 * Send a free-form transactional SMS. Always tries Termii regardless of the
 * OTP provider setting - WhatsApp doesn't allow free-form templates without
 * per-message approval. If Termii is unconfigured the call no-ops (the
 * underlying service logs a warning).
 *
 * Callers should treat success as best-effort; wallet / KYC / utility flows
 * that emit a transactional message must not block on its delivery.
 */
const sendSms = async (phoneNumber, message) => {
  return termiiService.sendSms(phoneNumber, message);
};

module.exports = {
  sendOtp,
  sendSms,
  assertConfiguredForProd,
  // Read-only accessor exposed for diagnostics (admin dashboard, /health).
  getActiveOtpProvider: activeOtpProvider,
};

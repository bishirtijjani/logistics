/**
 * KatPay service - DEPRECATED. After the Paystack migration KatPay is no longer
 * an active provider: we never provision NUBANs, send payouts, or initiate
 * checkouts through it. The ONLY thing kept alive is verifying KatPay's inbound
 * funding webhook, because KatPay cannot deactivate the old NUBANs and a customer
 * who saved their old account number can still transfer to it. Those straggler
 * payments still need to be credited (see webhook.controller.handleKatpay).
 *
 * All outbound KatPay client code has been removed; do not re-add it. New money
 * movement goes through paystack.service.
 */
const crypto = require('crypto');
const { config } = require('../config');

/**
 * Verify a KatPay webhook signature.
 * Formula: HMAC-SHA256(timestamp + "." + rawBody, api_secret)
 * Returns true if valid, false otherwise.
 */
const verifyWebhookSignature = (timestamp, rawBody, signature) => {
  try {
    const payload = `${timestamp}.${rawBody}`;
    const expected = crypto
      .createHmac('sha256', config.KATPAY_API_SECRET)
      .update(payload)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    const expectedBuf = Buffer.from(expected);
    const signatureBuf = Buffer.from(signature);
    if (expectedBuf.length !== signatureBuf.length) return false;

    return crypto.timingSafeEqual(expectedBuf, signatureBuf);
  } catch {
    return false;
  }
};

/**
 * Check if a webhook timestamp is within the allowed window (5 minutes).
 */
const isTimestampFresh = (timestamp) => {
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) return false;
  const ageMs = Date.now() - ts * 1000;
  return ageMs >= 0 && ageMs < 5 * 60 * 1000;
};

module.exports = {
  verifyWebhookSignature,
  isTimestampFresh,
};

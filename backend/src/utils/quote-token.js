/**
 * Quote token - HMAC-signed pricing token issued by POST /requests/quote
 * and re-validated by POST /requests.
 *
 * Wire format: base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload))
 *
 * The payload includes the locked pricing numbers, the geo fingerprint, the
 * type, and `exp` (epoch ms). createRequest verifies the signature, checks
 * `exp`, and asserts the locked numbers match what estimateRequest now
 * computes - protecting against stale quote replays AND price drift between
 * quote-time and create-time.
 */

const crypto = require('crypto');
const { config } = require('../config');

const QUOTE_TTL_MS = 5 * 60 * 1000; // 5 minutes per spec

// Derive a dedicated quote-signing secret from JWT_ACCESS_SECRET. Distinct domain
// so an attacker who somehow gets a quote token can't pivot to forging access
// tokens (and vice versa). Domain separation = single sha256 with a label.
const QUOTE_SECRET = crypto
  .createHash('sha256')
  .update(`quote-token.v1|${config.JWT_ACCESS_SECRET}`)
  .digest();

const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

const fromB64url = (str) =>
  Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

const sign = (payloadB64) =>
  b64url(crypto.createHmac('sha256', QUOTE_SECRET).update(payloadB64).digest());

/**
 * Build a quote token from a quote payload. Numbers are rounded to 2dp so
 * floating-point reformatting on the JSON round-trip can't trip equality.
 */
const issueQuoteToken = ({
  type,
  merchantId,
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  subtotal,
  deliveryFee,
  platformFee,
  tax,
  total,
  distanceKm,
  estimatedMinutes,
}) => {
  const expiresAt = Date.now() + QUOTE_TTL_MS;
  const round2 = (n) => Math.round(Number(n) * 100) / 100;
  const round4 = (n) => Math.round(Number(n) * 10000) / 10000;

  const payload = {
    v: 1,
    type: type || null,
    merchantId: merchantId || null,
    pickupLat: round4(pickupLat),
    pickupLng: round4(pickupLng),
    dropoffLat: round4(dropoffLat),
    dropoffLng: round4(dropoffLng),
    subtotal: round2(subtotal),
    deliveryFee: round2(deliveryFee),
    platformFee: round2(platformFee),
    tax: round2(tax),
    total: round2(total),
    distanceKm: round2(distanceKm),
    estimatedMinutes: Math.round(estimatedMinutes),
    exp: expiresAt,
  };

  const payloadB64 = b64url(JSON.stringify(payload));
  const sig = sign(payloadB64);
  return {
    token: `${payloadB64}.${sig}`,
    expiresAt,
  };
};

/**
 * Verify a token's signature and TTL. Returns the payload on success, or
 * throws an Error with .code in { 'INVALID', 'EXPIRED' }.
 */
const verifyQuoteToken = (token) => {
  if (typeof token !== 'string' || !token.includes('.')) {
    const err = new Error('Invalid quote token format');
    err.code = 'INVALID';
    throw err;
  }
  const [payloadB64, sig] = token.split('.');
  const expected = sign(payloadB64);
  // Constant-time equality
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    const err = new Error('Quote token signature invalid');
    err.code = 'INVALID';
    throw err;
  }
  let payload;
  try {
    payload = JSON.parse(fromB64url(payloadB64).toString('utf8'));
  } catch (_) {
    const err = new Error('Quote token payload malformed');
    err.code = 'INVALID';
    throw err;
  }
  if (typeof payload.exp !== 'number' || payload.exp < Date.now()) {
    const err = new Error('Quote expired - please request a fresh quote');
    err.code = 'EXPIRED';
    throw err;
  }
  return payload;
};

// ============================================================
// Cancellation-fee token
//
// Mirrors the quote-token pattern, but binds the customer + request + fee
// for a short window so the fee shown in /cancel-quote can't drift between
// preview and the actual DELETE call (e.g. an admin changing
// `delivery.cancellationFee` mid-flight).
// ============================================================

const CANCEL_FEE_TTL_MS = 5 * 60 * 1000;
const CANCEL_SECRET = crypto
  .createHash('sha256')
  .update(`cancel-fee-token.v1|${config.JWT_ACCESS_SECRET}`)
  .digest();

const signCancel = (payloadB64) =>
  b64url(crypto.createHmac('sha256', CANCEL_SECRET).update(payloadB64).digest());

const issueCancellationFeeToken = ({ requestId, customerId, fee, status }) => {
  const round2 = (n) => Math.round(Number(n) * 100) / 100;
  const payload = {
    v: 1,
    requestId,
    customerId,
    fee: round2(fee),
    status,
    exp: Date.now() + CANCEL_FEE_TTL_MS,
  };
  const payloadB64 = b64url(JSON.stringify(payload));
  return `${payloadB64}.${signCancel(payloadB64)}`;
};

const verifyCancellationFeeToken = (token) => {
  if (typeof token !== 'string' || !token.includes('.')) {
    const err = new Error('Invalid cancellation token');
    err.code = 'INVALID';
    throw err;
  }
  const [payloadB64, sig] = token.split('.');
  const expected = signCancel(payloadB64);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    const err = new Error('Cancellation token signature invalid');
    err.code = 'INVALID';
    throw err;
  }
  let payload;
  try {
    payload = JSON.parse(fromB64url(payloadB64).toString('utf8'));
  } catch (_) {
    const err = new Error('Cancellation token payload malformed');
    err.code = 'INVALID';
    throw err;
  }
  if (typeof payload.exp !== 'number' || payload.exp < Date.now()) {
    const err = new Error('Cancellation preview expired - please re-open the cancellation prompt');
    err.code = 'EXPIRED';
    throw err;
  }
  return payload;
};

module.exports = {
  issueQuoteToken,
  verifyQuoteToken,
  QUOTE_TTL_MS,
  issueCancellationFeeToken,
  verifyCancellationFeeToken,
  CANCEL_FEE_TTL_MS,
};

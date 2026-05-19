/**
 * quote-validity — Phase 4 deferred spec.
 *
 * Verifies the HMAC-signed quote token:
 *   - round-trips: issued → verified payload matches input numbers (modulo
 *     the 2dp / 4dp rounding rules baked into issueQuoteToken)
 *   - rejects tampered payloads (signature invalid)
 *   - rejects forged tokens with a different secret
 *   - rejects expired tokens (TTL window enforced)
 *   - rejects malformed wire format
 *
 * Run with: node --test tests/quote-validity.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

const stubModule = (filename, exports) => {
  const mod = new Module(filename);
  mod.filename = filename;
  mod.loaded = true;
  mod.exports = exports;
  require.cache[filename] = mod;
};

stubModule(path.resolve(__dirname, '../src/config/index.js'), {
  config: { JWT_ACCESS_SECRET: 'test-jwt-access-secret-for-quote-tests' },
});

const { issueQuoteToken, verifyQuoteToken, QUOTE_TTL_MS } = require('../src/utils/quote-token');

const baseInput = () => ({
  type: 'FOOD',
  merchantId: 'm-1',
  pickupLat: 13.0059,
  pickupLng: 7.6019,
  dropoffLat: 13.0100,
  dropoffLng: 7.6050,
  subtotal: 1500,
  deliveryFee: 530,
  platformFee: 225,
  tax: 0,
  total: 2255,
  distanceKm: 5.3,
  estimatedMinutes: 14,
});

// --- happy path ---

test('issueQuoteToken: returns token + expiresAt; expiresAt ≈ now+5min', async () => {
  const before = Date.now();
  const out = issueQuoteToken(baseInput());
  const after = Date.now();
  assert.ok(out.token.includes('.'), 'token must be payload.sig');
  assert.ok(out.expiresAt >= before + QUOTE_TTL_MS - 50);
  assert.ok(out.expiresAt <= after + QUOTE_TTL_MS + 50);
});

test('verifyQuoteToken: round-trip preserves the locked pricing numbers', async () => {
  const input = baseInput();
  const { token } = issueQuoteToken(input);
  const payload = verifyQuoteToken(token);
  assert.equal(payload.subtotal, 1500);
  assert.equal(payload.deliveryFee, 530);
  assert.equal(payload.platformFee, 225);
  assert.equal(payload.total, 2255);
  assert.equal(payload.distanceKm, 5.3);
  assert.equal(payload.estimatedMinutes, 14);
});

test('verifyQuoteToken: numeric rounding policy — 2dp on money, 4dp on lat/lng', async () => {
  const { token } = issueQuoteToken({
    ...baseInput(),
    subtotal: 1500.005,
    pickupLat: 13.00591234,
    pickupLng: 7.60195678,
    estimatedMinutes: 12.7,
  });
  const payload = verifyQuoteToken(token);
  assert.equal(payload.subtotal, 1500.01, '2dp rounding applied to money');
  assert.equal(payload.pickupLat, 13.0059, '4dp rounding applied to coords');
  assert.equal(payload.pickupLng, 7.602, '4dp rounding applied to coords');
  assert.equal(payload.estimatedMinutes, 13, 'estimatedMinutes is integer-rounded');
});

// --- INVALID ---

test('verifyQuoteToken: rejects token with no `.` separator', async () => {
  assert.throws(
    () => verifyQuoteToken('not-a-real-token'),
    (err) => err.code === 'INVALID',
  );
});

test('verifyQuoteToken: rejects token with tampered payload', async () => {
  const { token } = issueQuoteToken(baseInput());
  const [payloadB64, sig] = token.split('.');
  // Flip a character in the payload to invalidate the signature
  const tampered = payloadB64.slice(0, -1) + (payloadB64.at(-1) === 'A' ? 'B' : 'A');
  assert.throws(
    () => verifyQuoteToken(`${tampered}.${sig}`),
    (err) => err.code === 'INVALID',
  );
});

test('verifyQuoteToken: rejects token with tampered signature', async () => {
  const { token } = issueQuoteToken(baseInput());
  const [payloadB64, sig] = token.split('.');
  const flipped = sig.slice(0, -2) + 'XX';
  assert.throws(
    () => verifyQuoteToken(`${payloadB64}.${flipped}`),
    (err) => err.code === 'INVALID',
  );
});

test('verifyQuoteToken: rejects a forged token signed with the wrong secret', async () => {
  // Issue with the right secret, then mint a parallel "forgery" by
  // re-loading quote-token.js under a swapped config and asserting cross-talk
  // is blocked. Easiest: just hand-sign with HMAC + a different key.
  const crypto = require('crypto');
  const wrongSecret = crypto.createHash('sha256').update('different-secret').digest();
  const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payload = { v: 1, exp: Date.now() + 60000, subtotal: 999 };
  const payloadB64 = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac('sha256', wrongSecret).update(payloadB64).digest());
  const forged = `${payloadB64}.${sig}`;
  assert.throws(
    () => verifyQuoteToken(forged),
    (err) => err.code === 'INVALID',
  );
});

// --- EXPIRED ---

test('verifyQuoteToken: rejects an expired token with code=EXPIRED', async () => {
  // Hand-roll an expired token using the same scheme so we don't have to wait.
  // We mirror the production format byte-for-byte and re-sign with the same
  // domain-separated secret quote-token.js uses.
  const crypto = require('crypto');
  const { config } = require('../src/config');
  const secret = crypto.createHash('sha256').update(`quote-token.v1|${config.JWT_ACCESS_SECRET}`).digest();
  const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payload = {
    v: 1, type: 'FOOD', merchantId: 'm', pickupLat: 13, pickupLng: 7, dropoffLat: 13, dropoffLng: 7,
    subtotal: 1500, deliveryFee: 500, platformFee: 100, tax: 0, total: 2100, distanceKm: 5,
    estimatedMinutes: 10,
    exp: Date.now() - 1000, // already expired
  };
  const payloadB64 = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac('sha256', secret).update(payloadB64).digest());
  const expired = `${payloadB64}.${sig}`;
  assert.throws(
    () => verifyQuoteToken(expired),
    (err) => err.code === 'EXPIRED',
  );
});

test('verifyQuoteToken: malformed JSON inside a valid signature is INVALID, not EXPIRED', async () => {
  const crypto = require('crypto');
  const { config } = require('../src/config');
  const secret = crypto.createHash('sha256').update(`quote-token.v1|${config.JWT_ACCESS_SECRET}`).digest();
  const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  // Not valid JSON, but properly signed
  const payloadB64 = b64url(Buffer.from('not-json'));
  const sig = b64url(crypto.createHmac('sha256', secret).update(payloadB64).digest());
  const bad = `${payloadB64}.${sig}`;
  assert.throws(
    () => verifyQuoteToken(bad),
    (err) => err.code === 'INVALID',
  );
});

test('verifyQuoteToken: rejects non-string input', async () => {
  assert.throws(() => verifyQuoteToken(null), (err) => err.code === 'INVALID');
  assert.throws(() => verifyQuoteToken(42), (err) => err.code === 'INVALID');
  assert.throws(() => verifyQuoteToken({}), (err) => err.code === 'INVALID');
});

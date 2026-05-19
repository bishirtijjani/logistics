/**
 * cancellation-fee — Phase 4 deferred spec.
 *
 * Covers:
 *   - Cancellation-fee token issuance + verification round-trip
 *   - Tamper / forge / expire rejection paths (domain-separated from quote tok)
 *   - The transition map: REQUESTED..RIDER_EN_ROUTE can cancel; PICKED_UP and
 *     beyond cannot. Customer-facing cancellation pricing tiers are validated
 *     at the transition-policy level here; the actual fee values live in
 *     platform settings (already covered by settings.test.js).
 *
 * Run with: node --test tests/cancellation-fee.test.js
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
  config: { JWT_ACCESS_SECRET: 'test-jwt-access-secret-for-cancel-tests' },
});

const {
  issueCancellationFeeToken,
  verifyCancellationFeeToken,
  CANCEL_FEE_TTL_MS,
} = require('../src/utils/quote-token');

const { STATUS, canTransition, TRANSITIONS } = require('../src/utils/status');

// --- Token round-trip ---

test('issueCancellationFeeToken: round-trip preserves requestId, customerId, fee, status', async () => {
  const token = issueCancellationFeeToken({
    requestId: 'req-1', customerId: 'cust-1', fee: 200, status: STATUS.ACCEPTED,
  });
  const payload = verifyCancellationFeeToken(token);
  assert.equal(payload.requestId, 'req-1');
  assert.equal(payload.customerId, 'cust-1');
  assert.equal(payload.fee, 200);
  assert.equal(payload.status, STATUS.ACCEPTED);
});

test('issueCancellationFeeToken: 2dp rounding applied to fee', async () => {
  const token = issueCancellationFeeToken({
    requestId: 'r', customerId: 'c', fee: 199.995, status: STATUS.REQUESTED,
  });
  const payload = verifyCancellationFeeToken(token);
  assert.equal(payload.fee, 200);
});

test('issueCancellationFeeToken: payload carries exp ≈ now + 5min', async () => {
  const before = Date.now();
  const token = issueCancellationFeeToken({ requestId: 'r', customerId: 'c', fee: 0, status: STATUS.REQUESTED });
  const payload = verifyCancellationFeeToken(token);
  const after = Date.now();
  assert.ok(payload.exp >= before + CANCEL_FEE_TTL_MS - 50);
  assert.ok(payload.exp <= after + CANCEL_FEE_TTL_MS + 50);
});

// --- Tamper / forge / expire ---

test('verifyCancellationFeeToken: rejects tampered payload (signature invalid)', async () => {
  const token = issueCancellationFeeToken({ requestId: 'r', customerId: 'c', fee: 200, status: STATUS.ACCEPTED });
  const [payloadB64, sig] = token.split('.');
  const tampered = payloadB64.slice(0, -1) + (payloadB64.at(-1) === 'A' ? 'B' : 'A');
  assert.throws(
    () => verifyCancellationFeeToken(`${tampered}.${sig}`),
    (err) => err.code === 'INVALID',
  );
});

test('verifyCancellationFeeToken: rejects no-`.`-separator garbage', async () => {
  assert.throws(
    () => verifyCancellationFeeToken('garbage'),
    (err) => err.code === 'INVALID',
  );
});

test('verifyCancellationFeeToken: rejects an expired token with code=EXPIRED', async () => {
  const crypto = require('crypto');
  const { config } = require('../src/config');
  const secret = crypto.createHash('sha256').update(`cancel-fee-token.v1|${config.JWT_ACCESS_SECRET}`).digest();
  const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payload = { v: 1, requestId: 'r', customerId: 'c', fee: 200, status: STATUS.ACCEPTED, exp: Date.now() - 1000 };
  const payloadB64 = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac('sha256', secret).update(payloadB64).digest());
  assert.throws(
    () => verifyCancellationFeeToken(`${payloadB64}.${sig}`),
    (err) => err.code === 'EXPIRED',
  );
});

test('verifyCancellationFeeToken: domain-separated from quote tokens (cross-token forgery blocked)', async () => {
  // A token signed for one domain (quote) must NOT validate against the
  // cancel-fee verifier. This is the whole point of having distinct
  // domain-separated secrets.
  const { issueQuoteToken } = require('../src/utils/quote-token');
  const { token: quoteToken } = issueQuoteToken({
    type: 'FOOD', merchantId: 'm', pickupLat: 13, pickupLng: 7, dropoffLat: 13, dropoffLng: 7,
    subtotal: 1500, deliveryFee: 500, platformFee: 100, tax: 0, total: 2100, distanceKm: 5, estimatedMinutes: 10,
  });
  assert.throws(
    () => verifyCancellationFeeToken(quoteToken),
    (err) => err.code === 'INVALID',
  );
});

// --- Lifecycle policy ---

test('cancellation allowed: REQUESTED → CANCELLED', () => {
  assert.equal(canTransition(STATUS.REQUESTED, STATUS.CANCELLED), true);
});

test('cancellation allowed: ACCEPTED → CANCELLED', () => {
  assert.equal(canTransition(STATUS.ACCEPTED, STATUS.CANCELLED), true);
});

test('cancellation allowed: PROCESSING → CANCELLED', () => {
  assert.equal(canTransition(STATUS.PROCESSING, STATUS.CANCELLED), true);
});

test('cancellation allowed: READY_FOR_PICKUP → CANCELLED', () => {
  assert.equal(canTransition(STATUS.READY_FOR_PICKUP, STATUS.CANCELLED), true);
});

test('cancellation allowed: RIDER_ASSIGNED → CANCELLED', () => {
  assert.equal(canTransition(STATUS.RIDER_ASSIGNED, STATUS.CANCELLED), true);
});

test('cancellation allowed: RIDER_EN_ROUTE → CANCELLED', () => {
  assert.equal(canTransition(STATUS.RIDER_EN_ROUTE, STATUS.CANCELLED), true);
});

test('cancellation FORBIDDEN after pickup: PICKED_UP cannot transition to CANCELLED', () => {
  assert.equal(canTransition(STATUS.PICKED_UP, STATUS.CANCELLED), false);
});

test('cancellation FORBIDDEN: IN_TRANSIT cannot transition to CANCELLED', () => {
  assert.equal(canTransition(STATUS.IN_TRANSIT, STATUS.CANCELLED), false);
});

test('cancellation FORBIDDEN: DELIVERED cannot transition to CANCELLED', () => {
  assert.equal(canTransition(STATUS.DELIVERED, STATUS.CANCELLED), false);
});

test('cancellation FORBIDDEN: SETTLED cannot transition to CANCELLED', () => {
  assert.equal(canTransition(STATUS.SETTLED, STATUS.CANCELLED), false);
});

test('once CANCELLED there is no further transition', () => {
  assert.deepEqual(TRANSITIONS[STATUS.CANCELLED], []);
});

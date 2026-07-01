/**
 * Phase 7 - utility-refund money-path test.
 *
 * Verifies:
 *   - When a provider returns a definitive `failed` status, the worker marks the
 *     UtilityPayment as FAILED, credits the wallet back the EXACT amount, and
 *     creates a REFUND transaction row - all in a single Prisma transaction.
 *   - Polling-window-exhausted path is provider-aware: a re-queryable provider
 *     (AlRahuz) auto-refunds, but a provider we CANNOT re-query (BilalSada) is
 *     HELD for manual review — never auto-refunded, since the vend may have
 *     completed and refunding would double-pay.
 *
 * Run with: node --test tests/utility-refund.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { installUtilityStubs } = require('./_utility-stubs');
const stubs = installUtilityStubs();

// Now require the worker - its imports resolve to the stubs we just installed.
const { _internal } = require('../src/queues/workers/utility.worker');
const { POLL_CONFIG } = require('../src/queues/jobs');

const seedPayment = ({ status = 'PROCESSING', type = 'AIRTIME', pollAttempts = 0, amount = 500 } = {}) => {
  stubs.state.payment = {
    id: 'pay1', userId: 'u1', amount, type,
    biller: 'MTN', phoneNumber: '08012345678', meterNumber: null,
    status, providerRequestId: 'AIR-1', transactionId: 'AIR-1', pollAttempts,
    token: null, beneficiaryName: null,
  };
  stubs.state.wallet.balance = 0; // post-deduct
  stubs.state.transactions = [{ reference: 'AIR-1', status: 'PROCESSING', type: 'UTILITY_PAYMENT' }];
};

test('utility-refund: definitive AlRahuz failure refunds wallet to the kobo', async () => {
  seedPayment({ amount: 500 });
  stubs.calls.push.length = 0;

  await _internal.handleResult(
    { Status: 'failed', api_response: 'Transaction Failed' },
    { paymentId: 'pay1', userId: 'u1', amount: 500, reference: 'AIR-1', type: 'AIRTIME' },
  );

  assert.equal(stubs.state.payment.status, 'REFUNDED', 'payment row must end REFUNDED');
  assert.equal(stubs.state.wallet.balance, 500, 'wallet must be credited the exact amount');
  const refundRow = stubs.state.transactions.find((t) => t.type === 'REFUND');
  assert.ok(refundRow, 'a REFUND transaction must be created');
  assert.equal(refundRow.amount, 500);
  assert.equal(refundRow.reference, 'REFUND-AIR-1');
  // User must be notified about the refund
  assert.ok(stubs.calls.push.some((c) => c.kind === 'REFUND'), 'user must be notified of REFUND');
});

test('utility-refund: exhausted window on a NON-requeryable provider HOLDS for review (no refund)', async () => {
  // Default provider is BilalSada (canRequery:false). An exhausted poll window
  // means we never confirmed the vend — it may have completed — so the payment
  // must be HELD, not refunded (the bug that lost ₦40k).
  seedPayment({ amount: 1000, pollAttempts: POLL_CONFIG.MAX_ATTEMPTS });
  stubs.calls.push.length = 0;
  stubs.calls.emails.length = 0;

  await _internal.handleResult(
    { Status: 'pending' },
    { paymentId: 'pay1', userId: 'u1', amount: 1000, reference: 'AIR-1', type: 'AIRTIME' },
  );

  assert.equal(stubs.state.payment.status, 'UNDER_REVIEW', 'must hold, not refund');
  assert.equal(stubs.state.wallet.balance, 0, 'customer must NOT be refunded for a maybe-completed vend');
  assert.equal(stubs.calls.emails.length, 1, 'an operator alert email must be sent');
});

test('utility-refund: exhausted window on a re-queryable provider (AlRahuz) auto-refunds', async () => {
  seedPayment({ amount: 1000, pollAttempts: POLL_CONFIG.MAX_ATTEMPTS });
  stubs.calls.push.length = 0;

  await _internal.handleResult(
    { Status: 'pending' },
    { paymentId: 'pay1', userId: 'u1', amount: 1000, reference: 'AIR-1', type: 'AIRTIME', provider: 'ALRAHUZ' },
  );

  assert.equal(stubs.state.payment.status, 'REFUNDED', 'requeryable provider still auto-refunds');
  assert.equal(stubs.state.wallet.balance, 1000);
});

test('utility-refund: pending within window schedules a poll (no refund)', async () => {
  seedPayment({ amount: 500, pollAttempts: 0 });
  stubs.calls.polls.length = 0;

  await _internal.handleResult(
    { Status: 'pending', id: 'ALR-42' },
    { paymentId: 'pay1', userId: 'u1', amount: 500, reference: 'AIR-1', type: 'AIRTIME' },
  );

  assert.equal(stubs.state.payment.status, 'PENDING');
  assert.equal(stubs.state.payment.pollAttempts, 1);
  assert.equal(stubs.state.wallet.balance, 0, 'no premature refund');
  assert.equal(stubs.calls.polls.length, 1, 'one poll job scheduled');
  assert.equal(stubs.calls.polls[0].delay, POLL_CONFIG.INTERVAL_MS);
});

test('utility-refund: refund is idempotent (running twice does not double-credit)', async () => {
  seedPayment({ amount: 500 });

  await _internal.refundPayment({ paymentId: 'pay1', userId: 'u1', amount: 500, reference: 'AIR-1' });
  await _internal.refundPayment({ paymentId: 'pay1', userId: 'u1', amount: 500, reference: 'AIR-1' });

  assert.equal(stubs.state.wallet.balance, 500, 'second refund must be a no-op');
  assert.equal(stubs.state.payment.status, 'REFUNDED');
});

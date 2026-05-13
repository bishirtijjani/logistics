/**
 * Phase 7 — utility-idempotency money-path test.
 *
 * Verifies the worker is idempotent on the AlRahuz response:
 *   - Calling handleResult twice with the same `success` response does not
 *     double-mark or double-credit anything. The settled-status guard means
 *     the second call is a no-op at the worker entry; here we exercise
 *     handleResult directly to assert the underlying writes stay consistent.
 *   - Refund replay does not double-credit (the refundPayment transaction
 *     short-circuits when status is already REFUNDED).
 *   - Once a payment is in a settled status, the worker entry-points
 *     (processAirtime / processPoll) skip the AlRahuz call entirely.
 *
 * Run with: node --test tests/utility-idempotency.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { installUtilityStubs } = require('./_utility-stubs');
const stubs = installUtilityStubs();

const { _internal } = require('../src/queues/workers/utility.worker');

const seedPayment = (overrides = {}) => {
  stubs.state.payment = {
    id: 'pay1', userId: 'u1', amount: 500, type: 'AIRTIME',
    biller: 'MTN', phoneNumber: '08012345678', meterNumber: null,
    status: 'PROCESSING', providerRequestId: 'AIR-1', transactionId: 'AIR-1',
    pollAttempts: 0, token: null, beneficiaryName: null,
    ...overrides,
  };
  stubs.state.wallet.balance = 0;
  stubs.state.transactions = [{ reference: 'AIR-1', status: 'PROCESSING', type: 'UTILITY_PAYMENT' }];
};

test('utility-idempotency: replaying a success response does not double-credit', async () => {
  seedPayment();
  const successResp = { Status: 'successful', id: 'ALR-1' };
  const ctx = { paymentId: 'pay1', userId: 'u1', amount: 500, reference: 'AIR-1', type: 'AIRTIME' };

  await _internal.handleResult(successResp, ctx);
  const balanceAfterFirst = stubs.state.wallet.balance;
  const statusAfterFirst = stubs.state.payment.status;

  await _internal.handleResult(successResp, ctx);
  assert.equal(stubs.state.payment.status, statusAfterFirst, 'status stable across replays');
  assert.equal(stubs.state.wallet.balance, balanceAfterFirst, 'wallet stable across replays');
  // For an AIRTIME success, no refund branch fires → wallet stays at deducted state.
  assert.equal(stubs.state.payment.status, 'COMPLETED');
});

test('utility-idempotency: replaying a refund does not credit twice', async () => {
  seedPayment();

  await _internal.refundPayment({ paymentId: 'pay1', userId: 'u1', amount: 500, reference: 'AIR-1' });
  assert.equal(stubs.state.wallet.balance, 500);
  assert.equal(stubs.state.payment.status, 'REFUNDED');

  await _internal.refundPayment({ paymentId: 'pay1', userId: 'u1', amount: 500, reference: 'AIR-1' });
  assert.equal(stubs.state.wallet.balance, 500, 'no second credit on replay');

  // Refund transaction should exist exactly once
  const refunds = stubs.state.transactions.filter((t) => t.type === 'REFUND');
  assert.equal(refunds.length, 1, 'exactly one REFUND row');
});

test('utility-idempotency: settled-status skips poll worker', async () => {
  // If a poll job fires after the payment already COMPLETED (e.g. socket
  // event landed first), processPoll must NOT touch AlRahuz or the wallet.
  seedPayment({ status: 'COMPLETED' });
  const before = { ...stubs.state.payment };

  await _internal.processPoll({
    paymentId: 'pay1',
    userId: 'u1',
    reference: 'AIR-1',
    providerRequestId: 'AIR-1',
  });

  assert.deepEqual(stubs.state.payment, before, 'settled payment must not be mutated by poll');
  assert.equal(stubs.state.wallet.balance, 0, 'no spurious refund');
});

test('utility-idempotency: replaying a failure response does not double-refund', async () => {
  seedPayment();
  const failResp = { Status: 'failed' };
  const ctx = { paymentId: 'pay1', userId: 'u1', amount: 500, reference: 'AIR-1', type: 'AIRTIME' };

  await _internal.handleResult(failResp, ctx);
  assert.equal(stubs.state.payment.status, 'REFUNDED');
  assert.equal(stubs.state.wallet.balance, 500);

  // Second invocation — payment is already REFUNDED so the refund's tx-level
  // guard short-circuits.
  await _internal.handleResult(failResp, ctx);
  assert.equal(stubs.state.wallet.balance, 500, 'no double refund on replay');
});

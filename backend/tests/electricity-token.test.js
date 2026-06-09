/**
 * Phase 7 - electricity-token money-path test.
 *
 * Verifies:
 *   - A `delivered` AlRahuz electricity response persists the token on the
 *     UtilityPayment row.
 *   - A user-facing notification (push + Notification Center) is emitted via
 *     notify.pushAndSocket.
 *   - An SMS containing the token is dispatched via termii.sendSms.
 *   - The token is retrievable via the same row lookup history uses.
 *
 * Run with: node --test tests/electricity-token.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { installUtilityStubs } = require('./_utility-stubs');
const stubs = installUtilityStubs();

const { _internal } = require('../src/queues/workers/utility.worker');

const seedElectricityPayment = () => {
  stubs.state.payment = {
    id: 'pay-elec', userId: 'u1', amount: 5000, type: 'ELECTRICITY',
    biller: 'IKEDC', phoneNumber: '08012345678', meterNumber: '1234567890123',
    status: 'PROCESSING', providerRequestId: 'ELEC-1', transactionId: 'ELEC-1',
    pollAttempts: 0, token: null, beneficiaryName: null,
  };
  stubs.state.wallet.balance = 0;
  stubs.state.transactions = [{ reference: 'ELEC-1', status: 'PROCESSING', type: 'UTILITY_PAYMENT' }];
};

test('electricity-token: delivered response persists token + emits push + SMS', async () => {
  seedElectricityPayment();
  stubs.calls.push.length = 0;
  stubs.calls.sms.length = 0;

  const deliveredResponse = {
    Status: 'delivered',
    id: 'ALR-99',
    purchased_token: '0123-4567-8901-2345-6789',
    Customer_Name: 'JOHN DOE',
  };

  await _internal.handleResult(deliveredResponse, {
    paymentId: 'pay-elec',
    userId: 'u1',
    amount: 5000,
    reference: 'ELEC-1',
    type: 'ELECTRICITY',
  });

  // Token persisted
  assert.equal(stubs.state.payment.status, 'COMPLETED');
  assert.equal(stubs.state.payment.token, '0123-4567-8901-2345-6789', 'token must be persisted');
  assert.equal(stubs.state.payment.beneficiaryName, 'JOHN DOE', 'meter holder captured');

  // Push notification emitted
  const push = stubs.calls.push.find((c) => c.title?.includes('token'));
  assert.ok(push, 'electricity token push must be emitted');
  assert.equal(push.userId, 'u1');
  assert.ok(String(push.body).includes('0123-4567-8901-2345-6789'), 'push body carries token');

  // SMS emitted with token
  assert.equal(stubs.calls.sms.length, 1, 'one SMS dispatched');
  const sms = stubs.calls.sms[0];
  assert.equal(sms.phone, '08012345678');
  assert.ok(sms.message.includes('0123-4567-8901-2345-6789'), 'SMS body carries token');
  assert.ok(sms.message.includes('1234567890123'), 'SMS body carries meter number for cross-check');

  // Retrievable from history (same lookup path)
  const row = await require('../src/config/database').prisma.utilityPayment.findUnique({ where: { id: 'pay-elec' } });
  assert.equal(row.token, '0123-4567-8901-2345-6789');
});

test('electricity-token: success without token still completes (postpaid case)', async () => {
  seedElectricityPayment();
  stubs.calls.sms.length = 0;

  await _internal.handleResult({ Status: 'successful', id: 'ALR-100' }, {
    paymentId: 'pay-elec',
    userId: 'u1',
    amount: 5000,
    reference: 'ELEC-1',
    type: 'ELECTRICITY',
  });

  assert.equal(stubs.state.payment.status, 'COMPLETED');
  assert.equal(stubs.state.payment.token, null);
  assert.equal(stubs.calls.sms.length, 0, 'no SMS when there is no token to deliver');
});

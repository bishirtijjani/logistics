/**
 * Secondary-provider failover money-path test.
 *
 * In "both" mode (BilalSada primary, AlRahuz secondary) a BilalSada purchase
 * that would otherwise be refunded is re-attempted on AlRahuz first - so we
 * don't lose the sale. Verifies:
 *   - Primary fail + secondary success → payment COMPLETED on AlRahuz, NO refund.
 *   - Primary fail + secondary fail → FAILED + wallet refunded (no double-try).
 *   - Single-provider mode (no secondary) still refunds on failure.
 *   - A plan with no AlRahuz IDs mapped can't fail over → refunds.
 *
 * Run with: node --test tests/utility-failover.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { installUtilityStubs } = require('./_utility-stubs');
const stubs = installUtilityStubs();

const { _internal, reconcileOnePayment } = require('../src/queues/workers/utility.worker');
const { POLL_CONFIG } = require('../src/queues/jobs');

const BOTH = { mode: 'BOTH', primary: 'BILALSADASUB', secondary: 'ALRAHUZ' };
const BILAL_ONLY = { mode: 'BILALSADASUB_ONLY', primary: 'BILALSADASUB', secondary: null };

const seed = ({ amount = 500 } = {}) => {
  stubs.state.payment = {
    id: 'pay1', userId: 'u1', amount, type: 'AIRTIME',
    biller: 'MTN', phoneNumber: '08012345678', meterNumber: null,
    status: 'PROCESSING', provider: 'BILALSADASUB',
    providerRequestId: 'AIR-1', transactionId: 'AIR-1', providerRef: null, pollAttempts: 0,
    token: null, beneficiaryName: null,
  };
  stubs.state.wallet.balance = 0; // post-deduct
  stubs.state.transactions = [{ reference: 'AIR-1', status: 'PROCESSING', type: 'UTILITY_PAYMENT' }];
  stubs.calls.buys = [];
  stubs.calls.push.length = 0;
};

const ctx = (providers) => ({
  paymentId: 'pay1', userId: 'u1', amount: 500, reference: 'AIR-1', type: 'AIRTIME',
  provider: 'BILALSADASUB',
  providers,
});

const BOTH_IDS = { BILALSADASUB: { networkId: 1 }, ALRAHUZ: { networkId: 4 } };

test('failover: primary fail → secondary success completes the sale (no refund)', async () => {
  seed();
  stubs.providerState.mode = BOTH;
  // BilalSada fails; AlRahuz succeeds.
  stubs.providerState.buyResponses = {
    BILALSADASUB: { status: 'fail' },
    ALRAHUZ: { Status: 'successful', id: 'ALR-99' },
  };

  await _internal.attemptPurchase(ctx(BOTH_IDS));

  assert.equal(stubs.state.payment.status, 'COMPLETED', 'sale must complete on AlRahuz');
  assert.equal(stubs.state.payment.provider, 'ALRAHUZ', 'payment must record AlRahuz served it');
  assert.equal(stubs.state.wallet.balance, 0, 'no refund - the sale was saved');
  assert.deepEqual(stubs.calls.buys.map((b) => b.key), ['BILALSADASUB', 'ALRAHUZ']);
});

test('failover: primary fail → secondary fail refunds exactly once', async () => {
  seed();
  stubs.providerState.mode = BOTH;
  stubs.providerState.buyResponses = {
    BILALSADASUB: { status: 'fail' },
    ALRAHUZ: { Status: 'failed' },
  };

  await _internal.attemptPurchase(ctx(BOTH_IDS));

  assert.equal(stubs.state.payment.status, 'REFUNDED', 'both failed → refund');
  assert.equal(stubs.state.wallet.balance, 500, 'wallet credited back once');
  // BilalSada then AlRahuz, no third attempt.
  assert.deepEqual(stubs.calls.buys.map((b) => b.key), ['BILALSADASUB', 'ALRAHUZ']);
});

test('failover: single-provider mode refunds on failure (no secondary)', async () => {
  seed();
  stubs.providerState.mode = BILAL_ONLY;
  stubs.providerState.buyResponses = { BILALSADASUB: { status: 'fail' } };

  await _internal.attemptPurchase(ctx({ BILALSADASUB: { networkId: 1 }, ALRAHUZ: null }));

  assert.equal(stubs.state.payment.status, 'REFUNDED');
  assert.equal(stubs.state.wallet.balance, 500);
  assert.deepEqual(stubs.calls.buys.map((b) => b.key), ['BILALSADASUB'], 'only the primary is tried');
});

test('failover: plan with no AlRahuz IDs cannot fail over → refunds', async () => {
  seed();
  stubs.providerState.mode = BOTH;
  stubs.providerState.buyResponses = { BILALSADASUB: { status: 'fail' } };

  // ALRAHUZ ids null - not mapped for this plan.
  await _internal.attemptPurchase(ctx({ BILALSADASUB: { networkId: 1 }, ALRAHUZ: null }));

  assert.equal(stubs.state.payment.status, 'REFUNDED');
  assert.equal(stubs.state.wallet.balance, 500);
  assert.deepEqual(stubs.calls.buys.map((b) => b.key), ['BILALSADASUB'], 'secondary not callable');
});

test('failover: reconcile of a payment stuck on primary fails over to AlRahuz', async () => {
  // Simulate a payment that exhausted BilalSada retries (infra) and is being
  // reconciled. The provider-ID map is persisted on the row, so reconcile can
  // still fail over rather than blindly refund.
  seed();
  stubs.state.payment.pollAttempts = POLL_CONFIG.MAX_ATTEMPTS; // next poll exhausts the window
  stubs.state.payment.providerIds = BOTH_IDS;                  // persisted at create time
  stubs.providerState.mode = BOTH;
  stubs.providerState.queryResponses = { BILALSADASUB: null }; // bilal has no query → pending → exhausted
  stubs.providerState.buyResponses = { ALRAHUZ: { Status: 'successful', id: 'ALR-1' } };

  await reconcileOnePayment('pay1');

  assert.equal(stubs.state.payment.status, 'COMPLETED', 'reconcile must rescue the sale on AlRahuz');
  assert.equal(stubs.state.payment.provider, 'ALRAHUZ');
  assert.equal(stubs.state.wallet.balance, 0, 'no refund - sale rescued');
  assert.ok(stubs.calls.buys.some((b) => b.key === 'ALRAHUZ' && b.type === 'AIRTIME'), 'AlRahuz airtime attempted');
});

test('failover: secondary AlRahuz pending schedules a poll (sale not yet lost)', async () => {
  seed();
  stubs.providerState.mode = BOTH;
  stubs.providerState.buyResponses = {
    BILALSADASUB: { status: 'fail' },
    ALRAHUZ: { status: 'pending', id: 'ALR-77' },
  };
  stubs.calls.polls.length = 0;

  await _internal.attemptPurchase(ctx(BOTH_IDS));

  assert.equal(stubs.state.payment.status, 'PENDING');
  assert.equal(stubs.state.payment.provider, 'ALRAHUZ');
  assert.equal(stubs.state.payment.providerRef, 'ALR-77', 'polls AlRahuz by its own txn id');
  assert.equal(stubs.state.wallet.balance, 0, 'no refund while pending');
  assert.equal(stubs.calls.polls.length, 1);
  assert.equal(stubs.calls.polls[0].data.provider, 'ALRAHUZ');
});

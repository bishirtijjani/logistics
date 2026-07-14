/**
 * Per-plan provider toggle tests.
 *
 * Admin can switch a single catalogue item off on one provider
 * (providerEnabled / altProviderEnabled) without touching the rest. A disabled
 * provider must behave EXACTLY like an unmapped one: its entry in the
 * per-purchase provider-ID map is null, so it's skipped for both the initial
 * vend and failover. Verifies:
 *   - _buildProviderIds nulls a provider whose toggle is off (and keeps legacy
 *     rows - flags undefined - fully enabled).
 *   - _resolveVendableProvider picks a live provider or rejects before debit.
 *   - The worker starts the live vend on the secondary (with primary/live retry
 *     semantics, NOT failover semantics) when the primary is off for that item.
 *
 * Run with: node --test tests/utility-provider-toggles.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { installUtilityStubs } = require('./_utility-stubs');
const stubs = installUtilityStubs();

const utilityService = require('../src/modules/utility/utility.service');
const { _internal: svc } = utilityService;
const { _internal: worker } = require('../src/queues/workers/utility.worker');

const BOTH = { mode: 'BOTH', primary: 'BILALSADASUB', secondary: 'ALRAHUZ' };
const BILAL_ONLY = { mode: 'BILALSADASUB_ONLY', primary: 'BILALSADASUB', secondary: null };
const ALRAHUZ_ONLY = { mode: 'ALRAHUZ_ONLY', primary: 'ALRAHUZ', secondary: null };

// ── _buildProviderIds: toggles null out a provider ──────────────────────────

test('buildProviderIds: legacy row (no flags) keeps both providers when mapped', () => {
  const map = svc._buildProviderIds('DATA', {
    providerNetworkId: 1, providerPlanId: 10,
    altProviderNetworkId: 4, altProviderPlanId: 40,
  });
  assert.deepEqual(map.BILALSADASUB, { networkId: 1, planId: 10 });
  assert.deepEqual(map.ALRAHUZ, { networkId: 4, planId: 40 });
});

test('buildProviderIds: altProviderEnabled=false nulls AlRahuz even when mapped', () => {
  const map = svc._buildProviderIds('DATA', {
    providerNetworkId: 1, providerPlanId: 10,
    altProviderNetworkId: 4, altProviderPlanId: 40,
    providerEnabled: true, altProviderEnabled: false,
  });
  assert.deepEqual(map.BILALSADASUB, { networkId: 1, planId: 10 });
  assert.equal(map.ALRAHUZ, null, 'AlRahuz disabled → cannot vend / fail over');
});

test('buildProviderIds: providerEnabled=false nulls BilalSada', () => {
  const map = svc._buildProviderIds('AIRTIME', {
    providerNetworkId: 1,
    altProviderNetworkId: 4,
    providerEnabled: false, altProviderEnabled: true,
  });
  assert.equal(map.BILALSADASUB, null, 'BilalSada disabled → skipped');
  assert.deepEqual(map.ALRAHUZ, { networkId: 4 });
});

test('buildProviderIds: an unmapped AlRahuz stays null regardless of its flag', () => {
  const map = svc._buildProviderIds('DATA', {
    providerNetworkId: 1, providerPlanId: 10,
    altProviderNetworkId: null, altProviderPlanId: null,
    altProviderEnabled: true,
  });
  assert.equal(map.ALRAHUZ, null);
});

// ── _resolveVendableProvider: pick a live provider or reject ─────────────────

test('resolveVendableProvider: uses primary when it can serve the item', async () => {
  stubs.providerState.mode = BOTH;
  const { provider } = await svc._resolveVendableProvider({
    BILALSADASUB: { networkId: 1 }, ALRAHUZ: { networkId: 4 },
  });
  assert.equal(provider, 'BILALSADASUB');
});

test('resolveVendableProvider: falls to secondary when primary is off for the item', async () => {
  stubs.providerState.mode = BOTH;
  const { provider } = await svc._resolveVendableProvider({
    BILALSADASUB: null, ALRAHUZ: { networkId: 4 },
  });
  assert.equal(provider, 'ALRAHUZ', 'primary disabled → secondary is the live vend');
});

test('resolveVendableProvider: rejects (pre-debit) when no provider can serve it', async () => {
  stubs.providerState.mode = BOTH;
  await assert.rejects(
    () => svc._resolveVendableProvider({ BILALSADASUB: null, ALRAHUZ: null }),
    /temporarily unavailable/i,
  );
});

test('resolveVendableProvider: single-provider mode with that provider off rejects', async () => {
  stubs.providerState.mode = BILAL_ONLY;
  await assert.rejects(
    () => svc._resolveVendableProvider({ BILALSADASUB: null, ALRAHUZ: { networkId: 4 } }),
    /temporarily unavailable/i,
    'AlRahuz is mapped but not in play under BILALSADASUB_ONLY',
  );
});

test('resolveVendableProvider: ALRAHUZ_ONLY uses AlRahuz as the primary', async () => {
  stubs.providerState.mode = ALRAHUZ_ONLY;
  const { provider } = await svc._resolveVendableProvider({
    BILALSADASUB: { networkId: 1 }, ALRAHUZ: { networkId: 4 },
  });
  assert.equal(provider, 'ALRAHUZ');
});

// ── Worker: primary off for an item → secondary is the LIVE vend ─────────────

const seedAirtime = () => {
  stubs.state.payment = {
    id: 'pay1', userId: 'u1', amount: 500, type: 'AIRTIME',
    biller: 'MTN', phoneNumber: '08012345678', meterNumber: null,
    status: 'PROCESSING', provider: 'ALRAHUZ',
    providerRequestId: 'AIR-1', transactionId: 'AIR-1', providerRef: null, pollAttempts: 0,
    token: null, beneficiaryName: null,
  };
  stubs.state.wallet.balance = 0; // post-deduct
  stubs.state.transactions = [{ reference: 'AIR-1', status: 'PROCESSING', type: 'UTILITY_PAYMENT' }];
  stubs.calls.buys = [];
};

// BilalSada disabled per-plan → its map entry is null. Under BOTH mode the vend
// must start on AlRahuz and, being the live attempt, complete normally.
const PRIMARY_OFF_IDS = { BILALSADASUB: null, ALRAHUZ: { networkId: 4 } };

test('worker: primary disabled for item → live vend runs on secondary and completes', async () => {
  seedAirtime();
  stubs.providerState.mode = BOTH;
  stubs.providerState.buyResponses = { ALRAHUZ: { Status: 'successful', id: 'ALR-1' } };

  await worker.processAirtime({
    paymentId: 'pay1', userId: 'u1', reference: 'AIR-1',
    providers: PRIMARY_OFF_IDS, phone: '08012345678', amount: 500,
  });

  assert.equal(stubs.state.payment.status, 'COMPLETED');
  assert.equal(stubs.state.payment.provider, 'ALRAHUZ');
  assert.equal(stubs.state.wallet.balance, 0, 'no refund - sale completed');
  assert.deepEqual(stubs.calls.buys.map((b) => b.key), ['ALRAHUZ'], 'BilalSada never called');
});

test('worker: secondary-as-live infra error propagates for retry (not refund)', async () => {
  seedAirtime();
  stubs.providerState.mode = BOTH;
  // A clean infra error on the live attempt must THROW so BullMQ retries
  // idempotently - the primary/live semantics, not a failover's refund.
  stubs.providerState.buyResponses = { ALRAHUZ: new Error('socket hang up') };

  await assert.rejects(
    () => worker.processAirtime({
      paymentId: 'pay1', userId: 'u1', reference: 'AIR-1',
      providers: PRIMARY_OFF_IDS, phone: '08012345678', amount: 500,
    }),
    /socket hang up/,
  );
  assert.equal(stubs.state.payment.status, 'PROCESSING', 'still processing - will retry');
  assert.equal(stubs.state.wallet.balance, 0, 'not refunded on a retryable live error');
});

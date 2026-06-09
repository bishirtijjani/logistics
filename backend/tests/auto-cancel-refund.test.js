/**
 * auto-cancel-refund - Phase 4 deferred spec.
 *
 * Two policies under test:
 *
 *   1) autoCancelUnmatched (worker):
 *      - No-op if request is missing
 *      - No-op if request status is not REQUESTED / READY_FOR_PICKUP
 *      - No-op if a rider was already assigned
 *      - Otherwise: marks request CANCELLED with `cancelledBy=system`,
 *        records cancellationReason, and enqueues REFUND_REQUEST
 *
 *   2) refundRequest (worker):
 *      - Refuses to refund a request that's not in CANCELLED state
 *      - Idempotent on retry: returns `alreadyRefunded:true` when
 *        `refundTransactionId` is already set
 *      - Refund math:
 *          feeApplied   = min(max(0, cancellationFee), customerPaid)
 *          refundAmount = max(0, customerPaid - feeApplied)
 *      - Restores variant stock on the resolved RequestItem
 *      - Returns rider availability ON_DELIVERY → ONLINE (not OFFLINE)
 *
 * Run with: node --test tests/auto-cancel-refund.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

const { makeAuthPrismaStub, makeRedisStub } = require('./_test-helpers');

const stubModule = (filename, exports) => {
  const mod = new Module(filename);
  mod.filename = filename;
  mod.loaded = true;
  mod.exports = exports;
  require.cache[filename] = mod;
};

const prismaStub = makeAuthPrismaStub();
const redisStub = makeRedisStub();
// Stub redis methods used by the worker but not present on the base stub.
redisStub.smembers = async () => [];
redisStub.del = async () => 1;

stubModule(path.resolve(__dirname, '../src/config/database.js'), { prisma: prismaStub });
stubModule(path.resolve(__dirname, '../src/config/redis.js'), { redis: redisStub });
stubModule(path.resolve(__dirname, '../src/config/index.js'), {
  config: { JWT_ACCESS_SECRET: 'test-secret', NODE_ENV: 'test' },
});
stubModule(path.resolve(__dirname, '../src/utils/logger.js'), {
  logger: { info() {}, warn() {}, error() {}, debug() {} },
});

// bullmq Worker is constructed inside startRequestWorker, so requiring the
// worker module is safe - but `__test` access still pulls in `getIO`,
// `notifyJobTaken` (uses redis.smembers), the request queue module, etc. Stub
// each one defensively.
stubModule(require.resolve('bullmq'), {
  Worker: class { constructor() {} on() {} },
  Queue: class { constructor() {} add() { enqueued.push([...arguments]); return Promise.resolve({}); } },
});

const enqueued = [];

stubModule(path.resolve(__dirname, '../src/sockets/index.js'), {
  getIO: () => ({ to: () => ({ emit() {} }) }),
});
stubModule(path.resolve(__dirname, '../src/sockets/events.js'), {
  RIDER: { JOB_TAKEN: 'rider:job:taken' },
  REQUEST: {},
  getUserRoom: (id) => `user:${id}`,
  getRequestRoom: (id) => `request:${id}`,
});
stubModule(path.resolve(__dirname, '../src/sockets/handlers/request.handler.js'), {
  emitCompleted() {},
  emitCancelled() {},
});
stubModule(path.resolve(__dirname, '../src/services/notify.service.js'), {
  balanceUpdated() {},
  onRequestStatusChanged: async () => {},
  onWalletEvent: async () => {},
});
stubModule(path.resolve(__dirname, '../src/services/settings.service.js'), {
  getSetting: async (key, fallback) => fallback,
});
// The worker lazy-requires `../index` (the queue bootstrap) at refund time
// to enqueue REFUND_REQUEST. Stub it so we can observe the enqueue call.
stubModule(path.resolve(__dirname, '../src/queues/index.js'), {
  requestQueue: {
    add: async (name, payload, opts) => {
      enqueued.push({ name, payload, opts });
      return { id: 'job-1' };
    },
  },
});

const { __test } = require('../src/queues/workers/request.worker');
const { autoCancelUnmatched, refundRequest } = __test;

const reset = () => {
  prismaStub.request._rows.clear();
  prismaStub.transaction._rows.clear();
  prismaStub.productVariant._rows.clear();
  prismaStub.rider._rows.clear();
  prismaStub.systemWallet._rows.clear();
  prismaStub.wallet._rows.clear();
  prismaStub.user._rows.clear();
  enqueued.length = 0;
  // Seed escrow + earnings system wallets so debits / credits don't blow up.
  prismaStub.systemWallet.seed([
    { id: 'PLATFORM_ESCROW', balance: 1_000_000 },
    { id: 'PLATFORM_EARNINGS', balance: 0 },
  ]);
};

// --- autoCancelUnmatched ---

test('autoCancelUnmatched: no-op when the request does not exist', async () => {
  reset();
  await autoCancelUnmatched({ data: { requestId: 'does-not-exist' } });
  assert.equal(enqueued.length, 0, 'must not enqueue a refund for missing request');
});

test('autoCancelUnmatched: no-op when status is past REQUESTED/READY_FOR_PICKUP', async () => {
  reset();
  await prismaStub.request.create({ data: { id: 'r1', status: 'PICKED_UP', customerId: 'c1' } });
  await autoCancelUnmatched({ data: { requestId: 'r1' } });
  assert.equal(prismaStub.request._rows.get('r1').status, 'PICKED_UP', 'status must not change');
  assert.equal(enqueued.length, 0);
});

test('autoCancelUnmatched: no-op when a rider has already been assigned', async () => {
  reset();
  await prismaStub.request.create({ data: { id: 'r1', status: 'REQUESTED', customerId: 'c1', riderId: 'rider-1' } });
  await autoCancelUnmatched({ data: { requestId: 'r1' } });
  assert.equal(prismaStub.request._rows.get('r1').status, 'REQUESTED');
  assert.equal(enqueued.length, 0);
});

test('autoCancelUnmatched: REQUESTED + no rider → marks CANCELLED, system, enqueues REFUND_REQUEST', async () => {
  reset();
  await prismaStub.request.create({ data: { id: 'r1', status: 'REQUESTED', customerId: 'c1', riderId: null } });
  await autoCancelUnmatched({ data: { requestId: 'r1', reason: 'No rider in 5min' } });

  const fresh = prismaStub.request._rows.get('r1');
  assert.equal(fresh.status, 'CANCELLED');
  assert.equal(fresh.cancelledBy, 'system');
  assert.equal(fresh.cancellationReason, 'No rider in 5min');
  assert.ok(fresh.cancelledAt instanceof Date);

  assert.equal(enqueued.length, 1);
  assert.equal(enqueued[0].name, 'refund-request');
  assert.deepEqual(enqueued[0].payload, { requestId: 'r1' });
});

test('autoCancelUnmatched: READY_FOR_PICKUP + no rider → same auto-cancel path', async () => {
  reset();
  await prismaStub.request.create({ data: { id: 'r2', status: 'READY_FOR_PICKUP', customerId: 'c1', riderId: null } });
  await autoCancelUnmatched({ data: { requestId: 'r2' } });
  assert.equal(prismaStub.request._rows.get('r2').status, 'CANCELLED');
  assert.equal(enqueued.length, 1);
});

test('autoCancelUnmatched: default reason when none supplied', async () => {
  reset();
  await prismaStub.request.create({ data: { id: 'r3', status: 'REQUESTED', customerId: 'c1' } });
  await autoCancelUnmatched({ data: { requestId: 'r3' } });
  assert.equal(prismaStub.request._rows.get('r3').cancellationReason, 'No rider available within timeout');
});

// --- refundRequest ---

const seedCancelledRequest = async ({ customerPaid, cancellationFee, refundTransactionId = null }) => {
  const wallet = await prismaStub.wallet.create({ data: { id: 'w1', userId: 'c1', balance: 5000 } });
  await prismaStub.user.create({
    data: { id: 'c1', email: 'c@x.com' },
  });
  // The wallet relation off `customer` is read directly in the worker, so the
  // findUnique on request needs to surface { customer: { wallet } }. Easiest
  // path: store the populated shape on the request stub row itself, since the
  // generic stub returns the stored object unchanged on findUnique.
  await prismaStub.request.create({
    data: {
      id: 'req-1',
      status: 'CANCELLED',
      customerId: 'c1',
      customer: { id: 'c1', wallet },
      items: [],
      rider: null,
      customerPaid,
      cancellationFee,
      escrowTransactionId: 'ESC-1',
      refundTransactionId,
    },
  });
  return wallet;
};

test('refundRequest: refuses to refund a request that is not CANCELLED', async () => {
  reset();
  await prismaStub.request.create({ data: { id: 'req-x', status: 'DELIVERED' } });
  await assert.rejects(
    () => refundRequest({ data: { requestId: 'req-x' } }),
    /not in CANCELLED state/,
  );
});

test('refundRequest: idempotent - returns alreadyRefunded:true when refundTransactionId already set', async () => {
  reset();
  await seedCancelledRequest({ customerPaid: 2000, cancellationFee: 0, refundTransactionId: 'PRIOR-REFUND-XYZ' });
  const result = await refundRequest({ data: { requestId: 'req-1' } });
  assert.equal(result.alreadyRefunded, true);
  assert.equal(result.refundAmount, 0);
  // No new transactions written on the no-op replay
  assert.equal([...prismaStub.transaction._rows.values()].length, 0);
});

test('refundRequest: zero cancellation fee → full refund to customer', async () => {
  reset();
  const w = await seedCancelledRequest({ customerPaid: 2000, cancellationFee: 0 });
  const result = await refundRequest({ data: { requestId: 'req-1' } });
  assert.equal(result.refundAmount, 2000);
  assert.equal(result.cancellationFee, 0);
  assert.equal(result.customerPaid, 2000);
  assert.equal(w.balance, 7000, 'customer wallet must be credited by full amount');
});

test('refundRequest: partial cancellation fee → refund net of fee, fee parked in PLATFORM_EARNINGS', async () => {
  reset();
  const w = await seedCancelledRequest({ customerPaid: 2000, cancellationFee: 200 });
  const result = await refundRequest({ data: { requestId: 'req-1' } });
  assert.equal(result.refundAmount, 1800);
  assert.equal(result.cancellationFee, 200);
  assert.equal(w.balance, 6800);
  // Escrow drained by full customerPaid; earnings credited by fee
  assert.equal(prismaStub.systemWallet._rows.get('PLATFORM_ESCROW').balance, 1_000_000 - 2000);
  assert.equal(prismaStub.systemWallet._rows.get('PLATFORM_EARNINGS').balance, 200);
});

test('refundRequest: fee exceeds customerPaid → fee capped at customerPaid, refund=0', async () => {
  reset();
  const w = await seedCancelledRequest({ customerPaid: 500, cancellationFee: 1000 });
  const result = await refundRequest({ data: { requestId: 'req-1' } });
  assert.equal(result.cancellationFee, 500, 'fee capped at customerPaid');
  assert.equal(result.refundAmount, 0);
  assert.equal(w.balance, 5000, 'wallet not credited when refundAmount=0');
  assert.equal(prismaStub.systemWallet._rows.get('PLATFORM_EARNINGS').balance, 500);
});

test('refundRequest: negative fee treated as zero (defensive)', async () => {
  reset();
  const w = await seedCancelledRequest({ customerPaid: 1000, cancellationFee: -50 });
  const result = await refundRequest({ data: { requestId: 'req-1' } });
  assert.equal(result.cancellationFee, 0);
  assert.equal(result.refundAmount, 1000);
  assert.equal(w.balance, 6000);
});

test('refundRequest: writes a customer-facing REFUND transaction with metadata', async () => {
  reset();
  await seedCancelledRequest({ customerPaid: 2000, cancellationFee: 200 });
  await refundRequest({ data: { requestId: 'req-1' } });
  const txns = [...prismaStub.transaction._rows.values()];
  const customerRefund = txns.find((t) => t.type === 'REFUND');
  assert.ok(customerRefund, 'must emit a REFUND transaction row for the customer');
  assert.equal(customerRefund.amount, 1800);
  assert.equal(customerRefund.fee, 200);
  assert.equal(customerRefund.metadata.requestId, 'req-1');
});

test('refundRequest: sets refundTransactionId on the request so the next replay is a no-op', async () => {
  reset();
  await seedCancelledRequest({ customerPaid: 1000, cancellationFee: 0 });
  await refundRequest({ data: { requestId: 'req-1' } });
  const fresh = prismaStub.request._rows.get('req-1');
  assert.ok(fresh.refundTransactionId, 'must record refundTransactionId for idempotency');

  // Second call returns alreadyRefunded
  const second = await refundRequest({ data: { requestId: 'req-1' } });
  assert.equal(second.alreadyRefunded, true);
});

test('refundRequest: restores stock on resolved variants when items had variantId', async () => {
  reset();
  await prismaStub.productVariant.create({ data: { id: 'v1', stock: 5, isAvailable: false } });
  const wallet = await prismaStub.wallet.create({ data: { id: 'w1', userId: 'c1', balance: 0 } });
  await prismaStub.request.create({
    data: {
      id: 'req-1',
      status: 'CANCELLED',
      customerId: 'c1',
      customer: { id: 'c1', wallet },
      items: [{ id: 'i1', variantId: 'v1', quantity: 3 }],
      customerPaid: 0,
      cancellationFee: 0,
      escrowTransactionId: null,
      refundTransactionId: null,
    },
  });
  await refundRequest({ data: { requestId: 'req-1' } });
  const fresh = prismaStub.productVariant._rows.get('v1');
  assert.equal(fresh.stock, 8, '5 + 3 restored');
  assert.equal(fresh.isAvailable, true);
});

test('refundRequest: rider on ON_DELIVERY is released back to ONLINE', async () => {
  reset();
  await prismaStub.rider.create({ data: { id: 'rider-1', availability: 'ON_DELIVERY' } });
  const wallet = await prismaStub.wallet.create({ data: { id: 'w1', userId: 'c1', balance: 0 } });
  await prismaStub.request.create({
    data: {
      id: 'req-1',
      status: 'CANCELLED',
      customerId: 'c1',
      customer: { id: 'c1', wallet },
      items: [],
      rider: { id: 'rider-1', availability: 'ON_DELIVERY' },
      customerPaid: 1000,
      cancellationFee: 0,
    },
  });
  await refundRequest({ data: { requestId: 'req-1' } });
  assert.equal(prismaStub.rider._rows.get('rider-1').availability, 'ONLINE');
});

test('refundRequest: rider on OFFLINE stays OFFLINE (not auto-unflipped)', async () => {
  reset();
  await prismaStub.rider.create({ data: { id: 'rider-1', availability: 'OFFLINE' } });
  const wallet = await prismaStub.wallet.create({ data: { id: 'w1', userId: 'c1', balance: 0 } });
  await prismaStub.request.create({
    data: {
      id: 'req-1',
      status: 'CANCELLED',
      customerId: 'c1',
      customer: { id: 'c1', wallet },
      items: [],
      rider: { id: 'rider-1', availability: 'OFFLINE' },
      customerPaid: 1000,
      cancellationFee: 0,
    },
  });
  await refundRequest({ data: { requestId: 'req-1' } });
  assert.equal(prismaStub.rider._rows.get('rider-1').availability, 'OFFLINE');
});

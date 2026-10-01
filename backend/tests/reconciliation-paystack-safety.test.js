/**
 * Reconciliation safety for Paystack withdrawals.
 *
 * The nightly sweep used to auto-refund any "stuck" withdrawal with no
 * providerRef. For Paystack that assumption is unsafe: a payout can have really
 * settled while the row lacks a reference (the reference-case bug), so refunding
 * pays the customer twice. settleStuckPaystackPayout must ask Paystack first and
 * only refund when the money demonstrably did not leave.
 *
 * Run with: node --test tests/reconciliation-paystack-safety.test.js
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
const stub = (rel, exports) => stubModule(path.resolve(__dirname, rel), exports);

// ─── mutable stubs ────────────────────────────────────────────────────────────

const state = {
  updateCount: 1,
  updateArgs: null,
  refunds: [],
  verifyImpl: null,
};

stub('../src/config/database.js', {
  prisma: {
    transaction: {
      async updateMany(args) {
        state.updateArgs = args;
        return { count: state.updateCount };
      },
    },
  },
});
stub('../src/config/redis.js', { redis: { async get() { return null; }, async set() { return 'OK'; }, async del() { return 1; }, async publish() { return 0; } } });
stub('../src/utils/logger.js', { logger: { info() {}, warn() {}, error() {}, debug() {} } });
stub('../src/services/settings.service.js', {
  getSetting: async (_k, d) => d,
  getSettings: async () => ({}),
  setSetting: async () => ({}),
  getAllSettings: async () => ({}),
});
stub('../src/services/withdrawal-refund.service.js', {
  refundFailedWithdrawal: async (args) => { state.refunds.push(args); return { refunded: true, total: 999 }; },
});
stub('../src/services/paystack.service.js', {
  toTransferReference: (reference) => {
    const cleaned = String(reference || '').toLowerCase().replace(/[^a-z0-9\-_]/g, '');
    return cleaned.length >= 16 ? cleaned.slice(0, 50) : `${cleaned}${'0'.repeat(16 - cleaned.length)}`.slice(0, 50);
  },
  verifyTransfer: async (ref) => state.verifyImpl(ref),
});

const { __test } = require('../src/services/reconciliation.service');
const { settleStuckPaystackPayout } = __test;

test.beforeEach(() => {
  state.updateCount = 1;
  state.updateArgs = null;
  state.refunds = [];
  state.verifyImpl = async (ref) => ({ reference: ref, status: 'success' });
});

const row = { reference: 'TRF-75d5652b-7264-4ae8-a6f9-9f193baa7155', provider: 'PAYSTACK', status: 'SENT', providerRef: null };

test('settle: verified success completes the payout and never refunds', async () => {
  const out = await settleStuckPaystackPayout(row);
  assert.equal(out, 'completed');
  assert.equal(state.refunds.length, 0);
  assert.equal(state.updateArgs.data.status, 'COMPLETED');
});

test('settle: verified reversed refunds the wallet', async () => {
  state.verifyImpl = async (ref) => ({ reference: ref, status: 'reversed' });
  const out = await settleStuckPaystackPayout(row);
  assert.equal(out.refunded, true);
  assert.equal(state.refunds.length, 1);
});

test('settle: verified failed is held (no refund)', async () => {
  state.verifyImpl = async (ref) => ({ reference: ref, status: 'failed' });
  const out = await settleStuckPaystackPayout(row);
  assert.equal(out, null);
  assert.equal(state.refunds.length, 0);
});

test('settle: 404 not-found (never dispatched) refunds safely', async () => {
  state.verifyImpl = async () => {
    const e = new Error('Failed to verify payout');
    e.notFound = true;
    e.providerStatus = 404;
    throw e;
  };
  const out = await settleStuckPaystackPayout(row);
  assert.equal(out.refunded, true);
  assert.equal(state.refunds.length, 1);
});

test('settle: transient verify error is left for a human (no refund)', async () => {
  state.verifyImpl = async () => {
    const e = new Error('Failed to verify payout');
    e.providerStatus = 500;
    throw e;
  };
  const out = await settleStuckPaystackPayout(row);
  assert.equal(out, null);
  assert.equal(state.refunds.length, 0);
});

test('settle: still pending is left for a human (no refund)', async () => {
  state.verifyImpl = async (ref) => ({ reference: ref, status: 'pending' });
  const out = await settleStuckPaystackPayout(row);
  assert.equal(out, null);
  assert.equal(state.refunds.length, 0);
});

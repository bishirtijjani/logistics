/**
 * Paystack webhook + reconcile tests - the money-safety surface of Slice 4.
 *
 * Covers:
 *   - controller: HMAC-SHA512 raw-body verification (401 on bad signature),
 *     event logging + 200 ACK, idempotent short-circuit for processed events;
 *   - worker: charge.success routing for DVA (receiver NUBAN / customer code /
 *     email) and checkout (metadata.userId), transfer.success completion,
 *     transfer.failed verified refund, and claim idempotency;
 *   - reconcile sweep: PENDING funding settle/fail and SENT payout
 *     complete/refund.
 *
 * All external calls are stubbed; no live provider traffic.
 *
 * Run with: node --test tests/paystack-webhook.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const crypto = require('node:crypto');

const stubModule = (filename, exports) => {
  const mod = new Module(filename);
  mod.filename = filename;
  mod.loaded = true;
  mod.exports = exports;
  require.cache[filename] = mod;
};
const stub = (rel, exports) => stubModule(path.resolve(__dirname, rel), exports);

const SECRET = 'sk_test_secret';

// ─── in-memory prisma ─────────────────────────────────────────────────────────

let seq = 0;
const webhookEvents = new Map();
const transactions = new Map();
const wallets = new Map();
const users = new Map();

const matches = (row, where) => {
  if (where.reference && row.reference !== where.reference) return false;
  if (where.status && row.status !== where.status) return false;
  if (where.provider && row.provider !== where.provider) return false;
  if (where.type && row.type !== where.type) return false;
  if (where.createdAt?.lt && !(row.createdAt < where.createdAt.lt)) return false;
  return true;
};

const prismaStub = {
  webhookEvent: {
    async findUnique({ where }) { return webhookEvents.get(where.transactionRef) || null; },
    async create({ data }) {
      const row = { id: `wh_${++seq}`, processed: false, ...data };
      webhookEvents.set(data.transactionRef, row);
      return row;
    },
    async updateMany({ where, data }) {
      let count = 0;
      for (const row of webhookEvents.values()) {
        if (where.transactionRef && row.transactionRef !== where.transactionRef) continue;
        if (where.processed !== undefined && row.processed !== where.processed) continue;
        Object.assign(row, data);
        count += 1;
      }
      return { count };
    },
    async update({ where, data }) {
      const row = webhookEvents.get(where.transactionRef);
      if (!row) throw new Error('webhook event not found');
      Object.assign(row, data);
      return row;
    },
  },
  transaction: {
    async findUnique({ where }) {
      const row = transactions.get(where.reference);
      return row ? { ...row } : null;
    },
    async findFirst({ where }) {
      const clauses = where.OR || [where];
      const matchesClause = (row, c) =>
        Object.entries(c).every(([k, v]) => {
          // Support Prisma's `{ equals, mode: 'insensitive' }` string filter.
          if (v && typeof v === 'object' && 'equals' in v) {
            const a = String(row[k] ?? '');
            return v.mode === 'insensitive'
              ? a.toLowerCase() === String(v.equals).toLowerCase()
              : a === String(v.equals);
          }
          return row[k] === v;
        });
      for (const row of transactions.values()) {
        if (clauses.some((c) => matchesClause(row, c))) return { ...row };
      }
      return null;
    },
    async findMany({ where }) {
      return [...transactions.values()].filter((r) => matches(r, where)).map((r) => ({ ...r }));
    },
    async updateMany({ where, data }) {
      let count = 0;
      for (const row of transactions.values()) {
        if (where.reference && row.reference !== where.reference) continue;
        if (where.status && row.status !== where.status) continue;
        Object.assign(row, data);
        count += 1;
      }
      return { count };
    },
    async create({ data }) {
      const row = { id: `tx_${++seq}`, createdAt: new Date(), ...data };
      transactions.set(data.reference, row);
      return { ...row };
    },
  },
  wallet: {
    async findUnique({ where, select }) {
      let row = null;
      if (where.id) row = wallets.get(where.id);
      else if (where.userId) row = [...wallets.values()].find((w) => w.userId === where.userId);
      else if (where.virtualAccountNumber) row = [...wallets.values()].find((w) => w.virtualAccountNumber === where.virtualAccountNumber);
      else if (where.paystackCustomerCode) row = [...wallets.values()].find((w) => w.paystackCustomerCode === where.paystackCustomerCode);
      if (!row) return null;
      if (select) return Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, row[k]]));
      return row;
    },
    async update({ where, data }) {
      const row = wallets.get(where.id);
      if (!row) throw new Error('wallet not found');
      for (const [k, v] of Object.entries(data)) {
        if (v && typeof v === 'object' && 'increment' in v) row[k] = Number(row[k] || 0) + Number(v.increment);
        else row[k] = v;
      }
      return row;
    },
  },
  user: {
    async findUnique({ where }) {
      return users.get(where.id) || [...users.values()].find((u) => u.email === where.email) || null;
    },
  },
  platformSetting: { async findMany() { return []; } },
  $transaction: async (input) => (typeof input === 'function' ? input(prismaStub) : Promise.all(input)),
};

// ─── stubs ────────────────────────────────────────────────────────────────────

stub('../src/config/database.js', { prisma: prismaStub });
stub('../src/config/redis.js', { redis: { async get() { return null; }, async set() { return 'OK'; }, async del() { return 1; }, async publish() { return 0; } } });
stub('../src/config/index.js', { config: { NODE_ENV: 'test', PAYSTACK_SECRET_KEY: SECRET, ALERT_EMAIL: 'ops@', SMTP_FROM_EMAIL: 'hello@' } });
stub('../src/utils/logger.js', { logger: { info() {}, warn() {}, error() {}, debug() {} } });

const emailSent = [];
stub('../src/services/email.service.js', { sendEmail: async (a) => { emailSent.push(a); return {}; } });

const queued = [];
stub(require.resolve('bullmq'), {
  Queue: class { constructor() {} add(name, data, opts) { queued.push({ name, data, opts }); return Promise.resolve({}); } },
  Worker: class { constructor() {} on() {} },
  QueueEvents: class { constructor() {} on() {} },
});

stub('../src/services/katpay.service.js', {
  getBankList: async () => [],
  initiateTransferPayment: async () => ({}),
  getTransferPayment: async () => ({}),
  createVirtualAccount: async () => ({}),
  initiatePayout: async () => ({}),
  verifyWebhookSignature: () => false,
  isTimestampFresh: () => true,
});
stub('../src/services/bilalsada.service.js', {
  initPurchase: async () => ({}),
  verifyWebhook: () => false,
});
stub('../src/services/notify.service.js', {
  balanceUpdated() {}, fundingReceived() {}, onWalletEvent: () => Promise.resolve(),
  onWithdrawalEvent: () => Promise.resolve(),
});

const verifiedTransactions = [];
const verifiedTransfers = [];
stub('../src/services/paystack.service.js', {
  isConfigured: () => true,
  toTransferReference: (reference) => {
    const cleaned = String(reference || '').toLowerCase().replace(/[^a-z0-9\-_]/g, '');
    return cleaned.length >= 16 ? cleaned.slice(0, 50) : `${cleaned}${'0'.repeat(16 - cleaned.length)}`.slice(0, 50);
  },
  verifyWebhookSignature: (rawBody, signature) => {
    if (!signature) return false;
    const expected = crypto.createHmac('sha512', SECRET)
      .update(Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody)))
      .digest('hex');
    return signature === expected;
  },
  verifyTransaction: async (ref) => {
    verifiedTransactions.push(ref);
    return { reference: ref, status: 'success', amount: 500 };
  },
  verifyTransfer: async (ref) => {
    verifiedTransfers.push(ref);
    return verifiedTransfers._next || { reference: ref, status: 'success' };
  },
});

const funded = [];
stub('../src/modules/wallet/wallet.service.js', {
  fundWallet: async (args) => { funded.push(args); return { reference: args.reference, status: 'COMPLETED' }; },
  getWallet: async () => ({}),
  transferToBank: async () => ({}),
  withdrawToBank: async () => ({}),
  initiateTransferPaymentFunding: async () => ({}),
  getTransferPaymentStatus: async () => ({}),
});

const refunded = [];
stub('../src/services/withdrawal-refund.service.js', {
  refundFailedWithdrawal: async (args) => { refunded.push(args); return { refunded: true, total: 500 }; },
});

stub('../src/services/settings.service.js', {
  getSetting: async (_k, d) => d,
  getSettings: async () => ({}),
  setSetting: async () => ({}),
  getAllSettings: async () => ({}),
});

const controller = require('../src/modules/webhook/webhook.controller');
const worker = require('../src/queues/workers/payment.worker');
const { handlePaystackWebhook, reconcilePaystack } = worker.__test;

// ─── helpers ──────────────────────────────────────────────────────────────────

const makeRes = () => ({
  statusCode: 200,
  body: undefined,
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
  type() { return this; },
  send(b) { this.body = b; return this; },
});

const sign = (payload) => crypto.createHmac('sha512', SECRET).update(JSON.stringify(payload)).digest('hex');

const seedWallet = (id, userId, extra = {}) => {
  const row = { id, userId, balance: 0, virtualAccountNumber: null, ...extra };
  wallets.set(id, row);
  return row;
};

// The controller creates the unprocessed webhookEvent row that the worker then
// claims; worker-level tests must seed it to mimic a delivered webhook.
const seedEvent = (ref) => webhookEvents.set(ref, { transactionRef: ref, processed: false, provider: 'paystack' });

test.beforeEach(() => {
  webhookEvents.clear();
  transactions.clear();
  wallets.clear();
  users.clear();
  queued.length = 0;
  funded.length = 0;
  refunded.length = 0;
  verifiedTransactions.length = 0;
  verifiedTransfers.length = 0;
  verifiedTransfers.length = 0;
  verifiedTransfers._next = null;
  emailSent.length = 0;
});

// ─── controller ───────────────────────────────────────────────────────────────

test('handlePaystack: rejects an invalid signature with 401 and logs nothing', async () => {
  const payload = { event: 'charge.success', data: { id: 1, reference: 'TOPUP-1' } };
  const req = { headers: { 'x-paystack-signature': 'deadbeef' }, body: Buffer.from(JSON.stringify(payload)), ip: '1.2.3.4' };
  const res = makeRes();
  await controller.handlePaystack(req, res, () => {});
  assert.equal(res.statusCode, 401);
  assert.equal(webhookEvents.size, 0);
});

test('handlePaystack: ACKs a valid event, logs it, and enqueues processing', async () => {
  const payload = { event: 'charge.success', data: { id: 55, reference: 'TOPUP-1', amount: 50000 } };
  const raw = JSON.stringify(payload);
  const req = { headers: { 'x-paystack-signature': crypto.createHmac('sha512', SECRET).update(raw).digest('hex') }, body: Buffer.from(raw), ip: '1.2.3.4' };
  const res = makeRes();
  await controller.handlePaystack(req, res, () => {});

  assert.equal(res.statusCode, 200);
  assert.ok(webhookEvents.has('paystack-55'));
  assert.equal(webhookEvents.get('paystack-55').provider, 'paystack');
  await new Promise((r) => setImmediate(r));
  assert.equal(queued.length, 1);
  assert.equal(queued[0].name, 'process-paystack-webhook');
  assert.equal(queued[0].data.transactionRef, 'paystack-55');
});

test('handlePaystack: short-circuits an already-processed event', async () => {
  const payload = { event: 'charge.success', data: { id: 77, reference: 'TOPUP-2' } };
  const raw = JSON.stringify(payload);
  webhookEvents.set('paystack-77', { transactionRef: 'paystack-77', processed: true });
  const req = { headers: { 'x-paystack-signature': crypto.createHmac('sha512', SECRET).update(raw).digest('hex') }, body: Buffer.from(raw), ip: '1.2.3.4' };
  const res = makeRes();
  await controller.handlePaystack(req, res, () => {});
  await new Promise((r) => setImmediate(r));
  assert.equal(queued.length, 0);
  assert.match(res.body.message, /Already processed/);
});

// ─── worker: charge.success ───────────────────────────────────────────────────

test('paystack charge.success (DVA): funds the wallet by receiver NUBAN', async () => {
  seedWallet('w1', 'u1', { virtualAccountNumber: '9990001111' });
  webhookEvents.set('paystack-1', { transactionRef: 'paystack-1', processed: false, provider: 'paystack' });

  await handlePaystackWebhook({
    transactionRef: 'paystack-1',
    payload: {
      event: 'charge.success',
      data: {
        reference: 'PS-DVA-1',
        amount: 100000,
        channel: 'dedicated_nuban',
        authorization: { channel: 'dedicated_nuban', receiver_bank_account_number: '9990001111' },
        metadata: {},
      },
    },
  });

  assert.equal(funded.length, 1);
  assert.equal(funded[0].accountNumber, '9990001111');
  assert.equal(funded[0].amount, 1000);
  assert.equal(funded[0].provider, 'PAYSTACK');
  assert.equal(webhookEvents.get('paystack-1').processed, true);
});

test('paystack charge.success (DVA): falls back to customer code when no receiver number', async () => {
  seedWallet('w2', 'u2', { paystackAccountNumber: '8880002222', paystackCustomerCode: 'CUS_x' });
  seedEvent('paystack-2');

  await handlePaystackWebhook({
    transactionRef: 'paystack-2',
    payload: {
      event: 'charge.success',
      data: {
        reference: 'PS-DVA-2', amount: 50000, channel: 'dedicated_nuban',
        authorization: { channel: 'dedicated_nuban' },
        customer: { customer_code: 'CUS_x', email: 'u2@x.co' },
        metadata: {},
      },
    },
  });

  assert.equal(funded[0].accountNumber, '8880002222');
});

test('paystack charge.success (checkout): funds by metadata.userId', async () => {
  seedWallet('w3', 'u3', { balance: 0 });
  seedEvent('paystack-3');

  await handlePaystackWebhook({
    transactionRef: 'paystack-3',
    payload: {
      event: 'charge.success',
      data: { reference: 'TOPUP-3', amount: 25000, channel: 'card', metadata: { userId: 'u3', purpose: 'WALLET_TOPUP' } },
    },
  });

  assert.equal(funded.length, 1);
  assert.equal(funded[0].userId, 'u3');
  assert.equal(funded[0].amount, 250);
  assert.equal(funded[0].accountNumber, null);
});

test('paystack webhook: a second delivery of the same event does nothing', async () => {
  seedWallet('w3', 'u3', { balance: 0 });
  const args = {
    transactionRef: 'paystack-4',
    payload: { event: 'charge.success', data: { reference: 'TOPUP-4', amount: 10000, metadata: { userId: 'u3' } } },
  };
  seedEvent('paystack-4');
  await handlePaystackWebhook(args);
  await handlePaystackWebhook(args);
  assert.equal(funded.length, 1);
});

// ─── worker: transfers ────────────────────────────────────────────────────────

test('paystack transfer.success: marks the SENT payout COMPLETED', async () => {
  seedWallet('w5', 'u5', { balance: 0 });
  transactions.set('WIT-1', {
    reference: 'WIT-1', providerRef: 'wit-0001', provider: 'PAYSTACK', type: 'WITHDRAWAL',
    status: 'SENT', amount: 500, debitWalletId: 'w5',
  });
  seedEvent('paystack-5');

  await handlePaystackWebhook({
    transactionRef: 'paystack-5',
    payload: { event: 'transfer.success', data: { reference: 'wit-0001', status: 'success' } },
  });

  assert.equal(transactions.get('WIT-1').status, 'COMPLETED');
});

test('paystack transfer.success: matches a lowercased reference against the ledger (case bug)', async () => {
  seedWallet('w5b', 'u5b', { balance: 0 });
  // Ledger keeps the original mixed case and (pre-fix) had no providerRef; the
  // webhook echoes the all-lowercase form. Must still resolve and complete.
  transactions.set('TRF-75D5652B-7264-4AE8-A6F9-9F193BAA7155', {
    reference: 'TRF-75D5652B-7264-4AE8-A6F9-9F193BAA7155', providerRef: null, provider: 'PAYSTACK', type: 'WITHDRAWAL',
    status: 'SENT', amount: 500, debitWalletId: 'w5b',
  });
  seedEvent('paystack-5b');

  await handlePaystackWebhook({
    transactionRef: 'paystack-5b',
    payload: { event: 'transfer.success', data: { reference: 'trf-75d5652b-7264-4ae8-a6f9-9f193baa7155', status: 'success' } },
  });

  assert.equal(transactions.get('TRF-75D5652B-7264-4AE8-A6F9-9F193BAA7155').status, 'COMPLETED');
});

test('paystack transfer.reversed: refunds the wallet (balance credited back)', async () => {
  seedWallet('w6', 'u6', { balance: 0 });
  transactions.set('WIT-2', {
    reference: 'WIT-2', providerRef: 'wit-0002', provider: 'PAYSTACK', type: 'WITHDRAWAL',
    status: 'SENT', amount: 700, debitWalletId: 'w6',
  });
  verifiedTransfers._next = { reference: 'wit-0002', status: 'reversed' };
  seedEvent('paystack-6');

  await handlePaystackWebhook({
    transactionRef: 'paystack-6',
    payload: { event: 'transfer.reversed', data: { reference: 'wit-0002', status: 'reversed' } },
  });

  assert.equal(refunded.length, 1);
  assert.equal(refunded[0].transactionId, 'WIT-2');
});

test('paystack transfer.failed: holds the payout and alerts (never auto-refunds)', async () => {
  seedWallet('w6', 'u6', { balance: 0 });
  transactions.set('WIT-2', {
    reference: 'WIT-2', providerRef: 'wit-0002', provider: 'PAYSTACK', type: 'WITHDRAWAL',
    status: 'SENT', amount: 700, debitWalletId: 'w6',
  });
  verifiedTransfers._next = { reference: 'wit-0002', status: 'failed' };
  seedEvent('paystack-6');

  await handlePaystackWebhook({
    transactionRef: 'paystack-6',
    payload: { event: 'transfer.failed', data: { reference: 'wit-0002', status: 'failed' } },
  });

  // Paystack does NOT return the debit on `failed` (only `reversed`) - auto
  // refunding could double-pay, so we hold + alert and leave the payout SENT.
  assert.equal(refunded.length, 0);
  assert.equal(transactions.get('WIT-2').status, 'SENT');
  assert.equal(emailSent.length, 1);
});

test('paystack transfer.failed: verify showing still-pending leaves the payout alone', async () => {
  seedWallet('w6', 'u6', { balance: 0 });
  transactions.set('WIT-3', {
    reference: 'WIT-3', providerRef: 'wit-0003', provider: 'PAYSTACK', type: 'WITHDRAWAL',
    status: 'SENT', amount: 700, debitWalletId: 'w6',
  });
  verifiedTransfers._next = { reference: 'wit-0003', status: 'pending' };
  seedEvent('paystack-7');

  await handlePaystackWebhook({
    transactionRef: 'paystack-7',
    payload: { event: 'transfer.failed', data: { reference: 'wit-0003', status: 'failed' } },
  });

  assert.equal(refunded.length, 0);
  assert.equal(transactions.get('WIT-3').status, 'SENT');
});

// ─── reconcile sweep ──────────────────────────────────────────────────────────

test('reconcilePaystack: settles a PENDING funding that verify says succeeded', async () => {
  const old = new Date(Date.now() - 10 * 60 * 1000);
  transactions.set('TOPUP-9', {
    reference: 'TOPUP-9', provider: 'PAYSTACK', type: 'WALLET_FUNDING', status: 'PENDING',
    metadata: { userId: 'u9' }, amount: 500, createdAt: old,
  });

  const out = await reconcilePaystack();
  assert.equal(out.settled, 1);
  assert.equal(funded.length, 1);
  assert.equal(funded[0].reference, 'TOPUP-9');
});

test('reconcilePaystack: marks a PENDING funding FAILED when verify says failed', async () => {
  const old = new Date(Date.now() - 10 * 60 * 1000);
  transactions.set('TOPUP-10', {
    reference: 'TOPUP-10', provider: 'PAYSTACK', type: 'WALLET_FUNDING', status: 'PENDING',
    metadata: { userId: 'u10' }, amount: 500, createdAt: old,
  });
  const paystack = require('../src/services/paystack.service');
  const original = paystack.verifyTransaction;
  paystack.verifyTransaction = async (ref) => ({ reference: ref, status: 'abandoned' });

  const out = await reconcilePaystack();
  paystack.verifyTransaction = original;

  assert.equal(out.failed, 1);
  assert.equal(transactions.get('TOPUP-10').status, 'FAILED');
});

test('reconcilePaystack: completes a SENT payout verify says succeeded', async () => {
  const old = new Date(Date.now() - 10 * 60 * 1000);
  seedWallet('w11', 'u11', { balance: 0 });
  transactions.set('WIT-11', {
    reference: 'WIT-11', providerRef: 'wit-0011', provider: 'PAYSTACK', type: 'WITHDRAWAL',
    status: 'SENT', amount: 500, debitWalletId: 'w11', createdAt: old,
  });

  const out = await reconcilePaystack();
  assert.equal(out.settled, 1);
  assert.equal(transactions.get('WIT-11').status, 'COMPLETED');
});

test('reconcilePaystack: refunds a SENT payout verify says reversed', async () => {
  const old = new Date(Date.now() - 10 * 60 * 1000);
  seedWallet('w12', 'u12', { balance: 0 });
  transactions.set('WIT-12', {
    reference: 'WIT-12', providerRef: 'wit-0012', provider: 'PAYSTACK', type: 'WITHDRAWAL',
    status: 'SENT', amount: 500, debitWalletId: 'w12', createdAt: old,
  });
  verifiedTransfers._next = { reference: 'wit-0012', status: 'reversed' };

  const out = await reconcilePaystack();
  assert.equal(out.refunded, 1);
  assert.equal(refunded[0].transactionId, 'WIT-12');
});

test('reconcilePaystack: holds (does not refund) a SENT payout verify says failed', async () => {
  const old = new Date(Date.now() - 10 * 60 * 1000);
  seedWallet('w12', 'u12', { balance: 0 });
  transactions.set('WIT-13', {
    reference: 'WIT-13', providerRef: 'wit-0013', provider: 'PAYSTACK', type: 'WITHDRAWAL',
    status: 'SENT', amount: 500, debitWalletId: 'w12', createdAt: old,
  });
  verifiedTransfers._next = { reference: 'wit-0013', status: 'failed' };

  const out = await reconcilePaystack();
  assert.equal(out.refunded, 0);
  assert.equal(refunded.length, 0);
  assert.equal(transactions.get('WIT-13').status, 'SENT');
  assert.equal(emailSent.length, 1);
});
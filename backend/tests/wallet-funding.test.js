/**
 * Wallet funding tests - the money-critical paths of the gateway switch.
 *
 * Covers:
 *   - legacy KatPay DVA funding credits once and is idempotent on replay;
 *   - Paystack checkout PENDING rows settle PENDING→COMPLETED exactly once
 *     (concurrent webhook deliveries must not double-credit);
 *   - funding initiation returns one normalised envelope for either gateway,
 *     and pre-creates the PENDING row only in PAYSTACK mode;
 *   - funding status resolves provider from the ledger row and normalises to
 *     COMPLETED | FAILED | PENDING.
 *
 * No live provider calls: paystack/katpay/router are stubbed.
 *
 * Run with: node --test tests/wallet-funding.test.js
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

// ─── in-memory prisma ─────────────────────────────────────────────────────────

let seq = 0;
const wallets = new Map();
const transactions = new Map();
const users = new Map();

const prismaStub = {
  wallet: {
    async findUnique({ where, select }) {
      let row = null;
      if (where.id) row = wallets.get(where.id);
      else if (where.userId) row = [...wallets.values()].find((w) => w.userId === where.userId);
      else if (where.virtualAccountNumber) row = [...wallets.values()].find((w) => w.virtualAccountNumber === where.virtualAccountNumber);
      if (!row) return null;
      if (select) return Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, row[k]]));
      return row;
    },
    async findFirst({ where }) {
      const clauses = where.OR || [where];
      return [...wallets.values()].find((w) => clauses.some((c) => Object.keys(c).every((k) => w[k] === c[k]))) || null;
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
  transaction: {
    async findUnique({ where }) {
      const row = transactions.get(where.reference);
      // Return a snapshot, like real Prisma - callers must not see later
      // mutations to the stored row (the CAS relies on this).
      return row ? { ...row } : null;
    },
    async create({ data }) {
      const row = { id: `tx_${++seq}`, createdAt: new Date(), ...data };
      transactions.set(data.reference, row);
      return row;
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
  },
  platformSetting: {
    async findMany() { return []; },
  },
  user: {
    async findUnique({ where, select }) {
      const row = users.get(where.id) || [...users.values()].find((u) => u.email === where.email);
      if (!row) return null;
      if (select) return Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, row[k]]));
      return row;
    },
  },
  $transaction: async (input) => (typeof input === 'function' ? input(prismaStub) : Promise.all(input)),
};

// ─── stubs ────────────────────────────────────────────────────────────────────

const redisStub = {
  store: new Map(),
  async get(k) { return this.store.get(k) ?? null; },
  async set(k, v) { this.store.set(k, v); return 'OK'; },
  async del(k) { this.store.delete(k); return 1; },
  async publish() { return 0; },
};

stub('../src/config/database.js', { prisma: prismaStub });
stub('../src/config/redis.js', { redis: redisStub });
stub('../src/config/index.js', { config: { NODE_ENV: 'test' } });
stub('../src/utils/logger.js', { logger: { info() {}, warn() {}, error() {}, debug() {} } });

stub(require.resolve('bullmq'), {
  Queue: class { constructor() {} add() { return Promise.resolve({}); } },
  Worker: class { constructor() {} on() {} },
  QueueEvents: class { constructor() {} on() {} },
});

const notifications = [];
stub('../src/services/notify.service.js', {
  balanceUpdated: (u, p) => notifications.push(['balance', u, p]),
  fundingReceived: (u, p) => notifications.push(['funding', u, p]),
  onWalletEvent: () => Promise.resolve(),
  onWithdrawalEvent: () => Promise.resolve(),
});

let MODE = 'KATPAY';
stub('../src/services/payments/router.js', {
  MODES: { KATPAY: 'KATPAY', PAYSTACK: 'PAYSTACK' },
  DEFAULT_MODE: 'KATPAY',
  getMode: async () => MODE,
  resolveGateway: async () => ({ mode: MODE, provider: MODE }),
});

const paystackCalls = { initialize: [], verify: [] };
stub('../src/services/paystack.service.js', {
  isConfigured: () => true,
  initializeTransaction: async (args) => {
    paystackCalls.initialize.push(args);
    return { reference: args.reference, checkout_url: 'https://checkout.paystack.com/x', access_code: 'ac' };
  },
  verifyTransaction: async (ref) => {
    paystackCalls.verify.push(ref);
    return { reference: ref, status: 'success', amount: 500, channel: 'card' };
  },
});

const katpayCalls = { initiate: [], status: [] };
stub('../src/services/katpay.service.js', {
  getBankList: async () => [],
  createVirtualAccount: async () => ({}),
  initiatePayout: async () => ({}),
  initiateTransferPayment: async (args) => {
    katpayCalls.initiate.push(args);
    return { uuid: 'kat-uuid-1', checkout_url: 'https://checkout.katpay.co/y', payment_account: { accountNumber: '1' }, expires_at: 'later' };
  },
  getTransferPayment: async (ref) => {
    katpayCalls.status.push(ref);
    return { status: 'completed', amount: 500 };
  },
});

stub('../src/services/settings.service.js', {
  getSetting: async (_k, d) => d,
  getSettings: async () => ({}),
  setSetting: async () => ({}),
  getAllSettings: async () => ({}),
});

const walletService = require('../src/modules/wallet/wallet.service');

// ─── helpers ──────────────────────────────────────────────────────────────────

const seedUser = (id, email = `${id}@x.co`) => users.set(id, { id, email, firstName: 'A', lastName: 'B', phone: '08030000000' });
const seedWallet = (id, userId, extra = {}) => {
  const row = { id, userId, balance: 0, virtualAccountNumber: null, ...extra };
  wallets.set(id, row);
  return row;
};

test.beforeEach(() => {
  wallets.clear();
  transactions.clear();
  users.clear();
  notifications.length = 0;
  paystackCalls.initialize.length = 0;
  paystackCalls.verify.length = 0;
  katpayCalls.initiate.length = 0;
  katpayCalls.status.length = 0;
  MODE = 'KATPAY';
});

// ─── fundWallet: legacy KatPay DVA ────────────────────────────────────────────

test('fundWallet: credits the DVA wallet once and is idempotent on replay', async () => {
  seedWallet('w1', 'u1', { virtualAccountNumber: 'VA1', balance: 0 });

  const first = await walletService.fundWallet({ accountNumber: 'VA1', amount: 1000, reference: 'KAT-1', metadata: {} });
  assert.equal(first.status, 'COMPLETED');
  assert.equal(first.provider, 'KATPAY');
  assert.equal(wallets.get('w1').balance, 1000);
  assert.equal(transactions.size, 1);

  // Replay (webhook retry) must not credit again.
  const second = await walletService.fundWallet({ accountNumber: 'VA1', amount: 1000, reference: 'KAT-1', metadata: {} });
  assert.equal(second.reference, 'KAT-1');
  assert.equal(wallets.get('w1').balance, 1000);
  assert.equal(transactions.size, 1);
});

test('fundWallet: unknown funding account is rejected (no ledger row, no credit)', async () => {
  seedWallet('w1', 'u1', { virtualAccountNumber: 'VA1', balance: 0 });
  await assert.rejects(
    () => walletService.fundWallet({ accountNumber: 'NOPE', amount: 1000, reference: 'KAT-X', metadata: {} }),
    (err) => err.statusCode === 404,
  );
  assert.equal(transactions.size, 0);
});

// ─── fundWallet: Paystack PENDING → COMPLETED ─────────────────────────────────

test('fundWallet: settles a Paystack PENDING row to COMPLETED exactly once', async () => {
  seedWallet('w2', 'u2', { balance: 0 });
  transactions.set('PS-1', {
    id: 'tx_pre', reference: 'PS-1', type: 'WALLET_FUNDING', status: 'PENDING',
    creditWalletId: 'w2', provider: 'PAYSTACK', metadata: { userId: 'u2' }, amount: 500, fee: 0,
  });

  const settled = await walletService.fundWallet({ userId: 'u2', amount: 500, reference: 'PS-1', metadata: {}, provider: 'PAYSTACK' });
  assert.equal(settled.status, 'COMPLETED');
  assert.equal(settled.provider, 'PAYSTACK');
  assert.equal(Number(settled.amount), 500);
  assert.equal(wallets.get('w2').balance, 500);

  // Duplicate delivery: status is no longer PENDING → short-circuit, no credit.
  await walletService.fundWallet({ userId: 'u2', amount: 500, reference: 'PS-1', metadata: {}, provider: 'PAYSTACK' });
  assert.equal(wallets.get('w2').balance, 500);
});

test('fundWallet: a losing concurrent settlement claim does not credit twice', async () => {
  seedWallet('w2', 'u2', { balance: 0 });
  transactions.set('PS-2', {
    id: 'tx_pre', reference: 'PS-2', type: 'WALLET_FUNDING', status: 'PENDING',
    creditWalletId: 'w2', provider: 'PAYSTACK', metadata: { userId: 'u2' }, amount: 500, fee: 0,
  });

  // Two settlements of the same PENDING reference; the compare-and-set means the
  // second sees COMPLETED and returns without crediting.
  await Promise.all([
    walletService.fundWallet({ userId: 'u2', amount: 500, reference: 'PS-2', metadata: {}, provider: 'PAYSTACK' }),
    walletService.fundWallet({ userId: 'u2', amount: 500, reference: 'PS-2', metadata: {}, provider: 'PAYSTACK' }),
  ]);

  assert.equal(wallets.get('w2').balance, 500);
});

// ─── initiateTransferPaymentFunding ───────────────────────────────────────────

test('initiateTransferPaymentFunding: PAYSTACK mode pre-creates a PENDING row and normalises the envelope', async () => {
  MODE = 'PAYSTACK';
  seedUser('u3');
  seedWallet('w3', 'u3', { balance: 0 });

  const out = await walletService.initiateTransferPaymentFunding('u3', { amount: 500 });
  assert.equal(out.provider, 'PAYSTACK');
  assert.equal(out.checkout_url, 'https://checkout.paystack.com/x');
  assert.ok(out.reference.startsWith('TOPUP-'));

  const row = transactions.get(out.reference);
  assert.equal(row.status, 'PENDING');
  assert.equal(row.creditWalletId, 'w3');
  assert.equal(row.provider, 'PAYSTACK');
  assert.equal(paystackCalls.initialize.length, 1);
  assert.equal(paystackCalls.initialize[0].amount, 500);
});

test('initiateTransferPaymentFunding: does NOT pre-create a row in KATPAY mode', async () => {
  MODE = 'KATPAY';
  seedUser('u4');
  seedWallet('w4', 'u4', { balance: 0 });

  const out = await walletService.initiateTransferPaymentFunding('u4', { amount: 500 });
  assert.equal(out.provider, 'KATPAY');
  assert.equal(out.reference, 'kat-uuid-1');
  assert.equal(out.uuid, 'kat-uuid-1');
  assert.equal(out.checkout_url, 'https://checkout.katpay.co/y');
  assert.equal(transactions.size, 0);
  assert.equal(katpayCalls.initiate.length, 1);
});

// ─── getTransferPaymentStatus ─────────────────────────────────────────────────

test('getTransferPaymentStatus: resolves PAYSTACK from the ledger row and normalises status', async () => {
  transactions.set('PS-3', { reference: 'PS-3', provider: 'PAYSTACK', status: 'COMPLETED', creditWalletId: 'w2' });
  MODE = 'KATPAY'; // must follow the row, not the active mode

  const out = await walletService.getTransferPaymentStatus('PS-3');
  assert.deepEqual(out, { reference: 'PS-3', status: 'COMPLETED', amount: 500, provider: 'PAYSTACK' });
  assert.equal(paystackCalls.verify[0], 'PS-3');
});

test('getTransferPaymentStatus: KATPAY references use KatPay and normalise to COMPLETED', async () => {
  const out = await walletService.getTransferPaymentStatus('kat-uuid-1');
  assert.equal(out.provider, 'KATPAY');
  assert.equal(out.status, 'COMPLETED');
  assert.equal(katpayCalls.status[0], 'kat-uuid-1');
});
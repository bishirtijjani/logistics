/**
 * Shared stubs for utility worker tests.
 *
 * The utility worker imports:
 *   - prisma (database)
 *   - redis (queue / cache)
 *   - alrahuz.service (HTTP provider)
 *   - messaging.service (OTP + transactional SMS dispatcher)
 *   - notify.service (push + socket fan-out)
 *   - queues/index.js (BullMQ queues - themselves wrap redis)
 *
 * All of those need to be replaced before the worker module is required, or
 * Node will try to connect to the real services. This helper sets up an
 * in-memory copy of every collaborator the worker touches.
 */

const path = require('node:path');
const Module = require('node:module');

const stub = (file, exports) => {
  const filename = path.resolve(__dirname, '..', file);
  const mod = new Module(filename);
  mod.filename = filename;
  mod.loaded = true;
  mod.exports = exports;
  require.cache[filename] = mod;
  return mod;
};

const makeWalletState = ({ balance = 5000 } = {}) => ({
  id: 'w1',
  userId: 'u1',
  balance,
  isLocked: false,
});

const installUtilityStubs = () => {
  // ── Prisma (in-memory) ────────────────────────────────────────────────────
  const state = {
    wallet: makeWalletState({ balance: 5000 }),
    payment: null, // single payment under test
    transactions: [],
  };

  const prisma = {
    _state: state,
    utilityPayment: {
      async findUnique({ where }) {
        if (state.payment && state.payment.id === where.id) return { ...state.payment };
        return null;
      },
      async update({ where, data }) {
        if (state.payment && state.payment.id === where.id) {
          state.payment = { ...state.payment, ...data };
          return { ...state.payment };
        }
        return null;
      },
    },
    wallet: {
      async findUnique({ where }) {
        if (where.userId && state.wallet.userId === where.userId) return { ...state.wallet };
        if (where.id && state.wallet.id === where.id) return { ...state.wallet };
        return null;
      },
      async update({ where, data }) {
        if (data.balance?.increment !== undefined) state.wallet.balance += data.balance.increment;
        if (data.balance?.decrement !== undefined) state.wallet.balance -= data.balance.decrement;
        if (typeof data.balance === 'number') state.wallet.balance = data.balance;
        return { ...state.wallet };
      },
    },
    transaction: {
      async create({ data }) {
        const row = { id: `tx${state.transactions.length + 1}`, ...data };
        state.transactions.push(row);
        return row;
      },
      async updateMany({ where, data }) {
        let count = 0;
        for (const t of state.transactions) {
          if (t.reference === where.reference) { Object.assign(t, data); count += 1; }
        }
        return { count };
      },
    },
    async $transaction(arg) {
      // Callback form
      if (typeof arg === 'function') return arg(prisma);
      // Array form - execute each item which is already a thenable promise
      // returned by the prisma methods above (we await them sequentially).
      const out = [];
      for (const p of arg) out.push(await p);
      return out;
    },
  };

  // ── Redis (no-op) ─────────────────────────────────────────────────────────
  const redis = {
    async get() { return null; },
    async set() { return 'OK'; },
    async del() { return 1; },
    async publish() { return 0; },
  };

  // ── Config / logger ───────────────────────────────────────────────────────
  const config = {
    NODE_ENV: 'test',
    ALRAHUZ_TOKEN: 'test',
    OTP_PROVIDER: 'whatsapp',
    TERMII_API_KEY: 'k', TERMII_BASE_URL: 'http://termii', TERMII_SENDER_ID: 'KAT',
  };
  const logger = { info() {}, warn() {}, error() {}, debug() {} };

  // ── Notify + Messaging (record calls) ─────────────────────────────────────
  const calls = { push: [], sms: [], polls: [], refunds: [] };
  const notify = {
    async pushAndSocket(userId, payload) { calls.push.push({ userId, ...payload }); return { id: 'n1' }; },
    async onWalletEvent(userId, payload) { calls.push.push({ userId, kind: 'wallet-event', ...payload }); },
    setIO() {}, getIO() { return null; },
  };
  // Both messaging.service (new dispatcher) and termii.service (kept dormant)
  // record into the same `calls.sms` bucket so test assertions don't need to
  // know which channel the worker chose.
  const messaging = {
    async sendSms(phone, message) { calls.sms.push({ phone, message }); return { ok: true }; },
    async sendOtp(phone, code) { calls.sms.push({ phone, code, otp: true }); return { ok: true }; },
    assertConfiguredForProd() {},
    getActiveOtpProvider() { return 'whatsapp'; },
  };
  const termii = {
    async sendSms(phone, message) { calls.sms.push({ phone, message }); return { ok: true }; },
    async sendOtp() { return { ok: true }; },
    isConfigured() { return true },
    assertConfiguredForProd() {},
  };

  // ── Queue (records POLL_PENDING schedules) ───────────────────────────────
  const queuesModule = {
    schedulePollPending: async (data, delay) => { calls.polls.push({ data, delay }); return { id: 'job' }; },
    addUtilityJob: async () => ({ id: 'job' }),
    paymentQueue: {}, notificationQueue: {}, utilityQueue: {}, requestQueue: {},
    initializeQueues() {},
  };

  // ── Install ───────────────────────────────────────────────────────────────
  stub('src/config/database.js', { prisma });
  stub('src/config/redis.js', { redis });
  stub('src/config/index.js', { config });
  stub('src/utils/logger.js', { logger });
  stub('src/services/notify.service.js', notify);
  stub('src/services/messaging.service.js', messaging);
  stub('src/services/termii.service.js', termii);
  stub('src/queues/index.js', queuesModule);

  return { prisma, state, calls, redis };
};

module.exports = { installUtilityStubs };

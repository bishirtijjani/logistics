/**
 * Payments lifecycle tests - provisioning + payout routing after the gateway
 * switch.
 *
 * Covers:
 *   - provisionVirtualAccount: Paystack (customer + DVA, persists codes) and
 *     KatPay paths, plus idempotency when a NUBAN already exists;
 *   - handleWithdrawal: PAYSTACK payouts resolve/cache a recipient and complete;
 *     KATPAY payouts are unchanged; ambiguous errors rethrow (never refund),
 *     definitive errors refund via the shared service.
 *
 * All external calls are stubbed; no live provider traffic.
 *
 * Run with: node --test tests/payments-lifecycle.test.js
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

// ─── prisma ───────────────────────────────────────────────────────────────────

const wallets = new Map();
const users = new Map();
const transactions = new Map();
const beneficiaries = new Map();

const prismaStub = {
  wallet: {
    async findUnique({ where, select }) {
      let row = null;
      if (where.id) row = wallets.get(where.id);
      else if (where.userId) row = [...wallets.values()].find((w) => w.userId === where.userId);
      if (!row) return null;
      if (select) return Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, row[k]]));
      return row;
    },
    async update({ where, data }) {
      const row = wallets.get(where.id) || [...wallets.values()].find((w) => w.userId === where.userId);
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
      return row ? { ...row } : null;
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
  savedBeneficiary: {
    async findUnique({ where }) {
      if (where.userId_accountNumber_bankCode) {
        const { userId, accountNumber, bankCode } = where.userId_accountNumber_bankCode;
        return [...beneficiaries.values()].find((b) => b.userId === userId && b.accountNumber === accountNumber && b.bankCode === bankCode) || null;
      }
      return null;
    },
    async update({ where, data }) {
      const row = beneficiaries.get(where.id);
      if (!row) throw new Error('beneficiary not found');
      Object.assign(row, data);
      return row;
    },
  },
  platformSetting: { async findMany() { return []; } },
  webhookEvent: {},
  user: { async findUnique({ where }) { return users.get(where.id) || null; } },
  $executeRaw: async () => 1,
  $transaction: async (input) => (typeof input === 'function' ? input(prismaStub) : Promise.all(input)),
};

// ─── stubs ────────────────────────────────────────────────────────────────────

stub('../src/config/database.js', { prisma: prismaStub });
stub('../src/config/redis.js', { redis: { async get() { return null; }, async set() { return 'OK'; }, async del() { return 1; }, async publish() { return 0; } } });
stub('../src/config/index.js', { config: { NODE_ENV: 'test', ALERT_EMAIL: 'ops@iprime.ng', SMTP_FROM_EMAIL: 'hello@iprime.ng' } });
stub('../src/utils/logger.js', { logger: { info() {}, warn() {}, error() {}, debug() {} } });

const emailSent = [];
stub('../src/services/email.service.js', { sendEmail: async (a) => { emailSent.push(a); return {}; } });

stub(require.resolve('bullmq'), {
  Queue: class { constructor() {} add() { return Promise.resolve({}); } },
  Worker: class { constructor() {} on() {} },
  QueueEvents: class { constructor() {} on() {} },
});

let MODE = 'KATPAY';
stub('../src/services/payments/router.js', {
  MODES: { KATPAY: 'KATPAY', PAYSTACK: 'PAYSTACK' },
  DEFAULT_MODE: 'KATPAY',
  getMode: async () => MODE,
  resolveGateway: async () => ({ mode: MODE, provider: MODE }),
});

const calls = { createCustomer: [], assignDva: [], katpayVa: [], katpayPayout: [], paystackPayout: [], createRecipient: [] };
let payoutBehaviour = null; // () => value | throws
let payoutStatus = 'pending'; // live POST /transfer returns `pending` (only test mode returns `success`)

stub('../src/services/paystack.service.js', {
  isConfigured: () => true,
  createCustomer: async (a) => { calls.createCustomer.push(a); return { customerCode: 'CUS_1', email: a.email }; },
  assignDva: async (a) => {
    calls.assignDva.push(a);
    return { accountNumber: 'DVA1', bankName: 'Wema Bank', accountName: 'A B', dedicatedAccountId: '77', customerCode: 'CUS_1' };
  },
  createRecipientFromKatpayBank: async (a) => {
    calls.createRecipient.push(a);
    return { recipientCode: 'RCP_new', id: 1, details: {} };
  },
  initiatePayout: async (a) => {
    calls.paystackPayout.push(a);
    if (payoutBehaviour) return payoutBehaviour();
    return { reference: 'wit-1', transferCode: 'TRF_1', status: payoutStatus };
  },
  verifyTransfer: async () => ({ status: 'success' }),
});

stub('../src/services/katpay.service.js', {
  createVirtualAccount: async (a) => { calls.katpayVa.push(a); return { accountNumber: 'KAT1', bankName: 'Palmpay', accountName: 'A B' }; },
  initiatePayout: async (a) => {
    calls.katpayPayout.push(a);
    if (payoutBehaviour) return payoutBehaviour();
    return { reference: 'kat-ref', id: 'kat-id' };
  },
  getBankList: async () => [],
  initiateTransferPayment: async () => ({}),
  getTransferPayment: async () => ({}),
  verifyWebhookSignature: () => false,
  isTimestampFresh: () => true,
});

stub('../src/services/withdrawal-refund.service.js', {
  refundFailedWithdrawal: async (a) => { calls.refund = calls.refund || []; calls.refund.push(a); return { refunded: true, total: 500 }; },
});
stub('../src/services/notify.service.js', {
  balanceUpdated() {}, fundingReceived() {}, onWalletEvent: () => Promise.resolve(), onWithdrawalEvent: () => Promise.resolve(),
});
stub('../src/services/settings.service.js', {
  getSetting: async (_k, d) => d, getSettings: async () => ({}), setSetting: async () => ({}), getAllSettings: async () => ({}),
});

const { provisionVirtualAccount, activeAccountFor } = require('../src/services/payments/provisioning');
const worker = require('../src/queues/workers/payment.worker');
const { handleWithdrawal } = worker.__test;

// ─── helpers ──────────────────────────────────────────────────────────────────

const seedWallet = (id, userId, extra = {}) => {
  const row = { id, userId, balance: 0, virtualAccountNumber: null, ...extra };
  wallets.set(id, row);
  return row;
};

test.beforeEach(() => {
  wallets.clear();
  users.clear();
  transactions.clear();
  beneficiaries.clear();
  for (const k of Object.keys(calls)) calls[k].length = 0;
  calls.refund = [];
  emailSent.length = 0;
  payoutBehaviour = null;
  payoutStatus = 'pending'; // live POST /transfer queues with status `pending`
  MODE = 'KATPAY';
});

// ─── provisioning ─────────────────────────────────────────────────────────────

test('provisionVirtualAccount: PAYSTACK mode creates customer + DVA and persists the codes', async () => {
  MODE = 'PAYSTACK';
  seedWallet('w1', 'u1', { virtualAccountNumber: null, virtualAccountBank: null });

  const va = await provisionVirtualAccount({ userId: 'u1', email: 'u1@x.co', name: 'Ada Bello', phoneNumber: '0803' });

  assert.equal(va.provider, 'PAYSTACK');
  assert.equal(va.accountNumber, 'DVA1');
  assert.equal(calls.createCustomer.length, 1);
  assert.equal(calls.assignDva.length, 1);
  assert.equal(calls.assignDva[0].customerCode, 'CUS_1');
  assert.equal(calls.assignDva[0].preferredBank, 'wema-bank');
  const w = wallets.get('w1');
  assert.equal(w.virtualAccountNumber, 'DVA1');
  assert.equal(w.paystackCustomerCode, 'CUS_1');
  assert.equal(w.dedicatedAccountId, '77');
});

test('provisionVirtualAccount: KATPAY mode is unchanged', async () => {
  MODE = 'KATPAY';
  seedWallet('w2', 'u2', { virtualAccountNumber: null });

  const va = await provisionVirtualAccount({ userId: 'u2', email: 'u2@x.co', name: 'B C', phoneNumber: '0803' });

  assert.equal(va.provider, 'KATPAY');
  assert.equal(va.accountNumber, 'KAT1');
  assert.equal(calls.katpayVa.length, 1);
  assert.equal(wallets.get('w2').virtualAccountNumber, 'KAT1');
});

test('provisionVirtualAccount: idempotent when both provider accounts already exist', async () => {
  seedWallet('w3', 'u3', { paystackAccountNumber: 'PS-X', katpayAccountNumber: 'KAT-X' });
  const va = await provisionVirtualAccount({ userId: 'u3', email: 'u3@x.co', name: 'D E', phoneNumber: '0803' });
  assert.equal(va.alreadyProvisioned, true);
  assert.equal(va.accountNumber, 'KAT-X'); // mode defaults to KATPAY
  assert.equal(calls.createCustomer.length + calls.katpayVa.length, 0);
});

// ─── display account follows the active provider ──────────────────────────────

test('activeAccountFor: shows the ACTIVE provider\'s account', () => {
  const wallet = {
    paystackAccountNumber: 'PS-1', paystackAccountBank: 'Wema Bank', paystackAccountName: 'A',
    katpayAccountNumber: 'KP-1', katpayAccountBank: 'PalmPay', katpayAccountName: 'A',
  };
  assert.deepEqual(activeAccountFor(wallet, 'PAYSTACK'), { accountNumber: 'PS-1', bankName: 'Wema Bank', accountName: 'A', provider: 'PAYSTACK' });
  assert.deepEqual(activeAccountFor(wallet, 'KATPAY'), { accountNumber: 'KP-1', bankName: 'PalmPay', accountName: 'A', provider: 'KATPAY' });
});

test('activeAccountFor: falls back to the other provider when the active one is missing', () => {
  const onlyKatpay = { katpayAccountNumber: 'KP-2', katpayAccountBank: 'PalmPay', katpayAccountName: 'B' };
  assert.deepEqual(activeAccountFor(onlyKatpay, 'PAYSTACK'), { accountNumber: 'KP-2', bankName: 'PalmPay', accountName: 'B', provider: 'KATPAY' });

  const onlyPaystack = { paystackAccountNumber: 'PS-2', paystackAccountBank: 'Wema Bank', paystackAccountName: 'C' };
  assert.deepEqual(activeAccountFor(onlyPaystack, 'KATPAY'), { accountNumber: 'PS-2', bankName: 'Wema Bank', accountName: 'C', provider: 'PAYSTACK' });
});

test('activeAccountFor: falls back to the legacy mirror when neither provider field is set', () => {
  const mirror = { virtualAccountNumber: 'OLD-1', virtualAccountBank: 'PalmPay', virtualAccountName: 'D', paystackCustomerCode: null };
  assert.deepEqual(activeAccountFor(mirror, 'PAYSTACK'), { accountNumber: 'OLD-1', bankName: 'PalmPay', accountName: 'D', provider: 'KATPAY' });
  assert.equal(activeAccountFor({}, 'PAYSTACK'), null);
});

// ─── payouts ──────────────────────────────────────────────────────────────────

test('handleWithdrawal: PAYSTACK payout resolves a recipient and stays SENT when queued (live pending)', async () => {
  seedWallet('w4', 'u4', { balance: 0 });
  transactions.set('WIT-1', {
    reference: 'WIT-1', type: 'WITHDRAWAL', status: 'PROCESSING', provider: 'PAYSTACK',
    amount: 500, fee: 0, debitWalletId: 'w4', metadata: {},
  });

  await handleWithdrawal({ transactionId: 'WIT-1', bankCode: '100004', accountNumber: '0123456789', accountName: 'Ada', amount: 500, userId: 'u4' });

  assert.equal(calls.createRecipient.length, 1);
  assert.equal(calls.createRecipient[0].katpayBankCode, '100004');
  assert.equal(calls.paystackPayout.length, 1);
  assert.equal(calls.paystackPayout[0].recipientCode, 'RCP_new');
  // Live POST /transfer returns status `pending` - the money has NOT left, so
  // the row must stay SENT for the transfer.success webhook / sweep to complete.
  assert.equal(transactions.get('WIT-1').status, 'SENT');
  assert.equal(calls.katpayPayout.length, 0);
});

test('handleWithdrawal: PAYSTACK payout completes only when status is success', async () => {
  payoutStatus = 'success';
  seedWallet('w4', 'u4', { balance: 0 });
  transactions.set('WIT-1', {
    reference: 'WIT-1', type: 'WITHDRAWAL', status: 'PROCESSING', provider: 'PAYSTACK',
    amount: 500, fee: 0, debitWalletId: 'w4', metadata: {},
  });

  await handleWithdrawal({ transactionId: 'WIT-1', bankCode: '100004', accountNumber: '0123456789', accountName: 'Ada', amount: 500, userId: 'u4' });

  assert.equal(transactions.get('WIT-1').status, 'COMPLETED');
});

test('handleWithdrawal: PAYSTACK payout requiring OTP stays SENT and alerts', async () => {
  payoutStatus = 'otp';
  seedWallet('w4', 'u4', { balance: 0 });
  transactions.set('WIT-1', {
    reference: 'WIT-1', type: 'WITHDRAWAL', status: 'PROCESSING', provider: 'PAYSTACK',
    amount: 500, fee: 0, debitWalletId: 'w4', metadata: {},
  });

  await handleWithdrawal({ transactionId: 'WIT-1', bankCode: '100004', accountNumber: '0123456789', accountName: 'Ada', amount: 500, userId: 'u4' });

  assert.equal(transactions.get('WIT-1').status, 'SENT');
  assert.equal(emailSent.length, 1);
});

test('handleWithdrawal: PAYSTACK payout reuses a cached recipient code', async () => {
  seedWallet('w5', 'u5', { balance: 0 });
  beneficiaries.set('b1', { id: 'b1', userId: 'u5', accountNumber: '0123456789', bankCode: '100004', paystackRecipientCode: 'RCP_cached' });
  transactions.set('WIT-2', {
    reference: 'WIT-2', type: 'WITHDRAWAL', status: 'PROCESSING', provider: 'PAYSTACK',
    amount: 500, fee: 0, debitWalletId: 'w5', metadata: {},
  });

  await handleWithdrawal({ transactionId: 'WIT-2', bankCode: '100004', accountNumber: '0123456789', accountName: 'Ada', amount: 500, userId: 'u5' });

  assert.equal(calls.createRecipient.length, 0);
  assert.equal(calls.paystackPayout[0].recipientCode, 'RCP_cached');
  assert.equal(transactions.get('WIT-2').status, 'SENT');
});

test('handleWithdrawal: KATPAY payout path is unchanged', async () => {
  seedWallet('w6', 'u6', { balance: 0 });
  transactions.set('WIT-3', {
    reference: 'WIT-3', type: 'WITHDRAWAL', status: 'PROCESSING', provider: 'KATPAY',
    amount: 500, fee: 0, debitWalletId: 'w6', metadata: {},
  });

  await handleWithdrawal({ transactionId: 'WIT-3', bankCode: '100004', accountNumber: '0123456789', accountName: 'Ada', amount: 500, userId: 'u6' });

  assert.equal(calls.katpayPayout.length, 1);
  assert.equal(calls.paystackPayout.length, 0);
  assert.equal(transactions.get('WIT-3').status, 'COMPLETED');
});

test('handleWithdrawal: a definitive Paystack rejection refunds the wallet', async () => {
  seedWallet('w7', 'u7', { balance: 0 });
  transactions.set('WIT-4', {
    reference: 'WIT-4', type: 'WITHDRAWAL', status: 'PROCESSING', provider: 'PAYSTACK',
    amount: 500, fee: 0, debitWalletId: 'w7', metadata: {},
  });
  payoutBehaviour = () => { const e = new Error('Insufficient balance'); e.definitive = true; e.providerMessage = 'Insufficient balance'; return Promise.reject(e); };

  await handleWithdrawal({ transactionId: 'WIT-4', bankCode: '100004', accountNumber: '0123456789', accountName: 'Ada', amount: 500, userId: 'u7' });

  assert.equal(calls.refund.length, 1);
  assert.equal(calls.refund[0].transactionId, 'WIT-4');
});

test('handleWithdrawal: an ambiguous Paystack error rethrows and never refunds', async () => {
  seedWallet('w8', 'u8', { balance: 0 });
  transactions.set('WIT-5', {
    reference: 'WIT-5', type: 'WITHDRAWAL', status: 'PROCESSING', provider: 'PAYSTACK',
    amount: 500, fee: 0, debitWalletId: 'w8', metadata: {},
  });
  payoutBehaviour = () => { const e = new Error('timeout'); e.definitive = false; return Promise.reject(e); };

  await assert.rejects(() => handleWithdrawal({ transactionId: 'WIT-5', bankCode: '100004', accountNumber: '0123456789', accountName: 'Ada', amount: 500, userId: 'u8' }));
  assert.equal(calls.refund.length, 0);
  assert.equal(transactions.get('WIT-5').status, 'SENT');
});
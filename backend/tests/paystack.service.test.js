/**
 * Paystack adapter tests - pure helpers + request/response normalisation.
 *
 * axios is stubbed so these run offline; every Paystack call is asserted on the
 * exact outbound shape (kobo amounts, callback URL, transfer reference form).
 * The payout error classifier is covered explicitly because the payment worker
 * relies on `.definitive` to decide refund-vs-hold (money safety).
 *
 * Run with: node --test tests/paystack.service.test.js
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

const SECRET = 'sk_test_secret';
const CALLBACK = 'https://api.iprime.ng/webhooks/paystack';

const calls = [];
const getQueue = [];
const postQueue = [];

const httpError = (status, message) => {
  const err = new Error(message);
  err.response = { status, data: { message } };
  return err;
};

stubModule(require.resolve('axios'), {
  get: async (url, opts) => {
    calls.push({ method: 'get', url, opts });
    if (getQueue.length === 0) throw new Error('no axios GET queued for this test');
    const next = getQueue.shift();
    if (next instanceof Error) throw next;
    return next;
  },
  post: async (url, body, opts) => {
    calls.push({ method: 'post', url, body, opts });
    if (postQueue.length === 0) throw new Error('no axios POST queued for this test');
    const next = postQueue.shift();
    if (next instanceof Error) throw next;
    return next;
  },
});

stubModule(path.resolve(__dirname, '../src/config/index.js'), {
  config: {
    NODE_ENV: 'test',
    PAYSTACK_SECRET_KEY: SECRET,
    PAYSTACK_BASE_URL: 'https://api.paystack.co',
    PAYSTACK_CALLBACK_URL: CALLBACK,
  },
});
stubModule(path.resolve(__dirname, '../src/utils/logger.js'), {
  logger: { info() {}, warn() {}, error() {}, debug() {} },
});

const paystack = require('../src/services/paystack.service');

const reset = () => {
  calls.length = 0;
  getQueue.length = 0;
  postQueue.length = 0;
};
const last = (method) => [...calls].reverse().find((c) => c.method === method);

// --- money + reference helpers ---

test('toKobo: converts naira to kobo, rounding to the nearest kobo', () => {
  assert.equal(paystack.toKobo(100), 10000);
  assert.equal(paystack.toKobo(100.55), 10055);
  assert.equal(paystack.toKobo(0.01), 1);
  assert.equal(paystack.toKobo(2500), 250000);
});

test('fromKobo: converts kobo back to naira', () => {
  assert.equal(paystack.fromKobo(10000), 100);
  assert.equal(paystack.fromKobo(1), 0.01);
});

test('toTransferReference: keeps valid ledger refs, pads short, truncates long', () => {
  assert.equal(
    paystack.toTransferReference('WIT-3f9a1c2b-4d5e-6f70-8a9b-0c1d2e3f4a5b'),
    'wit-3f9a1c2b-4d5e-6f70-8a9b-0c1d2e3f4a5b',
  );
  const short = paystack.toTransferReference('WIT-ABC123');
  assert.equal(short, 'wit-abc123000000');
  assert.equal(short.length, 16);
  const long = paystack.toTransferReference('x'.repeat(60));
  assert.equal(long.length, 50);
});

// --- webhook signature ---

test('verifyWebhookSignature: accepts a valid HMAC-SHA512 of the raw body', () => {
  const body = JSON.stringify({ event: 'charge.success', data: { reference: 'TOPUP-1' } });
  const sig = crypto.createHmac('sha512', SECRET).update(body).digest('hex');
  assert.equal(paystack.verifyWebhookSignature(body, sig), true);
  // Raw bytes as a Buffer must verify identically.
  assert.equal(paystack.verifyWebhookSignature(Buffer.from(body, 'utf8'), sig), true);
});

test('verifyWebhookSignature: rejects tampered, missing, and malformed signatures', () => {
  const body = JSON.stringify({ event: 'charge.success', data: { reference: 'TOPUP-1' } });
  const sig = crypto.createHmac('sha512', SECRET).update(body).digest('hex');
  assert.equal(paystack.verifyWebhookSignature(body, 'deadbeef'), false);
  assert.equal(paystack.verifyWebhookSignature(`${body} `, sig), false);
  assert.equal(paystack.verifyWebhookSignature(body, undefined), false);
  assert.equal(paystack.verifyWebhookSignature(body, ''), false);
});

// --- customers & DVA ---

test('createCustomer: returns the customer code from Paystack', async () => {
  reset();
  postQueue.push({ data: { data: { customer_code: 'CUS_abc', id: 42, email: 'a@b.co' } } });
  const c = await paystack.createCustomer({ email: 'a@b.co', firstName: 'A', lastName: 'B', phone: '0803' });
  assert.deepEqual(c, { customerCode: 'CUS_abc', id: 42, email: 'a@b.co' });
  assert.equal(last('post').url, 'https://api.paystack.co/customer');
});

test('createCustomer: falls back to a lookup when the email already exists', async () => {
  reset();
  postQueue.push(httpError(400, 'Customer already exists'));
  getQueue.push({ data: { data: { customer_code: 'CUS_existing', id: 7, email: 'a@b.co' } } });
  const c = await paystack.createCustomer({ email: 'a@b.co' });
  assert.equal(c.customerCode, 'CUS_existing');
});

test('assignDva: forwards BVN and normalises the DVA fields', async () => {
  reset();
  postQueue.push({
    data: {
      data: {
        account_number: '9999999999',
        bank: { name: 'Wema Bank' },
        account_name: 'JOHN DOE',
        id: 12345,
        customer: { customer_code: 'CUS_abc' },
      },
    },
  });
  const va = await paystack.assignDva({ customerCode: 'CUS_abc', bvn: '12345678901', firstName: 'John' });
  assert.deepEqual(va, {
    accountNumber: '9999999999',
    bankName: 'Wema Bank',
    accountName: 'JOHN DOE',
    dedicatedAccountId: '12345',
    customerCode: 'CUS_abc',
  });
  const body = last('post').body;
  assert.equal(body.customer, 'CUS_abc');
  assert.equal(body.bvn, '12345678901');
});

// --- recipients & payouts ---

test('createRecipientFromKatpayBank: maps the KatPay code then creates the recipient', async () => {
  reset();
  postQueue.push({ data: { data: { recipient_code: 'RCP_xyz', id: 9, details: {} } } });
  const r = await paystack.createRecipientFromKatpayBank({
    name: 'John Doe', accountNumber: '0123456789', katpayBankCode: '100004',
  });
  assert.equal(r.recipientCode, 'RCP_xyz');
  assert.equal(last('post').url, 'https://api.paystack.co/transferrecipient');
  assert.equal(last('post').body.bank_code, '999992');
});

test('initiatePayout: sends kobo + a formatted reference, returns the transfer fields', async () => {
  reset();
  postQueue.push({ data: { data: { transfer_code: 'TRF_abc', reference: 'wit-3f9a1c2b', status: 'pending' } } });
  const out = await paystack.initiatePayout({
    amount: 500,
    recipientCode: 'RCP_xyz',
    reference: 'WIT-3F9A1C2B',
    reason: 'Wallet withdrawal',
  });
  assert.deepEqual(out, { reference: 'wit-3f9a1c2b', transferCode: 'TRF_abc', status: 'pending' });
  const body = last('post').body;
  assert.equal(body.amount, 50000);
  assert.equal(body.reference, 'wit-3f9a1c2b0000');
  assert.equal(body.source, 'balance');
  assert.equal(body.recipient, 'RCP_xyz');
});

test('initiatePayout: 4xx rejection is definitive (safe to refund)', async () => {
  reset();
  postQueue.push(httpError(400, 'Insufficient balance'));
  await assert.rejects(
    () => paystack.initiatePayout({ amount: 500, recipientCode: 'RCP_x', reference: 'WIT-1' }),
    (err) => err.definitive === true && err.providerStatus === 400,
  );
});

test('initiatePayout: OTP-required response is ambiguous (never auto-refund)', async () => {
  reset();
  postQueue.push(httpError(400, 'Transfer requires OTP to be sent'));
  await assert.rejects(
    () => paystack.initiatePayout({ amount: 500, recipientCode: 'RCP_x', reference: 'WIT-1' }),
    (err) => err.definitive === false,
  );
});

test('initiatePayout: network failure is ambiguous (never auto-refund)', async () => {
  reset();
  postQueue.push(new Error('ECONNRESET'));
  await assert.rejects(
    () => paystack.initiatePayout({ amount: 500, recipientCode: 'RCP_x', reference: 'WIT-1' }),
    (err) => err.definitive === false,
  );
});

// --- checkout ---

test('initializeTransaction: posts kobo + callback URL and normalises the envelope', async () => {
  reset();
  postQueue.push({
    data: { data: { authorization_url: 'https://checkout.paystack.com/abc', access_code: 'ac_1', reference: 'TOPUP-1' } },
  });
  const out = await paystack.initializeTransaction({
    amount: 500, email: 'a@b.co', reference: 'TOPUP-1', metadata: { userId: 'u1' },
  });
  assert.deepEqual(out, {
    reference: 'TOPUP-1',
    checkout_url: 'https://checkout.paystack.com/abc',
    access_code: 'ac_1',
  });
  const body = last('post').body;
  assert.equal(body.amount, 50000);
  assert.equal(body.email, 'a@b.co');
  assert.equal(body.callback_url, CALLBACK);
  assert.deepEqual(body.metadata, { userId: 'u1' });
});

test('initializeTransaction: requires an email', async () => {
  reset();
  await assert.rejects(
    () => paystack.initializeTransaction({ amount: 500, email: '' }),
    (err) => err.statusCode === 400,
  );
});

test('verifyTransaction: normalises status and converts the amount from kobo', async () => {
  reset();
  getQueue.push({
    data: {
      data: {
        reference: 'TOPUP-1',
        status: 'success',
        amount: 50000,
        currency: 'NGN',
        channel: 'card',
        customer: { customer_code: 'CUS_abc' },
        authorization: { channel: 'card' },
        metadata: { userId: 'u1' },
        gateway_response: 'Successful',
      },
    },
  });
  const out = await paystack.verifyTransaction('TOPUP-1');
  assert.equal(out.status, 'success');
  assert.equal(out.amount, 500);
  assert.equal(out.customerCode, 'CUS_abc');
  assert.equal(out.channel, 'card');
  assert.ok(last('get').url.endsWith('/transaction/verify/TOPUP-1'));
});

test('verifyTransfer: normalises the transfer status', async () => {
  reset();
  getQueue.push({ data: { data: { reference: 'wit-1', status: 'success', transfer_code: 'TRF_1', amount: 50000 } } });
  const out = await paystack.verifyTransfer('wit-1');
  assert.equal(out.status, 'success');
  assert.equal(out.transferCode, 'TRF_1');
  assert.equal(out.amount, 500);
});
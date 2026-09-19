/**
 * Paystack service - dual role.
 *
 *  1. Bank-account name verification (name enquiry). KatPay has no
 *     account-resolution endpoint, so we resolve against Paystack's free
 *     `/bank/resolve`. This runs regardless of the active gateway.
 *  2. Payment gateway when `payments.providerMode` = PAYSTACK: Dedicated Virtual
 *     Accounts (DVA) for wallet funding, hosted checkout for ad-hoc top-ups, and
 *     balance transfers for payouts.
 *
 * Code mismatch note: the dashboards' bank picker is populated from KatPay's
 * bank list, so callers pass a KATPAY bank code. Paystack uses its own codes for
 * fintechs (e.g. OPay = 999992 on Paystack vs 100004 on KatPay), so we map
 * KatPay code → Paystack code by exact-code match (true for NIP-coded banks),
 * an override table (fintechs), then a normalized name match.
 *
 * Amounts: every amount that crosses the Paystack boundary is in KOBO (the
 * smallest unit, ×100). Internal ledger amounts are naira; `toKobo`/`fromKobo`
 * are the only sanctioned conversions.
 *
 * Webhooks: Paystack signs with HMAC-SHA512 over the RAW request body keyed by
 * the secret key and sends the hex digest in `x-paystack-signature`. Verify with
 * `verifyWebhookSignature` before trusting any field.
 */
const axios = require('axios');
const crypto = require('crypto');
const { config } = require('../config');
const { logger } = require('../utils/logger');
const { AppError } = require('../utils/api-error');
const katpayService = require('./katpay.service');

const BASE = () => config.PAYSTACK_BASE_URL || 'https://api.paystack.co';
const authHeaders = () => ({ Authorization: `Bearer ${config.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' });
const isConfigured = () => Boolean(config.PAYSTACK_SECRET_KEY);

// Paystack bank list cache (1h).
let bankCache = null;
let bankCachedAt = 0;
const BANK_TTL = 60 * 60 * 1000;

// KatPay → Paystack code overrides for banks whose codes differ and whose names
// don't reliably match. Extend as more fintech mismatches surface.
const CODE_OVERRIDES = {
  '100004': '999992', // OPay
};

const norm = (s) => (s || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');

// ─── Money / reference helpers ────────────────────────────────────────────────

/** Naira → kobo. Rounds to the nearest kobo so float drift can't underpay. */
const toKobo = (naira) => Math.round(Number(naira) * 100);

/** Kobo → naira. */
const fromKobo = (kobo) => Number(kobo) / 100;

/**
 * Paystack transfer references must be 16-50 chars of lowercase alphanumerics,
 * `-` or `_` (see the Transfer API docs - unlike initialize, `.` and `=` are
 * NOT allowed here). Our ledger references are `WIT-<uuid>` / `TRF-<uuid>` (40
 * chars), which are already valid once lowercased. This normalises arbitrary
 * callers and pads anything too short so the request is never rejected on form.
 */
const toTransferReference = (reference) => {
  const cleaned = String(reference || '').toLowerCase().replace(/[^a-z0-9\-_]/g, '');
  if (cleaned.length >= 16) return cleaned.slice(0, 50);
  return `${cleaned}${'0'.repeat(16 - cleaned.length)}`.slice(0, 50);
};

/** Where Paystack redirects the payer after a hosted checkout completes. */
const callbackUrl = () => config.PAYSTACK_CALLBACK_URL || 'https://api.iprime.ng/webhooks/paystack';

/**
 * Build an AppError for a failed Paystack API call, tagging `definitive` so the
 * payment worker can tell a hard rejection (money never left → refund safe) from
 * an ambiguous failure (may have gone out → hold/retry, never refund).
 *
 * Definitive = the provider actively rejected the request:
 *   - 4xx other than 408 (timeout) / 429 (rate limit), AND
 *   - not a "transfer requires OTP" or "reference already exists" response,
 *     both of which mean the payout may still be in flight.
 * Everything else (network, timeout, bare 5xx) is ambiguous.
 */
const payoutError = (err, providerMessage) => {
  const status = err.response?.status;
  const message = providerMessage || err.response?.data?.message || err.message || 'Payout failed';
  const inFlight = /otp|already exists|already been (created|used)/i.test(message);
  const definitive = Boolean(!inFlight && status && status >= 400 && status < 500 && status !== 408 && status !== 429);
  const error = AppError.internal('Payout failed');
  error.definitive = definitive;
  error.providerStatus = status || null;
  error.providerMessage = message;
  return error;
};

// ─── Bank list & account name resolution (gateway-independent) ─────────────────

/**
 * Full Paystack NGN bank list (cursor-paginated, cached 1h).
 */
const getBankList = async () => {
  if (bankCache && Date.now() - bankCachedAt < BANK_TTL) return bankCache;

  const all = [];
  let next = null;
  for (let page = 0; page < 10; page += 1) {
    const url = `${BASE()}/bank?currency=NGN&perPage=100${next ? `&next=${encodeURIComponent(next)}` : ''}`;
    const res = await axios.get(url, { headers: authHeaders(), timeout: 20000 });
    const data = res.data?.data || [];
    all.push(...data);
    next = res.data?.meta?.next;
    if (!next) break;
  }

  bankCache = all;
  bankCachedAt = Date.now();
  return all;
};

/**
 * Resolve the Paystack bank code for a bank the caller picked from KatPay's list.
 * Returns null if no confident match exists.
 */
const paystackCodeForKatpayBank = async (katpayCode) => {
  const code = String(katpayCode);
  if (CODE_OVERRIDES[code]) return CODE_OVERRIDES[code];

  const psBanks = await getBankList();

  // Traditional banks share the NIP code across providers.
  if (psBanks.find((b) => String(b.code) === code)) return code;

  // Otherwise match by name, using KatPay's name for this code.
  let katName = null;
  try {
    const katRaw = await katpayService.getBankList();
    const katArr = Array.isArray(katRaw) ? katRaw : katRaw?.banks || katRaw?.items || [];
    katName = katArr.find((b) => String(b.bankCode || b.code) === code)?.bankName;
  } catch (err) {
    logger.warn('KatPay bank list unavailable for code mapping', { error: err.message });
  }

  if (katName) {
    const n = norm(katName);
    const hit = psBanks.find((b) => {
      const bn = norm(b.name);
      return bn === n || bn.includes(n) || n.includes(bn);
    });
    if (hit) return String(hit.code);
  }
  return null;
};

/**
 * Resolve the account holder name. `bankCode` is the KATPAY code the dashboards
 * use. Throws AppError.badRequest on any failure so callers return a clean 4xx
 * (never a 500) and can fall back to a typed name.
 */
const resolveAccountName = async ({ accountNumber, bankCode }) => {
  if (!isConfigured()) {
    throw AppError.badRequest('Account verification is not available right now');
  }

  const psCode = await paystackCodeForKatpayBank(bankCode);
  if (!psCode) {
    throw AppError.badRequest('This bank is not supported for verification');
  }

  try {
    const res = await axios.get(
      `${BASE()}/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(psCode)}`,
      { headers: authHeaders(), timeout: 20000 },
    );
    const accountName = res.data?.data?.account_name;
    if (!accountName) throw AppError.badRequest('Could not verify this account');
    return { accountName, accountNumber, bankCode };
  } catch (err) {
    if (err instanceof AppError) throw err;
    const message = err.response?.data?.message;
    logger.warn('Paystack resolve failed', {
      bankCode, psCode, status: err.response?.status, message,
    });
    throw AppError.badRequest(message || 'Could not verify this account. Check the bank and account number.');
  }
};

// ─── Customers & Dedicated Virtual Accounts (funding) ─────────────────────────

/**
 * Look up a Paystack customer by email. Returns null if not found.
 */
const getCustomerByEmail = async (email) => {
  try {
    const res = await axios.get(`${BASE()}/customer/${encodeURIComponent(email)}`, {
      headers: authHeaders(), timeout: 20000,
    });
    const data = res.data?.data;
    if (!data) return null;
    return { customerCode: data.customer_code, id: data.id, email: data.email };
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
};

/**
 * Create a Paystack customer (idempotent on email).
 *
 * Paystack returns the existing customer when the email already exists, but we
 * still fall back to a lookup on the duplicate-error paths seen in the wild so
 * provisioning retries never wedge on an already-created customer.
 */
const createCustomer = async ({ email, firstName, lastName, phone }) => {
  if (!isConfigured()) throw AppError.internal('Paystack is not configured');
  try {
    const res = await axios.post(`${BASE()}/customer`, {
      email,
      first_name: firstName || undefined,
      last_name: lastName || undefined,
      phone: phone || undefined,
    }, { headers: authHeaders(), timeout: 30000 });
    const data = res.data?.data || {};
    return { customerCode: data.customer_code, id: data.id, email: data.email };
  } catch (err) {
    const status = err.response?.status;
    if (status === 400 || status === 409) {
      const existing = await getCustomerByEmail(email).catch(() => null);
      if (existing) return existing;
    }
    logger.error('Paystack createCustomer failed', {
      email, status, message: err.response?.data?.message || err.message,
    });
    throw AppError.internal('Failed to create payment customer');
  }
};

/**
 * Fetch an existing Dedicated Virtual Account for a customer, if any. Used to
 * make provisioning idempotent: a retry that hits "customer already has a
 * dedicated account" should adopt the existing one, not fail.
 */
const fetchDedicatedAccount = async (customerCode) => {
  const res = await axios.get(
    `${BASE()}/dedicated_account?customer=${encodeURIComponent(customerCode)}`,
    { headers: authHeaders(), timeout: 20000 },
  );
  const rows = res.data?.data || [];
  const data = Array.isArray(rows) ? rows[0] : null;
  if (!data) return null;
  return {
    accountNumber: data.account_number,
    bankName: data.bank?.name || data.bank_name || 'Wema Bank',
    accountName: data.account_name || 'Wallet',
    dedicatedAccountId: data.id != null ? String(data.id) : null,
    customerCode: data.customer?.customer_code || customerCode,
  };
};

/**
 * Assign a Dedicated Virtual Account (funding NUBAN) to a Paystack customer.
 *
 * BVN is only forwarded for the `/dedicated_account/assign` flow (not the plain
 * create endpoint we use here) - and since iPrime stores only a bcrypt hash of
 * the BVN, no plaintext is ever available anyway. Returns the wallet-facing
 * fields the provisioning worker persists (`virtualAccountNumber` = DVA number).
 * A duplicate DVA response is resolved by adopting the customer's existing
 * dedicated account.
 *
 * The platform uses Wema Bank ONLY (payments rails, funding copy and bank-name
 * display all assume Wema); a different preferred_bank is never requested.
 */
const assignDva = async ({ customerCode, bvn, firstName, lastName, phone, preferredBank }) => {
  if (!isConfigured()) throw AppError.internal('Paystack is not configured');
  if (!customerCode) throw AppError.internal('Paystack customer code is required for DVA provisioning');

  // Wema Bank is the platform's only DVA bank; any other provider is forced back.
  const body = { customer: customerCode, preferred_bank: preferredBank === 'wema-bank' ? preferredBank : 'wema-bank' };
  if (firstName) body.first_name = firstName;
  if (lastName) body.last_name = lastName;
  if (phone) body.phone = phone;

  try {
    const res = await axios.post(`${BASE()}/dedicated_account`, body, { headers: authHeaders(), timeout: 30000 });
    const data = res.data?.data || {};
    const accountNumber = data.account_number;
    if (!accountNumber) throw AppError.internal('Paystack did not return an account number');
    return {
      accountNumber,
      bankName: data.bank?.name || data.bank_name || preferredBank,
      accountName: data.account_name || `${firstName || ''} ${lastName || ''}`.trim() || 'Wallet',
      dedicatedAccountId: data.id != null ? String(data.id) : null,
      customerCode: data.customer?.customer_code || customerCode,
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    const status = err.response?.status;
    const message = err.response?.data?.message || err.message;
    // Retry may collide with an already-assigned DVA - adopt it instead of failing.
    if (status === 400 || status === 409) {
      const existing = await fetchDedicatedAccount(customerCode).catch(() => null);
      if (existing) return existing;
    }
    logger.error('Paystack assignDva failed', { customerCode, status, message });
    throw AppError.internal('Failed to provision wallet account');
  }
};

// ─── Transfer recipients & payouts (withdrawals/transfers) ────────────────────

/**
 * Create a transfer recipient for a NUBAN. `bankCode` MUST be a Paystack code -
 * callers holding a KatPay code should use `createRecipientFromKatpayBank`.
 */
const createTransferRecipient = async ({ name, accountNumber, bankCode, currency = 'NGN' }) => {
  if (!isConfigured()) throw AppError.internal('Paystack is not configured');
  try {
    const res = await axios.post(`${BASE()}/transferrecipient`, {
      type: 'nuban',
      name: name || accountNumber,
      account_number: String(accountNumber),
      bank_code: String(bankCode),
      currency,
    }, { headers: authHeaders(), timeout: 30000 });
    const data = res.data?.data || {};
    if (!data.recipient_code) throw AppError.internal('Paystack did not return a recipient code');
    return { recipientCode: data.recipient_code, id: data.id, details: data.details };
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error('Paystack createTransferRecipient failed', {
      accountNumber, status: err.response?.status, message: err.response?.data?.message || err.message,
    });
    throw AppError.internal('Failed to prepare payout recipient');
  }
};

/**
 * Create a transfer recipient from a KATPAY bank code (what the dashboards and
 * saved beneficiaries store). Maps the code across, then creates the recipient.
 * Throws a clean 4xx when the bank can't be mapped so the caller can surface it.
 */
const createRecipientFromKatpayBank = async ({ name, accountNumber, katpayBankCode }) => {
  const psCode = await paystackCodeForKatpayBank(katpayBankCode);
  if (!psCode) throw AppError.badRequest('This bank is not supported for payouts');
  return createTransferRecipient({ name, accountNumber, bankCode: psCode });
};

/**
 * Initiate a payout (transfer) from the Paystack balance to a recipient.
 *
 * Requires transfer OTP to be disabled on the Paystack dashboard; an OTP
 * response is classified as ambiguous so we never auto-refund a payout that may
 * still go out. On error, `.definitive` distinguishes a safe refund from a
 * hold-and-reconcile.
 */
const initiatePayout = async ({ amount, recipientCode, reference, reason, currency = 'NGN', source = 'balance' }) => {
  if (!isConfigured()) throw AppError.internal('Paystack is not configured');
  if (!recipientCode) throw AppError.internal('Paystack recipient code is required for payouts');

  const ref = toTransferReference(reference);
  try {
    const res = await axios.post(`${BASE()}/transfer`, {
      source,
      amount: toKobo(amount),
      recipient: recipientCode,
      reason: reason || 'Wallet withdrawal',
      reference: ref,
      currency,
    }, { headers: authHeaders(), timeout: 30000 });

    const data = res.data?.data || {};
    return {
      reference: data.reference || ref,
      transferCode: data.transfer_code || null,
      status: data.status || 'pending',
    };
  } catch (err) {
    const error = payoutError(err, err.response?.data?.message);
    logger.error('Paystack initiatePayout failed', {
      reference: ref, status: error.providerStatus, definitive: error.definitive, message: error.providerMessage,
    });
    throw error;
  }
};

/** Verify a transfer's outcome by reference. Returns the normalised status. */
const verifyTransfer = async (reference) => {
  if (!isConfigured()) throw AppError.internal('Paystack is not configured');
  try {
    const res = await axios.get(`${BASE()}/transfer/verify/${encodeURIComponent(reference)}`, {
      headers: authHeaders(), timeout: 20000,
    });
    const data = res.data?.data || {};
    return {
      reference: data.reference || reference,
      status: data.status,
      transferCode: data.transfer_code || null,
      amount: data.amount != null ? fromKobo(data.amount) : null,
      reason: data.reason || null,
      recipient: data.recipient || null,
    };
  } catch (err) {
    logger.error('Paystack verifyTransfer failed', {
      reference, status: err.response?.status, message: err.response?.data?.message || err.message,
    });
    throw AppError.internal('Failed to verify payout');
  }
};

// ─── Hosted checkout (ad-hoc wallet top-ups) ──────────────────────────────────

/**
 * Initialise a hosted checkout transaction. Returns `{ reference, checkout_url }`
 * so the wallet funding path can normalise KatPay (`uuid`/`checkout_url`) and
 * Paystack (`reference`/`authorization_url`) behind one envelope.
 */
const initializeTransaction = async ({ amount, email, reference, metadata, currency = 'NGN' }) => {
  if (!isConfigured()) throw AppError.internal('Paystack is not configured');
  if (!email) throw AppError.badRequest('Customer email is required to start a payment');

  try {
    const res = await axios.post(`${BASE()}/transaction/initialize`, {
      email,
      amount: toKobo(amount),
      reference,
      currency,
      callback_url: callbackUrl(),
      metadata,
    }, { headers: authHeaders(), timeout: 30000 });

    const data = res.data?.data || {};
    if (!data.authorization_url) throw AppError.internal('Paystack did not return a checkout URL');
    return {
      reference: data.reference || reference,
      checkout_url: data.authorization_url,
      access_code: data.access_code || null,
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    const message = err.response?.data?.message || err.message;
    logger.error('Paystack initializeTransaction failed', {
      reference, status: err.response?.status, message,
    });
    throw AppError.badRequest(message || 'Failed to start payment');
  }
};

/** Verify a checkout transaction by reference. Returns the normalised status. */
const verifyTransaction = async (reference) => {
  if (!isConfigured()) throw AppError.internal('Paystack is not configured');
  try {
    const res = await axios.get(`${BASE()}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: authHeaders(), timeout: 20000,
    });
    const data = res.data?.data || {};
    return {
      reference: data.reference || reference,
      status: data.status,
      amount: data.amount != null ? fromKobo(data.amount) : null,
      currency: data.currency || null,
      channel: data.channel || null,
      customerCode: data.customer?.customer_code || null,
      customer: data.customer || null,
      authorization: data.authorization || null,
      metadata: data.metadata || null,
      gatewayResponse: data.gateway_response || null,
      paidAt: data.paid_at || null,
    };
  } catch (err) {
    logger.error('Paystack verifyTransaction failed', {
      reference, status: err.response?.status, message: err.response?.data?.message || err.message,
    });
    throw AppError.internal('Failed to verify payment');
  }
};

// ─── Webhook verification ─────────────────────────────────────────────────────

/**
 * Verify a Paystack webhook signature: HMAC-SHA512 of the RAW request body,
 * keyed with the secret key, hex-encoded, sent in `x-paystack-signature`.
 *
 * The raw bytes MUST be used - re-serialising the parsed JSON changes the bytes
 * and always fails. Timing-safe comparison prevents signature oracle attacks.
 */
const verifyWebhookSignature = (rawBody, signature) => {
  try {
    if (!signature) return false;
    const payload = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), 'utf8');
    const expected = crypto.createHmac('sha512', config.PAYSTACK_SECRET_KEY).update(payload).digest('hex');
    const expectedBuf = Buffer.from(expected);
    const signatureBuf = Buffer.from(String(signature));
    if (expectedBuf.length !== signatureBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, signatureBuf);
  } catch {
    return false;
  }
};

module.exports = {
  isConfigured,
  toKobo,
  fromKobo,
  toTransferReference,
  callbackUrl,
  getBankList,
  paystackCodeForKatpayBank,
  resolveAccountName,
  getCustomerByEmail,
  createCustomer,
  assignDva,
  fetchDedicatedAccount,
  createTransferRecipient,
  createRecipientFromKatpayBank,
  initiatePayout,
  verifyTransfer,
  initializeTransaction,
  verifyTransaction,
  verifyWebhookSignature,
};
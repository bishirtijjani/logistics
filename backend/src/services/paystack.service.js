/**
 * Paystack service - the PRIMARY payment provider after the KatPay migration.
 *
 * Covers the full money surface:
 *   - Dedicated Virtual Accounts (DVA) for wallet funding (replaces KatPay NUBANs)
 *   - Transfers for payouts/withdrawals (replaces KatPay payouts)
 *   - Initialize Transaction for ad-hoc top-ups (replaces KatPay transfer-payments)
 *   - Bank list + account-name resolve (resolve was already here)
 *   - Webhook signature verification (HMAC-SHA512)
 *
 * MONEY UNIT: Paystack speaks KOBO. Every naira amount we send is x100 and every
 * amount we read back is /100. Conversion is centralized in `toKobo` / `fromKobo`
 * and applied at the API boundary so callers always work in naira.
 */
const axios = require('axios');
const crypto = require('crypto');
const { config } = require('../config');
const { logger } = require('../utils/logger');
const { AppError } = require('../utils/api-error');

const BASE = () => config.PAYSTACK_BASE_URL || 'https://api.paystack.co';
const authHeaders = () => ({
  Authorization: `Bearer ${config.PAYSTACK_SECRET_KEY}`,
  'Content-Type': 'application/json',
});
const isConfigured = () => Boolean(config.PAYSTACK_SECRET_KEY);

// Default DVA sponsor bank. 'wema-bank' and 'titan-paystack' are the live
// options; pass `preferredBank: 'test-bank'` in Paystack test mode.
const DEFAULT_DVA_BANK = 'wema-bank';

// ─── Money helpers ────────────────────────────────────────────────────────────
const toKobo = (naira) => Math.round(Number(naira) * 100);
const fromKobo = (kobo) => Number(kobo) / 100;

// Paystack bank list cache (1h).
let bankCache = null;
let bankCachedAt = 0;
const BANK_TTL = 60 * 60 * 1000;

/**
 * Classify an axios error the way the withdrawal worker needs it.
 * "definitive" = the provider actively rejected the request with a 4xx (other
 * than 408/429), so the money definitely did NOT move and a refund is safe.
 * Everything else (timeout, network drop, 5xx, 408/429) is AMBIGUOUS - the
 * action MAY have taken effect, so callers must retry, never refund.
 */
const decorateProviderError = (error, fallbackMessage) => {
  const status = error.response?.status;
  const definitive = Boolean(status && status >= 400 && status < 500 && status !== 408 && status !== 429);
  const err = AppError.internal(fallbackMessage);
  err.definitive = definitive;
  err.providerStatus = status || null;
  err.providerMessage = error.response?.data?.message || error.message;
  return err;
};

// ─── Customers + Dedicated Virtual Accounts (funding) ─────────────────────────

/**
 * Create (or fetch existing) a Paystack customer. POST /customer returns the
 * existing record when the email already exists, so this is effectively
 * idempotent on email. first_name/last_name/phone are required by Paystack for
 * financial-services businesses that will be assigned a DVA.
 */
const createCustomer = async ({ email, firstName, lastName, phone }) => {
  try {
    const res = await axios.post(
      `${BASE()}/customer`,
      { email, first_name: firstName, last_name: lastName, phone },
      { headers: authHeaders(), timeout: 30000 },
    );
    const data = res.data?.data || {};
    return { customerCode: data.customer_code, customerId: data.id != null ? String(data.id) : null };
  } catch (error) {
    logger.error('Paystack createCustomer failed', {
      email, httpStatus: error.response?.status, responseBody: error.response?.data, message: error.message,
    });
    throw decorateProviderError(error, 'Failed to create payment customer');
  }
};

/**
 * Provision a Dedicated Virtual Account (permanent NUBAN) for a user. Mirrors
 * the old `katpayService.createVirtualAccount` shape so the callers (KYC flow +
 * provisioning worker) change as little as possible, but ALSO returns the
 * Paystack `customerCode` so we can persist it for later DVA/transfer ops and to
 * match the funder on charge.success.
 *
 * Two synchronous steps so the response carries the NUBAN immediately:
 *   1. POST /customer        → customer_code
 *   2. POST /dedicated_account → account_number / bank / account_name
 */
const createVirtualAccount = async ({ email, firstName, lastName, phone, customerCode, preferredBank }) => {
  const startedAt = Date.now();
  try {
    const code = customerCode || (await createCustomer({ email, firstName, lastName, phone })).customerCode;
    if (!code) throw AppError.internal('Paystack customer has no customer_code');

    const res = await axios.post(
      `${BASE()}/dedicated_account`,
      { customer: code, preferred_bank: preferredBank || DEFAULT_DVA_BANK },
      { headers: authHeaders(), timeout: 30000 },
    );
    const data = res.data?.data || {};

    logger.info('Paystack DVA provisioned', {
      email, durationMs: Date.now() - startedAt, accountNumber: data.account_number, bank: data.bank?.name,
    });

    return {
      accountNumber: data.account_number,
      bankName: data.bank?.name || data.bank?.slug || null,
      accountName: data.account_name || `${firstName} ${lastName}`.trim(),
      customerCode: code,
      dedicatedAccountId: data.id != null ? String(data.id) : null,
    };
  } catch (error) {
    if (error instanceof AppError && error.definitive !== undefined) throw error;
    logger.error('Paystack createVirtualAccount failed', {
      email, durationMs: Date.now() - startedAt, httpStatus: error.response?.status,
      responseBody: error.response?.data, message: error.message,
    });
    throw decorateProviderError(error, 'Failed to create virtual account');
  }
};

// ─── Transfers (payouts / withdrawals) ────────────────────────────────────────

/**
 * Create a transfer recipient (NUBAN beneficiary). Returns recipient_code.
 */
const createTransferRecipient = async ({ name, accountNumber, bankCode }) => {
  try {
    const res = await axios.post(
      `${BASE()}/transferrecipient`,
      { type: 'nuban', name, account_number: accountNumber, bank_code: bankCode, currency: 'NGN' },
      { headers: authHeaders(), timeout: 30000 },
    );
    return res.data?.data?.recipient_code;
  } catch (error) {
    logger.error('Paystack createTransferRecipient failed', {
      bankCode, httpStatus: error.response?.status, responseBody: error.response?.data, message: error.message,
    });
    throw decorateProviderError(error, 'Failed to create transfer recipient');
  }
};

/**
 * Initiate a payout to a bank account. Drop-in for the old
 * `katpayService.initiatePayout({ amount, bank_code, account_number, account_name,
 * description, reference })`, so the withdrawal worker keeps its shape.
 *
 * IMPORTANT semantic difference from KatPay: a successful response here only
 * means the transfer was QUEUED (`status: 'pending'`). The terminal outcome
 * arrives asynchronously via the transfer.success / transfer.failed /
 * transfer.reversed webhook. Callers must NOT mark the withdrawal COMPLETED on
 * this return - they leave it dispatched (SENT) and let the webhook settle it.
 *
 * `reference` makes the transfer idempotent: re-initiating with the same
 * reference will not double-send, so retries are safe.
 *
 * Errors carry { definitive, providerStatus, providerMessage } exactly like the
 * KatPay service so the worker's refund-vs-retry logic is unchanged.
 */
const initiatePayout = async ({ amount, bank_code, account_number, account_name, description, reference }) => {
  // 1. Recipient (a 4xx here is definitive: nothing was sent).
  const recipientCode = await createTransferRecipient({
    name: account_name || account_number,
    accountNumber: account_number,
    bankCode: bank_code,
  });

  // 2. Transfer from the Paystack balance.
  let data;
  try {
    const res = await axios.post(
      `${BASE()}/transfer`,
      {
        source: 'balance',
        amount: toKobo(amount),
        recipient: recipientCode,
        reference,
        reason: description || 'Withdrawal',
      },
      { headers: authHeaders(), timeout: 30000 },
    );
    data = res.data?.data || {};
  } catch (error) {
    logger.error('Paystack initiatePayout failed', {
      reference, httpStatus: error.response?.status, responseBody: error.response?.data, message: error.message,
    });
    throw decorateProviderError(error, 'Payout failed');
  }

  // OTP must be disabled (Dashboard → Preferences) for programmatic transfers.
  // If it isn't, Paystack parks the transfer awaiting an OTP we can't supply.
  // Treat as AMBIGUOUS (not definitive) so we never auto-refund a transfer that
  // an admin might finalize manually; surface loudly for ops to disable OTP.
  if (data.status === 'otp') {
    logger.error('Paystack transfer is awaiting OTP - disable OTP in Preferences', { reference, transferCode: data.transfer_code });
    const err = AppError.internal('Transfer requires OTP; disable OTP for programmatic transfers');
    err.definitive = false;
    err.providerStatus = 200;
    err.providerMessage = 'transfer awaiting OTP';
    throw err;
  }

  logger.info('Paystack payout initiated', { reference, amount, status: data.status, transferCode: data.transfer_code });
  return {
    status: data.status, // 'pending' | 'success' (test) | ...
    transferCode: data.transfer_code,
    reference: data.reference || reference,
    recipientCode,
    raw: data,
  };
};

/**
 * Verify a transfer's current status by our own reference. Used by
 * reconciliation to resolve payouts left dispatched (SENT) with no webhook -
 * something KatPay could not do (no payout-status endpoint).
 * Returns { status, raw } where status ∈ success|failed|reversed|pending|otp|abandoned.
 */
const getTransferStatus = async (reference) => {
  try {
    const res = await axios.get(
      `${BASE()}/transfer/verify/${encodeURIComponent(reference)}`,
      { headers: authHeaders(), timeout: 20000 },
    );
    const data = res.data?.data || {};
    return { status: data.status, amount: data.amount != null ? fromKobo(data.amount) : null, raw: data };
  } catch (error) {
    logger.warn('Paystack getTransferStatus failed', {
      reference, httpStatus: error.response?.status, message: error.message,
    });
    throw decorateProviderError(error, 'Failed to fetch transfer status');
  }
};

// ─── Initialize Transaction (ad-hoc top-up) ───────────────────────────────────

/**
 * Start a hosted checkout for a typed-amount wallet top-up. Returns the
 * authorization_url the client opens; funding is confirmed via charge.success.
 */
const initializeTransaction = async ({ email, amount, reference, metadata, callbackUrl }) => {
  try {
    const res = await axios.post(
      `${BASE()}/transaction/initialize`,
      {
        email,
        amount: toKobo(amount),
        reference,
        metadata,
        ...(callbackUrl ? { callback_url: callbackUrl } : {}),
      },
      { headers: authHeaders(), timeout: 30000 },
    );
    const data = res.data?.data || {};
    logger.info('Paystack transaction initialized', { reference, amount });
    return {
      authorizationUrl: data.authorization_url,
      accessCode: data.access_code,
      reference: data.reference || reference,
    };
  } catch (error) {
    logger.error('Paystack initializeTransaction failed', {
      reference, httpStatus: error.response?.status, responseBody: error.response?.data, message: error.message,
    });
    throw decorateProviderError(error, 'Failed to initialize payment');
  }
};

/**
 * Verify a transaction (top-up) by reference. Returns naira amount + status.
 */
const verifyTransaction = async (reference) => {
  try {
    const res = await axios.get(
      `${BASE()}/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: authHeaders(), timeout: 20000 },
    );
    const data = res.data?.data || {};
    return { status: data.status, amount: data.amount != null ? fromKobo(data.amount) : null, raw: data };
  } catch (error) {
    logger.warn('Paystack verifyTransaction failed', {
      reference, httpStatus: error.response?.status, message: error.message,
    });
    throw decorateProviderError(error, 'Failed to verify payment');
  }
};

// ─── Bank list + account resolve ──────────────────────────────────────────────

/**
 * Full Paystack NGN bank list (cursor-paginated, cached 1h). Returns the raw
 * Paystack objects ({ name, code, ... }); the wallet controller normalizes to
 * { bankCode, bankName } for the apps.
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
 * Resolve the account holder name. `bankCode` is now a Paystack bank code
 * directly (the apps populate their picker from Paystack's bank list), so there
 * is no cross-provider code mapping any more. Throws AppError.badRequest on any
 * failure so callers return a clean 4xx and can fall back to a typed name.
 */
const resolveAccountName = async ({ accountNumber, bankCode }) => {
  if (!isConfigured()) {
    throw AppError.badRequest('Account verification is not available right now');
  }
  try {
    const res = await axios.get(
      `${BASE()}/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
      { headers: authHeaders(), timeout: 20000 },
    );
    const accountName = res.data?.data?.account_name;
    if (!accountName) throw AppError.badRequest('Could not verify this account');
    return { accountName, accountNumber, bankCode };
  } catch (err) {
    if (err instanceof AppError) throw err;
    const message = err.response?.data?.message;
    logger.warn('Paystack resolve failed', { bankCode, status: err.response?.status, message });
    throw AppError.badRequest(message || 'Could not verify this account. Check the bank and account number.');
  }
};

// ─── Webhooks ─────────────────────────────────────────────────────────────────

/**
 * Verify a Paystack webhook. Paystack signs the RAW request body with
 * HMAC-SHA512 using the secret key and sends it as `x-paystack-signature`.
 * Constant-time compare. Returns true/false.
 */
const verifyWebhookSignature = (rawBody, signature) => {
  try {
    if (!signature || !config.PAYSTACK_SECRET_KEY) return false;
    const expected = crypto
      .createHmac('sha512', config.PAYSTACK_SECRET_KEY)
      .update(rawBody)
      .digest('hex');
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
  createCustomer,
  createVirtualAccount,
  createTransferRecipient,
  initiatePayout,
  getTransferStatus,
  initializeTransaction,
  verifyTransaction,
  getBankList,
  resolveAccountName,
  verifyWebhookSignature,
};

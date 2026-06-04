const axios = require('axios');
const crypto = require('crypto');
const { config } = require('../config');
const { logger } = require('../utils/logger');
const { AppError } = require('../utils/api-error');

const BASE_URL = () => config.KATPAY_BASE_URL;

const authHeaders = () => ({
  Authorization: `Bearer ${config.KATPAY_API_SECRET}`,
  'api-key': config.KATPAY_PUBLIC_KEY,
  'Content-Type': 'application/json',
});

// Bank list cache — refreshed every hour
let bankListCache = null;
let bankListCachedAt = null;
const BANK_CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Create a permanent virtual account for a user (wallet funding).
 */
const createVirtualAccount = async ({ email, name, phoneNumber, bankCodes, merchantID }) => {
  const startedAt = Date.now();
  const requestBody = {
    email,
    name,
    phoneNumber,
    bankCode: bankCodes || ['PALMPAY', 'OPAY', '20897'],
    merchantID: merchantID || config.KATPAY_MERCHANT_ID,
  };
  logger.info('KatPay createVirtualAccount started', { email, phoneNumber, bankCode: requestBody.bankCode });

  try {
    const response = await axios.post(
      `${BASE_URL()}/v1/virtual-accounts`,
      requestBody,
      { headers: authHeaders(), timeout: 30000 },
    );

    const data = response.data?.data || response.data;
    const durationMs = Date.now() - startedAt;

    logger.info('KatPay createVirtualAccount succeeded', {
      email,
      durationMs,
      httpStatus: response.status,
      accountNumber: data.accountNumber || data.account_number,
      bankName: data.bankName || data.bank_name,
    });

    return {
      accountNumber: data.accountNumber || data.account_number,
      bankName: data.bankName || data.bank_name,
      accountName: data.accountName || data.account_name || name,
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    logger.error('KatPay createVirtualAccount failed', {
      email,
      durationMs,
      httpStatus: error.response?.status,
      code: error.code, // ECONNABORTED on timeout, ENOTFOUND on DNS, etc.
      responseBody: error.response?.data,
      message: error.message,
    });
    throw AppError.internal('Failed to create virtual account');
  }
};

/**
 * Send funds to a Nigerian bank account (merchant/user withdrawal).
 */
const initiatePayout = async ({ amount, bank_code, account_number, account_name, description, reference }) => {
  try {
    const response = await axios.post(
      `${BASE_URL()}/v1/payouts`,
      {
        amount,
        bank_code,
        account_number,
        account_name,
        description: description || 'Withdrawal',
        reference,
      },
      { headers: authHeaders(), timeout: 30000 }
    );

    const data = response.data?.data || response.data;

    logger.info('KatPay payout initiated', { reference, amount });

    return data;
  } catch (error) {
    const status = error.response?.status;
    // "definitive" = the provider actively rejected the request (a 4xx other than
    // 408/429), so the money definitely did NOT leave and a refund is safe.
    // Everything else (timeout, network drop, 5xx, 408/429) is AMBIGUOUS — the
    // payout MAY have settled, so callers must retry, never refund.
    const definitive = Boolean(status && status >= 400 && status < 500 && status !== 408 && status !== 429);
    logger.error('KatPay initiatePayout failed', { error: error.response?.data || error.message, reference, status, definitive });
    const err = AppError.internal('Payout failed');
    err.definitive = definitive;
    err.providerStatus = status || null;
    err.providerMessage = error.response?.data?.message || error.message;
    throw err;
  }
};

/**
 * Initiate a one-time transfer payment (returns checkout URL + dedicated account).
 */
const initiateTransferPayment = async ({
  amount,
  customer,
  callback_url,
  success_url,
  merchant_reference,
  metadata,
  expiry_minutes,
}) => {
  try {
    const response = await axios.post(
      `${BASE_URL()}/v1/transfer-payments`,
      {
        amount,
        customer,
        callback_url: callback_url || config.KATPAY_CALLBACK_URL,
        success_url,
        merchant_reference,
        metadata,
        expiry_minutes: expiry_minutes || 30,
      },
      { headers: authHeaders() }
    );

    const data = response.data?.data || response.data;

    logger.info('KatPay transfer payment initiated', { merchant_reference, amount });

    return {
      uuid: data.uuid,
      checkout_url: data.checkout_url,
      payment_account: data.payment_account,
      expires_at: data.expires_at,
    };
  } catch (error) {
    logger.error('KatPay initiateTransferPayment failed', { error: error.response?.data || error.message });
    throw AppError.internal('Failed to initiate transfer payment');
  }
};

/**
 * Get status of a transfer payment by UUID.
 */
const getTransferPayment = async (uuid) => {
  try {
    const response = await axios.get(
      `${BASE_URL()}/v1/transfer-payments/${uuid}`,
      { headers: authHeaders() }
    );
    return response.data?.data || response.data;
  } catch (error) {
    logger.error('KatPay getTransferPayment failed', { uuid, error: error.response?.data || error.message });
    throw AppError.internal('Failed to fetch transfer payment');
  }
};

/**
 * Get list of supported banks (cached for 1 hour).
 */
const getBankList = async () => {
  if (bankListCache && bankListCachedAt && Date.now() - bankListCachedAt < BANK_CACHE_TTL) {
    return bankListCache;
  }

  try {
    const response = await axios.get(
      `${BASE_URL()}/api/bank-list`,
      { headers: authHeaders() }
    );
    bankListCache = response.data?.data || response.data || [];
    bankListCachedAt = Date.now();
    return bankListCache;
  } catch (error) {
    logger.error('KatPay getBankList failed', { error: error.response?.data || error.message });
    // Return cached version if available, even if stale
    if (bankListCache) return bankListCache;
    throw AppError.internal('Failed to fetch bank list');
  }
};

/**
 * Verify a KatPay webhook signature.
 * Formula: HMAC-SHA256(timestamp + "." + rawBody, api_secret)
 * KatPay uses the same API secret key for webhook signing.
 * Returns true if valid, false otherwise.
 */
const verifyWebhookSignature = (timestamp, rawBody, signature) => {
  try {
    const payload = `${timestamp}.${rawBody}`;
    const expected = crypto
      .createHmac('sha256', config.KATPAY_API_SECRET)
      .update(payload)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    const expectedBuf = Buffer.from(expected);
    const signatureBuf = Buffer.from(signature);
    if (expectedBuf.length !== signatureBuf.length) return false;

    return crypto.timingSafeEqual(expectedBuf, signatureBuf);
  } catch {
    return false;
  }
};

/**
 * Check if a webhook timestamp is within the allowed window (5 minutes).
 */
const isTimestampFresh = (timestamp) => {
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) return false;
  const ageMs = Date.now() - ts * 1000;
  return ageMs >= 0 && ageMs < 5 * 60 * 1000;
};

module.exports = {
  createVirtualAccount,
  initiatePayout,
  initiateTransferPayment,
  getTransferPayment,
  getBankList,
  verifyWebhookSignature,
  isTimestampFresh,
};

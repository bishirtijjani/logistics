/**
 * AirtimeToCash Automation API service.
 * Base URL: https://automation.airtimetocash.com
 * Auth: Bearer token (from Developer's Module in dashboard)
 *
 * Flow (customer sells airtime for wallet cash):
 *   1. generateOtp({ network, sender })           → sends OTP to customer's SIM
 *   2. verifyOtp({ network, sender, otp })        → returns sessionId + airtime balance
 *   3. checkQuotaAvailability({ network, amount }) → confirm a pool recipient exists
 *   4. transferAirtime({ ..., pin, sessionId })   → executes the gifting; returns
 *                                                   2000=success, 4000=pending, else=fail
 *
 * IMPORTANT: There is NO webhook and NO query-by-reference endpoint. Pending
 * (code 4000) transactions require manual reconciliation via the dashboard.
 *
 * Networks (case-sensitive in API): MTN, AIRTEL, GLO, 9MOBILE.
 *   9mobile rebranded as T2mobile but the API code is still 9MOBILE - keep it.
 *
 * Consumer rate (per airtimetocash.com): 80% on all networks. We assume the
 * same baseline applies on the API tier unless a partner agreement says otherwise.
 *
 * Amount range (consumer-facing, what they actually honor): ₦500 min / ₦1M per
 * day. The API doc claims ₦50 min and per-network maxes (MTN 10k, Airtel/9mob 20k,
 * Glo 1k) but the live floor is ₦500 - enforce that.
 *
 * Rate limit: 60 rpm standard, 100 rpm max, per IP.
 */

const axios = require('axios');
const { config } = require('../config');
const { logger } = require('../utils/logger');

const client = axios.create({
  baseURL: 'https://automation.airtimetocash.com',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 30000,
});

const _authHeaders = () => ({
  Authorization: `Bearer ${config.AIRTIMETOCASH_TOKEN}`,
});

const NETWORKS = ['MTN', 'AIRTEL', 'GLO', '9MOBILE'];

const AMOUNT_LIMITS = {
  MTN: { min: 500, max: 10000 },
  AIRTEL: { min: 500, max: 20000 },
  GLO: { min: 500, max: 1000 },
  '9MOBILE': { min: 500, max: 20000 },
};

/** Consumer-facing payout rate from airtimetocash.com - 80% across all networks. */
const PAYOUT_RATE = 0.8;

const generateOtp = async ({ network, sender }) => {
  const { data } = await client.post('/api/v1/generate/otp', {
    networkName: network,
    sender,
  });
  logger.info('AirtimeToCash generateOtp', { network, sender, code: data?.code });
  return data;
};

const verifyOtp = async ({ network, sender, otp }) => {
  const { data } = await client.post('/api/v1/verify/otp', {
    networkName: network,
    sender,
    otp,
  });
  logger.info('AirtimeToCash verifyOtp', { network, sender, code: data?.code });
  return data;
};

const loginWithSessionId = async ({ network, sender, sessionId }) => {
  const { data } = await client.post(
    '/api/v1/login/with/session/id',
    { networkName: network, sender, sessionId },
    { headers: _authHeaders() },
  );
  return data;
};

const checkQuotaAvailability = async ({ network, amount }) => {
  const { data } = await client.post(
    '/api/v1/check/quota/availability',
    { networkName: network, amount },
    { headers: _authHeaders() },
  );
  return data;
};

const transferAirtime = async ({ network, sender, amount, reference, pin, sessionId }) => {
  const { data } = await client.post(
    '/api/v1/transfer/airtime',
    {
      networkName: network,
      sender,
      amount,
      reference,
      pin,
      sessionId,
    },
    { headers: _authHeaders() },
  );
  logger.info('AirtimeToCash transferAirtime', {
    reference,
    network,
    amount,
    code: data?.code,
  });
  return data;
};

/** Provider response codes - body-level, not HTTP status. */
const CODES = {
  SUCCESS: 2000,
  FAILED: 3000,
  PENDING: 4000,
  SESSION_EXPIRED: 4010,
  FORBIDDEN: 4030,
  TOO_MANY_REQUESTS: 4290,
  UNAVAILABLE: 5030,
};

const isSuccess = (responseData) => responseData?.code === CODES.SUCCESS;

/**
 * Pending = code 4000 - the provider has accepted the transfer but it's stuck
 * mid-flight. There is no query endpoint, so callers must mark the transaction
 * PENDING_RECONCILIATION and surface it for manual admin review.
 */
const isPending = (responseData) => responseData?.code === CODES.PENDING;

const isFailure = (responseData) =>
  !!responseData && !isSuccess(responseData) && !isPending(responseData);

const isSessionExpired = (responseData) => responseData?.code === CODES.SESSION_EXPIRED;

const isRecipientUnavailable = (responseData) =>
  responseData?.code === CODES.UNAVAILABLE;

/**
 * Validate (network, amount) against the provider's published per-network
 * limits before we even call the API. Returns an error string or null.
 */
const validateAmount = (network, amount) => {
  const limits = AMOUNT_LIMITS[network];
  if (!limits) return `Unsupported network: ${network}`;
  const n = Number(amount);
  if (!Number.isFinite(n)) return 'Amount must be a number';
  if (n < limits.min) return `Minimum amount for ${network} is ₦${limits.min}`;
  if (n > limits.max) return `Maximum amount for ${network} is ₦${limits.max}`;
  return null;
};

module.exports = {
  generateOtp,
  verifyOtp,
  loginWithSessionId,
  checkQuotaAvailability,
  transferAirtime,
  isSuccess,
  isPending,
  isFailure,
  isSessionExpired,
  isRecipientUnavailable,
  validateAmount,
  NETWORKS,
  AMOUNT_LIMITS,
  PAYOUT_RATE,
  CODES,
};

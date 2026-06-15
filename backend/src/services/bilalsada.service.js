/**
 * BilalSadaSub VTU API service - Nigerian VTU/bills reseller.
 * Base URL: https://bilalsadasub.com
 *
 * AUTH (per the BilalSada docs): purchase endpoints use
 * `Authorization: Token <AccessToken>`. The AccessToken is the account's stable
 * API token, obtained from GET /api/user using HTTP Basic auth
 * (base64 of `username:password`), which also returns the wallet balance. We
 * generate the token from BILALSADASUB_USERNAME/PASSWORD on first use and cache
 * it. A pre-pasted BILALSADASUB_TOKEN (copied from the dashboard) is honoured
 * as-is and skips generation; if the cached token ever 401s and we have the
 * basic credentials, we regenerate once and retry.
 *
 * Network IDs:  MTN=1, AIRTEL=2, GLO=3, 9MOBILE=4   (NB: differs from AlRahuz)
 * Cable IDs:    GOTV=1, DSTV=2, STARTIME=3
 * MeterType:    sent as the lowercase strings 'prepaid' / 'postpaid'
 *
 * SYNCHRONOUS PROVIDER: every purchase endpoint returns a terminal
 * `status: "success" | "fail"` inline. BilalSada exposes NO transaction
 * query-by-id endpoint, and their webhook/callback is not operational, so
 * `queryTransaction` is a no-op (returns null). Safe retries rely on the
 * unique `request-id` we send: if a buy times out on our side, BullMQ retries
 * with the SAME request-id and BilalSada returns the original result instead
 * of vending twice. Anything we genuinely can't confirm is refunded after the
 * poll window expires (see utility.worker.js).
 */

const axios = require('axios');
const { config } = require('../config');
const { logger } = require('../utils/logger');

const BASE_URL = 'https://bilalsadasub.com';

const client = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// ── Auth ────────────────────────────────────────────────────────────────────
// Seed the cache from a pasted token if one is configured; otherwise it's
// generated lazily from username/password via _fetchUserInfo().
let _cachedToken = config.BILALSADASUB_TOKEN || null;

const _basicAuthHeader = () => {
  const { BILALSADASUB_USERNAME, BILALSADASUB_PASSWORD } = config;
  if (!BILALSADASUB_USERNAME || !BILALSADASUB_PASSWORD) return null;
  return `Basic ${Buffer.from(`${BILALSADASUB_USERNAME}:${BILALSADASUB_PASSWORD}`).toString('base64')}`;
};

// POST /api/user (Basic auth, empty body) → { status, AccessToken, balance,
// username }. NB: it must be POST - a GET returns HTTP 500 "contact admin".
// Caches the returned AccessToken. Returns null when basic creds are absent.
const _fetchUserInfo = async () => {
  const basic = _basicAuthHeader();
  if (!basic) return null;
  const { data } = await axios.post(`${BASE_URL}/api/user`, {}, {
    headers: { Authorization: basic },
    timeout: 30000,
  });
  if (data?.AccessToken) _cachedToken = data.AccessToken;
  return data;
};

// Resolve the bearer token, generating it from username/password on first use.
const _getToken = async () => {
  if (_cachedToken) return _cachedToken;
  await _fetchUserInfo();
  if (!_cachedToken) {
    throw new Error(
      'BilalSada auth not configured: set BILALSADASUB_USERNAME + BILALSADASUB_PASSWORD (or BILALSADASUB_TOKEN)',
    );
  }
  return _cachedToken;
};

// Token-authenticated request with a one-shot token refresh on 401 (the account
// token can be rotated server-side; regenerate from basic creds and retry once).
const _request = async (method, path, { body, params } = {}) => {
  const send = async (token) => {
    const { data } = await client.request({
      method,
      url: path,
      headers: { Authorization: `Token ${token}` },
      ...(body !== undefined ? { data: body } : {}),
      ...(params !== undefined ? { params } : {}),
    });
    return data;
  };
  try {
    return await send(await _getToken());
  } catch (err) {
    if (err.response?.status === 401 && _basicAuthHeader()) {
      logger.warn('BilalSada token rejected (401), regenerating');
      _cachedToken = null;
      return send(await _getToken());
    }
    throw err;
  }
};

// MeterType comes in as 'PREPAID' / 'POSTPAID' from utility.service; BilalSada
// wants the lowercase string (not the 1/2 codes AlRahuz used).
const _meterType = (meterType) => String(meterType || '').toLowerCase();

const buyAirtime = async ({ networkId, phone, amount, requestId }) => {
  const data = await _request('post', '/api/topup', {
    body: {
      network: networkId,
      phone,
      amount,
      plan_type: 'VTU',
      bypass: false,
      'request-id': requestId,
    },
  });
  logger.info('BilalSada airtime', { networkId, phone, amount, requestId, data });
  return data;
};

const buyData = async ({ networkId, phone, planId, requestId }) => {
  const data = await _request('post', '/api/data', {
    body: {
      network: networkId,
      phone,
      data_plan: planId,
      bypass: false,
      'request-id': requestId,
    },
  });
  logger.info('BilalSada data', { networkId, phone, planId, requestId, data });
  return data;
};

/**
 * Cable/TV subscription purchase. Response carries `status`, `plan_name`,
 * `amount`, `charges` and the `iuc`; no token (unlike electricity).
 */
const buyCable = async ({ cableNameId, cablePlanId, smartCardNumber, requestId }) => {
  const data = await _request('post', '/api/cable', {
    body: {
      cable: cableNameId,
      cable_plan: cablePlanId,
      iuc: smartCardNumber,
      bypass: false,
      'request-id': requestId,
    },
  });
  logger.info('BilalSada cable', { cableNameId, cablePlanId, smartCardNumber, requestId, data });
  return data;
};

const payElectricity = async ({ discoId, meterNumber, meterType, amount, requestId }) => {
  const data = await _request('post', '/api/bill', {
    body: {
      disco: discoId,
      meter_type: _meterType(meterType),
      meter_number: meterNumber,
      amount,
      bypass: false,
      'request-id': requestId,
    },
  });
  logger.info('BilalSada electricity', { discoId, meterNumber, amount, requestId, data });
  return data;
};

/**
 * Result-checker (exam) PIN. `examId` is BilalSada's numeric id
 * (WAEC=1, NECO=2, NABTEB=3) - the catalogue stores it as providerPlanId.
 */
const buyEducationPin = async ({ examId, quantity, requestId }) => {
  const data = await _request('post', '/api/exam', {
    body: { exam: examId, quantity, 'request-id': requestId },
  });
  logger.info('BilalSada exam', { examId, quantity, requestId, data });
  return data;
};

const validateIuc = async ({ smartCardNumber, cableNameId }) =>
  _request('get', '/api/cable/cable-validation', {
    params: { iuc: smartCardNumber, cable: cableNameId },
  });

const validateMeter = async ({ meterNumber, discoId, meterType }) =>
  _request('get', '/api/bill/bill-validation', {
    params: { meter_number: meterNumber, disco: discoId, meter_type: _meterType(meterType) },
  });

/**
 * Account wallet balance, read from the same Basic-auth GET /api/user call that
 * mints the token. Returns the raw `{ status, AccessToken, balance, username }`
 * payload, or null when the basic-auth credentials aren't configured.
 */
const getAccountBalance = async () => _fetchUserInfo();

const _status = (responseData) =>
  String(responseData?.Status || responseData?.status || '').toLowerCase();

const isSuccess = (responseData) => {
  if (!responseData) return false;
  const status = _status(responseData);
  return status === 'success' || status === 'successful' || status === 'delivered';
};

/**
 * BilalSada settles synchronously, so a real response is never "pending".
 * We still honour an explicit pending/processing status defensively (in case
 * they add async vending later) - the worker's poll loop then runs, but since
 * `queryTransaction` returns null it will refund once the window expires
 * rather than poll forever.
 */
const isPending = (responseData) => {
  if (!responseData) return false;
  const status = _status(responseData);
  return status === 'pending' || status === 'processing' || status === 'queued';
};

const isFailure = (responseData) =>
  !isSuccess(responseData) && !isPending(responseData);

/**
 * No-op: BilalSada has no transaction query-by-id endpoint and their webhook
 * is not operational. Returning null routes the worker's poll path to the
 * refund-after-window branch for any payment we couldn't confirm inline.
 * Kept to preserve the adapter interface the worker/reconciler depend on.
 */
const queryTransaction = async (_providerRequestId) => null;

module.exports = {
  buyAirtime,
  buyData,
  buyCable,
  payElectricity,
  buyEducationPin,
  validateIuc,
  validateMeter,
  getAccountBalance,
  queryTransaction,
  isSuccess,
  isPending,
  isFailure,
};

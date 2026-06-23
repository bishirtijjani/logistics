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
 * query-by-id endpoint, so `queryTransaction` is a no-op (returns null). Safe
 * retries rely on the unique `request-id` we send: if a buy times out on our
 * side, BullMQ retries with the SAME request-id and BilalSada returns the
 * original result instead of vending twice. Anything we genuinely can't confirm
 * is refunded after the poll window expires (see utility.worker.js).
 *
 * OPTIONAL WEBHOOK: a purchase callback can be wired at POST /webhooks/bilalsada
 * (see webhook.controller.js). It is a pure accelerator and the system works
 * exactly as above without it - it only helps in the gap the sync path can't
 * cover: a buy whose response we never saw (timeout) that BilalSada actually
 * vended. Such a payment is otherwise refunded at window close; a verified
 * callback lets us complete it instead. `verifyWebhookSignature` gates it on
 * BILALSADASUB_WEBHOOK_SECRET, so with no secret set the endpoint is inert.
 */

const crypto = require('crypto');
const axios = require('axios');
const { config } = require('../config');
const { logger } = require('../utils/logger');
const { redis } = require('../config/redis');

const BASE_URL = 'https://bilalsadasub.com';

const client = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// ── Balance cache ─────────────────────────────────────────────────────────────
// The provider reports our float balance on the Basic-auth /api/user call AND
// (when present) inline on each purchase response. We mirror the latest reading
// into Redis so the live value updates the instant a transaction settles in the
// worker, and the admin dashboard can read it without making its own provider
// call on every load. The worker and API run as separate processes, so Redis -
// not a module variable - is what shares the figure between them.
const BALANCE_CACHE_KEY = 'vtu:bilalsada:balance';

// Pull a balance figure out of whatever response shape the provider returns.
const _readBalanceField = (data) =>
  data?.balance ?? data?.new_balance ?? data?.Balance ?? data?.wallet_balance;

// Remember the latest provider-reported balance. Fire-and-forget and fully
// guarded: a non-numeric value or a Redis hiccup must never disturb a purchase.
const _rememberBalance = async (raw) => {
  const balance = Number(raw);
  if (!Number.isFinite(balance)) return;
  try {
    await redis.set(BALANCE_CACHE_KEY, JSON.stringify({ balance, at: Date.now() }));
  } catch (err) {
    logger.warn('BilalSada balance cache write failed', { error: err.message });
  }
};

/**
 * Last balance we observed from the provider as `{ balance, at }` (epoch ms),
 * or null if none is cached yet. Read by the admin dashboard.
 */
const getCachedBalance = async () => {
  try {
    const raw = await redis.get(BALANCE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Number.isFinite(parsed?.balance) ? parsed : null;
  } catch (err) {
    logger.warn('BilalSada balance cache read failed', { error: err.message });
    return null;
  }
};

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
  _rememberBalance(_readBalanceField(data));
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
    // Purchase responses often carry the post-transaction balance; capture it so
    // the dashboard reflects the float the moment a buy settles. No-op when absent.
    _rememberBalance(_readBalanceField(data));
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
 * No-op: BilalSada has no transaction query-by-id endpoint, so polling can't
 * confirm a purchase. Returning null routes the worker's poll path to the
 * refund-after-window branch for any payment we couldn't confirm inline. The
 * optional webhook (below) is the only way a not-inline-confirmed BilalSada
 * payment can still be COMPLETED rather than refunded. Kept to preserve the
 * adapter interface the worker/reconciler depend on.
 */
const queryTransaction = async (_providerRequestId) => null;

// ── Webhook (optional accelerator) ────────────────────────────────────────────

/**
 * Verify a BilalSada purchase callback. We HMAC-SHA256 the exact raw bytes of
 * the request body with BILALSADASUB_WEBHOOK_SECRET and constant-time compare
 * against the signature header.
 *
 * Fails closed: no configured secret, or a missing/malformed signature, returns
 * false. With the secret unset the webhook is therefore inert and the platform
 * behaves exactly as it does without any webhook at all.
 *
 * NB: BilalSada's published callback does not yet document its signing scheme.
 * HMAC-SHA256-over-raw-body is the common convention; revise this one function
 * if their dashboard turns out to sign differently - nothing else needs to know.
 */
const verifyWebhookSignature = (rawBody, signature) => {
  const secret = config.BILALSADASUB_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const provided = String(signature).replace(/^sha256=/i, '');
  // timingSafeEqual throws on length mismatch - bail before it can.
  if (provided.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
};

/**
 * Pull the echoed `request-id` out of a callback payload. That id is the value
 * we sent on the buy (our wallet reference == UtilityPayment.providerRequestId),
 * so it's how the webhook maps back to a single payment. Tolerant of the usual
 * key spellings and a `data`-wrapped shape; returns null when none is present.
 */
const extractWebhookRequestId = (payload) => {
  const p = payload || {};
  const d = p.data || {};
  return (
    p['request-id'] || p.request_id || p.requestId || p.reference ||
    d['request-id'] || d.request_id || d.requestId || d.reference ||
    null
  );
};

module.exports = {
  buyAirtime,
  buyData,
  buyCable,
  payElectricity,
  buyEducationPin,
  validateIuc,
  validateMeter,
  getAccountBalance,
  getCachedBalance,
  queryTransaction,
  verifyWebhookSignature,
  extractWebhookRequestId,
  isSuccess,
  isPending,
  isFailure,
};

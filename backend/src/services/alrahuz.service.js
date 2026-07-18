/**
 * AlRahuz Data API service - Nigerian VTU reseller. SECONDARY provider.
 * Base URL: https://alrahuzdata.com.ng
 * Auth: static API token, `Authorization: Token <ALRAHUZ_TOKEN>`.
 *
 * Network IDs: MTN=1, GLO=2, 9MOBILE=3, AIRTEL=4, SMILE=5
 *              (NB: differs from BilalSada - MTN=1, AIRTEL=2, GLO=3, 9MOBILE=4.
 *               This is exactly why the catalogue carries a separate
 *               altProviderNetworkId/altProviderPlanId for AlRahuz.)
 * Cable IDs:   GOTV=1, DSTV=2, STARTIME=3
 * MeterType:   sent as 1 (PREPAID) / 2 (POSTPAID).
 *
 * ASYNC PROVIDER: unlike BilalSada, AlRahuz can return `pending`/`processing`.
 * The worker's poll loop calls `queryTransaction(providerRef)` until it
 * resolves. The buy* functions accept a `requestId` arg for call-site parity
 * with the BilalSada adapter, but AlRahuz has no request-id idempotency key so
 * it is ignored here.
 */

const axios = require('axios');
const { config } = require('../config');
const { logger } = require('../utils/logger');

const BASE_URL = 'https://alrahuzdata.com.ng';

const client = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Resolve the auth header lazily so a clone without AlRahuz configured still
// boots; the throw only fires if a purchase is actually routed here.
const _authHeader = () => {
  if (!config.ALRAHUZ_TOKEN) {
    throw new Error('AlRahuz auth not configured: set ALRAHUZ_TOKEN');
  }
  return { Authorization: `Token ${config.ALRAHUZ_TOKEN}` };
};

const _post = async (path, body) => {
  const { data } = await client.post(path, body, { headers: _authHeader() });
  return data;
};

const _get = async (path, params) => {
  const { data } = await client.get(path, { headers: _authHeader(), params });
  return data;
};

// AlRahuz's billpayment MeterType is a title-case string choice ("Prepaid" /
// "Postpaid"), NOT the numeric id its docs claim ("PREPAID:1, POSTAID:2"). Sending
// 1/2 — or "PREPAID"/"prepaid" — is rejected with 400 `"x" is not a valid choice`.
const _billMeterType = (meterType) => (String(meterType).toUpperCase() === 'POSTPAID' ? 'Postpaid' : 'Prepaid');

// AlRahuz's meter-validation disco identifiers, keyed by the AlRahuz numeric disco
// id (the value we store as altProviderNetworkId). Their /ajax/validate_meter_number/
// endpoint matches on the disco *display name*, NOT the numeric id — see validateMeter.
const ALRAHUZ_DISCO_NAMES = {
  1: 'Ikeja Electric',
  2: 'Eko Electric',
  3: 'Abuja Electric',
  4: 'Kano Electric',
  5: 'Enugu Electric',
  6: 'Port Harcourt Electric',
  7: 'Ibadan Electric',
  8: 'Kaduna Electric',
  9: 'Jos Electric',
  10: 'Benin Electric',
  11: 'Yola Electric',
};

const buyAirtime = async ({ networkId, phone, amount }) => {
  const data = await _post('/api/topup/', {
    network: networkId,
    amount,
    mobile_number: phone,
    Ported_number: true,
    airtime_type: 'VTU',
  });
  logger.info('AlRahuz airtime', { networkId, phone, amount, data });
  return data;
};

const buyData = async ({ networkId, phone, planId }) => {
  const data = await _post('/api/data/', {
    network: networkId,
    mobile_number: phone,
    plan: planId,
    Ported_number: true,
  });
  logger.info('AlRahuz data', { networkId, phone, planId, data });
  return data;
};

const buyCable = async ({ cableNameId, cablePlanId, smartCardNumber }) => {
  const data = await _post('/api/cablesub/', {
    cablename: cableNameId,
    cableplan: cablePlanId,
    smart_card_number: smartCardNumber,
  });
  logger.info('AlRahuz cable', { cableNameId, cablePlanId, smartCardNumber, data });
  return data;
};

const payElectricity = async ({ discoId, meterNumber, meterType, amount, phone }) => {
  // AlRahuz's /api/billpayment/ requires the meter holder's name + address (the
  // values their own dashboard captures from the verify step). Omitting them makes
  // the endpoint fail with a 500 rather than a clean error — so re-validate here to
  // fetch them and send a complete payload.
  const meta = await validateMeter({ meterNumber, discoId, meterType });
  const data = await _post('/api/billpayment/', {
    disco_name: discoId,
    amount,
    meter_number: meterNumber,
    MeterType: _billMeterType(meterType),
    Customer_Phone: phone || '',
    customer_name: meta?.name,
    customer_address: meta?.address,
  });
  logger.info('AlRahuz electricity', { discoId, meterNumber, amount, data });
  return data;
};

const buyEducationPin = async ({ examName, quantity }) => {
  const data = await _post('/api/epin/', { exam_name: examName, quantity });
  logger.info('AlRahuz epin', { examName, quantity, data });
  return data;
};

const validateIuc = async ({ smartCardNumber, cableNameId }) =>
  _get('/api/validateiuc', { smart_card_number: smartCardNumber, cablename: cableNameId });

// AlRahuz's *documented* GET /api/validatemeter endpoint is a broken stub — it
// returns {"invalid":true,"name":"INVALID METER NUMBER"} for every meter, disco
// and param combination. Their own dashboard validates via this undocumented
// AJAX endpoint instead, which (unlike billpayment, which takes the numeric id)
// matches the disco by *name* and expects an uppercase PREPAID/POSTPAID string.
// The API token authenticates it fine — no session cookie needed. Response shape
// is identical: { invalid, name, address }.
const validateMeter = async ({ meterNumber, discoId, meterType }) =>
  _get('/ajax/validate_meter_number/', {
    meternumber: meterNumber,
    disconame: ALRAHUZ_DISCO_NAMES[discoId] || discoId,
    mtype: String(meterType).toUpperCase() === 'POSTPAID' ? 'POSTPAID' : 'PREPAID',
  });

const getAccountBalance = async () => _get('/api/user/');

const _status = (responseData) =>
  String(responseData?.Status || responseData?.status || '').toLowerCase();

const isSuccess = (responseData) => {
  if (!responseData) return false;
  const status = _status(responseData);
  return (
    status === 'successful' ||
    status === 'success' ||
    status === 'delivered' ||
    responseData?.api_response?.toLowerCase?.()?.includes('successful')
  );
};

/**
 * AlRahuz returned `pending` / `processing` / no terminal status - caller must
 * poll the transaction by ID until it resolves to success or failure.
 */
const isPending = (responseData) => {
  if (!responseData) return false;
  const status = _status(responseData);
  return status === 'pending' || status === 'processing' || status === 'queued';
};

const isFailure = (responseData) => !isSuccess(responseData) && !isPending(responseData);

/**
 * Query AlRahuz for the current status of a previously-submitted transaction by
 * its provider request ID (the `id` AlRahuz returned on the buy call, persisted
 * as UtilityPayment.providerRef). Used by the worker poll loop.
 */
const queryTransaction = async (providerRequestId) => {
  if (!providerRequestId) return null;
  try {
    return await _get(`/api/transactions/${encodeURIComponent(providerRequestId)}/`);
  } catch (err) {
    // 404 → unknown transaction (AlRahuz dropped it); surface as null so the
    // poll loop keeps the payment pending until the window expires, then refunds.
    if (err.response?.status === 404) return null;
    logger.warn('AlRahuz queryTransaction failed', {
      providerRequestId,
      status: err.response?.status,
      data: err.response?.data,
      message: err.message,
    });
    throw err;
  }
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
  queryTransaction,
  isSuccess,
  isPending,
  isFailure,
  // AlRahuz is asynchronous but exposes a real transaction-status endpoint
  // (queryTransaction), so the worker can poll to confirm an uncertain vend and
  // resolve it definitively — no need to hold for manual review.
  canRequery: true,
};

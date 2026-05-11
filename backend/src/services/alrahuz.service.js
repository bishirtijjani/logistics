/**
 * AlRahuz Data API service — Nigerian VTU reseller.
 * Base URL: https://alrahuzdata.com.ng
 * Auth: Token header
 *
 * Network IDs: MTN=1, GLO=2, 9MOBILE=3, AIRTEL=4, SMILE=5
 * Cable IDs: GOTV=1, DSTV=2, STARTIME=3
 * MeterType: PREPAID=1, POSTPAID=2
 */

const axios = require('axios');
const { config } = require('../config');
const { logger } = require('../utils/logger');

const client = axios.create({
  baseURL: 'https://alrahuzdata.com.ng',
  headers: {
    Authorization: `Token ${config.ALRAHUZ_TOKEN}`,
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

const buyAirtime = async ({ networkId, phone, amount }) => {
  const { data } = await client.post('/api/topup/', {
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
  const { data } = await client.post('/api/data/', {
    network: networkId,
    mobile_number: phone,
    plan: planId,
    Ported_number: true,
  });
  logger.info('AlRahuz data', { networkId, phone, planId, data });
  return data;
};

const buyCable = async ({ cableNameId, cablePlanId, smartCardNumber }) => {
  const { data } = await client.post('/api/cablesub/', {
    cablename: cableNameId,
    cableplan: cablePlanId,
    smart_card_number: smartCardNumber,
  });
  logger.info('AlRahuz cable', { cableNameId, cablePlanId, smartCardNumber, data });
  return data;
};

const payElectricity = async ({ discoId, meterNumber, meterType, amount }) => {
  const { data } = await client.post('/api/billpayment/', {
    disco_name: discoId,
    amount,
    meter_number: meterNumber,
    MeterType: meterType === 'PREPAID' ? 1 : 2,
  });
  logger.info('AlRahuz electricity', { discoId, meterNumber, amount, data });
  return data;
};

const buyEducationPin = async ({ examName, quantity }) => {
  const { data } = await client.post('/api/epin/', {
    exam_name: examName,
    quantity,
  });
  logger.info('AlRahuz epin', { examName, quantity, data });
  return data;
};

const validateIuc = async ({ smartCardNumber, cableNameId }) => {
  const { data } = await client.get('/api/validateiuc', {
    params: { smart_card_number: smartCardNumber, cablename: cableNameId },
  });
  return data;
};

const validateMeter = async ({ meterNumber, discoId, meterType }) => {
  const { data } = await client.get('/api/validatemeter', {
    params: {
      meternumber: meterNumber,
      disconame: discoId,
      mtype: meterType === 'PREPAID' ? 1 : 2,
    },
  });
  return data;
};

const getAccountBalance = async () => {
  const { data } = await client.get('/api/user/');
  return data;
};

const isSuccess = (responseData) => {
  if (!responseData) return false;
  const status = responseData?.Status || responseData?.status || '';
  return String(status).toLowerCase() === 'successful' ||
    String(status).toLowerCase() === 'success' ||
    responseData?.api_response?.toLowerCase()?.includes('successful');
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
  isSuccess,
};

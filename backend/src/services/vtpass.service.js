/**
 * VTPass service — airtime, data, and electricity purchases.
 *
 * All VTPass API interactions go through this service.
 */

const axios = require('axios');
const { config } = require('../config');
const { logger } = require('../utils/logger');
const { AppError } = require('../utils/api-error');

const vtpassClient = axios.create({
  baseURL: config.VTPASS_BASE_URL,
  headers: {
    'api-key': config.VTPASS_USERNAME,
    'secret-key': config.VTPASS_PASSWORD,
    'Content-Type': 'application/json',
  },
});

/**
 * Purchase airtime.
 */
const buyAirtime = async ({ requestId, phone, amount, serviceID }) => {
  try {
    const response = await vtpassClient.post('/pay', {
      request_id: requestId,
      serviceID, // e.g., 'mtn', 'airtel', 'glo', 'etisalat'
      amount,
      phone,
    });

    logger.info('VTPass airtime purchase', { requestId, serviceID, amount });

    return {
      status: response.data.content?.transactions?.status,
      transactionId: response.data.content?.transactions?.transactionId,
      requestId: response.data.requestId,
    };
  } catch (error) {
    logger.error('VTPass airtime failed', { error: error.message, requestId });
    throw AppError.internal('Airtime purchase failed');
  }
};

/**
 * Purchase data bundle.
 */
const buyData = async ({ requestId, phone, serviceID, billersCode, variationCode, amount }) => {
  try {
    const response = await vtpassClient.post('/pay', {
      request_id: requestId,
      serviceID,
      billersCode: billersCode || phone,
      variation_code: variationCode,
      amount,
      phone,
    });

    logger.info('VTPass data purchase', { requestId, serviceID });

    return {
      status: response.data.content?.transactions?.status,
      transactionId: response.data.content?.transactions?.transactionId,
      requestId: response.data.requestId,
    };
  } catch (error) {
    logger.error('VTPass data failed', { error: error.message, requestId });
    throw AppError.internal('Data purchase failed');
  }
};

/**
 * Pay electricity bill.
 */
const payElectricity = async ({ requestId, serviceID, meterNumber, meterType, amount, phone }) => {
  try {
    const response = await vtpassClient.post('/pay', {
      request_id: requestId,
      serviceID,
      billersCode: meterNumber,
      variation_code: meterType,
      amount,
      phone,
    });

    logger.info('VTPass electricity payment', { requestId, serviceID, meterNumber });

    return {
      status: response.data.content?.transactions?.status,
      token: response.data.purchased_code || response.data.token,
      transactionId: response.data.content?.transactions?.transactionId,
      requestId: response.data.requestId,
    };
  } catch (error) {
    logger.error('VTPass electricity failed', { error: error.message, requestId });
    throw AppError.internal('Electricity payment failed');
  }
};

/**
 * Get available data plans for a provider.
 */
const getDataPlans = async (serviceID) => {
  try {
    const response = await vtpassClient.get(`/service-variations?serviceID=${serviceID}`);
    return response.data.content?.variations || [];
  } catch (error) {
    logger.error('VTPass get plans failed', { serviceID });
    throw AppError.internal('Failed to fetch data plans');
  }
};

/**
 * Verify meter number.
 */
const verifyMeter = async (serviceID, meterNumber, meterType) => {
  try {
    const response = await vtpassClient.post('/merchant-verify', {
      serviceID,
      billersCode: meterNumber,
      type: meterType,
    });

    return {
      customerName: response.data.content?.Customer_Name,
      meterNumber: response.data.content?.Meter_Number,
      address: response.data.content?.Address,
    };
  } catch (error) {
    logger.error('VTPass meter verification failed', { meterNumber });
    throw AppError.badRequest('Unable to verify meter number');
  }
};

module.exports = {
  buyAirtime,
  buyData,
  payElectricity,
  getDataPlans,
  verifyMeter,
};

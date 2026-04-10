/**
 * Monnify service — virtual accounts, disbursements, verification.
 *
 * All Monnify API interactions go through this service.
 * No other file should call Monnify directly.
 */

const axios = require('axios');
const { config } = require('../config');
const { logger } = require('../utils/logger');
const { AppError } = require('../utils/api-error');

let accessToken = null;
let tokenExpiry = null;

/**
 * Get Monnify access token (cached until expiry).
 */
const getAccessToken = async () => {
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return accessToken;
  }

  const credentials = Buffer.from(
    `${config.MONNIFY_API_KEY}:${config.MONNIFY_SECRET_KEY}`
  ).toString('base64');

  const response = await axios.post(
    `${config.MONNIFY_BASE_URL}/api/v1/auth/login`,
    {},
    { headers: { Authorization: `Basic ${credentials}` } }
  );

  accessToken = response.data.responseBody.accessToken;
  tokenExpiry = Date.now() + 290 * 1000; // Refresh 10s before expiry (5min token)

  return accessToken;
};

/**
 * Create a reserved virtual account for a user.
 */
const createVirtualAccount = async ({ accountName, customerEmail, customerName, bvn }) => {
  try {
    const token = await getAccessToken();

    const response = await axios.post(
      `${config.MONNIFY_BASE_URL}/api/v2/bank-transfer/reserved-accounts`,
      {
        accountReference: `VA-${Date.now()}`,
        accountName,
        currencyCode: 'NGN',
        contractCode: config.MONNIFY_CONTRACT_CODE,
        customerEmail,
        customerName,
        bvn,
        getAllAvailableBanks: false,
        preferredBanks: ['035'], // Wema Bank
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const account = response.data.responseBody;

    logger.info('Virtual account created', { accountName, accountNumber: account.accountNumber });

    return {
      accountNumber: account.accountNumber,
      bankName: account.bankName,
      accountName: account.accountName,
    };
  } catch (error) {
    logger.error('Monnify create account failed', { error: error.message });
    throw AppError.internal('Failed to create virtual account');
  }
};

/**
 * Initiate bank transfer (withdrawal).
 */
const initiateDisbursement = async ({ amount, reference, bankCode, accountNumber, accountName, description }) => {
  try {
    const token = await getAccessToken();

    const response = await axios.post(
      `${config.MONNIFY_BASE_URL}/api/v2/disbursements/single`,
      {
        amount,
        reference,
        narration: description || 'Wallet withdrawal',
        destinationBankCode: bankCode,
        destinationAccountNumber: accountNumber,
        destinationAccountName: accountName,
        currency: 'NGN',
        sourceAccountNumber: config.MONNIFY_WALLET_ACCOUNT_NUMBER,
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    logger.info('Disbursement initiated', { reference, amount });

    return response.data.responseBody;
  } catch (error) {
    logger.error('Monnify disbursement failed', { error: error.message, reference });
    throw AppError.internal('Withdrawal failed');
  }
};

/**
 * Verify bank account name.
 */
const verifyAccountName = async (bankCode, accountNumber) => {
  try {
    const token = await getAccessToken();

    const response = await axios.get(
      `${config.MONNIFY_BASE_URL}/api/v1/disbursements/account/validate`,
      {
        params: { accountNumber, bankCode },
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    return {
      accountName: response.data.responseBody.accountName,
      accountNumber: response.data.responseBody.accountNumber,
      bankCode,
    };
  } catch (error) {
    logger.error('Account verification failed', { bankCode, accountNumber });
    throw AppError.badRequest('Unable to verify account');
  }
};

module.exports = {
  createVirtualAccount,
  initiateDisbursement,
  verifyAccountName,
};

const axios = require('axios');
const { config } = require('../config');
const { logger } = require('../utils/logger');
const { AppError } = require('../utils/api-error');

const isProd = () => process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';
const isConfigured = () => Boolean(config.TERMII_API_KEY && config.TERMII_API_KEY.length > 10);

/**
 * Startup guard — call from server bootstrap.
 * Throws in production/staging if Termii credentials are missing so the process
 * fails fast rather than silently skipping SMS.
 */
const assertConfiguredForProd = () => {
  if (isProd() && !isConfigured()) {
    throw new Error(
      'Termii is not configured. TERMII_API_KEY / TERMII_SECRET_KEY / TERMII_SENDER_ID must be set in production.',
    );
  }
  if (isConfigured()) {
    logger.info('Termii SMS provider configured', { senderId: config.TERMII_SENDER_ID });
  } else {
    logger.warn('Termii not configured — OTP and security SMS will be logged locally only');
  }
};

/**
 * Send OTP via SMS.
 */
const sendOtp = async (phoneNumber, otp) => {
  if (!isConfigured()) {
    if (isProd()) {
      // Prod must not silently swallow OTP — fail loudly so retry logic / monitoring catches it.
      throw AppError.internal('SMS provider not configured');
    }
    logger.info(`[DEV] OTP for ${phoneNumber}: ${otp} (SMS not sent — Termii not configured)`);
    return { dev: true, otp };
  }

  try {
    const response = await axios.post(`${config.TERMII_BASE_URL}/api/sms/send`, {
      api_key: config.TERMII_API_KEY,
      to: formatPhoneNumber(phoneNumber),
      from: config.TERMII_SENDER_ID,
      sms: `Your verification code is ${otp}. It expires in 10 minutes. Do not share this code with anyone.`,
      type: 'plain',
      channel: 'generic',
    });

    logger.info('OTP SMS sent', { phone: phoneNumber.slice(-4) });
    return response.data;
  } catch (error) {
    logger.error('Termii OTP send failed', { error: error.response?.data || error.message });
    throw AppError.internal('Failed to send OTP via SMS');
  }
};

/**
 * Send a generic SMS.
 */
const sendSms = async (phoneNumber, message) => {
  if (!isConfigured()) {
    if (isProd()) throw AppError.internal('SMS provider not configured');
    logger.info(`[DEV] SMS to ${phoneNumber}: ${message} (not sent)`);
    return { dev: true };
  }

  try {
    const response = await axios.post(`${config.TERMII_BASE_URL}/api/sms/send`, {
      api_key: config.TERMII_API_KEY,
      to: formatPhoneNumber(phoneNumber),
      from: config.TERMII_SENDER_ID,
      sms: message,
      type: 'plain',
      channel: 'generic',
    });

    logger.info('SMS sent', { phone: phoneNumber.slice(-4) });
    return response.data;
  } catch (error) {
    logger.error('Termii SMS send failed', { error: error.response?.data || error.message });
    throw AppError.internal('Failed to send SMS');
  }
};

/**
 * Format Nigerian phone to international format.
 * 08012345678 → 2348012345678
 */
const formatPhoneNumber = (phone) => {
  const cleaned = phone.replace(/\s+/g, '').replace(/^\+/, '');
  if (cleaned.startsWith('0')) return `234${cleaned.slice(1)}`;
  if (cleaned.startsWith('234')) return cleaned;
  return cleaned;
};

module.exports = { sendOtp, sendSms, assertConfiguredForProd, isConfigured };

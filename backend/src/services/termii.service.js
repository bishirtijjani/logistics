/**
 * Termii service — SMS and OTP delivery.
 *
 * In development, if Termii credentials aren't configured,
 * OTPs are logged to console instead of sent via SMS.
 */

const axios = require('axios');
const { config } = require('../config');
const { logger } = require('../utils/logger');
const { AppError } = require('../utils/api-error');

const isConfigured = () =>
  config.TERMII_API_KEY && config.TERMII_API_KEY !== '' && !config.TERMII_API_KEY.includes('test');

/**
 * Send OTP to a phone number.
 */
const sendOtp = async (phoneNumber, otp) => {
  if (!isConfigured()) {
    logger.info(`[DEV] OTP for ${phoneNumber}: ${otp} (SMS not sent — Termii not configured)`);
    return { dev: true, otp };
  }

  try {
    const response = await axios.post(`${config.TERMII_BASE_URL}/api/sms/send`, {
      api_key: config.TERMII_API_KEY,
      to: formatPhoneNumber(phoneNumber),
      from: config.TERMII_SENDER_ID,
      sms: `Your verification code is ${otp}. It expires in 10 minutes. Do not share this code.`,
      type: 'plain',
      channel: 'generic',
    });

    logger.info('OTP sent', { phone: phoneNumber.slice(-4) });
    return response.data;
  } catch (error) {
    logger.error('Termii OTP send failed', { error: error.message });
    throw AppError.internal('Failed to send OTP');
  }
};

/**
 * Send a generic SMS message.
 */
const sendSms = async (phoneNumber, message) => {
  if (!isConfigured()) {
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
    logger.error('Termii SMS send failed', { error: error.message });
    throw AppError.internal('Failed to send SMS');
  }
};

/**
 * Format Nigerian phone to international format.
 * 08012345678 → 2348012345678
 */
const formatPhoneNumber = (phone) => {
  if (phone.startsWith('0')) {
    return `234${phone.slice(1)}`;
  }
  if (phone.startsWith('+234')) {
    return phone.slice(1);
  }
  return phone;
};

module.exports = {
  sendOtp,
  sendSms,
};

const axios = require('axios');
const { config } = require('../config');
const { logger } = require('../utils/logger');
const { AppError } = require('../utils/api-error');

const isProd = () => process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';
const isConfigured = () => Boolean(config.TERMII_API_KEY && config.TERMII_API_KEY.length > 10);

/**
 * Startup guard - call from server bootstrap.
 *
 * Only fails the process when Termii is the ACTIVE OTP provider in prod. When
 * `OTP_PROVIDER=whatsapp` Termii is dormant: it stays callable for transactional
 * SMS (electricity tokens, security notices) if configured, and silently no-ops
 * if not. That way a deployment running WhatsApp-only doesn't need any Termii
 * credentials at all.
 */
const assertConfiguredForProd = () => {
  const isActiveProvider = config.OTP_PROVIDER === 'termii';
  if (isProd() && isActiveProvider && !isConfigured()) {
    throw new Error(
      'Termii is not configured but OTP_PROVIDER=termii. Set TERMII_API_KEY / TERMII_SECRET_KEY / TERMII_SENDER_ID, or switch OTP_PROVIDER to "whatsapp".',
    );
  }
  if (isConfigured()) {
    logger.info('Termii SMS provider configured', {
      senderId: config.TERMII_SENDER_ID,
      role: isActiveProvider ? 'active-otp-provider' : 'dormant-transactional-sms',
    });
  } else if (isActiveProvider) {
    logger.warn('Termii not configured - OTP and security SMS will be logged locally only');
  } else {
    logger.info('Termii dormant (OTP_PROVIDER=whatsapp) and not configured - transactional SMS will skip with a warning');
  }
};

/**
 * Send OTP via SMS.
 */
const sendOtp = async (phoneNumber, otp) => {
  if (!isConfigured()) {
    // Only fail loudly when Termii is the active OTP provider. If WhatsApp
    // is the active provider, a stray sendOtp call here means the dispatcher
    // misrouted - log instead of crashing the request.
    if (isProd() && config.OTP_PROVIDER === 'termii') {
      throw AppError.internal('SMS provider not configured');
    }
    logger.info(`[DEV] OTP for ${phoneNumber}: ${otp} (SMS not sent - Termii not configured)`);
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
    // Transactional SMS is best-effort; callers wrap these in .catch(). When
    // Termii is dormant and unconfigured we degrade to a log rather than
    // throwing - otherwise welcome / electricity-token messages would surface
    // as 5xx errors on otherwise-successful KYC and utility flows.
    if (isProd() && config.OTP_PROVIDER === 'termii') {
      throw AppError.internal('SMS provider not configured');
    }
    if (isProd()) {
      logger.warn('Transactional SMS skipped - Termii not configured (dormant mode)', {
        phone: String(phoneNumber).slice(-4),
      });
      return { skipped: true, reason: 'TERMII_DORMANT_UNCONFIGURED' };
    }
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

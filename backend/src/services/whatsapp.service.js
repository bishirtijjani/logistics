/**
 * WhatsApp Cloud API client.
 *
 * Speaks Meta's Graph API for sending OTPs via an approved authentication
 * template. Free-form (utility / marketing) messages are NOT supported here
 * — Meta requires a separately approved template per message type, and our
 * transactional channel still goes through Termii (see messaging.service).
 *
 * Send pipeline (OTP):
 *   POST graph.facebook.com/{version}/{phone-number-id}/messages
 *   {
 *     messaging_product: "whatsapp",
 *     to: "<international-format>",
 *     type: "template",
 *     template: {
 *       name: WHATSAPP_AUTH_TEMPLATE_NAME,
 *       language: { code: WHATSAPP_AUTH_TEMPLATE_LANGUAGE },
 *       components: [
 *         { type: "body",   parameters: [{ type: "text", text: <code> }] },
 *         { type: "button", sub_type: "url", index: "0",
 *           parameters: [{ type: "text", text: <code> }] }   // copy-code btn
 *       ]
 *     }
 *   }
 */

const axios = require('axios');
const { config } = require('../config');
const { logger } = require('../utils/logger');
const { AppError } = require('../utils/api-error');

const GRAPH_BASE = 'https://graph.facebook.com';

const isProd = () =>
  process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';

const isConfigured = () =>
  Boolean(
    config.WHATSAPP_PHONE_NUMBER_ID &&
      config.WHATSAPP_ACCESS_TOKEN &&
      config.WHATSAPP_AUTH_TEMPLATE_NAME,
  );

/**
 * Startup guard. Called from server bootstrap when OTP_PROVIDER=whatsapp so
 * staging/prod fails fast rather than silently dropping every OTP request.
 */
const assertConfiguredForProd = () => {
  if (isProd() && !isConfigured()) {
    throw new Error(
      'WhatsApp Cloud API is not configured. WHATSAPP_PHONE_NUMBER_ID, ' +
        'WHATSAPP_ACCESS_TOKEN and WHATSAPP_AUTH_TEMPLATE_NAME must be set ' +
        'in production when OTP_PROVIDER=whatsapp.',
    );
  }
  if (isConfigured()) {
    logger.info('WhatsApp Cloud API configured', {
      phoneNumberId: config.WHATSAPP_PHONE_NUMBER_ID,
      template: config.WHATSAPP_AUTH_TEMPLATE_NAME,
      language: config.WHATSAPP_AUTH_TEMPLATE_LANGUAGE,
    });
  } else {
    logger.warn('WhatsApp not configured — OTPs will be logged locally only');
  }
};

/**
 * Send a 6-digit OTP via the approved authentication template. Used for
 * signup, password reset, KYC phone proof, and phone-change confirmation —
 * all share the same template since the only variable is the code itself.
 */
const sendOtp = async (phoneNumber, otp) => {
  if (!isConfigured()) {
    if (isProd()) {
      throw AppError.internal('WhatsApp OTP provider not configured');
    }
    logger.info(
      `[DEV] WhatsApp OTP for ${phoneNumber}: ${otp} (not sent — provider not configured)`,
    );
    return { dev: true, otp };
  }

  const to = formatPhoneNumber(phoneNumber);
  const url = `${GRAPH_BASE}/${config.WHATSAPP_API_VERSION}/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: config.WHATSAPP_AUTH_TEMPLATE_NAME,
      language: { code: config.WHATSAPP_AUTH_TEMPLATE_LANGUAGE },
      components: [
        {
          type: 'body',
          parameters: [{ type: 'text', text: String(otp) }],
        },
        // Copy-code button — Meta's auth templates require the same OTP
        // value as the button parameter so the "Copy code" tap copies the
        // exact code the user sees in the body.
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [{ type: 'text', text: String(otp) }],
        },
      ],
    },
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${config.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      timeout: 10_000,
    });

    const messageId = response.data?.messages?.[0]?.id;
    logger.info('WhatsApp OTP sent', { phone: phoneNumber.slice(-4), messageId });
    return { messageId, raw: response.data };
  } catch (error) {
    const errData = error.response?.data || error.message;
    logger.error('WhatsApp OTP send failed', { error: errData });

    // Bubble Meta's error code up to the caller so phone-not-on-whatsapp
    // and template-not-approved can be distinguished from infra errors in
    // logs and alerting.
    const metaCode = error.response?.data?.error?.code;
    throw AppError.internal('Failed to send OTP via WhatsApp', {
      code: 'WHATSAPP_SEND_FAILED',
      metaCode: metaCode || null,
    });
  }
};

/**
 * Format Nigerian phone to international (E.164 minus the "+", which Meta
 * accepts either way — we strip it for consistency with the existing Termii
 * format).
 *   08012345678 → 2348012345678
 */
const formatPhoneNumber = (phone) => {
  const cleaned = String(phone).replace(/\s+/g, '').replace(/^\+/, '');
  if (cleaned.startsWith('0')) return `234${cleaned.slice(1)}`;
  if (cleaned.startsWith('234')) return cleaned;
  return cleaned;
};

module.exports = {
  sendOtp,
  assertConfiguredForProd,
  isConfigured,
  // Exported for the webhook handler (needs the same formatting when matching
  // delivery receipts back to a stored phone).
  formatPhoneNumber,
};

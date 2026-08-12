/**
 * Push notification service - supports both Expo push tokens and native FCM tokens.
 *
 * The customer app is built on Expo's managed workflow and registers `ExponentPushToken[...]`
 * tokens via `Notifications.getExpoPushTokenAsync()` - these CANNOT be sent
 * through firebase-admin directly. We detect the token shape and route:
 *
 *   ExponentPushToken[...] → Expo Push API (https://exp.host/--/api/v2/push/send)
 *   long base64 token      → Firebase Cloud Messaging via firebase-admin
 *
 * Both paths bubble up a normalised result `{ success, code }` where `code`
 * is one of `OK | RETRYABLE | INVALID_TOKEN`. Callers (notify.service) use
 * `INVALID_TOKEN` as the dead-letter signal to null out `user.fcmToken`.
 */

const axios = require('axios');
const { config } = require('../config');
const { logger } = require('../utils/logger');

let firebaseAdmin = null;
let firebaseInitialized = false;
let firebaseAvailable = false;

const isExpoToken = (token) =>
  typeof token === 'string' && (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['));

/**
 * Lazily initialize Firebase Admin SDK. Returns true if available.
 */
const initFirebase = () => {
  if (firebaseInitialized) return firebaseAvailable;
  firebaseInitialized = true;

  if (
    !config.FIREBASE_PROJECT_ID ||
    !config.FIREBASE_PRIVATE_KEY ||
    config.FIREBASE_PRIVATE_KEY.includes('PLACEHOLDER') ||
    !config.FIREBASE_CLIENT_EMAIL
  ) {
    logger.warn('Firebase credentials not configured - FCM disabled (Expo tokens still work)');
    return false;
  }

  try {
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: config.FIREBASE_PROJECT_ID,
          privateKey: config.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          clientEmail: config.FIREBASE_CLIENT_EMAIL,
        }),
      });
    }
    firebaseAdmin = admin;
    firebaseAvailable = true;
    logger.info('Firebase Admin SDK initialized');
    return true;
  } catch (error) {
    logger.error('Firebase initialization failed', { error: error.message });
    return false;
  }
};

/**
 * Expo Push API. Sends a single ticket and inspects the receipt-like response
 * shape to classify the result. Expo also supports batches; we keep this
 * single-send path because callers are per-user anyway.
 */
const sendViaExpo = async (token, { title, body, data, channelId = 'default' }) => {
  try {
    const res = await axios.post(
      'https://exp.host/--/api/v2/push/send',
      [{
        to: token,
        title,
        body,
        data,
        sound: 'default',
        priority: 'high',
        channelId,
      }],
      {
        timeout: 10_000,
        headers: {
          'accept': 'application/json',
          'accept-encoding': 'gzip, deflate',
          'content-type': 'application/json',
        },
      },
    );

    // Response shape: { data: [{ status: 'ok'|'error', id?, message?, details: { error?: 'DeviceNotRegistered'|'InvalidCredentials'|... } }] }
    const ticket = res.data?.data?.[0];
    if (!ticket) return { success: false, code: 'RETRYABLE', detail: 'No ticket returned' };

    if (ticket.status === 'ok') {
      return { success: true, code: 'OK', id: ticket.id };
    }

    const expoErr = ticket.details?.error;
    if (expoErr === 'DeviceNotRegistered') {
      return { success: false, code: 'INVALID_TOKEN', detail: ticket.message };
    }
    if (expoErr === 'InvalidCredentials') {
      return { success: false, code: 'RETRYABLE', detail: 'Expo credentials invalid' };
    }
    return { success: false, code: 'RETRYABLE', detail: ticket.message || expoErr || 'Unknown Expo error' };
  } catch (error) {
    logger.error('Expo push send failed', { error: error.message, token: String(token).slice(0, 14) });
    // Network/HTTP errors are retryable.
    return { success: false, code: 'RETRYABLE', detail: error.message };
  }
};

/**
 * FCM via firebase-admin. Classifies the error code to detect permanent
 * token invalidation (registration-token-not-registered, invalid-argument
 * on token, etc.).
 */
const sendViaFcm = async (token, { title, body, data, channelId = 'default' }) => {
  if (!initFirebase()) {
    logger.info('[DEV] FCM push not sent', { title });
    return { success: false, code: 'RETRYABLE', detail: 'FCM not configured' };
  }

  try {
    const response = await firebaseAdmin.messaging().send({
      token,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data || {}).map(([k, v]) => [k, String(v)])
      ),
      android: {
        priority: 'high',
        notification: { channelId, sound: 'default' },
      },
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
      },
    });
    return { success: true, code: 'OK', id: response };
  } catch (error) {
    // firebase-admin .code on FCM errors. Token-death codes invalidate the
    // device token; config-mismatch codes are server-config bugs that won't
    // resolve on retry, so we also classify them as INVALID_TOKEN to stop
    // the retry storm (and surface in logs for the operator to fix).
    const code = error?.code || '';
    const TOKEN_DEAD = new Set([
      'messaging/registration-token-not-registered',
      'messaging/invalid-registration-token',
      'messaging/invalid-argument',
    ]);
    const CONFIG_FATAL = new Set([
      'messaging/mismatched-credential',
      'messaging/sender-id-mismatch',
      'messaging/third-party-auth-error',
    ]);
    let cls;
    if (TOKEN_DEAD.has(code)) cls = 'INVALID_TOKEN';
    else if (CONFIG_FATAL.has(code)) cls = 'INVALID_TOKEN'; // stop the retry loop
    else cls = 'RETRYABLE';

    logger.error('FCM send failed', {
      error: error.message, fcmCode: code, classified: cls, token: token.slice(0, 10),
    });
    return { success: false, code: cls, detail: error.message };
  }
};

/**
 * Single entry point. Returns `{ success, code }`.
 *   code: OK | RETRYABLE | INVALID_TOKEN | NO_TOKEN
 */
const sendToDevice = async (token, payload) => {
  if (!token) return { success: false, code: 'NO_TOKEN' };
  return isExpoToken(token) ? sendViaExpo(token, payload) : sendViaFcm(token, payload);
};

module.exports = {
  sendToDevice,
  isExpoToken,
};

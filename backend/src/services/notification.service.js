/**
 * Notification service — Firebase Cloud Messaging (FCM) push notifications.
 *
 * Firebase is lazily initialized on first use.
 * In development, if Firebase credentials aren't configured,
 * notifications are logged but not sent.
 */

const { config } = require('../config');
const { logger } = require('../utils/logger');

let firebaseAdmin = null;
let firebaseInitialized = false;
let firebaseAvailable = false;

/**
 * Lazily initialize Firebase Admin SDK.
 * Returns true if Firebase is available, false otherwise.
 */
const initFirebase = () => {
  if (firebaseInitialized) return firebaseAvailable;
  firebaseInitialized = true;

  // Skip if credentials are placeholders or empty
  if (
    !config.FIREBASE_PROJECT_ID ||
    !config.FIREBASE_PRIVATE_KEY ||
    config.FIREBASE_PRIVATE_KEY.includes('PLACEHOLDER') ||
    !config.FIREBASE_CLIENT_EMAIL
  ) {
    logger.warn('Firebase credentials not configured — push notifications disabled');
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
 * Send push notification to a single device.
 */
const sendToDevice = async (fcmToken, { title, body, data = {} }) => {
  if (!fcmToken) {
    logger.warn('No FCM token — notification skipped');
    return null;
  }

  if (!initFirebase()) {
    logger.info('[DEV] Push notification (not sent)', { title, body });
    return null;
  }

  try {
    const response = await firebaseAdmin.messaging().send({
      token: fcmToken,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      android: {
        priority: 'high',
        notification: { channelId: 'default', sound: 'default' },
      },
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
      },
    });

    logger.info('Push notification sent', { title, messageId: response });
    return response;
  } catch (error) {
    logger.error('FCM send failed', { error: error.message, fcmToken: fcmToken.slice(0, 10) });
    return null;
  }
};

/**
 * Send notification to multiple devices.
 */
const sendToMultiple = async (fcmTokens, { title, body, data = {} }) => {
  const validTokens = fcmTokens.filter(Boolean);
  if (validTokens.length === 0) return null;

  if (!initFirebase()) {
    logger.info('[DEV] Multicast notification (not sent)', { title, count: validTokens.length });
    return null;
  }

  try {
    const response = await firebaseAdmin.messaging().sendEachForMulticast({
      tokens: validTokens,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
    });

    logger.info('Multicast notification sent', {
      successCount: response.successCount,
      failureCount: response.failureCount,
    });

    return response;
  } catch (error) {
    logger.error('FCM multicast failed', { error: error.message });
    return null;
  }
};

// --- Predefined notification templates ---

const notifyWalletFunded = (fcmToken, amount) =>
  sendToDevice(fcmToken, {
    title: 'Wallet Funded 💰',
    body: `₦${amount.toLocaleString()} has been added to your wallet`,
    data: { type: 'WALLET_FUNDED', amount: String(amount) },
  });

const notifyTransferReceived = (fcmToken, amount, senderName) =>
  sendToDevice(fcmToken, {
    title: 'Money Received 💸',
    body: `You received ₦${amount.toLocaleString()} from ${senderName}`,
    data: { type: 'TRANSFER_RECEIVED', amount: String(amount) },
  });

const notifyRiderAssigned = (fcmToken, orderId) =>
  sendToDevice(fcmToken, {
    title: 'Rider Found 🏍️',
    body: 'A rider has accepted your delivery. Track them live!',
    data: { type: 'RIDER_ASSIGNED', orderId },
  });

const notifyDeliveryComplete = (fcmToken, orderId, fare) =>
  sendToDevice(fcmToken, {
    title: 'Delivery Complete ✅',
    body: `Your delivery is complete. ₦${fare.toLocaleString()} has been charged.`,
    data: { type: 'DELIVERY_COMPLETE', orderId },
  });

const notifyNewJob = (fcmToken, orderId, fare, distance) =>
  sendToDevice(fcmToken, {
    title: 'New Delivery Job 📦',
    body: `₦${fare.toLocaleString()} • ${distance}km away`,
    data: { type: 'NEW_JOB', orderId },
  });

// Unified request notification templates
const notifyProviderAccepted = (fcmToken, requestId) =>
  sendToDevice(fcmToken, {
    title: 'Order Accepted 🏪',
    body: 'Your order has been accepted by the provider',
    data: { type: 'REQUEST_ACCEPTED', requestId },
  });

const notifyOrderPickedUp = (fcmToken, requestId) =>
  sendToDevice(fcmToken, {
    title: 'Order Picked Up 📦',
    body: 'Your order has been picked up and is on the way',
    data: { type: 'REQUEST_PICKED_UP', requestId },
  });

const notifyRequestCancelled = (fcmToken, requestId, reason) =>
  sendToDevice(fcmToken, {
    title: 'Order Cancelled ❌',
    body: reason || 'Your order has been cancelled',
    data: { type: 'REQUEST_CANCELLED', requestId },
  });

module.exports = {
  sendToDevice,
  sendToMultiple,
  notifyWalletFunded,
  notifyTransferReceived,
  notifyRiderAssigned,
  notifyDeliveryComplete,
  notifyNewJob,
  notifyProviderAccepted,
  notifyOrderPickedUp,
  notifyRequestCancelled,
};

/**
 * Centralized notification fan-out.
 *
 * `pushAndSocket()` is the single entry point for every user-facing notification:
 *   1. Persist a Notification row (drives the in-app Notification Center).
 *   2. Emit `notification:new` to the user's socket room (live unread badge).
 *   3. Send a push (Expo or FCM, chosen by token shape) if the user has a token.
 *      Permanent token failures null out `User.fcmToken` (dead-letter).
 *
 * All wallet/order/lifecycle code must call `pushAndSocket` instead of emitting
 * sockets or invoking push helpers directly — this keeps the Notification
 * Center in sync with the tray and prevents the three-parallel-channels drift
 * that the Phase 4 audit found.
 *
 * Legacy helpers (`balanceUpdated`, `transferReceived`, `fundingReceived`) are
 * kept so wallet code that just wants a silent socket nudge for live balance
 * recalculation can avoid creating a Notification row for every micro-update.
 */

const { prisma } = require('../config/database');
const { logger } = require('../utils/logger');
const { WALLET, NOTIFICATION, getUserRoom } = require('../sockets/events');
const notificationService = require('./notification.service');

let _io = null;
const setIO = (io) => { _io = io; };
const getIO = () => _io;

// ============================================================
// Push + socket + persist fan-out
// ============================================================

/**
 * Send a notification to `userId`.
 *
 * @param {string} userId
 * @param {object} payload
 * @param {string} payload.type   REQUEST_STATUS | WALLET | REFUND | SYSTEM | ...
 * @param {string} payload.title
 * @param {string} payload.body
 * @param {object} [payload.data] Free-form. `data.route` (e.g. `/request/abc`)
 *                                is consumed by the mobile to deep-link on tap.
 * @param {string} [payload.requestId]
 * @param {string} [payload.transactionId]
 * @param {boolean} [payload.silent=false] If true, skips push but still persists
 *                                         + emits socket (for low-priority updates).
 */
const PUSH_ELIGIBLE_STATUSES = new Set(['ACTIVE', 'PENDING']);

const pushAndSocket = async (userId, payload) => {
  const { type, title, body, data = {}, requestId, transactionId, silent = false } = payload;

  if (!userId || !type || !title || !body) {
    logger.warn('pushAndSocket: missing required field', { userId, type, hasTitle: !!title, hasBody: !!body });
    return null;
  }

  // Single user lookup up-front — used for the status gate AND for push.
  // Skips a redundant findUnique we used to do later in the push branch.
  let user = null;
  try {
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        fcmToken: true,
        status: true,
        deletedAt: true,
        notificationPreferences: {
          select: { pushEnabled: true, orderUpdates: true, walletAlerts: true, promotions: true },
        },
      },
    });
  } catch (err) {
    logger.warn('pushAndSocket: user lookup failed (non-fatal)', { userId, error: err.message });
  }

  // Don't persist Notification rows for users that can't actually use them
  // (deleted/suspended/deactivated). Active + Pending users get full
  // treatment so OTP/verification flows aren't blocked.
  if (user && (user.deletedAt || !PUSH_ELIGIBLE_STATUSES.has(user.status))) {
    return null;
  }

  // 1. Persist — drives the Notification Center feed + unread count.
  let row;
  try {
    row = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        data,
        requestId: requestId || null,
        transactionId: transactionId || null,
      },
    });
  } catch (err) {
    logger.error('Notification persist failed', { userId, type, error: err.message });
    // Continue — socket+push are best-effort even if DB write fails.
  }

  // 2. Socket — live unread badge + Notification Center prepend.
  // _io is null when running in a worker-only process (BullMQ host without
  // an HTTP socket server); in that case the row + push still fire so the
  // user sees the notification on next foreground / via push.
  if (_io) {
    try {
      _io.to(getUserRoom(userId)).emit(NOTIFICATION.NEW, {
        id: row?.id,
        type,
        title,
        body,
        data,
        route: data.route || null,
        requestId: requestId || null,
        transactionId: transactionId || null,
        createdAt: row?.createdAt || new Date(),
      });
    } catch (err) {
      logger.warn('Socket emit failed (notification:new)', { userId, error: String(err) });
    }
  }

  // 3. Push — fire-and-forget. We don't `await` the Expo/FCM call because:
  //   - HTTP push latency (≤10s) would otherwise block whatever business
  //     transaction called us (status update, refund, etc.)
  //   - Push delivery is best-effort by design — if it fails the user still
  //     has the in-app row + the socket event.
  if (!silent && user?.fcmToken) {
    const prefs = user.notificationPreferences;
    const pushEnabled = prefs ? prefs.pushEnabled : true;
    const typeAllowed = (() => {
      if (!prefs) return true;
      if (type === 'WALLET' || type === 'REFUND') return prefs.walletAlerts;
      if (type === 'REQUEST_STATUS' || type === 'ORDER') return prefs.orderUpdates;
      if (type === 'PROMOTION') return prefs.promotions;
      return true;
    })();

    if (pushEnabled && typeAllowed) {
      const fcmToken = user.fcmToken;
      // intentionally not awaited
      notificationService
        .sendToDevice(fcmToken, {
          title,
          body,
          data: {
            type,
            route: data.route || '',
            requestId: requestId || '',
            transactionId: transactionId || '',
            notificationId: row?.id || '',
          },
        })
        .then(async (result) => {
          if (result?.code === 'INVALID_TOKEN') {
            // Dead-letter: clear the dead token so we don't keep trying.
            // Guarded by "fcmToken still equals what we sent" to avoid
            // clobbering a token the user just refreshed mid-flight.
            try {
              await prisma.user.updateMany({
                where: { id: userId, fcmToken },
                data: { fcmToken: null },
              });
              logger.info('Cleared invalid push token', { userId });
            } catch (err) {
              logger.warn('Clear-invalid-token write failed', { userId, error: err.message });
            }
          }
        })
        .catch((err) => {
          logger.warn('Push delivery failed (non-fatal)', { userId, error: err.message });
        });
    }
  }

  return row;
};

// ============================================================
// Lifecycle hooks — translate domain events into user-facing notifications.
// ============================================================

const REQUEST_STATUS_TEMPLATES = {
  ACCEPTED:         { title: 'Order accepted',         body: 'The merchant accepted your order.' },
  PROCESSING:       { title: 'Preparing your order',   body: 'The merchant is preparing your order now.' },
  READY_FOR_PICKUP: { title: 'Ready for pickup',       body: 'Your order is ready — finding a rider.' },
  RIDER_ASSIGNED:   { title: 'Rider on the way',       body: 'A rider has been assigned. Tap to track live.' },
  RIDER_EN_ROUTE:   { title: 'Rider heading to pickup', body: 'Your rider is heading to the pickup point.' },
  PICKED_UP:        { title: 'Order picked up',        body: 'Your order has been picked up and is on the way.' },
  IN_TRANSIT:       { title: 'On the way',             body: 'Your delivery is in transit. Track live in the app.' },
  DELIVERED:        { title: 'Delivered',              body: 'Your order has been delivered. Tap to rate.' },
  SETTLED:          { title: 'Order complete',         body: 'Your order has been completed.' },
  CANCELLED:        { title: 'Order cancelled',        body: 'Your order has been cancelled.' },
};

// Phase 8 — category-specific overrides for the early lifecycle states the
// customer sees most often. Keeps the unified taxonomy on the wire while
// letting copy adapt to pharmacy / grocery in both the in-app banner and
// the push notification, so the two never disagree.
const CATEGORY_TEMPLATE_OVERRIDES = {
  pharmacy: {
    ACCEPTED:   { title: 'Pharmacy accepted',         body: 'The pharmacy accepted your order.' },
    PROCESSING: { title: 'Pharmacist preparing',      body: 'The pharmacist is preparing your order now.' },
  },
  grocery: {
    ACCEPTED:   { title: 'Store accepted',            body: 'The store accepted your order.' },
    PROCESSING: { title: 'Picking your groceries',    body: 'The store is picking your groceries now.' },
  },
};

const resolveTemplate = (status, categorySlug) => {
  if (typeof categorySlug === 'string') {
    // Any `grocery*` slug (admin can add `grocery-fresh` etc later) shares the
    // grocery template, so we match by prefix rather than exact slug.
    const bucket = categorySlug.startsWith('grocery') ? 'grocery' : categorySlug;
    const override = CATEGORY_TEMPLATE_OVERRIDES[bucket]?.[status];
    if (override) return override;
  }
  return REQUEST_STATUS_TEMPLATES[status];
};

/**
 * `request` → notification for the customer.
 * Called from request.service.updateStatus and from the worker auto-cancel.
 * The request object is expected to carry `merchant.category.slug` so the
 * push copy can adapt to pharmacy/grocery (matches the in-app statusDisplay).
 */
const onRequestStatusChanged = async (request, prevStatus) => {
  if (!request || !request.customerId) return;
  if (prevStatus === request.status) return;

  const categorySlug = request.merchant?.category?.slug || null;
  const tpl = resolveTemplate(request.status, categorySlug);
  if (!tpl) return; // REQUESTED, etc. — no notification

  await pushAndSocket(request.customerId, {
    type: 'REQUEST_STATUS',
    title: tpl.title,
    body: tpl.body,
    data: { route: `/request/${request.id}`, status: request.status },
    requestId: request.id,
  });
};

/**
 * Wallet event → notification for the wallet owner.
 *  kind: FUNDING | TRANSFER_RECEIVED | TRANSFER_SENT | WITHDRAWAL | REFUND | RIDER_EARNING
 */
const onWalletEvent = async (userId, { kind, amount, transactionId, route, senderName, description }) => {
  if (!userId || !kind) return;

  const naira = `₦${Number(amount || 0).toLocaleString('en-NG')}`;
  const t = (() => {
    switch (kind) {
      case 'FUNDING':
        return { title: 'Wallet funded', body: `${naira} has been credited to your wallet.` };
      case 'TRANSFER_RECEIVED':
        return { title: 'Money received', body: `${naira}${senderName ? ` from ${senderName}` : ''}.` };
      case 'TRANSFER_SENT':
        return { title: 'Transfer sent', body: `${naira} sent successfully.` };
      case 'WITHDRAWAL':
        return { title: 'Withdrawal complete', body: `${naira} sent to your bank.` };
      case 'REFUND':
        return { title: 'Refund credited', body: description || `${naira} refunded to your wallet.` };
      case 'RIDER_EARNING':
        return { title: 'Earning received', body: description || `You earned ${naira} on this delivery.` };
      default:
        return { title: 'Wallet update', body: description || `${naira} update on your wallet.` };
    }
  })();

  await pushAndSocket(userId, {
    type: kind === 'REFUND' ? 'REFUND' : 'WALLET',
    title: t.title,
    body: t.body,
    data: { route: route || '/wallet', kind },
    transactionId: transactionId || null,
  });
};

// ============================================================
// Lightweight socket-only helpers (no Notification Center row).
//   Use these for live UI nudges that don't warrant a feed entry — e.g. the
//   wallet balance dot updating in the background.
// ============================================================

const balanceUpdated = (userId, { balance, transaction }) => {
  if (!_io) return;
  try {
    _io.to(getUserRoom(userId)).emit(WALLET.BALANCE_UPDATED, { balance, transaction });
  } catch (err) {
    logger.warn('Socket emit failed (balanceUpdated)', { userId, error: String(err) });
  }
};

const transferReceived = (userId, { amount, senderName, reference }) => {
  if (!_io) return;
  try {
    _io.to(getUserRoom(userId)).emit(WALLET.TRANSFER_RECEIVED, { amount, senderName, reference });
  } catch (err) {
    logger.warn('Socket emit failed (transferReceived)', { userId, error: String(err) });
  }
};

const fundingReceived = (userId, { amount, reference }) => {
  if (!_io) return;
  try {
    _io.to(getUserRoom(userId)).emit('wallet:funding:received', { amount, reference });
  } catch (err) {
    logger.warn('Socket emit failed (fundingReceived)', { userId, error: String(err) });
  }
};

module.exports = {
  setIO,
  getIO,
  pushAndSocket,
  onRequestStatusChanged,
  onWalletEvent,
  balanceUpdated,
  transferReceived,
  fundingReceived,
};

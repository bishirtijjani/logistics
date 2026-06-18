/**
 * Socket.io event name constants.
 *
 * ALL socket events MUST be defined here.
 * No hardcoded event strings anywhere else in the codebase.
 *
 * Naming convention: DOMAIN:ACTION
 * Examples: rider:location:update, delivery:status:changed
 */

// --- Connection lifecycle ---
const CONNECTION = {
  CONNECT: 'connection',
  DISCONNECT: 'disconnect',
  ERROR: 'connect_error',
  AUTH_ERROR: 'auth_error',
};

// --- Rider tracking events ---
const RIDER = {
  // Rider → Server: sends GPS coordinates
  LOCATION_UPDATE: 'rider:location:update',

  // Server → Customer: broadcasts rider position
  LOCATION_BROADCAST: 'rider:location:broadcast',

  // Rider → Server: goes online/offline
  AVAILABILITY_CHANGED: 'rider:availability:changed',

  // Server → Rider: new delivery job available
  NEW_JOB: 'rider:job:new',

  // Rider → Server: accepts a job
  JOB_ACCEPT: 'rider:job:accept',

  // Rider → Server: rejects a job
  JOB_REJECT: 'rider:job:reject',

  // Server → Rider: job acceptance confirmed
  JOB_CONFIRMED: 'rider:job:confirmed',

  // Server → Rider: job was taken by another rider
  JOB_TAKEN: 'rider:job:taken',
};

// --- Unified Request lifecycle events ---
const REQUEST = {
  // Server → Customer/Merchant/Rider: request created
  CREATED: 'request:created',

  // Server → Customer/Merchant/Rider: status changed
  STATUS_CHANGED: 'request:status:changed',

  // Server → Customer: merchant accepted the request
  MERCHANT_ACCEPTED: 'request:merchant:accepted',

  // Server → System: merchant marked ready for pickup
  MERCHANT_READY: 'request:merchant:ready',

  // Server → Customer/Merchant/Rider: rider assigned
  RIDER_ASSIGNED: 'request:rider:assigned',

  // Server → Customer/Merchant/Rider: rider location update
  RIDER_LOCATION: 'request:rider:location',

  // Server → Customer/Merchant/Rider: request completed
  COMPLETED: 'request:completed',

  // Server → Customer/Merchant/Rider: request cancelled
  CANCELLED: 'request:cancelled',

  // Customer/Merchant/Rider → Server: join request tracking room
  JOIN_ROOM: 'request:room:join',

  // Customer/Merchant/Rider → Server: leave request tracking room
  LEAVE_ROOM: 'request:room:leave',

  // Customer/Merchant → Server: join a merchant-scoped room (menu updates, new orders)
  JOIN_MERCHANT_ROOM: 'merchant:room:join',
  LEAVE_MERCHANT_ROOM: 'merchant:room:leave',

  // Server → Customer: matching status (which ring, how many attempts)
  MATCHING_STATUS: 'request:matching:status',

  // Server → Customer: latest ETA from the rider's current position
  RIDER_ETA: 'request:rider:eta',

  // Server → Request room: new in-app message
  MESSAGE_NEW: 'request:message:new',

  // Server → Request room + merchant + admin: rider flagged a wrong address
  // and supplied a correction (BLK-AddressCorrection, Phase 4).
  ADDRESS_CORRECTION: 'request:address:correction',
};

// --- Merchant catalogue events (Phase 2: 86-propagation) ---
const MERCHANT = {
  // Server → anyone watching the merchant: a product/variant/option was changed.
  // Customers viewing this merchant's menu refetch on receipt.
  MENU_UPDATED: 'merchant:menu:updated',

  // Server → everyone (merchant room + global browse room + admin room): the
  // merchant's open/closed state changed (self-toggle or admin override).
  // Broadcast broadly so browse lists and the admin dashboard update live,
  // without each client having to join every merchant's room.
  STATUS_CHANGED: 'merchant:status:changed',
};

// --- Wallet events ---
const WALLET = {
  // Server → User: balance updated (funding, transfer, payment)
  BALANCE_UPDATED: 'wallet:balance:updated',

  // Server → User: incoming transfer received
  TRANSFER_RECEIVED: 'wallet:transfer:received',
};

// --- Notification events ---
const NOTIFICATION = {
  // Server → User: generic in-app notification
  NEW: 'notification:new',
};

// --- Room naming helpers ---

/**
 * Get the room name for a specific request.
 * Customer, merchant, and rider join this room during active request.
 */
const getRequestRoom = (requestId) => `request:${requestId}`;

/**
 * Get the merchant room name.
 * Used for sending new orders to merchants.
 */
const getMerchantRoom = (merchantId) => `merchant:${merchantId}`;

/**
 * Get the personal room name for a user.
 * Used for wallet updates, notifications, etc.
 */
const getUserRoom = (userId) => `user:${userId}`;

/**
 * Get the room for all online riders in a region.
 * Used for broadcasting new delivery jobs.
 */
const getRiderPoolRoom = () => 'riders:available';

/**
 * Global room every connected socket joins. Used for broadcasts that any
 * client may care about regardless of role/screen, e.g. merchant
 * open/closed status changes for browse lists.
 */
const getMerchantsBroadcastRoom = () => 'merchants:broadcast';

/**
 * Room joined only by ADMIN-role sockets (the admin dashboard).
 */
const getAdminRoom = () => 'admin:dashboard';

module.exports = {
  CONNECTION,
  RIDER,
  REQUEST,
  MERCHANT,
  WALLET,
  NOTIFICATION,
  getRequestRoom,
  getMerchantRoom,
  getUserRoom,
  getRiderPoolRoom,
  getMerchantsBroadcastRoom,
  getAdminRoom,
};

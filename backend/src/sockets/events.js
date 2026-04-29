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

// --- Delivery lifecycle events (LEGACY - kept for backward compatibility) ---
const DELIVERY = {
  // Server → Customer/Rider: status changed
  STATUS_CHANGED: 'delivery:status:changed',

  // Server → Customer: rider assigned to your order
  RIDER_ASSIGNED: 'delivery:rider:assigned',

  // Server → Customer: delivery completed
  COMPLETED: 'delivery:completed',

  // Server → Customer/Rider: delivery cancelled
  CANCELLED: 'delivery:cancelled',

  // Customer/Rider → Server: join delivery tracking room
  JOIN_ROOM: 'delivery:room:join',

  // Customer/Rider → Server: leave delivery tracking room
  LEAVE_ROOM: 'delivery:room:leave',
};

// --- Unified Request lifecycle events (NEW) ---
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
 * Get the room name for a specific delivery order (LEGACY).
 * Both the customer and rider join this room during active delivery.
 */
const getDeliveryRoom = (orderId) => `delivery:${orderId}`;

/**
 * Get the room name for a specific request (NEW - unified).
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

module.exports = {
  CONNECTION,
  RIDER,
  DELIVERY,
  REQUEST,  // NEW
  WALLET,
  NOTIFICATION,
  getDeliveryRoom,
  getRequestRoom,  // NEW
  getMerchantRoom,  // NEW
  getUserRoom,
  getRiderPoolRoom,
};

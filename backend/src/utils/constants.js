/**
 * Shared constants used across the entire backend.
 *
 * Import from here instead of hardcoding magic strings.
 */

// Redis key prefixes — all Redis keys MUST use these prefixes
const REDIS_KEYS = {
  RIDER_LOCATION: "rider:location:", // rider:location:{riderId}
  RIDER_AVAILABILITY: "rider:availability:", // rider:availability:{riderId}
  ACTIVE_DELIVERY: "delivery:active:", // delivery:active:{deliveryId}
  OTP: "otp:", // otp:{phone}
  PENDING_REG: "pending_reg:", // pending_reg:{email}
  OTP_COOLDOWN: "otp_cooldown:", // otp_cooldown:{email} — 60s between resends
  SESSION: "session:", // session:{userId}
  RATE_LIMIT: "ratelimit:", // ratelimit:{ip}:{endpoint}
};

// Redis TTLs (in seconds)
const REDIS_TTL = {
  RIDER_LOCATION: 30, // Stale after 30s (updates every ~3s)
  RIDER_AVAILABILITY: 3600, // 1 hour
  ACTIVE_DELIVERY: 86400, // 24 hours
  OTP: 600, // 10 minutes
  PENDING_REG: 600, // 10 minutes (same as OTP)
  OTP_COOLDOWN: 60, // 60 seconds between resend requests
  SESSION: 604800, // 7 days
};

// Delivery lifecycle — ordered states
const DELIVERY_STATES = [
  "REQUESTED",
  "MATCHED",
  "RIDER_EN_ROUTE",
  "PICKED_UP",
  "IN_TRANSIT",
  "DELIVERED",
  "SETTLED",
  "CANCELLED",
];

// Valid state transitions for delivery
const DELIVERY_TRANSITIONS = {
  REQUESTED: ["MATCHED", "CANCELLED"],
  MATCHED: ["RIDER_EN_ROUTE", "CANCELLED"],
  RIDER_EN_ROUTE: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: ["IN_TRANSIT"],
  IN_TRANSIT: ["DELIVERED"],
  DELIVERED: ["SETTLED"],
  SETTLED: [],
  CANCELLED: [],
};

// OTP settings
const OTP = {
  LENGTH: 6,
  EXPIRY_MINUTES: 10,
  MAX_ATTEMPTS: 3,
};

// Transaction PIN
const PIN = {
  LENGTH: 6,
  MAX_ATTEMPTS: 3,
  LOCKOUT_MINUTES: 30,
};

// Pagination defaults
const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};

// Rider matching
const RIDER_MATCHING = {
  SEARCH_RADIUS_KM: 10,
  ACCEPT_TIMEOUT_SECONDS: 60,
  MAX_BROADCAST_ROUNDS: 3,
};

module.exports = {
  REDIS_KEYS,
  REDIS_TTL,
  DELIVERY_STATES,
  DELIVERY_TRANSITIONS,
  OTP,
  PIN,
  PAGINATION,
  RIDER_MATCHING,
};

/**
 * Rate limiting middleware.
 *
 * Prevents brute-force attacks on sensitive endpoints:
 * - Login attempts
 * - OTP verification
 * - PIN verification
 * - Registration
 *
 * USAGE:
 *   const { authLimiter, otpLimiter, generalLimiter } = require('../middlewares/rate-limit.middleware');
 *   router.post('/login', authLimiter, validate(loginSchema), controller.login);
 */

const rateLimit = require('express-rate-limit');
const { ApiResponse } = require('../utils/api-response');

/**
 * Auth endpoints - 5 attempts per 2 minutes per IP.
 */
const authLimiter = rateLimit({
  windowMs: 2 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: ApiResponse.error('Too many login attempts. Try again in 2 minutes.'),
  keyGenerator: (req) => req.ip,
});

/**
 * OTP endpoints - 3 attempts per 2 minutes per phone number.
 */
const otpLimiter = rateLimit({
  windowMs: 2 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: ApiResponse.error('Too many OTP requests. Try again in 2 minutes.'),
  keyGenerator: (req) => req.body?.phone || req.ip,
});

/**
 * PIN verification - 3 attempts per 5 minutes.
 */
const pinLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: ApiResponse.error('Too many PIN attempts. Account temporarily locked.'),
  keyGenerator: (req) => req.user?.id || req.ip,
});

/**
 * General API rate limit - 100 requests per minute.
 */
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: ApiResponse.error('Too many requests. Slow down.'),
});

/**
 * Registration - 3 accounts per IP per hour.
 */
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: ApiResponse.error('Too many registration attempts. Try again later.'),
});

/**
 * Maps API limiter - 60 requests per minute per authenticated user. Maps
 * calls cost real money on Google's side; this caps a malicious or buggy
 * client from blowing the quota.
 */
const mapsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: ApiResponse.error('Too many map requests. Slow down.'),
  keyGenerator: (req) => req.user?.id || req.ip,
});

/**
 * Request creation - 30 new orders per hour per authenticated user.
 *
 * Single biggest abuse vector: a compromised account or buggy client
 * dispatching hundreds of orders in a loop, locking up rider matching and
 * burning the escrow ledger. Per-user keying (not per-IP) is intentional:
 * IPs are shared on mobile networks and Wi-Fi, but a hijacked session is
 * scoped to one userId.
 */
const requestCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: ApiResponse.error(
    'You\'ve placed too many orders this hour. Please wait a few minutes and try again.',
  ),
  keyGenerator: (req) => req.user?.id || req.ip,
});

/**
 * Quote endpoint - 120 quotes per hour per user. Quotes are cheap (no
 * escrow, no DB writes for the request itself), but each one calls Google
 * Maps for distance. Higher than create because the create flow re-quotes
 * on refresh + on address change.
 */
const quoteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: ApiResponse.error('Too many quote requests. Please slow down.'),
  keyGenerator: (req) => req.user?.id || req.ip,
});

/**
 * VTU purchases (airtime / data / cable / electricity) - 15 per 10 minutes per
 * user. Real money leaves the wallet on every call. The DB race fix already
 * stops concurrent overdraw; this caps burst-abuse and a runaway/hijacked client
 * from draining a single account, and slows an attacker probing the vend path.
 * Per-user keyed (a hijacked session is one userId; mobile IPs are shared).
 */
const utilityPurchaseLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: ApiResponse.error('Too many purchases in a short time. Please wait a few minutes and try again.'),
  keyGenerator: (req) => req.user?.id || req.ip,
});

/**
 * VTU lookups that hit the provider API (meter / IUC validation, network
 * detect) - 40 per 5 minutes per user. Cheap for us but each call costs a
 * provider request; caps enumeration / hammering of the verify endpoints.
 */
const utilityLookupLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: ApiResponse.error('Too many lookups. Please slow down.'),
  keyGenerator: (req) => req.user?.id || req.ip,
});

module.exports = {
  authLimiter,
  otpLimiter,
  pinLimiter,
  generalLimiter,
  registrationLimiter,
  mapsLimiter,
  requestCreationLimiter,
  quoteLimiter,
  utilityPurchaseLimiter,
  utilityLookupLimiter,
};

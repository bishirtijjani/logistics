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
 * Auth endpoints — 5 attempts per 2 minutes per IP.
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
 * OTP endpoints — 3 attempts per 2 minutes per phone number.
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
 * PIN verification — 3 attempts per 5 minutes.
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
 * General API rate limit — 100 requests per minute.
 */
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: ApiResponse.error('Too many requests. Slow down.'),
});

/**
 * Registration — 3 accounts per IP per hour.
 */
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: ApiResponse.error('Too many registration attempts. Try again later.'),
});

module.exports = {
  authLimiter,
  otpLimiter,
  pinLimiter,
  generalLimiter,
  registrationLimiter,
};

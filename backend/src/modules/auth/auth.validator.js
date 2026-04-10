/**
 * Auth module — Zod validation schemas.
 *
 * Every request to auth endpoints is validated against these schemas
 * via the validate middleware BEFORE reaching the controller.
 */

const { z } = require('zod');

const registerSchema = z.object({
  email: z.string().email(),
  phone: z.string().regex(/^0[789][01]\d{8}$/, 'Invalid Nigerian phone number').optional(),
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  password: z.string().min(8).max(72),
  role: z.enum(['CUSTOMER', 'RIDER']).default('CUSTOMER'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const verifyOtpSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

const sendOtpSchema = z.object({
  email: z.string().email(),
});

const setPinSchema = z.object({
  pin: z.string().length(6).regex(/^\d{6}$/, 'PIN must be 6 digits'),
});

const changePinSchema = z.object({
  currentPin: z.string().length(6),
  newPin: z.string().length(6).regex(/^\d{6}$/, 'PIN must be 6 digits'),
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  newPassword: z.string().min(8).max(72),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

const verifyBvnSchema = z.object({
  bvn: z.string().length(11).regex(/^\d{11}$/, 'BVN must be 11 digits'),
  firstName: z.string().min(2),
  lastName: z.string().min(2),
});

module.exports = {
  registerSchema,
  loginSchema,
  verifyOtpSchema,
  sendOtpSchema,
  setPinSchema,
  changePinSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  verifyBvnSchema,
};

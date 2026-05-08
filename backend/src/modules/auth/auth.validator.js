/**
 * Auth module — Zod validation schemas.
 *
 * Every request to auth endpoints is validated against these schemas
 * via the validate middleware BEFORE reaching the controller.
 */

const { z } = require("zod");

const registerSchema = z.object({
  email: z.string().email(),
  phone: z
    .string()
    .regex(/^0[789][01]\d{8}$/, "Invalid Nigerian phone number")
    .optional(),
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  password: z.string().min(8).max(72),
  role: z.enum(["CUSTOMER", "RIDER", "MERCHANT"]).default("CUSTOMER"),
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
  pin: z
    .string()
    .length(6)
    .regex(/^\d{6}$/, "PIN must be 6 digits"),
});

const changePinSchema = z.object({
  currentPin: z.string().length(6),
  newPin: z
    .string()
    .length(6)
    .regex(/^\d{6}$/, "PIN must be 6 digits"),
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  newPassword: z.string().min(8).max(72),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

const verifyBvnSchema = z.object({
  bvn: z
    .string()
    .length(11)
    .regex(/^\d{11}$/, "BVN must be 11 digits"),
  firstName: z.string().min(2),
  lastName: z.string().min(2),
});

const updateFcmTokenSchema = z.object({
  fcmToken: z.string().min(1, "FCM token is required"),
});

const updateProfileSchema = z.object({
  firstName: z.string().min(2).max(50).optional(),
  lastName: z.string().min(2).max(50).optional(),
  phone: z
    .string()
    .regex(/^0[789][01]\d{8}$/, "Invalid Nigerian phone number")
    .optional(),
  address: z.string().max(255).optional(),
  dateOfBirth: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), "Invalid date format")
    .optional(),
});

const updateProfilePictureSchema = z.object({
  url: z.string().url("Invalid URL").optional(),
});

const updateNotificationPreferencesSchema = z.object({
  pushEnabled: z.boolean().optional(),
  orderUpdates: z.boolean().optional(),
  promotions: z.boolean().optional(),
  walletAlerts: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  emailPromotions: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
});

const merchantRegisterSchema = z.object({
  email: z.string().email(),
  phone: z.string().regex(/^0[789][01]\d{8}$/, "Invalid Nigerian phone number"),
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  password: z.string().min(8).max(72),
  businessName: z.string().min(2).max(100),
  businessType: z.enum(['RESTAURANT', 'RETAIL_STORE', 'GROCERY', 'PHARMACY']),
  businessPhone: z.string().min(10),
  businessEmail: z.string().email(),
  businessAddress: z.string().min(5),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  openingTime: z.string().regex(/^\d{2}:\d{2}$/).default('08:00'),
  closingTime: z.string().regex(/^\d{2}:\d{2}$/).default('22:00'),
});

module.exports = {
  registerSchema,
  loginSchema,
  verifyOtpSchema,
  sendOtpSchema,
  forgotPasswordSchema,
  setPinSchema,
  changePinSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  verifyBvnSchema,
  updateFcmTokenSchema,
  updateProfileSchema,
  updateProfilePictureSchema,
  updateNotificationPreferencesSchema,
  merchantRegisterSchema,
};

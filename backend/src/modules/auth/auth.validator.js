/**
 * Auth module - Zod validation schemas.
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

// Reset a forgotten PIN: re-auth with the account password instead of the
// current PIN. Used by the in-app "Forgot PIN" recovery flow.
const resetPinSchema = z.object({
  password: z.string().min(1, "Password is required"),
  pin: z
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

// KYC verification (trust-based): the user submits their BVN, name, and the
// phone linked to their BVN. There is no SMS OTP step - the service accepts
// the submitted bvnPhone as-is and logs the attempt for audit.
const verifyBvnSchema = z.object({
  bvn: z
    .string()
    .length(11)
    .regex(/^\d{11}$/, "BVN must be 11 digits"),
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  bvnPhone: z
    .string()
    .regex(/^0[789][01]\d{8}$/, "Invalid Nigerian phone number"),
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

const requestPhoneChangeSchema = z.object({
  newPhone: z.string().regex(/^0[789][01]\d{8}$/, 'Invalid Nigerian phone number'),
  password: z.string().min(1),
});

const confirmPhoneChangeSchema = z.object({
  newPhone: z.string().regex(/^0[789][01]\d{8}$/, 'Invalid Nigerian phone number'),
  otp: z.string().length(6).regex(/^\d{6}$/, 'OTP must be 6 digits'),
});

const merchantRegisterSchema = z.object({
  email: z.string().email(),
  phone: z.string().regex(/^0[789][01]\d{8}$/, "Invalid Nigerian phone number"),
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  password: z.string().min(8).max(72),
  businessName: z.string().min(2).max(100),
  categoryId: z.string().uuid('categoryId must be a valid UUID'),
  businessPhone: z.string().min(10),
  businessEmail: z.string().email(),
  // Location is collected post-signup in the dashboard's OnboardingWizard so
  // merchants can drop a real pin on a map; the merchant starts at
  // PENDING_APPROVAL and admin approval blocks until coords are real.
  businessAddress: z.string().min(5).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
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
  resetPinSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  verifyBvnSchema,
  updateFcmTokenSchema,
  updateProfileSchema,
  updateProfilePictureSchema,
  updateNotificationPreferencesSchema,
  merchantRegisterSchema,
  requestPhoneChangeSchema,
  confirmPhoneChangeSchema,
};

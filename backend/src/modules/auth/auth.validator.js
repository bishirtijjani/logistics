/**
 * Auth module - Zod validation schemas.
 *
 * Every request to auth endpoints is validated against these schemas
 * via the validate middleware BEFORE reaching the controller.
 */

const { z } = require("zod");

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  // Phone is required at signup: it's the identity KatPay mints the wallet
  // NUBAN under (provisioned right after OTP verification). No BVN/NIN is
  // collected - a Tier-1 wallet only needs name + phone.
  phone: z
    .string()
    .trim()
    .regex(/^0[789][01]\d{8}$/, "Invalid Nigerian phone number"),
  firstName: z.string().trim().min(2).max(50),
  lastName: z.string().trim().min(2).max(50),
  // Not trimmed - a password's leading/trailing characters are part of the
  // secret; stripping them would silently change what gets hashed.
  password: z.string().min(8).max(72),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

const verifyOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  code: z.string().trim().length(6),
});

const sendOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

const setPinSchema = z.object({
  pin: z
    .string()
    .trim()
    .length(6)
    .regex(/^\d{6}$/, "PIN must be 6 digits"),
});

const changePinSchema = z.object({
  currentPin: z.string().trim().length(6),
  newPin: z
    .string()
    .trim()
    .length(6)
    .regex(/^\d{6}$/, "PIN must be 6 digits"),
});

// Reset a forgotten PIN: re-auth with the account password instead of the
// current PIN. Used by the in-app "Forgot PIN" recovery flow.
const resetPinSchema = z.object({
  // Not trimmed - see registerSchema for why password stays untouched.
  password: z.string().min(1, "Password is required"),
  pin: z
    .string()
    .trim()
    .length(6)
    .regex(/^\d{6}$/, "PIN must be 6 digits"),
});

const resetPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  code: z.string().trim().length(6),
  // Not trimmed - see registerSchema for why password stays untouched.
  newPassword: z.string().min(8).max(72),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
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
    .trim()
    .length(11)
    .regex(/^\d{11}$/, "BVN must be 11 digits"),
  firstName: z.string().trim().min(2),
  lastName: z.string().trim().min(2),
  bvnPhone: z
    .string()
    .trim()
    .regex(/^0[789][01]\d{8}$/, "Invalid Nigerian phone number"),
});

const updateFcmTokenSchema = z.object({
  fcmToken: z.string().min(1, "FCM token is required"),
});

const updateProfileSchema = z.object({
  firstName: z.string().trim().min(2).max(50).optional(),
  lastName: z.string().trim().min(2).max(50).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^0[789][01]\d{8}$/, "Invalid Nigerian phone number")
    .optional(),
  address: z.string().trim().max(255).optional(),
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
  newPhone: z.string().trim().regex(/^0[789][01]\d{8}$/, 'Invalid Nigerian phone number'),
  // Not trimmed - see registerSchema for why password stays untouched.
  password: z.string().min(1),
});

const confirmPhoneChangeSchema = z.object({
  newPhone: z.string().trim().regex(/^0[789][01]\d{8}$/, 'Invalid Nigerian phone number'),
  otp: z.string().trim().length(6).regex(/^\d{6}$/, 'OTP must be 6 digits'),
});

const merchantRegisterSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().regex(/^0[789][01]\d{8}$/, "Invalid Nigerian phone number"),
  firstName: z.string().trim().min(2).max(50),
  lastName: z.string().trim().min(2).max(50),
  // Not trimmed - see registerSchema for why password stays untouched.
  password: z.string().min(8).max(72),
  businessName: z.string().trim().min(2).max(100),
  categoryId: z.string().uuid('categoryId must be a valid UUID'),
  businessPhone: z.string().trim().min(10),
  businessEmail: z.string().trim().toLowerCase().email(),
  // Location is collected post-signup in the dashboard's OnboardingWizard so
  // merchants can drop a real pin on a map; the merchant starts at
  // PENDING_APPROVAL and admin approval blocks until coords are real.
  businessAddress: z.string().trim().min(5).optional(),
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

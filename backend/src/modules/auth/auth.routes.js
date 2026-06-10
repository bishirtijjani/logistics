/**
 * Auth routes - /auth
 */

const { Router } = require("express");
const authController = require("./auth.controller");
const { validate } = require("../../middlewares/validate.middleware");
const { authenticate } = require("../../middlewares/auth.middleware");
const {
  authLimiter,
  otpLimiter,
  registrationLimiter,
} = require("../../middlewares/rate-limit.middleware");
const {
  registerSchema,
  merchantRegisterSchema,
  loginSchema,
  verifyOtpSchema,
  sendOtpSchema,
  forgotPasswordSchema,
  refreshTokenSchema,
  setPinSchema,
  changePinSchema,
  resetPasswordSchema,
  updateFcmTokenSchema,
  verifyBvnSchema,
  requestKycPhoneOtpSchema,
  updateProfileSchema,
  updateProfilePictureSchema,
  updateNotificationPreferencesSchema,
  requestPhoneChangeSchema,
  confirmPhoneChangeSchema,
} = require("./auth.validator");

const router = Router();

// Public routes (rate-limited)
router.post(
  "/register",
  registrationLimiter,
  validate(registerSchema),
  authController.register,
);
router.post(
  "/rider/register",
  registrationLimiter,
  validate(registerSchema),
  authController.riderRegister,
);
router.post(
  "/merchant/register",
  registrationLimiter,
  validate(merchantRegisterSchema),
  authController.merchantRegister,
);
router.post("/login", authLimiter, validate(loginSchema), authController.login);
router.post(
  "/otp/send",
  otpLimiter,
  validate(sendOtpSchema),
  authController.sendOtp,
);
router.post(
  "/otp/verify",
  otpLimiter,
  validate(verifyOtpSchema),
  authController.verifyOtp,
);
router.post(
  "/refresh",
  validate(refreshTokenSchema),
  authController.refreshToken,
);
router.post(
  "/password/forgot",
  authLimiter,
  validate(forgotPasswordSchema),
  authController.requestPasswordReset,
);
router.post(
  "/password/reset",
  authLimiter,
  validate(resetPasswordSchema),
  authController.resetPassword,
);

// Protected routes
router.post(
  "/pin",
  authenticate,
  validate(setPinSchema),
  authController.setPin,
);
router.post(
  "/pin/change",
  authenticate,
  validate(changePinSchema),
  authController.changePin,
);
router.post(
  "/fcm-token",
  authenticate,
  validate(updateFcmTokenSchema),
  authController.updateFcmToken,
);
router.get("/profile", authenticate, authController.getProfile);
router.patch(
  "/profile",
  authenticate,
  validate(updateProfileSchema),
  authController.updateProfile,
);
router.put(
  "/profile/picture",
  authenticate,
  authController.updateProfilePicture,
);
router.post(
  "/kyc/request-phone-otp",
  authenticate,
  otpLimiter,
  validate(requestKycPhoneOtpSchema),
  authController.requestKycPhoneOtp,
);
router.post(
  "/kyc/verify-bvn",
  authenticate,
  validate(verifyBvnSchema),
  authController.verifyBvn,
);
router.post("/logout", authenticate, authController.logout);

// Notification preferences
router.get(
  "/notification-preferences",
  authenticate,
  authController.getNotificationPreferences,
);
router.patch(
  "/notification-preferences",
  authenticate,
  validate(updateNotificationPreferencesSchema),
  authController.updateNotificationPreferences,
);

// Profile picture upload (Cloudinary signature)
router.post(
  "/upload-signature",
  authenticate,
  authController.getUploadSignature,
);

// Delete account
router.delete(
  "/account",
  authenticate,
  authController.deleteAccount,
);

// Sessions
router.get("/sessions", authenticate, authController.listSessions);
router.delete("/sessions/others", authenticate, authController.revokeOtherSessions);
router.delete("/sessions/:sessionId", authenticate, authController.revokeSession);

// Phone number change
router.post(
  "/phone/request-change",
  authenticate,
  validate(requestPhoneChangeSchema),
  authController.requestPhoneChange,
);
router.post(
  "/phone/confirm-change",
  authenticate,
  validate(confirmPhoneChangeSchema),
  authController.confirmPhoneChange,
);

module.exports = router;

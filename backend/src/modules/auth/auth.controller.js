/**
 * Auth controller — handles HTTP request/response for auth routes.
 *
 * RULES:
 * - Controllers NEVER access the database directly
 * - All business logic is delegated to the service layer
 * - Controllers only handle: extracting input, calling service, formatting response
 */

const authService = require("./auth.service");
const { ApiResponse } = require("../../utils/api-response");

const register = async (req, res, next) => {
  try {
    const result = await authService.register(req.body);

    const code = await authService.generateOtp(req.body.email);

    const emailService = require("../../services/email.service");
    const termiiService = require("../../services/termii.service");

    // Send via email always
    await emailService.sendOtpEmail(req.body.email, code);

    // Send via SMS if phone provided
    if (req.body.phone) {
      termiiService.sendOtp(req.body.phone, code).catch((err) => {
        require("../../utils/logger").logger.warn("SMS OTP failed (non-fatal)", { error: err.message });
      });
    }

    const isDev = process.env.NODE_ENV === "development";
    const responseData = isDev ? { ...result, devOtp: code } : result;

    res.status(200).json(
      ApiResponse.success(
        "Registration successful. Check your email for the verification code.",
        responseData,
      ),
    );
  } catch (error) {
    next(error);
  }
};

const merchantRegister = async (req, res, next) => {
  try {
    const result = await authService.merchantRegister(req.body);

    // Send OTP email
    const emailService = require("../../services/email.service");
    await emailService.sendOtpEmail(req.body.email, result.devOtp);

    // In development, include OTP in response for testing
    const isDev = process.env.NODE_ENV === "development";
    const responseData = isDev ? { ...result, devOtp: result.devOtp } : result;

    res
      .status(200)
      .json(
        ApiResponse.success(
          "Registration successful. Check your email for the verification code.",
          responseData,
        ),
      );
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const sessionMeta = extractSessionMeta(req);
    const result = await authService.login(req.body, sessionMeta);
    res.status(200).json(ApiResponse.success("Login successful", result));
  } catch (error) {
    next(error);
  }
};

/**
 * Pull device-identifying fields from the request. Mobile clients should send
 * `x-device-name`, `x-device-model`, and a meaningful User-Agent. Falls back
 * gracefully when headers are absent (web logins, cURL).
 */
const extractSessionMeta = (req) => ({
  ipAddress: req.ip,
  userAgent: req.headers["user-agent"] || null,
  deviceName: req.headers["x-device-name"] || null,
  deviceModel: req.headers["x-device-model"] || null,
  deviceInfo: req.headers["x-device-name"] || req.headers["user-agent"] || null,
});

const sendOtp = async (req, res, next) => {
  try {
    const code = await authService.generateOtp(req.body.email, {
      checkCooldown: true,
    });

    const emailService = require("../../services/email.service");
    const termiiService = require("../../services/termii.service");

    await emailService.sendOtpEmail(req.body.email, code);

    // Also SMS if phone supplied in body
    if (req.body.phone) {
      termiiService.sendOtp(req.body.phone, code).catch((err) => {
        require("../../utils/logger").logger.warn("Resend SMS OTP failed", { error: err.message });
      });
    }

    const isDev = process.env.NODE_ENV === "development";
    const responseData = isDev ? { devOtp: code } : undefined;

    res.json(ApiResponse.success("OTP sent to your email address", responseData));
  } catch (error) {
    next(error);
  }
};

const requestPasswordReset = async (req, res, next) => {
  try {
    const code = await authService.requestPasswordReset(req.body.email);

    if (code) {
      const emailService = require("../../services/email.service");
      await emailService.sendOtpEmail(req.body.email, code);
    }

    // Always respond generically — don't reveal whether email exists
    const isDev = process.env.NODE_ENV === "development";
    const responseData = isDev && code ? { devOtp: code } : undefined;

    res.json(
      ApiResponse.success(
        "If an account exists with that email, a reset code has been sent.",
        responseData,
      ),
    );
  } catch (error) {
    next(error);
  }
};

const verifyOtp = async (req, res, next) => {
  try {
    const result = await authService.verifyOtp(req.body.email, req.body.code);
    res.json(ApiResponse.success("Email verified successfully", result));
  } catch (error) {
    next(error);
  }
};

const refreshToken = async (req, res, next) => {
  try {
    const tokens = await authService.refreshAccessToken(req.body.refreshToken, extractSessionMeta(req));
    res.status(200).json(ApiResponse.success("Token refreshed", tokens));
  } catch (error) {
    next(error);
  }
};

const setPin = async (req, res, next) => {
  try {
    await authService.setTransactionPin(req.user.id, req.body.pin);
    res.status(200).json(ApiResponse.success("Transaction PIN set"));
  } catch (error) {
    next(error);
  }
};

const changePin = async (req, res, next) => {
  try {
    await authService.changeTransactionPin(
      req.user.id,
      req.body.currentPin,
      req.body.newPin,
    );
    res.json(ApiResponse.success("Transaction PIN changed"));
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    await authService.resetPassword(
      req.body.email,
      req.body.code,
      req.body.newPassword,
    );
    res.json(
      ApiResponse.success("Password reset successful. Please login again."),
    );
  } catch (error) {
    next(error);
  }
};

const updateFcmToken = async (req, res, next) => {
  try {
    await authService.updateFcmToken(req.user.id, req.body.fcmToken);
    res.json(ApiResponse.success("FCM token updated"));
  } catch (error) {
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const profile = await authService.getProfile(req.user.id);
    res.json(ApiResponse.success("User profile", profile));
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const profile = await authService.updateProfile(req.user.id, req.body);
    res.json(ApiResponse.success("Profile updated", profile));
  } catch (error) {
    next(error);
  }
};

const updateProfilePicture = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json(ApiResponse.error("No image file provided"));
    }
    // req.file.location is set by multer-s3 or similar upload middleware
    // For now we accept the URL directly in the body for flexibility
    const url = req.body.url || req.file?.location || req.file?.path;
    await authService.updateProfilePicture(req.user.id, url);
    res.json(
      ApiResponse.success("Profile picture updated", { profilePicture: url }),
    );
  } catch (error) {
    next(error);
  }
};

const verifyBvn = async (req, res, next) => {
  try {
    const result = await authService.verifyBvn(req.user.id, req.body, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    res.json(ApiResponse.success("BVN verified successfully", result));
  } catch (error) {
    next(error);
  }
};

const requestKycPhoneOtp = async (req, res, next) => {
  try {
    const result = await authService.requestKycPhoneOtp(req.user.id, req.body);
    // Mirror the phone-change endpoint: surface the OTP in non-prod envs so
    // dev/QA can run the flow without a real SMS-receiving handset.
    res.json(
      ApiResponse.success(
        'Verification code sent to your BVN phone',
        process.env.NODE_ENV !== 'production' ? { devOtp: result.code } : undefined,
      ),
    );
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    await authService.logout(req.body.refreshToken);
    res.status(200).json(ApiResponse.success("Logged out"));
  } catch (error) {
    next(error);
  }
};

const getNotificationPreferences = async (req, res, next) => {
  try {
    const prefs = await authService.getNotificationPreferences(req.user.id);
    res.status(200).json(ApiResponse.success("Notification preferences", prefs));
  } catch (error) {
    next(error);
  }
};

const updateNotificationPreferences = async (req, res, next) => {
  try {
    const prefs = await authService.updateNotificationPreferences(
      req.user.id,
      req.body
    );
    res.status(200).json(ApiResponse.success("Preferences updated", prefs));
  } catch (error) {
    next(error);
  }
};

const getUploadSignature = async (req, res, next) => {
  try {
    // `kind` defaults to "profile" so existing callers (web/mobile profile
    // upload) keep working unchanged. Phase 8 adds "prescription".
    const kind = (req.body?.kind || req.query?.kind || "profile").toLowerCase();
    const signature = authService.getCloudinaryUploadSignature(req.user.id, kind);
    res.status(200).json(ApiResponse.success("Upload signature", signature));
  } catch (error) {
    next(error);
  }
};

const deleteAccount = async (req, res, next) => {
  try {
    const result = await authService.deleteAccount(req.user.id);
    res.status(200).json(ApiResponse.success("Account deleted", result));
  } catch (error) {
    next(error);
  }
};

const listSessions = async (req, res, next) => {
  try {
    const currentToken = req.body.refreshToken || req.headers['x-refresh-token'] || '';
    const sessions = await authService.listSessions(req.user.id, currentToken);
    res.json(ApiResponse.success("Active sessions", sessions));
  } catch (error) {
    next(error);
  }
};

const revokeSession = async (req, res, next) => {
  try {
    await authService.revokeSession(req.user.id, req.params.sessionId);
    res.json(ApiResponse.success("Session revoked"));
  } catch (error) {
    next(error);
  }
};

const revokeOtherSessions = async (req, res, next) => {
  try {
    const currentToken = req.body.refreshToken || req.headers['x-refresh-token'] || '';
    await authService.revokeOtherSessions(req.user.id, currentToken);
    res.json(ApiResponse.success("All other sessions revoked"));
  } catch (error) {
    next(error);
  }
};

const requestPhoneChange = async (req, res, next) => {
  try {
    const result = await authService.requestPhoneChange(req.user.id, req.body);
    res.json(ApiResponse.success('OTP sent to new phone number', process.env.NODE_ENV !== 'production' ? { devOtp: result.code } : undefined));
  } catch (error) {
    next(error);
  }
};

const confirmPhoneChange = async (req, res, next) => {
  try {
    await authService.confirmPhoneChange(req.user.id, req.body);
    res.json(ApiResponse.success('Phone number updated successfully'));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  sendOtp,
  verifyOtp,
  refreshToken,
  setPin,
  changePin,
  requestPasswordReset,
  resetPassword,
  updateFcmToken,
  getProfile,
  updateProfile,
  updateProfilePicture,
  verifyBvn,
  requestKycPhoneOtp,
  logout,
  listSessions,
  revokeSession,
  revokeOtherSessions,
  getNotificationPreferences,
  updateNotificationPreferences,
  getUploadSignature,
  deleteAccount,
  merchantRegister,
  requestPhoneChange,
  confirmPhoneChange,
};

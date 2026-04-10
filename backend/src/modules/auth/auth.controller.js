/**
 * Auth controller — handles HTTP request/response for auth routes.
 *
 * RULES:
 * - Controllers NEVER access the database directly
 * - All business logic is delegated to the service layer
 * - Controllers only handle: extracting input, calling service, formatting response
 */

const authService = require('./auth.service');
const { ApiResponse } = require('../../utils/api-response');

const register = async (req, res, next) => {
  try {
    const result = await authService.register(req.body);

    // Auto-generate and send OTP upon successful registration
    const code = await authService.generateOtp(req.body.email);
    const emailService = require('../../services/email.service');
    await emailService.sendOtpEmail(req.body.email, code);

    // In development, include OTP in response for testing
    const isDev = process.env.NODE_ENV === 'development';
    const responseData = isDev ? { ...result, devOtp: code } : result;

    res.status(201).json(ApiResponse.success('Registration successful. Check your email for the verification code.', responseData));
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    res.status(200).json(ApiResponse.success('Login successful', result));
  } catch (error) {
    next(error);
  }
};

const googleAuth = async (req, res, next) => {
  try {
    const result = await authService.googleAuth(req.body);
    res.status(200).json(ApiResponse.success('Google Login successful', result));
  } catch (error) {
    next(error);
  }
};

const sendOtp = async (req, res, next) => {
  try {
    const code = await authService.generateOtp(req.body.email);

    // Send OTP via Email
    const emailService = require('../../services/email.service');
    await emailService.sendOtpEmail(req.body.email, code);

    // In development, include OTP in response for testing
    const isDev = process.env.NODE_ENV === 'development';
    const responseData = isDev ? { devOtp: code } : undefined;

    res.json(ApiResponse.success('OTP sent to your email address', responseData));
  } catch (error) {
    next(error);
  }
};

const verifyOtp = async (req, res, next) => {
  try {
    const result = await authService.verifyOtp(req.body.email, req.body.code);
    res.json(ApiResponse.success('Email verified successfully', result));
  } catch (error) {
    next(error);
  }
};

const refreshToken = async (req, res, next) => {
  try {
    const tokens = await authService.refreshAccessToken(req.body.refreshToken);
    res.status(200).json(ApiResponse.success('Token refreshed', tokens));
  } catch (error) {
    next(error);
  }
};

const setPin = async (req, res, next) => {
  try {
    await authService.setTransactionPin(req.user.id, req.body.pin);
    res.status(200).json(ApiResponse.success('Transaction PIN set'));
  } catch (error) {
    next(error);
  }
};

const changePin = async (req, res, next) => {
  try {
    await authService.changeTransactionPin(req.user.id, req.body.currentPin, req.body.newPin);
    res.json(ApiResponse.success('Transaction PIN changed'));
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    await authService.resetPassword(req.body.email, req.body.code, req.body.newPassword);
    res.json(ApiResponse.success('Password reset successful. Please login again.'));
  } catch (error) {
    next(error);
  }
};

const updateFcmToken = async (req, res, next) => {
  try {
    await authService.updateFcmToken(req.user.id, req.body.fcmToken);
    res.json(ApiResponse.success('FCM token updated'));
  } catch (error) {
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const profile = await authService.getProfile(req.user.id);
    res.json(ApiResponse.success('User profile', profile));
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    await authService.logout(req.body.refreshToken);
    res.status(200).json(ApiResponse.success('Logged out'));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  googleAuth,
  sendOtp,
  verifyOtp,
  refreshToken,
  setPin,
  changePin,
  resetPassword,
  updateFcmToken,
  getProfile,
  logout,
};

/**
 * Auth service — business logic for authentication.
 *
 * RULES:
 * - All database access goes through Prisma client
 * - Never access req/res here — this is a pure logic layer
 * - Throw AppError for any business rule violations
 * - All password/PIN operations use bcrypt
 */

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { prisma } = require("../../config/database");
const { redis } = require("../../config/redis");
const { config } = require("../../config");
const { AppError } = require("../../utils/api-error");
const { logger } = require("../../utils/logger");
const { REDIS_KEYS, REDIS_TTL, OTP } = require("../../utils/constants");
const katpayService = require("../../services/katpay.service");

const SALT_ROUNDS = 12;

/**
 * Register a new user.
 * Stores registration data in Redis only — no DB write until OTP verified.
 */
const register = async ({
  email,
  firstName,
  lastName,
  phone,
  password,
  role,
}) => {
  // Only block if an ACTIVE (verified) user already has this email
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw AppError.conflict("Email already registered");
  }

  if (phone) {
    const phoneExists = await prisma.user.findUnique({ where: { phone } });
    if (phoneExists) {
      throw AppError.conflict("Phone number already registered");
    }
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Store pending registration data in Redis (overwrites any previous attempt)
  const pendingKey = `${REDIS_KEYS.PENDING_REG}${email}`;
  const pendingData = JSON.stringify({
    email,
    firstName,
    lastName,
    phone,
    passwordHash,
    role,
  });
  await redis.set(pendingKey, pendingData, "EX", REDIS_TTL.PENDING_REG);

  logger.info("Pending registration stored in Redis", { email, role });

  return { email, role };
};

/**
 * Login — verify credentials, return tokens.
 */
const login = async ({ email, password }, sessionMeta = {}) => {
  const user = await prisma.user.findUnique({ 
    where: { email },
    include: { merchant: true }
  });

  if (!user) {
    throw AppError.unauthorized("Invalid email or password");
  }

  if (user.status === "SUSPENDED") {
    throw AppError.forbidden("Account suspended. Contact support.");
  }

  if (user.status === "DEACTIVATED") {
    throw AppError.forbidden("Account deactivated");
  }

  if (user.status === "PENDING") {
    throw AppError.forbidden(
      "Email not verified. Please check your email for the verification code.",
    );
  }

  if (!user.passwordHash) {
    throw AppError.badRequest("Password is required to login");
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw AppError.unauthorized("Invalid email or password");
  }

  const tokens = generateTokens(user);

  // Store refresh token session
  await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken: tokens.refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      ipAddress: sessionMeta.ipAddress || null,
      deviceInfo: sessionMeta.deviceInfo || null,
    },
  });

  logger.info("User logged in", { userId: user.id });

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      hasPinSet: !!user.transactionPin,
      merchantId: user.merchant?.id || null,
    },
    tokens,
  };
};

/**
 * Generate and store OTP for email verification.
 * @param {string} email
 * @param {object} [opts]
 * @param {boolean} [opts.checkCooldown] - Enforce 60s between requests (resend/forgot flows)
 */
const generateOtp = async (email, { checkCooldown = false } = {}) => {
  if (checkCooldown) {
    const cooldownKey = `${REDIS_KEYS.OTP_COOLDOWN}${email}`;
    const ttl = await redis.ttl(cooldownKey);
    if (ttl > 0) {
      throw AppError.tooManyRequests(
        `Please wait ${ttl} second${ttl === 1 ? "" : "s"} before requesting another code.`,
      );
    }
    await redis.set(cooldownKey, "1", "EX", REDIS_TTL.OTP_COOLDOWN);
  }

  const code = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit
  const redisKey = `${REDIS_KEYS.OTP}${email}`;

  await redis.set(redisKey, code, "EX", REDIS_TTL.OTP);

  // Refresh pending registration TTL so it doesn't expire before the new OTP
  const pendingKey = `${REDIS_KEYS.PENDING_REG}${email}`;
  const hasPending = await redis.exists(pendingKey);
  if (hasPending) {
    await redis.expire(pendingKey, REDIS_TTL.PENDING_REG);
  }

  logger.info("OTP generated", { email, checkCooldown });

  return code;
};

/**
 * Verify OTP and create user from pending registration data.
 */
const verifyOtp = async (email, code) => {
  const otpKey = `${REDIS_KEYS.OTP}${email}`;
  const storedCode = await redis.get(otpKey);

  if (!storedCode) {
    throw AppError.badRequest("OTP expired or not found. Request a new one.");
  }

  if (storedCode !== code) {
    throw AppError.badRequest("Invalid OTP code");
  }

  // Delete OTP after successful verification
  await redis.del(otpKey);

  // Pull pending registration data from Redis
  const pendingKey = `${REDIS_KEYS.PENDING_REG}${email}`;
  const pendingRaw = await redis.get(pendingKey);

  if (!pendingRaw) {
    // Could be a non-registration OTP (e.g. password reset or merchant verification)
    // Check if this is a merchant with PENDING status
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && user.role === 'MERCHANT' && user.status === 'PENDING') {
      // Update merchant status to ACTIVE after email verification
      await prisma.user.update({
        where: { email },
        data: { status: 'ACTIVE' }
      });
      logger.info("Merchant email verified and activated", { email, userId: user.id });
      return { verified: true, userId: user.id };
    }
    // Other OTP types (password reset, etc.)
    logger.info("OTP verified (no pending registration)", { email });
    return { verified: true };
  }

  const pending = JSON.parse(pendingRaw);

  // Create user + wallet atomically
  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        email: pending.email,
        firstName: pending.firstName,
        lastName: pending.lastName,
        phone: pending.phone,
        passwordHash: pending.passwordHash,
        role: pending.role,
        status: "ACTIVE", // Already verified
      },
    });

    await tx.wallet.create({
      data: {
        userId: newUser.id,
        balance: 0,
      },
    });

    return newUser;
  });

  // Clean up Redis
  await redis.del(pendingKey);

  logger.info("OTP verified, user created", {
    userId: user.id,
    email,
    role: user.role,
  });

  // Create KatPay virtual account asynchronously — non-blocking, non-fatal
  setImmediate(async () => {
    try {
      const va = await katpayService.createVirtualAccount({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        phoneNumber: user.phone,
        bankCodes: ["PALMPAY", "OPAY"],
        merchantID: config.KATPAY_MERCHANT_ID,
      });
      await prisma.wallet.update({
        where: { userId: user.id },
        data: {
          virtualAccountNumber: va.accountNumber,
          virtualAccountBank: va.bankName,
          virtualAccountName: va.accountName,
        },
      });
      logger.info("KatPay virtual account assigned", { userId: user.id, accountNumber: va.accountNumber });
    } catch (err) {
      logger.error("KatPay virtual account creation failed", { userId: user.id, error: err.message });
    }
  });

  return { verified: true, userId: user.id };
};

/**
 * Refresh access token using a valid refresh token.
 */
const refreshAccessToken = async (refreshToken) => {
  const session = await prisma.session.findUnique({
    where: { refreshToken },
    include: { user: true },
  });

  if (!session || session.isRevoked || session.expiresAt < new Date()) {
    throw AppError.unauthorized("Invalid or expired refresh token");
  }

  const tokens = generateTokens(session.user);

  // Rotate refresh token
  await prisma.$transaction([
    prisma.session.update({
      where: { id: session.id },
      data: { isRevoked: true },
    }),
    prisma.session.create({
      data: {
        userId: session.userId,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    }),
  ]);

  return tokens;
};

/**
 * Set transaction PIN (first time).
 */
const setTransactionPin = async (userId, pin) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (user.transactionPin) {
    throw AppError.conflict("Transaction PIN already set. Use change PIN.");
  }

  const hashedPin = await bcrypt.hash(pin, SALT_ROUNDS);

  await prisma.user.update({
    where: { id: userId },
    data: { transactionPin: hashedPin },
  });

  logger.info("Transaction PIN set", { userId });
};

/**
 * Change transaction PIN — requires current PIN.
 */
const changeTransactionPin = async (userId, currentPin, newPin) => {
  await verifyTransactionPin(userId, currentPin);

  const hashedPin = await bcrypt.hash(newPin, SALT_ROUNDS);

  await prisma.user.update({
    where: { id: userId },
    data: { transactionPin: hashedPin },
  });

  logger.info("Transaction PIN changed", { userId });
};

/**
 * Verify transaction PIN — used before any financial operation.
 */
const verifyTransactionPin = async (userId, pin) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { transactionPin: true },
  });

  if (!user.transactionPin) {
    throw AppError.badRequest("Transaction PIN not set");
  }

  const isValid = await bcrypt.compare(pin, user.transactionPin);
  if (!isValid) {
    throw AppError.invalidPin();
  }

  return true;
};

/**
 * Request password reset — generates and returns OTP if user is ACTIVE.
 * Silently succeeds for unknown/inactive emails (don't leak existence).
 */
const requestPasswordReset = async (email) => {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || user.status !== "ACTIVE") {
    logger.info("Password reset requested for unknown/inactive email", {
      email,
    });
    return null; // Caller will respond generically
  }

  const code = await generateOtp(email, { checkCooldown: true });
  return code;
};

/**
 * Reset password — verifies OTP then updates password atomically.
 */
const resetPassword = async (email, code, newPassword) => {
  // Verify OTP (also handles pending_reg cleanup if somehow present)
  const otpKey = `${REDIS_KEYS.OTP}${email}`;
  const storedCode = await redis.get(otpKey);

  if (!storedCode) {
    throw AppError.badRequest("OTP expired or not found. Request a new one.");
  }
  if (storedCode !== code) {
    throw AppError.badRequest("Invalid reset code.");
  }

  await redis.del(otpKey);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status !== "ACTIVE") {
    throw AppError.badRequest("No active account found for this email.");
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({
      where: { email },
      data: { passwordHash },
    }),
    // Revoke all existing sessions — force re-login on all devices
    prisma.session.updateMany({
      where: { userId: user.id },
      data: { isRevoked: true },
    }),
  ]);

  logger.info("Password reset successful", { email });
};

/**
 * Update FCM token for push notifications.
 */
const updateFcmToken = async (userId, fcmToken) => {
  await prisma.user.update({
    where: { id: userId },
    data: { fcmToken },
  });
};

/**
 * Get user profile.
 */
const getProfile = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      phone: true,
      firstName: true,
      lastName: true,
      email: true,
      profilePicture: true,
      dateOfBirth: true,
      address: true,
      kycStatus: true,
      role: true,
      status: true,
      transactionPin: true,
      createdAt: true,
    },
  });

  if (!user) throw AppError.notFound("User not found");

  return {
    ...user,
    hasPinSet: !!user.transactionPin,
    transactionPin: undefined, // Never expose the hash
  };
};

/**
 * Update user profile — name, phone, address, dateOfBirth.
 */
const updateProfile = async (userId, data) => {
  // If phone is being changed, check uniqueness
  if (data.phone) {
    const phoneOwner = await prisma.user.findUnique({
      where: { phone: data.phone },
    });
    if (phoneOwner && phoneOwner.id !== userId) {
      throw AppError.conflict("Phone number already in use");
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.firstName && { firstName: data.firstName }),
      ...(data.lastName && { lastName: data.lastName }),
      ...(data.phone && { phone: data.phone }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.dateOfBirth && { dateOfBirth: new Date(data.dateOfBirth) }),
    },
    select: {
      id: true,
      phone: true,
      firstName: true,
      lastName: true,
      email: true,
      profilePicture: true,
      dateOfBirth: true,
      address: true,
      kycStatus: true,
      role: true,
      status: true,
      transactionPin: true,
      createdAt: true,
    },
  });

  return {
    ...user,
    hasPinSet: !!user.transactionPin,
    transactionPin: undefined,
  };
};

/**
 * Update profile picture URL.
 */
const updateProfilePicture = async (userId, url) => {
  await prisma.user.update({
    where: { id: userId },
    data: { profilePicture: url },
  });
  logger.info("Profile picture updated", { userId });
};

/**
 * Verify BVN — stores hashed BVN and updates KYC status.
 * In production, integrate with a BVN verification merchant (e.g. Smile ID, Flutterwave).
 * The merchant call should happen here before setting VERIFIED.
 */
const verifyBvn = async (userId, { bvn, firstName, lastName }) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.notFound("User not found");

  if (user.kycStatus === "VERIFIED") {
    throw AppError.conflict("BVN already verified");
  }

  // TODO: Replace with actual BVN merchant API call
  // e.g. const result = await bvnMerchant.verify({ bvn, firstName, lastName });
  // if (!result.matched) throw AppError.badRequest("BVN verification failed");

  const bvnHash = await bcrypt.hash(bvn, SALT_ROUNDS);

  await prisma.user.update({
    where: { id: userId },
    data: {
      bvnHash,
      kycStatus: "VERIFIED",
    },
  });

  logger.info("BVN verified", { userId });
  return { kycStatus: "VERIFIED" };
};

/**
 * Logout — revoke the refresh token.
 */
const logout = async (refreshToken) => {
  await prisma.session.updateMany({
    where: { refreshToken },
    data: { isRevoked: true },
  });
};

/**
 * Get notification preferences for a user.
 * Creates default preferences if none exist.
 */
const getNotificationPreferences = async (userId) => {
  let prefs = await prisma.notificationPreferences.findUnique({
    where: { userId },
  });

  if (!prefs) {
    prefs = await prisma.notificationPreferences.create({
      data: {
        userId,
        pushEnabled: true,
        orderUpdates: true,
        promotions: true,
        walletAlerts: true,
        emailEnabled: true,
        emailPromotions: false,
        smsEnabled: false,
      },
    });
  }

  return prefs;
};

/**
 * Update notification preferences.
 */
const updateNotificationPreferences = async (userId, data) => {
  const prefs = await prisma.notificationPreferences.upsert({
    where: { userId },
    create: {
      userId,
      pushEnabled: data.pushEnabled ?? true,
      orderUpdates: data.orderUpdates ?? true,
      promotions: data.promotions ?? true,
      walletAlerts: data.walletAlerts ?? true,
      emailEnabled: data.emailEnabled ?? true,
      emailPromotions: data.emailPromotions ?? false,
      smsEnabled: data.smsEnabled ?? false,
    },
    update: {
      ...(data.pushEnabled !== undefined && { pushEnabled: data.pushEnabled }),
      ...(data.orderUpdates !== undefined && { orderUpdates: data.orderUpdates }),
      ...(data.promotions !== undefined && { promotions: data.promotions }),
      ...(data.walletAlerts !== undefined && { walletAlerts: data.walletAlerts }),
      ...(data.emailEnabled !== undefined && { emailEnabled: data.emailEnabled }),
      ...(data.emailPromotions !== undefined && { emailPromotions: data.emailPromotions }),
      ...(data.smsEnabled !== undefined && { smsEnabled: data.smsEnabled }),
    },
  });

  logger.info("Notification preferences updated", { userId });
  return prefs;
};

/**
 * Generate Cloudinary upload signature for direct browser upload.
 */
const getCloudinaryUploadSignature = (userId) => {
  const cloudName = config.CLOUDINARY_CLOUD_NAME;
  const apiKey = config.CLOUDINARY_API_KEY;
  const apiSecret = config.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw AppError.serviceUnavailable("Cloudinary not configured");
  }

  const timestamp = Math.round(new Date().getTime() / 1000);
  const folder = `vtu-logistics/profiles/${userId}`;
  const publicId = `profile_${timestamp}`;

  // Generate signature
  const signatureString = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
  const signature = require("crypto")
    .createHash("sha1")
    .update(signatureString)
    .digest("hex");

  return {
    signature,
    timestamp,
    apiKey,
    cloudName,
    folder,
    publicId,
  };
};

/**
 * Delete user account (soft delete - anonymize data).
 */
const deleteAccount = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      wallet: true,
      orders: { take: 1 },
      requests: { take: 1, where: { status: { in: ["PENDING", "ACCEPTED", "IN_PROGRESS"] } } },
    },
  });

  if (!user) {
    throw AppError.notFound("User not found");
  }

  // Check for active deliveries/requests
  if (user.requests.length > 0) {
    throw AppError.conflict(
      "Cannot delete account with active deliveries. Please complete or cancel all deliveries first."
    );
  }

  // Check for wallet balance
  if (user.wallet && parseFloat(user.wallet.balance.toString()) > 0) {
    throw AppError.conflict(
      "Please withdraw your wallet balance before deleting your account."
    );
  }

  // Revoke all sessions
  await prisma.session.updateMany({
    where: { userId, isRevoked: false },
    data: { isRevoked: true },
  });

  // Anonymize user data (soft delete)
  await prisma.user.update({
    where: { id: userId },
    data: {
      email: `deleted_${userId}@deleted.local`,
      phone: `deleted_${userId}`,
      firstName: "Deleted",
      lastName: "User",
      address: null,
      profilePicture: null,
      isActive: false,
      fcmToken: null,
      kycStatus: "PENDING",
      kycData: null,
      transactionPin: null,
    },
  });

  logger.info("User account deleted", { userId });
  return { message: "Account deleted successfully" };
};

// --- Internal helpers ---

const generateTokens = (user) => {
  const payload = { id: user.id, role: user.role, email: user.email };

  const accessToken = jwt.sign(payload, config.JWT_ACCESS_SECRET, {
    expiresIn: config.JWT_ACCESS_EXPIRY,
  });

  const refreshToken = jwt.sign(
    { id: user.id, jti: uuidv4() },
    config.JWT_REFRESH_SECRET,
    { expiresIn: config.JWT_REFRESH_EXPIRY },
  );

  return { accessToken, refreshToken };
};

const merchantRegister = async ({
  email,
  phone,
  firstName,
  lastName,
  password,
  businessName,
  businessType,
  businessPhone,
  businessEmail,
  businessAddress,
  lat,
  lng,
  openingTime,
  closingTime,
}) => {
  // Check if user already exists
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw AppError.conflict("Email already registered");
  }

  // Check if phone already exists
  const phoneExists = await prisma.user.findUnique({ where: { phone } });
  if (phoneExists) {
    throw AppError.conflict("Phone number already registered");
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const pinHash = await bcrypt.hash("000000", SALT_ROUNDS); // Default PIN for merchants

  // Create user with merchant role and merchant profile
  const user = await prisma.user.create({
    data: {
      email,
      phone,
      firstName,
      lastName,
      passwordHash,
      transactionPin: pinHash,
      role: 'MERCHANT',
      status: 'PENDING', // Pending email verification
      wallet: {
        create: {
          balance: 0,
        },
      },
      merchant: {
        create: {
          type: businessType,
          name: businessName,
          description: `${businessType} business`,
          phone: businessPhone,
          email: businessEmail,
          address: businessAddress,
          lat,
          lng,
          openingTime,
          closingTime,
          status: 'PENDING_APPROVAL', // Merchant needs admin approval
          averageRating: 0,
          isOpen: false,
          isActive: true,
        },
      },
    },
    include: {
      merchant: true,
    },
  });

  // Create merchant wallet
  await prisma.merchantWallet.create({
    data: {
      merchantId: user.merchant.id,
      availableBalance: 0,
      pendingBalance: 0,
      totalEarnings: 0,
    },
  });

  // Generate OTP for email verification
  const code = await generateOtp(email);

  logger.info("Merchant registered successfully", { 
    userId: user.id, 
    email, 
    businessName,
    merchantId: user.merchant.id 
  });

  return { 
    email, 
    userId: user.id,
    merchantId: user.merchant.id,
    businessName,
    devOtp: code, // Include OTP in dev mode for testing
  };
};

module.exports = {
  register,
  merchantRegister,
  login,
  generateOtp,
  verifyOtp,
  refreshAccessToken,
  setTransactionPin,
  changeTransactionPin,
  verifyTransactionPin,
  requestPasswordReset,
  resetPassword,
  updateFcmToken,
  getProfile,
  updateProfile,
  updateProfilePicture,
  verifyBvn,
  logout,
  getNotificationPreferences,
  updateNotificationPreferences,
  getCloudinaryUploadSignature,
  deleteAccount,
};

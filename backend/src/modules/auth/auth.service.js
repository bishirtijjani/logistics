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
const { Queue } = require('bullmq');
const { QUEUES, PAYMENT_JOBS, DEFAULT_JOB_OPTIONS } = require('../../queues/jobs');

let _paymentQueue;
const getPaymentQueue = () => {
  if (!_paymentQueue) _paymentQueue = new Queue(QUEUES.PAYMENT, { connection: redis });
  return _paymentQueue;
};

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
    throw AppError.conflict("Email already registered", { code: "EMAIL_TAKEN" });
  }

  if (phone) {
    const phoneExists = await prisma.user.findUnique({ where: { phone } });
    if (phoneExists) {
      throw AppError.conflict("Phone number already registered", { code: "PHONE_TAKEN" });
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
    throw AppError.unauthorized("Invalid email or password", { code: "INVALID_CREDENTIALS" });
  }

  if (user.status === "SUSPENDED") {
    throw AppError.forbidden("Account suspended. Contact support.", { code: "ACCOUNT_SUSPENDED" });
  }

  if (user.status === "DEACTIVATED") {
    throw AppError.forbidden("Account deactivated", { code: "ACCOUNT_DEACTIVATED" });
  }

  if (user.status === "PENDING") {
    throw AppError.forbidden(
      "Email not verified. Please check your email for the verification code.",
    );
  }

  if (!user.passwordHash) {
    throw AppError.badRequest("Password is required to login", { code: "PASSWORD_REQUIRED" });
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw AppError.unauthorized("Invalid email or password", { code: "INVALID_CREDENTIALS" });
  }

  const tokens = generateTokens(user);

  // Store refresh token session with full device fingerprint.
  await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken: tokens.refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      ipAddress: sessionMeta.ipAddress || null,
      deviceInfo: sessionMeta.deviceInfo || null,
      deviceName: sessionMeta.deviceName || null,
      deviceModel: sessionMeta.deviceModel || null,
      userAgent: sessionMeta.userAgent || null,
      lastUsedAt: new Date(),
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
    throw AppError.badRequest("OTP expired or not found. Request a new one.", { code: "OTP_EXPIRED" });
  }

  if (storedCode !== code) {
    throw AppError.badRequest("Invalid OTP code", { code: "INVALID_OTP" });
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

  // NOTE: Virtual-account provisioning is intentionally NOT triggered here.
  // Per compliance (BVN required before any NUBAN is minted), provisioning
  // happens in `verifyBvn()` once KYC succeeds.

  return { verified: true, userId: user.id };
};

/**
 * Refresh access token using a valid refresh token.
 * Carries the original session's device fingerprint forward to the new
 * session row, so devices remain identifiable across rotations. Updates
 * `lastUsedAt` so the Sessions screen reflects recent activity.
 */
const refreshAccessToken = async (refreshToken, sessionMeta = {}) => {
  const session = await prisma.session.findUnique({
    where: { refreshToken },
    include: { user: true },
  });

  if (!session || session.isRevoked || session.expiresAt < new Date()) {
    throw AppError.unauthorized("Invalid or expired refresh token", { code: "REFRESH_TOKEN_INVALID" });
  }

  const tokens = generateTokens(session.user);

  await prisma.$transaction([
    prisma.session.update({
      where: { id: session.id },
      data: { isRevoked: true, lastUsedAt: new Date() },
    }),
    prisma.session.create({
      data: {
        userId: session.userId,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        // Prefer freshly-supplied meta (request that hit /refresh) but fall
        // back to the prior session's fingerprint so we never lose attribution.
        ipAddress: sessionMeta.ipAddress || session.ipAddress || null,
        deviceInfo: sessionMeta.deviceInfo || session.deviceInfo || null,
        deviceName: sessionMeta.deviceName || session.deviceName || null,
        deviceModel: sessionMeta.deviceModel || session.deviceModel || null,
        userAgent: sessionMeta.userAgent || session.userAgent || null,
        lastUsedAt: new Date(),
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
    throw AppError.conflict("Transaction PIN already set. Use change PIN.", { code: "PIN_ALREADY_SET" });
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
 * Tracks failed attempts in Redis and locks the user after too many failures.
 */
const verifyTransactionPin = async (userId, pin) => {
  const lockKey = `pin:lock:${userId}`;
  const failKey = `pin:fails:${userId}`;

  const PIN_MAX_ATTEMPTS = 6;
  const PIN_LOCKOUT_SECONDS = 30 * 60; // 30 minutes

  // Check if locked
  const lockTtl = await redis.ttl(lockKey);
  if (lockTtl > 0) {
    const minutes = Math.ceil(lockTtl / 60);
    throw new AppError(
      `PIN locked. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
      423,
      true,
      { lockedUntil: Date.now() + lockTtl * 1000, lockTtlSeconds: lockTtl },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { transactionPin: true },
  });

  if (!user.transactionPin) {
    throw AppError.badRequest("Transaction PIN not set", { code: "PIN_NOT_SET" });
  }

  const isValid = await bcrypt.compare(pin, user.transactionPin);

  if (!isValid) {
    const fails = await redis.incr(failKey);
    await redis.expire(failKey, PIN_LOCKOUT_SECONDS);

    if (fails >= PIN_MAX_ATTEMPTS) {
      await redis.set(lockKey, '1', 'EX', PIN_LOCKOUT_SECONDS);
      await redis.del(failKey);
      throw new AppError(
        'Too many wrong attempts. PIN locked for 30 minutes.',
        423,
        true,
        { lockedUntil: Date.now() + PIN_LOCKOUT_SECONDS * 1000, lockTtlSeconds: PIN_LOCKOUT_SECONDS },
      );
    }

    const remaining = PIN_MAX_ATTEMPTS - fails;
    throw new AppError(
      `Incorrect PIN. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
      401,
      true,
      { attemptsRemaining: remaining },
    );
  }

  // Clear fails on success
  await redis.del(failKey);

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
    throw AppError.badRequest("OTP expired or not found. Request a new one.", { code: "OTP_EXPIRED" });
  }
  if (storedCode !== code) {
    throw AppError.badRequest("Invalid reset code.", { code: "INVALID_OTP" });
  }

  await redis.del(otpKey);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status !== "ACTIVE") {
    throw AppError.badRequest("No active account found for this email.", { code: "ACCOUNT_NOT_FOUND" });
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
 * List active sessions for a user.
 */
const listSessions = async (userId, currentRefreshToken) => {
  const sessions = await prisma.session.findMany({
    where: { userId, isRevoked: false, expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: 'desc' },
    select: {
      id: true,
      deviceInfo: true,
      deviceName: true,
      deviceModel: true,
      userAgent: true,
      ipAddress: true,
      lastUsedAt: true,
      createdAt: true,
      expiresAt: true,
      refreshToken: true,
    },
  });

  return sessions.map((s) => ({
    id: s.id,
    deviceInfo: s.deviceInfo,
    deviceName: s.deviceName,
    deviceModel: s.deviceModel,
    userAgent: s.userAgent,
    ipAddress: s.ipAddress,
    lastUsedAt: s.lastUsedAt,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
    isCurrent: s.refreshToken === currentRefreshToken,
  }));
};

/**
 * Revoke a specific session by ID.
 */
const revokeSession = async (userId, sessionId) => {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== userId) {
    throw AppError.notFound('Session not found');
  }
  await prisma.session.update({ where: { id: sessionId }, data: { isRevoked: true } });
};

/**
 * Revoke all sessions except the current one.
 */
const revokeOtherSessions = async (userId, currentRefreshToken) => {
  await prisma.session.updateMany({
    where: { userId, isRevoked: false, refreshToken: { not: currentRefreshToken } },
    data: { isRevoked: true },
  });
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
      throw AppError.conflict("Phone number already in use", { code: "PHONE_TAKEN" });
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
 * Verify BVN — stores hashed BVN, marks KYC verified, and provisions a KatPay
 * virtual account. The DB writes (bvnHash + kycStatus) are atomic; the external
 * KatPay call runs after the transaction commits and is retried via the
 * payment queue if it fails (so the user always converges on a wallet NUBAN).
 *
 * Returns the wallet payload (with NUBAN if provisioned synchronously) so the
 * client can show "your account is ready" immediately.
 */
const verifyBvn = async (userId, { bvn, firstName, lastName }, context = {}) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { wallet: true },
  });
  if (!user) throw AppError.notFound("User not found");

  // Hash the attempted BVN up-front so we can record every outcome
  // (success / failure / recovery) in the compliance log without storing
  // the plaintext value.
  const attemptedHash = await bcrypt.hash(bvn, SALT_ROUNDS);
  const logAttempt = (outcome, reason = null, metadata = null) =>
    prisma.bvnVerificationLog
      .create({
        data: {
          userId,
          bvnHash: attemptedHash,
          outcome,
          reason,
          ipAddress: context.ipAddress || null,
          userAgent: context.userAgent || null,
          metadata: metadata || undefined,
        },
      })
      .catch((err) =>
        logger.error('Failed to write BvnVerificationLog', { userId, outcome, error: err.message }),
      );

  // Idempotency / recovery: if the user is already VERIFIED but has no NUBAN
  // (KatPay was down during the original KYC), let the call succeed and
  // re-attempt provisioning. Otherwise the user is stuck — they can't
  // re-verify (conflict) and the queue retry has already exhausted.
  const alreadyVerified = user.kycStatus === 'VERIFIED';
  if (alreadyVerified && user.wallet?.virtualAccountNumber) {
    await logAttempt('FAILED', 'Already verified with active NUBAN');
    throw AppError.conflict('BVN already verified');
  }

  if (!alreadyVerified) {
    // TODO: Replace with actual BVN merchant API call (Smile ID / Flutterwave).
    // if (!result.matched) {
    //   await logAttempt('FAILED', 'Provider rejected BVN', { matched: false });
    //   throw AppError.badRequest("BVN verification failed");
    // }

    // Atomically: persist bvnHash + flip kycStatus. If a wallet doesn't exist
    // yet (shouldn't happen for verified users, but defensive), create one.
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { bvnHash: attemptedHash, kycStatus: 'VERIFIED' },
      });
      if (!user.wallet) {
        await tx.wallet.create({ data: { userId, balance: 0 } });
      }
    });

    await logAttempt('SUCCESS');
    logger.info('BVN verified', { userId });
  } else {
    // Recovery path: user is already VERIFIED but provisioning never finished.
    // Require them to re-submit the SAME BVN — otherwise anyone with a session
    // could trigger arbitrary KatPay calls on this account.
    if (!user.bvnHash) {
      await logAttempt('FAILED', 'Stored hash missing on recovery attempt');
      throw AppError.badRequest('BVN re-verification not possible: stored hash missing');
    }
    const matches = await bcrypt.compare(bvn, user.bvnHash);
    if (!matches) {
      await logAttempt('FAILED', 'BVN does not match stored hash (recovery)');
      throw AppError.badRequest('BVN does not match the previously verified value');
    }
    // Defensive: ensure a wallet row exists for the provisioning step below.
    if (!user.wallet) {
      await prisma.wallet.create({ data: { userId, balance: 0 } });
    }
    await logAttempt('RECOVERY', 'Re-verify to recover failed virtual-account provisioning');
    logger.info('BVN re-verify: provisioning recovery for verified user without NUBAN', { userId });
  }

  // Try to provision the virtual account synchronously so the response payload
  // can carry the NUBAN. If it fails, enqueue a retry job and return the
  // wallet without a NUBAN — the client will pick it up via socket / refetch.
  const katpayService = require('../../services/katpay.service');
  const termiiService = require('../../services/termii.service');
  const notificationService = require('../../services/notification.service');

  let virtualAccount = null;
  try {
    virtualAccount = await katpayService.createVirtualAccount({
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      phoneNumber: user.phone || '',
      bankCodes: ['PALMPAY', 'OPAY'],
    });

    await prisma.wallet.update({
      where: { userId },
      data: {
        virtualAccountNumber: virtualAccount.accountNumber,
        virtualAccountBank: virtualAccount.bankName,
        virtualAccountName: virtualAccount.accountName,
      },
    });
    logger.info('Virtual account provisioned synchronously on KYC', { userId });
  } catch (err) {
    logger.warn('Synchronous virtual account provisioning failed; queuing retry', { userId, error: err.message });
    try {
      await getPaymentQueue().add(
        PAYMENT_JOBS.PROVISION_VIRTUAL_ACCOUNT,
        { userId: user.id, email: user.email, name: `${user.firstName} ${user.lastName}`, phoneNumber: user.phone },
        { ...DEFAULT_JOB_OPTIONS, attempts: 5 },
      );
    } catch (queueErr) {
      logger.error('Failed to enqueue virtual account provisioning retry', { userId, error: String(queueErr) });
    }
  }

  // Welcome SMS + push — both best-effort. Failure here must not break KYC,
  // because the user is verified and provisioning has its own retry path.
  // We only send these on first verification, not on the recovery path.
  if (!alreadyVerified) {
    if (user.phone) {
      termiiService
        .sendSms(
          user.phone,
          `Welcome to ${config.APP_NAME || 'VTU Logistics'}! Your wallet is now active${virtualAccount ? ` — fund it via account ${virtualAccount.accountNumber} (${virtualAccount.bankName})` : ''}.`,
        )
        .catch((err) => logger.warn('KYC welcome SMS failed', { userId, error: err.message }));
    }
    if (user.fcmToken) {
      notificationService
        .sendToDevice(user.fcmToken, {
          title: 'Welcome aboard 🎉',
          body: virtualAccount
            ? `Your wallet is ready. Fund it via ${virtualAccount.accountNumber} (${virtualAccount.bankName}).`
            : 'Your identity is verified. Your wallet account is being set up.',
          data: {
            type: 'KYC_VERIFIED',
            virtualAccountNumber: virtualAccount?.accountNumber || '',
          },
        })
        .catch((err) => logger.warn('KYC welcome push failed', { userId, error: err.message }));
    }
  }

  // Re-read the wallet so the response reflects committed state.
  const wallet = await prisma.wallet.findUnique({
    where: { userId },
    select: {
      id: true,
      balance: true,
      virtualAccountNumber: true,
      virtualAccountBank: true,
      virtualAccountName: true,
    },
  });

  return {
    kycStatus: 'VERIFIED',
    wallet: wallet
      ? { ...wallet, balance: Number(wallet.balance) }
      : null,
    virtualAccountReady: Boolean(wallet?.virtualAccountNumber),
    recovery: alreadyVerified, // true means this call recovered a stuck verification
  };
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
 * Generate Cloudinary upload signature for direct upload from the client.
 *
 * `kind` selects the folder + publicId convention:
 *   - "profile"      → vtu-logistics/profiles/{userId}/profile_{ts}      (default)
 *   - "prescription" → vtu-logistics/prescriptions/{userId}/rx_{ts}_{nonce}
 *   - "return"       → vtu-logistics/returns/{userId}/return_{ts}_{nonce} (Phase 8.5)
 *
 * Each issued signature is logged with the customer id + folder. The durable
 * audit trail of *which* prescription was used for *which* order lives on
 * `Request.prescriptionUrl`, persisted at order-create time.
 */
const UPLOAD_KINDS = {
  profile: { root: "profiles", prefix: "profile" },
  prescription: { root: "prescriptions", prefix: "rx" },
  return: { root: "returns", prefix: "return" },
};

const getCloudinaryUploadSignature = (userId, kind = "profile") => {
  const cloudName = config.CLOUDINARY_CLOUD_NAME;
  const apiKey = config.CLOUDINARY_API_KEY;
  const apiSecret = config.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw AppError.serviceUnavailable("Cloudinary not configured");
  }

  const spec = UPLOAD_KINDS[kind];
  if (!spec) {
    throw AppError.badRequest(`Unsupported upload kind: ${kind}`);
  }

  const crypto = require("crypto");
  const timestamp = Math.round(new Date().getTime() / 1000);
  const folder = `vtu-logistics/${spec.root}/${userId}`;
  // Prescription / return docs add a short nonce so two uploads in the same
  // second don't collide on publicId. Profiles keep the legacy shape.
  const publicId = kind === "profile"
    ? `${spec.prefix}_${timestamp}`
    : `${spec.prefix}_${timestamp}_${crypto.randomBytes(4).toString("hex")}`;

  const signatureString = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash("sha1").update(signatureString).digest("hex");

  // Compliance audit trail: every signature issuance is captured in the
  // application log. Pharmacy / returns moderation can reconcile from this
  // when investigating a specific upload.
  logger.info("cloudinary.upload_signature.issued", {
    userId, kind, folder, publicId, timestamp,
  });

  return {
    signature,
    timestamp,
    apiKey,
    cloudName,
    folder,
    publicId,
    kind,
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
      requests: {
        take: 1,
        where: {
          status: {
            in: [
              'REQUESTED',
              'ACCEPTED',
              'PROCESSING',
              'READY_FOR_PICKUP',
              'RIDER_ASSIGNED',
              'RIDER_EN_ROUTE',
              'PICKED_UP',
              'IN_TRANSIT',
            ],
          },
        },
      },
    },
  });

  if (!user) throw AppError.notFound('User not found');

  if (user.requests.length > 0) {
    throw AppError.conflict(
      'Cannot delete account with active deliveries. Please complete or cancel all deliveries first.',
    );
  }

  if (user.wallet && Number(user.wallet.balance) > 0) {
    throw AppError.conflict(
      'Please withdraw your wallet balance before deleting your account.',
    );
  }

  await prisma.$transaction([
    prisma.session.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        email: `deleted_${userId}@deleted.local`,
        phone: `deleted_${userId}`,
        firstName: 'Deleted',
        lastName: 'User',
        address: null,
        profilePicture: null,
        fcmToken: null,
        kycStatus: 'NONE',
        transactionPin: null,
        status: 'DEACTIVATED',
        deletedAt: new Date(),
      },
    }),
  ]);

  logger.info('User account deleted', { userId });

  // Drop this user from the socket-auth cache so the next reconnect re-reads
  // and refuses the (now DEACTIVATED) account.
  try {
    const { invalidateUserAuthCache } = require('../../sockets');
    invalidateUserAuthCache(userId);
  } catch (_) {
    // Sockets not initialized in this process (e.g. CLI script) — ignore.
  }

  return { message: 'Account deleted successfully' };
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
  categoryId,
  businessPhone,
  businessEmail,
  businessAddress,
  lat,
  lng,
  openingTime,
  closingTime,
}) => {
  // Validate category exists and is active before any user/merchant rows are created
  const category = await prisma.merchantCategory.findUnique({ where: { id: categoryId } });
  if (!category) throw AppError.badRequest('Category not found');
  if (!category.isActive) throw AppError.badRequest('Category is no longer accepting merchants');

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw AppError.conflict("Email already registered", { code: "EMAIL_TAKEN" });
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
          categoryId,
          name: businessName,
          description: `${category.name} business`,
          phone: businessPhone,
          email: businessEmail,
          // Location is collected in the dashboard's onboarding wizard after
          // first login; Prisma schema still requires these columns, so we
          // seed safe placeholders. Admin approval gates customer visibility
          // until coords are replaced with a real pin.
          address: businessAddress || 'Pending — set in onboarding',
          lat: typeof lat === 'number' ? lat : 0,
          lng: typeof lng === 'number' ? lng : 0,
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
      merchant: { include: { category: true } },
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

/**
 * Request a phone number change — verifies password, sends OTP (via SMS in
 * prod, dev-logged otherwise) to the new number. Stores the pending change
 * in Redis so the confirm step can look it up.
 *
 * NOTE: also stashes the OLD phone number so the confirm step can notify it
 * after the change (security signal for account-takeover detection).
 */
const requestPhoneChange = async (userId, { newPhone, password }) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, phone: true },
  });
  if (!user) throw AppError.notFound('User not found');
  if (!user.passwordHash) throw AppError.badRequest('Password not set on this account');

  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  if (!passwordOk) throw AppError.unauthorized('Incorrect password', { code: 'INCORRECT_PASSWORD' });

  const existing = await prisma.user.findUnique({ where: { phone: newPhone } });
  if (existing) throw AppError.conflict('Phone number already in use', { code: 'PHONE_TAKEN' });

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const key = `phone:change:${userId}`;

  // Send OTP to the NEW phone first; only stash the pending change in Redis
  // if delivery succeeded. If we stashed first and SMS failed, the user would
  // see a generic "OTP expired" later — opaque and frustrating.
  // Lazy-require to avoid circular import at boot.
  const termiiService = require('../../services/termii.service');
  try {
    await termiiService.sendSms(
      newPhone,
      `Your phone-change verification code is ${code}. It expires in 10 minutes.`,
    );
  } catch (err) {
    logger.warn('Phone-change OTP SMS failed', { userId, error: err.message });
    throw AppError.serviceUnavailable('Could not send verification SMS. Please try again shortly.');
  }

  await redis.set(
    key,
    JSON.stringify({ newPhone, oldPhone: user.phone || null, code }),
    'EX',
    10 * 60,
  );

  logger.info('Phone change OTP generated', { userId, newPhone });
  return { code, devOnly: true };
};

/**
 * Confirm a phone number change — verifies OTP and applies the new phone.
 * After applying, sends a security notice via SMS to the OLD phone (so a
 * fraudster who silently rotates the number out of an account can't do so
 * without leaving a trail with the legitimate owner).
 */
const confirmPhoneChange = async (userId, { newPhone, otp }) => {
  const key = `phone:change:${userId}`;
  const raw = await redis.get(key);
  if (!raw) throw AppError.badRequest('OTP expired or not requested. Please start again.');

  // Rename the redis-stored `code` to `expectedOtp` so it doesn't shadow the
  // `code` property we pass on the AppError options below.
  const { newPhone: storedPhone, oldPhone, code: expectedOtp } = JSON.parse(raw);
  if (storedPhone !== newPhone) throw AppError.badRequest('Phone number mismatch');
  if (expectedOtp !== otp) throw AppError.badRequest('Invalid OTP', { code: 'INVALID_OTP' });

  await prisma.user.update({ where: { id: userId }, data: { phone: newPhone } });
  await redis.del(key);

  // Notify the old number — fire-and-forget. Mask the new number for safety.
  if (oldPhone) {
    const maskedNew = newPhone.length > 4 ? `****${newPhone.slice(-4)}` : newPhone;
    const termiiService = require('../../services/termii.service');
    termiiService
      .sendSms(
        oldPhone,
        `Security notice: the phone number on your ${config.APP_NAME || 'VTU Logistics'} account was changed to ${maskedNew}. If this wasn't you, contact support immediately.`,
      )
      .catch((err) => logger.warn('Old-phone change-notice SMS failed', { userId, error: err.message }));
  }

  logger.info('Phone number changed', { userId, newPhone });
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
  listSessions,
  revokeSession,
  revokeOtherSessions,
  getNotificationPreferences,
  updateNotificationPreferences,
  getCloudinaryUploadSignature,
  deleteAccount,
  requestPhoneChange,
  confirmPhoneChange,
};

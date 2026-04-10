/**
 * Auth service — business logic for authentication.
 *
 * RULES:
 * - All database access goes through Prisma client
 * - Never access req/res here — this is a pure logic layer
 * - Throw AppError for any business rule violations
 * - All password/PIN operations use bcrypt
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { OAuth2Client } = require('google-auth-library');
const { prisma } = require('../../config/database');
const { redis } = require('../../config/redis');
const { config } = require('../../config');
const { AppError } = require('../../utils/api-error');
const { logger } = require('../../utils/logger');
const { REDIS_KEYS, REDIS_TTL, OTP } = require('../../utils/constants');

const SALT_ROUNDS = 12;

/**
 * Register a new user.
 * Creates user + wallet in a single transaction.
 */
const register = async ({ email, firstName, lastName, phone, password, role }) => {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw AppError.conflict('Email already registered');
  }

  if (phone) {
    const phoneExists = await prisma.user.findUnique({ where: { phone } });
    if (phoneExists) {
      throw AppError.conflict('Phone number already registered');
    }
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Atomic: create user + wallet together
  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        phone,
        firstName,
        lastName,
        email,
        passwordHash,
        role,
        status: 'PENDING', // Requires OTP verification
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

  logger.info('User registered', { userId: user.id, role });

  return { id: user.id, phone: user.phone, role: user.role };
};

/**
 * Login — verify credentials, return tokens.
 */
const login = async ({ email, password }) => {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw AppError.unauthorized('Invalid email or password');
  }

  if (user.status === 'SUSPENDED') {
    throw AppError.forbidden('Account suspended. Contact support.');
  }

  if (user.status === 'DEACTIVATED') {
    throw AppError.forbidden('Account deactivated');
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw AppError.unauthorized('Invalid email or password');
  }

  const tokens = generateTokens(user);

  // Store refresh token session
  await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken: tokens.refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  logger.info('User logged in', { userId: user.id });

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      hasPinSet: !!user.transactionPin,
    },
    tokens,
  };
};

/**
 * Google Auth — verify token from Expo frontend and return session.
 */
const googleAuth = async ({ idToken, role }) => {
  const client = new OAuth2Client();
  
  // Verify the provided token matches one of our Apps Client IDs
  const ticket = await client.verifyIdToken({
    idToken,
    audience: [
      '1001895940462-lbs6fcgm1cn4fj2hhrjotltcjq6mebai.apps.googleusercontent.com', // Web (Expo Go)
      '1001895940462-h88c8hi8r4guiu05j4dqki52poufuspk.apps.googleusercontent.com', // Android
      '1001895940462-7urrks74vpq96kjgarrf5dj92odjr67a.apps.googleusercontent.com'  // iOS
    ],
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.email) {
    throw AppError.unauthorized('Invalid Google Token');
  }

  const { email, given_name, family_name } = payload;

  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    // Note: No password hash needed for OAuth users
    // They also bypass manual OTP since Google verified their email
    user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          firstName: given_name || 'Google',
          lastName: family_name || 'User',
          email,
          role: role || 'CUSTOMER',
          status: 'ACTIVE', // Automatically active since email is verified by Google
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

    logger.info('New user registered via Google', { userId: user.id });
  } else {
    if (user.status === 'SUSPENDED') {
      throw AppError.forbidden('Account suspended. Contact support.');
    }
    if (user.status === 'DEACTIVATED') {
      throw AppError.forbidden('Account deactivated');
    }
  }

  // Issue session
  const tokens = generateTokens(user);

  await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken: tokens.refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  logger.info('User logged in via Google', { userId: user.id });

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      hasPinSet: !!user.transactionPin,
    },
    tokens,
  };
};

/**
 * Generate and store OTP for phone verification.
 * OTP is stored in Redis with a 10-minute TTL.
 * Returns the OTP (for queueing via Termii).
 */
const generateOtp = async (email) => {
  const code = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit
  const redisKey = `${REDIS_KEYS.OTP}${email}`;

  // Store OTP in Redis with expiry
  await redis.set(redisKey, code, 'EX', REDIS_TTL.OTP);

  logger.info('OTP generated', { email });

  return code;
};

/**
 * Verify OTP and activate user.
 */
const verifyOtp = async (email, code) => {
  const redisKey = `${REDIS_KEYS.OTP}${email}`;
  const storedCode = await redis.get(redisKey);

  if (!storedCode) {
    throw AppError.badRequest('OTP expired or not found. Request a new one.');
  }

  if (storedCode !== code) {
    throw AppError.badRequest('Invalid OTP code');
  }

  // Delete OTP after successful verification
  await redis.del(redisKey);

  // Activate user
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw AppError.notFound('User not found');

  if (user.status === 'PENDING') {
    await prisma.user.update({
      where: { email },
      data: { status: 'ACTIVE' },
    });
  }

  logger.info('OTP verified, user activated', { email });

  return { verified: true };
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
    throw AppError.unauthorized('Invalid or expired refresh token');
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
    throw AppError.conflict('Transaction PIN already set. Use change PIN.');
  }

  const hashedPin = await bcrypt.hash(pin, SALT_ROUNDS);

  await prisma.user.update({
    where: { id: userId },
    data: { transactionPin: hashedPin },
  });

  logger.info('Transaction PIN set', { userId });
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

  logger.info('Transaction PIN changed', { userId });
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
    throw AppError.badRequest('Transaction PIN not set');
  }

  const isValid = await bcrypt.compare(pin, user.transactionPin);
  if (!isValid) {
    throw AppError.invalidPin();
  }

  return true;
};

/**
 * Reset password — requires OTP verification first.
 */
const resetPassword = async (email, code, newPassword) => {
  // Verify OTP
  await verifyOtp(email, code);

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await prisma.user.update({
    where: { email },
    data: { passwordHash },
  });

  // Revoke all existing sessions (force re-login)
  await prisma.session.updateMany({
    where: { user: { email } },
    data: { isRevoked: true },
  });

  logger.info('Password reset', { email });
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
      role: true,
      status: true,
      createdAt: true,
    },
  });

  if (!user) throw AppError.notFound('User not found');

  return user;
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

// --- Internal helpers ---

const generateTokens = (user) => {
  const payload = { id: user.id, role: user.role, email: user.email };

  const accessToken = jwt.sign(payload, config.JWT_ACCESS_SECRET, {
    expiresIn: config.JWT_ACCESS_EXPIRY,
  });

  const refreshToken = jwt.sign(
    { id: user.id, jti: uuidv4() },
    config.JWT_REFRESH_SECRET,
    { expiresIn: config.JWT_REFRESH_EXPIRY }
  );

  return { accessToken, refreshToken };
};

module.exports = {
  register,
  login,
  googleAuth,
  generateOtp,
  verifyOtp,
  refreshAccessToken,
  setTransactionPin,
  changeTransactionPin,
  verifyTransactionPin,
  resetPassword,
  updateFcmToken,
  getProfile,
  logout,
};

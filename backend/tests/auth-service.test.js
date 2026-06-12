/**
 * Auth service tests - signup → OTP → login, PIN flows, session rotation,
 * password reset, phone-number change. Money paths + KatPay/BVN provisioning
 * stay in the money-path specs; this file is the non-money complement called
 * out in Phase 10.
 *
 * Run with: node --test tests/auth-service.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

const { makeAuthPrismaStub, makeRedisStub } = require('./_test-helpers');

// --- Stub every module the auth service lazy-requires BEFORE we require it ---
const stubModule = (filename, exports) => {
  const mod = new Module(filename);
  mod.filename = filename;
  mod.loaded = true;
  mod.exports = exports;
  require.cache[filename] = mod;
};

const prismaStub = makeAuthPrismaStub();
const redisStub = makeRedisStub();

stubModule(path.resolve(__dirname, '../src/config/database.js'), { prisma: prismaStub });
stubModule(path.resolve(__dirname, '../src/config/redis.js'), { redis: redisStub });
stubModule(path.resolve(__dirname, '../src/config/index.js'), {
  config: {
    NODE_ENV: 'test',
    JWT_ACCESS_SECRET: 'test-access-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
    JWT_ACCESS_EXPIRY: '15m',
    JWT_REFRESH_EXPIRY: '7d',
    APP_NAME: 'iPrime',
    CLOUDINARY_CLOUD_NAME: 'test',
    CLOUDINARY_API_KEY: 'test',
    CLOUDINARY_API_SECRET: 'test',
  },
});
stubModule(path.resolve(__dirname, '../src/utils/logger.js'), {
  logger: { info() {}, warn() {}, error() {}, debug() {} },
});
// bullmq Queue constructor - never instantiated in the auth flows we test,
// but `new Queue()` runs at first use (lazy). Stub the import path so the
// require chain resolves without spinning up a real Redis-backed queue.
stubModule(require.resolve('bullmq'), {
  Queue: class { constructor() {} add() { return Promise.resolve({}); } },
});
// Termii / KatPay / notification service - only touched by BVN, but stubbed
// defensively in case any test path lights them up.
stubModule(path.resolve(__dirname, '../src/services/termii.service.js'), {
  sendSms: async () => ({ ok: true }),
});
// Messaging dispatcher - the new entry point for outbound OTP + SMS. Stubbed
// so phone-OTP / welcome / phone-change paths don't try to hit Meta or Termii.
stubModule(path.resolve(__dirname, '../src/services/messaging.service.js'), {
  sendOtp: async () => ({ ok: true, messageId: 'wamid.test' }),
  sendSms: async () => ({ ok: true }),
  assertConfiguredForProd: () => {},
  getActiveOtpProvider: () => 'whatsapp',
});
// Paystack is the provider that provisions DVAs on BVN verify - stub it so the
// BVN path doesn't make a real API call.
stubModule(path.resolve(__dirname, '../src/services/paystack.service.js'), {
  createVirtualAccount: async () => ({
    accountNumber: '1234567890', bankName: 'Wema Bank', accountName: 'TEST',
    customerCode: 'CUS_test', dedicatedAccountId: '1',
  }),
  isConfigured: () => true,
});
// KatPay is now inbound-webhook-only; keep a benign stub in case a path requires it.
stubModule(path.resolve(__dirname, '../src/services/katpay.service.js'), {
  verifyWebhookSignature: () => true,
  isTimestampFresh: () => true,
});
stubModule(path.resolve(__dirname, '../src/services/notification.service.js'), {
  sendToDevice: async () => ({ ok: true }),
});

const authService = require('../src/modules/auth/auth.service');
const bcrypt = require('bcryptjs');

const resetState = async () => {
  prismaStub.user._rows.clear();
  prismaStub.session._rows.clear();
  prismaStub.wallet._rows.clear();
  prismaStub.notificationPreferences._rows.clear();
  redisStub._store.clear();
  redisStub._ttls.clear();
};

// --- register ---

test('register: stores pending data in redis with TTL', async () => {
  await resetState();
  await authService.register({
    email: 'a@x.com', firstName: 'A', lastName: 'B', phone: '08012345678',
    password: 'password123', role: 'CUSTOMER',
  });
  const raw = redisStub._store.get('pending_reg:a@x.com');
  assert.ok(raw, 'pending registration must land in redis');
  const parsed = JSON.parse(raw);
  assert.equal(parsed.email, 'a@x.com');
  assert.ok(parsed.passwordHash);
  assert.notEqual(parsed.passwordHash, 'password123', 'must not store plaintext password');
});

test('register: EMAIL_TAKEN when a verified user exists with that email', async () => {
  await resetState();
  await prismaStub.user.create({ data: { email: 'taken@x.com', status: 'ACTIVE' } });
  await assert.rejects(
    () => authService.register({
      email: 'taken@x.com', firstName: 'A', lastName: 'B', phone: '08012345678',
      password: 'password123', role: 'CUSTOMER',
    }),
    (err) => err.code === 'EMAIL_TAKEN',
  );
});

test('register: PHONE_TAKEN when a verified user exists with that phone', async () => {
  await resetState();
  await prismaStub.user.create({ data: { email: 'other@x.com', phone: '08012345678', status: 'ACTIVE' } });
  await assert.rejects(
    () => authService.register({
      email: 'new@x.com', firstName: 'A', lastName: 'B', phone: '08012345678',
      password: 'password123', role: 'CUSTOMER',
    }),
    (err) => err.code === 'PHONE_TAKEN',
  );
});

// --- login ---

test('login: INVALID_CREDENTIALS when email unknown', async () => {
  await resetState();
  await assert.rejects(
    () => authService.login({ email: 'nope@x.com', password: 'whatever' }),
    (err) => err.code === 'INVALID_CREDENTIALS',
  );
});

test('login: INVALID_CREDENTIALS when password wrong', async () => {
  await resetState();
  const hash = await bcrypt.hash('correct-password', 4);
  await prismaStub.user.create({
    data: { email: 'u@x.com', firstName: 'U', lastName: 'X', passwordHash: hash, status: 'ACTIVE', role: 'CUSTOMER' },
  });
  await assert.rejects(
    () => authService.login({ email: 'u@x.com', password: 'wrong' }),
    (err) => err.code === 'INVALID_CREDENTIALS',
  );
});

test('login: ACCOUNT_SUSPENDED when user.status = SUSPENDED', async () => {
  await resetState();
  const hash = await bcrypt.hash('p', 4);
  await prismaStub.user.create({
    data: { email: 'u@x.com', firstName: 'U', lastName: 'X', passwordHash: hash, status: 'SUSPENDED', role: 'CUSTOMER' },
  });
  await assert.rejects(
    () => authService.login({ email: 'u@x.com', password: 'p' }),
    (err) => err.code === 'ACCOUNT_SUSPENDED',
  );
});

test('login: ACCOUNT_DEACTIVATED when user.status = DEACTIVATED', async () => {
  await resetState();
  const hash = await bcrypt.hash('p', 4);
  await prismaStub.user.create({
    data: { email: 'u@x.com', firstName: 'U', lastName: 'X', passwordHash: hash, status: 'DEACTIVATED', role: 'CUSTOMER' },
  });
  await assert.rejects(
    () => authService.login({ email: 'u@x.com', password: 'p' }),
    (err) => err.code === 'ACCOUNT_DEACTIVATED',
  );
});

test('login: PENDING users are refused login (must verify OTP first)', async () => {
  await resetState();
  const hash = await bcrypt.hash('p', 4);
  await prismaStub.user.create({
    data: { email: 'u@x.com', firstName: 'U', lastName: 'X', passwordHash: hash, status: 'PENDING', role: 'CUSTOMER' },
  });
  await assert.rejects(
    () => authService.login({ email: 'u@x.com', password: 'p' }),
    (err) => err.statusCode === 403,
  );
});

test('login: success returns tokens + creates session row with device fingerprint', async () => {
  await resetState();
  const hash = await bcrypt.hash('correct', 4);
  await prismaStub.user.create({
    data: { email: 'u@x.com', firstName: 'U', lastName: 'X', passwordHash: hash, status: 'ACTIVE', role: 'CUSTOMER' },
  });
  const result = await authService.login(
    { email: 'u@x.com', password: 'correct' },
    { ipAddress: '1.2.3.4', deviceName: 'Pixel 8', deviceModel: 'GVU6C' },
  );
  assert.ok(result.tokens.accessToken);
  assert.ok(result.tokens.refreshToken);
  assert.equal(result.user.email, 'u@x.com');
  const sessions = [...prismaStub.session._rows.values()];
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].ipAddress, '1.2.3.4');
  assert.equal(sessions[0].deviceName, 'Pixel 8');
  assert.equal(sessions[0].refreshToken, result.tokens.refreshToken);
});

// --- verifyOtp (customer auto-login path) ---

test('verifyOtp: OTP_EXPIRED when no code stored', async () => {
  await resetState();
  await assert.rejects(
    () => authService.verifyOtp('a@x.com', '123456'),
    (err) => err.code === 'OTP_EXPIRED',
  );
});

test('verifyOtp: INVALID_OTP when code mismatches', async () => {
  await resetState();
  redisStub._store.set('otp:a@x.com', '123456');
  await assert.rejects(
    () => authService.verifyOtp('a@x.com', '999999'),
    (err) => err.code === 'INVALID_OTP',
  );
});

test('verifyOtp: customer signup creates user + wallet + auto-login session', async () => {
  await resetState();
  const hash = await bcrypt.hash('password123', 4);
  redisStub._store.set('otp:new@x.com', '123456');
  redisStub._store.set(
    'pending_reg:new@x.com',
    JSON.stringify({
      email: 'new@x.com', firstName: 'New', lastName: 'User',
      phone: '08099999999', passwordHash: hash, role: 'CUSTOMER',
    }),
  );

  const result = await authService.verifyOtp('new@x.com', '123456', { ipAddress: '1.2.3.4' });

  assert.equal(result.verified, true);
  assert.ok(result.tokens?.accessToken, 'customers must auto-login after OTP');
  assert.equal(result.user.email, 'new@x.com');

  const users = [...prismaStub.user._rows.values()];
  assert.equal(users.length, 1);
  assert.equal(users[0].status, 'ACTIVE');

  // wallet row created in same tx
  const wallets = [...prismaStub.wallet._rows.values()];
  assert.equal(wallets.length, 1);
  assert.equal(wallets[0].userId, users[0].id);

  // pending_reg + OTP both burned
  assert.equal(redisStub._store.get('pending_reg:new@x.com'), undefined);
  assert.equal(redisStub._store.get('otp:new@x.com'), undefined);
});

// --- refreshAccessToken ---

test('refreshAccessToken: REFRESH_TOKEN_INVALID when token unknown', async () => {
  await resetState();
  await assert.rejects(
    () => authService.refreshAccessToken('not-a-real-token'),
    (err) => err.code === 'REFRESH_TOKEN_INVALID',
  );
});

test('refreshAccessToken: rotates token (revokes old, creates new) and carries fingerprint forward', async () => {
  await resetState();
  const user = await prismaStub.user.create({
    data: { email: 'u@x.com', firstName: 'U', lastName: 'X', role: 'CUSTOMER', status: 'ACTIVE' },
  });
  const oldSession = await prismaStub.session.create({
    data: {
      userId: user.id, refreshToken: 'old-refresh-token',
      expiresAt: new Date(Date.now() + 86400000), isRevoked: false,
      deviceName: 'Pixel 8', ipAddress: '1.2.3.4',
    },
  });

  const tokens = await authService.refreshAccessToken('old-refresh-token');

  assert.ok(tokens.accessToken);
  assert.ok(tokens.refreshToken);
  assert.notEqual(tokens.refreshToken, 'old-refresh-token');

  const oldRow = prismaStub.session._rows.get(oldSession.id);
  assert.equal(oldRow.isRevoked, true, 'old session must be revoked');

  const newRow = [...prismaStub.session._rows.values()].find((s) => s.refreshToken === tokens.refreshToken);
  assert.ok(newRow, 'a new session row must exist');
  assert.equal(newRow.deviceName, 'Pixel 8', 'device fingerprint must carry forward');
  assert.equal(newRow.ipAddress, '1.2.3.4');
});

test('refreshAccessToken: rejects a revoked session', async () => {
  await resetState();
  const user = await prismaStub.user.create({ data: { email: 'u@x.com', role: 'CUSTOMER', status: 'ACTIVE' } });
  await prismaStub.session.create({
    data: { userId: user.id, refreshToken: 'rev', expiresAt: new Date(Date.now() + 86400000), isRevoked: true },
  });
  await assert.rejects(
    () => authService.refreshAccessToken('rev'),
    (err) => err.code === 'REFRESH_TOKEN_INVALID',
  );
});

test('refreshAccessToken: rejects an expired session', async () => {
  await resetState();
  const user = await prismaStub.user.create({ data: { email: 'u@x.com', role: 'CUSTOMER', status: 'ACTIVE' } });
  await prismaStub.session.create({
    data: { userId: user.id, refreshToken: 'old', expiresAt: new Date(Date.now() - 1000), isRevoked: false },
  });
  await assert.rejects(
    () => authService.refreshAccessToken('old'),
    (err) => err.code === 'REFRESH_TOKEN_INVALID',
  );
});

// --- PIN flows ---

test('setTransactionPin: creates a hash on first call', async () => {
  await resetState();
  const user = await prismaStub.user.create({ data: { email: 'u@x.com' } });
  await authService.setTransactionPin(user.id, '123456');
  const fresh = prismaStub.user._rows.get(user.id);
  assert.ok(fresh.transactionPin);
  assert.notEqual(fresh.transactionPin, '123456');
});

test('setTransactionPin: PIN_ALREADY_SET on the second call', async () => {
  await resetState();
  const hash = await bcrypt.hash('111111', 4);
  const user = await prismaStub.user.create({ data: { email: 'u@x.com', transactionPin: hash } });
  await assert.rejects(
    () => authService.setTransactionPin(user.id, '222222'),
    (err) => err.code === 'PIN_ALREADY_SET',
  );
});

test('verifyTransactionPin: PIN_NOT_SET when user has no PIN', async () => {
  await resetState();
  const user = await prismaStub.user.create({ data: { email: 'u@x.com' } });
  await assert.rejects(
    () => authService.verifyTransactionPin(user.id, '000000'),
    (err) => err.code === 'PIN_NOT_SET',
  );
});

test('verifyTransactionPin: success on correct PIN returns true', async () => {
  await resetState();
  const hash = await bcrypt.hash('123456', 4);
  const user = await prismaStub.user.create({ data: { email: 'u@x.com', transactionPin: hash } });
  const ok = await authService.verifyTransactionPin(user.id, '123456');
  assert.equal(ok, true);
});

test('verifyTransactionPin: wrong PIN throws 401 (INVALID_PIN)', async () => {
  await resetState();
  const hash = await bcrypt.hash('123456', 4);
  const user = await prismaStub.user.create({ data: { email: 'u@x.com', transactionPin: hash } });
  await assert.rejects(
    () => authService.verifyTransactionPin(user.id, '000000'),
    (err) => err.statusCode === 401 && err.code === 'INVALID_PIN',
  );
});

test('verifyTransactionPin: never locks out - wrong PINs keep returning 401, not 423', async () => {
  await resetState();
  const hash = await bcrypt.hash('123456', 4);
  const user = await prismaStub.user.create({ data: { email: 'u@x.com', transactionPin: hash } });
  // Hammer it well past the old 6-attempt threshold.
  for (let i = 0; i < 10; i += 1) {
    await assert.rejects(
      () => authService.verifyTransactionPin(user.id, '000000'),
      (err) => err.statusCode === 401,
    );
  }
  // And the correct PIN still works immediately afterwards (no lock).
  assert.equal(await authService.verifyTransactionPin(user.id, '123456'), true);
});

test('changeTransactionPin: rejects when current PIN wrong', async () => {
  await resetState();
  const hash = await bcrypt.hash('123456', 4);
  const user = await prismaStub.user.create({ data: { email: 'u@x.com', transactionPin: hash } });
  await assert.rejects(
    () => authService.changeTransactionPin(user.id, '000000', '654321'),
    (err) => err.statusCode === 401,
  );
});

test('changeTransactionPin: updates hash on correct current PIN', async () => {
  await resetState();
  const hash = await bcrypt.hash('123456', 4);
  const user = await prismaStub.user.create({ data: { email: 'u@x.com', transactionPin: hash } });
  await authService.changeTransactionPin(user.id, '123456', '654321');
  const fresh = prismaStub.user._rows.get(user.id);
  const matches = await bcrypt.compare('654321', fresh.transactionPin);
  assert.equal(matches, true);
});

// --- Sessions ---

test('listSessions: returns active only, marks current, sorted newest first', async () => {
  await resetState();
  const user = await prismaStub.user.create({ data: { email: 'u@x.com' } });
  await prismaStub.session.create({
    data: { userId: user.id, refreshToken: 'a', isRevoked: false, expiresAt: new Date(Date.now() + 86400000), lastUsedAt: new Date('2026-05-15') },
  });
  await prismaStub.session.create({
    data: { userId: user.id, refreshToken: 'b', isRevoked: false, expiresAt: new Date(Date.now() + 86400000), lastUsedAt: new Date('2026-05-17') },
  });
  await prismaStub.session.create({
    data: { userId: user.id, refreshToken: 'expired', isRevoked: false, expiresAt: new Date(Date.now() - 1000), lastUsedAt: new Date('2026-05-10') },
  });
  await prismaStub.session.create({
    data: { userId: user.id, refreshToken: 'revoked', isRevoked: true, expiresAt: new Date(Date.now() + 86400000), lastUsedAt: new Date('2026-05-18') },
  });

  const list = await authService.listSessions(user.id, 'b');
  assert.equal(list.length, 2);
  assert.equal(list[0].isCurrent, true);
  assert.equal(list[1].isCurrent, false);
});

test('revokeSession: refuses when sessionId belongs to another user', async () => {
  await resetState();
  const user = await prismaStub.user.create({ data: { email: 'me@x.com' } });
  const other = await prismaStub.user.create({ data: { email: 'them@x.com' } });
  const stolen = await prismaStub.session.create({
    data: { userId: other.id, refreshToken: 'theirs', isRevoked: false, expiresAt: new Date(Date.now() + 86400000) },
  });
  await assert.rejects(
    () => authService.revokeSession(user.id, stolen.id),
    (err) => err.statusCode === 404,
  );
});

test('revokeSession: marks the session revoked on success', async () => {
  await resetState();
  const user = await prismaStub.user.create({ data: { email: 'u@x.com' } });
  const s = await prismaStub.session.create({
    data: { userId: user.id, refreshToken: 'mine', isRevoked: false, expiresAt: new Date(Date.now() + 86400000) },
  });
  await authService.revokeSession(user.id, s.id);
  assert.equal(prismaStub.session._rows.get(s.id).isRevoked, true);
});

test('revokeOtherSessions: leaves current session, revokes the rest', async () => {
  await resetState();
  const user = await prismaStub.user.create({ data: { email: 'u@x.com' } });
  await prismaStub.session.create({ data: { userId: user.id, refreshToken: 'cur', isRevoked: false, expiresAt: new Date(Date.now() + 86400000) } });
  await prismaStub.session.create({ data: { userId: user.id, refreshToken: 'other-1', isRevoked: false, expiresAt: new Date(Date.now() + 86400000) } });
  await prismaStub.session.create({ data: { userId: user.id, refreshToken: 'other-2', isRevoked: false, expiresAt: new Date(Date.now() + 86400000) } });

  await authService.revokeOtherSessions(user.id, 'cur');

  const all = [...prismaStub.session._rows.values()];
  const cur = all.find((s) => s.refreshToken === 'cur');
  const others = all.filter((s) => s.refreshToken !== 'cur');
  assert.equal(cur.isRevoked, false, 'current session must remain');
  assert.ok(others.every((s) => s.isRevoked === true), 'all other sessions must be revoked');
});

// --- Password reset ---

test('requestPasswordReset: silently returns null for unknown email (no enumeration)', async () => {
  await resetState();
  const result = await authService.requestPasswordReset('nobody@x.com');
  assert.equal(result, null);
});

test('requestPasswordReset: silently returns null for non-ACTIVE user', async () => {
  await resetState();
  await prismaStub.user.create({ data: { email: 'pending@x.com', status: 'PENDING' } });
  const result = await authService.requestPasswordReset('pending@x.com');
  assert.equal(result, null);
});

test('requestPasswordReset: generates an OTP for an ACTIVE user', async () => {
  await resetState();
  await prismaStub.user.create({ data: { email: 'active@x.com', status: 'ACTIVE' } });
  const code = await authService.requestPasswordReset('active@x.com');
  assert.match(code, /^\d{6}$/);
  assert.equal(redisStub._store.get('otp:active@x.com'), code);
});

test('resetPassword: revokes ALL sessions after a successful reset', async () => {
  await resetState();
  const oldHash = await bcrypt.hash('old', 4);
  const user = await prismaStub.user.create({ data: { email: 'u@x.com', status: 'ACTIVE', passwordHash: oldHash } });
  await prismaStub.session.create({ data: { userId: user.id, refreshToken: 's1', isRevoked: false, expiresAt: new Date(Date.now() + 86400000) } });
  await prismaStub.session.create({ data: { userId: user.id, refreshToken: 's2', isRevoked: false, expiresAt: new Date(Date.now() + 86400000) } });
  redisStub._store.set('otp:u@x.com', '123456');

  await authService.resetPassword('u@x.com', '123456', 'newpass');

  const all = [...prismaStub.session._rows.values()];
  assert.ok(all.every((s) => s.isRevoked === true), 'reset must invalidate every session');
  const fresh = prismaStub.user._rows.get(user.id);
  assert.notEqual(fresh.passwordHash, oldHash, 'password hash must change');
});

// --- Phone change ---

test('requestPhoneChange: INCORRECT_PASSWORD when password wrong', async () => {
  await resetState();
  const hash = await bcrypt.hash('correct', 4);
  const user = await prismaStub.user.create({ data: { email: 'u@x.com', phone: '08000000001', passwordHash: hash } });
  await assert.rejects(
    () => authService.requestPhoneChange(user.id, { newPhone: '08000000002', password: 'wrong' }),
    (err) => err.code === 'INCORRECT_PASSWORD',
  );
});

test('requestPhoneChange: PHONE_TAKEN when new phone already exists', async () => {
  await resetState();
  const hash = await bcrypt.hash('correct', 4);
  const user = await prismaStub.user.create({ data: { email: 'u@x.com', phone: '08000000001', passwordHash: hash } });
  await prismaStub.user.create({ data: { email: 'other@x.com', phone: '08000000002' } });
  await assert.rejects(
    () => authService.requestPhoneChange(user.id, { newPhone: '08000000002', password: 'correct' }),
    (err) => err.code === 'PHONE_TAKEN',
  );
});

test('requestPhoneChange: stores pending change in redis with code + oldPhone', async () => {
  await resetState();
  const hash = await bcrypt.hash('correct', 4);
  const user = await prismaStub.user.create({ data: { email: 'u@x.com', phone: '08000000001', passwordHash: hash } });
  await authService.requestPhoneChange(user.id, { newPhone: '08000000002', password: 'correct' });
  const raw = redisStub._store.get(`phone:change:${user.id}`);
  assert.ok(raw);
  const parsed = JSON.parse(raw);
  assert.equal(parsed.newPhone, '08000000002');
  assert.equal(parsed.oldPhone, '08000000001');
  assert.match(parsed.code, /^\d{6}$/);
});

test('confirmPhoneChange: INVALID_OTP on wrong code', async () => {
  await resetState();
  const user = await prismaStub.user.create({ data: { email: 'u@x.com', phone: '08000000001' } });
  redisStub._store.set(
    `phone:change:${user.id}`,
    JSON.stringify({ newPhone: '08000000002', oldPhone: '08000000001', code: '123456' }),
  );
  await assert.rejects(
    () => authService.confirmPhoneChange(user.id, { newPhone: '08000000002', otp: '999999' }),
    (err) => err.code === 'INVALID_OTP',
  );
});

test('confirmPhoneChange: rejects mismatch between submitted phone and pending phone', async () => {
  await resetState();
  const user = await prismaStub.user.create({ data: { email: 'u@x.com', phone: '08000000001' } });
  redisStub._store.set(
    `phone:change:${user.id}`,
    JSON.stringify({ newPhone: '08000000002', oldPhone: '08000000001', code: '123456' }),
  );
  await assert.rejects(
    () => authService.confirmPhoneChange(user.id, { newPhone: '08099999999', otp: '123456' }),
    (err) => err.statusCode === 400,
  );
});

test('confirmPhoneChange: applies new phone and cleans up pending key', async () => {
  await resetState();
  const user = await prismaStub.user.create({ data: { email: 'u@x.com', phone: '08000000001' } });
  redisStub._store.set(
    `phone:change:${user.id}`,
    JSON.stringify({ newPhone: '08000000002', oldPhone: '08000000001', code: '123456' }),
  );
  await authService.confirmPhoneChange(user.id, { newPhone: '08000000002', otp: '123456' });
  assert.equal(prismaStub.user._rows.get(user.id).phone, '08000000002');
  assert.equal(redisStub._store.get(`phone:change:${user.id}`), undefined);
});

// --- Notification preferences ---

test('getNotificationPreferences: creates defaults on first read', async () => {
  await resetState();
  const user = await prismaStub.user.create({ data: { email: 'u@x.com' } });
  const prefs = await authService.getNotificationPreferences(user.id);
  assert.equal(prefs.pushEnabled, true);
  assert.equal(prefs.promotions, true);
  assert.equal(prefs.smsEnabled, false);
});

test('updateNotificationPreferences: upserts and only changes provided fields', async () => {
  await resetState();
  const user = await prismaStub.user.create({ data: { email: 'u@x.com' } });
  await authService.getNotificationPreferences(user.id); // seed defaults
  const updated = await authService.updateNotificationPreferences(user.id, { promotions: false });
  assert.equal(updated.promotions, false);
  assert.equal(updated.pushEnabled, true, 'untouched flags must remain at their default');
});

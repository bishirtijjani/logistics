/**
 * Notification feed service tests.
 *
 * Run with: node --test tests/notification-service.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

const { makeAuthPrismaStub, makeRedisStub } = require('./_test-helpers');

const stubModule = (filename, exports) => {
  const mod = new Module(filename);
  mod.filename = filename;
  mod.loaded = true;
  mod.exports = exports;
  require.cache[filename] = mod;
};

const prismaStub = makeAuthPrismaStub();
stubModule(path.resolve(__dirname, '../src/config/database.js'), { prisma: prismaStub });
stubModule(path.resolve(__dirname, '../src/config/redis.js'), { redis: makeRedisStub() });
stubModule(path.resolve(__dirname, '../src/utils/logger.js'), {
  logger: { info() {}, warn() {}, error() {}, debug() {} },
});

const notificationService = require('../src/modules/notification/notification.service');

const USER_A = '00000000-0000-4000-a000-000000000n01';
const USER_B = '00000000-0000-4000-a000-000000000n02';

const reset = () => {
  prismaStub.notification._rows.clear();
};

const seedFeed = async () => {
  const t = (d) => new Date(d);
  await prismaStub.notification.create({ data: { userId: USER_A, title: 'A1', body: '', createdAt: t('2026-05-10'), readAt: null } });
  await prismaStub.notification.create({ data: { userId: USER_A, title: 'A2', body: '', createdAt: t('2026-05-15'), readAt: t('2026-05-16') } });
  await prismaStub.notification.create({ data: { userId: USER_A, title: 'A3', body: '', createdAt: t('2026-05-18'), readAt: null } });
  await prismaStub.notification.create({ data: { userId: USER_B, title: 'B1', body: '', createdAt: t('2026-05-15'), readAt: null } });
};

// --- list + counts ---

test('listNotifications: returns only the caller user feed, newest first', async () => {
  reset();
  await seedFeed();
  const { notifications, total, unreadCount } = await notificationService.listNotifications(USER_A, {
    page: 1, limit: 20, unreadOnly: false,
  });
  assert.equal(total, 3);
  assert.equal(unreadCount, 2);
  assert.equal(notifications[0].title, 'A3');
  assert.equal(notifications[2].title, 'A1');
});

test('listNotifications: unreadOnly filters out read items but unreadCount still tracks all unread', async () => {
  reset();
  await seedFeed();
  const out = await notificationService.listNotifications(USER_A, {
    page: 1, limit: 20, unreadOnly: true,
  });
  assert.equal(out.notifications.length, 2);
  assert.ok(out.notifications.every((n) => n.readAt === null));
  assert.equal(out.unreadCount, 2);
});

test('listNotifications: pagination skips/takes correctly', async () => {
  reset();
  for (let i = 0; i < 5; i++) {
    await prismaStub.notification.create({
      data: { userId: USER_A, title: `T${i}`, body: '', createdAt: new Date(2026, 4, i + 1), readAt: null },
    });
  }
  const page1 = await notificationService.listNotifications(USER_A, { page: 1, limit: 2, unreadOnly: false });
  const page2 = await notificationService.listNotifications(USER_A, { page: 2, limit: 2, unreadOnly: false });
  assert.equal(page1.notifications.length, 2);
  assert.equal(page2.notifications.length, 2);
  // Page boundaries don't overlap
  assert.notEqual(page1.notifications[0].id, page2.notifications[0].id);
});

test('getUnreadCount: counts only unread for the caller user', async () => {
  reset();
  await seedFeed();
  const out = await notificationService.getUnreadCount(USER_A);
  assert.equal(out.count, 2);
  const otherOut = await notificationService.getUnreadCount(USER_B);
  assert.equal(otherOut.count, 1);
});

// --- markRead ---

test('markRead: 404 when notification does not exist', async () => {
  reset();
  await assert.rejects(
    () => notificationService.markRead(USER_A, '00000000-0000-4000-a000-deadbeef0000'),
    (err) => err.statusCode === 404,
  );
});

test('markRead: 403 when notification belongs to another user', async () => {
  reset();
  await seedFeed();
  const otherRow = [...prismaStub.notification._rows.values()].find((n) => n.userId === USER_B);
  await assert.rejects(
    () => notificationService.markRead(USER_A, otherRow.id),
    (err) => err.statusCode === 403,
  );
});

test('markRead: sets readAt on first call', async () => {
  reset();
  const n = await prismaStub.notification.create({
    data: { userId: USER_A, title: 'X', body: '', readAt: null, createdAt: new Date() },
  });
  await notificationService.markRead(USER_A, n.id);
  assert.ok(prismaStub.notification._rows.get(n.id).readAt instanceof Date);
});

test('markRead: idempotent — second call is a no-op', async () => {
  reset();
  const original = new Date('2026-05-10');
  const n = await prismaStub.notification.create({
    data: { userId: USER_A, title: 'X', body: '', readAt: original, createdAt: new Date() },
  });
  const out = await notificationService.markRead(USER_A, n.id);
  assert.equal(out.readAt, original, 'readAt timestamp must not be overwritten');
});

// --- markAllRead ---

test('markAllRead: only flips the caller user\'s unread, leaves other users alone', async () => {
  reset();
  await seedFeed();
  const out = await notificationService.markAllRead(USER_A);
  assert.equal(out.updated, 2);
  const userAUnread = [...prismaStub.notification._rows.values()].filter(
    (n) => n.userId === USER_A && n.readAt == null,
  ).length;
  const userBUnread = [...prismaStub.notification._rows.values()].filter(
    (n) => n.userId === USER_B && n.readAt == null,
  ).length;
  assert.equal(userAUnread, 0);
  assert.equal(userBUnread, 1, 'must not touch other users');
});

test('markAllRead: returns updated=0 when nothing was unread', async () => {
  reset();
  await prismaStub.notification.create({
    data: { userId: USER_A, title: 'Already read', readAt: new Date(), body: '', createdAt: new Date() },
  });
  const out = await notificationService.markAllRead(USER_A);
  assert.equal(out.updated, 0);
});

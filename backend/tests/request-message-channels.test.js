/**
 * Order chat is split into private 1:1 threads: CUSTOMER_RIDER,
 * CUSTOMER_MERCHANT, RIDER_MERCHANT. A message on one channel must never
 * reach the third stakeholder - not in the DB query, and not over the
 * socket (delivery goes to each participant's personal user:{id} room, not
 * the shared request room).
 *
 * Also covers the deliberate backward-compat default: requests with no
 * `channel` (pre-split rider/customer app installs) fall back to
 * CUSTOMER_RIDER.
 *
 * Run with: node --test tests/request-message-channels.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

const stubModule = (filename, exports) => {
  const mod = new Module(filename);
  mod.filename = filename;
  mod.loaded = true;
  mod.exports = exports;
  require.cache[filename] = mod;
};
const p = (rel) => path.resolve(__dirname, rel);

const CUSTOMER_ID = 'user-customer-1';
const RIDER_USER_ID = 'user-rider-1';
const MERCHANT_USER_ID = 'user-merchant-1';

// ---- In-memory data ------------------------------------------------------
const db = {
  requests: new Map(), // id -> { id, customerId, riderUserId, merchantUserId }
  messages: [], // { id, requestId, fromUserId, channel, body, createdAt, fromUser }
};

const USERS = {
  [CUSTOMER_ID]: { id: CUSTOMER_ID, firstName: 'Cus', lastName: 'Tomer', role: 'CUSTOMER' },
  [RIDER_USER_ID]: { id: RIDER_USER_ID, firstName: 'Ri', lastName: 'Der', role: 'RIDER' },
  [MERCHANT_USER_ID]: { id: MERCHANT_USER_ID, firstName: 'Mer', lastName: 'Chant', role: 'MERCHANT' },
};

const resetDb = () => {
  db.requests.clear();
  db.messages = [];
};

const seedRequest = ({ id, customerId = CUSTOMER_ID, riderUserId = null, merchantUserId = null }) => {
  db.requests.set(id, { id, customerId, riderUserId, merchantUserId });
};

const prismaStub = {
  request: {
    async findUnique({ where }) {
      const row = db.requests.get(where.id);
      if (!row) return null;
      return {
        id: row.id,
        customerId: row.customerId,
        rider: row.riderUserId ? { user: { id: row.riderUserId } } : null,
        merchant: row.merchantUserId ? { userId: row.merchantUserId } : null,
      };
    },
  },
  requestMessage: {
    async create({ data }) {
      const message = {
        id: `msg-${db.messages.length + 1}`,
        createdAt: new Date(Date.now() + db.messages.length), // monotonic for ordering
        ...data,
        fromUser: USERS[data.fromUserId],
      };
      db.messages.push(message);
      return message;
    },
    async findMany({ where }) {
      let rows = db.messages.filter((m) => m.requestId === where.requestId && m.channel === where.channel);
      if (where.createdAt?.lt) rows = rows.filter((m) => m.createdAt < where.createdAt.lt);
      return rows.slice().sort((a, b) => b.createdAt - a.createdAt);
    },
  },
};

// ---- Socket + notification capture ---------------------------------------
let emits = []; // { room, event, payload }
const fakeIo = {
  to(room) {
    return { emit: (event, payload) => emits.push({ room, event, payload }) };
  },
};
let pushes = []; // { userId, payload }
const notifyStub = {
  setIO() {},
  getIO: () => fakeIo,
  async pushAndSocket(userId, payload) {
    pushes.push({ userId, payload });
    return { id: 'notif-1' };
  },
};

// ---- Install stubs BEFORE requiring the service --------------------------
stubModule(p('../src/config/database.js'), { prisma: prismaStub });
stubModule(p('../src/config/redis.js'), { redis: { async get() { return null; }, async set() {}, async del() {} } });
stubModule(p('../src/config/index.js'), { config: { NODE_ENV: 'test' } });
stubModule(p('../src/utils/logger.js'), { logger: { info() {}, warn() {}, error() {}, debug() {} } });
stubModule(p('../src/queues/index.js'), { requestQueue: { async add() {} }, riderQueue: { async add() {} }, initializeQueues() {} });
stubModule(p('../src/sockets/index.js'), { getIO: () => fakeIo, invalidateUserAuthCache() {}, initializeSocket() {} });
stubModule(p('../src/sockets/handlers/request.handler.js'), {
  emitRequestCreated() {}, emitStatusChanged() {}, emitMerchantAccepted() {},
  emitMerchantReady() {}, emitRiderAssigned() {}, emitCompleted() {}, emitCancelled() {},
});
stubModule(p('../src/services/notify.service.js'), notifyStub);
stubModule(p('../src/services/email.service.js'), new Proxy({}, { get: () => async () => {} }));
stubModule(p('../src/services/settings.service.js'), { async getSetting() { return null; } });
stubModule(p('../src/modules/auth/auth.service.js'), { async verifyTransactionPin() { return true; } });
stubModule(p('../src/services/maps.service.js'), new Proxy({}, { get: () => async () => ({}) }));

const requestService = require('../src/modules/request/request.service');

const getUserRoom = (userId) => `user:${userId}`;

test.beforeEach(() => {
  resetDb();
  emits = [];
  pushes = [];
});

test('CUSTOMER_RIDER: customer and rider can message each other, delivered only to their two personal rooms', async () => {
  seedRequest({ id: 'req-1', riderUserId: RIDER_USER_ID, merchantUserId: MERCHANT_USER_ID });

  const message = await requestService.postMessage('req-1', CUSTOMER_ID, {
    channel: 'CUSTOMER_RIDER',
    body: 'On my way down',
  });

  assert.equal(message.channel, 'CUSTOMER_RIDER');

  const rooms = emits.map((e) => e.room).sort();
  assert.deepEqual(rooms, [getUserRoom(CUSTOMER_ID), getUserRoom(RIDER_USER_ID)].sort());
  // The merchant - present on this order but not part of this channel -
  // must not receive the socket event or the push.
  assert.ok(!rooms.includes(getUserRoom(MERCHANT_USER_ID)));
  assert.deepEqual(pushes.map((n) => n.userId), [RIDER_USER_ID]);
});

test('a third stakeholder cannot post or read a channel they are not part of', async () => {
  seedRequest({ id: 'req-2', riderUserId: RIDER_USER_ID, merchantUserId: MERCHANT_USER_ID });

  await assert.rejects(
    () => requestService.postMessage('req-2', MERCHANT_USER_ID, { channel: 'CUSTOMER_RIDER', body: 'hi' }),
    (err) => err.statusCode === 403,
  );
  await assert.rejects(
    () => requestService.listMessages('req-2', MERCHANT_USER_ID, { channel: 'CUSTOMER_RIDER' }),
    (err) => err.statusCode === 403,
  );
});

test('a channel is unavailable until both of its stakeholders exist on the order', async () => {
  seedRequest({ id: 'req-3', riderUserId: null, merchantUserId: MERCHANT_USER_ID }); // no rider yet

  await assert.rejects(
    () => requestService.postMessage('req-3', CUSTOMER_ID, { channel: 'CUSTOMER_RIDER', body: 'hi' }),
    (err) => err.statusCode === 400,
  );
  await assert.rejects(
    () => requestService.postMessage('req-3', MERCHANT_USER_ID, { channel: 'RIDER_MERCHANT', body: 'hi' }),
    (err) => err.statusCode === 400,
  );
});

test('messages on one channel never leak into another channel on the same request', async () => {
  seedRequest({ id: 'req-4', riderUserId: RIDER_USER_ID, merchantUserId: MERCHANT_USER_ID });

  await requestService.postMessage('req-4', CUSTOMER_ID, { channel: 'CUSTOMER_RIDER', body: 'to the rider' });
  await requestService.postMessage('req-4', CUSTOMER_ID, { channel: 'CUSTOMER_MERCHANT', body: 'to the merchant' });
  await requestService.postMessage('req-4', RIDER_USER_ID, { channel: 'RIDER_MERCHANT', body: 'to the merchant too' });

  const riderThread = await requestService.listMessages('req-4', CUSTOMER_ID, { channel: 'CUSTOMER_RIDER' });
  assert.deepEqual(riderThread.map((m) => m.body), ['to the rider']);

  const merchantThread = await requestService.listMessages('req-4', CUSTOMER_ID, { channel: 'CUSTOMER_MERCHANT' });
  assert.deepEqual(merchantThread.map((m) => m.body), ['to the merchant']);

  // The rider must not be able to see the customer<->merchant thread even
  // though they're a stakeholder on the order.
  await assert.rejects(
    () => requestService.listMessages('req-4', RIDER_USER_ID, { channel: 'CUSTOMER_MERCHANT' }),
    (err) => err.statusCode === 403,
  );
});

test('backward compat: omitting `channel` defaults to CUSTOMER_RIDER for pre-split app installs', async () => {
  seedRequest({ id: 'req-5', riderUserId: RIDER_USER_ID, merchantUserId: MERCHANT_USER_ID });

  const message = await requestService.postMessage('req-5', CUSTOMER_ID, { body: 'no channel sent' });
  assert.equal(message.channel, 'CUSTOMER_RIDER');

  // The merchant should not receive it under the default fallback either.
  assert.deepEqual(pushes.map((n) => n.userId), [RIDER_USER_ID]);

  const defaultThread = await requestService.listMessages('req-5', CUSTOMER_ID, {});
  assert.deepEqual(defaultThread.map((m) => m.body), ['no channel sent']);
});

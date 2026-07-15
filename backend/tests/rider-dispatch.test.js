/**
 * Rider dispatch regression tests.
 *
 * Covers the two bugs that kept admin-assigned deliveries invisible to riders:
 *
 *   Bug 1 - rider REST reads keyed on the wrong id. Request.riderId stores a
 *   Rider.id, which is a different UUID from the caller's User.id (the JWT id).
 *   getRequests / getRequestById must filter / authorise through the rider
 *   relation on userId, not compare Request.riderId to a User.id.
 *
 *   Bug 2 - admin reassignRider never reached the just-assigned rider live
 *   (only emitted to the request room the rider hasn't joined) and only bumped
 *   status to RIDER_ASSIGNED from READY_FOR_PICKUP, so an assignment onto a
 *   REQUESTED request stayed below the rider app's active-trip filter.
 *
 * The whole point: assign a rider to a REQUESTED request and the rider's
 * GET /requests + GET /requests/:id both return it, the status flips into the
 * active set, and the rider gets a live socket event + push.
 *
 * Run with: node --test tests/rider-dispatch.test.js
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

// ---- In-memory data stores shared by the prisma stub --------------------
const db = {
  requests: new Map(), // id -> request row (scalars + riderId/customerId/merchantId)
  riders: new Map(),   // id -> { id, userId, status }
  merchants: new Map(),// id -> { id, userId }
  auditLogs: [],
};

const resetDb = () => {
  db.requests.clear();
  db.riders.clear();
  db.merchants.clear();
  db.auditLogs = [];
};

// Hydrate a request row's relations for `include` reads (admin path needs
// rider.user.id; rider/merchant reads don't inspect the nested shape).
const hydrate = (row) => {
  if (!row) return row;
  const rider = row.riderId ? db.riders.get(row.riderId) : null;
  const merchant = row.merchantId ? db.merchants.get(row.merchantId) : null;
  return {
    ...row,
    rider: rider
      ? {
          id: rider.id,
          vehicleType: rider.vehicleType || 'BIKE',
          plateNumber: rider.plateNumber || 'ABC123',
          user: { id: rider.userId, firstName: 'R', lastName: 'One', phone: '+2340000000000' },
        }
      : null,
    merchant: merchant ? { id: merchant.id } : null,
    customer: row.customerId ? { id: row.customerId } : null,
  };
};

const requestMatches = (row, where = {}) => {
  for (const key of Object.keys(where)) {
    const cond = where[key];
    if (cond == null) continue;
    if (key === 'AND') {
      // Every sub-filter in the AND array must match.
      if (!cond.every((sub) => requestMatches(row, sub))) return false;
      continue;
    }
    if (key === 'customerId') {
      if (row.customerId !== cond) return false;
    } else if (key === 'riderId') {
      if (row.riderId !== cond) return false;
    } else if (key === 'merchantId') {
      if (row.merchantId !== cond) return false;
    } else if (key === 'type') {
      if (row.type !== cond) return false;
    } else if (key === 'status') {
      if (cond && typeof cond === 'object' && Array.isArray(cond.in)) {
        if (!cond.in.includes(row.status)) return false;
      } else if (row.status !== cond) return false;
    } else if (key === 'rider') {
      // { rider: { is: { userId } } } - the Bug 1 relation filter.
      const wantUserId = cond?.is?.userId;
      const rider = row.riderId ? db.riders.get(row.riderId) : null;
      if (!rider || rider.userId !== wantUserId) return false;
    } else if (key === 'merchant') {
      const wantUserId = cond?.is?.userId;
      // Ignore category-style nested filters not relevant to these tests.
      if (wantUserId !== undefined) {
        const merchant = row.merchantId ? db.merchants.get(row.merchantId) : null;
        if (!merchant || merchant.userId !== wantUserId) return false;
      }
    }
    // Unhandled keys are treated as "no constraint" - fine for these tests.
  }
  return true;
};

const prismaStub = {
  request: {
    async findMany({ where, skip, take }) {
      let rows = [...db.requests.values()].filter((r) => requestMatches(r, where));
      if (skip) rows = rows.slice(skip);
      if (take) rows = rows.slice(0, take);
      return rows.map(hydrate);
    },
    async count({ where }) {
      return [...db.requests.values()].filter((r) => requestMatches(r, where)).length;
    },
    async findUnique({ where }) {
      return hydrate(db.requests.get(where.id) || null);
    },
    async update({ where, data }) {
      const row = db.requests.get(where.id);
      if (!row) throw new Error('request not found');
      Object.assign(row, data);
      return hydrate(row);
    },
  },
  rider: {
    async findUnique({ where, select }) {
      let row = null;
      if (where.id) row = db.riders.get(where.id) || null;
      else if (where.userId) row = [...db.riders.values()].find((r) => r.userId === where.userId) || null;
      if (!row) return null;
      if (select) return Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, row[k]]));
      return row;
    },
  },
  merchant: {
    async findUnique({ where, select }) {
      let row = null;
      if (where.id) row = db.merchants.get(where.id) || null;
      else if (where.userId) row = [...db.merchants.values()].find((m) => m.userId === where.userId) || null;
      if (!row) return null;
      if (select) return Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, row[k]]));
      return row;
    },
  },
  auditLog: {
    async create({ data }) {
      db.auditLogs.push(data);
      return { id: 'audit-1', ...data };
    },
  },
};

// ---- Socket + notification capture -------------------------------------
const emits = []; // { room, event, payload }
const fakeIo = {
  to(room) {
    return {
      emit(event, payload) {
        emits.push({ room, event, payload });
      },
    };
  },
};
const pushes = []; // { userId, payload }
const notifyStub = {
  setIO() {},
  getIO: () => fakeIo,
  async pushAndSocket(userId, payload) {
    pushes.push({ userId, payload });
    return { id: 'notif-1' };
  },
  async onRequestStatusChanged() {},
  async onWalletEvent() {},
  balanceUpdated() {},
  transferReceived() {},
  fundingReceived() {},
};

// ---- Install stubs BEFORE requiring the services -----------------------
stubModule(p('../src/config/database.js'), { prisma: prismaStub });
stubModule(p('../src/config/redis.js'), { redis: { async get() { return null; }, async set() {}, async del() {}, async geoadd() {}, async geosearch() { return []; }, async sadd() {}, async expire() {} } });
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
const adminService = require('../src/modules/admin/admin.service');

// ---- Fixtures ----------------------------------------------------------
const RIDER_ID = 'rider-1';        // Rider.id (what Request.riderId stores)
const RIDER_USER_ID = 'user-rider-1'; // Rider.userId (the JWT id)
const OTHER_RIDER_ID = 'rider-2';
const OTHER_RIDER_USER_ID = 'user-rider-2';
const CUSTOMER_ID = 'user-customer-1';

const seedBase = () => {
  resetDb();
  emits.length = 0;
  pushes.length = 0;
  db.riders.set(RIDER_ID, { id: RIDER_ID, userId: RIDER_USER_ID, status: 'APPROVED' });
  db.riders.set(OTHER_RIDER_ID, { id: OTHER_RIDER_ID, userId: OTHER_RIDER_USER_ID, status: 'APPROVED' });
};

const seedRequest = (over = {}) => {
  const id = over.id || `req-${db.requests.size + 1}`;
  const row = {
    id,
    type: 'PACKAGE',
    status: 'REQUESTED',
    customerId: CUSTOMER_ID,
    merchantId: null,
    riderId: null,
    pickupLat: 13.0, pickupLng: 7.6, pickupAddress: 'A', dropoffAddress: 'B',
    total: 1500, paymentMethod: 'CASH',
    createdAt: new Date(),
    ...over,
  };
  db.requests.set(id, row);
  return row;
};

// ---- Bug 1: rider REST reads keyed on the relation, not the raw id ------
test('getRequests for a RIDER returns deliveries assigned to their Rider.id (not User.id)', async () => {
  seedBase();
  seedRequest({ id: 'mine', riderId: RIDER_ID, status: 'RIDER_ASSIGNED' });
  seedRequest({ id: 'someone-elses', riderId: OTHER_RIDER_ID, status: 'RIDER_ASSIGNED' });

  const res = await requestService.getRequests(RIDER_USER_ID, 'RIDER', { page: 1, limit: 20 });

  assert.equal(res.total, 1, 'rider should see exactly their own delivery');
  assert.deepEqual(res.requests.map((r) => r.id), ['mine']);
});

test('getRequestById lets the assigned rider read their own job (no false 403)', async () => {
  seedBase();
  seedRequest({ id: 'job', riderId: RIDER_ID, status: 'RIDER_ASSIGNED' });

  const job = await requestService.getRequestById('job', RIDER_USER_ID, 'RIDER');
  assert.equal(job.id, 'job');
});

test('getRequestById forbids a rider from reading a job assigned to a different rider', async () => {
  seedBase();
  seedRequest({ id: 'job', riderId: OTHER_RIDER_ID, status: 'RIDER_ASSIGNED' });

  await assert.rejects(
    () => requestService.getRequestById('job', RIDER_USER_ID, 'RIDER'),
    /Not your assigned request/,
  );
});

test('getRequests for a MERCHANT filters through the merchant relation on userId', async () => {
  seedBase();
  const MERCH_ID = 'merch-1';
  const MERCH_USER_ID = 'user-merch-1';
  db.merchants.set(MERCH_ID, { id: MERCH_ID, userId: MERCH_USER_ID });
  db.merchants.set('merch-2', { id: 'merch-2', userId: 'user-merch-2' });
  seedRequest({ id: 'mine', type: 'MERCHANT_ORDER', merchantId: MERCH_ID });
  seedRequest({ id: 'theirs', type: 'MERCHANT_ORDER', merchantId: 'merch-2' });

  const res = await requestService.getRequests(MERCH_USER_ID, 'MERCHANT', { page: 1, limit: 20 });
  assert.deepEqual(res.requests.map((r) => r.id), ['mine']);
});

test('getRequests keeps the merchant ownership filter even when a category filter is passed', async () => {
  // Guards the AND construction: the category filter also lives on the
  // `merchant` relation, so a single object literal would clobber ownership
  // and leak other merchants' orders.
  seedBase();
  const MERCH_ID = 'merch-1';
  const MERCH_USER_ID = 'user-merch-1';
  db.merchants.set(MERCH_ID, { id: MERCH_ID, userId: MERCH_USER_ID });
  db.merchants.set('merch-2', { id: 'merch-2', userId: 'user-merch-2' });
  seedRequest({ id: 'mine', type: 'MERCHANT_ORDER', merchantId: MERCH_ID });
  seedRequest({ id: 'theirs', type: 'MERCHANT_ORDER', merchantId: 'merch-2' });

  const res = await requestService.getRequests(MERCH_USER_ID, 'MERCHANT', { page: 1, limit: 20, categoryId: 'cat-x' });
  assert.ok(!res.requests.some((r) => r.id === 'theirs'), 'must never leak another merchant\'s orders');
});

// ---- Bug 2: admin assignment onto REQUESTED notifies the rider live -----
test('admin reassignRider onto a REQUESTED request activates it and notifies the rider live', async () => {
  seedBase();
  seedRequest({ id: 'pkg', status: 'REQUESTED', riderId: null });

  const updated = await adminService.reassignRider('pkg', RIDER_ID, 'admin-1', '127.0.0.1', 'jest');

  // Status flips into the active set so the rider app's active-trip filter
  // (RIDER_ASSIGNED..IN_TRANSIT) surfaces it.
  assert.equal(updated.status, 'RIDER_ASSIGNED');
  assert.ok(updated.riderAssignedAt, 'riderAssignedAt should be stamped');

  // Live socket event reached the rider's personal user room, not just the
  // request room they haven't joined.
  const riderRoomEmits = emits.filter((e) => e.room === `user:${RIDER_USER_ID}`);
  assert.ok(
    riderRoomEmits.some((e) => e.event === 'request:rider:assigned'),
    'rider should get a rider:assigned event on their user room',
  );

  // Push + Notification Center row for the rider.
  assert.ok(
    pushes.some((x) => x.userId === RIDER_USER_ID),
    'rider should receive a push/notification for the assignment',
  );

  // And the read path now returns it to that rider.
  const list = await requestService.getRequests(RIDER_USER_ID, 'RIDER', { page: 1, limit: 20 });
  assert.deepEqual(list.requests.map((r) => r.id), ['pkg']);
});

test('admin reassignRider mid-flight (already active) keeps the current status', async () => {
  seedBase();
  seedRequest({ id: 'trip', status: 'PICKED_UP', riderId: OTHER_RIDER_ID });

  const updated = await adminService.reassignRider('trip', RIDER_ID, 'admin-1', '127.0.0.1', 'jest');
  assert.equal(updated.status, 'PICKED_UP', 'a mid-flight swap must not rewind the FSM');
});

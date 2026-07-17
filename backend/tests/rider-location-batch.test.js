/**
 * Rider location endpoint - batch-drain regression tests.
 *
 * POST /rider/location accepts either a single live fix `{ lat, lng }` or a
 * batch `{ updates: [...] }` that the rider app drains from its offline ring
 * buffer on socket reconnect. Only the most recent fix is the rider's current
 * position, and applying it must keep them dispatchable (re-add to the geo
 * pool). These tests pin that behaviour.
 *
 * Run with: node --test tests/rider-location-batch.test.js
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

// ---- Captured side effects ---------------------------------------------
const dbWrites = [];       // { lastLat, lastLng }
const redisWrites = [];    // JSON string written to RIDER_LOCATION
const poolCalls = [];      // { userId, lat, lng }

const prismaStub = {
  rider: {
    async findUnique() {
      return { id: 'rider-1', userId: 'user-rider-1', availability: 'ONLINE' };
    },
    async update({ data }) {
      dbWrites.push(data);
      return { id: 'rider-1', ...data };
    },
  },
};

// ---- Install stubs BEFORE requiring the service ------------------------
stubModule(p('../src/config/database.js'), { prisma: prismaStub });
stubModule(p('../src/config/redis.js'), {
  redis: { async set(_k, v) { redisWrites.push(v); }, async del() {}, async get() { return null; } },
});
stubModule(p('../src/utils/logger.js'), { logger: { info() {}, warn() {}, error() {}, debug() {} } });
stubModule(p('../src/sockets/index.js'), { getIO: () => ({ to: () => ({ emit() {} }) }) });
stubModule(p('../src/sockets/handlers/request.handler.js'), {
  emitRiderAssigned() {}, emitStatusChanged() {},
});
stubModule(p('../src/services/notify.service.js'), new Proxy({}, { get: () => async () => {} }));
stubModule(p('../src/services/rider-pool.service.js'), {
  async markRiderAvailable(userId, { lat, lng }) { poolCalls.push({ userId, lat, lng }); },
  async touchRiderHeartbeat() {},
  async removeRiderFromPool() {},
});

const riderService = require('../src/modules/rider/rider.service');

const reset = () => {
  dbWrites.length = 0;
  redisWrites.length = 0;
  poolCalls.length = 0;
};

test('updateLocation applies a single live fix and keeps the rider dispatchable', async () => {
  reset();
  const res = await riderService.updateLocation('user-rider-1', { lat: 13.0, lng: 7.6 });

  assert.equal(res.applied, 1);
  assert.deepEqual({ lat: res.lat, lng: res.lng }, { lat: 13.0, lng: 7.6 });
  assert.deepEqual(dbWrites[0].lastLat, 13.0);
  assert.deepEqual(dbWrites[0].lastLng, 7.6);
  assert.equal(poolCalls.length, 1, 'should re-add rider to the dispatch pool');
  assert.deepEqual(poolCalls[0], { userId: 'user-rider-1', lat: 13.0, lng: 7.6 });
});

test('updateLocation on a batch applies the MOST RECENT fix (by capturedAt), not array order', async () => {
  reset();
  // Deliberately out of chronological order: the newest fix is in the middle.
  const res = await riderService.updateLocation('user-rider-1', {
    updates: [
      { lat: 1, lng: 1, capturedAt: '2026-07-17T10:00:00Z' },
      { lat: 2, lng: 2, capturedAt: '2026-07-17T10:05:00Z' }, // newest
      { lat: 3, lng: 3, capturedAt: '2026-07-17T10:02:00Z' },
    ],
  });

  assert.equal(res.applied, 3);
  assert.deepEqual({ lat: res.lat, lng: res.lng }, { lat: 2, lng: 2 }, 'latest fix wins');
  assert.deepEqual(poolCalls[0], { userId: 'user-rider-1', lat: 2, lng: 2 });
});

test('updateLocation tolerates batch fixes without capturedAt', async () => {
  reset();
  const res = await riderService.updateLocation('user-rider-1', {
    updates: [
      { lat: 5, lng: 5 },
      { lat: 6, lng: 6, capturedAt: '2026-07-17T10:05:00Z' },
    ],
  });

  // The only timestamped fix is the most recent; the untimed one sorts oldest.
  assert.equal(res.applied, 2);
  assert.deepEqual({ lat: res.lat, lng: res.lng }, { lat: 6, lng: 6 });
});

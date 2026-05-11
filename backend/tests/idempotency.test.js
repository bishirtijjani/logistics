/**
 * Idempotency middleware tests.
 *
 * Verifies:
 *   - When no Idempotency-Key header is sent, the middleware is a no-op.
 *   - First request reserves the key and lets the handler run.
 *   - A duplicate request with the same key replays the cached response without
 *     invoking the handler again.
 *   - Expired keys are deleted and treated as new.
 *
 * Run with: node --test tests/idempotency.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { installStubs, makeRes } = require('./_test-helpers');

const { prisma } = installStubs();
const { idempotency } = require('../src/middlewares/idempotency.middleware');

// Resolves when the middleware either calls next() or writes a response.
const callMiddleware = (req, res) =>
  new Promise((resolve, reject) => {
    let settled = false;
    const settle = (val, err) => {
      if (settled) return;
      settled = true;
      err ? reject(err) : resolve(val);
    };

    const originalJson = res.json.bind(res);
    res.json = async (body) => {
      const out = await originalJson(body);
      settle({ replayed: true });
      return out;
    };

    Promise.resolve(idempotency(req, res, (err) => settle({ replayed: false }, err))).catch((err) =>
      settle(null, err),
    );
  });

test('idempotency: no header → passes through without touching the store', async () => {
  prisma.idempotencyKey._store.clear();
  const req = { headers: {}, method: 'POST', path: '/api/requests', body: {}, user: { id: 'u1' } };
  const res = makeRes();

  await callMiddleware(req, res);

  assert.equal(prisma.idempotencyKey._store.size, 0);
});

test('idempotency: first request reserves the key, handler runs, response is captured', async () => {
  prisma.idempotencyKey._store.clear();
  const key = 'k-first-' + Date.now();
  const req = {
    headers: { 'idempotency-key': key },
    method: 'POST',
    path: '/api/requests',
    body: { amount: 1000 },
    user: { id: 'u1' },
  };
  const res = makeRes();

  await callMiddleware(req, res);

  // Reservation row exists.
  const reserved = await prisma.idempotencyKey.findUnique({ where: { key } });
  assert.ok(reserved, 'reservation should exist');
  assert.equal(reserved.userId, 'u1');
  assert.equal(reserved.route, 'POST:/api/requests');
  assert.ok(reserved.requestHash);
  assert.equal(reserved.responseSnapshot, undefined);

  // Simulate the controller writing a response — capture should fire.
  await res.status(201).json({ ok: true, id: 'req_1' });

  const updated = await prisma.idempotencyKey.findUnique({ where: { key } });
  assert.ok(updated.responseSnapshot, 'snapshot should be persisted');
  assert.equal(updated.responseSnapshot.status, 201);
  assert.deepEqual(updated.responseSnapshot.body, { ok: true, id: 'req_1' });
});

test('idempotency: duplicate request replays cached response and skips handler', async () => {
  prisma.idempotencyKey._store.clear();
  const key = 'k-replay-' + Date.now();

  // Pre-seed a stored snapshot.
  await prisma.idempotencyKey.create({
    data: {
      key,
      userId: 'u1',
      route: 'POST:/api/requests',
      requestHash: 'abc',
      expiresAt: new Date(Date.now() + 60_000),
      responseSnapshot: { status: 201, body: { ok: true, id: 'req_99' } },
    },
  });

  const req = {
    headers: { 'idempotency-key': key },
    method: 'POST',
    path: '/api/requests',
    body: { amount: 1000 },
    user: { id: 'u1' },
  };
  const res = makeRes();

  const result = await callMiddleware(req, res);

  assert.equal(result.replayed, true, 'middleware must replay without calling next()');
  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body, { ok: true, id: 'req_99' });
  assert.equal(res.headers['idempotent-replayed'], 'true');
});

test('idempotency: expired keys are deleted and treated as new', async () => {
  prisma.idempotencyKey._store.clear();
  const key = 'k-expired-' + Date.now();

  await prisma.idempotencyKey.create({
    data: {
      key,
      userId: 'u1',
      route: 'POST:/api/requests',
      requestHash: 'abc',
      expiresAt: new Date(Date.now() - 1000),
      responseSnapshot: { status: 200, body: { stale: true } },
    },
  });

  const req = {
    headers: { 'idempotency-key': key },
    method: 'POST',
    path: '/api/requests',
    body: {},
    user: { id: 'u1' },
  };
  const res = makeRes();

  await callMiddleware(req, res);

  const after = await prisma.idempotencyKey.findUnique({ where: { key } });
  assert.ok(after, 'a fresh reservation should exist');
  assert.equal(after.responseSnapshot, undefined, 'fresh row has no snapshot yet');
  // statusCode untouched (handler hasn't replied yet)
  assert.equal(res.body, undefined);
});

test('idempotency: anonymous user (no req.user) still works', async () => {
  prisma.idempotencyKey._store.clear();
  const key = 'k-anon-' + Date.now();
  const req = {
    headers: { 'idempotency-key': key },
    method: 'POST',
    path: '/api/requests',
    body: {},
  };
  const res = makeRes();

  await callMiddleware(req, res);

  const stored = await prisma.idempotencyKey.findUnique({ where: { key } });
  assert.equal(stored.userId, 'anon');
});

// ── Fail-closed behavior ────────────────────────────────────────────────────

test('idempotency: returns 503 when the lookup throws', async () => {
  prisma.idempotencyKey._store.clear();
  const original = prisma.idempotencyKey.findUnique;
  prisma.idempotencyKey.findUnique = async () => {
    throw new Error('db down');
  };

  let nextCalled = false;
  const res = makeRes();
  await idempotency(
    {
      headers: { 'idempotency-key': 'k-503-lookup' },
      method: 'POST',
      path: '/api/requests',
      body: {},
      user: { id: 'u1' },
    },
    res,
    () => {
      nextCalled = true;
    },
  );

  prisma.idempotencyKey.findUnique = original;

  assert.equal(nextCalled, false, 'must NOT pass through on infra failure');
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.success, false);
});

test('idempotency: returns 503 when the reservation create throws non-P2002', async () => {
  prisma.idempotencyKey._store.clear();
  const original = prisma.idempotencyKey.create;
  prisma.idempotencyKey.create = async () => {
    throw new Error('connection reset');
  };

  let nextCalled = false;
  const res = makeRes();
  await idempotency(
    {
      headers: { 'idempotency-key': 'k-503-create' },
      method: 'POST',
      path: '/api/requests',
      body: {},
      user: { id: 'u1' },
    },
    res,
    () => {
      nextCalled = true;
    },
  );

  prisma.idempotencyKey.create = original;

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 503);
});

// ── Concurrent reservation race ─────────────────────────────────────────────

test('idempotency: two concurrent calls — only one passes through, the other replays', async () => {
  prisma.idempotencyKey._store.clear();
  const key = 'k-concurrent-' + Date.now();

  const reqA = {
    headers: { 'idempotency-key': key },
    method: 'POST',
    path: '/api/requests',
    body: { amount: 1000 },
    user: { id: 'u1' },
  };
  const reqB = { ...reqA, body: { amount: 1000 } };
  const resA = makeRes();
  const resB = makeRes();

  let aPassedThrough = false;
  let bPassedThrough = false;

  // Simulate a real controller — when next() fires, it writes the response,
  // which is what makes the loser's poll terminate successfully.
  const handlerFor = (res, flag) => async () => {
    flag.value = true;
    await res.status(201).json({ ok: true, id: 'req_winner' });
  };

  const aFlag = { value: false };
  const bFlag = { value: false };

  // Both calls fire simultaneously.
  await Promise.all([
    idempotency(reqA, resA, handlerFor(resA, aFlag)),
    idempotency(reqB, resB, handlerFor(resB, bFlag)),
  ]);

  aPassedThrough = aFlag.value;
  bPassedThrough = bFlag.value;

  assert.equal(aPassedThrough !== bPassedThrough, true, 'exactly one must pass through');

  const winnerRes = aPassedThrough ? resA : resB;
  const loserRes = aPassedThrough ? resB : resA;

  assert.equal(winnerRes.statusCode, 201);
  assert.equal(loserRes.statusCode, 201, 'loser should replay the same status');
  assert.equal(loserRes.headers['idempotent-replayed'], 'true');
  assert.deepEqual(loserRes.body, { ok: true, id: 'req_winner' });
});

test('idempotency: race loser returns 409 if winner never responds in time', async () => {
  prisma.idempotencyKey._store.clear();
  const key = 'k-409-' + Date.now();

  // Pre-create the reservation WITHOUT a snapshot — simulates the winner
  // having reserved but not yet returned.
  await prisma.idempotencyKey.create({
    data: {
      key,
      userId: 'u1',
      route: 'POST:/api/requests',
      requestHash: 'abc',
      expiresAt: new Date(Date.now() + 60_000),
    },
  });

  let nextCalled = false;
  const res = makeRes();
  await idempotency(
    {
      headers: { 'idempotency-key': key },
      method: 'POST',
      path: '/api/requests',
      body: {},
      user: { id: 'u1' },
    },
    res,
    () => {
      nextCalled = true;
    },
  );

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.success, false);
});

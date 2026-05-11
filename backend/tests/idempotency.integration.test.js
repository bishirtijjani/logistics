/**
 * Idempotency integration tests.
 *
 * Drives the real Express request pipeline (not the middleware in isolation)
 * via `app.handle(req, res)` so we exercise: header parsing → middleware
 * stack → controller invocation → response capture → replay path. Validates
 * the bug class that unit tests can't catch — that the middleware is
 * actually wired into the request route's stack and that two real HTTP-style
 * calls with the same Idempotency-Key trigger the controller exactly once.
 *
 * Uses the in-memory prisma stub from _test-helpers so this test does not
 * require a live Postgres.
 *
 * Run with: node --test tests/idempotency.integration.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const express = require('express');

const { installStubs } = require('./_test-helpers');

const stubs = installStubs();
const { idempotency } = require('../src/middlewares/idempotency.middleware');

// ── Drive Express without a network socket ──────────────────────────────────
// node:http's IncomingMessage/ServerResponse depend on a real socket, so we
// build the lightest possible req/res that Express needs.

const buildReq = ({ method, url, headers = {}, body }) => {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.originalUrl = url;
  req.headers = { 'content-type': 'application/json', ...headers };
  req.body = body;
  // Express checks these
  req.complete = true;
  req.connection = {};
  req.socket = {};
  req.httpVersion = '1.1';
  req.httpVersionMajor = 1;
  req.httpVersionMinor = 1;
  return req;
};

const buildRes = () => {
  const res = new EventEmitter();
  res.statusCode = 200;
  res.headers = {};
  res.body = undefined;
  res.headersSent = false;
  res.finished = false;
  res.locals = {};
  res.setHeader = function (k, v) { this.headers[k.toLowerCase()] = v; };
  res.getHeader = function (k) { return this.headers[k.toLowerCase()]; };
  res.removeHeader = function (k) { delete this.headers[k.toLowerCase()]; };
  res.status = function (code) { this.statusCode = code; return this; };
  res.json = async function (body) {
    this.body = body;
    this.headersSent = true;
    this.finished = true;
    this.emit('finish');
    return this;
  };
  res.send = res.json;
  res.end = function () { this.finished = true; this.emit('finish'); };
  res.on = EventEmitter.prototype.on.bind(res);
  return res;
};

const drive = (app, opts) =>
  new Promise((resolve, reject) => {
    const req = buildReq(opts);
    const res = buildRes();
    res.once('finish', () => resolve({ req, res }));
    try {
      app.handle(req, res, (err) => (err ? reject(err) : resolve({ req, res })));
    } catch (err) {
      reject(err);
    }
  });

// ── Build a minimal app that mirrors the real wiring ────────────────────────

const buildApp = (controllerSpy) => {
  const app = express();
  // Stub JSON parser — we'll set req.body manually since our fake req can't be
  // streamed, so just assign through a tiny middleware.
  app.use((req, _res, next) => next());
  app.post('/api/requests', idempotency, async (req, res) => {
    controllerSpy.calls += 1;
    controllerSpy.lastBody = req.body;
    res.status(201).json({ ok: true, id: `req_${controllerSpy.calls}`, echo: req.body });
  });
  return app;
};

// ── Tests ───────────────────────────────────────────────────────────────────

test('integration: same Idempotency-Key invokes the controller exactly once', async () => {
  stubs.prisma.idempotencyKey._store.clear();
  const spy = { calls: 0, lastBody: null };
  const app = buildApp(spy);
  const key = 'integ-once-' + Date.now();

  // First call — handler runs.
  const first = await drive(app, {
    method: 'POST',
    url: '/api/requests',
    headers: { 'idempotency-key': key },
    body: { amount: 1000 },
  });
  assert.equal(first.res.statusCode, 201);
  assert.equal(spy.calls, 1, 'controller must run exactly once on first call');
  assert.deepEqual(first.res.body, { ok: true, id: 'req_1', echo: { amount: 1000 } });

  // Second call with the same key — must replay, NOT re-invoke the handler.
  const second = await drive(app, {
    method: 'POST',
    url: '/api/requests',
    headers: { 'idempotency-key': key },
    body: { amount: 1000 },
  });
  assert.equal(second.res.statusCode, 201);
  assert.equal(spy.calls, 1, 'controller must NOT run again on duplicate');
  assert.deepEqual(second.res.body, { ok: true, id: 'req_1', echo: { amount: 1000 } });
  assert.equal(second.res.headers['idempotent-replayed'], 'true');
});

test('integration: different keys both invoke the controller', async () => {
  stubs.prisma.idempotencyKey._store.clear();
  const spy = { calls: 0, lastBody: null };
  const app = buildApp(spy);

  await drive(app, {
    method: 'POST',
    url: '/api/requests',
    headers: { 'idempotency-key': 'integ-a-' + Date.now() },
    body: { amount: 1000 },
  });
  await drive(app, {
    method: 'POST',
    url: '/api/requests',
    headers: { 'idempotency-key': 'integ-b-' + Date.now() },
    body: { amount: 2000 },
  });

  assert.equal(spy.calls, 2, 'distinct keys must each run the handler');
});

test('integration: no Idempotency-Key still works (legacy clients)', async () => {
  stubs.prisma.idempotencyKey._store.clear();
  const spy = { calls: 0, lastBody: null };
  const app = buildApp(spy);

  const first = await drive(app, {
    method: 'POST',
    url: '/api/requests',
    body: { amount: 1000 },
  });
  const second = await drive(app, {
    method: 'POST',
    url: '/api/requests',
    body: { amount: 1000 },
  });

  assert.equal(first.res.statusCode, 201);
  assert.equal(second.res.statusCode, 201);
  // Without a key, every call hits the handler — that's the legacy contract.
  assert.equal(spy.calls, 2);
  assert.equal(stubs.prisma.idempotencyKey._store.size, 0, 'no rows reserved without a key');
});

test('integration: middleware fails closed (503) when the dedup store throws', async () => {
  stubs.prisma.idempotencyKey._store.clear();
  const spy = { calls: 0, lastBody: null };
  const app = buildApp(spy);

  const original = stubs.prisma.idempotencyKey.findUnique;
  stubs.prisma.idempotencyKey.findUnique = async () => {
    throw new Error('db down');
  };

  const { res } = await drive(app, {
    method: 'POST',
    url: '/api/requests',
    headers: { 'idempotency-key': 'integ-503-' + Date.now() },
    body: { amount: 1000 },
  });

  stubs.prisma.idempotencyKey.findUnique = original;

  assert.equal(res.statusCode, 503, 'must fail closed, not pass through');
  assert.equal(spy.calls, 0, 'controller must NEVER run when dedup is down');
});

// ── Wiring assertion: confirm idempotency is on the real request route ──────

test('integration: real request.routes.js mounts idempotency on POST /', () => {
  // Re-require the actual production route module — installStubs already
  // shimmed prisma/redis/config so this loads cleanly.
  const router = require('../src/modules/request/request.routes');
  const layer = router.stack.find(
    (l) => l.route && l.route.path === '/' && l.route.methods.post,
  );
  assert.ok(layer, 'POST / route must exist on the request router');
  const handlers = layer.route.stack.map((s) => s.name || 'anonymous');
  assert.ok(
    handlers.includes('idempotency'),
    `expected idempotency middleware on POST /api/requests; got: ${handlers.join(', ')}`,
  );
});

test('integration: real utility.routes.js mounts idempotency on each utility purchase', () => {
  const router = require('../src/modules/utility/utility.routes');
  for (const path of ['/airtime', '/data', '/cable', '/electricity']) {
    const layer = router.stack.find(
      (l) => l.route && l.route.path === path && l.route.methods.post,
    );
    assert.ok(layer, `POST ${path} must exist`);
    const handlers = layer.route.stack.map((s) => s.name || 'anonymous');
    assert.ok(
      handlers.includes('idempotency'),
      `expected idempotency middleware on POST /utilities${path}; got: ${handlers.join(', ')}`,
    );
  }
});

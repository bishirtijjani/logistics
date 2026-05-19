/**
 * Request-ID middleware tests.
 *
 * Run with: node --test tests/request-id.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { requestId, newRequestId } = require('../src/middlewares/request-id.middleware');

const makeRes = () => {
  const headers = {};
  return {
    headers,
    setHeader(k, v) { headers[k] = v; },
  };
};

test('newRequestId: returns a 16-char hex string', () => {
  const id = newRequestId();
  assert.match(id, /^[0-9a-f]{16}$/);
});

test('newRequestId: returns different ids on each call', () => {
  const a = newRequestId();
  const b = newRequestId();
  assert.notEqual(a, b);
});

test('middleware: generates a fresh id when no inbound header', (t, done) => {
  const req = { headers: {} };
  const res = makeRes();
  requestId(req, res, () => {
    assert.match(req.requestId, /^[0-9a-f]{16}$/);
    assert.equal(res.headers['X-Request-Id'], req.requestId);
    done();
  });
});

test('middleware: honors a safe inbound X-Request-Id', (t, done) => {
  const req = { headers: { 'x-request-id': 'ulid-01H7QPF8XYZK3WJD2NEM4VC9G8' } };
  const res = makeRes();
  requestId(req, res, () => {
    assert.equal(req.requestId, 'ulid-01H7QPF8XYZK3WJD2NEM4VC9G8');
    assert.equal(res.headers['X-Request-Id'], 'ulid-01H7QPF8XYZK3WJD2NEM4VC9G8');
    done();
  });
});

test('middleware: rejects an inbound id with disallowed characters (log-injection guard)', (t, done) => {
  const req = { headers: { 'x-request-id': '\nFAKE-HEADER: evil' } };
  const res = makeRes();
  requestId(req, res, () => {
    assert.match(req.requestId, /^[0-9a-f]{16}$/, 'must replace unsafe inbound with fresh id');
    assert.notEqual(req.requestId, '\nFAKE-HEADER: evil');
    done();
  });
});

test('middleware: rejects an inbound id that is too short', (t, done) => {
  const req = { headers: { 'x-request-id': 'x' } };
  const res = makeRes();
  requestId(req, res, () => {
    assert.match(req.requestId, /^[0-9a-f]{16}$/);
    done();
  });
});

test('middleware: rejects an inbound id that is too long', (t, done) => {
  const req = { headers: { 'x-request-id': 'a'.repeat(200) } };
  const res = makeRes();
  requestId(req, res, () => {
    assert.notEqual(req.requestId, 'a'.repeat(200));
    assert.match(req.requestId, /^[0-9a-f]{16}$/);
    done();
  });
});

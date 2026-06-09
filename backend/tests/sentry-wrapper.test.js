/**
 * Sentry wrapper tests - confirms the no-DSN no-op contract:
 *   - initSentry() returns false when SENTRY_DSN is unset
 *   - captureError() with no SDK falls back to logger.error and does NOT throw
 *   - Express handlers degrade to pass-through middlewares
 *   - withScope still invokes the callback
 *
 * Real DSN behavior (event delivery, sampling, scope tagging) is not unit-
 * tested here - that's verified end-to-end against a Sentry test project.
 *
 * Run with: node --test tests/sentry-wrapper.test.js
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

// Stub config + logger BEFORE requiring the module under test.
stubModule(path.resolve(__dirname, '../src/config/index.js'), {
  config: {
    NODE_ENV: 'test',
    SENTRY_DSN: '',
    SENTRY_ENVIRONMENT: '',
    SENTRY_RELEASE: '',
    SENTRY_TRACES_SAMPLE_RATE: 0.1,
  },
});

// Capture log calls so we can assert the fallback path.
const captured = [];
stubModule(path.resolve(__dirname, '../src/utils/logger.js'), {
  logger: {
    info() {},
    warn() {},
    debug() {},
    error(message, meta) { captured.push({ message, meta }); },
  },
});

const sentry = require('../src/utils/sentry');

test('initSentry: returns false when SENTRY_DSN is empty (no-op mode)', () => {
  const result = sentry.initSentry();
  assert.equal(result, false);
  assert.equal(sentry.__isInitialized(), false);
});

test('captureError: routes to logger.error when Sentry is disabled', () => {
  captured.length = 0;
  const err = new Error('boom');
  err.code = 'BAD_REQUEST';
  sentry.captureError(err, { userId: 'u1', route: '/test' });
  assert.equal(captured.length, 1);
  assert.equal(captured[0].message, 'captured error (sentry disabled)');
  assert.equal(captured[0].meta.userId, 'u1');
  assert.equal(captured[0].meta.route, '/test');
  assert.match(captured[0].meta.stack || '', /Error: boom/);
});

test('captureError: accepts string errors without throwing', () => {
  captured.length = 0;
  sentry.captureError('something failed', { userId: 'u2' });
  assert.equal(captured.length, 1);
});

test('requestHandler: returns a pass-through middleware when disabled', (t, done) => {
  const mw = sentry.requestHandler();
  let nextCalled = false;
  mw({}, {}, () => { nextCalled = true; done(); });
  assert.equal(nextCalled, true);
});

test('tracingHandler: returns a pass-through middleware when disabled', (t, done) => {
  const mw = sentry.tracingHandler();
  let nextCalled = false;
  mw({}, {}, () => { nextCalled = true; done(); });
  assert.equal(nextCalled, true);
});

test('errorHandler: returns a pass-through middleware that forwards errors', (t, done) => {
  const mw = sentry.errorHandler();
  const boom = new Error('forwarded');
  mw(boom, {}, {}, (err) => {
    assert.equal(err, boom);
    done();
  });
});

test('withScope: still invokes the callback when Sentry is disabled', () => {
  let ran = false;
  const result = sentry.withScope({ requestId: 'r1' }, () => { ran = true; return 42; });
  assert.equal(ran, true);
  assert.equal(result, 42);
});

test('flush: resolves true when Sentry is disabled (nothing to flush)', async () => {
  const result = await sentry.flush(100);
  assert.equal(result, true);
});

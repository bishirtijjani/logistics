/**
 * Rate-limit middleware tests.
 *
 * Two contracts under test:
 *   1. Each limiter exposes the expected `windowMs` / `max` shape
 *   2. The high-traffic Phase 10 limiters key on `userId` (not `ip`) so
 *      mobile clients on shared NAT'd networks don't accidentally limit
 *      each other
 *
 * Run with: node --test tests/rate-limit.test.js
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

// express-rate-limit accepts `max`, `windowMs`, `keyGenerator` etc. on
// construction and returns a middleware. We don't exercise the limiter's
// actual sliding-window state here - that's library-tested. Instead we
// assert the configuration we hand it, which is what we want to keep stable.
//
// Replace `express-rate-limit` with a stub that records its constructor args
// onto the returned middleware so tests can inspect them.
stubModule(require.resolve('express-rate-limit'), function rateLimit(opts) {
  const mw = function (req, res, next) { next(); };
  mw._opts = opts;
  return mw;
});

const limiters = require('../src/middlewares/rate-limit.middleware');

// --- shape checks ---

test('authLimiter: 5 attempts per 2 minutes', () => {
  assert.equal(limiters.authLimiter._opts.max, 5);
  assert.equal(limiters.authLimiter._opts.windowMs, 2 * 60 * 1000);
});

test('otpLimiter: 3 per 2 minutes, keyed by phone with IP fallback', () => {
  assert.equal(limiters.otpLimiter._opts.max, 3);
  assert.equal(limiters.otpLimiter._opts.windowMs, 2 * 60 * 1000);
  const key = limiters.otpLimiter._opts.keyGenerator({ body: { phone: '08012345678' }, ip: '1.2.3.4' });
  assert.equal(key, '08012345678');
  const fallback = limiters.otpLimiter._opts.keyGenerator({ body: {}, ip: '1.2.3.4' });
  assert.equal(fallback, '1.2.3.4');
});

test('pinLimiter: 3 per 5 minutes, keyed by userId with IP fallback', () => {
  assert.equal(limiters.pinLimiter._opts.max, 3);
  assert.equal(limiters.pinLimiter._opts.windowMs, 5 * 60 * 1000);
  const key = limiters.pinLimiter._opts.keyGenerator({ user: { id: 'u1' }, ip: '1.2.3.4' });
  assert.equal(key, 'u1');
});

test('generalLimiter: 100 per 1 minute (per-IP default)', () => {
  assert.equal(limiters.generalLimiter._opts.max, 100);
  assert.equal(limiters.generalLimiter._opts.windowMs, 60 * 1000);
});

test('registrationLimiter: 3 per 1 hour', () => {
  assert.equal(limiters.registrationLimiter._opts.max, 3);
  assert.equal(limiters.registrationLimiter._opts.windowMs, 60 * 60 * 1000);
});

test('mapsLimiter: 60 per 1 minute, keyed by userId', () => {
  assert.equal(limiters.mapsLimiter._opts.max, 60);
  assert.equal(limiters.mapsLimiter._opts.windowMs, 60 * 1000);
  const key = limiters.mapsLimiter._opts.keyGenerator({ user: { id: 'u1' } });
  assert.equal(key, 'u1');
});

// --- Phase 10 additions ---

test('requestCreationLimiter: 30 per 1 hour, keyed by userId (NOT ip)', () => {
  const l = limiters.requestCreationLimiter;
  assert.equal(l._opts.max, 30);
  assert.equal(l._opts.windowMs, 60 * 60 * 1000);
  // Keying on userId matters: shared mobile NAT IPs would otherwise rate-limit
  // every Katsina user against each other.
  const key = l._opts.keyGenerator({ user: { id: 'cust-1' }, ip: '1.2.3.4' });
  assert.equal(key, 'cust-1');
});

test('requestCreationLimiter: falls back to IP when no req.user (defensive)', () => {
  const key = limiters.requestCreationLimiter._opts.keyGenerator({ ip: '5.6.7.8' });
  assert.equal(key, '5.6.7.8');
});

test('quoteLimiter: 120 per 1 hour, keyed by userId', () => {
  const l = limiters.quoteLimiter;
  assert.equal(l._opts.max, 120);
  assert.equal(l._opts.windowMs, 60 * 60 * 1000);
  const key = l._opts.keyGenerator({ user: { id: 'u-9' }, ip: '1.2.3.4' });
  assert.equal(key, 'u-9');
});

test('requestCreationLimiter is stricter than quoteLimiter (matches roadmap policy)', () => {
  assert.ok(
    limiters.requestCreationLimiter._opts.max < limiters.quoteLimiter._opts.max,
    'creation limit must be tighter than quoting - orders cost real money',
  );
});

test('all limiters emit RFC 6585-compatible Retry-After headers (standardHeaders=true)', () => {
  for (const name of Object.keys(limiters)) {
    assert.equal(limiters[name]._opts.standardHeaders, true, `${name} must set standardHeaders`);
    assert.equal(limiters[name]._opts.legacyHeaders, false, `${name} must disable legacyHeaders`);
  }
});

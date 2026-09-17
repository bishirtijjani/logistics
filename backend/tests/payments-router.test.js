/**
 * Payments router tests.
 *
 * Verifies the provider-mode invariants that keep the wallet safe during a
 * gateway switch:
 *   - an unset setting resolves to KATPAY (transparent pass-through) - the
 *     zero-behaviour-change guarantee;
 *   - an invalid persisted value falls back to KATPAY instead of stranding the
 *     platform;
 *   - PAYSTACK mode resolves the Paystack adapter exactly;
 *   - isActive only reflects the CURRENT mode (webhooks must not gate on it);
 *   - annotateError tags errors with provider provenance.
 *
 * Run with: node --test tests/payments-router.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { installStubs } = require('./_test-helpers');

const stubs = installStubs({ config: { NODE_ENV: 'test' } });

const paymentsRouter = require('../src/services/payments/router');
const settingsService = require('../src/services/settings.service');

test('exports the documented mode surface', () => {
  const keys = Object.keys(paymentsRouter.MODES).sort();
  assert.deepEqual(keys, ['KATPAY', 'PAYSTACK']);
  assert.deepEqual(paymentsRouter.VALID_MODES, ['KATPAY', 'PAYSTACK']);
  assert.equal(paymentsRouter.SETTING_KEY, 'payments.providerMode');
  assert.equal(paymentsRouter.DEFAULT_MODE, 'KATPAY');
});

test('default mode is KATPAY when the setting is unset', async () => {
  // Fresh store - no payments.providerMode seeded.
  assert.equal(await paymentsRouter.getMode(), 'KATPAY');
  assert.deepEqual(await paymentsRouter.resolveGateway(), {
    mode: 'KATPAY',
    provider: 'KATPAY',
  });
});

test('invalid persisted mode falls back to KATPAY', async () => {
  await settingsService.setSetting('payments.providerMode', 'BOTH', 'test');
  assert.equal(await paymentsRouter.getMode(), 'KATPAY');
});

test('PAYSTACK mode resolves the Paystack adapter; KATPAY the KatPay adapter', async () => {
  await settingsService.setSetting('payments.providerMode', 'PAYSTACK', 'test');

  assert.equal(await paymentsRouter.getMode(), 'PAYSTACK');
  assert.deepEqual(await paymentsRouter.resolveGateway(), {
    mode: 'PAYSTACK',
    provider: 'PAYSTACK',
  });

  const ps = await paymentsRouter.getActiveAdapter();
  assert.ok(ps.resolveAccountName, 'Paystack adapter exposes account resolution');

  assert.equal(await paymentsRouter.isActive('PAYSTACK'), true);
  assert.equal(await paymentsRouter.isActive('KATPAY'), false);

  const kat = paymentsRouter.getAdapter('KATPAY');
  assert.ok(kat.getBankList, 'KatPay adapter resolves by key');
});

test('unknown adapter key throws - callers never silently fall back', () => {
  assert.throws(() => paymentsRouter.getAdapter('BOGUS'), /Unknown payment provider/);
});

test('annotateError tags provider provenance once, without clobbering', () => {
  const err = new Error('boom');
  const tagged = paymentsRouter.annotateError(err, 'PAYSTACK');
  assert.equal(tagged, err);
  assert.equal(err.provider, 'PAYSTACK');
  // Re-tagging a different provider does NOT overwrite the recorded origin.
  paymentsRouter.annotateError(err, 'KATPAY');
  assert.equal(err.provider, 'PAYSTACK');
});
/**
 * Settings service tests.
 *
 * Verifies:
 *   - getSetting returns the stored value or default.
 *   - getSettings returns multiple keys (with null for missing).
 *   - setSetting persists, busts the cache, publishes an invalidation event.
 *   - getPublicSettings returns the documented public subset only.
 *
 * Run with: node --test tests/settings.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { installStubs } = require('./_test-helpers');

const stubs = installStubs();
stubs.prisma.platformSetting.seed({
  'platform.currency': 'NGN',
  'wallet.minWithdraw': 500,
  'wallet.withdrawalFee': 25,
  'delivery.baseFare': 200,
  'delivery.perKmRate': 100,
  'delivery.platformFeePercent': 10,
  'delivery.cancellationFee': 200,
  'merchant.platformFeePercent': 15,
  'auth.pinMaxAttempts': 5,
  'auth.pinLockoutMinutes': 30,
  // sensitive — must NOT appear in public payload
  'internal.providerApiKey': 'secret',
});

const settingsService = require('../src/services/settings.service');

const resetCaches = async () => {
  // setSetting invalidates the in-memory cache for us; ensure each test starts
  // fresh by toggling an unrelated key through setSetting.
  await settingsService.setSetting('__cache_bust__', Date.now(), 'test');
};

test('getSetting: returns stored value when key exists', async () => {
  await resetCaches();
  const v = await settingsService.getSetting('wallet.minWithdraw');
  assert.equal(v, 500);
});

test('getSetting: returns default when key is missing', async () => {
  await resetCaches();
  const v = await settingsService.getSetting('does.not.exist', 'fallback');
  assert.equal(v, 'fallback');
});

test('getSettings: returns multiple keys, null for missing', async () => {
  await resetCaches();
  const out = await settingsService.getSettings([
    'wallet.minWithdraw',
    'wallet.withdrawalFee',
    'does.not.exist',
  ]);
  assert.equal(out['wallet.minWithdraw'], 500);
  assert.equal(out['wallet.withdrawalFee'], 25);
  assert.equal(out['does.not.exist'], null);
});

test('setSetting: persists, busts cache, publishes invalidation', async () => {
  await resetCaches();

  let publishedChannel = null;
  let publishedKey = null;
  stubs.redis.publish = async (channel, key) => {
    publishedChannel = channel;
    publishedKey = key;
    return 1;
  };

  await settingsService.setSetting('wallet.minWithdraw', 1000, 'admin-test');

  const refreshed = await settingsService.getSetting('wallet.minWithdraw');
  assert.equal(refreshed, 1000);
  assert.equal(publishedChannel, 'settings:invalidated');
  assert.equal(publishedKey, 'wallet.minWithdraw');
});

test('getPublicSettings: returns only the whitelisted public keys', async () => {
  await resetCaches();
  const pub = await settingsService.getPublicSettings();

  // Public keys present (set or null is fine; sensitive must be absent).
  assert.ok('platform.currency' in pub);
  assert.ok('wallet.minWithdraw' in pub);
  assert.ok('wallet.withdrawalFee' in pub);
  assert.ok('delivery.baseFare' in pub);
  assert.ok('delivery.platformFeePercent' in pub);
  assert.ok('merchant.platformFeePercent' in pub);
  assert.ok('auth.pinMaxAttempts' in pub);

  assert.ok(!('internal.providerApiKey' in pub), 'must not leak sensitive keys');
});

test('getPublicSettings: values reflect current store', async () => {
  await resetCaches();
  await settingsService.setSetting('platform.currency', 'NGN', 'test');
  await settingsService.setSetting('merchant.platformFeePercent', 12, 'test');

  const pub = await settingsService.getPublicSettings();
  assert.equal(pub['platform.currency'], 'NGN');
  assert.equal(pub['merchant.platformFeePercent'], 12);
});

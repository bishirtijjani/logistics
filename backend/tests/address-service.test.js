/**
 * SavedAddress service tests — list / create / update / setDefault / remove.
 * Focus on the isDefault invariant (at most one default per user) and the
 * orphan-default promotion when the default address gets deleted.
 *
 * Run with: node --test tests/address-service.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

const { makeAuthPrismaStub, makeRedisStub } = require('./_test-helpers');

const stubModule = (filename, exports) => {
  const mod = new Module(filename);
  mod.filename = filename;
  mod.loaded = true;
  mod.exports = exports;
  require.cache[filename] = mod;
};

const prismaStub = makeAuthPrismaStub();

stubModule(path.resolve(__dirname, '../src/config/database.js'), { prisma: prismaStub });
stubModule(path.resolve(__dirname, '../src/config/redis.js'), { redis: makeRedisStub() });
stubModule(path.resolve(__dirname, '../src/utils/logger.js'), {
  logger: { info() {}, warn() {}, error() {}, debug() {} },
});

const addressService = require('../src/modules/address/address.service');

const USER_A = '00000000-0000-4000-a000-000000000a01';
const USER_B = '00000000-0000-4000-a000-000000000a02';

const resetState = () => {
  prismaStub.savedAddress._rows.clear();
};

const seedAddress = async (overrides = {}) =>
  prismaStub.savedAddress.create({
    data: {
      userId: USER_A,
      label: 'Home',
      address: '123 Main St',
      lat: 13.0,
      lng: 7.6,
      isDefault: false,
      ...overrides,
    },
  });

// --- list ---

test('list: returns only the caller user\'s addresses', async () => {
  resetState();
  await seedAddress({ userId: USER_A, label: 'A1' });
  await seedAddress({ userId: USER_B, label: 'B1' });
  const rows = await addressService.list(USER_A);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].label, 'A1');
});

test('list: default first, then newest by updatedAt', async () => {
  resetState();
  await seedAddress({ label: 'Old', isDefault: false, updatedAt: new Date('2026-05-10') });
  await seedAddress({ label: 'Newer', isDefault: false, updatedAt: new Date('2026-05-17') });
  await seedAddress({ label: 'TheDefault', isDefault: true, updatedAt: new Date('2026-05-15') });
  const rows = await addressService.list(USER_A);
  assert.equal(rows[0].label, 'TheDefault');
  assert.equal(rows[1].label, 'Newer');
  assert.equal(rows[2].label, 'Old');
});

// --- create ---

test('create: first address auto-becomes the default', async () => {
  resetState();
  const created = await addressService.create(USER_A, {
    label: 'Home', address: 'Street', lat: 13.0, lng: 7.6,
  });
  assert.equal(created.isDefault, true);
});

test('create: subsequent non-default address stays non-default', async () => {
  resetState();
  await seedAddress({ isDefault: true });
  const created = await addressService.create(USER_A, {
    label: 'Work', address: 'Office', lat: 13.0, lng: 7.6,
  });
  assert.equal(created.isDefault, false);
});

test('create: when claiming default, the previous default is demoted', async () => {
  resetState();
  const prev = await seedAddress({ label: 'OldDefault', isDefault: true });
  const created = await addressService.create(USER_A, {
    label: 'NewDefault', address: '', lat: 13.0, lng: 7.6, isDefault: true,
  });
  assert.equal(created.isDefault, true);
  const previousNow = prismaStub.savedAddress._rows.get(prev.id);
  assert.equal(previousNow.isDefault, false);
});

// --- update ---

test('update: 404 when address belongs to another user', async () => {
  resetState();
  const other = await seedAddress({ userId: USER_B });
  await assert.rejects(
    () => addressService.update(USER_A, other.id, { label: 'Hacked' }),
    (err) => err.statusCode === 404,
  );
});

test('update: setting isDefault=true demotes the previous default', async () => {
  resetState();
  const prev = await seedAddress({ label: 'Old', isDefault: true });
  const target = await seedAddress({ label: 'New', isDefault: false });
  await addressService.update(USER_A, target.id, { isDefault: true });
  assert.equal(prismaStub.savedAddress._rows.get(prev.id).isDefault, false);
  assert.equal(prismaStub.savedAddress._rows.get(target.id).isDefault, true);
});

test('update: ignores fields not provided in input', async () => {
  resetState();
  const row = await seedAddress({ label: 'Home', address: 'A', isDefault: true });
  await addressService.update(USER_A, row.id, { label: 'House' });
  const fresh = prismaStub.savedAddress._rows.get(row.id);
  assert.equal(fresh.label, 'House');
  assert.equal(fresh.address, 'A');
  assert.equal(fresh.isDefault, true);
});

// --- setDefault ---

test('setDefault: 404 when address belongs to another user', async () => {
  resetState();
  const other = await seedAddress({ userId: USER_B });
  await assert.rejects(
    () => addressService.setDefault(USER_A, other.id),
    (err) => err.statusCode === 404,
  );
});

test('setDefault: flips target to default, demotes any previous default', async () => {
  resetState();
  const old = await seedAddress({ label: 'Old', isDefault: true });
  const target = await seedAddress({ label: 'Target', isDefault: false });
  const out = await addressService.setDefault(USER_A, target.id);
  assert.equal(out.isDefault, true);
  assert.equal(prismaStub.savedAddress._rows.get(old.id).isDefault, false);
});

// --- remove ---

test('remove: 404 when address belongs to another user', async () => {
  resetState();
  const other = await seedAddress({ userId: USER_B });
  await assert.rejects(
    () => addressService.remove(USER_A, other.id),
    (err) => err.statusCode === 404,
  );
});

test('remove: deletes the row', async () => {
  resetState();
  const row = await seedAddress();
  await addressService.remove(USER_A, row.id);
  assert.equal(prismaStub.savedAddress._rows.has(row.id), false);
});

test('remove: deleting the default promotes the next-newest address to default', async () => {
  resetState();
  const def = await seedAddress({ label: 'TheDefault', isDefault: true, updatedAt: new Date('2026-05-10') });
  const next = await seedAddress({ label: 'NextInLine', isDefault: false, updatedAt: new Date('2026-05-17') });
  const older = await seedAddress({ label: 'Older', isDefault: false, updatedAt: new Date('2026-05-12') });

  await addressService.remove(USER_A, def.id);

  assert.equal(prismaStub.savedAddress._rows.get(next.id).isDefault, true);
  assert.equal(prismaStub.savedAddress._rows.get(older.id).isDefault, false);
});

test('remove: deleting a non-default leaves the existing default in place', async () => {
  resetState();
  const def = await seedAddress({ label: 'Default', isDefault: true });
  const other = await seedAddress({ label: 'Other', isDefault: false });
  await addressService.remove(USER_A, other.id);
  assert.equal(prismaStub.savedAddress._rows.get(def.id).isDefault, true);
});

test('remove: deleting the only (default) address leaves zero addresses', async () => {
  resetState();
  const only = await seedAddress({ isDefault: true });
  await addressService.remove(USER_A, only.id);
  const all = await addressService.list(USER_A);
  assert.equal(all.length, 0);
});

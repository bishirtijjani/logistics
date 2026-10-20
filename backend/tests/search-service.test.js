/**
 * Search & discovery service tests - covers the query-less path (uses Prisma
 * `findMany` + bbox), the query path (uses pg_trgm via `$queryRaw` then
 * hydrates via Prisma), and `nearby` Haversine sort. Raw SQL is mocked at the
 * `$queryRaw` boundary; the trgm logic itself lives in the DB.
 *
 * Run with: node --test tests/search-service.test.js
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
// @prisma/client only needed for the `Prisma.sql` / `Prisma.empty` raw-SQL
// fragments used inside the service. Tagged-template behavior is fine when
// $queryRaw is stubbed.
stubModule(require.resolve('@prisma/client'), {
  Prisma: {
    sql: (...args) => ({ _kind: 'sql', args }),
    empty: { _kind: 'empty' },
  },
});

const searchService = require('../src/modules/search/search.service');

const seedKatsinaMerchants = () => {
  prismaStub.merchant._rows.clear();
  prismaStub.merchant.seed([
    { id: 'm1', name: 'Mama K Kitchen', lat: 13.0059, lng: 7.6019, isActive: true, adminActiveOverride: true, status: 'APPROVED', averageRating: 4.8, totalOrders: 200, category: { id: 'c1', name: 'Food', slug: 'food', color: '', icon: '', attributeSchema: {} }, products: [{ isAvailable: true }] },
    { id: 'm2', name: 'Sani Pharmacy', lat: 13.0100, lng: 7.6050, isActive: true, adminActiveOverride: true, status: 'APPROVED', averageRating: 4.5, totalOrders: 90, category: { id: 'c2', name: 'Pharmacy', slug: 'pharmacy', color: '', icon: '', attributeSchema: {} }, products: [{ isAvailable: true }] },
    { id: 'm3', name: 'Far Away Shop', lat: 14.0, lng: 8.5, isActive: true, adminActiveOverride: true, status: 'APPROVED', averageRating: 3.0, totalOrders: 1, category: { id: 'c1', name: 'Food', slug: 'food', color: '', icon: '', attributeSchema: {} }, products: [{ isAvailable: true }] },
    { id: 'm4', name: 'Inactive Shop', lat: 13.0, lng: 7.6, isActive: false, adminActiveOverride: true, status: 'APPROVED', averageRating: 4.5, totalOrders: 50, category: { id: 'c1', name: 'Food', slug: 'food', color: '', icon: '', attributeSchema: {} }, products: [{ isAvailable: true }] },
    { id: 'm5', name: 'Override Off', lat: 13.0, lng: 7.6, isActive: true, adminActiveOverride: false, status: 'APPROVED', averageRating: 4.0, totalOrders: 30, category: { id: 'c1', name: 'Food', slug: 'food', color: '', icon: '', attributeSchema: {} }, products: [{ isAvailable: true }] },
    // Approved + active + override-on, but every product is hidden → empty menu.
    { id: 'm6', name: 'Empty Menu Cafe', lat: 13.0, lng: 7.6, isActive: true, adminActiveOverride: true, status: 'APPROVED', averageRating: 5.0, totalOrders: 0, category: { id: 'c1', name: 'Food', slug: 'food', color: '', icon: '', attributeSchema: {} }, products: [{ isAvailable: false }] },
  ]);
};

const seedProducts = () => {
  prismaStub.product._rows.clear();
  prismaStub.product.seed([
    {
      id: 'p1', name: 'Jollof Rice', isAvailable: true, price: 1500,
      merchant: { id: 'm1', name: 'Mama K Kitchen', isActive: true, adminActiveOverride: true, category: { id: 'c1', name: 'Food', slug: 'food' } },
      variants: [],
    },
    {
      id: 'p2', name: 'Paracetamol', isAvailable: true, price: 200,
      merchant: { id: 'm2', name: 'Sani Pharmacy', isActive: true, adminActiveOverride: true, category: { id: 'c2', name: 'Pharmacy', slug: 'pharmacy' } },
      variants: [],
    },
  ]);
};

// --- search (no query) ---

test('search: no query → returns visible merchants ordered by rating then orders', async () => {
  seedKatsinaMerchants();
  prismaStub.$queryRaw = async () => [];
  const out = await searchService.search({ q: '', type: 'merchant' });
  // Should exclude inactive (m4) and override-off (m5) merchants
  const ids = out.results.map((r) => r.id);
  assert.ok(!ids.includes('m4'), 'inactive merchants must not appear');
  assert.ok(!ids.includes('m5'), 'adminActiveOverride=false merchants must not appear');
  // Rating-desc ordering: m1 (4.8) before m2 (4.5) before m3 (3.0)
  assert.equal(out.results[0].id, 'm1');
});

test('search: no query + category=food → filters to food slug', async () => {
  seedKatsinaMerchants();
  prismaStub.$queryRaw = async () => [];
  const out = await searchService.search({ q: '', category: 'food' });
  const ids = out.results.map((r) => r.id);
  assert.deepEqual(ids.sort(), ['m1', 'm3']);
});

test('search: no query + lat/lng → bounding-box excludes far-away merchants', async () => {
  seedKatsinaMerchants();
  prismaStub.$queryRaw = async () => [];
  const out = await searchService.search({ q: '', lat: 13.0, lng: 7.6, radius: 10 });
  const ids = out.results.map((r) => r.id);
  // m3 is at 14.0/8.5 - ~150km away, must be filtered out
  assert.ok(!ids.includes('m3'));
  assert.ok(ids.includes('m1'));
  assert.ok(ids.includes('m2'));
});

// --- empty menus ---

test('search: merchants with no available products are excluded', async () => {
  seedKatsinaMerchants();
  prismaStub.$queryRaw = async () => [];
  const out = await searchService.search({ q: '', type: 'merchant' });
  const ids = out.results.map((r) => r.id);
  assert.ok(!ids.includes('m6'), 'merchant with no available products must not appear');
  assert.ok(ids.includes('m1'), 'merchant with an available product still appears');
});

test('search: a merchant reappears once a product is made available', async () => {
  seedKatsinaMerchants();
  // Flip m6's only product to available → it should now survive the filter.
  prismaStub.merchant._rows.get('m6').products = [{ isAvailable: true }];
  prismaStub.$queryRaw = async () => [];
  const out = await searchService.search({ q: '', type: 'merchant' });
  assert.ok(out.results.map((r) => r.id).includes('m6'));
});

test('nearby: merchants with no available products are excluded', async () => {
  seedKatsinaMerchants();
  const out = await searchService.nearby({ lat: 13.0, lng: 7.6, radius: 50 });
  const ids = out.merchants.map((m) => m.id);
  assert.ok(!ids.includes('m6'));
  assert.ok(ids.includes('m1'));
});

// --- search (with query, $queryRaw mocked) ---

test('search: with query → hydrates and sorts by similarity score', async () => {
  seedKatsinaMerchants();
  // Mock pg_trgm: pretend "Mama" matches m1 (0.7) and m2 weakly (0.2)
  prismaStub.$queryRaw = async () => [
    { id: 'm1', score: 0.7 },
    { id: 'm2', score: 0.2 },
  ];
  const out = await searchService.search({ q: 'Mama', type: 'merchant' });
  const merchantHits = out.results.filter((r) => r.kind === 'merchant');
  assert.equal(merchantHits.length, 2);
  assert.equal(merchantHits[0].id, 'm1', 'highest score must come first');
  assert.equal(merchantHits[0]._score, 0.7);
  assert.equal(merchantHits[1].id, 'm2');
});

test('search: with query → empty trgm hit returns empty list (no DB hydration)', async () => {
  seedKatsinaMerchants();
  prismaStub.$queryRaw = async () => [];
  const out = await searchService.search({ q: 'xyzzy', type: 'merchant' });
  assert.equal(out.results.length, 0);
});

test('search: type=product → only products surface', async () => {
  seedKatsinaMerchants();
  seedProducts();
  // First call is product trgm; merchant path is skipped because type !== 'merchant'
  prismaStub.$queryRaw = async () => [{ id: 'p1', score: 0.9 }];
  const out = await searchService.search({ q: 'jollof', type: 'product' });
  assert.equal(out.results.length, 1);
  assert.equal(out.results[0].kind, 'product');
  assert.equal(out.results[0].id, 'p1');
});

test('search: no type → both merchants and products returned together', async () => {
  seedKatsinaMerchants();
  seedProducts();
  let call = 0;
  // First $queryRaw call is the merchant trgm; second is the product trgm.
  prismaStub.$queryRaw = async () => {
    call++;
    if (call === 1) return [{ id: 'm1', score: 0.6 }];
    return [{ id: 'p1', score: 0.8 }];
  };
  const out = await searchService.search({ q: 'mama' });
  const kinds = out.results.map((r) => r.kind);
  assert.ok(kinds.includes('merchant'));
  assert.ok(kinds.includes('product'));
});

// --- nearby ---

test('nearby: returns empty + note when lat/lng missing', async () => {
  seedKatsinaMerchants();
  const out = await searchService.nearby({});
  assert.deepEqual(out.merchants, []);
  assert.match(out.note, /lat and lng/);
});

test('nearby: filters by bbox, sorts by Haversine distance', async () => {
  seedKatsinaMerchants();
  const out = await searchService.nearby({ lat: 13.0059, lng: 7.6019, radius: 5 });
  // m1 is right on the query point (~0km); m2 is slightly further (~0.5km)
  assert.equal(out.merchants[0].id, 'm1');
  assert.ok(out.merchants[0]._distanceKm < 0.1);
  assert.equal(out.merchants[1].id, 'm2');
  assert.ok(out.merchants[1]._distanceKm > 0);
  // m3 must be excluded (~150km away, outside 5km radius)
  assert.ok(!out.merchants.some((m) => m.id === 'm3'));
});

test('nearby: excludes inactive and adminActiveOverride=false merchants', async () => {
  seedKatsinaMerchants();
  const out = await searchService.nearby({ lat: 13.0059, lng: 7.6019, radius: 50 });
  const ids = out.merchants.map((m) => m.id);
  assert.ok(!ids.includes('m4'));
  assert.ok(!ids.includes('m5'));
});

test('nearby: category filter applies', async () => {
  seedKatsinaMerchants();
  const out = await searchService.nearby({ lat: 13.0059, lng: 7.6019, radius: 50, category: 'pharmacy' });
  assert.equal(out.merchants.length, 1);
  assert.equal(out.merchants[0].id, 'm2');
});

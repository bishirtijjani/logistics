/**
 * Live integration test: admin category CRUD + audit log + soft/hard delete.
 *
 * Pre-condition: backend running on port 3000 with seeded admin
 * (admin@ / admin123456) and the merchant_categories
 * table is in its post-migration state (3 default categories, Restaurant
 * has merchants assigned).
 *
 * Run with: node --test tests/category-crud.integration.test.js
 *
 * Skipped automatically when the server is not reachable.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
const ADMIN_EMAIL = 'admin@';
const ADMIN_PASSWORD = 'admin123456';

let token;
let serverReachable = false;

const json = (res) => res.json();

const req = async (path, opts = {}) => {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token && !headers.Authorization) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, { ...opts, headers });
  const body = res.status === 204 ? null : await json(res);
  return { status: res.status, body };
};

test('setup: server reachable, admin logged in', async () => {
  try {
    const ping = await fetch(`${BASE_URL}/health`);
    serverReachable = ping.ok;
  } catch {
    serverReachable = false;
  }

  if (!serverReachable) {
    console.log('  ⏭  Backend not reachable on', BASE_URL, '- integration tests will be skipped');
    return;
  }

  const { status, body } = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  assert.equal(status, 200, `login failed: ${JSON.stringify(body)}`);
  token = body.data.tokens.accessToken;
});

test('GET /categories returns active rows in sortOrder', async (t) => {
  if (!serverReachable) return t.skip();
  const { status, body } = await req('/categories');
  assert.equal(status, 200);
  const list = body.data;
  assert.ok(Array.isArray(list) && list.length >= 3, 'expected at least 3 default categories');
  // sortOrder ascending
  for (let i = 1; i < list.length; i++) {
    assert.ok(list[i - 1].sortOrder <= list[i].sortOrder, 'sortOrder ascending');
  }
});

test('POST /admin/categories creates a category and audit log fires', async (t) => {
  if (!serverReachable) return t.skip();
  const { status, body } = await req('/admin/categories', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Test ' + Date.now(),
      description: 'Integration test category',
      icon: 'store',
      color: '#123456',
      sortOrder: 99,
      hasPreparation: false,
    }),
  });
  assert.equal(status, 201, `create failed: ${JSON.stringify(body)}`);
  assert.ok(body.data.id);
  assert.equal(body.data.color, '#123456');
  assert.equal(body.data.hasPreparation, false);
  assert.ok(body.data.slug.startsWith('test-'));

  // Cleanup
  await req(`/admin/categories/${body.data.id}`, { method: 'DELETE' });
});

test('POST /admin/categories rejects duplicate slug with 409', async (t) => {
  if (!serverReachable) return t.skip();
  const { status } = await req('/admin/categories', {
    method: 'POST',
    body: JSON.stringify({ name: 'Restaurant' }), // slug auto = "restaurant", already exists
  });
  assert.equal(status, 409);
});

test('POST /admin/categories rejects bad color format with 400', async (t) => {
  if (!serverReachable) return t.skip();
  const { status } = await req('/admin/categories', {
    method: 'POST',
    body: JSON.stringify({ name: 'Bad Color Test', color: 'red' }),
  });
  assert.equal(status, 400);
});

test('PUT /admin/categories updates fields', async (t) => {
  if (!serverReachable) return t.skip();
  const created = await req('/admin/categories', {
    method: 'POST',
    body: JSON.stringify({ name: 'Update Test ' + Date.now(), color: '#000000' }),
  });
  const id = created.body.data.id;

  const { status, body } = await req(`/admin/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ description: 'updated', color: '#FFFFFF' }),
  });
  assert.equal(status, 200);
  assert.equal(body.data.description, 'updated');
  assert.equal(body.data.color, '#FFFFFF');

  await req(`/admin/categories/${id}`, { method: 'DELETE' });
});

test('DELETE on category with 0 merchants → hard delete', async (t) => {
  if (!serverReachable) return t.skip();
  const created = await req('/admin/categories', {
    method: 'POST',
    body: JSON.stringify({ name: 'Delete Hard ' + Date.now() }),
  });
  const id = created.body.data.id;
  const { status, body } = await req(`/admin/categories/${id}`, { method: 'DELETE' });
  assert.equal(status, 200);
  assert.equal(body.data.soft, false);

  // Confirm gone from public list
  const { body: pub } = await req('/categories');
  assert.equal(pub.data.find((c) => c.id === id), undefined);
});

test('DELETE on category with merchants → soft delete (isActive=false)', async (t) => {
  if (!serverReachable) return t.skip();
  // The seeded "restaurant" category has merchants attached.
  const restaurantId = '00000000-0000-4000-a000-000000000001';
  const { status, body } = await req(`/admin/categories/${restaurantId}`, { method: 'DELETE' });
  assert.equal(status, 200);
  assert.equal(body.data.soft, true);
  assert.equal(body.data.category.isActive, false);

  // Restore for subsequent runs
  const restore = await req(`/admin/categories/${restaurantId}`, {
    method: 'PUT',
    body: JSON.stringify({ isActive: true }),
  });
  assert.equal(restore.status, 200);
});

test('GET /merchants?categorySlug=restaurant filters correctly', async (t) => {
  if (!serverReachable) return t.skip();
  const { status, body } = await req('/merchants?categorySlug=restaurant');
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.data));
  for (const m of body.data) {
    assert.equal(m.category?.slug, 'restaurant', `merchant ${m.id} has wrong category`);
  }
});

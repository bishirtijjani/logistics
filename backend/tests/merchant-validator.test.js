/**
 * Merchant validator tests — confirms the type→categoryId migration.
 * Run with: node --test tests/merchant-validator.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createMerchantSchema,
  listMerchantsSchema,
} = require('../src/modules/merchant/merchant.validator');

const validBase = {
  name: 'Test Restaurant',
  phone: '08012345678',
  address: '123 Test Street, Katsina',
  lat: 13.0059,
  lng: 7.6017,
};

test('createMerchantSchema: requires categoryId', () => {
  const r = createMerchantSchema.safeParse({ ...validBase });
  assert.equal(r.success, false);
});

test('createMerchantSchema: rejects old `type` field (legacy enum is gone)', () => {
  const r = createMerchantSchema.safeParse({ ...validBase, type: 'RESTAURANT' });
  assert.equal(r.success, false);
});

test('createMerchantSchema: accepts a valid categoryId UUID', () => {
  const r = createMerchantSchema.safeParse({
    ...validBase,
    categoryId: '00000000-0000-4000-a000-000000000001',
  });
  assert.equal(r.success, true);
});

test('createMerchantSchema: rejects non-UUID categoryId', () => {
  const r = createMerchantSchema.safeParse({
    ...validBase,
    categoryId: 'restaurant',
  });
  assert.equal(r.success, false);
});

test('listMerchantsSchema: accepts categoryId filter', () => {
  const r = listMerchantsSchema.safeParse({
    categoryId: '00000000-0000-4000-a000-000000000001',
  });
  assert.equal(r.success, true);
});

test('listMerchantsSchema: accepts categorySlug filter', () => {
  const r = listMerchantsSchema.safeParse({ categorySlug: 'restaurant' });
  assert.equal(r.success, true);
});

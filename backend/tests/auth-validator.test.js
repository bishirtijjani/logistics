/**
 * Auth validator tests - confirms the RETAIL_STORE bug fix.
 * Run with: node --test tests/auth-validator.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { merchantRegisterSchema } = require('../src/modules/auth/auth.validator');

const validBase = {
  email: 'newmerchant@example.com',
  phone: '08012345679',
  firstName: 'Bishir',
  lastName: 'Tijjani',
  password: 'securepass123',
  businessName: 'Test Shop',
  businessPhone: '08055556666',
  businessEmail: 'business@example.com',
  businessAddress: '123 Test Street, Katsina',
  lat: 13.0059,
  lng: 7.6017,
};

test('merchantRegisterSchema: requires categoryId (not businessType)', () => {
  const r = merchantRegisterSchema.safeParse({ ...validBase });
  assert.equal(r.success, false);
});

test('merchantRegisterSchema: legacy `businessType: RETAIL_STORE` is rejected (bug fixed)', () => {
  const r = merchantRegisterSchema.safeParse({
    ...validBase,
    businessType: 'RETAIL_STORE',
  });
  assert.equal(r.success, false);
});

test('merchantRegisterSchema: legacy `businessType: RESTAURANT` is rejected', () => {
  const r = merchantRegisterSchema.safeParse({
    ...validBase,
    businessType: 'RESTAURANT',
  });
  assert.equal(r.success, false);
});

test('merchantRegisterSchema: valid with categoryId UUID', () => {
  const r = merchantRegisterSchema.safeParse({
    ...validBase,
    categoryId: '00000000-0000-4000-a000-000000000001',
  });
  assert.equal(r.success, true);
});

test('merchantRegisterSchema: rejects non-UUID categoryId', () => {
  const r = merchantRegisterSchema.safeParse({
    ...validBase,
    categoryId: 'restaurant',
  });
  assert.equal(r.success, false);
});

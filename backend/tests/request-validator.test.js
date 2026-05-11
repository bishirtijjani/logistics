/**
 * Validator tests for the unified request schema.
 * Run with: node --test tests/request-validator.test.js
 *
 * Covers the type-inference rules introduced by the data-driven categories work:
 *   - merchantId + items  → valid MERCHANT_ORDER (type can be inferred or omitted)
 *   - package payload     → valid PACKAGE (no merchantId, no items)
 *   - mixed/missing       → rejected
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { createRequestSchema, REQUEST_TYPES } = require('../src/modules/request/request.validator');

const baseLocations = {
  pickupAddress: 'No. 5 Kofar Marusa, Katsina',
  pickupLat: 13.0059,
  pickupLng: 7.6017,
  dropoffAddress: 'GRA, Katsina',
  dropoffLat: 13.0123,
  dropoffLng: 7.6089,
};

const validItems = [
  { name: 'Jollof Rice', unitPrice: 1500, quantity: 2 },
];

const validPackage = {
  description: 'Documents envelope',
  size: 'SMALL',
  recipientName: 'Amina Musa',
  recipientPhone: '08023456789',
};

test('REQUEST_TYPES enum is collapsed to MERCHANT_ORDER and PACKAGE', () => {
  assert.deepEqual(REQUEST_TYPES.sort(), ['MERCHANT_ORDER', 'PACKAGE']);
});

test('MERCHANT_ORDER: merchantId + items + explicit type → valid', () => {
  const r = createRequestSchema.safeParse({
    type: 'MERCHANT_ORDER',
    merchantId: '00000000-0000-4000-8000-000000000001',
    items: validItems,
    ...baseLocations,
  });
  assert.equal(r.success, true);
});

test('MERCHANT_ORDER: merchantId + items, type omitted → valid (server infers)', () => {
  const r = createRequestSchema.safeParse({
    merchantId: '00000000-0000-4000-8000-000000000001',
    items: validItems,
    ...baseLocations,
  });
  assert.equal(r.success, true);
});

test('PACKAGE: package payload only, type omitted → valid (server infers)', () => {
  const r = createRequestSchema.safeParse({
    package: validPackage,
    ...baseLocations,
  });
  assert.equal(r.success, true);
});

test('PACKAGE: package payload with explicit type=PACKAGE → valid', () => {
  const r = createRequestSchema.safeParse({
    type: 'PACKAGE',
    package: validPackage,
    ...baseLocations,
  });
  assert.equal(r.success, true);
});

test('PACKAGE rejected when merchantId is also present', () => {
  const r = createRequestSchema.safeParse({
    type: 'PACKAGE',
    merchantId: '00000000-0000-4000-8000-000000000001',
    package: validPackage,
    ...baseLocations,
  });
  assert.equal(r.success, false);
});

test('PACKAGE rejected when items are also present', () => {
  const r = createRequestSchema.safeParse({
    type: 'PACKAGE',
    items: validItems,
    package: validPackage,
    ...baseLocations,
  });
  assert.equal(r.success, false);
});

test('MERCHANT_ORDER rejected when items array is empty', () => {
  const r = createRequestSchema.safeParse({
    type: 'MERCHANT_ORDER',
    merchantId: '00000000-0000-4000-8000-000000000001',
    items: [],
    ...baseLocations,
  });
  assert.equal(r.success, false);
});

test('MERCHANT_ORDER rejected when merchantId is missing', () => {
  const r = createRequestSchema.safeParse({
    type: 'MERCHANT_ORDER',
    items: validItems,
    ...baseLocations,
  });
  assert.equal(r.success, false);
});

test('PACKAGE rejected when package details are missing', () => {
  const r = createRequestSchema.safeParse({
    type: 'PACKAGE',
    ...baseLocations,
  });
  assert.equal(r.success, false);
});

test('Old enum values (FOOD/GROCERY/PHARMACY) are rejected', () => {
  for (const oldType of ['FOOD', 'GROCERY', 'PHARMACY']) {
    const r = createRequestSchema.safeParse({
      type: oldType,
      merchantId: '00000000-0000-4000-8000-000000000001',
      items: validItems,
      ...baseLocations,
    });
    assert.equal(r.success, false, `expected ${oldType} to be rejected`);
  }
});

test('merchantId must be a UUID', () => {
  const r = createRequestSchema.safeParse({
    merchantId: 'not-a-uuid',
    items: validItems,
    ...baseLocations,
  });
  assert.equal(r.success, false);
});

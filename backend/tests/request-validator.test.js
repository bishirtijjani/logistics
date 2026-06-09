/**
 * Validator tests for the unified request schema.
 * Run with: node --test tests/request-validator.test.js
 *
 * Covers:
 *   - merchantId + items (with productId) + quoteToken → valid MERCHANT_ORDER
 *     (type can be inferred or omitted)
 *   - package payload + quoteToken → valid PACKAGE (no merchantId, no items)
 *   - mixed / missing required fields → rejected
 *   - schema additions made post-Phase-2 (productId on items) and
 *     post-Phase-4 (mandatory signed quoteToken)
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

// Phase 4 - quote token is required on every create. The token's signature /
// expiry / locked-numbers checks happen in the service; the validator only
// asserts presence + non-trivial length.
const QUOTE_TOKEN = 'eyJ2IjoxLCJleHAiOjk5OTk5OTk5OTk5OTl9.fake-signature-long-enough-for-validator';

// Phase 2 - items now reference a product by UUID; unit pricing is server-truth.
const validItems = [
  { productId: '00000000-0000-4000-8000-000000000aaa', quantity: 2 },
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
    quoteToken: QUOTE_TOKEN,
    ...baseLocations,
  });
  assert.equal(r.success, true);
});

test('MERCHANT_ORDER: merchantId + items, type omitted → valid (server infers)', () => {
  const r = createRequestSchema.safeParse({
    merchantId: '00000000-0000-4000-8000-000000000001',
    items: validItems,
    quoteToken: QUOTE_TOKEN,
    ...baseLocations,
  });
  assert.equal(r.success, true);
});

test('PACKAGE: package payload only, type omitted → valid (server infers)', () => {
  const r = createRequestSchema.safeParse({
    package: validPackage,
    quoteToken: QUOTE_TOKEN,
    ...baseLocations,
  });
  assert.equal(r.success, true);
});

test('PACKAGE: package payload with explicit type=PACKAGE → valid', () => {
  const r = createRequestSchema.safeParse({
    type: 'PACKAGE',
    package: validPackage,
    quoteToken: QUOTE_TOKEN,
    ...baseLocations,
  });
  assert.equal(r.success, true);
});

test('PACKAGE rejected when merchantId is also present', () => {
  const r = createRequestSchema.safeParse({
    type: 'PACKAGE',
    merchantId: '00000000-0000-4000-8000-000000000001',
    package: validPackage,
    quoteToken: QUOTE_TOKEN,
    ...baseLocations,
  });
  assert.equal(r.success, false);
});

test('PACKAGE rejected when items are also present', () => {
  const r = createRequestSchema.safeParse({
    type: 'PACKAGE',
    items: validItems,
    package: validPackage,
    quoteToken: QUOTE_TOKEN,
    ...baseLocations,
  });
  assert.equal(r.success, false);
});

test('MERCHANT_ORDER rejected when items array is empty', () => {
  const r = createRequestSchema.safeParse({
    type: 'MERCHANT_ORDER',
    merchantId: '00000000-0000-4000-8000-000000000001',
    items: [],
    quoteToken: QUOTE_TOKEN,
    ...baseLocations,
  });
  assert.equal(r.success, false);
});

test('MERCHANT_ORDER rejected when merchantId is missing', () => {
  const r = createRequestSchema.safeParse({
    type: 'MERCHANT_ORDER',
    items: validItems,
    quoteToken: QUOTE_TOKEN,
    ...baseLocations,
  });
  assert.equal(r.success, false);
});

test('PACKAGE rejected when package details are missing', () => {
  const r = createRequestSchema.safeParse({
    type: 'PACKAGE',
    quoteToken: QUOTE_TOKEN,
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
      quoteToken: QUOTE_TOKEN,
      ...baseLocations,
    });
    assert.equal(r.success, false, `expected ${oldType} to be rejected`);
  }
});

test('merchantId must be a UUID', () => {
  const r = createRequestSchema.safeParse({
    merchantId: 'not-a-uuid',
    items: validItems,
    quoteToken: QUOTE_TOKEN,
    ...baseLocations,
  });
  assert.equal(r.success, false);
});

// --- Phase 2 / Phase 4 contract additions ---

test('items[].productId is required (Phase 2 schema)', () => {
  const r = createRequestSchema.safeParse({
    merchantId: '00000000-0000-4000-8000-000000000001',
    items: [{ quantity: 1 }], // missing productId
    quoteToken: QUOTE_TOKEN,
    ...baseLocations,
  });
  assert.equal(r.success, false);
});

test('items[].productId must be a UUID', () => {
  const r = createRequestSchema.safeParse({
    merchantId: '00000000-0000-4000-8000-000000000001',
    items: [{ productId: 'not-a-uuid', quantity: 1 }],
    quoteToken: QUOTE_TOKEN,
    ...baseLocations,
  });
  assert.equal(r.success, false);
});

test('quoteToken is required on every create (Phase 4 anti-tampering)', () => {
  const r = createRequestSchema.safeParse({
    merchantId: '00000000-0000-4000-8000-000000000001',
    items: validItems,
    ...baseLocations,
    // quoteToken intentionally omitted
  });
  assert.equal(r.success, false);
});

test('quoteToken must meet minimum length (≥20)', () => {
  const r = createRequestSchema.safeParse({
    merchantId: '00000000-0000-4000-8000-000000000001',
    items: validItems,
    quoteToken: 'short',
    ...baseLocations,
  });
  assert.equal(r.success, false);
});

test('items[].variantId, when present, must be a UUID', () => {
  const r = createRequestSchema.safeParse({
    merchantId: '00000000-0000-4000-8000-000000000001',
    items: [{ productId: '00000000-0000-4000-8000-000000000aaa', variantId: 'not-a-uuid', quantity: 1 }],
    quoteToken: QUOTE_TOKEN,
    ...baseLocations,
  });
  assert.equal(r.success, false);
});

test('items[].substitution accepts MERCHANT_PICK / CONTACT_ME / NONE (Phase 8 grocery)', () => {
  for (const pref of ['NONE', 'MERCHANT_PICK', 'CONTACT_ME']) {
    const r = createRequestSchema.safeParse({
      merchantId: '00000000-0000-4000-8000-000000000001',
      items: [{ productId: '00000000-0000-4000-8000-000000000aaa', quantity: 1, substitution: pref }],
      quoteToken: QUOTE_TOKEN,
      ...baseLocations,
    });
    assert.equal(r.success, true, `expected substitution=${pref} to be accepted`);
  }
});

test('items[].substitution rejects unknown enum values', () => {
  const r = createRequestSchema.safeParse({
    merchantId: '00000000-0000-4000-8000-000000000001',
    items: [{ productId: '00000000-0000-4000-8000-000000000aaa', quantity: 1, substitution: 'REFUND_ME' }],
    quoteToken: QUOTE_TOKEN,
    ...baseLocations,
  });
  assert.equal(r.success, false);
});

test('prescriptionUrl, when present, must be a valid URL (Phase 8 pharmacy)', () => {
  const r = createRequestSchema.safeParse({
    merchantId: '00000000-0000-4000-8000-000000000001',
    items: validItems,
    quoteToken: QUOTE_TOKEN,
    prescriptionUrl: 'not-a-url',
    ...baseLocations,
  });
  assert.equal(r.success, false);
});

test('prescriptionUrl accepts a valid Cloudinary URL', () => {
  const r = createRequestSchema.safeParse({
    merchantId: '00000000-0000-4000-8000-000000000001',
    items: validItems,
    quoteToken: QUOTE_TOKEN,
    prescriptionUrl: 'https://res.cloudinary.com/test/image/upload/v1/prescriptions/u/rx.jpg',
    ...baseLocations,
  });
  assert.equal(r.success, true);
});

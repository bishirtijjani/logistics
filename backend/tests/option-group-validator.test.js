/**
 * Validator tests for option-group selection-rule / min-max coupling.
 * Run with: node --test tests/option-group-validator.test.js
 *
 * Covers the guard added so a contradictory group (e.g. "pick exactly one"
 * with a max of 5) or an unsatisfiable one (asks for more picks than it has
 * items) can never be persisted:
 *   - optionGroupRuleError() rule ↔ min/max consistency for all four rules
 *   - optionGroupInputSchema coupling enforcement + canonical min/max fill-in
 *   - populated-group satisfiability (minSelect ≤ item count), empty allowed
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  optionGroupInputSchema,
  optionGroupRuleError,
} = require('../src/modules/merchant/merchant.validator');

const item = (name) => ({ name });

// ---------------------------------------------------------------------------
// optionGroupRuleError — the shared (rule, min, max) consistency check
// ---------------------------------------------------------------------------

test('REQUIRED_ONE is consistent only at min 1 / max 1', () => {
  assert.equal(optionGroupRuleError({ selectionRule: 'REQUIRED_ONE', minSelect: 1, maxSelect: 1 }), null);
  assert.ok(optionGroupRuleError({ selectionRule: 'REQUIRED_ONE', minSelect: 1, maxSelect: 5 }));
  assert.ok(optionGroupRuleError({ selectionRule: 'REQUIRED_ONE', minSelect: 0, maxSelect: 1 }));
});

test('OPTIONAL_ONE is consistent only at min 0 / max 1', () => {
  assert.equal(optionGroupRuleError({ selectionRule: 'OPTIONAL_ONE', minSelect: 0, maxSelect: 1 }), null);
  assert.ok(optionGroupRuleError({ selectionRule: 'OPTIONAL_ONE', minSelect: 1, maxSelect: 1 }));
  assert.ok(optionGroupRuleError({ selectionRule: 'OPTIONAL_ONE', minSelect: 0, maxSelect: 3 }));
});

test('REQUIRED_MULTIPLE needs min ≥ 1 and max ≥ min', () => {
  assert.equal(optionGroupRuleError({ selectionRule: 'REQUIRED_MULTIPLE', minSelect: 1, maxSelect: 3 }), null);
  assert.equal(optionGroupRuleError({ selectionRule: 'REQUIRED_MULTIPLE', minSelect: 2, maxSelect: 2 }), null);
  assert.ok(optionGroupRuleError({ selectionRule: 'REQUIRED_MULTIPLE', minSelect: 0, maxSelect: 3 }));
  assert.ok(optionGroupRuleError({ selectionRule: 'REQUIRED_MULTIPLE', minSelect: 3, maxSelect: 2 }));
});

test('OPTIONAL_MULTIPLE needs min 0 and max ≥ 1', () => {
  assert.equal(optionGroupRuleError({ selectionRule: 'OPTIONAL_MULTIPLE', minSelect: 0, maxSelect: 3 }), null);
  assert.ok(optionGroupRuleError({ selectionRule: 'OPTIONAL_MULTIPLE', minSelect: 1, maxSelect: 3 }));
  assert.ok(optionGroupRuleError({ selectionRule: 'OPTIONAL_MULTIPLE', minSelect: 0, maxSelect: 0 }));
});

test('an unknown rule is reported as an error', () => {
  assert.ok(optionGroupRuleError({ selectionRule: 'NONSENSE', minSelect: 0, maxSelect: 1 }));
});

// ---------------------------------------------------------------------------
// optionGroupInputSchema — coupling + satisfiability + canonical fill-in
// ---------------------------------------------------------------------------

test('a clean REQUIRED_ONE group with one item parses', () => {
  const r = optionGroupInputSchema.safeParse({
    name: 'Spice level', selectionRule: 'REQUIRED_ONE', minSelect: 1, maxSelect: 1,
    items: [item('Mild')],
  });
  assert.equal(r.success, true);
});

test('REQUIRED_ONE with max 5 is rejected (rule ↔ max contradiction)', () => {
  const r = optionGroupInputSchema.safeParse({
    name: 'Spice level', selectionRule: 'REQUIRED_ONE', minSelect: 1, maxSelect: 5,
    items: [item('Mild'), item('Hot')],
  });
  assert.equal(r.success, false);
});

test('OPTIONAL_MULTIPLE with min 1 is rejected (optional must allow zero)', () => {
  const r = optionGroupInputSchema.safeParse({
    name: 'Toppings', selectionRule: 'OPTIONAL_MULTIPLE', minSelect: 1, maxSelect: 3,
    items: [item('Cheese'), item('Pepperoni')],
  });
  assert.equal(r.success, false);
});

test('a populated group asking for more picks than it has items is rejected', () => {
  const r = optionGroupInputSchema.safeParse({
    name: 'Pick three', selectionRule: 'REQUIRED_MULTIPLE', minSelect: 3, maxSelect: 3,
    items: [item('A'), item('B')],
  });
  assert.equal(r.success, false);
});

test('min equal to item count is allowed', () => {
  const r = optionGroupInputSchema.safeParse({
    name: 'Pick two', selectionRule: 'REQUIRED_MULTIPLE', minSelect: 2, maxSelect: 2,
    items: [item('A'), item('B')],
  });
  assert.equal(r.success, true);
});

test('an empty group is allowed (built incrementally; items added later)', () => {
  const r = optionGroupInputSchema.safeParse({
    name: 'Sides', selectionRule: 'REQUIRED_MULTIPLE', minSelect: 2, maxSelect: 4,
    items: [],
  });
  assert.equal(r.success, true);
});

test('omitting min/max fills canonical bounds from the rule', () => {
  const r = optionGroupInputSchema.safeParse({
    name: 'Spice level', selectionRule: 'REQUIRED_ONE', items: [item('Mild')],
  });
  assert.equal(r.success, true);
  assert.equal(r.data.minSelect, 1);
  assert.equal(r.data.maxSelect, 1);
});

test('omitting min/max for OPTIONAL_MULTIPLE yields min 0', () => {
  const r = optionGroupInputSchema.safeParse({
    name: 'Toppings', selectionRule: 'OPTIONAL_MULTIPLE', items: [item('Cheese')],
  });
  assert.equal(r.success, true);
  assert.equal(r.data.minSelect, 0);
  assert.ok(r.data.maxSelect >= 1);
});

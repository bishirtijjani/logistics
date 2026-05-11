/**
 * Unified status taxonomy tests.
 *
 * Verifies the FSM helpers in utils/status.js so consumers of the status map
 * can rely on a single source of truth for transitions.
 *
 * Run with: node --test tests/status.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const status = require('../src/utils/status');

test('STATUS enum contains the full unified taxonomy', () => {
  for (const s of [
    'REQUESTED', 'ACCEPTED', 'PROCESSING', 'READY_FOR_PICKUP',
    'RIDER_ASSIGNED', 'RIDER_EN_ROUTE', 'PICKED_UP', 'IN_TRANSIT',
    'DELIVERED', 'SETTLED', 'CANCELLED',
  ]) {
    assert.equal(status.STATUS[s], s);
  }
});

test('isActive / isTerminal / isCompleted classify correctly', () => {
  assert.equal(status.isActive('REQUESTED'), true);
  assert.equal(status.isActive('IN_TRANSIT'), true);
  assert.equal(status.isActive('SETTLED'), false);
  assert.equal(status.isActive('CANCELLED'), false);

  assert.equal(status.isTerminal('SETTLED'), true);
  assert.equal(status.isTerminal('CANCELLED'), true);
  assert.equal(status.isTerminal('DELIVERED'), false);

  assert.equal(status.isCompleted('DELIVERED'), true);
  assert.equal(status.isCompleted('SETTLED'), true);
  assert.equal(status.isCompleted('CANCELLED'), false);
});

test('canTransition: happy path lifecycle is allowed end to end', () => {
  const lifecycle = [
    ['REQUESTED', 'ACCEPTED'],
    ['ACCEPTED', 'PROCESSING'],
    ['PROCESSING', 'READY_FOR_PICKUP'],
    ['READY_FOR_PICKUP', 'RIDER_ASSIGNED'],
    ['RIDER_ASSIGNED', 'RIDER_EN_ROUTE'],
    ['RIDER_EN_ROUTE', 'PICKED_UP'],
    ['PICKED_UP', 'IN_TRANSIT'],
    ['IN_TRANSIT', 'DELIVERED'],
    ['DELIVERED', 'SETTLED'],
  ];
  for (const [from, to] of lifecycle) {
    assert.equal(status.canTransition(from, to), true, `${from} → ${to}`);
  }
});

test('canTransition: cannot cancel after pickup', () => {
  assert.equal(status.canTransition('PICKED_UP', 'CANCELLED'), false);
  assert.equal(status.canTransition('IN_TRANSIT', 'CANCELLED'), false);
  assert.equal(status.canTransition('DELIVERED', 'CANCELLED'), false);
});

test('canTransition: terminal states have no outgoing edges', () => {
  assert.equal(status.canTransition('SETTLED', 'DELIVERED'), false);
  assert.equal(status.canTransition('CANCELLED', 'REQUESTED'), false);
});

test('assertTransition throws with code on invalid transition', () => {
  assert.throws(() => status.assertTransition('PICKED_UP', 'CANCELLED'), (err) => {
    assert.equal(err.code, 'INVALID_STATUS_TRANSITION');
    return true;
  });
});

test('toUnified maps legacy MATCHED to RIDER_ASSIGNED', () => {
  assert.equal(status.toUnified('MATCHED'), 'RIDER_ASSIGNED');
  assert.equal(status.toUnified('PICKED_UP'), 'PICKED_UP');
  assert.equal(status.toUnified('UNKNOWN_THING'), 'UNKNOWN_THING');
});

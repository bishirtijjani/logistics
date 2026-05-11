/**
 * Unified request status taxonomy and FSM helpers.
 *
 * Single source of truth for request lifecycle states across the platform.
 * Both the unified `Request` model and the legacy `DeliveryOrder` model are
 * mapped here so consumers can reason about a single set of states. Phase 2
 * removes the legacy table; until then `LEGACY_TO_UNIFIED` is consulted when
 * surfacing legacy rows through unified APIs.
 */

const STATUS = Object.freeze({
  REQUESTED: 'REQUESTED',
  ACCEPTED: 'ACCEPTED',
  PROCESSING: 'PROCESSING',
  READY_FOR_PICKUP: 'READY_FOR_PICKUP',
  RIDER_ASSIGNED: 'RIDER_ASSIGNED',
  RIDER_EN_ROUTE: 'RIDER_EN_ROUTE',
  PICKED_UP: 'PICKED_UP',
  IN_TRANSIT: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED',
  SETTLED: 'SETTLED',
  CANCELLED: 'CANCELLED',
});

const ALL_STATUSES = Object.values(STATUS);

/** States in which a request is still being worked on. */
const ACTIVE_STATUSES = Object.freeze([
  STATUS.REQUESTED,
  STATUS.ACCEPTED,
  STATUS.PROCESSING,
  STATUS.READY_FOR_PICKUP,
  STATUS.RIDER_ASSIGNED,
  STATUS.RIDER_EN_ROUTE,
  STATUS.PICKED_UP,
  STATUS.IN_TRANSIT,
]);

const TERMINAL_STATUSES = Object.freeze([STATUS.SETTLED, STATUS.CANCELLED]);

const COMPLETED_STATUSES = Object.freeze([STATUS.DELIVERED, STATUS.SETTLED]);

/** Allowed transitions for a unified Request. */
const TRANSITIONS = Object.freeze({
  [STATUS.REQUESTED]: [STATUS.ACCEPTED, STATUS.CANCELLED],
  [STATUS.ACCEPTED]: [STATUS.PROCESSING, STATUS.CANCELLED],
  [STATUS.PROCESSING]: [STATUS.READY_FOR_PICKUP, STATUS.CANCELLED],
  [STATUS.READY_FOR_PICKUP]: [STATUS.RIDER_ASSIGNED, STATUS.CANCELLED],
  [STATUS.RIDER_ASSIGNED]: [STATUS.RIDER_EN_ROUTE, STATUS.CANCELLED],
  [STATUS.RIDER_EN_ROUTE]: [STATUS.PICKED_UP, STATUS.CANCELLED],
  [STATUS.PICKED_UP]: [STATUS.IN_TRANSIT],
  [STATUS.IN_TRANSIT]: [STATUS.DELIVERED],
  [STATUS.DELIVERED]: [STATUS.SETTLED],
  [STATUS.SETTLED]: [],
  [STATUS.CANCELLED]: [],
});

/**
 * Map legacy `DeliveryOrder` statuses (which include `MATCHED`) onto the
 * unified taxonomy used by the customer app.
 */
const LEGACY_TO_UNIFIED = Object.freeze({
  REQUESTED: STATUS.REQUESTED,
  MATCHED: STATUS.RIDER_ASSIGNED,
  RIDER_EN_ROUTE: STATUS.RIDER_EN_ROUTE,
  PICKED_UP: STATUS.PICKED_UP,
  IN_TRANSIT: STATUS.IN_TRANSIT,
  DELIVERED: STATUS.DELIVERED,
  SETTLED: STATUS.SETTLED,
  CANCELLED: STATUS.CANCELLED,
});

const isValidStatus = (status) => ALL_STATUSES.includes(status);

const isActive = (status) => ACTIVE_STATUSES.includes(status);

const isTerminal = (status) => TERMINAL_STATUSES.includes(status);

const isCompleted = (status) => COMPLETED_STATUSES.includes(status);

const canTransition = (from, to) => {
  const allowed = TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
};

const assertTransition = (from, to) => {
  if (!canTransition(from, to)) {
    const err = new Error(`Invalid status transition: ${from} → ${to}`);
    err.code = 'INVALID_STATUS_TRANSITION';
    throw err;
  }
};

const toUnified = (legacyStatus) => LEGACY_TO_UNIFIED[legacyStatus] || legacyStatus;

module.exports = {
  STATUS,
  ALL_STATUSES,
  ACTIVE_STATUSES,
  TERMINAL_STATUSES,
  COMPLETED_STATUSES,
  TRANSITIONS,
  LEGACY_TO_UNIFIED,
  isValidStatus,
  isActive,
  isTerminal,
  isCompleted,
  canTransition,
  assertTransition,
  toUnified,
};

/**
 * Cross-app constants used by rider features.
 * The STATUS enum + transitions mirror backend `src/utils/status.js`.
 */

export const STATUS = Object.freeze({
  REQUESTED:        'REQUESTED',
  ACCEPTED:         'ACCEPTED',
  PROCESSING:       'PROCESSING',
  READY_FOR_PICKUP: 'READY_FOR_PICKUP',
  RIDER_ASSIGNED:   'RIDER_ASSIGNED',
  RIDER_EN_ROUTE:   'RIDER_EN_ROUTE',
  PICKED_UP:        'PICKED_UP',
  IN_TRANSIT:       'IN_TRANSIT',
  DELIVERED:        'DELIVERED',
  SETTLED:          'SETTLED',
  CANCELLED:        'CANCELLED',
});

/**
 * Status transitions the rider client drives via PATCH /requests/:id/status.
 * Used by `StatusActionButton` to decide which button label + next status to fire.
 */
export const RIDER_NEXT_ACTION = Object.freeze({
  [STATUS.RIDER_ASSIGNED]: { label: 'I’m on my way to pickup', next: STATUS.RIDER_EN_ROUTE },
  [STATUS.RIDER_EN_ROUTE]: { label: 'Confirm pickup',           next: STATUS.PICKED_UP },
  [STATUS.PICKED_UP]:      { label: 'I’m on my way to dropoff', next: STATUS.IN_TRANSIT },
  [STATUS.IN_TRANSIT]:     { label: 'Complete delivery',        next: STATUS.DELIVERED },
});

export const AVAILABILITY = Object.freeze({
  ONLINE:       'ONLINE',
  OFFLINE:      'OFFLINE',
  ON_DELIVERY:  'ON_DELIVERY',
});

export const VEHICLE_TYPES = Object.freeze({
  MOTORCYCLE: 'MOTORCYCLE',
  BICYCLE:    'BICYCLE',
  CAR:        'CAR',
  VAN:        'VAN',
});

export const RIDER_STATUS = Object.freeze({
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED:         'APPROVED',
  REJECTED:         'REJECTED',
  SUSPENDED:        'SUSPENDED',
});

// Foreground GPS cadence presets (ms). The rider keeps the app open during
// shifts; there is no background tracking in v1.
export const LOCATION_CADENCE = Object.freeze({
  IDLE_MS:        15_000,
  ON_DELIVERY_MS:  3_000,
  LOW_BATTERY_MS: 30_000,
});

export const OFFER_TTL_SECONDS = 60;
export const GEOFENCE_RADIUS_M = 75;
export const GEOFENCE_FALLBACK_RADIUS_M = 150;
export const GEOFENCE_FALLBACK_AFTER_MS = 5 * 60 * 1000;

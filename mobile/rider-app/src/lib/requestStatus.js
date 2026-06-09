/**
 * Unified request status taxonomy - mirror of backend/src/utils/status.js.
 * Used by tracking, orders, and history screens to render consistent pills + copy.
 */

export const STATUS = Object.freeze({
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

export const ALL_STATUSES = Object.values(STATUS);

export const ACTIVE_STATUSES = [
  STATUS.REQUESTED,
  STATUS.ACCEPTED,
  STATUS.PROCESSING,
  STATUS.READY_FOR_PICKUP,
  STATUS.RIDER_ASSIGNED,
  STATUS.RIDER_EN_ROUTE,
  STATUS.PICKED_UP,
  STATUS.IN_TRANSIT,
];

export const COMPLETED_STATUSES = [STATUS.DELIVERED, STATUS.SETTLED];
export const TERMINAL_STATUSES = [STATUS.SETTLED, STATUS.CANCELLED];

export const isActive = (s) => ACTIVE_STATUSES.includes(s);
export const isCompleted = (s) => COMPLETED_STATUSES.includes(s);
export const isTerminal = (s) => TERMINAL_STATUSES.includes(s);

/**
 * Maps a status `tone` to a reactive pill `{ color, bg }` pair from the active
 * theme tokens, so status chips re-tone in dark mode. Pass `tokens` from
 * `useTheme()`. `color` is the accent (text/icon), `bg` is the soft tint behind it.
 */
export function statusToneColors(tone, tokens) {
  switch (tone) {
    case 'info':
      return { color: tokens.status.info, bg: tokens.status.infoSoft };
    case 'progress':
      // Violet "preparing" states - reuse the groceries category accent, the
      // only purple in the palette, which re-tones correctly in dark mode.
      return { color: tokens.category.groceries.icon, bg: tokens.category.groceries.bg };
    case 'brand':
      return { color: tokens.brand.default, bg: tokens.brand.soft };
    case 'success':
      return { color: tokens.status.successStrong, bg: tokens.status.successSoft };
    case 'danger':
      return { color: tokens.status.errorStrong, bg: tokens.status.errorSoft };
    case 'neutral':
    default:
      return { color: tokens.text.muted, bg: tokens.bg.surfaceMuted };
  }
}

/**
 * Display copy + pill `tone`. Adapts to:
 *   - `type`           - 'MERCHANT_ORDER' vs 'PACKAGE'
 *   - `categorySlug`   - type-specific copy for pharmacy/grocery
 *
 * `categorySlug` is optional; older callers without it fall back to the
 * generic merchant-order copy. Resolve `tone` to themed colors at the call site
 * via `statusToneColors(tone, tokens)` so chips react to light/dark mode.
 */
export function statusDisplay(status, type, categorySlug) {
  const isPkg = type === 'PACKAGE';
  const slug = typeof categorySlug === 'string' ? categorySlug : '';
  const isPharmacy = slug === 'pharmacy';
  const isGrocery = slug.startsWith('grocery');

  switch (status) {
    case STATUS.REQUESTED:
      return {
        label: isPkg
          ? 'Searching for rider'
          : isPharmacy
            ? 'Awaiting pharmacy'
            : isGrocery
              ? 'Awaiting store'
              : 'Awaiting merchant',
        tone: 'info',
      };
    case STATUS.ACCEPTED:
      return {
        label: isPharmacy
          ? 'Pharmacy accepted'
          : isGrocery
            ? 'Store accepted'
            : 'Merchant accepted',
        tone: 'progress',
      };
    case STATUS.PROCESSING:
      return {
        label: isPharmacy
          ? 'Pharmacist preparing your order'
          : isGrocery
            ? 'Picking your groceries'
            : 'Preparing your order',
        tone: 'progress',
      };
    case STATUS.READY_FOR_PICKUP:
      return { label: 'Ready · finding rider', tone: 'info' };
    case STATUS.RIDER_ASSIGNED:
      return { label: 'Rider assigned', tone: 'brand' };
    case STATUS.RIDER_EN_ROUTE:
      return { label: 'Rider en route', tone: 'brand' };
    case STATUS.PICKED_UP:
      return { label: 'Picked up', tone: 'brand' };
    case STATUS.IN_TRANSIT:
      return { label: 'On the way', tone: 'brand' };
    case STATUS.DELIVERED:
      return { label: 'Delivered', tone: 'success' };
    case STATUS.SETTLED:
      return { label: 'Completed', tone: 'success' };
    case STATUS.CANCELLED:
      return { label: 'Cancelled', tone: 'danger' };
    default:
      return { label: status || 'Unknown', tone: 'neutral' };
  }
}

/**
 * Localized label for a `SubstitutionPreference` value. Pass `t` from
 * `useTranslation()` so the label matches the active locale. Returns an
 * empty string when no preference is set - caller should short-circuit on that.
 */
export function substitutionLabel(sub, t) {
  if (!sub || !t) return '';
  switch (sub) {
    case 'MERCHANT_PICK': return t('merchant.subChipPick');
    case 'CONTACT_ME':    return t('merchant.subChipContact');
    case 'NONE':          return t('merchant.subChipNone');
    default:              return '';
  }
}

/**
 * Ordered timeline of states for a request type. Cancellation isn't included -
 * it's an out-of-band terminal state that should render separately.
 */
export function statusTimeline(type) {
  if (type === 'PACKAGE') {
    return [
      STATUS.REQUESTED,
      STATUS.RIDER_ASSIGNED,
      STATUS.RIDER_EN_ROUTE,
      STATUS.PICKED_UP,
      STATUS.IN_TRANSIT,
      STATUS.DELIVERED,
      STATUS.SETTLED,
    ];
  }
  return [
    STATUS.REQUESTED,
    STATUS.ACCEPTED,
    STATUS.PROCESSING,
    STATUS.READY_FOR_PICKUP,
    STATUS.RIDER_ASSIGNED,
    STATUS.RIDER_EN_ROUTE,
    STATUS.PICKED_UP,
    STATUS.IN_TRANSIT,
    STATUS.DELIVERED,
    STATUS.SETTLED,
  ];
}

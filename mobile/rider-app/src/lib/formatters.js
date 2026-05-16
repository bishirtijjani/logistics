/**
 * Display formatters — Naira, distance, duration, date/time.
 * Pure functions only; never touch i18n directly so they can run in workers.
 */

export const formatNaira = (amount, { withSymbol = true } = {}) => {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return withSymbol ? '₦0' : '0';
  }
  const n = Number(amount);
  const sign = n < 0 ? '-' : '';
  const formatted = Math.abs(n)
    .toFixed(2)
    .replace(/\.00$/, '')
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}${withSymbol ? '₦' : ''}${formatted}`;
};

export const formatDistanceKm = (meters) => {
  if (meters === null || meters === undefined) return '';
  const km = Number(meters) / 1000;
  if (km < 1) return `${Math.round(meters)} m`;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
};

export const formatDurationMin = (seconds) => {
  if (seconds === null || seconds === undefined) return '';
  const m = Math.round(Number(seconds) / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h} hr` : `${h} hr ${r} min`;
};

export const formatTimeHm = (date) => {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};

/**
 * Date helpers - pure, no React.
 *
 * `parseISODate("YYYY-MM-DD")` parses a date *as a UTC midnight* so it doesn't
 * shift across timezones. Returns `null` for malformed or semantically
 * invalid input (e.g. "2024-13-45").
 */

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function parseISODate(value) {
  if (typeof value !== "string" || !ISO_DATE_REGEX.test(value)) return null;
  // Use Date.UTC to avoid local-timezone shifts. `new Date("YYYY-MM-DD")`
  // would also parse but is locale-fragile on older JS engines.
  const [y, m, d] = value.split("-").map(Number);
  const ts = Date.UTC(y, m - 1, d);
  const parsed = new Date(ts);
  // Confirm the components round-trip - catches "2024-02-30" (parses to Mar 1).
  if (
    parsed.getUTCFullYear() !== y ||
    parsed.getUTCMonth() !== m - 1 ||
    parsed.getUTCDate() !== d
  ) {
    return null;
  }
  return parsed;
}

/** True when value is a real date strictly before today (UTC). */
export function isValidPastDate(value) {
  const d = parseISODate(value);
  if (!d) return false;
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return d.getTime() < todayUtc;
}

/** True when value is a real date on or after today (UTC). Used for doc expiries. */
export function isValidFutureDate(value) {
  const d = parseISODate(value);
  if (!d) return false;
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return d.getTime() >= todayUtc;
}

/** Years between value and now (UTC, floored). Returns null for invalid input. */
export function ageFromDob(value) {
  const d = parseISODate(value);
  if (!d) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age--;
  return age;
}

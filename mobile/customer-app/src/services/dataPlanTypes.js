/**
 * Frontend-only grouping of data plans by "type".
 *
 * The provider stores a free-form `planType` string on each data plan
 * (e.g. "SME", "GIFTING", "GIFTING PROMO", "COOPERATE GIFTING"). We fold
 * those onto a fixed, ordered set of canonical buckets so the buy-data
 * screen can offer a Type selector. Pure client-side: no extra request, the
 * filter applies instantly as plans arrive from the DB.
 *
 * Mirror any change across the three buy-data surfaces:
 *   - mobile/customer-app/src/services/dataPlanTypes.js
 *   - mobile/rider-app/src/services/dataPlanTypes.js
 *   - merchant-dashboard/src/utils/dataPlanTypes.js
 */

// Canonical types, in the order they should appear in the selector.
export const DATA_PLAN_TYPES = [
  { key: "SME", label: "SME" },
  { key: "SME2", label: "SME2" },
  { key: "GIFTING", label: "Gifting" },
  { key: "CORPORATE", label: "Corporate Gifting" },
  { key: "DATA_SHARE", label: "Data Share" },
  { key: "DATA_COUPON", label: "Data Coupons" },
];

/**
 * Fold a raw provider planType onto one canonical key, or null if it matches
 * none. Order matters: the more specific token wins, so "SME2" never falls
 * through to "SME" and "(Co)operate/Corporate Gifting" never falls through to
 * plain "Gifting".
 */
export function canonicalDataType(planType) {
  if (!planType) return null;
  const s = String(planType).toUpperCase();
  if (s.includes("COUPON")) return "DATA_COUPON";
  if (s.includes("SHARE")) return "DATA_SHARE";
  if (s.includes("COOPERATE") || s.includes("CORPORATE")) return "CORPORATE";
  if (s.includes("SME2") || s.includes("SME 2")) return "SME2";
  if (s.includes("SME")) return "SME";
  if (s.includes("GIFTING")) return "GIFTING";
  return null;
}

/**
 * Given a list of plans, return the type buckets that actually have at least
 * one plan, in canonical order. Any plan whose type matches none of the
 * canonical buckets keeps its own raw label (prefixed key) appended at the
 * end, so a plan is never hidden if the provider introduces a new type.
 */
export function availableDataTypes(plans) {
  const present = new Set();
  const extras = new Map(); // RAW key -> original label
  for (const p of plans || []) {
    const c = canonicalDataType(p.planType);
    if (c) present.add(c);
    else if (p.planType) {
      const raw = String(p.planType).toUpperCase();
      if (!extras.has(raw)) extras.set(raw, String(p.planType));
    }
  }
  const out = DATA_PLAN_TYPES.filter((t) => present.has(t.key));
  for (const [raw, label] of extras) out.push({ key: `RAW:${raw}`, label });
  return out;
}

/** Does a plan belong to the given type key? A null key matches everything. */
export function planMatchesType(plan, typeKey) {
  if (!typeKey) return true;
  if (typeKey.startsWith("RAW:")) {
    return String(plan.planType || "").toUpperCase() === typeKey.slice(4);
  }
  return canonicalDataType(plan.planType) === typeKey;
}

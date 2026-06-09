/**
 * Geofence service - Phase 4.
 *
 * The rider's cockpit registers a soft fence around the pickup or dropoff
 * point. The fence watches incoming GPS fixes and fires `onEnter` either:
 *   - when the rider gets within `radiusM` of the centre, OR
 *   - after `fallbackAfterMs` while inside `fallbackRadiusM` (handles
 *     dense GPS-shadow areas where the rider is physically at the spot but
 *     accuracy never tightens below 100 m).
 *
 * Design notes:
 *   - We subscribe to the same foreground GPS subscription `locationStream`
 *     already uses (no extra `watchPositionAsync`), via its `onFix` callback
 *     piped through riderSlice. That means the cockpit can derive arrival
 *     from the lastFix selector - but we expose a procedural API for clarity
 *     because the cockpit also needs explicit `cancel()` semantics on
 *     status transitions (Phase 4's pickup fence cancels when the rider
 *     taps "Confirm pickup", before the dropoff fence is set up).
 *   - This module is intentionally state-only - no React hooks here so it
 *     can be unit-tested without an RN harness.
 *   - `onEnter` is fired at most once per fence instance.
 */

import {
  GEOFENCE_RADIUS_M,
  GEOFENCE_FALLBACK_RADIUS_M,
  GEOFENCE_FALLBACK_AFTER_MS,
} from "../lib/constants";

const HAVERSINE_R = 6_371_000; // metres

function haversineMeters(a, b) {
  if (!a || !b) return Infinity;
  if (typeof a.lat !== "number" || typeof a.lng !== "number") return Infinity;
  if (typeof b.lat !== "number" || typeof b.lng !== "number") return Infinity;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * HAVERSINE_R * Math.asin(Math.sqrt(h));
}

class Geofence {
  constructor({ lat, lng, radiusM, fallbackRadiusM, fallbackAfterMs, onEnter }) {
    this.target = { lat, lng };
    this.radiusM = radiusM;
    this.fallbackRadiusM = fallbackRadiusM;
    this.fallbackAfterMs = fallbackAfterMs;
    this._onEnter = typeof onEnter === "function" ? onEnter : null;
    this._fired = false;
    this._fallbackTimer = null;
    this._lastInsideFallbackAt = null;
  }

  /**
   * Push a new fix in. Returns the distance-to-target in metres so callers
   * can surface it (e.g. "200 m from pickup").
   */
  ingestFix(fix) {
    if (this._fired) return { distanceM: 0, fired: true };
    if (!fix || typeof fix.lat !== "number" || typeof fix.lng !== "number") {
      return { distanceM: Infinity, fired: false };
    }
    const distance = haversineMeters(fix, this.target);
    if (distance <= this.radiusM) {
      this._fire("inside");
      return { distanceM: 0, fired: true };
    }
    if (distance <= this.fallbackRadiusM) {
      if (!this._lastInsideFallbackAt) {
        this._lastInsideFallbackAt = Date.now();
        this._armFallbackTimer();
      }
    } else if (this._lastInsideFallbackAt) {
      // Drifted back out of the fallback band - reset the dwell timer.
      this._lastInsideFallbackAt = null;
      this._disarmFallbackTimer();
    }
    return { distanceM: distance, fired: false };
  }

  cancel() {
    this._disarmFallbackTimer();
    this._fired = true; // prevent late `_fire` from anywhere
    this._onEnter = null;
  }

  hasFired() {
    return this._fired;
  }

  _fire(reason) {
    if (this._fired) return;
    this._fired = true;
    this._disarmFallbackTimer();
    const cb = this._onEnter;
    this._onEnter = null;
    if (cb) {
      try { cb({ reason }); } catch (_) {}
    }
  }

  _armFallbackTimer() {
    if (this._fallbackTimer) return;
    this._fallbackTimer = setTimeout(() => {
      this._fallbackTimer = null;
      // Only fire if we've still been inside the fallback band continuously.
      if (this._lastInsideFallbackAt && !this._fired) {
        this._fire("fallback");
      }
    }, this.fallbackAfterMs);
  }

  _disarmFallbackTimer() {
    if (this._fallbackTimer) {
      try { clearTimeout(this._fallbackTimer); } catch (_) {}
      this._fallbackTimer = null;
    }
  }
}

/**
 * Public factory. Mirrors the API shape called out in the roadmap.
 *
 * @param {object} opts
 * @param {number} opts.lat
 * @param {number} opts.lng
 * @param {number} [opts.radiusM=75]
 * @param {number} [opts.fallbackRadiusM=150]
 * @param {number} [opts.fallbackAfterMs=300_000]
 * @param {(payload:{reason:'inside'|'fallback'}) => void} [opts.onEnter]
 * @returns {{ ingestFix:(fix)=>{distanceM:number,fired:boolean}, cancel:()=>void, hasFired:()=>boolean }}
 */
export function createGeofence(opts) {
  const radiusM = typeof opts?.radiusM === "number" ? opts.radiusM : GEOFENCE_RADIUS_M;
  const fallbackRadiusM = typeof opts?.fallbackRadiusM === "number"
    ? opts.fallbackRadiusM
    : GEOFENCE_FALLBACK_RADIUS_M;
  const fallbackAfterMs = typeof opts?.fallbackAfterMs === "number"
    ? opts.fallbackAfterMs
    : GEOFENCE_FALLBACK_AFTER_MS;

  return new Geofence({
    lat: opts.lat,
    lng: opts.lng,
    radiusM,
    fallbackRadiusM,
    fallbackAfterMs,
    onEnter: opts.onEnter,
  });
}

export { haversineMeters };

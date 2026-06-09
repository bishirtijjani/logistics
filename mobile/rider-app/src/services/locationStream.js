/**
 * Foreground GPS stream for the rider - Phase 2.
 *
 * Design choices (set in roadmap §2.7):
 *   - Foreground only. No `expo-task-manager`, no background service. When the
 *     app backgrounds, the subscription pauses. When it foregrounds, it
 *     resumes. The rider keeps the app foregrounded with the screen on
 *     (enforced by `expo-keep-awake` in HomeTabScreen) during shifts.
 *   - Cadence:
 *       - 15 000 ms while ONLINE-idle
 *       - 3 000 ms while ON_DELIVERY
 *       - throttled to 30 000 ms when battery < 20 %
 *       - throttled to 60 000 ms when battery < 10 %
 *   - Each fix is enriched with `requestId` (from the trip slice) and emitted
 *     via socket `rider:location:update`. If the socket is disconnected the
 *     fix is pushed onto an in-memory ring buffer (cap 50 - oldest dropped)
 *     and drained via batched `POST /rider/location` on reconnect.
 *   - Server's location rate-limit is 1 fix/sec/rider - we comply by never
 *     scheduling tighter than 3 s and by deduping on a min-distance.
 */

import * as Location from "expo-location";
import * as Battery from "expo-battery";
import { AppState } from "react-native";
import socketService from "./socket";
import api from "./api";
import { newIdempotencyKey } from "./idempotency";
import { LOCATION_CADENCE } from "../lib/constants";

const RING_BUFFER_CAP = 50;
const MIN_DISTANCE_M = 8;       // dedupe - drop fixes < 8 m from previous
const MIN_TIME_DELTA_MS = 2_000; // dedupe - drop fixes < 2 s after previous
const LOW_BATTERY_THRESHOLD = 0.20;
const VERY_LOW_BATTERY_THRESHOLD = 0.10;
const VERY_LOW_CADENCE_MS = 60_000;

const HAVERSINE_R = 6_371_000; // metres
function haversineMeters(a, b) {
  if (!a || !b) return Infinity;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * HAVERSINE_R * Math.asin(Math.sqrt(h));
}

class LocationStream {
  constructor() {
    this._subscription = null;
    this._batterySubscription = null;
    this._appStateSubscription = null;
    this._socketUnsub = null;

    this._mode = "idle";              // 'idle' | 'on_delivery' | null (stopped)
    this._batteryLevel = 1;           // 0..1
    this._lastFix = null;             // { lat, lng, capturedAt }
    this._lastEmittedAt = 0;
    this._ringBuffer = [];            // [{ lat, lng, requestId, capturedAt }]

    this._onFix = null;               // optional dispatcher callback set by start()
    this._requestIdGetter = null;     // () => string | null
  }

  isRunning() {
    return this._subscription !== null;
  }

  /**
   * Start streaming.
   *
   * @param {object} opts
   * @param {'idle'|'on_delivery'} [opts.mode='idle']
   * @param {(fix: {lat:number, lng:number, accuracy:number, capturedAt:number}) => void} [opts.onFix]
   * @param {() => string|null} [opts.requestIdGetter] - returns active requestId, called on each fix
   * @returns {Promise<{ok: boolean, reason?: string}>}
   */
  async start(opts = {}) {
    const { mode = "idle", onFix, requestIdGetter } = opts;
    if (this._subscription) {
      // Already running - switch mode if needed.
      if (mode !== this._mode) {
        await this.setMode(mode);
      }
      return { ok: true };
    }

    // 1. Permission gate.
    const { status } = await Location.getForegroundPermissionsAsync();
    let granted = status === "granted";
    if (!granted) {
      const req = await Location.requestForegroundPermissionsAsync();
      granted = req.status === "granted";
    }
    if (!granted) return { ok: false, reason: "permission_denied" };

    // 2. Services-enabled check.
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) return { ok: false, reason: "services_disabled" };

    this._mode = mode;
    this._onFix = onFix || null;
    this._requestIdGetter = requestIdGetter || null;

    // 3. Battery monitoring - initial read + subscription.
    try {
      this._batteryLevel = await Battery.getBatteryLevelAsync();
      this._batterySubscription = Battery.addBatteryLevelListener(({ batteryLevel }) => {
        const wasThrottled = this._isBatteryThrottled();
        this._batteryLevel = batteryLevel;
        if (wasThrottled !== this._isBatteryThrottled() && this._subscription) {
          // Cadence band changed - restart subscription with new cadence.
          this._restartWatch().catch(() => {});
        }
      });
    } catch (_) {
      // Battery APIs can fail on emulators. Don't block streaming.
    }

    // 4. AppState - pause on background, resume on foreground.
    this._appStateSubscription = AppState.addEventListener("change", (next) => {
      if (next !== "active" && this._subscription) {
        this._suspendWatch();
      } else if (next === "active" && this._mode && !this._subscription) {
        this._restartWatch().catch(() => {});
      }
    });

    // 5. Socket reconnect - drain the ring buffer the moment the socket comes back.
    this._socketUnsub = socketService.onConnectionStateChange((connected) => {
      if (connected) this._drainRingBuffer().catch(() => {});
    });

    await this._restartWatch();
    return { ok: true };
  }

  /** Switch cadence (e.g. trip became ON_DELIVERY → use 3 s). */
  async setMode(mode) {
    if (mode !== "idle" && mode !== "on_delivery") return;
    if (this._mode === mode) return;
    this._mode = mode;
    if (this._subscription) await this._restartWatch();
  }

  /** Stop streaming, flush ring buffer, unsubscribe from everything. */
  async stop() {
    this._suspendWatch();
    if (this._batterySubscription) {
      try { this._batterySubscription.remove(); } catch (_) {}
      this._batterySubscription = null;
    }
    if (this._appStateSubscription) {
      try { this._appStateSubscription.remove(); } catch (_) {}
      this._appStateSubscription = null;
    }
    if (this._socketUnsub) {
      try { this._socketUnsub(); } catch (_) {}
      this._socketUnsub = null;
    }
    // Try one final drain in case the socket is still connected.
    await this._drainRingBuffer().catch(() => {});
    this._ringBuffer = [];
    this._mode = null;
    this._onFix = null;
    this._requestIdGetter = null;
    this._lastFix = null;
    this._lastEmittedAt = 0;
  }

  // ── Internal ────────────────────────────────────────────────────────────

  _isBatteryThrottled() {
    return this._batteryLevel < LOW_BATTERY_THRESHOLD;
  }

  _isVeryLowBattery() {
    return this._batteryLevel < VERY_LOW_BATTERY_THRESHOLD;
  }

  _cadenceMs() {
    if (this._isVeryLowBattery()) return VERY_LOW_CADENCE_MS;
    if (this._isBatteryThrottled()) return LOCATION_CADENCE.LOW_BATTERY_MS;
    return this._mode === "on_delivery"
      ? LOCATION_CADENCE.ON_DELIVERY_MS
      : LOCATION_CADENCE.IDLE_MS;
  }

  _accuracy() {
    return this._mode === "on_delivery"
      ? Location.Accuracy.Highest
      : Location.Accuracy.Balanced;
  }

  _distanceInterval() {
    return this._mode === "on_delivery" ? 10 : 30;
  }

  _suspendWatch() {
    if (this._subscription) {
      try { this._subscription.remove(); } catch (_) {}
      this._subscription = null;
    }
  }

  async _restartWatch() {
    this._suspendWatch();
    try {
      this._subscription = await Location.watchPositionAsync(
        {
          accuracy: this._accuracy(),
          timeInterval: this._cadenceMs(),
          distanceInterval: this._distanceInterval(),
        },
        (pos) => this._handleFix(pos),
      );
    } catch (err) {
      console.warn("[locationStream] watchPositionAsync failed:", err?.message);
    }
  }

  _handleFix(pos) {
    if (!pos?.coords) return;
    const { latitude, longitude, accuracy } = pos.coords;
    const now = Date.now();

    // Dedupe by distance + time delta. Mitigates the unavoidable
    // over-firing some OEMs do at distanceInterval boundaries.
    const candidate = { lat: latitude, lng: longitude };
    const tooClose = haversineMeters(this._lastFix, candidate) < MIN_DISTANCE_M;
    const tooSoon = now - this._lastEmittedAt < MIN_TIME_DELTA_MS;
    if (this._lastFix && tooClose && tooSoon) return;

    this._lastFix = { ...candidate, capturedAt: now };
    this._lastEmittedAt = now;

    const requestId = this._requestIdGetter?.() || undefined;
    const payload = { lat: latitude, lng: longitude, requestId };

    // Dispatcher hook (e.g. write to riderSlice.lastFix).
    if (this._onFix) {
      try {
        this._onFix({ lat: latitude, lng: longitude, accuracy: accuracy ?? null, capturedAt: now });
      } catch (_) {}
    }

    if (socketService.isConnected()) {
      socketService.emitLocationUpdate(payload);
    } else {
      this._pushToBuffer({ ...payload, capturedAt: new Date(now).toISOString() });
    }
  }

  _pushToBuffer(record) {
    this._ringBuffer.push(record);
    if (this._ringBuffer.length > RING_BUFFER_CAP) {
      // Drop oldest - recent fixes matter more than stale ones for a re-sync.
      this._ringBuffer.splice(0, this._ringBuffer.length - RING_BUFFER_CAP);
    }
  }

  /**
   * Drain buffered fixes to the backend in a single batched POST.
   * Backend endpoint: `POST /rider/location` accepts either a single
   * `{lat,lng,requestId?}` body or `{ updates: [...] }` (the rider client
   * uses the array form when draining - BE may need the array form added
   * if it currently only accepts singletons).
   */
  async _drainRingBuffer() {
    if (this._ringBuffer.length === 0) return;
    const batch = this._ringBuffer.splice(0, this._ringBuffer.length);
    try {
      await api.post(
        "/rider/location",
        { updates: batch },
        { headers: { "Idempotency-Key": newIdempotencyKey() } },
      );
    } catch (err) {
      // Put them back at the front so we'll retry on the next reconnect.
      this._ringBuffer = batch.concat(this._ringBuffer).slice(-RING_BUFFER_CAP);
    }
  }
}

const locationStream = new LocationStream();
export default locationStream;

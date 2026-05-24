/**
 * Sentry wrapper for the rider app.
 *
 * Provides a stable surface for the rest of the app (`initSentry`,
 * `setUser`, `captureError`, `addBreadcrumb`) so call sites never import
 * `@sentry/react-native` directly. Switching providers later is a single
 * file change.
 *
 * Configuration:
 *   - `EXPO_PUBLIC_SENTRY_DSN`         — required; events are dropped if absent.
 *   - `EXPO_PUBLIC_SENTRY_ENVIRONMENT` — `development` | `staging` | `production`.
 *                                       Set in `eas.json` per build profile.
 *
 * Sample rates are tuned conservatively for v1 — bump
 * `tracesSampleRate` once we have a Sentry quota signal.
 */

import * as Sentry from "@sentry/react-native";

let _initialized = false;

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || "";
const ENVIRONMENT = process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT || "development";

/**
 * Redact obvious secrets from event extras before sending. Defense-in-
 * depth on top of Sentry's `sendDefaultPii: false` — we control the keys
 * we attach via `captureError(..., context)` so this is a belt-and-braces.
 */
function redactSecrets(event) {
  const scrub = (obj) => {
    if (!obj || typeof obj !== "object") return;
    for (const k of Object.keys(obj)) {
      if (/pin|password|token|secret|bvn|otp|signature/i.test(k)) {
        obj[k] = "[redacted]";
      } else if (typeof obj[k] === "object") {
        scrub(obj[k]);
      }
    }
  };
  scrub(event.extra);
  scrub(event.contexts);
  if (event.request) scrub(event.request.headers);
  return event;
}

/**
 * Initialise Sentry. Safe to call once at App boot — subsequent calls
 * short-circuit. Returns true when the SDK is active, false when no DSN
 * was provided (e.g. local dev without secrets — we don't crash, we
 * silently disable).
 */
export const initSentry = () => {
  if (_initialized) return Boolean(DSN);
  _initialized = true;
  if (!DSN) {
    // No DSN configured. All other exports below become no-ops at runtime
    // because Sentry SDK ignores capture calls without an active client.
    return false;
  }
  Sentry.init({
    dsn: DSN,
    environment: ENVIRONMENT,
    tracesSampleRate: ENVIRONMENT === "production" ? 0.1 : 1.0,
    profilesSampleRate: ENVIRONMENT === "production" ? 0.1 : 1.0,
    sendDefaultPii: false,
    // Skip noisy lifecycle events that aren't actionable in a Sentry feed.
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === "console" && breadcrumb.level === "log") {
        return null;
      }
      return breadcrumb;
    },
    beforeSend(event) {
      return redactSecrets(event);
    },
  });
  // Default tag — every event from this binary belongs to the rider app.
  Sentry.setTag("role", "RIDER");
  Sentry.setTag("appSurface", "rider-mobile");
  return true;
};

/**
 * Tag the active user. Cleared on sign-out (call with `null` from the
 * navigator's auth effect) so a shared device doesn't leak the previous
 * rider's id into the next session's breadcrumbs.
 */
export const setUser = (user) => {
  if (!DSN) return;
  if (!user) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({
    id: String(user.id || ""),
    role: user.role || "RIDER",
  });
};

/**
 * Capture an exception with optional context. Context fields map to
 * Sentry scope tags / user / extra so they show up cleanly in the UI.
 *
 *   captureError(err, {
 *     screen: 'TripCockpitScreen',
 *     feature: 'pod-upload',
 *     riderId: rider.id,
 *     requestId: trip.id,
 *   });
 */
export const captureError = (err, context = {}) => {
  if (!DSN) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn("captureError (no DSN):", err?.message || err, context);
    }
    return;
  }
  Sentry.withScope((scope) => {
    if (context.screen) scope.setTag("screen", context.screen);
    if (context.feature) scope.setTag("feature", context.feature);
    if (context.userId) scope.setUser({ id: String(context.userId) });
    if (context.riderId) scope.setTag("riderId", String(context.riderId));
    if (err?.code) scope.setTag("errorCode", err.code);
    if (err?.status) scope.setTag("httpStatus", String(err.status));
    const { screen, feature, userId, riderId, ...rest } = context;
    if (Object.keys(rest).length) scope.setContext("extra", rest);
    Sentry.captureException(err);
  });
};

/** Drop a breadcrumb for the next captured error. */
export const addBreadcrumb = (breadcrumb) => {
  if (!DSN) return;
  Sentry.addBreadcrumb(breadcrumb);
};

/**
 * Returns the SDK's ErrorBoundary so callers can use it instead of
 * `react-error-boundary` once they want Sentry-native crash capture
 * with screenshots. App.js currently uses `react-error-boundary` + a
 * manual `captureError` hook (see `onError={reportToSentry}`); either
 * pattern works.
 */
export const getErrorBoundary = () => Sentry.ErrorBoundary || null;

/** True when the SDK is wired up. */
export const isEnabled = () => Boolean(DSN);

/** Surfaces whether a DSN is defined in the build (separate from "active"). */
export const isDsnConfigured = () => Boolean(DSN);

/**
 * Sentry wrapper for the customer app.
 *
 * Mirrors the rider-app wrapper so call sites stay symmetrical across both
 * surfaces. All Sentry SDK references live in this one file — switching
 * providers later is a single-file change.
 *
 * Configuration:
 *   - `EXPO_PUBLIC_SENTRY_DSN`         — required; events are dropped if absent.
 *   - `EXPO_PUBLIC_SENTRY_ENVIRONMENT` — `development` | `staging` | `production`.
 *                                       Set in `eas.json` per build profile.
 */

import * as Sentry from "@sentry/react-native";

let _initialized = false;

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || "";
const ENVIRONMENT = process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT || "development";

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

export const initSentry = () => {
  if (_initialized) return Boolean(DSN);
  _initialized = true;
  if (!DSN) return false;
  Sentry.init({
    dsn: DSN,
    environment: ENVIRONMENT,
    tracesSampleRate: ENVIRONMENT === "production" ? 0.1 : 1.0,
    profilesSampleRate: ENVIRONMENT === "production" ? 0.1 : 1.0,
    sendDefaultPii: false,
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
  Sentry.setTag("role", "CUSTOMER");
  Sentry.setTag("appSurface", "customer-mobile");
  return true;
};

export const setUser = (user) => {
  if (!DSN) return;
  if (!user) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({
    id: String(user.id || ""),
    role: user.role || "CUSTOMER",
  });
};

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
    if (err?.code) scope.setTag("errorCode", err.code);
    if (err?.status) scope.setTag("httpStatus", String(err.status));
    const { screen, feature, userId, ...rest } = context;
    if (Object.keys(rest).length) scope.setContext("extra", rest);
    Sentry.captureException(err);
  });
};

export const addBreadcrumb = (breadcrumb) => {
  if (!DSN) return;
  Sentry.addBreadcrumb(breadcrumb);
};

export const getErrorBoundary = () => Sentry.ErrorBoundary || null;

export const isEnabled = () => Boolean(DSN);

export const isDsnConfigured = () => Boolean(DSN);

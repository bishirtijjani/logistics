/**
 * Sentry wrapper for the customer app.
 *
 * Loads `@sentry/react-native` if it's installed AND a DSN is configured;
 * otherwise every method on this module is a silent no-op. Lets the rest of
 * the app call `captureError(err)` unconditionally without exploding on dev
 * builds that don't have Sentry wired up yet.
 *
 * To turn it on:
 *   1. `npm install --save @sentry/react-native` (and follow Expo plugin docs)
 *   2. Set EXPO_PUBLIC_SENTRY_DSN in the build profile
 *   3. Optionally add @sentry/react-native to app.json's `plugins`
 *
 * After step 1+2 this module auto-detects the dep and starts capturing.
 *
 * USAGE:
 *   import { initSentry, captureError, ErrorBoundary } from './services/sentry';
 *   initSentry(); // once, at app boot
 *   captureError(err, { screen: 'CheckoutScreen', userId });
 */

let Sentry = null;
let _initialized = false;
let _enabled = false;

// Pull the DSN from the Expo public env at module evaluation. Expo inlines
// EXPO_PUBLIC_* into the bundle; nothing is read at runtime.
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || '';
const ENVIRONMENT = process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development';

const tryRequireSdk = () => {
  if (Sentry !== null) return Sentry;
  try {
    // Dynamic require so Metro doesn't fail when the package isn't installed.
    // eslint-disable-next-line global-require
    Sentry = require('@sentry/react-native');
  } catch (_) {
    Sentry = false; // sentinel: tried and not present
  }
  return Sentry;
};

/**
 * Initialize Sentry. No-ops cleanly when:
 *   - `@sentry/react-native` isn't installed yet, or
 *   - EXPO_PUBLIC_SENTRY_DSN isn't set
 */
export const initSentry = () => {
  if (_initialized) return _enabled;
  _initialized = true;
  if (!DSN) return false;
  const SDK = tryRequireSdk();
  if (!SDK) return false;
  try {
    SDK.init({
      dsn: DSN,
      environment: ENVIRONMENT,
      // Don't track every screen change — sample modestly. App users tap a lot.
      tracesSampleRate: 0.1,
      // Strip PII at the SDK layer. Stack + tags + breadcrumbs are enough.
      sendDefaultPii: false,
      beforeSend(event) {
        // Defensive scrub: even if a caller accidentally attaches a PIN /
        // password / token in `extra`, drop it before the event leaves.
        if (event.extra) {
          for (const k of Object.keys(event.extra)) {
            if (/pin|password|token|secret|bvn/i.test(k)) {
              event.extra[k] = '[redacted]';
            }
          }
        }
        return event;
      },
    });
    _enabled = true;
  } catch (_) {
    _enabled = false;
  }
  return _enabled;
};

/**
 * Tag the active user so subsequent events are attributable. Pass null to
 * clear (call this on logout).
 */
export const setUser = (user) => {
  const SDK = tryRequireSdk();
  if (!SDK || !_enabled) return;
  if (!user) {
    SDK.setUser(null);
    return;
  }
  SDK.setUser({ id: String(user.id || ''), role: user.role });
};

/**
 * Capture an exception. When Sentry is disabled, falls back to console.warn
 * so dev builds still see the error.
 */
export const captureError = (err, context = {}) => {
  const SDK = tryRequireSdk();
  if (!SDK || !_enabled) {
    // eslint-disable-next-line no-console
    console.warn('captureError (sentry disabled):', err?.message || err, context);
    return;
  }
  SDK.withScope((scope) => {
    if (context.screen) scope.setTag('screen', context.screen);
    if (context.feature) scope.setTag('feature', context.feature);
    if (context.userId) scope.setUser({ id: String(context.userId) });
    if (err?.code) scope.setTag('errorCode', err.code);
    const { screen, feature, userId, ...rest } = context;
    if (Object.keys(rest).length) scope.setContext('extra', rest);
    SDK.captureException(err);
  });
};

/**
 * Drop a breadcrumb (timeline entry) for the next captured error. Use
 * sparingly — every nav transition or socket event would be noise.
 */
export const addBreadcrumb = (breadcrumb) => {
  const SDK = tryRequireSdk();
  if (!SDK || !_enabled) return;
  SDK.addBreadcrumb(breadcrumb);
};

/**
 * Returns the SDK's ErrorBoundary if available, or null. App.js falls back
 * to `react-error-boundary` when this returns null.
 */
export const getErrorBoundary = () => {
  const SDK = tryRequireSdk();
  if (!SDK || !_enabled) return null;
  return SDK.ErrorBoundary || null;
};

/** True when the SDK is loaded and the DSN was accepted. */
export const isEnabled = () => _enabled;

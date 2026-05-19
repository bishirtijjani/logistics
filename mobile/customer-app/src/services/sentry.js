/**
 * Sentry wrapper for the customer app.
 *
 * THIS FILE IS A NO-OP STUB by design. It contains zero references to
 * `@sentry/react-native` so Metro can bundle the app without the SDK
 * installed. Every export below is callable and safe to leave in place
 * forever even if you never turn Sentry on.
 *
 * To turn it on (later):
 *   1. `npm install --save @sentry/react-native`
 *   2. Add the Sentry expo plugin to app.json's `plugins` array (see
 *      https://docs.sentry.io/platforms/react-native/manual-setup/expo/)
 *   3. Set EXPO_PUBLIC_SENTRY_DSN in the build profile
 *   4. Replace the body of `initSentry` / `captureError` / `setUser` /
 *      `addBreadcrumb` with the real SDK calls — see the commented
 *      template at the bottom of this file.
 *
 * Why a stub instead of a clever try/require:
 *   - Metro statically resolves every `require('package-name')` at bundle
 *     time. A try/catch wrapping the require ONLY catches runtime errors,
 *     not the bundler "Unable to resolve module" failure.
 *   - That means "non-blocking" can't be achieved by dynamic-require alone.
 *     The only bulletproof pattern is: don't reference the dep until it's
 *     time to use it.
 *   - So this file ships with no dep references; the api interceptor +
 *     App.js's ErrorBoundary still call into here, but every call lands
 *     on a no-op.
 *
 * USAGE (unchanged regardless of whether Sentry is active):
 *   import { initSentry, captureError } from './services/sentry';
 *   initSentry();
 *   captureError(err, { screen: 'CheckoutScreen', userId });
 */

let _initialized = false;

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || '';

/**
 * No-op initialization. When Sentry is wired up (see header), replace the
 * body with the real `Sentry.init({...})` call. Returns true when active,
 * false in stub mode — callers can branch on the return value if needed.
 */
export const initSentry = () => {
  if (_initialized) return false;
  _initialized = true;
  // Stub: nothing to initialize. Real impl goes here once the SDK is added.
  return false;
};

/** Tag the active user for future events. No-op in stub mode. */
// eslint-disable-next-line no-unused-vars
export const setUser = (user) => {
  // Stub: no SDK to call. Real impl: SDK.setUser({ id, role }) or SDK.setUser(null).
};

/**
 * Capture an exception. In stub mode this routes to console.warn so dev
 * builds still see the error in Metro's terminal; production stub builds
 * absorb the call silently.
 */
export const captureError = (err, context = {}) => {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.warn('captureError (sentry stub):', err?.message || err, context);
  }
  // Real impl: SDK.withScope(scope => { ...tag...; SDK.captureException(err); })
};

/** Drop a breadcrumb for the next captured error. No-op in stub mode. */
// eslint-disable-next-line no-unused-vars
export const addBreadcrumb = (breadcrumb) => {
  // Stub: no SDK. Real impl: SDK.addBreadcrumb(breadcrumb).
};

/**
 * The SDK provides a richer ErrorBoundary; the stub returns null and App.js
 * falls back to `react-error-boundary` (already in use).
 */
export const getErrorBoundary = () => null;

/** True when the SDK is wired up. Always false in stub mode. */
export const isEnabled = () => false;

/**
 * Sanity helper for ops/debug screens — surfaces whether a DSN is even
 * defined in the build, separate from whether the SDK is loaded.
 */
export const isDsnConfigured = () => Boolean(DSN);

// ─────────────────────────────────────────────────────────────────────────
// REAL IMPLEMENTATION TEMPLATE (paste-in when enabling Sentry)
// ─────────────────────────────────────────────────────────────────────────
//
// After installing `@sentry/react-native` and setting EXPO_PUBLIC_SENTRY_DSN,
// replace the bodies above with this pattern:
//
//   import * as Sentry from '@sentry/react-native';
//
//   export const initSentry = () => {
//     if (_initialized) return Boolean(DSN);
//     _initialized = true;
//     if (!DSN) return false;
//     Sentry.init({
//       dsn: DSN,
//       environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT || 'development',
//       tracesSampleRate: 0.1,
//       sendDefaultPii: false,
//       beforeSend(event) {
//         if (event.extra) {
//           for (const k of Object.keys(event.extra)) {
//             if (/pin|password|token|secret|bvn/i.test(k)) event.extra[k] = '[redacted]';
//           }
//         }
//         return event;
//       },
//     });
//     return true;
//   };
//
//   export const setUser = (user) => {
//     if (!user) return Sentry.setUser(null);
//     Sentry.setUser({ id: String(user.id || ''), role: user.role });
//   };
//
//   export const captureError = (err, context = {}) => {
//     Sentry.withScope((scope) => {
//       if (context.screen)  scope.setTag('screen', context.screen);
//       if (context.feature) scope.setTag('feature', context.feature);
//       if (context.userId)  scope.setUser({ id: String(context.userId) });
//       if (err?.code)       scope.setTag('errorCode', err.code);
//       const { screen, feature, userId, ...rest } = context;
//       if (Object.keys(rest).length) scope.setContext('extra', rest);
//       Sentry.captureException(err);
//     });
//   };
//
//   export const addBreadcrumb = (b) => Sentry.addBreadcrumb(b);
//   export const getErrorBoundary = () => Sentry.ErrorBoundary || null;
//   export const isEnabled = () => true;

import axios from 'axios';
import * as SecureStore from '../lib/storage';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Toast from 'react-native-toast-message';
import i18n from '../i18n';
import { captureError as captureSentryError } from './sentry';

/**
 * Translate a server error envelope to the user's locale.
 *   - Looks up `errors.<code>` in the current language.
 *   - Falls back to the server-supplied English `message` when no
 *     translation exists (or when the response carried no `code`).
 * Lives here rather than in useT so the response interceptor - which
 * can't use hooks - has access to localized copy for its auto-toast.
 */
const translateError = (data, fallbackMessage) => {
  const code = data?.code;
  const serverMessage = data?.message || fallbackMessage;
  if (!code) return serverMessage;
  const key = `errors.${code}`;
  const translated = i18n.t(key);
  return translated === key ? serverMessage : translated;
};

// Load base URL from environment variables, fallback for local dev.
// For physical device testing, use your computer's LAN IP (e.g., http://192.168.1.100:3000).
export const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:3000';

// Socket.io connects at the same host as the REST API.
export const SOCKET_URL = BASE_URL;

const api = axios.create({
  baseURL: BASE_URL,
  // Without a timeout, a stalled or unreachable backend leaves every request
  // pending forever - the caller never gets a resolve OR a reject, so loading
  // spinners (e.g. the quote screen) hang indefinitely. 30s is generous for a
  // mobile network yet still fails fast enough to show an error + retry.
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Cache device-identification headers - these never change at runtime, so
// computing them once and reusing avoids touching the native bridge per request.
const DEVICE_HEADERS = {
  'x-device-name': Device.deviceName || `${Platform.OS}-device`,
  'x-device-model': Device.modelName || Device.modelId || 'unknown',
  'x-device-platform': Platform.OS,
  'x-device-os-version': String(Platform.Version || ''),
};

// ============================================================
// Auth handoff
// ============================================================
// authSlice registers a logout function here at startup so the response
// interceptor can hard-logout when /auth/refresh ultimately fails. We avoid
// a direct `import` of the slice/store to keep this module free of circular
// deps (the slice imports api, api can't import the slice).
let _onForceLogout = null;
export const registerForceLogout = (fn) => { _onForceLogout = fn; };

// ============================================================
// Request interceptor - auth header + device fingerprint
// ============================================================
api.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync('accessToken');
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    Object.assign(config.headers, DEVICE_HEADERS);
    return config;
  },
  (error) => Promise.reject(error)
);

// ============================================================
// Silent token refresh
// ============================================================
// Phase 5 - when any request 401s (except /auth/login and /auth/refresh
// themselves), transparently:
//   1. Call POST /auth/refresh with the stored refresh token
//   2. Persist the rotated token pair to SecureStore
//   3. Replay the original request once with the new access token
//
// Concurrent 401s coalesce on a single in-flight refresh promise so we don't
// fan out N parallel /auth/refresh calls. If the refresh itself returns 401
// (or any other error), we clear tokens, surface ONE toast, and dispatch the
// registered logout. Without this the 15-minute access-token expiry kicks
// users to Login mid-task.

let refreshPromise = null;

const isRefreshableRequest = (url = '') => {
  // Don't try to refresh on the auth endpoints themselves; that infinite-loops.
  return !url.includes('/auth/login') && !url.includes('/auth/refresh') && !url.includes('/auth/logout');
};

const performRefresh = async () => {
  const refreshToken = await SecureStore.getItemAsync('refreshToken');
  if (!refreshToken) throw new Error('No refresh token stored');

  // Use a bare axios instance for the refresh call so our own interceptors
  // don't recurse on a refresh-call 401.
  const res = await axios.post(
    `${BASE_URL}/auth/refresh`,
    { refreshToken },
    {
      headers: { 'Content-Type': 'application/json', ...DEVICE_HEADERS },
      timeout: 10_000,
    },
  );

  const data = res.data?.data || res.data;
  const tokens = data?.tokens || data;
  const newAccess = tokens?.accessToken;
  const newRefresh = tokens?.refreshToken;
  if (!newAccess || !newRefresh) {
    throw new Error('Malformed refresh response');
  }

  await SecureStore.setItemAsync('accessToken', newAccess);
  await SecureStore.setItemAsync('refreshToken', newRefresh);
  return newAccess;
};

const forceLogout = async ({ showToast = true } = {}) => {
  try {
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
  } catch (_) {}
  if (showToast) {
    // Both lines pull from the i18n catalog so a Hausa user sees Hausa copy
    // on session expiry instead of the original English fallback.
    Toast.show({
      type: 'error',
      text1: i18n.t('errors.REFRESH_TOKEN_INVALID'),
      text2: i18n.t('errors.UNAUTHORIZED'),
    });
  }
  if (typeof _onForceLogout === 'function') {
    try { _onForceLogout(); } catch (_) {}
  }
};

// ============================================================
// Response interceptor
// ============================================================
// On 401, attempt one silent refresh + replay. On any other error, normalize
// to `{ message, status, data, retryAfterSeconds? }` so callers (PinBottomSheet,
// thunks) can read structured fields.
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const original = error.config;
    const status = error.response?.status ?? null;
    const requestUrl = original?.url || '';

    // --- Silent refresh path ---
    if (status === 401 && original && !original._retry && isRefreshableRequest(requestUrl)) {
      original._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = performRefresh().finally(() => { refreshPromise = null; });
        }
        const newAccess = await refreshPromise;
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${newAccess}`;
        return api(original);
      } catch (refreshErr) {
        // forceLogout already surfaces a single localized "session expired"
        // toast and clears tokens. Reject with a sentinel error and do NOT
        // fall through to the generic toast block below - two toasts on
        // session expiry is just noise.
        await forceLogout();
        const sessionErr = new Error(i18n.t('errors.REFRESH_TOKEN_INVALID'));
        sessionErr.status = 401;
        sessionErr.data = null;
        sessionErr.sessionExpired = true;
        return Promise.reject(sessionErr);
      }
    }

    const data = error.response?.data ?? null;
    // Network-level failures (no response) get a localized NETWORK_ERROR;
    // server errors carry their own `code` and `message`.
    const isNetworkError = !error.response;
    const serverMessage =
      data?.message || error.message || 'Network Error. Please check your connection.';
    const localizedMessage = isNetworkError
      ? i18n.t('errors.NETWORK_ERROR')
      : translateError(data, serverMessage);
    const code = data?.code || (isNetworkError ? 'NETWORK_ERROR' : null);

    // Suppress the global toast for 401/423/429 - callers render contextual UI
    // (PIN sheet, retry banner, session-expired toast already shown above).
    if (status !== 401 && status !== 423 && status !== 429) {
      Toast.show({
        type: 'error',
        text1: i18n.t('errors.title'),
        text2: localizedMessage,
        position: 'top',
      });
    }

    // The rejected error carries both: `message` is the localized copy ready
    // to render verbatim; `serverMessage` preserves the English wire text in
    // case a caller logs or reports it. `code` is top-level for easy access.
    const err = new Error(localizedMessage);
    err.code = code;
    err.status = status;
    err.data = data;
    err.serverMessage = serverMessage;
    const retryAfter = error.response?.headers?.['retry-after'];
    if (retryAfter) {
      const secs = parseInt(retryAfter, 10);
      if (!Number.isNaN(secs)) err.retryAfterSeconds = secs;
    }
    // Forward server-side 5xx + true network failures to Sentry. Skip 4xx
    // operational errors (validation, insufficient balance, etc.) - they're
    // expected and would drown out real signal in the dashboard.
    const requestIdHeader = error.response?.headers?.['x-request-id'];
    if (isNetworkError || (status && status >= 500)) {
      captureSentryError(err, {
        source: 'apiInterceptor',
        url: requestUrl,
        method: original?.method,
        status,
        requestId: requestIdHeader,
      });
    }
    if (requestIdHeader) err.requestId = requestIdHeader;
    return Promise.reject(err);
  }
);

export default api;

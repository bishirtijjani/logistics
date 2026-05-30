import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Toast from 'react-native-toast-message';
import i18n from '../i18n';

/**
 * Translate a server error envelope to the user's locale.
 *   - Looks up `errors.<code>` in the current language.
 *   - Falls back to the server-supplied English `message` when no
 *     translation exists (or when the response carried no `code`).
 */
const translateError = (data, fallbackMessage) => {
  const code = data?.code;
  const serverMessage = data?.message || fallbackMessage;
  if (!code) return serverMessage;
  const key = `errors.${code}`;
  const translated = i18n.t(key);
  return translated === key ? serverMessage : translated;
};

export const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:3000';
export const SOCKET_URL = BASE_URL;

/**
 * Server-clock skew tracking.
 *
 * Captured opportunistically from the `Date` response header on every API
 * call — no extra round trips. Consumers use `serverNow()` to get a clock
 * value that matches the server's wall time, regardless of how wrong the
 * device clock is. Used by `OfferCountdownRing` so a rider with a 30 s-off
 * phone clock still sees the right remaining time on offers.
 *
 * Skew is `serverNow - clientNow` in milliseconds.
 */
let _serverSkewMs = 0;

export function getServerSkewMs() {
  return _serverSkewMs;
}

export function serverNow() {
  return Date.now() + _serverSkewMs;
}

function maybeUpdateSkewFromHeader(headers) {
  try {
    const dateHeader = headers?.date || headers?.Date;
    if (!dateHeader) return;
    const serverMs = Date.parse(dateHeader);
    if (Number.isNaN(serverMs)) return;
    // EMA-ish smoothing — single sample is good enough for our purpose.
    _serverSkewMs = serverMs - Date.now();
  } catch (_) {}
}

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

const DEVICE_HEADERS = {
  'x-device-name': Device.deviceName || `${Platform.OS}-device`,
  'x-device-model': Device.modelName || Device.modelId || 'unknown',
  'x-device-platform': Platform.OS,
  'x-device-os-version': String(Platform.Version || ''),
};

let _onForceLogout = null;
export const registerForceLogout = (fn) => { _onForceLogout = fn; };

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

let refreshPromise = null;

const isRefreshableRequest = (url = '') => {
  return !url.includes('/auth/login') && !url.includes('/auth/refresh') && !url.includes('/auth/logout');
};

const performRefresh = async () => {
  const refreshToken = await SecureStore.getItemAsync('refreshToken');
  if (!refreshToken) throw new Error('No refresh token stored');

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
    // Best-effort: also drop the rider onboarding draft so a re-signed-in user
    // doesn't inherit the previous one. Lazy require avoids a circular import
    // (lib/onboardingPersistence is pure and doesn't import api, but the
    // require keeps the dep graph obviously DAG even after future refactors).
    const { clearOnboardingDraft } = require('../lib/onboardingPersistence');
    await clearOnboardingDraft();
  } catch (_) {}
  if (showToast) {
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

api.interceptors.response.use(
  (response) => {
    maybeUpdateSkewFromHeader(response.headers);
    // Phase 8 — a successful response confirms connectivity. Lazy require
    // so we don't create a load-order dep between api.js and connectivity.js.
    try {
      // eslint-disable-next-line global-require
      require('./connectivity').markOnline();
    } catch (_) { /* connectivity module not available in tests */ }
    return response.data;
  },
  async (error) => {
    maybeUpdateSkewFromHeader(error?.response?.headers);
    // Phase 8 — a network-level failure (no error.response) means we
    // couldn't reach the server at all. Flip the offline signal so the
    // global banner appears. HTTP error responses (4xx/5xx) leave the
    // signal alone because the server WAS reachable.
    if (!error.response) {
      try {
        // eslint-disable-next-line global-require
        require('./connectivity').markOffline('api-network-error');
      } catch (_) { /* see above */ }
    }
    const original = error.config;
    const status = error.response?.status ?? null;
    const requestUrl = original?.url || '';

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
        await forceLogout();
        const sessionErr = new Error(i18n.t('errors.REFRESH_TOKEN_INVALID'));
        sessionErr.status = 401;
        sessionErr.data = null;
        sessionErr.sessionExpired = true;
        return Promise.reject(sessionErr);
      }
    }

    const data = error.response?.data ?? null;
    const isNetworkError = !error.response;
    const serverMessage =
      data?.message || error.message || 'Network Error. Please check your connection.';
    const localizedMessage = isNetworkError
      ? i18n.t('errors.NETWORK_ERROR')
      : translateError(data, serverMessage);
    const code = data?.code || (isNetworkError ? 'NETWORK_ERROR' : null);

    // Best-effort background calls (e.g. push-token registration) opt out of
    // the global error toast by setting `suppressErrorToast` on their config —
    // a transient failure there must not nag the rider with "Something went
    // wrong", least of all right after they grant notification permission.
    const suppressErrorToast = original?.suppressErrorToast === true;
    if (status !== 401 && status !== 423 && status !== 429 && !suppressErrorToast) {
      Toast.show({
        type: 'error',
        text1: i18n.t('errors.title'),
        text2: localizedMessage,
        position: 'top',
      });
    }

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
    return Promise.reject(err);
  }
);

export default api;

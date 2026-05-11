import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Toast from 'react-native-toast-message';

// Load base URL from environment variables, fallback for local dev
// For physical device testing, use your computer's LAN IP (e.g., http://192.168.1.100:3000)
const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:3000';

// Full API URL with version prefix for HTTP requests
export const BASE_URL = `${API_BASE}/api`;

// Base server URL for Socket.io 
export const SOCKET_URL = API_BASE;

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Cache device-identification headers — these never change at runtime, so
// computing them once and reusing avoids touching the native bridge per request.
const DEVICE_HEADERS = {
  'x-device-name': Device.deviceName || `${Platform.OS}-device`,
  'x-device-model': Device.modelName || Device.modelId || 'unknown',
  'x-device-platform': Platform.OS,
  'x-device-os-version': String(Platform.Version || ''),
};

// Request interceptor: add auth token + device fingerprint headers.
// The backend reads x-device-name / x-device-model on login & refresh to
// populate the Sessions screen with a meaningful row per device.
api.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    Object.assign(config.headers, DEVICE_HEADERS);
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: unwrap success, normalize errors.
// Errors thrown carry `.status` and `.data` so callers (e.g. PinBottomSheet)
// can detect 423/429 lockouts and read provider-supplied retry hints.
// Server convention for PIN lockout: 423 with body { message, lockedUntil? }
// or `Retry-After` header in seconds.
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error.response?.status ?? null;
    const data = error.response?.data ?? null;
    const message =
      data?.message || error.message || 'Network Error. Please check your connection.';

    // Suppress the global toast for 423/429 — callers render contextual UI.
    if (status !== 423 && status !== 429) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: message,
        position: 'top',
      });
    }

    const err = new Error(message);
    err.status = status;
    err.data = data;
    // Best-effort retry-after extraction (seconds).
    const retryAfter = error.response?.headers?.['retry-after'];
    if (retryAfter) {
      const secs = parseInt(retryAfter, 10);
      if (!Number.isNaN(secs)) err.retryAfterSeconds = secs;
    }
    return Promise.reject(err);
  }
);

export default api;

import { useSelector } from "react-redux";
import api from "./api";

/**
 * Settings access surface.
 *   - `getSetting(key, default)` - synchronous cached read for thunks/services.
 *   - `usePlatformSetting(key, default)` - React hook backed by the settings slice.
 *   - `fetchPublicSettings()` - hits the backend and writes through the cache.
 */

let cachedSettings = null;

export function setCachedSettings(values) {
  cachedSettings = values || {};
}

export async function fetchPublicSettings() {
  try {
    const response = await api.get("/settings/public");
    const data = response.data?.data ?? response.data ?? {};
    setCachedSettings(data);
    return data;
  } catch (_) {
    return cachedSettings ?? {};
  }
}

export function getSetting(key, defaultValue = null) {
  if (!cachedSettings) return defaultValue;
  const val = cachedSettings[key];
  return val !== undefined && val !== null ? val : defaultValue;
}

export function usePlatformSetting(key, defaultValue = null) {
  const value = useSelector((state) => state.settings?.values?.[key]);
  return value !== undefined && value !== null ? value : defaultValue;
}

import { useSelector } from "react-redux";
import api from "./api";

/**
 * Settings access surface.
 *
 * Two paths:
 *   - `getSetting(key, default)` - synchronous, reads the latest cached value.
 *     Use in non-React contexts (thunks, services, validators).
 *   - `usePlatformSetting(key, default)` - React hook backed by the Redux
 *     `settings` slice. Use in components so they re-render when settings
 *     load or update.
 *
 * `fetchPublicSettings()` (here) hits the backend and writes through to the
 * cache for the synchronous helper. The Redux slice (`settingsSlice`)
 * dispatches its own thunk that ALSO calls `setCachedSettings` so both paths
 * stay in sync.
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

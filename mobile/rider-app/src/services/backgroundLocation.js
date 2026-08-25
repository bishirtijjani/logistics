/**
 * Background location for the rider - Phase 9 "rider can pocket the phone".
 *
 * Guarantee we are implementing end-to-end:
 *   - Server side: rider INTENT (`Rider.availability`) is authoritative and is
 *     never flipped by any worker. The heartbeat / geo pool is only an offer
 *     gate. So even if this task never runs, the rider is never "taken
 *     offline" - they just aren't offered jobs until their app reconnects.
 *   - This task is what KEEPS them in the loop: while ONLINE it runs a
 *     foreground service (Android) / background location updates (iOS) that
 *     keeps posting fixes to `POST /rider/location`, which re-stamps the
 *     heartbeat + geo membership. The rider stays dispatchable and receives
 *     offers over the still-alive socket even when the app is minimised or the
 *     screen is off.
 *
 * Design:
 *   - Web: everything here is a no-op (expo-task-manager / expo-location
 *     background APIs don't exist on web; the PWA can't run background tasks).
 *   - The task posts batched fixes over raw HTTP with the stored access token.
 *     It deliberately bypasses the `api` axios instance so no interceptor
 *     (refresh loop, toasts, connectivity marks) runs in a headless/background
 *     context where the UI layer isn't mounted.
 *   - While the app is in the FOREGROUND the foreground `locationStream`
 *     already owns delivery over the socket, so the task skips posting then
 *     (avoids duplicate fixes). In `background` / headless (`unknown`) it posts.
 */

import { AppState, Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import axios from 'axios';
import * as SecureStore from '../lib/storage';

export const BACKGROUND_LOCATION_TASK = 'iprime-rider-background-location';

const IS_NATIVE = Platform.OS !== 'web';
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:3000';

let _registered = false;

function registerTask() {
  if (!IS_NATIVE || _registered) return;
  _registered = true;
  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      console.warn('[backgroundLocation] task error:', error?.message || error);
      return;
    }
    const locations = data?.locations || [];
    if (locations.length === 0) return;

    // Foreground watcher owns delivery while the app is active.
    if (AppState?.currentState === 'active') return;

    const updates = locations
      .map((loc) => {
        if (!loc?.coords) return null;
        return {
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          capturedAt: new Date(loc.timestamp || Date.now()).toISOString(),
        };
      })
      .filter(Boolean);

    if (updates.length === 0) return;
    await postFixes(updates);
  });
}

async function postFixes(updates) {
  try {
    const token = await SecureStore.getItemAsync('accessToken');
    if (!token) return;
    await axios.post(
      `${BASE_URL}/rider/location`,
      { updates },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-device-platform': Platform.OS,
        },
        timeout: 10_000,
      },
    );
  } catch (_) {
    // Best-effort. The task re-fires on the next location tick, and the
    // server-side intent guarantee means a dropped batch never "takes the
    // rider offline" - worst case they're re-added on reconnect.
  }
}

/**
 * Ensure "Always / All the time" location access. On Android this may route
 * through the OS settings screen; on iOS it's the "Always" permission prompt.
 * Returns true only when full background access is granted.
 */
export async function ensureBackgroundPermission() {
  if (!IS_NATIVE) return false;
  try {
    let { status } = await Location.getBackgroundPermissionsAsync();
    if (status !== 'granted') {
      const res = await Location.requestBackgroundPermissionsAsync();
      status = res.status;
    }
    return status === 'granted';
  } catch (_) {
    return false;
  }
}

/**
 * Start the background location task. Called from goOnline. Gracefully
 * degrades to foreground-only when permission is denied (the server-side
 * guarantee still keeps the rider online, they're just only dispatchable
 * while the app is open). Never throws.
 */
export async function startBackgroundLocation() {
  if (!IS_NATIVE) return false;
  try {
    registerTask();
    const granted = await ensureBackgroundPermission();
    if (!granted) return false;

    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 15_000,
      distanceInterval: 25,
      // Android foreground-service notification - keeps the OS from killing
      // the process while the rider is minimised. Users can swipe this away;
      // the FGS keeps running regardless.
      foregroundService: {
        notificationTitle: 'iPrime Rider is online',
        notificationBody: 'Receiving jobs near you - keep this running while you work.',
        notificationColor: '#EA580C',
      },
      // iOS: keep updating even when the app is backgrounded (requires Always
      // permission, which ensureBackgroundPermission() just obtained).
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.AutomotiveNavigation,
    });
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Stop the background location task and its foreground service. Called from
 * goOffline (and auth teardown) so an offline rider isn't burning battery.
 */
export async function stopBackgroundLocation() {
  if (!IS_NATIVE) return;
  try {
    if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
  } catch (_) {}
  try {
    await TaskManager.unregisterTaskAsync(BACKGROUND_LOCATION_TASK);
  } catch (_) {}
}

export async function isBackgroundLocationRunning() {
  if (!IS_NATIVE) return false;
  try {
    return await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
  } catch (_) {
    return false;
  }
}

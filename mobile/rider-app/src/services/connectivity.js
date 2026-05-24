/**
 * Connectivity signal — single source of truth for the global offline banner.
 *
 * Phase 8 doesn't add `@react-native-community/netinfo` as a hard dep (the
 * rider app already streams location at high cadence; the socket service
 * is a more useful signal than raw NIC state, since "wifi up but server
 * unreachable" should still show the banner).
 *
 * Sources of "online?" truth:
 *   1. Socket connection state — primary. When authenticated, the socket
 *      reconnects automatically; a sustained disconnect is the strongest
 *      signal that something is wrong with the rider's connectivity.
 *   2. API call failures — secondary. When api.js gets a network-level
 *      failure (TypeError on fetch), it calls `markOffline()`. The next
 *      successful response flips back to `markOnline()`.
 *
 * Both signals converge on the same `_state` flag; the banner subscribes
 * via `subscribe(cb)` (returns an unsubscribe) and re-renders on change.
 * `getState()` returns the current snapshot for first paint.
 */

import socketService from "./socket";

const _state = { online: true };
const _listeners = new Set();

const emit = () => {
  for (const cb of _listeners) {
    try { cb(_state.online); } catch (_) { /* swallow listener crashes */ }
  }
};

/**
 * Subscribe to changes. Returns an unsubscribe function. The callback is
 * NOT fired with the current state on subscribe — call getState() first
 * if you want immediate render.
 */
export const subscribe = (cb) => {
  if (typeof cb !== "function") return () => {};
  _listeners.add(cb);
  return () => _listeners.delete(cb);
};

export const getState = () => _state.online;

/**
 * Imperative setters. Idempotent — only emits when state changes. Called
 * by the api interceptor on network errors / first 2xx, and by the socket
 * subscriber below on connect/disconnect.
 */
export const markOffline = (reason = "unknown") => {
  if (!_state.online) return;
  _state.online = false;
  _state.lastReason = reason;
  _state.changedAt = Date.now();
  emit();
};

export const markOnline = () => {
  if (_state.online) return;
  _state.online = true;
  _state.changedAt = Date.now();
  emit();
};

// Socket subscription. Lives outside the React tree so the connectivity
// signal is correct on first paint even before any component mounts.
// Skip in test envs where socketService might be a partial mock.
//
// socket.js emits boolean true/false on `connectionStateChange` — accept
// either booleans or the legacy string form ("connected"/"disconnected")
// so a future emitter change doesn't silently break the banner again.
if (socketService && typeof socketService.onConnectionStateChange === "function") {
  socketService.onConnectionStateChange((state) => {
    const isConnected = state === true || state === "connected";
    const isDisconnected = state === false || state === "disconnected";
    if (isConnected) markOnline();
    else if (isDisconnected) markOffline("socket-disconnected");
  });
}

/**
 * Lightweight React hook so screens / the banner can subscribe without
 * touching the listener set themselves. Returns the current online flag
 * + a `changedAt` timestamp so consumers can show "Reconnected just now"
 * style hints.
 */
import { useEffect, useState } from "react";
export const useConnectivity = () => {
  const [online, setOnline] = useState(_state.online);
  useEffect(() => subscribe(setOnline), []);
  return online;
};

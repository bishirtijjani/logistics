/**
 * Web Push registration (PWA only). Native uses FCM via registerPushToken().
 *
 * Subscribes the browser's ServiceWorker PushManager using the backend's VAPID
 * public key (GET /push/public-key) and persists the subscription
 * (POST /push/subscribe). Called from notifications.registerPushToken on web,
 * which is itself invoked from authSlice on login/refresh - so no UI change.
 *
 * Imported dynamically (so this web-only module never loads in the native
 * bundle); every browser-API access is feature-detected and failure-tolerant.
 */
import api from "./api";

// VAPID keys are base64url; the PushManager wants a Uint8Array.
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i);
  return arr;
}

export async function registerWebPush() {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || typeof Notification === "undefined") {
    return null;
  }

  // Permission must be granted to hold a push subscription.
  let permission = Notification.permission;
  if (permission === "default") permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const registration = await navigator.serviceWorker.ready;

  // VAPID public key from the backend. api returns the parsed envelope body.
  let publicKey = null;
  try {
    const body = await api.get("/push/public-key");
    publicKey = body?.data?.publicKey || body?.publicKey || null;
  } catch (_) {
    return null;
  }
  if (!publicKey) return null;

  // Reuse an existing subscription, else create one.
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  // Persist (auth header attached by the api request interceptor).
  try {
    const json = subscription.toJSON();
    await api.post("/push/subscribe", {
      endpoint: json.endpoint,
      keys: json.keys, // { p256dh, auth }
      userAgent: navigator.userAgent,
    });
  } catch (_) {
    return null;
  }
  return subscription;
}

/** Tear down the browser subscription (e.g. on logout). Best-effort. */
export async function unregisterWebPush() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    const { endpoint } = subscription.toJSON();
    await api.post("/push/unsubscribe", { endpoint }).catch(() => {});
    await subscription.unsubscribe().catch(() => {});
  } catch (_) {}
}

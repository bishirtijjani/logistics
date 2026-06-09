/**
 * pendingIntent - carries an "order intent" from the marketing site's hero into
 * the app, surviving the sign-in flow.
 *
 * The website (iprime.ng) renders Glovo-style category cards that link here as
 * `https://app.iprime.ng/?intent=food`. We read that `intent` on entry, map it
 * to a navigation action, and replay it once the user is authenticated and past
 * the biometric gate (see AppNavigator). A logged-out visitor therefore lands
 * exactly where they tapped - "just works after auth".
 *
 * This is the SAME app whether opened on the web or as a native iOS/Android
 * binary. On a normal native cold open there is no `?intent=` in the entry URL,
 * so every function here no-ops and the standalone flows are untouched.
 *
 * Persistence is fire-and-forget to AsyncStorage so a hard browser reload mid
 * login (which can drop the query string) still resumes. In-memory is the fast
 * path; the SPA login flip keeps the value without ever touching storage.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "iprime.pendingIntent";

// Intent slug → navigation action. Mirrors the in-app Home tile handlers
// (screens/main/HomeScreen.js): category tiles open MerchantBrowse by slug,
// Shops opens the aggregator, Package starts a courier request, and the VTU
// tile lands on Airtime. categoryName is cosmetic (header title only) - the
// slug drives the merchant query, so a missing lat/lng is fine here
// (MerchantBrowse reads `route.params || {}` and falls back to store location).
const INTENT_TO_ACTION = {
  food: { name: "MerchantBrowse", params: { categorySlug: "restaurant", categoryName: "Food" } },
  grocery: { name: "MerchantBrowse", params: { categorySlug: "grocery", categoryName: "Groceries" } },
  pharmacy: { name: "MerchantBrowse", params: { categorySlug: "pharmacy", categoryName: "Pharmacy" } },
  shops: { name: "Shops" },
  package: { name: "CreateRequest", params: { requestType: "PACKAGE", hasMerchant: false } },
  bills: { name: "Airtime" },
};

let memoryIntent = null;

/** Map a raw intent slug to a `{ name, params }` action, or null if unknown. */
export function actionForIntent(intent) {
  if (!intent) return null;
  return INTENT_TO_ACTION[String(intent).toLowerCase()] || null;
}

/**
 * Extract the `intent` query param from an entry URL. Parses the query manually
 * rather than via the URL constructor so custom schemes (`iprime://...`) that
 * the RN URL polyfill mishandles still work.
 */
export function parseIntentFromUrl(url) {
  if (!url || typeof url !== "string") return null;
  const qIndex = url.indexOf("?");
  if (qIndex === -1) return null;
  try {
    const params = new URLSearchParams(url.slice(qIndex + 1));
    const intent = params.get("intent");
    // Only keep intents we actually know how to handle, so a stray/forged param
    // can't leave a dangling pending action that hijacks a later navigation.
    return intent && INTENT_TO_ACTION[intent.toLowerCase()] ? intent.toLowerCase() : null;
  } catch (_) {
    return null;
  }
}

export function setPendingIntent(intent) {
  memoryIntent = intent || null;
  try {
    if (intent) AsyncStorage.setItem(STORAGE_KEY, intent).catch(() => {});
    else AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  } catch (_) {}
}

export function getPendingIntent() {
  return memoryIntent;
}

/** Restore a persisted intent into memory if none is set (hard-reload recovery). */
export async function hydratePendingIntent() {
  if (memoryIntent) return memoryIntent;
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored && INTENT_TO_ACTION[stored.toLowerCase()]) memoryIntent = stored.toLowerCase();
  } catch (_) {}
  return memoryIntent;
}

export function clearPendingIntent() {
  memoryIntent = null;
  try {
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  } catch (_) {}
}
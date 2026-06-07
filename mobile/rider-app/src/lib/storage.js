/**
 * Cross-platform key/value storage.
 *
 * Native (iOS/Android): delegates 1:1 to expo-secure-store — the encrypted
 * keychain/keystore, byte-for-byte identical to the app's original behavior.
 * Web: falls back to window.localStorage, because expo-secure-store has no web
 * implementation (its web build exports an empty module, so calling its methods
 * on web would throw). Tokens on web are therefore NOT hardware-encrypted —
 * acceptable for the PWA build, where the browser sandbox is the trust boundary.
 *
 * Exposes the SAME async surface as expo-secure-store so callers swap only their
 * import line and leave every `SecureStore.xxx(...)` call site untouched:
 *   - import * as SecureStore from 'expo-secure-store';
 *   + import * as SecureStore from '<relative-path>/lib/storage';
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const isWeb = Platform.OS === 'web';

export async function getItemAsync(key, options) {
  if (isWeb) {
    try {
      return window.localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  }
  // Native path — identical to a direct SecureStore.getItemAsync call.
  return SecureStore.getItemAsync(key, options);
}

export async function setItemAsync(key, value, options) {
  if (isWeb) {
    try {
      window.localStorage.setItem(key, value);
    } catch (_) {}
    return;
  }
  return SecureStore.setItemAsync(key, value, options);
}

export async function deleteItemAsync(key, options) {
  if (isWeb) {
    try {
      window.localStorage.removeItem(key);
    } catch (_) {}
    return;
  }
  return SecureStore.deleteItemAsync(key, options);
}

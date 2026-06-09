/**
 * Recent search history - small, non-sensitive, on-device only.
 *
 * Backed by AsyncStorage (NOT lib/storage.js, which is the encrypted SecureStore
 * keychain meant for auth tokens). AsyncStorage is the right home for throwaway
 * UX state and works identically on iOS/Android and on web (where it falls back
 * to localStorage) - the same store cart/categories/location already use.
 *
 * Stored as a JSON string array, most-recent-first, de-duplicated
 * case-insensitively, capped at MAX_RECENT.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'recentSearches.v1';
const MAX_RECENT = 8;

export async function getRecentSearches() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((s) => typeof s === 'string') : [];
  } catch (_) {
    return [];
  }
}

/**
 * Push a query to the front, drop any prior case-insensitive duplicate, and
 * cap the list. Returns the new list so callers can update state without a
 * second read.
 */
export async function addRecentSearch(query) {
  const term = (query || '').trim();
  if (term.length < 2) return getRecentSearches();
  try {
    const current = await getRecentSearches();
    const deduped = current.filter((s) => s.toLowerCase() !== term.toLowerCase());
    const next = [term, ...deduped].slice(0, MAX_RECENT);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    return next;
  } catch (_) {
    return getRecentSearches();
  }
}

export async function removeRecentSearch(query) {
  try {
    const current = await getRecentSearches();
    const next = current.filter((s) => s.toLowerCase() !== (query || '').toLowerCase());
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    return next;
  } catch (_) {
    return getRecentSearches();
  }
}

export async function clearRecentSearches() {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch (_) {}
  return [];
}

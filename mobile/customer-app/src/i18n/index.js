/**
 * i18n bootstrap.
 *
 * On app start:
 *   1. Read the user's saved locale from SecureStore (key: `app.locale`).
 *   2. If absent, fall back to the device locale.
 *   3. If the device locale isn't a supported one, fall back to English.
 *
 * Callers consume strings via the `useT()` hook (see `./useT.js`) which is a
 * thin wrapper over `react-i18next`'s `useTranslation` so the rest of the app
 * imports a single helper and the underlying library can be swapped later
 * without sweeping every screen.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import * as SecureStore from '../lib/storage';

import en from './en.json';
import ha from './ha.json';

export const SUPPORTED_LOCALES = ['en', 'ha'];
export const DEFAULT_LOCALE = 'en';
export const LOCALE_STORAGE_KEY = 'app.locale';

/**
 * Sniff a saved locale → device locale → 'en'. Synchronous-friendly: we let
 * i18next start with the device locale immediately so first paint isn't
 * blocked on SecureStore, then hydrate the saved choice asynchronously.
 */
const detectDeviceLocale = () => {
  // `getLocales()` returns the user's locale preference list. We use the
  // first entry's `languageCode` (e.g. "en", "ha") so we don't have to deal
  // with regional variants like "en-NG".
  try {
    const locales = Localization.getLocales();
    const code = locales?.[0]?.languageCode;
    if (code && SUPPORTED_LOCALES.includes(code)) return code;
  } catch (_) {
    // Localization API can throw in test envs - fall through to default.
  }
  return DEFAULT_LOCALE;
};

const initialLocale = detectDeviceLocale();

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ha: { translation: ha },
    },
    lng: initialLocale,
    fallbackLng: DEFAULT_LOCALE,
    interpolation: {
      // React already escapes - turning off prevents double-escaped curly
      // braces showing up as `&#x7B;` etc.
      escapeValue: false,
    },
    returnNull: false,
    returnEmptyString: false,
    // Keep keys quietly missing in the catalog; the consuming hook below
    // handles the fallback to server-supplied `message` for error codes.
    saveMissing: false,
    compatibilityJSON: 'v4',
  });

// Hydrate the persisted choice after init so first paint isn't blocked.
// If the user has changed locale before, this corrects it within a frame.
(async () => {
  try {
    const stored = await SecureStore.getItemAsync(LOCALE_STORAGE_KEY);
    if (stored && SUPPORTED_LOCALES.includes(stored) && stored !== i18n.language) {
      await i18n.changeLanguage(stored);
    }
  } catch (_) {
    // SecureStore can fail on emulators without a keychain - non-fatal.
  }
})();

/**
 * Persist + apply a new locale. Use from the Settings screen toggle.
 */
export const setLocale = async (locale) => {
  if (!SUPPORTED_LOCALES.includes(locale)) return false;
  try {
    await SecureStore.setItemAsync(LOCALE_STORAGE_KEY, locale);
  } catch (_) {
    // Non-fatal: language still changes for the current session.
  }
  await i18n.changeLanguage(locale);
  return true;
};

/**
 * Current locale, for screens that need the raw code (rare - most should
 * use `useT()` instead).
 */
export const getLocale = () => i18n.language || DEFAULT_LOCALE;

export default i18n;

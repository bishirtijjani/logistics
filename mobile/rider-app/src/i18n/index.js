/**
 * i18n bootstrap.
 *
 * On app start:
 *   1. Read the user's saved locale from SecureStore (key: `app.locale`).
 *   2. If absent, fall back to the device locale.
 *   3. If the device locale isn't a supported one, fall back to English.
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

const detectDeviceLocale = () => {
  try {
    const locales = Localization.getLocales();
    const code = locales?.[0]?.languageCode;
    if (code && SUPPORTED_LOCALES.includes(code)) return code;
  } catch (_) {
    // Localization API can throw in test envs — fall through to default.
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
      escapeValue: false,
    },
    returnNull: false,
    returnEmptyString: false,
    saveMissing: false,
    compatibilityJSON: 'v4',
  });

(async () => {
  try {
    const stored = await SecureStore.getItemAsync(LOCALE_STORAGE_KEY);
    if (stored && SUPPORTED_LOCALES.includes(stored) && stored !== i18n.language) {
      await i18n.changeLanguage(stored);
    }
  } catch (_) {
    // SecureStore can fail on emulators without a keychain — non-fatal.
  }
})();

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

export const getLocale = () => i18n.language || DEFAULT_LOCALE;

export default i18n;

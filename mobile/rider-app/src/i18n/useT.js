/**
 * `useT` — the single hook every screen imports for localized strings.
 *
 * Wraps `react-i18next`'s `useTranslation` and adds:
 *   - `tError(err)` — maps a server error `{ code, message }` to its localized
 *     copy under `errors.<CODE>`, falling back to the server `message` when no
 *     translation exists.
 */

import { useTranslation } from 'react-i18next';

export const useT = () => {
  const { t, i18n } = useTranslation();

  const tError = (err) => {
    if (!err) return t('errors.UNKNOWN_ERROR');
    if (typeof err === 'string') return err;

    const code =
      err.code ||
      err.data?.code ||
      err.payload?.code ||
      err.response?.data?.code;
    const fallback =
      err.message ||
      err.data?.message ||
      err.payload?.message ||
      err.response?.data?.message ||
      t('errors.UNKNOWN_ERROR');

    if (!code) return fallback;
    const key = `errors.${code}`;
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  return { t, i18n, tError };
};

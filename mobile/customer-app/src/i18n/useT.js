/**
 * `useT` - the single hook every screen imports for localized strings.
 *
 * Wraps `react-i18next`'s `useTranslation` and adds:
 *   - `tError(err)` - maps a server error `{ code, message }` to its
 *     localized copy under `errors.<CODE>`, falling back to the server
 *     `message` when no translation exists. Keeps screens free from
 *     `errors.X` lookup boilerplate.
 *
 * Usage:
 *   const { t, tError } = useT();
 *   <Text>{t('home.greeting', { name: user.firstName })}</Text>
 *   Toast.show({ text1: tError(err) });
 */

import { useTranslation } from 'react-i18next';

export const useT = () => {
  const { t, i18n } = useTranslation();

  /**
   * Resolve a server error to a localized message.
   * Accepts either a thrown Error with `code`/`data.code` attached
   * (the shape `services/api` decorates rejections with) or a raw
   * `{ code, message }` payload.
   */
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
    // i18next returns the key itself if the path is missing; detect that
    // and fall back to the server-supplied English message.
    const key = `errors.${code}`;
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  return { t, i18n, tError };
};

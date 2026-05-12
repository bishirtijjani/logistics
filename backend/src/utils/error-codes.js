/**
 * Canonical catalog of error codes the API can emit.
 *
 * Used as:
 *   - Reference for backend throw sites (so codes stay consistent across modules).
 *   - Source of truth for the mobile i18n files — every code here must have a
 *     matching key under `errors.<CODE>` in `mobile/customer-app/src/i18n/en.json`
 *     (and `ha.json`).
 *
 * If you add a new code: add it here, throw with it, and add the translation.
 * If a code is missing on the client, the mobile layer falls back to the
 * server-supplied English `message` — so this catalog is documentation,
 * not enforcement.
 */

const ERROR_CODES = Object.freeze({
  // ── Auth ──────────────────────────────────────────────────────────────
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  PHONE_TAKEN: 'PHONE_TAKEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  INCORRECT_PASSWORD: 'INCORRECT_PASSWORD',
  PASSWORD_REQUIRED: 'PASSWORD_REQUIRED',
  ACCOUNT_NOT_FOUND: 'ACCOUNT_NOT_FOUND',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  ACCOUNT_DEACTIVATED: 'ACCOUNT_DEACTIVATED',
  OTP_EXPIRED: 'OTP_EXPIRED',
  INVALID_OTP: 'INVALID_OTP',
  REFRESH_TOKEN_INVALID: 'REFRESH_TOKEN_INVALID',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  PIN_NOT_SET: 'PIN_NOT_SET',
  PIN_ALREADY_SET: 'PIN_ALREADY_SET',
  INVALID_PIN: 'INVALID_PIN',
  KYC_INCOMPLETE: 'KYC_INCOMPLETE',
  BVN_ALREADY_VERIFIED: 'BVN_ALREADY_VERIFIED',
  BVN_MISMATCH: 'BVN_MISMATCH',

  // ── Wallet / money path ───────────────────────────────────────────────
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  DUPLICATE_TRANSACTION: 'DUPLICATE_TRANSACTION',
  RECIPIENT_NOT_FOUND: 'RECIPIENT_NOT_FOUND',
  TRANSFER_TO_SELF: 'TRANSFER_TO_SELF',
  AMOUNT_TOO_LOW: 'AMOUNT_TOO_LOW',
  AMOUNT_TOO_HIGH: 'AMOUNT_TOO_HIGH',

  // ── Request / order lifecycle ────────────────────────────────────────
  QUOTE_EXPIRED: 'QUOTE_EXPIRED',
  QUOTE_INVALID: 'QUOTE_INVALID',
  QUOTE_MISMATCH: 'QUOTE_MISMATCH',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  REQUEST_NOT_FOUND: 'REQUEST_NOT_FOUND',
  ALREADY_RATED: 'ALREADY_RATED',
  PRESCRIPTION_REQUIRED: 'PRESCRIPTION_REQUIRED',
  INVALID_PRESCRIPTION_URL: 'INVALID_PRESCRIPTION_URL',

  // ── Validation / generic ──────────────────────────────────────────────
  VALIDATION_FAILED: 'VALIDATION_FAILED',

  // ── Client-side synthesized (never emitted by the server) ─────────────
  // The mobile client tags axios network failures with this code so the
  // localized message lookup works uniformly with server errors. Listed
  // here so the i18n catalog has documentation about why the key exists.
  NETWORK_ERROR: 'NETWORK_ERROR',

  // ── Default fallbacks (auto-emitted from status) ──────────────────────
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
});

module.exports = { ERROR_CODES };

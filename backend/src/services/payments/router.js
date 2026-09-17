/**
 * Payment provider router.
 *
 * The platform moves money through one of two interchangeable adapters that
 * share one interface (funding: virtual NUBANs, checkout top-ups, webhooks;
 * payouts: bank disbursements):
 *
 *   - KATPAY    - the incumbent provider (KatPay virtual accounts + payouts).
 *   - PAYSTACK  - the alternate provider (Paystack Dedicated Virtual Accounts
 *                 for funding, balance transfers for payouts).
 *
 * Admin picks a single global mode (PlatformSetting `payments.providerMode`):
 *
 *   KATPAY   - legacy behaviour; every funding/payout path goes through KatPay.
 *   PAYSTACK - every path goes through Paystack.
 *
 * There is intentionally NO BOTH mode: payment rails must have exactly one
 * active provider so the wallet ledger never splits a user's funding between
 * two providers (the DVA/NUBAN a user's wallet displays is minted by ONE
 * provider; checkout references, payout route codes and reconcile sweeps must
 * match that same provider).
 *
 * WEBHOOKS ARE MODE-INDEPENDENT: both `/webhooks/katpay` and
 * `/webhooks/paystack` stay registered no matter the mode, because existing
 * users keep their KatPay-only virtual accounts even after a switch (see
 * provisioning policy) and in-flight transfers must settle wherever they were
 * created. The mode only picks the provider for NEW funding/payout operations.
 *
 * Default mode is KATPAY, so an unset setting is a transparent pass-through to
 * the incumbent behaviour. Flipping the mode to PAYSTACK is the whole switch -
 * there is no code change involved.
 */
const settingsService = require('./../../services/settings.service');

// Lazy-loaded so the router resolves modes even while a provider adapter is
// being worked on. Adapters are plain modules with side-effect-free requires.
const ADAPTERS = {
  KATPAY: () => require('../katpay.service'),
  PAYSTACK: () => require('../paystack.service'),
};

const MODES = {
  KATPAY: 'KATPAY',
  PAYSTACK: 'PAYSTACK',
};

const SETTING_KEY = 'payments.providerMode';
const DEFAULT_MODE = MODES.KATPAY;
const VALID_MODES = Object.values(MODES);

/**
 * Current provider mode, always a valid one (invalid/unknown persisted values
 * fall back to the default so a typo can never strand the platform).
 */
const getMode = async () => {
  const mode = await settingsService.getSetting(SETTING_KEY, DEFAULT_MODE);
  return VALID_MODES.includes(mode) ? mode : DEFAULT_MODE;
};

/**
 * Resolve the active gateway: `{ mode, provider }` where `provider` is the
 * adapter key that owns NEW funding and payout operations right now.
 */
const resolveGateway = async () => {
  const mode = await getMode();
  return { mode, provider: mode };
};

/** Is `provider` the currently active gateway? (Webhooks ignore this check.) */
const isActive = async (provider) => {
  const { mode } = await resolveGateway();
  return mode === provider;
};

/**
 * Get the adapter module for a provider key. Throws if the key is unknown so
 * callers never silently fall back to a provider they didn't ask for.
 */
const getAdapter = (providerKey) => {
  const loader = ADAPTERS[providerKey];
  if (!loader) {
    throw new Error(`Unknown payment provider: ${String(providerKey)}`);
  }
  return loader();
};

/** Adapter for the currently active provider (NEW operations). */
const getActiveAdapter = async () => {
  const { provider } = await resolveGateway();
  return getAdapter(provider);
};

/**
 * Attach provider provenance to a thrown error and normalise the message the
 * client sees. Callers (webhooks, payment worker) use `err.provider` to decide
 * which reconcile/refund rules apply - providers disagree on what a "failed"
 * webhook means, so every error that crosses an adapter boundary should carry
 * this tag.
 */
const annotateError = (err, providerKey) => {
  if (err && !err.provider) {
    try {
      err.provider = providerKey;
    } catch (_) {}
  }
  return err;
};

module.exports = {
  MODES,
  SETTING_KEY,
  DEFAULT_MODE,
  VALID_MODES,
  getMode,
  resolveGateway,
  isActive,
  getAdapter,
  getActiveAdapter,
  annotateError,
};
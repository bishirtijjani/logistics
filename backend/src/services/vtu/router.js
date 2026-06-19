/**
 * VTU provider router.
 *
 * The platform talks to up to two interchangeable VTU adapters that share one
 * interface (buy*, validate*, queryTransaction, isSuccess/isPending/isFailure):
 *
 *   - BilalSadaSub  (synchronous)  - the primary.
 *   - AlRahuz Data  (asynchronous) - the secondary / failover target.
 *
 * Admin picks a single global mode (PlatformSetting `vtu.providerMode`):
 *
 *   BILALSADASUB_ONLY  - only BilalSada; a failed purchase is refunded (legacy).
 *   ALRAHUZ_ONLY       - only AlRahuz.
 *   BOTH               - BilalSada primary, AlRahuz secondary. A purchase that
 *                        would otherwise be refunded is re-attempted on AlRahuz
 *                        first so we don't lose the sale.
 *
 * Each provider has its own numeric network/plan IDs. The catalogue stores the
 * BilalSada IDs in providerNetworkId/providerPlanId and the AlRahuz IDs in
 * altProviderNetworkId/altProviderPlanId, so a single plan/network row can be
 * vended through either provider.
 */

const settingsService = require('./../settings.service');

const PROVIDERS = {
  BILALSADASUB: require('../bilalsada.service'),
  ALRAHUZ: require('../alrahuz.service'),
};

const MODES = {
  BILALSADASUB_ONLY: 'BILALSADASUB_ONLY',
  ALRAHUZ_ONLY: 'ALRAHUZ_ONLY',
  BOTH: 'BOTH',
};

const SETTING_KEY = 'vtu.providerMode';
const DEFAULT_MODE = MODES.BILALSADASUB_ONLY;

const getAdapter = (providerKey) => PROVIDERS[providerKey] || null;

const getMode = async () => {
  const mode = await settingsService.getSetting(SETTING_KEY, DEFAULT_MODE);
  return MODES[mode] ? mode : DEFAULT_MODE;
};

/**
 * Resolve the active primary + secondary provider keys for the current mode.
 * `secondary` is null unless mode is BOTH.
 */
const resolveProviders = async () => {
  const mode = await getMode();
  switch (mode) {
    case MODES.ALRAHUZ_ONLY:
      return { mode, primary: 'ALRAHUZ', secondary: null };
    case MODES.BOTH:
      return { mode, primary: 'BILALSADASUB', secondary: 'ALRAHUZ' };
    case MODES.BILALSADASUB_ONLY:
    default:
      return { mode, primary: 'BILALSADASUB', secondary: null };
  }
};

/** Adapter for the configured primary - used for read-only calls (validate*). */
const getPrimaryAdapter = async () => {
  const { primary } = await resolveProviders();
  return getAdapter(primary);
};

module.exports = {
  PROVIDERS,
  MODES,
  SETTING_KEY,
  DEFAULT_MODE,
  getAdapter,
  getMode,
  resolveProviders,
  getPrimaryAdapter,
};

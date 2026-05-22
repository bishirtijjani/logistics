/**
 * Analytics helper for the rider app.
 *
 * `track(event, props)` is the single entry point for every analytics
 * event. Like the Sentry wrapper, this ships as a no-op stub until an
 * analytics provider (Mixpanel / PostHog / Amplitude) is wired in. The
 * call sites stay the same when that happens.
 *
 * Why a stub instead of a provider-specific helper:
 *   - The choice of analytics platform is a v1 launch decision and can
 *     change post-launch. Keeping the call sites neutral makes the swap
 *     a one-file change.
 *   - In dev builds, track() logs to the console so engineers can verify
 *     events fire at the right moments without setting up a backend.
 *   - In production stub mode, track() costs nothing — the body short-
 *     circuits before any work.
 *
 * Event catalog: see EVENTS below. Every event name lives there as a
 * constant so misspellings fail at lint time, not at the dashboard.
 */

const _initialised = { value: false };
const _userProps = { id: null, role: null };

/**
 * Event catalog. Every analytics event MUST be referenced from here so
 * names stay consistent and the catalog is the authoritative list.
 *
 * Naming convention:
 *   - PascalCase with dot-separated namespace
 *   - Past-tense ("Accepted", "Delivered", "FailedTo…")
 *
 * Property conventions (every event):
 *   - `userId`     — string (set automatically by `setUser`)
 *   - `requestId`  — string when the event scopes to a trip
 *   - `errorCode`  — string when the event is a failure
 */
export const EVENTS = {
  // ── Lifecycle ────────────────────────────────────────────────────────
  AppOpened:           'App.Opened',
  AppForegrounded:     'App.Foregrounded',
  // ── Auth ─────────────────────────────────────────────────────────────
  LoginSucceeded:      'Auth.LoginSucceeded',
  LoginFailed:         'Auth.LoginFailed',
  LogoutTapped:        'Auth.LogoutTapped',
  BiometricEnabled:    'Auth.BiometricEnabled',
  BiometricDisabled:   'Auth.BiometricDisabled',
  // ── Availability ─────────────────────────────────────────────────────
  WentOnline:          'Availability.WentOnline',
  WentOffline:         'Availability.WentOffline',
  ForceOfflineReceived:'Availability.ForceOffline',
  // ── Offers ───────────────────────────────────────────────────────────
  OfferReceived:       'Offer.Received',
  OfferAccepted:       'Offer.Accepted',
  OfferDeclined:       'Offer.Declined',
  OfferExpired:        'Offer.Expired',
  OfferRaceLost:       'Offer.RaceLost',
  // ── Trip lifecycle ───────────────────────────────────────────────────
  StatusPatched:       'Trip.StatusPatched',
  TripCancelled:       'Trip.Cancelled',
  AddressCorrected:    'Trip.AddressCorrected',
  CounterpartCalled:   'Trip.CounterpartCalled',
  ChatMessageSent:     'Trip.ChatMessageSent',
  // ── POD ──────────────────────────────────────────────────────────────
  PodPhotoCaptured:    'Pod.PhotoCaptured',
  PodSignatureCaptured:'Pod.SignatureCaptured',
  PodOtpVerified:      'Pod.OtpVerified',
  PodOtpMismatch:      'Pod.OtpMismatch',
  DeliveryCompleted:   'Trip.DeliveryCompleted',
  // ── Wallet / earnings ────────────────────────────────────────────────
  WithdrawInitiated:   'Wallet.WithdrawInitiated',
  WithdrawSucceeded:   'Wallet.WithdrawSucceeded',
  WithdrawFailed:      'Wallet.WithdrawFailed',
  BeneficiarySaved:    'Wallet.BeneficiarySaved',
  EarningCredited:     'Earnings.Credited',
  // ── Support ──────────────────────────────────────────────────────────
  TicketCreated:       'Support.TicketCreated',
  TicketClosed:        'Support.TicketClosed',
  DisputeCreated:      'Support.DisputeCreated',
  // ── KYC / docs ───────────────────────────────────────────────────────
  DocReuploaded:       'Kyc.DocReuploaded',
  DocExpiringSeen:     'Kyc.DocExpiringSeen',
  // ── Profile ──────────────────────────────────────────────────────────
  ProfileUpdated:      'Profile.Updated',
  LanguageChanged:     'Profile.LanguageChanged',
  ThemeChanged:        'Profile.ThemeChanged',
  AccountDeleted:      'Profile.AccountDeleted',
  // ── Errors (used by api.js / Sentry bridge for severity tagging) ─────
  ApiError:            'Error.ApiError',
  SocketDropped:       'Error.SocketDropped',
};

/**
 * Initialise the analytics provider. No-op in stub mode. Safe to call
 * once at App boot; subsequent calls short-circuit.
 */
export const initAnalytics = () => {
  if (_initialised.value) return false;
  _initialised.value = true;
  // Stub: nothing to initialize.
  return false;
};

/**
 * Tag the active user. Subsequent track() calls will include `userId`
 * and `role` in their props.
 */
export const setUser = (user) => {
  if (!user) {
    _userProps.id = null;
    _userProps.role = null;
    return;
  }
  _userProps.id = user.id || null;
  _userProps.role = user.role || null;
};

/**
 * Emit an analytics event. The event name MUST be a value from `EVENTS`.
 * In stub mode this logs to the console in dev so engineers can verify
 * events fire; in production it's a silent no-op.
 *
 * @param {string} event - one of EVENTS.*
 * @param {object} [props] - event-specific properties
 */
export const track = (event, props = {}) => {
  if (!event) return;
  const payload = {
    ...props,
    ...(_userProps.id && { userId: _userProps.id }),
    ...(_userProps.role && { role: _userProps.role }),
    ts: Date.now(),
  };
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log('[analytics]', event, payload);
  }
  // Real impl pattern (PostHog example):
  //   if (_initialised.value && _client) _client.capture(event, payload);
};

/**
 * Convenience wrapper to track an error. Always sends with severity hint
 * so the analytics dashboard can break out failures separately.
 */
export const trackError = (event, error, extra = {}) => {
  track(event, {
    ...extra,
    errorCode: error?.code || null,
    errorMessage: error?.message || String(error || ''),
    severity: 'error',
  });
};

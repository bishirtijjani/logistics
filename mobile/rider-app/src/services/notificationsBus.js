/**
 * Bridges the socket → Redux store. Subscribed once at the AppNavigator level
 * when the user is authenticated.
 *
 * Wiring:
 *   - `notification:new`                   → notificationsSlice.notificationReceived(...)
 *   - `notification:new` (SYSTEM_FORCE_OFFLINE) → riderSlice.goOffline({ reason: 'force-offline' })
 *   - `rider:job:new`                      → offersSlice.offerEnqueued(payload)
 *   - `rider:job:taken`                    → offersSlice.offerTaken({ requestId })
 *   - `rider:job:confirmed`                → diagnostic only.
 *   - `request:status:changed`             → tripSlice.tripStatusReceivedFromSocket(...)
 *   - `request:cancelled`                  → tripSlice.tripCancelledFromSocket(...)
 *   - `request:completed`                  → tripSlice.tripStatusReceivedFromSocket(SETTLED)
 *   - `request:message:new`                → tripSlice.tripMessageReceived(...)
 *
 * Returns an unsubscribe function. Calling the bridge again replaces the
 * previous subscriptions (idempotent on auth-state changes).
 */

import socketService from "./socket";
import { goOffline, fetchRiderProfile, reconcileFromServer } from "../store/slices/riderSlice";
import { offerEnqueued, offerTaken } from "../store/slices/offersSlice";
import {
  tripStatusReceivedFromSocket,
  tripCancelledFromSocket,
  tripMessageReceived,
} from "../store/slices/tripSlice";
import { socketBalanceUpdated, socketFundingReceived } from "../store/slices/walletSlice";
import { earningCreditedFromSocket } from "../store/slices/earningsSlice";
import { fetchProfile } from "../store/slices/profileSlice";

const SYSTEM_FORCE_OFFLINE = "SYSTEM_FORCE_OFFLINE";

// Notification types that should trigger a refresh of the rider profile so the
// onboarding stage (useOnboardingStage → OnboardingHero / Me-tab KYC row) and
// the SUSPENDED wall update immediately on the rider's screen rather than
// waiting for a re-launch.
const PROFILE_REFRESH_TYPES = new Set([
  "RIDER_APPROVED",
  "RIDER_REJECTED",
  "RIDER_SUSPENDED",
  "RIDER_REACTIVATED",
]);

let lastUnsubscribers = [];

export const subscribeSocketToStore = (dispatch, { notificationReceived }) => {
  for (const u of lastUnsubscribers) {
    try { u(); } catch (_) {}
  }
  lastUnsubscribers = [];

  // Re-assert rider presence on socket RECONNECT. The app already reconciles on
  // AppState foreground (AppNavigator), but a socket that drops and auto-
  // reconnects while the app stays foregrounded - a network blip, or a ping
  // timeout when the web PWA tab backgrounds - never re-asserted "online". The
  // server, having cleared the rider's heartbeat on that disconnect, then left
  // them OFFLINE until they manually re-tapped Go Online (the recurring rider
  // complaint). Firing reconcileFromServer on reconnect closes that gap. It is
  // intent-gated: reconcileFromServer only re-emits ONLINE when local
  // availability is ONLINE, so a rider who deliberately went offline stays
  // offline. The very first connect is skipped - cold start is handled by the
  // normal bootstrap - so this only reacts to genuine reconnects.
  let socketHasConnected = false;
  lastUnsubscribers.push(
    socketService.onConnectionStateChange((state) => {
      const connected = state === true || state === "connected";
      if (!connected) return;
      if (!socketHasConnected) {
        socketHasConnected = true;
        return;
      }
      dispatch(reconcileFromServer()).catch?.(() => {});
    }),
  );

  // notification:new - generic notifications + the force-offline kill switch
  // + Phase 7 rider lifecycle events that need to refresh the profile gate.
  lastUnsubscribers.push(
    socketService.onNotificationNew((data) => {
      if (!data) return;
      if (notificationReceived) dispatch(notificationReceived(data));
      const type = data?.type || data?.data?.type;
      if (type === SYSTEM_FORCE_OFFLINE) {
        dispatch(goOffline({ reason: "force-offline" }));
      } else if (PROFILE_REFRESH_TYPES.has(type)) {
        // Rider status changed server-side (approved / rejected / suspended).
        // Refresh both rider + user profile so the navigation gate flips.
        dispatch(fetchRiderProfile()).catch?.(() => {});
        dispatch(fetchProfile()).catch?.(() => {});
      }
    }),
  );

  // rider:job:new - new offer arriving from the dispatcher.
  lastUnsubscribers.push(
    socketService.onRiderJobNew((data) => {
      if (!data?.requestId) return;
      dispatch(offerEnqueued(data));
    }),
  );

  // rider:job:taken - another rider won (or the current rider's earlier
  // accept resolved on a different connection).
  lastUnsubscribers.push(
    socketService.onRiderJobTaken((data) => {
      if (!data?.requestId) return;
      dispatch(offerTaken({ requestId: data.requestId }));
    }),
  );

  // rider:job:confirmed - server confirmation that this rider won the race.
  lastUnsubscribers.push(
    socketService.onRiderJobConfirmed((data) => {
      if (data?.requestId && __DEV__) {
        console.log("[notificationsBus] job confirmed:", data.requestId);
      }
    }),
  );

  // ── Trip lifecycle ─────────────────────────────────────────────────────
  // request:status:changed - server-pushed FSM transitions.
  lastUnsubscribers.push(
    socketService.onRequestStatusChanged((data) => {
      if (!data?.requestId || !data?.status) return;
      dispatch(tripStatusReceivedFromSocket(data));
    }),
  );

  // request:cancelled - admin force-cancel, customer pre-pickup cancel, etc.
  lastUnsubscribers.push(
    socketService.onRequestCancelled((data) => {
      if (!data?.requestId) return;
      dispatch(tripCancelledFromSocket(data));
    }),
  );

  // request:completed - server signals SETTLED. The status reducer treats
  // this as a status-changed event so the cockpit flips to the "Delivered"
  // confirmation card.
  lastUnsubscribers.push(
    socketService.onRequestCompleted((data) => {
      if (!data?.requestId) return;
      dispatch(tripStatusReceivedFromSocket({
        requestId: data.requestId,
        status: data.status || "SETTLED",
      }));
    }),
  );

  // request:message:new - chat updates for the active trip.
  lastUnsubscribers.push(
    socketService.onRequestMessageNew((data) => {
      if (!data?.requestId || !data?.message) return;
      dispatch(tripMessageReceived(data));
    }),
  );

  // ── Phase 6 - wallet + earnings real-time. ────────────────────────────
  // The settlement worker emits `wallet:balance:updated` with the credited
  // transaction; we pipe that into BOTH walletSlice (for balance + recent
  // tx list) AND earningsSlice (for dashboard tallies + chart). Funding
  // events only go to walletSlice.
  lastUnsubscribers.push(
    socketService.onWalletBalanceUpdated((data) => {
      if (!data) return;
      dispatch(socketBalanceUpdated(data));
      const tx = data.transaction;
      if (tx && tx.type === "RIDER_EARNING") {
        dispatch(earningCreditedFromSocket(tx));
      }
    }),
  );
  lastUnsubscribers.push(
    socketService.onWalletFundingReceived((data) => {
      if (!data) return;
      dispatch(socketFundingReceived(data));
    }),
  );

  return () => {
    for (const u of lastUnsubscribers) {
      try { u(); } catch (_) {}
    }
    lastUnsubscribers = [];
  };
};

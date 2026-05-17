/**
 * Bridges the socket → Redux store. Subscribed once at the AppNavigator level
 * when the user is authenticated.
 *
 * Wiring:
 *   - `notification:new` → notificationsSlice.notificationReceived(...)
 *   - `notification:new` with `data.type === 'SYSTEM_FORCE_OFFLINE'` →
 *     riderSlice.goOffline({ reason: 'force-offline' })
 *   - `rider:job:new` → offersSlice.offerEnqueued(payload)
 *   - `rider:job:taken` → offersSlice.offerTaken({ requestId })
 *   - `rider:job:confirmed` → diagnostic only; the HTTP accept response is
 *     the canonical activation path. Logged for observability.
 *
 * Returns an unsubscribe function. Calling the bridge again replaces the
 * previous subscriptions (idempotent on auth-state changes).
 */

import socketService from "./socket";
import { goOffline } from "../store/slices/riderSlice";
import { offerEnqueued, offerTaken } from "../store/slices/offersSlice";

const SYSTEM_FORCE_OFFLINE = "SYSTEM_FORCE_OFFLINE";

let lastUnsubscribers = [];

export const subscribeSocketToStore = (dispatch, { notificationReceived }) => {
  // Tear down any previous subscriptions before installing new ones.
  for (const u of lastUnsubscribers) {
    try { u(); } catch (_) {}
  }
  lastUnsubscribers = [];

  // notification:new — generic notifications + the force-offline kill switch.
  lastUnsubscribers.push(
    socketService.onNotificationNew((data) => {
      if (!data) return;
      if (notificationReceived) dispatch(notificationReceived(data));
      const type = data?.type || data?.data?.type;
      if (type === SYSTEM_FORCE_OFFLINE) {
        dispatch(goOffline({ reason: "force-offline" }));
      }
    }),
  );

  // rider:job:new — new offer arriving from the dispatcher.
  lastUnsubscribers.push(
    socketService.onRiderJobNew((data) => {
      if (!data?.requestId) return;
      dispatch(offerEnqueued(data));
    }),
  );

  // rider:job:taken — another rider won (or the current rider's earlier
  // accept resolved on a different connection).
  lastUnsubscribers.push(
    socketService.onRiderJobTaken((data) => {
      if (!data?.requestId) return;
      dispatch(offerTaken({ requestId: data.requestId }));
    }),
  );

  // rider:job:confirmed — server confirmation that this rider won the race.
  // Decorative: the HTTP accept already activated the trip; we just log for
  // observability if confirms ever drift from HTTP outcomes.
  lastUnsubscribers.push(
    socketService.onRiderJobConfirmed((data) => {
      if (data?.requestId && __DEV__) {
        console.log("[notificationsBus] job confirmed:", data.requestId);
      }
    }),
  );

  return () => {
    for (const u of lastUnsubscribers) {
      try { u(); } catch (_) {}
    }
    lastUnsubscribers = [];
  };
};

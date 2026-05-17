import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api, { serverNow } from "../../services/api";
import socketService from "../../services/socket";
import { newIdempotencyKey } from "../../services/idempotency";

/**
 * Offers slice — queue of `rider:job:new` events + accept/reject thunks.
 *
 * Lifecycle (one offer at a time):
 *   - `rider:job:new` → offerEnqueued → activeOfferId set, status = 'showing'.
 *   - User taps Accept → acceptOffer thunk runs:
 *       1. status = 'accepting'
 *       2. Optimistic socket emit `rider:job:accept` (server treats HTTP as truth).
 *       3. HTTP `POST /api/rider/accept` with Idempotency-Key.
 *       4. 200 → status = 'accepted'; the parent component dispatches
 *          tripSlice.activateFromAcceptedRequest(payload) and dismisses the overlay.
 *       5. 409 OFFER_TAKEN → status = 'taken' (auto-dismiss after 2 s in UI).
 *       6. 410 OFFER_EXPIRED → status = 'expired' (auto-dismiss after 2 s).
 *       7. Network error → status = 'error', payload preserves the error code so
 *          the UI can offer Try Again with the same idempotency key.
 *   - User taps Reject → reject reducer emits socket fire-and-forget + dismisses.
 *   - Server emits `rider:job:taken` for THIS rider's losing acceptance OR for
 *     a sibling rider winning first → if matches activeOfferId, mark taken.
 *   - 60 s elapses with no action → offerExpired (counts toward acceptance rate).
 */

/** Accept the current offer. HTTP is authoritative; the optimistic socket emit
 * is decorative (server resolves the race via Redis offer set). */
export const acceptOffer = createAsyncThunk(
  "offers/accept",
  async ({ requestId, idempotencyKey: existingKey }, { rejectWithValue }) => {
    if (!requestId) return rejectWithValue({ code: "MISSING_REQUEST_ID" });

    // Reuse the same idempotency key across retries so the server can replay the
    // same response on duplicate POSTs (network hiccups during race conditions).
    const idempotencyKey = existingKey || newIdempotencyKey();

    // Optimistic socket emit. Fire-and-forget — server doesn't ACK this.
    try { socketService.emitJobAccept(requestId); } catch (_) {}

    try {
      const envelope = await api.post(
        "/rider/accept",
        { requestId },
        { headers: { "Idempotency-Key": idempotencyKey } },
      );
      return { requestId, payload: envelope?.data || envelope || {} };
    } catch (err) {
      const code = err?.code || err?.data?.code;
      return rejectWithValue({
        code: code || "ACCEPT_FAILED",
        status: err?.status,
        message: err?.message || "Couldn't accept offer",
        requestId,
        idempotencyKey,
      });
    }
  },
);

const initialState = {
  queue: [],                // [{ requestId, offeredAt, ttl, payload }]
  activeOfferId: null,
  status: "idle",           // idle | showing | accepting | accepted | taken | expired | error
  error: null,
  lastDismissed: null,      // { requestId, outcome: 'accepted'|'rejected'|'taken'|'expired'|'error' }
};

const slice = createSlice({
  name: "offers",
  initialState,
  reducers: {
    offerEnqueued: (state, action) => {
      const offer = action.payload;
      // Schema guard. The minimum useful offer needs `requestId` + pickup
      // coords (for the map preview) — without coords the rider can't make
      // an informed decision. Server payload per docs/SOCKET_ARCHITECTURE.md:
      //   { requestId, pickupAddress, dropoffAddress, distanceKm, fare,
      //     pickupLat, pickupLng, timeout: 60 }
      if (!offer || typeof offer.requestId !== "string" || offer.requestId.length === 0) {
        if (__DEV__) console.warn("[offers] enqueue rejected — missing requestId", offer);
        return;
      }
      if (typeof offer.pickupLat !== "number" || typeof offer.pickupLng !== "number") {
        if (__DEV__) console.warn("[offers] enqueue rejected — missing pickup coords", offer.requestId);
        return;
      }
      if (state.queue.find((o) => o.requestId === offer.requestId)) return;

      const now = serverNow();
      const offeredAt = typeof offer.offeredAt === "number" ? offer.offeredAt : now;
      const ttl = typeof offer.timeout === "number" && offer.timeout > 0 ? offer.timeout : 60;
      // Skip already-stale offers (e.g. backgrounded > 60 s while a push arrived).
      if (offeredAt + ttl * 1000 <= now) return;
      state.queue.push({ requestId: offer.requestId, offeredAt, ttl, payload: offer });
      if (!state.activeOfferId) {
        state.activeOfferId = offer.requestId;
        state.status = "showing";
        state.error = null;
      }
    },

    /** Soft-dismiss — driven by the UI when an outcome has resolved. */
    offerDismissed: (state, action) => {
      const requestId = action.payload?.requestId || action.payload;
      const outcome = action.payload?.outcome || null;
      state.queue = state.queue.filter((o) => o.requestId !== requestId);
      if (state.activeOfferId === requestId) {
        state.lastDismissed = { requestId, outcome };
        const next = state.queue[0];
        state.activeOfferId = next ? next.requestId : null;
        state.status = next ? "showing" : "idle";
        state.error = null;
      }
    },

    /** Rider tapped Reject — emit socket and remove from queue. */
    offerRejected: (state, action) => {
      const requestId = action.payload;
      try { socketService.emitJobReject(requestId); } catch (_) {}
      state.queue = state.queue.filter((o) => o.requestId !== requestId);
      if (state.activeOfferId === requestId) {
        state.lastDismissed = { requestId, outcome: "rejected" };
        const next = state.queue[0];
        state.activeOfferId = next ? next.requestId : null;
        state.status = next ? "showing" : "idle";
        state.error = null;
      }
    },

    /** Server reported `rider:job:taken` for an offer we're still showing. */
    offerTaken: (state, action) => {
      const requestId = action.payload?.requestId || action.payload;
      if (state.activeOfferId === requestId) {
        state.status = "taken";
        state.error = null;
      } else {
        // Wasn't the active offer; just remove from queue silently.
        state.queue = state.queue.filter((o) => o.requestId !== requestId);
      }
    },

    /** 60 s elapsed without action. */
    offerExpired: (state, action) => {
      const requestId = action.payload;
      if (state.activeOfferId === requestId) {
        state.status = "expired";
      }
    },

    /** Sweep stale offers (called on cold start + on socket reconnect). */
    offersPruneStale: (state) => {
      const now = serverNow();
      state.queue = state.queue.filter((o) => o.offeredAt + o.ttl * 1000 > now);
      if (state.activeOfferId && !state.queue.find((o) => o.requestId === state.activeOfferId)) {
        const next = state.queue[0];
        state.activeOfferId = next ? next.requestId : null;
        state.status = next ? "showing" : "idle";
      }
    },

    clearOfferError: (state) => {
      state.error = null;
      if (state.status === "error" && state.activeOfferId) {
        state.status = "showing";
      }
    },

    resetOffers: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(acceptOffer.pending, (state) => {
        if (state.activeOfferId) state.status = "accepting";
        state.error = null;
      })
      .addCase(acceptOffer.fulfilled, (state, action) => {
        const requestId = action.payload?.requestId;
        if (state.activeOfferId === requestId) {
          state.status = "accepted";
        }
      })
      .addCase(acceptOffer.rejected, (state, action) => {
        const payload = action.payload || {};
        if (payload.status === 409 || payload.code === "OFFER_TAKEN") {
          state.status = "taken";
        } else if (payload.status === 410 || payload.code === "OFFER_EXPIRED") {
          state.status = "expired";
        } else {
          state.status = "error";
          state.error = payload;
        }
      });
  },
});

export const {
  offerEnqueued,
  offerDismissed,
  offerRejected,
  offerTaken,
  offerExpired,
  offersPruneStale,
  clearOfferError,
  resetOffers,
} = slice.actions;
export default slice.reducer;

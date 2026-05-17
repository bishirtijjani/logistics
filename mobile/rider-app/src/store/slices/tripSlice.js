import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { setOnDelivery } from "./riderSlice";
import socketService from "../../services/socket";

/**
 * Trip slice — active delivery state for the rider's cockpit.
 *
 * Phase 3 surface:
 *   - `activateFromAcceptedRequest(payload)` — called when `acceptOffer` returns
 *     200. Pulls the canonical request shape from the server, switches the
 *     location stream to ON_DELIVERY cadence, joins the request socket room,
 *     and lands the cockpit state ready for Phase 4.
 *
 * Status patches, geofence flags, POD draft, and offline-queue retry are
 * built out in Phase 4.
 */

/**
 * Normalise the server's Request payload into the shape Phase 4 screens
 * expect. The backend returns the Request envelope flat; we extract pickup
 * and dropoff sub-objects so the cockpit can `useSelector(s => s.trip.pickup)`.
 */
function normaliseRequest(r) {
  if (!r) return null;
  return {
    id: r.id || r.requestId || null,
    status: r.status || null,
    type: r.type || null,
    pickup: {
      lat: r.pickupLat ?? r.pickup?.lat ?? null,
      lng: r.pickupLng ?? r.pickup?.lng ?? null,
      address: r.pickupAddress ?? r.pickup?.address ?? null,
      contactName: r.pickup?.contactName ?? r.merchantName ?? null,
      contactPhone: r.pickup?.contactPhone ?? r.merchantPhone ?? null,
      notes: r.pickup?.notes ?? r.pickupNotes ?? null,
    },
    dropoff: {
      lat: r.dropoffLat ?? r.dropoff?.lat ?? null,
      lng: r.dropoffLng ?? r.dropoff?.lng ?? null,
      address: r.dropoffAddress ?? r.dropoff?.address ?? null,
      contactName: r.dropoff?.contactName ?? r.customerName ?? null,
      contactPhone: r.dropoff?.contactPhone ?? r.customerPhone ?? null,
      notes: r.dropoff?.notes ?? r.dropoffNotes ?? null,
    },
    items: Array.isArray(r.items) ? r.items : [],
    distanceKm: r.distanceKm ?? null,
    estimatedMinutes: r.estimatedMinutes ?? null,
    riderEarning: r.riderEarning ?? null,
    fare: r.fare ?? r.total ?? null,
  };
}

/**
 * Activate a trip from an accepted offer payload. Side effects:
 *   - Set trip state from the normalised request.
 *   - Dispatch `setOnDelivery(true)` so the location stream switches to 3 s cadence.
 *   - Join the `request:{requestId}` socket room so the rider receives
 *     status / cancellation events from the customer + merchant.
 */
export const activateFromAcceptedRequest = createAsyncThunk(
  "trip/activate",
  async (rawRequest, { dispatch }) => {
    const normalised = normaliseRequest(rawRequest);
    if (!normalised?.id) {
      throw new Error("activateFromAcceptedRequest called without a request id");
    }
    // Side effects: rider cadence + socket room.
    try { socketService.joinRequestRoom(normalised.id); } catch (_) {}
    dispatch(setOnDelivery(true)).catch?.(() => {});
    return normalised;
  },
);

const initialState = {
  activeRequestId: null,
  status: null,
  type: null,
  pickup: null,
  dropoff: null,
  items: [],
  distanceKm: null,
  estimatedMinutes: null,
  riderEarning: null,
  fare: null,
  arrivedAt: { pickup: null, dropoff: null },
  callAttempts: {},
  statusQueue: [],
  pod: null,
  error: null,
};

const slice = createSlice({
  name: "trip",
  initialState,
  reducers: {
    tripStatusUpdated: (state, action) => {
      state.status = action.payload;
    },
    tripArrived: (state, action) => {
      const where = action.payload; // 'pickup' | 'dropoff'
      if (where === "pickup" || where === "dropoff") {
        state.arrivedAt[where] = Date.now();
      }
    },
    tripCallAttempted: (state, action) => {
      const id = action.payload;
      state.callAttempts[id] = (state.callAttempts[id] || 0) + 1;
    },
    tripCleared: (state) => {
      // Leave the socket room when the trip ends.
      if (state.activeRequestId) {
        try { socketService.leaveRequestRoom(state.activeRequestId); } catch (_) {}
      }
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(activateFromAcceptedRequest.fulfilled, (state, action) => {
        const r = action.payload;
        state.activeRequestId = r.id;
        state.status = r.status;
        state.type = r.type;
        state.pickup = r.pickup;
        state.dropoff = r.dropoff;
        state.items = r.items;
        state.distanceKm = r.distanceKm;
        state.estimatedMinutes = r.estimatedMinutes;
        state.riderEarning = r.riderEarning;
        state.fare = r.fare;
        state.arrivedAt = { pickup: null, dropoff: null };
        state.callAttempts = {};
        state.statusQueue = [];
        state.pod = null;
        state.error = null;
      })
      .addCase(activateFromAcceptedRequest.rejected, (state, action) => {
        state.error = {
          phase: "activate",
          message: action.error?.message || "Failed to activate trip",
        };
      });
  },
});

export const {
  tripStatusUpdated,
  tripArrived,
  tripCallAttempted,
  tripCleared,
} = slice.actions;
export default slice.reducer;

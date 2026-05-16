import { createSlice } from '@reduxjs/toolkit';

/**
 * Trip slice — active delivery state for the rider's cockpit.
 * Status patches, geofence flags, and offline-queue retry land in Phase 4.
 */

const initialState = {
  activeRequestId: null,
  status: null,
  pickup: null,
  dropoff: null,
  items: [],
  distanceKm: null,
  estimatedMinutes: null,
  riderEarning: null,
  arrivedAt: { pickup: null, dropoff: null },
  callAttempts: {},
  statusQueue: [],
  pod: null,
  error: null,
};

const slice = createSlice({
  name: 'trip',
  initialState,
  reducers: {
    tripActivated: (state, action) => {
      const r = action.payload || {};
      state.activeRequestId = r.id || r.requestId || null;
      state.status = r.status || null;
      state.pickup = r.pickup || null;
      state.dropoff = r.dropoff || null;
      state.items = r.items || [];
      state.distanceKm = r.distanceKm ?? null;
      state.estimatedMinutes = r.estimatedMinutes ?? null;
      state.riderEarning = r.riderEarning ?? null;
    },
    tripStatusUpdated: (state, action) => {
      state.status = action.payload;
    },
    tripArrived: (state, action) => {
      const where = action.payload; // 'pickup' | 'dropoff'
      if (where === 'pickup' || where === 'dropoff') {
        state.arrivedAt[where] = Date.now();
      }
    },
    tripCallAttempted: (state, action) => {
      const id = action.payload;
      state.callAttempts[id] = (state.callAttempts[id] || 0) + 1;
    },
    tripCleared: () => initialState,
  },
});

export const {
  tripActivated,
  tripStatusUpdated,
  tripArrived,
  tripCallAttempted,
  tripCleared,
} = slice.actions;
export default slice.reducer;

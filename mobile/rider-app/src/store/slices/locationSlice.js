import { createSlice } from '@reduxjs/toolkit';

/**
 * Location slice — last GPS fix + accuracy + permission state.
 * Fleshed out in Phase 2 alongside the TaskManager background task.
 */

const initialState = {
  lat: null,
  lng: null,
  accuracy: null,
  capturedAt: null,
  permission: 'undetermined', // 'granted' | 'denied' | 'whileInUse' | 'always' | 'undetermined'
  servicesEnabled: true,
};

const slice = createSlice({
  name: 'location',
  initialState,
  reducers: {
    locationFixReceived: (state, action) => {
      const { lat, lng, accuracy } = action.payload || {};
      if (typeof lat !== 'number' || typeof lng !== 'number') return;
      state.lat = lat;
      state.lng = lng;
      state.accuracy = accuracy ?? null;
      state.capturedAt = Date.now();
    },
    locationPermissionSet: (state, action) => {
      state.permission = action.payload || 'undetermined';
    },
    locationServicesEnabledSet: (state, action) => {
      state.servicesEnabled = Boolean(action.payload);
    },
  },
});

export const {
  locationFixReceived,
  locationPermissionSet,
  locationServicesEnabledSet,
} = slice.actions;
export default slice.reducer;

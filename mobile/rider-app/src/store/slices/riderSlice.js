import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import { AVAILABILITY } from '../../lib/constants';

/**
 * Rider slice — availability, presence, performance snapshot.
 * Phase 2 wires availability toggles; Phase 7 fleshes out performance.
 */

export const fetchRiderProfile = createAsyncThunk(
  'rider/fetchProfile',
  async (_, { rejectWithValue }) => {
    try {
      const envelope = await api.get('/rider/profile');
      return envelope?.data || envelope || {};
    } catch (err) {
      return rejectWithValue(err?.message || 'Failed to load rider profile');
    }
  },
);

export const setAvailability = createAsyncThunk(
  'rider/setAvailability',
  async (availability, { rejectWithValue }) => {
    try {
      const envelope = await api.patch('/rider/availability', { availability });
      return envelope?.data || { availability };
    } catch (err) {
      return rejectWithValue(err?.message || 'Failed to update availability');
    }
  },
);

const initialState = {
  rider: null,
  availability: AVAILABILITY.OFFLINE,
  isStreaming: false,
  lastFix: null,
  performance: null,
  isLoading: false,
  error: null,
};

const slice = createSlice({
  name: 'rider',
  initialState,
  reducers: {
    setLocalAvailability: (state, action) => {
      state.availability = action.payload;
    },
    setStreaming: (state, action) => {
      state.isStreaming = Boolean(action.payload);
    },
    setLastFix: (state, action) => {
      state.lastFix = action.payload || null;
    },
    resetRider: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRiderProfile.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchRiderProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        state.rider = action.payload;
        if (action.payload?.availability) {
          state.availability = action.payload.availability;
        }
      })
      .addCase(fetchRiderProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    builder.addCase(setAvailability.fulfilled, (state, action) => {
      if (action.payload?.availability) {
        state.availability = action.payload.availability;
      }
    });
  },
});

export const { setLocalAvailability, setStreaming, setLastFix, resetRider } = slice.actions;
export default slice.reducer;

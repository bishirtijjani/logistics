import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

/**
 * Profile slice — wraps `GET /api/auth/profile` and PIN management.
 * Provides `hasPinSet` for the PIN-guard hook and `profile` for the Me tab.
 */

export const fetchProfile = createAsyncThunk(
  'profile/fetch',
  async (_, { rejectWithValue }) => {
    try {
      const envelope = await api.get('/auth/profile');
      return envelope?.data || envelope || {};
    } catch (err) {
      return rejectWithValue(err?.message || 'Failed to load profile');
    }
  },
);

export const setTransactionPin = createAsyncThunk(
  'profile/setPin',
  async (pin, { rejectWithValue }) => {
    try {
      const envelope = await api.post('/auth/pin', { pin });
      return envelope?.data || envelope || {};
    } catch (err) {
      return rejectWithValue(err?.message || 'Failed to set PIN');
    }
  },
);

export const changeTransactionPin = createAsyncThunk(
  'profile/changePin',
  async ({ oldPin, newPin }, { rejectWithValue }) => {
    try {
      const envelope = await api.post('/auth/pin/change', { oldPin, newPin });
      return envelope?.data || envelope || {};
    } catch (err) {
      return rejectWithValue(err?.message || 'Failed to change PIN');
    }
  },
);

const slice = createSlice({
  name: 'profile',
  initialState: {
    profile: null,
    isLoading: false,
    isUpdating: false,
    error: null,
  },
  reducers: {
    profileUpdatedLocal: (state, action) => {
      state.profile = { ...(state.profile || {}), ...(action.payload || {}) };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProfile.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        state.profile = action.payload;
      })
      .addCase(fetchProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    builder
      .addCase(setTransactionPin.pending, (state) => {
        state.isUpdating = true;
        state.error = null;
      })
      .addCase(setTransactionPin.fulfilled, (state) => {
        state.isUpdating = false;
        if (state.profile) state.profile.hasPinSet = true;
      })
      .addCase(setTransactionPin.rejected, (state, action) => {
        state.isUpdating = false;
        state.error = action.payload;
      });

    builder
      .addCase(changeTransactionPin.pending, (state) => {
        state.isUpdating = true;
        state.error = null;
      })
      .addCase(changeTransactionPin.fulfilled, (state) => {
        state.isUpdating = false;
      })
      .addCase(changeTransactionPin.rejected, (state, action) => {
        state.isUpdating = false;
        state.error = action.payload;
      });
  },
});

export const { profileUpdatedLocal } = slice.actions;
export default slice.reducer;

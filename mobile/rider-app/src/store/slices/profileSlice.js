import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

/**
 * Profile slice — wraps `GET /api/auth/profile`. Provides `hasPinSet` for
 * the PIN-guard hook and `profile` for the Me tab. Fleshed out in Phase 7.
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

const slice = createSlice({
  name: 'profile',
  initialState: {
    profile: null,
    isLoading: false,
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
  },
});

export const { profileUpdatedLocal } = slice.actions;
export default slice.reducer;

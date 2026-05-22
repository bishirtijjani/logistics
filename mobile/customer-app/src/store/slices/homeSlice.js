/**
 * Home slice — drives the Phase 6 HomeScreen widgets:
 *   - activeRequest from /requests/active (auto-updates via socket events)
 *   - banners from /banners
 *   - recentActivity = last few requests + wallet transactions interleaved by date
 *
 * Kept separate from `request` and `wallet` so HomeScreen can refresh its
 * snapshot independently of the full lists those slices own.
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

const RECENT_LIMIT = 5;

export const fetchActiveRequest = createAsyncThunk(
  'home/activeRequest',
  async (_, { rejectWithValue }) => {
    try {
      const envelope = await api.get('/requests/active');
      return envelope?.data || null;
    } catch (err) {
      return rejectWithValue(err?.message || 'Failed to load active request');
    }
  },
);

export const fetchBanners = createAsyncThunk(
  'home/banners',
  async (_, { rejectWithValue }) => {
    try {
      const envelope = await api.get('/banners');
      return envelope?.data || [];
    } catch (err) {
      return rejectWithValue(err?.message || 'Failed to load banners');
    }
  },
);

export const fetchRecentActivity = createAsyncThunk(
  'home/recentActivity',
  async (_, { rejectWithValue }) => {
    // allSettled so one feed failing (e.g. wallet 5xx) doesn't blank the
    // other half of the activity list.
    const [reqsRes, txRes] = await Promise.allSettled([
      api.get('/requests?page=1&limit=5'),
      api.get('/wallet/transactions?page=1&limit=5'),
    ]);

    const requests = reqsRes.status === 'fulfilled'
      ? (reqsRes.value?.data || []).map((r) => ({
          kind: 'request',
          id: r.id,
          title: r.merchant?.name || (r.type === 'PACKAGE' ? 'Package delivery' : 'Order'),
          subtitle: r.dropoffAddress || r.pickupAddress || '',
          amount: Number(r.total ?? r.customerPaid ?? 0),
          status: r.status,
          at: r.createdAt,
          raw: r,
        }))
      : [];
    const txs = txRes.status === 'fulfilled'
      ? (txRes.value?.data || []).map((t) => ({
          kind: 'transaction',
          id: t.id,
          title: t.description || t.type || 'Transaction',
          subtitle: t.reference || '',
          amount: Number(t.amount ?? 0),
          type: t.type,
          at: t.createdAt,
          raw: t,
        }))
      : [];

    if (reqsRes.status === 'rejected' && txRes.status === 'rejected') {
      return rejectWithValue(reqsRes.reason?.message || 'Failed to load activity');
    }

    return [...requests, ...txs]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, RECENT_LIMIT);
  },
);

const initialState = {
  activeRequest: null,
  banners: [],
  recentActivity: [],
  isLoadingActive: false,
  isLoadingBanners: false,
  isLoadingActivity: false,
  isLoaded: false,
};

const slice = createSlice({
  name: 'home',
  initialState,
  reducers: {
    // Updated by socket listeners — keeps the home banner in sync with
    // live status transitions without an extra REST round-trip.
    activeRequestFromSocket: (state, action) => {
      const { requestId, status } = action.payload || {};
      if (!requestId || !state.activeRequest) return;
      if (state.activeRequest.id !== requestId) return;
      // If the active request just terminated, drop it.
      if (status === 'DELIVERED' || status === 'SETTLED' || status === 'CANCELLED') {
        state.activeRequest = null;
      } else if (status) {
        state.activeRequest = { ...state.activeRequest, status };
      }
    },
    setActiveRequest: (state, action) => {
      state.activeRequest = action.payload || null;
    },
    clearHome: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchActiveRequest.pending, (state) => { state.isLoadingActive = true; })
      .addCase(fetchActiveRequest.fulfilled, (state, action) => {
        state.isLoadingActive = false;
        state.activeRequest = action.payload || null;
        state.isLoaded = true;
      })
      .addCase(fetchActiveRequest.rejected, (state) => { state.isLoadingActive = false; });

    builder
      .addCase(fetchBanners.pending, (state) => { state.isLoadingBanners = true; })
      .addCase(fetchBanners.fulfilled, (state, action) => {
        state.isLoadingBanners = false;
        state.banners = action.payload || [];
      })
      .addCase(fetchBanners.rejected, (state) => { state.isLoadingBanners = false; });

    builder
      .addCase(fetchRecentActivity.pending, (state) => { state.isLoadingActivity = true; })
      .addCase(fetchRecentActivity.fulfilled, (state, action) => {
        state.isLoadingActivity = false;
        state.recentActivity = action.payload || [];
      })
      .addCase(fetchRecentActivity.rejected, (state) => { state.isLoadingActivity = false; });
  },
});

export const { activeRequestFromSocket, setActiveRequest, clearHome } = slice.actions;
export default slice.reducer;

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

/**
 * Earnings slice — today / week / month + per-request rows.
 *
 * Phase 2 wires `fetchRiderEarnings` against `GET /api/rider/earnings`. The
 * current backend returns lifetime fields (`totalEarnings`, `totalDeliveries`,
 * `averageRating`); the daily/weekly breakdown that EarningsDashboardScreen
 * will surface in Phase 6 lights up automatically once the endpoint is
 * extended — no client refactor needed.
 */

export const fetchRiderEarnings = createAsyncThunk(
  'earnings/fetchRider',
  async (_, { rejectWithValue }) => {
    try {
      const envelope = await api.get('/rider/earnings');
      return envelope?.data || envelope || {};
    } catch (err) {
      return rejectWithValue(err?.message || 'Failed to load earnings');
    }
  },
);

const initialState = {
  summary: {
    today: null,    // { amount, count }
    week: null,
    month: null,
    allTime: null,
  },
  daily: [],
  byRequest: { byId: {}, allIds: [], page: 1, hasMore: false },
  isLoading: false,
  error: null,
  loadedAt: null,
};

const slice = createSlice({
  name: 'earnings',
  initialState,
  reducers: {
    earningCreditedFromSocket: (state, action) => {
      const tx = action.payload;
      if (!tx || tx.type !== 'RIDER_EARNING') return;
      if (state.summary.today) {
        state.summary.today.count += 1;
        state.summary.today.amount = (state.summary.today.amount || 0) + (tx.amount || 0);
      }
      if (state.summary.allTime) {
        state.summary.allTime.count += 1;
        state.summary.allTime.amount = (state.summary.allTime.amount || 0) + (tx.amount || 0);
      }
    },
    resetEarnings: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRiderEarnings.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchRiderEarnings.fulfilled, (state, action) => {
        state.isLoading = false;
        state.loadedAt = Date.now();
        const data = action.payload || {};
        // Backend today returns lifetime aggregates. Wire them into allTime
        // and leave today/week/month null until the BE adds daily breakdowns.
        if (typeof data.totalEarnings !== 'undefined' || typeof data.totalDeliveries !== 'undefined') {
          state.summary.allTime = {
            amount: Number(data.totalEarnings ?? 0),
            count: Number(data.totalDeliveries ?? 0),
          };
        }
        // Forward-compat: if BE later returns these, mirror them straight through.
        if (data.today) state.summary.today = data.today;
        if (data.week) state.summary.week = data.week;
        if (data.month) state.summary.month = data.month;
        if (Array.isArray(data.daily)) state.daily = data.daily;
      })
      .addCase(fetchRiderEarnings.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export const { earningCreditedFromSocket, resetEarnings } = slice.actions;
export default slice.reducer;

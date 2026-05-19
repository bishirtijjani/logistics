import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";

/**
 * Earnings slice — dashboard summary + daily chart series + paginated
 * per-request breakdown. Drives `EarningsDashboardScreen`,
 * `EarningsBreakdownScreen`, and the cockpit's settlement animation.
 *
 * Server payload (Phase 6 — `GET /api/rider/earnings?page=N&limit=N`):
 *   {
 *     summary: { today, week, month, allTime }, // each { amount, count }
 *     daily:   [{ date: 'YYYY-MM-DD', amount, count }, ...],
 *     recent:  [{ id, requestId, amount, settledAt, deliveredAt,
 *                 distanceKm, durationMin, customerName, dropoffAddress }],
 *     pagination: { page, limit, total, hasMore },
 *     averageRating
 *   }
 */

export const fetchRiderEarnings = createAsyncThunk(
  "earnings/fetchRider",
  async ({ page = 1, limit = 20 } = {}, { rejectWithValue }) => {
    try {
      const envelope = await api.get(`/rider/earnings?page=${page}&limit=${limit}`);
      const payload = envelope?.data || envelope || {};
      return { ...payload, page };
    } catch (err) {
      return rejectWithValue(err?.message || "Failed to load earnings");
    }
  },
);

/**
 * Append-only fetch for infinite scroll on EarningsBreakdownScreen. Same
 * endpoint; we just merge `recent` rather than replace.
 */
export const fetchMoreEarnings = createAsyncThunk(
  "earnings/fetchMore",
  async ({ page, limit = 20 }, { rejectWithValue }) => {
    if (!page || page < 2) return rejectWithValue({ message: "Invalid page" });
    try {
      const envelope = await api.get(`/rider/earnings?page=${page}&limit=${limit}`);
      const payload = envelope?.data || envelope || {};
      return { ...payload, page };
    } catch (err) {
      return rejectWithValue(err?.message || "Failed to load earnings");
    }
  },
);

const initialState = {
  summary: {
    today:   { amount: 0, count: 0 },
    week:    { amount: 0, count: 0 },
    month:   { amount: 0, count: 0 },
    allTime: { amount: 0, count: 0 },
  },
  daily: [],          // [{ date, amount, count }]
  byId: {},           // recent earnings rows keyed by tx id
  allIds: [],         // ordered (newest first)
  page: 1,
  hasMore: false,
  averageRating: 0,
  // Bounded log of recently-processed socket-bump references so the same
  // earning never gets counted twice when the socket race overlaps a fetch.
  seenSocketReferences: [],
  isLoading: false,
  isLoadingMore: false,
  error: null,
  loadedAt: null,
};

const slice = createSlice({
  name: "earnings",
  initialState,
  reducers: {
    /**
     * Phase 5 / 6 — wallet:balance:updated socket emits a RIDER_EARNING
     * transaction on every settlement. We bump today's + allTime tallies
     * AND prepend a synthetic row to the breakdown list so the dashboard
     * reflects the new earning before the next fetch.
     *
     * Dedup by `reference` — the same earning can arrive via both the
     * socket bump AND a near-simultaneous fetch reconciliation; without
     * dedup the tallies would over-count by one when the fetch returns
     * canonical numbers that already include this earning. The settle
     * worker sends `reference` on the socket payload; the server's recent
     * list also keys rows by id, so we use either as the dedup key.
     */
    earningCreditedFromSocket: (state, action) => {
      const tx = action.payload || {};
      if (tx.type !== "RIDER_EARNING") return;
      const amount = Number(tx.amount || 0);
      if (amount <= 0) return;
      const dedupKey = tx.reference || tx.id || null;
      if (dedupKey && state.seenSocketReferences.includes(dedupKey)) return;
      // Also dedupe against already-fetched canonical rows. The server's
      // recent list keys by tx id; if reference is exposed there too (it
      // is — `select: { reference: true }`), we can match.
      if (dedupKey) {
        const alreadyFetched = state.allIds.some((id) => {
          const row = state.byId[id];
          return row && (row.reference === dedupKey || row.id === dedupKey);
        });
        if (alreadyFetched) {
          // Record so we never reprocess, but don't bump tallies.
          state.seenSocketReferences.push(dedupKey);
          if (state.seenSocketReferences.length > 50) state.seenSocketReferences.shift();
          return;
        }
      }

      state.summary.today.amount += amount;
      state.summary.today.count += 1;
      state.summary.week.amount += amount;
      state.summary.week.count += 1;
      state.summary.month.amount += amount;
      state.summary.month.count += 1;
      state.summary.allTime.amount += amount;
      state.summary.allTime.count += 1;

      // Bump today's daily-series bucket (if present).
      const todayIso = new Date().toISOString().slice(0, 10);
      const todayBucket = state.daily.find((d) => d.date === todayIso);
      if (todayBucket) {
        todayBucket.amount += amount;
        todayBucket.count += 1;
      } else {
        state.daily.push({ date: todayIso, amount, count: 1 });
      }

      // Optimistic row for the breakdown list. Server reconciles on next
      // fetch; we de-dupe by reference/id on the next merge.
      const synthId = tx.id || tx.reference || `rider-earning-${Date.now()}`;
      if (!state.byId[synthId]) {
        state.byId[synthId] = {
          id: synthId,
          reference: tx.reference || null,
          amount,
          settledAt: tx.settledAt || tx.createdAt || new Date().toISOString(),
          requestId: tx.requestId || tx.metadata?.requestId || null,
          description: tx.description || null,
          _optimistic: true,
        };
        state.allIds.unshift(synthId);
      }

      if (dedupKey) {
        state.seenSocketReferences.push(dedupKey);
        // Cap the recent-seen log so it doesn't grow unboundedly.
        if (state.seenSocketReferences.length > 50) state.seenSocketReferences.shift();
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
        // Summary
        const s = data.summary || {};
        state.summary.today   = s.today   || { amount: 0, count: 0 };
        state.summary.week    = s.week    || { amount: 0, count: 0 };
        state.summary.month   = s.month   || { amount: 0, count: 0 };
        state.summary.allTime = s.allTime || { amount: 0, count: 0 };
        state.averageRating = Number(data.averageRating || 0);
        state.daily = Array.isArray(data.daily) ? data.daily : [];
        // Recent — page 1 replaces; later pages append (via fetchMoreEarnings).
        const list = Array.isArray(data.recent) ? data.recent : [];
        state.byId = {};
        state.allIds = [];
        for (const row of list) {
          if (!row?.id) continue;
          state.byId[row.id] = row;
          state.allIds.push(row.id);
        }
        state.page = data.page || 1;
        state.hasMore = Boolean(data.pagination?.hasMore);
      })
      .addCase(fetchRiderEarnings.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    builder
      .addCase(fetchMoreEarnings.pending, (state) => {
        state.isLoadingMore = true;
        state.error = null;
      })
      .addCase(fetchMoreEarnings.fulfilled, (state, action) => {
        state.isLoadingMore = false;
        const data = action.payload || {};
        const list = Array.isArray(data.recent) ? data.recent : [];
        for (const row of list) {
          if (!row?.id) continue;
          if (!state.byId[row.id]) state.allIds.push(row.id);
          state.byId[row.id] = row;
        }
        state.page = data.page || state.page;
        state.hasMore = Boolean(data.pagination?.hasMore);
      })
      .addCase(fetchMoreEarnings.rejected, (state, action) => {
        state.isLoadingMore = false;
        state.error = action.payload;
      });
  },
});

export const { earningCreditedFromSocket, resetEarnings } = slice.actions;
export default slice.reducer;

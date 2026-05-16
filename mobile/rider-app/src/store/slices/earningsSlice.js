import { createSlice } from '@reduxjs/toolkit';

/**
 * Earnings slice — today / week / month + per-request rows.
 * Fleshed out in Phase 6 against `GET /api/rider/earnings`.
 */

const initialState = {
  summary: { today: null, week: null, month: null, allTime: null },
  daily: [],
  byRequest: { byId: {}, allIds: [], page: 1, hasMore: false },
  isLoading: false,
  error: null,
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
    },
    resetEarnings: () => initialState,
  },
});

export const { earningCreditedFromSocket, resetEarnings } = slice.actions;
export default slice.reducer;

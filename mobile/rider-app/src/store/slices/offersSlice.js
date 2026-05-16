import { createSlice } from '@reduxjs/toolkit';

/**
 * Offers slice — queue of `rider:job:new` events.
 * Real Accept/Reject thunks land in Phase 3.
 */

const initialState = {
  queue: [],
  activeOfferId: null,
  status: 'idle', // idle | showing | accepting | accepted | taken | expired | error
  error: null,
};

const slice = createSlice({
  name: 'offers',
  initialState,
  reducers: {
    offerEnqueued: (state, action) => {
      const offer = action.payload;
      if (!offer || !offer.requestId) return;
      if (state.queue.find((o) => o.requestId === offer.requestId)) return;
      state.queue.push({
        requestId: offer.requestId,
        offeredAt: offer.offeredAt || Date.now(),
        ttl: offer.timeout || 60,
        payload: offer,
      });
      if (!state.activeOfferId) {
        state.activeOfferId = offer.requestId;
        state.status = 'showing';
      }
    },
    offerDismissed: (state, action) => {
      const requestId = action.payload;
      state.queue = state.queue.filter((o) => o.requestId !== requestId);
      if (state.activeOfferId === requestId) {
        const next = state.queue[0];
        state.activeOfferId = next ? next.requestId : null;
        state.status = next ? 'showing' : 'idle';
      }
    },
    offerStatusSet: (state, action) => {
      state.status = action.payload;
    },
    offersPruneStale: (state) => {
      const now = Date.now();
      state.queue = state.queue.filter((o) => o.offeredAt + o.ttl * 1000 > now);
      if (state.activeOfferId && !state.queue.find((o) => o.requestId === state.activeOfferId)) {
        const next = state.queue[0];
        state.activeOfferId = next ? next.requestId : null;
        state.status = next ? 'showing' : 'idle';
      }
    },
    resetOffers: () => initialState,
  },
});

export const {
  offerEnqueued,
  offerDismissed,
  offerStatusSet,
  offersPruneStale,
  resetOffers,
} = slice.actions;
export default slice.reducer;

import { createSlice } from '@reduxjs/toolkit';

/**
 * Beneficiaries slice — saved bank accounts. Fleshed out in Phase 6.
 */

const initialState = {
  byId: {},
  allIds: [],
  isLoading: false,
  error: null,
};

const slice = createSlice({
  name: 'beneficiaries',
  initialState,
  reducers: {
    beneficiariesLoaded: (state, action) => {
      const list = action.payload || [];
      state.byId = {};
      state.allIds = [];
      for (const b of list) {
        if (!b?.id) continue;
        state.byId[b.id] = b;
        state.allIds.push(b.id);
      }
    },
    beneficiaryAdded: (state, action) => {
      const b = action.payload;
      if (!b?.id) return;
      state.byId[b.id] = b;
      if (!state.allIds.includes(b.id)) state.allIds.unshift(b.id);
    },
    beneficiaryRemoved: (state, action) => {
      const id = action.payload;
      delete state.byId[id];
      state.allIds = state.allIds.filter((x) => x !== id);
    },
    resetBeneficiaries: () => initialState,
  },
});

export const {
  beneficiariesLoaded,
  beneficiaryAdded,
  beneficiaryRemoved,
  resetBeneficiaries,
} = slice.actions;
export default slice.reducer;

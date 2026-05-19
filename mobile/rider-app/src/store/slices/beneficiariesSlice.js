import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";

/**
 * Beneficiaries — saved bank accounts. Backed by GET/POST/DELETE
 * `/wallet/beneficiaries`. RIDER role is already permitted on those routes
 * (no `authorize()` guard); the wallet validator gates the payload shape.
 *
 * Keyed normalised store so the WithdrawScreen can pre-fill from a tap and
 * the list screen can render without a refetch dance.
 */

export const fetchBeneficiaries = createAsyncThunk(
  "beneficiaries/fetch",
  async (_, { rejectWithValue }) => {
    try {
      const envelope = await api.get("/wallet/beneficiaries");
      const payload = envelope?.data || envelope || {};
      return Array.isArray(payload) ? payload : (payload.beneficiaries || payload.data || []);
    } catch (err) {
      return rejectWithValue(err?.message || "Failed to load beneficiaries");
    }
  },
);

export const saveBeneficiary = createAsyncThunk(
  "beneficiaries/save",
  async (data, { rejectWithValue, getState }) => {
    try {
      // Avoid duplicate persists — if we already have this bank+account
      // combo, return the existing row to the caller (idempotent UX).
      const s = getState().beneficiaries;
      const list = (s?.allIds || []).map((id) => s.byId[id]).filter(Boolean);
      const existing = list.find((b) =>
        (b.bankCode || b.code) === data.bankCode
        && b.accountNumber === data.accountNumber,
      );
      if (existing) return existing;
      const envelope = await api.post("/wallet/beneficiaries", data);
      const payload = envelope?.data || envelope || {};
      return payload?.beneficiary || payload?.data || payload;
    } catch (err) {
      return rejectWithValue(err?.message || "Failed to save beneficiary");
    }
  },
);

export const deleteBeneficiary = createAsyncThunk(
  "beneficiaries/delete",
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/wallet/beneficiaries/${id}`);
      return id;
    } catch (err) {
      return rejectWithValue(err?.message || "Failed to delete beneficiary");
    }
  },
);

const initialState = {
  byId: {},
  allIds: [],
  isLoading: false,
  isSaving: false,
  error: null,
};

const slice = createSlice({
  name: "beneficiaries",
  initialState,
  reducers: {
    resetBeneficiaries: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBeneficiaries.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchBeneficiaries.fulfilled, (state, action) => {
        state.isLoading = false;
        const list = Array.isArray(action.payload) ? action.payload : [];
        state.byId = {};
        state.allIds = [];
        for (const b of list) {
          if (!b?.id) continue;
          state.byId[b.id] = b;
          state.allIds.push(b.id);
        }
      })
      .addCase(fetchBeneficiaries.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    builder
      .addCase(saveBeneficiary.pending, (state) => {
        state.isSaving = true;
        state.error = null;
      })
      .addCase(saveBeneficiary.fulfilled, (state, action) => {
        state.isSaving = false;
        const b = action.payload;
        if (b?.id) {
          state.byId[b.id] = b;
          if (!state.allIds.includes(b.id)) state.allIds.unshift(b.id);
        }
      })
      .addCase(saveBeneficiary.rejected, (state, action) => {
        state.isSaving = false;
        state.error = action.payload;
      });

    builder
      .addCase(deleteBeneficiary.fulfilled, (state, action) => {
        const id = action.payload;
        delete state.byId[id];
        state.allIds = state.allIds.filter((x) => x !== id);
      });
  },
});

export const { resetBeneficiaries } = slice.actions;
export default slice.reducer;

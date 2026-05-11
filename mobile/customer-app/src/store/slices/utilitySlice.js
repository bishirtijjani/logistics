import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";
import { newIdempotencyKey } from "../../services/idempotency";

const idemHeaders = () => ({ headers: { "Idempotency-Key": newIdempotencyKey() } });

// Preserve { status, data } from the api client error so callers using
// `.unwrap()` (e.g. PinBottomSheet) can detect 423/429 lockouts.
const toRejectionPayload = (error, fallbackMessage) => ({
  message: error?.message || fallbackMessage,
  status: error?.status ?? null,
  data: error?.data ?? null,
});

export const fetchPlans = createAsyncThunk(
  "utility/fetchPlans",
  async ({ type, networkId } = {}, { rejectWithValue }) => {
    try {
      const params = { type, ...(networkId && { networkId }) };
      const response = await api.get("/utilities/plans", { params });
      return { type, networkId, plans: response.data.data };
    } catch (error) {
      return rejectWithValue(toRejectionPayload(error, "Failed to fetch plans"));
    }
  }
);

export const buyAirtime = createAsyncThunk(
  "utility/buyAirtime",
  async ({ networkId, phone, amount, pin }, { rejectWithValue }) => {
    try {
      const response = await api.post("/utilities/airtime", { networkId, phone, amount, pin }, idemHeaders());
      return response.data.data;
    } catch (error) {
      return rejectWithValue(toRejectionPayload(error, "Failed to purchase airtime"));
    }
  }
);

export const buyData = createAsyncThunk(
  "utility/buyData",
  async ({ planId, phone, pin }, { rejectWithValue }) => {
    try {
      const response = await api.post("/utilities/data", { planId, phone, pin }, idemHeaders());
      return response.data.data;
    } catch (error) {
      return rejectWithValue(toRejectionPayload(error, "Failed to purchase data"));
    }
  }
);

export const buyCable = createAsyncThunk(
  "utility/buyCable",
  async ({ planId, smartCardNumber, pin }, { rejectWithValue }) => {
    try {
      const response = await api.post("/utilities/cable", { planId, smartCardNumber, pin }, idemHeaders());
      return response.data.data;
    } catch (error) {
      return rejectWithValue(toRejectionPayload(error, "Failed to subscribe to cable"));
    }
  }
);

export const payElectricity = createAsyncThunk(
  "utility/payElectricity",
  async ({ discoId, meterNumber, meterType, amount, phone, pin }, { rejectWithValue }) => {
    try {
      const response = await api.post("/utilities/electricity", {
        discoId, meterNumber, meterType, amount, phone, pin,
      }, idemHeaders());
      return response.data.data;
    } catch (error) {
      return rejectWithValue(toRejectionPayload(error, "Failed to pay electricity"));
    }
  }
);

export const validateIuc = createAsyncThunk(
  "utility/validateIuc",
  async ({ smartCardNumber, cableNameId }, { rejectWithValue }) => {
    try {
      const response = await api.get("/utilities/validate-iuc", {
        params: { smartCardNumber, cableNameId },
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(toRejectionPayload(error, "Failed to validate IUC"));
    }
  }
);

export const validateMeter = createAsyncThunk(
  "utility/validateMeter",
  async ({ meterNumber, discoId, meterType }, { rejectWithValue }) => {
    try {
      const response = await api.get("/utilities/validate-meter", {
        params: { meterNumber, discoId, meterType },
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(toRejectionPayload(error, "Failed to validate meter"));
    }
  }
);

export const fetchUtilityHistory = createAsyncThunk(
  "utility/fetchUtilityHistory",
  async ({ page = 1, limit = 20, type } = {}, { rejectWithValue }) => {
    try {
      const response = await api.get("/utilities/history", { params: { page, limit, type } });
      return { payments: response.data.data, total: response.data.meta?.total || 0, page };
    } catch (error) {
      return rejectWithValue(toRejectionPayload(error, "Failed to fetch history"));
    }
  }
);

const utilitySlice = createSlice({
  name: "utility",
  initialState: {
    plans: {},      // { "DATA-1": [...], "AIRTIME": [...], "CABLE-1": [...], "ELECTRICITY": [...] }
    history: [],
    isLoading: false,
    isValidating: false,
    validationResult: null,
    error: null,
    total: 0,
  },
  reducers: {
    clearUtilityError: (state) => { state.error = null; },
    clearValidation: (state) => { state.validationResult = null; },
  },
  extraReducers: (builder) => {
    const loading = (state) => { state.isLoading = true; state.error = null; };
    const failed = (state, action) => {
      state.isLoading = false;
      state.error = action.payload?.message ?? action.payload ?? null;
    };

    builder
      .addCase(fetchPlans.pending, loading)
      .addCase(fetchPlans.fulfilled, (state, action) => {
        state.isLoading = false;
        const key = action.payload.networkId
          ? `${action.payload.type}-${action.payload.networkId}`
          : action.payload.type;
        state.plans[key] = action.payload.plans;
      })
      .addCase(fetchPlans.rejected, failed);

    builder
      .addCase(buyAirtime.pending, loading)
      .addCase(buyAirtime.fulfilled, (state, action) => {
        state.isLoading = false;
        state.history.unshift(action.payload);
      })
      .addCase(buyAirtime.rejected, failed);

    builder
      .addCase(buyData.pending, loading)
      .addCase(buyData.fulfilled, (state, action) => {
        state.isLoading = false;
        state.history.unshift(action.payload);
      })
      .addCase(buyData.rejected, failed);

    builder
      .addCase(buyCable.pending, loading)
      .addCase(buyCable.fulfilled, (state, action) => {
        state.isLoading = false;
        state.history.unshift(action.payload);
      })
      .addCase(buyCable.rejected, failed);

    builder
      .addCase(payElectricity.pending, loading)
      .addCase(payElectricity.fulfilled, (state, action) => {
        state.isLoading = false;
        state.history.unshift(action.payload);
      })
      .addCase(payElectricity.rejected, failed);

    builder
      .addCase(validateIuc.pending, (state) => { state.isValidating = true; state.validationResult = null; })
      .addCase(validateIuc.fulfilled, (state, action) => { state.isValidating = false; state.validationResult = action.payload; })
      .addCase(validateIuc.rejected, (state, action) => { state.isValidating = false; state.error = action.payload?.message ?? action.payload ?? null; });

    builder
      .addCase(validateMeter.pending, (state) => { state.isValidating = true; state.validationResult = null; })
      .addCase(validateMeter.fulfilled, (state, action) => { state.isValidating = false; state.validationResult = action.payload; })
      .addCase(validateMeter.rejected, (state, action) => { state.isValidating = false; state.error = action.payload?.message ?? action.payload ?? null; });

    builder
      .addCase(fetchUtilityHistory.pending, loading)
      .addCase(fetchUtilityHistory.fulfilled, (state, action) => {
        state.isLoading = false;
        const { payments = [], total = 0, page } = action.payload;
        state.history = page === 1 ? payments : [...state.history, ...payments];
        state.total = total;
      })
      .addCase(fetchUtilityHistory.rejected, failed);
  },
});

export const { clearUtilityError, clearValidation } = utilitySlice.actions;
export default utilitySlice.reducer;

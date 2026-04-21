import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";

// Async thunks
export const buyAirtime = createAsyncThunk(
  "utility/buyAirtime",
  async ({ provider, phone, amount, pin }, { rejectWithValue }) => {
    try {
      const response = await api.post("/utilities/airtime", {
        serviceID: provider,
        phone,
        amount,
        pin,
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || "Failed to purchase airtime");
    }
  }
);

export const buyData = createAsyncThunk(
  "utility/buyData",
  async ({ provider, phone, planCode, amount, pin }, { rejectWithValue }) => {
    try {
      const response = await api.post("/utilities/data", {
        serviceID: provider,
        phone,
        variationCode: planCode,
        amount,
        pin,
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || "Failed to purchase data");
    }
  }
);

export const fetchDataPlans = createAsyncThunk(
  "utility/fetchDataPlans",
  async (provider, { rejectWithValue }) => {
    try {
      const response = await api.get(`/utilities/data-plans?provider=${provider}`);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || "Failed to fetch data plans");
    }
  }
);

export const fetchUtilityHistory = createAsyncThunk(
  "utility/fetchUtilityHistory",
  async ({ page = 1, limit = 20 }, { rejectWithValue }) => {
    try {
      const response = await api.get("/utilities/history", {
        params: { page, limit },
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || "Failed to fetch history");
    }
  }
);

const utilitySlice = createSlice({
  name: "utility",
  initialState: {
    dataPlans: [],
    history: [],
    isLoading: false,
    error: null,
    total: 0,
  },
  reducers: {
    clearUtilityError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Buy Airtime
    builder
      .addCase(buyAirtime.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(buyAirtime.fulfilled, (state, action) => {
        state.isLoading = false;
        state.history.unshift(action.payload);
      })
      .addCase(buyAirtime.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    // Buy Data
    builder
      .addCase(buyData.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(buyData.fulfilled, (state, action) => {
        state.isLoading = false;
        state.history.unshift(action.payload);
      })
      .addCase(buyData.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    // Fetch Data Plans
    builder
      .addCase(fetchDataPlans.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchDataPlans.fulfilled, (state, action) => {
        state.isLoading = false;
        state.dataPlans = action.payload.plans || [];
      })
      .addCase(fetchDataPlans.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    // Fetch History
    builder
      .addCase(fetchUtilityHistory.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchUtilityHistory.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.meta.arg.page === 1) {
          state.history = action.payload.payments || [];
        } else {
          state.history = [...state.history, ...(action.payload.payments || [])];
        }
        state.total = action.payload.total || 0;
      })
      .addCase(fetchUtilityHistory.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export const { clearUtilityError } = utilitySlice.actions;
export default utilitySlice.reducer;

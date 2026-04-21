import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";

// Async thunks
export const fetchDeliveries = createAsyncThunk(
  "delivery/fetchDeliveries",
  async ({ page = 1, limit = 10, status = null }, { rejectWithValue }) => {
    try {
      const params = { page, limit };
      if (status) params.status = status;

      const response = await api.get("/delivery", { params });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || "Failed to fetch deliveries");
    }
  }
);

export const fetchDeliveryById = createAsyncThunk(
  "delivery/fetchDeliveryById",
  async (orderId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/delivery/${orderId}`);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || "Failed to fetch delivery");
    }
  }
);

export const createDelivery = createAsyncThunk(
  "delivery/createDelivery",
  async ({ orderData, pin }, { rejectWithValue }) => {
    try {
      const response = await api.post("/delivery", {
        ...orderData,
        pin,
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || "Failed to create delivery");
    }
  }
);

export const updateDeliveryStatus = createAsyncThunk(
  "delivery/updateDeliveryStatus",
  async ({ orderId, status, reason }, { rejectWithValue }) => {
    try {
      const response = await api.patch(`/delivery/${orderId}/status`, {
        status,
        cancellationReason: reason,
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || "Failed to update delivery status");
    }
  }
);

export const rateDelivery = createAsyncThunk(
  "delivery/rateDelivery",
  async ({ orderId, ratingData }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/delivery/${orderId}/rate`, ratingData);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || "Failed to submit rating");
    }
  }
);

export const getFareEstimate = createAsyncThunk(
  "delivery/getFareEstimate",
  async ({ pickupLat, pickupLng, dropoffLat, dropoffLng }, { rejectWithValue }) => {
    try {
      const response = await api.get("/delivery/estimate", {
        params: { pickupLat, pickupLng, dropoffLat, dropoffLng },
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || "Failed to get fare estimate");
    }
  }
);

const deliverySlice = createSlice({
  name: "delivery",
  initialState: {
    deliveries: [],
    currentDelivery: null,
    estimate: null,
    isLoading: false,
    isCreating: false,
    error: null,
    total: 0,
    page: 1,
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearCurrentDelivery: (state) => {
      state.currentDelivery = null;
    },
    clearEstimate: (state) => {
      state.estimate = null;
    },
    updateDeliveryFromSocket: (state, action) => {
      const { orderId, status, rider } = action.payload;

      // Update in deliveries list
      const deliveryIndex = state.deliveries.findIndex((d) => d.id === orderId);
      if (deliveryIndex !== -1) {
        state.deliveries[deliveryIndex].status = status;
        if (rider) {
          state.deliveries[deliveryIndex].rider = rider;
        }
      }

      // Update current delivery if it's the same one
      if (state.currentDelivery?.id === orderId) {
        state.currentDelivery.status = status;
        if (rider) {
          state.currentDelivery.rider = rider;
        }
      }
    },
  },
  extraReducers: (builder) => {
    // Fetch deliveries
    builder
      .addCase(fetchDeliveries.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchDeliveries.fulfilled, (state, action) => {
        state.isLoading = false;
        state.deliveries = action.meta.arg.page === 1
          ? action.payload.orders
          : [...state.deliveries, ...action.payload.orders];
        state.total = action.payload.total;
        state.page = action.meta.arg.page;
      })
      .addCase(fetchDeliveries.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    // Fetch delivery by ID
    builder
      .addCase(fetchDeliveryById.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchDeliveryById.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentDelivery = action.payload;
      })
      .addCase(fetchDeliveryById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    // Create delivery
    builder
      .addCase(createDelivery.pending, (state) => {
        state.isCreating = true;
        state.error = null;
      })
      .addCase(createDelivery.fulfilled, (state, action) => {
        state.isCreating = false;
        state.currentDelivery = action.payload;
        state.deliveries.unshift(action.payload);
      })
      .addCase(createDelivery.rejected, (state, action) => {
        state.isCreating = false;
        state.error = action.payload;
      });

    // Update delivery status
    builder
      .addCase(updateDeliveryStatus.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateDeliveryStatus.fulfilled, (state, action) => {
        state.isLoading = false;
        const updatedDelivery = action.payload;
        const index = state.deliveries.findIndex((d) => d.id === updatedDelivery.id);
        if (index !== -1) {
          state.deliveries[index] = updatedDelivery;
        }
        if (state.currentDelivery?.id === updatedDelivery.id) {
          state.currentDelivery = updatedDelivery;
        }
      })
      .addCase(updateDeliveryStatus.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    // Rate delivery
    builder
      .addCase(rateDelivery.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(rateDelivery.fulfilled, (state, action) => {
        state.isLoading = false;
        const ratedDelivery = action.payload;
        const index = state.deliveries.findIndex((d) => d.id === ratedDelivery.id);
        if (index !== -1) {
          state.deliveries[index].rating = ratedDelivery.rating;
        }
      })
      .addCase(rateDelivery.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    // Get fare estimate
    builder
      .addCase(getFareEstimate.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getFareEstimate.fulfilled, (state, action) => {
        state.isLoading = false;
        state.estimate = action.payload;
      })
      .addCase(getFareEstimate.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export const {
  clearError,
  clearCurrentDelivery,
  clearEstimate,
  updateDeliveryFromSocket,
} = deliverySlice.actions;

export default deliverySlice.reducer;

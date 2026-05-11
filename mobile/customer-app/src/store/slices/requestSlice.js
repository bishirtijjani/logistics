/**
 * Request slice — unified request state management
 * Handles MERCHANT_ORDER (any merchant fulfillment) and PACKAGE (courier) requests.
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import { newIdempotencyKey } from '../../services/idempotency';

// ============================================================
// Async Thunks
// ============================================================

// Fetch user's requests
export const fetchRequests = createAsyncThunk(
  'request/fetchRequests',
  async ({ type, status, page = 1, limit = 20 }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      if (type) params.append('type', type);
      if (status) params.append('status', status);
      params.append('page', page);
      params.append('limit', limit);

      const response = await api.get(`/requests?${params.toString()}`);
      return { requests: response.data.data, ...response.data.meta };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch requests');
    }
  }
);

// Fetch single request by ID
export const fetchRequestById = createAsyncThunk(
  'request/fetchRequestById',
  async (requestId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/requests/${requestId}`);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch request');
    }
  }
);

// Create new request
export const createRequest = createAsyncThunk(
  'request/createRequest',
  async (requestData, { rejectWithValue }) => {
    try {
      const response = await api.post('/requests', requestData, {
        headers: { 'Idempotency-Key': newIdempotencyKey() },
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create request');
    }
  }
);

// Update request status
export const updateRequestStatus = createAsyncThunk(
  'request/updateRequestStatus',
  async ({ requestId, status, reason }, { rejectWithValue }) => {
    try {
      const response = await api.patch(`/requests/${requestId}/status`, { status, reason });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update request status');
    }
  }
);

// Cancel request
export const cancelRequest = createAsyncThunk(
  'request/cancelRequest',
  async ({ requestId, reason }, { rejectWithValue }) => {
    try {
      const response = await api.delete(`/requests/${requestId}`, { data: { reason } });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to cancel request');
    }
  }
);

// Rate request
export const rateRequest = createAsyncThunk(
  'request/rateRequest',
  async ({ requestId, ratingData }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/requests/${requestId}/rate`, ratingData);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to rate request');
    }
  }
);

// ============================================================
// Slice
// ============================================================

const initialState = {
  requests: [],
  currentRequest: null,
  isLoading: false,
  isCreating: false,
  isUpdating: false,
  isCancelling: false,
  isRating: false,
  error: null,
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  },
};

const requestSlice = createSlice({
  name: 'request',
  initialState,
  reducers: {
    // Update request from socket event
    updateRequestFromSocket: (state, action) => {
      const { requestId, status, rider, ...otherData } = action.payload;
      
      // Update in list
      const index = state.requests.findIndex(r => r.id === requestId);
      if (index !== -1) {
        state.requests[index] = {
          ...state.requests[index],
          status,
          rider,
          ...otherData,
        };
      }
      
      // Update current request if matches
      if (state.currentRequest?.id === requestId) {
        state.currentRequest = {
          ...state.currentRequest,
          status,
          ...otherData,
        };
      }
    },
    updateRiderLocationFromSocket: (state, action) => {
      const { requestId, lat, lng } = action.payload;

      if (state.currentRequest?.id === requestId) {
        state.currentRequest.riderLocation = { lat, lng };
      }
    },
    // Clear error
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch requests
    builder
      .addCase(fetchRequests.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchRequests.fulfilled, (state, action) => {
        state.isLoading = false;
        state.requests = action.payload.requests || [];
        state.pagination = {
          page: action.payload.page || 1,
          limit: action.payload.limit || 20,
          total: action.payload.total || 0,
          totalPages: Math.ceil((action.payload.total || 0) / (action.payload.limit || 20)),
        };
      })
      .addCase(fetchRequests.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
    
    // Fetch request by ID
    builder
      .addCase(fetchRequestById.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchRequestById.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentRequest = action.payload;
      })
      .addCase(fetchRequestById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
    
    // Create request
    builder
      .addCase(createRequest.pending, (state) => {
        state.isCreating = true;
        state.error = null;
      })
      .addCase(createRequest.fulfilled, (state, action) => {
        state.isCreating = false;
        state.currentRequest = action.payload;
        state.requests.unshift(action.payload);
      })
      .addCase(createRequest.rejected, (state, action) => {
        state.isCreating = false;
        state.error = action.payload;
      });
    
    // Update status
    builder
      .addCase(updateRequestStatus.pending, (state) => {
        state.isUpdating = true;
        state.error = null;
      })
      .addCase(updateRequestStatus.fulfilled, (state, action) => {
        state.isUpdating = false;
        const index = state.requests.findIndex(r => r.id === action.payload.id);
        if (index !== -1) {
          state.requests[index] = action.payload;
        }
        if (state.currentRequest?.id === action.payload.id) {
          state.currentRequest = action.payload;
        }
      })
      .addCase(updateRequestStatus.rejected, (state, action) => {
        state.isUpdating = false;
        state.error = action.payload;
      });
    
    // Cancel request
    builder
      .addCase(cancelRequest.pending, (state) => {
        state.isCancelling = true;
        state.error = null;
      })
      .addCase(cancelRequest.fulfilled, (state, action) => {
        state.isCancelling = false;
        const index = state.requests.findIndex(r => r.id === action.payload.id);
        if (index !== -1) {
          state.requests[index] = action.payload;
        }
        if (state.currentRequest?.id === action.payload.id) {
          state.currentRequest = action.payload;
        }
      })
      .addCase(cancelRequest.rejected, (state, action) => {
        state.isCancelling = false;
        state.error = action.payload;
      });
    
    // Rate request
    builder
      .addCase(rateRequest.pending, (state) => {
        state.isRating = true;
        state.error = null;
      })
      .addCase(rateRequest.fulfilled, (state, action) => {
        state.isRating = false;
        if (state.currentRequest?.id === action.payload.requestId) {
          state.currentRequest.rating = action.payload;
        }
      })
      .addCase(rateRequest.rejected, (state, action) => {
        state.isRating = false;
        state.error = action.payload;
      });
  },
});

export const { updateRequestFromSocket, updateRiderLocationFromSocket, clearCurrentRequest, clearError } = requestSlice.actions;
export default requestSlice.reducer;

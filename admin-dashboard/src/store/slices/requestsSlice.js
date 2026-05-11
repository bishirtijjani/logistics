import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../lib/api'

export const fetchAllRequests = createAsyncThunk(
  'requests/fetchAll',
  async ({ page, limit, status, type, categoryId, categorySlug, startDate, endDate }) => {
    const params = new URLSearchParams({
      page: page || 1,
      limit: limit || 20,
      ...(status && { status }),
      ...(type && { type }),
      ...(categoryId && { categoryId }),
      ...(categorySlug && { categorySlug }),
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
    })
    const response = await api.get(`/admin/requests?${params}`)
    return response.data.data
  }
)

export const reassignRider = createAsyncThunk(
  'requests/reassignRider',
  async ({ requestId, newRiderId }) => {
    const response = await api.patch(`/admin/requests/${requestId}/reassign`, { newRiderId })
    return response.data.data
  }
)

export const forceCancelRequest = createAsyncThunk(
  'requests/forceCancel',
  async ({ requestId, reason }) => {
    const response = await api.patch(`/admin/requests/${requestId}/cancel`, { reason })
    return response.data.data
  }
)

export const adminUpdateStatus = createAsyncThunk(
  'requests/adminUpdateStatus',
  async ({ requestId, status, reason }) => {
    const response = await api.patch(`/admin/requests/${requestId}/status`, { status, reason })
    return response.data.data
  }
)

const requestsSlice = createSlice({
  name: 'requests',
  initialState: {
    requests: [],
    total: 0,
    page: 1,
    limit: 20,
    loading: false,
    error: null,
  },
  reducers: {
    resetRequests: (state) => {
      state.requests = []
      state.total = 0
      state.page = 1
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAllRequests.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchAllRequests.fulfilled, (state, action) => {
        state.loading = false
        state.requests = action.payload
        state.total = action.meta?.total || 0
        state.page = action.meta?.page || 1
        state.limit = action.meta?.limit || 20
      })
      .addCase(fetchAllRequests.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message
      })
      .addCase(reassignRider.fulfilled, (state, action) => {
        const index = state.requests.findIndex((r) => r.id === action.payload.id)
        if (index !== -1) {
          state.requests[index] = action.payload
        }
      })
      .addCase(forceCancelRequest.fulfilled, (state, action) => {
        const index = state.requests.findIndex((r) => r.id === action.payload.id)
        if (index !== -1) {
          state.requests[index] = action.payload
        }
      })
      .addCase(adminUpdateStatus.fulfilled, (state, action) => {
        const index = state.requests.findIndex((r) => r.id === action.payload.id)
        if (index !== -1) {
          state.requests[index] = action.payload
        }
      })
  },
})

export const { resetRequests } = requestsSlice.actions
export default requestsSlice.reducer

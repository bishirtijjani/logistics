import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../lib/api'

export const fetchAllRequests = createAsyncThunk(
  'requests/fetchAll',
  async ({ page, limit, status, type, categoryId, categorySlug, startDate, endDate, search }) => {
    const params = new URLSearchParams({
      page: page || 1,
      limit: limit || 20,
      ...(status && { status }),
      ...(type && { type }),
      ...(categoryId && { categoryId }),
      ...(categorySlug && { categorySlug }),
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
      ...(search && { search }),
    })
    const response = await api.get(`/admin/requests?${params}`)
    // Pagination totals live in response.data.meta, not in the thunk's own
    // action.meta - return both so the reducer can see them.
    return { requests: response.data.data, meta: response.data.meta }
  }
)

export const fetchRequestStats = createAsyncThunk(
  'requests/fetchStats',
  async () => {
    const response = await api.get('/admin/requests/stats')
    return response.data.data
  }
)

export const fetchRequestDetail = createAsyncThunk(
  'requests/fetchDetail',
  async (requestId) => {
    const response = await api.get(`/admin/requests/${requestId}`)
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

// Swap the mutated request into the list (the API returns it with full
// relations) and keep the open detail view in sync.
const applyUpdatedRequest = (state, action) => {
  const index = state.requests.findIndex((r) => r.id === action.payload.id)
  if (index !== -1) {
    state.requests[index] = action.payload
  }
  if (state.detail?.id === action.payload.id) {
    state.detail = { ...state.detail, ...action.payload }
  }
}

const requestsSlice = createSlice({
  name: 'requests',
  initialState: {
    requests: [],
    total: 0,
    page: 1,
    limit: 20,
    loading: false,
    error: null,
    stats: null,
    detail: null,
    detailLoading: false,
  },
  reducers: {
    resetRequests: (state) => {
      state.requests = []
      state.total = 0
      state.page = 1
    },
    clearRequestDetail: (state) => {
      state.detail = null
      state.detailLoading = false
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
        state.requests = action.payload.requests
        state.total = action.payload.meta?.total || 0
        state.page = action.payload.meta?.page || 1
        state.limit = action.payload.meta?.limit || 20
      })
      .addCase(fetchAllRequests.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message
      })
      .addCase(fetchRequestStats.fulfilled, (state, action) => {
        state.stats = action.payload
      })
      .addCase(fetchRequestDetail.pending, (state) => {
        state.detailLoading = true
      })
      .addCase(fetchRequestDetail.fulfilled, (state, action) => {
        state.detailLoading = false
        state.detail = action.payload
      })
      .addCase(fetchRequestDetail.rejected, (state) => {
        state.detailLoading = false
      })
      .addCase(reassignRider.fulfilled, applyUpdatedRequest)
      .addCase(forceCancelRequest.fulfilled, applyUpdatedRequest)
      .addCase(adminUpdateStatus.fulfilled, applyUpdatedRequest)
  },
})

export const { resetRequests, clearRequestDetail } = requestsSlice.actions
export default requestsSlice.reducer

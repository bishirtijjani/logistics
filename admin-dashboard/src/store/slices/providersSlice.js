import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../lib/api'

export const fetchAllProviders = createAsyncThunk(
  'providers/fetchAll',
  async ({ page, limit, type, status }) => {
    const params = new URLSearchParams({
      page: page || 1,
      limit: limit || 20,
      ...(type && { type }),
      ...(status && { status }),
    })
    const response = await api.get(`/admin/providers?${params}`)
    return response.data.data
  }
)

export const approveProvider = createAsyncThunk(
  'providers/approve',
  async (providerId) => {
    const response = await api.patch(`/admin/providers/${providerId}/approve`)
    return response.data.data
  }
)

export const rejectProvider = createAsyncThunk(
  'providers/reject',
  async ({ providerId, reason }) => {
    const response = await api.patch(`/admin/providers/${providerId}/reject`, { reason })
    return response.data.data
  }
)

export const suspendProvider = createAsyncThunk(
  'providers/suspend',
  async ({ providerId, reason }) => {
    const response = await api.patch(`/admin/providers/${providerId}/suspend`, { reason })
    return response.data.data
  }
)

export const unsuspendProvider = createAsyncThunk(
  'providers/unsuspend',
  async (providerId) => {
    const response = await api.patch(`/admin/providers/${providerId}/unsuspend`)
    return response.data.data
  }
)

export const updateProviderCommission = createAsyncThunk(
  'providers/updateCommission',
  async ({ providerId, commissionRate }) => {
    const response = await api.patch(`/admin/providers/${providerId}/commission`, { commissionRate })
    return response.data.data
  }
)

const providersSlice = createSlice({
  name: 'providers',
  initialState: {
    providers: [],
    total: 0,
    page: 1,
    limit: 20,
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAllProviders.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchAllProviders.fulfilled, (state, action) => {
        state.loading = false
        state.providers = action.payload.providers
        state.total = action.payload.total
        state.page = action.payload.page
        state.limit = action.payload.limit
      })
      .addCase(fetchAllProviders.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message
      })
      .addCase(approveProvider.fulfilled, (state, action) => {
        const index = state.providers.findIndex((p) => p.id === action.payload.id)
        if (index !== -1) {
          state.providers[index] = action.payload
        }
      })
      .addCase(rejectProvider.fulfilled, (state, action) => {
        const index = state.providers.findIndex((p) => p.id === action.payload.id)
        if (index !== -1) {
          state.providers[index] = action.payload
        }
      })
      .addCase(suspendProvider.fulfilled, (state, action) => {
        const index = state.providers.findIndex((p) => p.id === action.payload.id)
        if (index !== -1) {
          state.providers[index] = action.payload
        }
      })
      .addCase(unsuspendProvider.fulfilled, (state, action) => {
        const index = state.providers.findIndex((p) => p.id === action.payload.id)
        if (index !== -1) {
          state.providers[index] = action.payload
        }
      })
      .addCase(updateProviderCommission.fulfilled, (state, action) => {
        const index = state.providers.findIndex((p) => p.id === action.payload.id)
        if (index !== -1) {
          state.providers[index] = action.payload
        }
      })
  },
})

export default providersSlice.reducer

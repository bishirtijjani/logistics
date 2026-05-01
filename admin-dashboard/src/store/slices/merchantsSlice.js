import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../lib/api'

export const fetchAllMerchants = createAsyncThunk(
  'merchants/fetchAll',
  async ({ page, limit, type, status }) => {
    const params = new URLSearchParams({
      page: page || 1,
      limit: limit || 20,
      ...(type && { type }),
      ...(status && { status }),
    })
    const response = await api.get(`/admin/merchants?${params}`)
    return response.data.data
  }
)

export const approveMerchant = createAsyncThunk(
  'merchants/approve',
  async (merchantId) => {
    const response = await api.patch(`/admin/merchants/${merchantId}/approve`)
    return response.data.data
  }
)

export const rejectMerchant = createAsyncThunk(
  'merchants/reject',
  async ({ merchantId, reason }) => {
    const response = await api.patch(`/admin/merchants/${merchantId}/reject`, { reason })
    return response.data.data
  }
)

export const suspendMerchant = createAsyncThunk(
  'merchants/suspend',
  async ({ merchantId, reason }) => {
    const response = await api.patch(`/admin/merchants/${merchantId}/suspend`, { reason })
    return response.data.data
  }
)

export const unsuspendMerchant = createAsyncThunk(
  'merchants/unsuspend',
  async (merchantId) => {
    const response = await api.patch(`/admin/merchants/${merchantId}/unsuspend`)
    return response.data.data
  }
)

export const updateMerchantCommission = createAsyncThunk(
  'merchants/updateCommission',
  async ({ merchantId, commissionRate }) => {
    const response = await api.patch(`/admin/merchants/${merchantId}/commission`, { commissionRate })
    return response.data.data
  }
)

export const createMerchant = createAsyncThunk(
  'merchants/create',
  async (merchantData) => {
    const response = await api.post('/admin/merchants', merchantData)
    return response.data.data
  }
)

export const deleteMerchant = createAsyncThunk(
  'merchants/delete',
  async (merchantId) => {
    const response = await api.delete(`/admin/merchants/${merchantId}`)
    return merchantId
  }
)

const merchantsSlice = createSlice({
  name: 'merchants',
  initialState: {
    merchants: [],
    total: 0,
    page: 1,
    limit: 20,
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAllMerchants.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchAllMerchants.fulfilled, (state, action) => {
        state.loading = false
        state.merchants = action.payload
        state.total = action.meta?.total || 0
        state.page = action.meta?.page || 1
        state.limit = action.meta?.limit || 20
      })
      .addCase(fetchAllMerchants.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message
      })
      .addCase(approveMerchant.fulfilled, (state, action) => {
        const index = state.merchants.findIndex((p) => p.id === action.payload.id)
        if (index !== -1) {
          state.merchants[index] = action.payload
        }
      })
      .addCase(rejectMerchant.fulfilled, (state, action) => {
        const index = state.merchants.findIndex((p) => p.id === action.payload.id)
        if (index !== -1) {
          state.merchants[index] = action.payload
        }
      })
      .addCase(suspendMerchant.fulfilled, (state, action) => {
        const index = state.merchants.findIndex((p) => p.id === action.payload.id)
        if (index !== -1) {
          state.merchants[index] = action.payload
        }
      })
      .addCase(unsuspendMerchant.fulfilled, (state, action) => {
        const index = state.merchants.findIndex((p) => p.id === action.payload.id)
        if (index !== -1) {
          state.merchants[index] = action.payload
        }
      })
      .addCase(updateMerchantCommission.fulfilled, (state, action) => {
        const index = state.merchants.findIndex((p) => p.id === action.payload.id)
        if (index !== -1) {
          state.merchants[index] = action.payload
        }
      })
      .addCase(createMerchant.fulfilled, (state, action) => {
        state.merchants.unshift(action.payload)
        state.total += 1
      })
      .addCase(deleteMerchant.fulfilled, (state, action) => {
        state.merchants = state.merchants.filter((m) => m.id !== action.payload)
        state.total -= 1
      })
  },
})

export default merchantsSlice.reducer

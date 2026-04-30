import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../lib/api'

export const fetchAllRiders = createAsyncThunk(
  'riders/fetchAll',
  async ({ page, limit, status, availability }) => {
    const params = new URLSearchParams({
      page: page || 1,
      limit: limit || 20,
      ...(status && { status }),
      ...(availability && { availability }),
    })
    const response = await api.get(`/admin/riders?${params}`)
    return response.data.data
  }
)

export const fetchRiderEarnings = createAsyncThunk(
  'riders/fetchEarnings',
  async ({ riderId, startDate, endDate }) => {
    const params = new URLSearchParams({
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
    })
    const response = await api.get(`/admin/riders/${riderId}/earnings?${params}`)
    return response.data.data
  }
)

export const fetchRiderDeliveryHistory = createAsyncThunk(
  'riders/fetchDeliveryHistory',
  async ({ riderId, page, limit }) => {
    const params = new URLSearchParams({
      page: page || 1,
      limit: limit || 20,
    })
    const response = await api.get(`/admin/riders/${riderId}/deliveries?${params}`)
    return response.data.data
  }
)

const ridersSlice = createSlice({
  name: 'riders',
  initialState: {
    riders: [],
    total: 0,
    page: 1,
    limit: 20,
    selectedRider: null,
    riderEarnings: null,
    riderDeliveries: null,
    loading: false,
    error: null,
  },
  reducers: {
    clearSelectedRider: (state) => {
      state.selectedRider = null
      state.riderEarnings = null
      state.riderDeliveries = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAllRiders.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchAllRiders.fulfilled, (state, action) => {
        state.loading = false
        state.riders = action.payload
        state.total = action.meta?.total || 0
        state.page = action.meta?.page || 1
        state.limit = action.meta?.limit || 20
      })
      .addCase(fetchAllRiders.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message
      })
      .addCase(fetchRiderEarnings.fulfilled, (state, action) => {
        state.riderEarnings = action.payload
      })
      .addCase(fetchRiderDeliveryHistory.fulfilled, (state, action) => {
        state.riderDeliveries = action.payload
      })
  },
})

export const { clearSelectedRider } = ridersSlice.actions
export default ridersSlice.reducer

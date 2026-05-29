import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../lib/api'
import { toast } from 'sonner'

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

// Approve/reject a rider awaiting approval. Folded in from the old
// pendingRiders slice so review now happens inline on the Riders page.
export const reviewRider = createAsyncThunk(
  'riders/review',
  async ({ riderId, decision }) => {
    const response = await api.patch(`/admin/riders/${riderId}/review`, { decision })
    toast.success(`Rider ${decision === 'approve' ? 'approved' : 'rejected'}`)
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
      .addCase(reviewRider.fulfilled, (state, action) => {
        // Reflect the new status in place so the row stays visible (and the
        // filter can still narrow to it) rather than disappearing on review.
        const updated = action.payload
        const index = state.riders.findIndex((r) => r.id === updated?.id)
        if (index !== -1) {
          state.riders[index] = { ...state.riders[index], ...updated }
        }
        if (state.selectedRider?.id === updated?.id) {
          state.selectedRider = { ...state.selectedRider, ...updated }
        }
      })
      .addCase(reviewRider.rejected, () => {
        toast.error('Failed to review rider')
      })
  },
})

export const { clearSelectedRider } = ridersSlice.actions
export default ridersSlice.reducer

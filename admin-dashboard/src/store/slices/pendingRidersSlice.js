import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../lib/api'
import { toast } from 'sonner'

export const fetchPendingRiders = createAsyncThunk(
  'pendingRiders/fetchAll',
  async ({ page, limit }) => {
    const params = new URLSearchParams({
      page: page || 1,
      limit: limit || 20,
    })
    const response = await api.get(`/admin/riders/pending?${params}`)
    return response.data.data
  }
)

export const reviewRider = createAsyncThunk(
  'pendingRiders/review',
  async ({ riderId, decision }) => {
    const response = await api.patch(`/admin/riders/${riderId}/review`, { decision })
    toast.success(`Rider ${decision === 'approve' ? 'approved' : 'rejected'}`)
    return response.data.data
  }
)

const pendingRidersSlice = createSlice({
  name: 'pendingRiders',
  initialState: {
    riders: [],
    total: 0,
    page: 1,
    limit: 20,
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchPendingRiders.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchPendingRiders.fulfilled, (state, action) => {
        state.loading = false
        state.riders = action.payload
        state.total = action.meta?.total || 0
        state.page = action.meta?.page || 1
        state.limit = action.meta?.limit || 20
      })
      .addCase(fetchPendingRiders.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message
      })
      .addCase(reviewRider.fulfilled, (state, action) => {
        const index = state.riders.findIndex((r) => r.id === action.payload.id)
        if (index !== -1) {
          state.riders.splice(index, 1)
          state.total -= 1
        }
      })
      .addCase(reviewRider.rejected, (state, action) => {
        toast.error('Failed to review rider')
      })
  },
})

export default pendingRidersSlice.reducer

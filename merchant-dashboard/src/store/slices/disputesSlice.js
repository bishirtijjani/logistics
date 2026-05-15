import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../lib/api'

// ============================================================
// Merchant — disputes raised against orders fulfilled by this merchant
// ============================================================

export const fetchMyDisputes = createAsyncThunk(
  'disputes/fetchMine',
  async ({ status, page = 1, limit = 20 } = {}) => {
    const params = new URLSearchParams({
      page,
      limit,
      ...(status && { status }),
    })
    const response = await api.get(`/support/disputes?${params}`)
    return response.data
  },
)

export const fetchDisputeDetail = createAsyncThunk(
  'disputes/fetchDetail',
  async (disputeId) => {
    const response = await api.get(`/support/disputes/${disputeId}`)
    return response.data.data
  },
)

export const postDisputeMessage = createAsyncThunk(
  'disputes/postMessage',
  async ({ disputeId, body, attachmentUrls = [] }) => {
    const response = await api.post(`/support/disputes/${disputeId}/messages`, { body, attachmentUrls })
    return response.data.data
  },
)

const disputesSlice = createSlice({
  name: 'disputes',
  initialState: {
    disputes: [],
    total: 0,
    page: 1,
    limit: 20,
    loading: false,
    error: null,
    selected: null,
    selectedLoading: false,
  },
  reducers: {
    clearSelectedDispute(state) {
      state.selected = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMyDisputes.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchMyDisputes.fulfilled, (state, action) => {
        state.loading = false
        state.disputes = action.payload?.data || []
        state.total = action.payload?.meta?.total || 0
        state.page = action.payload?.meta?.page || 1
        state.limit = action.payload?.meta?.limit || 20
      })
      .addCase(fetchMyDisputes.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message
      })

      .addCase(fetchDisputeDetail.pending, (state) => {
        state.selectedLoading = true
      })
      .addCase(fetchDisputeDetail.fulfilled, (state, action) => {
        state.selectedLoading = false
        state.selected = action.payload
      })
      .addCase(fetchDisputeDetail.rejected, (state) => {
        state.selectedLoading = false
      })

      .addCase(postDisputeMessage.fulfilled, (state, action) => {
        if (state.selected && action.payload) {
          state.selected.messages = [...(state.selected.messages || []), action.payload]
          state.selected.lastActivityAt = action.payload.createdAt
        }
      })
  },
})

export const { clearSelectedDispute } = disputesSlice.actions
export default disputesSlice.reducer

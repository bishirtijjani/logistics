import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../lib/api'

// ============================================================
// Disputes — admin
// ============================================================

export const fetchDisputes = createAsyncThunk(
  'disputes/fetchAll',
  async ({ status, category, page = 1, limit = 20 } = {}) => {
    const params = new URLSearchParams({
      page,
      limit,
      ...(status && { status }),
      ...(category && { category }),
    })
    const response = await api.get(`/admin/disputes?${params}`)
    return response.data
  },
)

export const fetchDisputeDetail = createAsyncThunk(
  'disputes/fetchDetail',
  async (disputeId) => {
    const response = await api.get(`/admin/disputes/${disputeId}`)
    return response.data.data
  },
)

export const resolveDispute = createAsyncThunk(
  'disputes/resolve',
  async ({ disputeId, resolution, resolutionNotes, refundAmount }) => {
    const response = await api.patch(`/admin/disputes/${disputeId}/resolve`, {
      resolution,
      resolutionNotes,
      refundAmount,
    })
    return response.data.data
  },
)

export const postDisputeMessage = createAsyncThunk(
  'disputes/postMessage',
  async ({ disputeId, body, attachmentUrls = [], isInternal = false }) => {
    const response = await api.post(`/admin/disputes/${disputeId}/messages`, {
      body,
      attachmentUrls,
      isInternal,
    })
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
      .addCase(fetchDisputes.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchDisputes.fulfilled, (state, action) => {
        state.loading = false
        state.disputes = action.payload?.data || []
        state.total = action.payload?.meta?.total || 0
        state.page = action.payload?.meta?.page || 1
        state.limit = action.payload?.meta?.limit || 20
      })
      .addCase(fetchDisputes.rejected, (state, action) => {
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

      .addCase(resolveDispute.fulfilled, (state, action) => {
        if (!action.payload) return
        const idx = state.disputes.findIndex((d) => d.id === action.payload.id)
        if (idx !== -1) state.disputes[idx] = { ...state.disputes[idx], ...action.payload }
        if (state.selected?.id === action.payload.id) {
          state.selected = { ...state.selected, ...action.payload }
        }
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

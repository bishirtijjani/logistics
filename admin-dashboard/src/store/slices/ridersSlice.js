import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../lib/api'
import { toast } from 'sonner'

// The admin API wraps lists as { data: [...], meta: { page, limit, total, totalPages } }.
// We carry both through the thunk so the reducer can read real pagination
// (the previous code read action.meta - the redux thunk meta - which never
// holds these, so total/page silently fell back to defaults).
export const fetchAllRiders = createAsyncThunk(
  'riders/fetchAll',
  async ({ page, limit, status, availability, search }) => {
    const params = new URLSearchParams({
      page: page || 1,
      limit: limit || 20,
      ...(status && { status }),
      ...(availability && { availability }),
      ...(search && { search }),
    })
    const response = await api.get(`/admin/riders?${params}`)
    return { data: response.data.data, meta: response.data.meta }
  }
)

export const fetchPendingRiders = createAsyncThunk(
  'riders/fetchPending',
  async ({ page, limit } = {}) => {
    const params = new URLSearchParams({ page: page || 1, limit: limit || 20 })
    const response = await api.get(`/admin/riders/pending?${params}`)
    return { data: response.data.data, meta: response.data.meta }
  }
)

export const fetchRiderStats = createAsyncThunk('riders/fetchStats', async () => {
  const response = await api.get('/admin/riders/stats')
  return response.data.data
})

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

export const fetchRiderDetail = createAsyncThunk(
  'riders/fetchDetail',
  async (riderId) => {
    const response = await api.get(`/admin/riders/${riderId}`)
    return response.data.data
  }
)

export const fetchRiderTransactions = createAsyncThunk(
  'riders/fetchTransactions',
  async ({ riderId, page, limit, type, status }) => {
    const params = new URLSearchParams({
      page: page || 1,
      limit: limit || 20,
      ...(type && { type }),
      ...(status && { status }),
    })
    const response = await api.get(`/admin/riders/${riderId}/transactions?${params}`)
    return { data: response.data.data, meta: response.data.meta }
  }
)

export const fetchRiderTransactionReceipt = createAsyncThunk(
  'riders/fetchTransactionReceipt',
  async ({ riderId, transactionId }) => {
    const response = await api.get(`/admin/riders/${riderId}/transactions/${transactionId}`)
    return response.data.data
  }
)

export const fetchRiderUtilityPayments = createAsyncThunk(
  'riders/fetchUtilityPayments',
  async ({ riderId, page, limit, type, status }) => {
    const params = new URLSearchParams({
      page: page || 1,
      limit: limit || 20,
      ...(type && { type }),
      ...(status && { status }),
    })
    const response = await api.get(`/admin/riders/${riderId}/utility-payments?${params}`)
    return { data: response.data.data, meta: response.data.meta }
  }
)

export const fetchRiderUtilityPaymentDetail = createAsyncThunk(
  'riders/fetchUtilityPaymentDetail',
  async ({ riderId, paymentId }) => {
    const response = await api.get(`/admin/riders/${riderId}/utility-payments/${paymentId}`)
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

export const suspendRider = createAsyncThunk(
  'riders/suspend',
  async ({ riderId, reason }) => {
    const response = await api.patch(`/admin/riders/${riderId}/suspend`, { reason })
    return response.data.data
  }
)

export const unsuspendRider = createAsyncThunk(
  'riders/unsuspend',
  async ({ riderId }) => {
    const response = await api.patch(`/admin/riders/${riderId}/unsuspend`, {})
    return response.data.data
  }
)

// Flips availability to OFFLINE and clears live presence. Returns only
// { riderId, availability } - so we merge just those fields into the row.
export const forceOfflineRider = createAsyncThunk(
  'riders/forceOffline',
  async ({ riderId, reason }) => {
    const response = await api.post(`/admin/riders/${riderId}/force-offline`, { reason })
    return response.data.data
  }
)

// Patch a rider in-place across the all-riders list + the open drawer, so a
// mutation reflects immediately without a refetch.
const patchRiderInState = (state, updated) => {
  if (!updated?.riderId && !updated?.id) return
  const id = updated.id || updated.riderId
  const idx = state.riders.findIndex((r) => r.id === id)
  if (idx !== -1) state.riders[idx] = { ...state.riders[idx], ...updated }
  if (state.selectedRider?.id === id) {
    state.selectedRider = { ...state.selectedRider, ...updated }
  }
}

const ridersSlice = createSlice({
  name: 'riders',
  initialState: {
    riders: [],
    total: 0,
    page: 1,
    limit: 20,
    loading: false,
    pending: [],
    pendingTotal: 0,
    pendingLoading: false,
    stats: null,
    selectedRider: null,
    riderDetail: { data: null, loading: false, error: null },
    riderEarnings: null,
    riderDeliveries: null,
    riderTransactions: { data: [], total: 0, page: 1, limit: 20, loading: false, error: null },
    transactionReceipt: { data: null, loading: false, error: null },
    utilityPayments: { data: [], total: 0, page: 1, limit: 20, loading: false, error: null },
    utilityPaymentDetail: { data: null, loading: false, error: null },
    error: null,
  },
  reducers: {
    clearSelectedRider: (state) => {
      state.selectedRider = null
      state.riderEarnings = null
      state.riderDeliveries = null
    },
    clearRiderDetail: (state) => {
      state.riderDetail = { data: null, loading: false, error: null }
      state.riderTransactions = { data: [], total: 0, page: 1, limit: 20, loading: false, error: null }
      state.transactionReceipt = { data: null, loading: false, error: null }
      state.utilityPayments = { data: [], total: 0, page: 1, limit: 20, loading: false, error: null }
      state.utilityPaymentDetail = { data: null, loading: false, error: null }
    },
    clearRiderTransactionReceipt: (state) => {
      state.transactionReceipt = { data: null, loading: false, error: null }
    },
    clearRiderUtilityPaymentDetail: (state) => {
      state.utilityPaymentDetail = { data: null, loading: false, error: null }
    },
    setSelectedRider: (state, action) => {
      state.selectedRider = action.payload
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
        state.riders = action.payload.data
        state.total = action.payload.meta?.total ?? action.payload.data.length
        state.page = action.payload.meta?.page ?? 1
        state.limit = action.payload.meta?.limit ?? 20
      })
      .addCase(fetchAllRiders.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message
      })
      .addCase(fetchPendingRiders.pending, (state) => {
        state.pendingLoading = true
      })
      .addCase(fetchPendingRiders.fulfilled, (state, action) => {
        state.pendingLoading = false
        state.pending = action.payload.data
        state.pendingTotal = action.payload.meta?.total ?? action.payload.data.length
      })
      .addCase(fetchPendingRiders.rejected, (state) => {
        state.pendingLoading = false
      })
      .addCase(fetchRiderStats.fulfilled, (state, action) => {
        state.stats = action.payload
      })
      .addCase(fetchRiderEarnings.fulfilled, (state, action) => {
        state.riderEarnings = action.payload
      })
      .addCase(fetchRiderDeliveryHistory.fulfilled, (state, action) => {
        state.riderDeliveries = action.payload
      })
      .addCase(fetchRiderDetail.pending, (state) => {
        state.riderDetail.loading = true
        state.riderDetail.error = null
      })
      .addCase(fetchRiderDetail.fulfilled, (state, action) => {
        state.riderDetail.loading = false
        state.riderDetail.data = action.payload
      })
      .addCase(fetchRiderDetail.rejected, (state, action) => {
        state.riderDetail.loading = false
        state.riderDetail.error = action.error.message
      })
      .addCase(fetchRiderTransactions.pending, (state) => {
        state.riderTransactions.loading = true
        state.riderTransactions.error = null
      })
      .addCase(fetchRiderTransactions.fulfilled, (state, action) => {
        state.riderTransactions.loading = false
        state.riderTransactions.data = action.payload.data
        state.riderTransactions.total = action.payload.meta?.total || 0
        state.riderTransactions.page = action.payload.meta?.page || 1
        state.riderTransactions.limit = action.payload.meta?.limit || 20
      })
      .addCase(fetchRiderTransactions.rejected, (state, action) => {
        state.riderTransactions.loading = false
        state.riderTransactions.error = action.error.message
      })
      .addCase(fetchRiderTransactionReceipt.pending, (state) => {
        state.transactionReceipt.loading = true
        state.transactionReceipt.error = null
      })
      .addCase(fetchRiderTransactionReceipt.fulfilled, (state, action) => {
        state.transactionReceipt.loading = false
        state.transactionReceipt.data = action.payload
      })
      .addCase(fetchRiderTransactionReceipt.rejected, (state, action) => {
        state.transactionReceipt.loading = false
        state.transactionReceipt.error = action.error.message
      })
      .addCase(fetchRiderUtilityPayments.pending, (state) => {
        state.utilityPayments.loading = true
        state.utilityPayments.error = null
      })
      .addCase(fetchRiderUtilityPayments.fulfilled, (state, action) => {
        state.utilityPayments.loading = false
        state.utilityPayments.data = action.payload.data
        state.utilityPayments.total = action.payload.meta?.total || 0
        state.utilityPayments.page = action.payload.meta?.page || 1
        state.utilityPayments.limit = action.payload.meta?.limit || 20
      })
      .addCase(fetchRiderUtilityPayments.rejected, (state, action) => {
        state.utilityPayments.loading = false
        state.utilityPayments.error = action.error.message
      })
      .addCase(fetchRiderUtilityPaymentDetail.pending, (state) => {
        state.utilityPaymentDetail.loading = true
        state.utilityPaymentDetail.error = null
      })
      .addCase(fetchRiderUtilityPaymentDetail.fulfilled, (state, action) => {
        state.utilityPaymentDetail.loading = false
        state.utilityPaymentDetail.data = action.payload
      })
      .addCase(fetchRiderUtilityPaymentDetail.rejected, (state, action) => {
        state.utilityPaymentDetail.loading = false
        state.utilityPaymentDetail.error = action.error.message
      })
      .addCase(reviewRider.fulfilled, (state, action) => {
        const updated = action.payload
        patchRiderInState(state, updated)
        // A reviewed rider is no longer pending - drop it from the queue.
        state.pending = state.pending.filter((r) => r.id !== updated?.id)
        if (state.pendingTotal > 0) state.pendingTotal -= 1
        if (state.stats) {
          state.stats.pending = Math.max(0, state.stats.pending - 1)
          if (updated?.status === 'APPROVED') state.stats.approved += 1
          else if (updated?.status === 'REJECTED') state.stats.rejected += 1
        }
      })
      .addCase(reviewRider.rejected, () => {
        toast.error('Failed to review rider')
      })
      .addCase(suspendRider.fulfilled, (state, action) => {
        patchRiderInState(state, action.payload)
        if (state.stats) {
          state.stats.approved = Math.max(0, state.stats.approved - 1)
          state.stats.suspended += 1
        }
      })
      .addCase(unsuspendRider.fulfilled, (state, action) => {
        patchRiderInState(state, action.payload)
        if (state.stats) {
          state.stats.suspended = Math.max(0, state.stats.suspended - 1)
          state.stats.approved += 1
        }
      })
      .addCase(forceOfflineRider.fulfilled, (state, action) => {
        // payload = { riderId, availability: 'OFFLINE' }
        patchRiderInState(state, action.payload)
        if (state.stats && state.stats.online > 0) state.stats.online -= 1
      })
  },
})

export const {
  clearSelectedRider,
  setSelectedRider,
  clearRiderDetail,
  clearRiderTransactionReceipt,
  clearRiderUtilityPaymentDetail,
} = ridersSlice.actions
export default ridersSlice.reducer

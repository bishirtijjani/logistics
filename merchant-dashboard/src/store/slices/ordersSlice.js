import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../lib/api'

export const fetchOrders = createAsyncThunk(
  'orders/fetchAll',
  async ({ merchantId, page = 1, limit = 20, status, search, startDate, endDate, minPrice, maxPrice }) => {
    const params = new URLSearchParams({
      page,
      limit,
      ...(status && { status }),
      ...(search && { search }),
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
      ...(minPrice && { minPrice }),
      ...(maxPrice && { maxPrice }),
    })
    const response = await api.get(`/merchants/merchant/${merchantId}/orders?${params}`)
    // Backend wraps list responses as { data: [...orders], meta: { page, limit, total } }.
    // The reducer below expects requests/total/page/limit on the payload, so
    // reassemble that shape here instead of returning the bare array.
    return { requests: response.data.data, ...response.data.meta }
  }
)

export const acceptOrder = createAsyncThunk(
  'orders/accept',
  async ({ merchantId, requestId }) => {
    const response = await api.patch(`/merchants/merchant/${merchantId}/orders/${requestId}/accept`)
    return response.data.data
  }
)

export const rejectOrder = createAsyncThunk(
  'orders/reject',
  async ({ merchantId, requestId, reason }) => {
    const response = await api.patch(`/merchants/merchant/${merchantId}/orders/${requestId}/reject`, { reason })
    return response.data.data
  }
)

export const updateOrderStatus = createAsyncThunk(
  'orders/updateStatus',
  async ({ merchantId, requestId, status }) => {
    const response = await api.patch(`/merchants/merchant/${merchantId}/orders/${requestId}/status`, { status })
    return response.data.data
  }
)

const ordersSlice = createSlice({
  name: 'orders',
  initialState: {
    orders: [],
    total: 0,
    page: 1,
    limit: 20,
    loading: false,
    error: null,
  },
  reducers: {
    // Patch a single order in place from a socket event (request:status:changed
    // fanned out to the merchant room). Preferred over a full refetch: it keeps
    // the current filter/search/page intact and updates instantly, and an open
    // OrderDetailsModal reading the live order flips its status + reveals the
    // tracking map as the rider progresses. On DELIVERED the payload also carries
    // the POD urls, so merge those too.
    orderStatusPatched: (state, action) => {
      const { requestId, status, podPhotoUrl, podSignatureUrl, podCapturedAt } = action.payload || {}
      if (!requestId) return
      const order = state.orders.find((o) => o.id === requestId)
      if (!order) return
      if (status) order.status = status
      if (podPhotoUrl !== undefined) order.podPhotoUrl = podPhotoUrl
      if (podSignatureUrl !== undefined) order.podSignatureUrl = podSignatureUrl
      if (podCapturedAt !== undefined) order.podCapturedAt = podCapturedAt
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchOrders.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchOrders.fulfilled, (state, action) => {
        state.loading = false
        state.orders = action.payload.requests || action.payload.orders || []
        state.total = action.payload.total
        state.page = action.payload.page
        state.limit = action.payload.limit
      })
      .addCase(fetchOrders.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message
      })
      .addCase(acceptOrder.fulfilled, (state, action) => {
        const index = state.orders.findIndex((o) => o.id === action.payload.id)
        if (index !== -1) {
          state.orders[index] = action.payload
        }
      })
      .addCase(rejectOrder.fulfilled, (state, action) => {
        const index = state.orders.findIndex((o) => o.id === action.payload.id)
        if (index !== -1) {
          state.orders[index] = action.payload
        }
      })
      .addCase(updateOrderStatus.fulfilled, (state, action) => {
        const index = state.orders.findIndex((o) => o.id === action.payload.id)
        if (index !== -1) {
          state.orders[index] = action.payload
        }
      })
  },
})

export const { orderStatusPatched } = ordersSlice.actions

export default ordersSlice.reducer

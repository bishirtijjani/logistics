import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../lib/api'

export const fetchOrders = createAsyncThunk(
  'orders/fetchAll',
  async ({ merchantId, page = 1, limit = 20, status }) => {
    const params = new URLSearchParams({
      page,
      limit,
      ...(status && { status }),
    })
    const response = await api.get(`/merchants/merchant/${merchantId}/orders?${params}`)
    return response.data.data
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
  reducers: {},
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

export default ordersSlice.reducer

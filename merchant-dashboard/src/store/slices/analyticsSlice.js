import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../lib/api'

export const fetchSalesSummary = createAsyncThunk(
  'analytics/fetchSalesSummary',
  async ({ providerId, period = '7d' }) => {
    const response = await api.get(`/providers/merchant/${providerId}/analytics/sales?period=${period}`)
    return response.data.data
  }
)

export const fetchOrderHistory = createAsyncThunk(
  'analytics/fetchOrderHistory',
  async ({ providerId, page = 1, limit = 20, startDate, endDate }) => {
    const params = new URLSearchParams({
      page,
      limit,
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
    })
    const response = await api.get(`/providers/merchant/${providerId}/analytics/orders?${params}`)
    return response.data.data
  }
)

export const fetchEarningsBreakdown = createAsyncThunk(
  'analytics/fetchEarningsBreakdown',
  async ({ providerId, period = '7d' }) => {
    const response = await api.get(`/providers/merchant/${providerId}/analytics/earnings?period=${period}`)
    return response.data.data
  }
)

const analyticsSlice = createSlice({
  name: 'analytics',
  initialState: {
    salesSummary: null,
    orderHistory: [],
    orderHistoryTotal: 0,
    earningsBreakdown: null,
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSalesSummary.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchSalesSummary.fulfilled, (state, action) => {
        state.loading = false
        state.salesSummary = action.payload
      })
      .addCase(fetchSalesSummary.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message
      })
      .addCase(fetchOrderHistory.fulfilled, (state, action) => {
        state.orderHistory = action.payload.requests || action.payload.orders || []
        state.orderHistoryTotal = action.payload.total
      })
      .addCase(fetchEarningsBreakdown.fulfilled, (state, action) => {
        state.earningsBreakdown = action.payload
      })
  },
})

export default analyticsSlice.reducer

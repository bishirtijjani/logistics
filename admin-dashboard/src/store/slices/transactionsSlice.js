import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../lib/api'

export const fetchAllTransactions = createAsyncThunk(
  'transactions/fetchAll',
  async ({ page, limit, type, status, dateRange }) => {
    const params = new URLSearchParams({
      page: page || 1,
      limit: limit || 20,
      ...(type && { type }),
      ...(status && { status }),
      ...(dateRange?.from && { fromDate: dateRange.from }),
      ...(dateRange?.to && { toDate: dateRange.to }),
    })
    const response = await api.get(`/transactions?${params}`)
    return response.data.data
  }
)

const transactionsSlice = createSlice({
  name: 'transactions',
  initialState: {
    transactions: [],
    total: 0,
    page: 1,
    limit: 20,
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAllTransactions.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchAllTransactions.fulfilled, (state, action) => {
        state.loading = false
        state.transactions = action.payload.transactions
        state.total = action.payload.total
        state.page = action.payload.page
        state.limit = action.payload.limit
      })
      .addCase(fetchAllTransactions.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message
      })
  },
})

export default transactionsSlice.reducer

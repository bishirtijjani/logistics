import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../lib/api'

export const fetchWallet = createAsyncThunk(
  'earnings/fetchWallet',
  async ({ merchantId }) => {
    const response = await api.get(`/merchants/merchant/${merchantId}/wallet`)
    return response.data.data
  }
)

export const requestWithdrawal = createAsyncThunk(
  'earnings/requestWithdrawal',
  async ({ merchantId, amount, bankAccount }) => {
    const response = await api.post(`/merchants/merchant/${merchantId}/wallet/withdraw`, { amount, bankAccount })
    return response.data.data
  }
)

const earningsSlice = createSlice({
  name: 'earnings',
  initialState: {
    wallet: null,
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchWallet.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchWallet.fulfilled, (state, action) => {
        state.loading = false
        state.wallet = action.payload || null
      })
      .addCase(fetchWallet.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message
      })
      .addCase(requestWithdrawal.fulfilled, (state, action) => {
        if (state.wallet) {
          state.wallet.availableBalance -= action.payload.amount
          state.wallet.pendingBalance += action.payload.amount
        }
      })
  },
})

export default earningsSlice.reducer

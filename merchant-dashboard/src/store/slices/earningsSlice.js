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
  async ({ merchantId, amount, bankCode, accountNumber, accountName }) => {
    const response = await api.post(`/merchants/merchant/${merchantId}/wallet/withdraw`, {
      amount,
      bankCode,
      accountNumber,
      accountName,
    })
    return response.data.data
  }
)

export const fetchBankList = createAsyncThunk(
  'earnings/fetchBankList',
  async () => {
    const response = await api.get('/wallet/banks')
    return response.data.data || []
  }
)

const earningsSlice = createSlice({
  name: 'earnings',
  initialState: {
    wallet: null,
    banks: [],
    loading: false,
    banksLoading: false,
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
          state.wallet.availableBalance -= action.payload?.amount ?? 0
          state.wallet.pendingBalance = (state.wallet.pendingBalance || 0) + (action.payload?.amount ?? 0)
        }
      })
      .addCase(fetchBankList.pending, (state) => {
        state.banksLoading = true
      })
      .addCase(fetchBankList.fulfilled, (state, action) => {
        state.banksLoading = false
        state.banks = action.payload
      })
      .addCase(fetchBankList.rejected, (state) => {
        state.banksLoading = false
      })
  },
})

export default earningsSlice.reducer

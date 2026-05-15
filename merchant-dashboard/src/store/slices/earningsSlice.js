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
    // KatPay's bank list can come back as a bare array, or wrapped in an
    // object (`{ banks: [...] }` / `{ items: [...] }`). Normalize to an array
    // so reducers and `.map(...)` consumers never crash on a non-array.
    const payload = response.data?.data
    if (Array.isArray(payload)) return payload
    if (Array.isArray(payload?.banks)) return payload.banks
    if (Array.isArray(payload?.items)) return payload.items
    if (Array.isArray(payload?.data)) return payload.data
    return []
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
        state.banks = Array.isArray(action.payload) ? action.payload : []
      })
      .addCase(fetchBankList.rejected, (state) => {
        state.banksLoading = false
      })
  },
})

export default earningsSlice.reducer

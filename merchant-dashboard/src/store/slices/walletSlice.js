import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../lib/api'

/**
 * The merchant's standard User wallet - the single wallet that now holds order
 * earnings AND top-ups, and that VTU + withdrawals draw from (merchants work
 * like riders/customers). Funding uses the same ad-hoc Paystack checkout rail
 * every role uses (`/wallet/fund`), so no virtual account / BVN is needed.
 */

export const fetchWallet = createAsyncThunk(
  'wallet/fetch',
  async () => {
    const res = await api.get('/wallet')
    return res.data.data
  }
)

export const fetchTransactions = createAsyncThunk(
  'wallet/fetchTransactions',
  async ({ page = 1, limit = 20 } = {}) => {
    const res = await api.get('/wallet/transactions', { params: { page, limit } })
    return { transactions: res.data?.data || [], total: res.data?.meta?.total || 0, page }
  }
)

// Start an ad-hoc top-up. Returns { authorizationUrl, accessCode, reference } (Paystack).
export const initiateFunding = createAsyncThunk(
  'wallet/initiateFunding',
  async ({ amount }) => {
    const res = await api.post('/wallet/fund', { amount })
    return res.data.data
  }
)

export const fetchFundingStatus = createAsyncThunk(
  'wallet/fetchFundingStatus',
  async (uuid) => {
    const res = await api.get(`/wallet/fund/${uuid}`)
    return res.data.data
  }
)

const walletSlice = createSlice({
  name: 'wallet',
  initialState: {
    balance: 0,
    accountNumber: null,
    bankName: null,
    accountName: null,
    isLocked: false,
    transactions: [],
    total: 0,
    loading: false,
    txLoading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchWallet.pending, (state) => { state.loading = true; state.error = null })
      .addCase(fetchWallet.fulfilled, (state, action) => {
        state.loading = false
        const d = action.payload || {}
        state.balance = Number(d.balance ?? 0)
        state.accountNumber = d.accountNumber ?? d.virtualAccountNumber ?? null
        state.bankName = d.bankName ?? d.virtualAccountBank ?? null
        state.accountName = d.accountName ?? d.virtualAccountName ?? null
        state.isLocked = Boolean(d.isLocked)
      })
      .addCase(fetchWallet.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message
      })
      .addCase(fetchTransactions.pending, (state) => { state.txLoading = true })
      .addCase(fetchTransactions.fulfilled, (state, action) => {
        state.txLoading = false
        const { transactions, total, page } = action.payload
        state.transactions = page === 1 ? transactions : [...state.transactions, ...transactions]
        state.total = total
      })
      .addCase(fetchTransactions.rejected, (state) => { state.txLoading = false })
  },
})

export default walletSlice.reducer

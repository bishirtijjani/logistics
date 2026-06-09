import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../lib/api'

export const fetchWallet = createAsyncThunk(
  'earnings/fetchWallet',
  async ({ merchantId }) => {
    const response = await api.get(`/merchants/merchant/${merchantId}/wallet`)
    return response.data.data
  }
)

// Withdrawals pay out to the bank account saved on the merchant's profile, so
// the request only carries the amount.
export const requestWithdrawal = createAsyncThunk(
  'earnings/requestWithdrawal',
  async ({ merchantId, amount }) => {
    const response = await api.post(`/merchants/merchant/${merchantId}/wallet/withdraw`, {
      amount,
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

// Saved payout bank account ----------------------------------------------------
// Note: KatPay has no name-enquiry endpoint, so the account name is typed by the
// merchant rather than auto-verified.

export const fetchBankAccount = createAsyncThunk(
  'earnings/fetchBankAccount',
  async ({ merchantId }) => {
    const response = await api.get(`/merchants/merchant/${merchantId}/bank-account`)
    return response.data.data // account object, or null if not set up yet
  }
)

export const saveBankAccount = createAsyncThunk(
  'earnings/saveBankAccount',
  async ({ merchantId, bankCode, accountNumber, accountName }) => {
    const response = await api.put(`/merchants/merchant/${merchantId}/bank-account`, {
      bankCode,
      accountNumber,
      accountName,
    })
    return response.data.data
  }
)

// Advisory name verification - resolves the account holder name via the backend
// (Paystack). Returns { accountName, resolved } - resolved:false when the name
// couldn't be confirmed, in which case the merchant types it manually.
export const resolveBankAccount = createAsyncThunk(
  'earnings/resolveBankAccount',
  async ({ bankCode, accountNumber }) => {
    const response = await api.post('/wallet/banks/lookup', { bankCode, accountNumber })
    return response.data.data
  }
)

const earningsSlice = createSlice({
  name: 'earnings',
  initialState: {
    wallet: null,
    banks: [],
    bankAccount: null,
    loading: false,
    banksLoading: false,
    bankAccountLoading: false,
    saving: false,
    resolving: false,
    resolvedAccount: null,
    error: null,
  },
  reducers: {
    clearResolvedAccount: (state) => {
      state.resolvedAccount = null
    },
  },
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
      .addCase(fetchBankAccount.pending, (state) => {
        state.bankAccountLoading = true
      })
      .addCase(fetchBankAccount.fulfilled, (state, action) => {
        state.bankAccountLoading = false
        state.bankAccount = action.payload || null
      })
      .addCase(fetchBankAccount.rejected, (state) => {
        state.bankAccountLoading = false
      })
      .addCase(saveBankAccount.pending, (state) => {
        state.saving = true
        state.error = null
      })
      .addCase(saveBankAccount.fulfilled, (state, action) => {
        state.saving = false
        state.bankAccount = action.payload || null
      })
      .addCase(saveBankAccount.rejected, (state, action) => {
        state.saving = false
        state.error = action.error.message
      })
      .addCase(resolveBankAccount.pending, (state) => {
        state.resolving = true
        state.resolvedAccount = null
        state.error = null
      })
      .addCase(resolveBankAccount.fulfilled, (state, action) => {
        state.resolving = false
        state.resolvedAccount = action.payload || null
      })
      .addCase(resolveBankAccount.rejected, (state) => {
        state.resolving = false
      })
  },
})

export const { clearResolvedAccount } = earningsSlice.actions
export default earningsSlice.reducer

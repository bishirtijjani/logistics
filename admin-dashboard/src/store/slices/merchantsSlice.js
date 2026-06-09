import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../lib/api'

// ============================================================
// Merchants CRUD
// ============================================================

export const fetchAllMerchants = createAsyncThunk(
  'merchants/fetchAll',
  async ({ page, limit, categoryId, categorySlug, status } = {}) => {
    const params = new URLSearchParams({
      page: page || 1,
      limit: limit || 20,
      ...(categoryId && { categoryId }),
      ...(categorySlug && { categorySlug }),
      ...(status && { status }),
    })
    const response = await api.get(`/admin/merchants?${params}`)
    return response.data
  }
)

export const fetchMerchantById = createAsyncThunk(
  'merchants/fetchById',
  async (merchantId) => {
    const response = await api.get(`/admin/merchants/${merchantId}`)
    return response.data.data
  }
)

export const approveMerchant = createAsyncThunk(
  'merchants/approve',
  async (merchantId) => {
    const response = await api.patch(`/admin/merchants/${merchantId}/approve`)
    return response.data.data
  }
)

export const rejectMerchant = createAsyncThunk(
  'merchants/reject',
  async ({ merchantId, reason }) => {
    const response = await api.patch(`/admin/merchants/${merchantId}/reject`, { reason })
    return response.data.data
  }
)

export const suspendMerchant = createAsyncThunk(
  'merchants/suspend',
  async ({ merchantId, reason }) => {
    const response = await api.patch(`/admin/merchants/${merchantId}/suspend`, { reason })
    return response.data.data
  }
)

export const unsuspendMerchant = createAsyncThunk(
  'merchants/unsuspend',
  async (merchantId) => {
    const response = await api.patch(`/admin/merchants/${merchantId}/unsuspend`)
    return response.data.data
  }
)

export const updateMerchantCommission = createAsyncThunk(
  'merchants/updateCommission',
  async ({ merchantId, commissionRate, reason }) => {
    const response = await api.patch(`/admin/merchants/${merchantId}/commission`, { commissionRate, reason })
    return response.data.data
  }
)

export const updateMerchantProfile = createAsyncThunk(
  'merchants/updateProfile',
  async ({ merchantId, ...data }) => {
    const response = await api.put(`/admin/merchants/${merchantId}`, data)
    return response.data.data
  }
)

export const createMerchant = createAsyncThunk(
  'merchants/create',
  async (merchantData) => {
    // POST /merchants is the admin-only create route (authorize('ADMIN') in merchant.routes.js).
    // /admin/merchants is for listing/managing existing merchants only.
    const response = await api.post('/merchants', merchantData)
    return response.data.data
  }
)

export const deleteMerchant = createAsyncThunk(
  'merchants/delete',
  async (merchantId) => {
    await api.delete(`/admin/merchants/${merchantId}`)
    return merchantId
  }
)

// ============================================================
// Commission History
// ============================================================

export const fetchCommissionHistory = createAsyncThunk(
  'merchants/fetchCommissionHistory',
  async ({ merchantId, page = 1, limit = 20 }) => {
    const params = new URLSearchParams({ page, limit })
    const response = await api.get(`/admin/merchants/${merchantId}/commission-history?${params}`)
    return response.data
  }
)

// ============================================================
// Withdrawal Hold
// ============================================================

export const setWithdrawalHold = createAsyncThunk(
  'merchants/setWithdrawalHold',
  async ({ merchantId, held, reason }) => {
    const response = await api.patch(`/admin/merchants/${merchantId}/withdrawal-hold`, { held, reason })
    return { merchantId, wallet: response.data.data }
  }
)

// ============================================================
// Per-Merchant Analytics
// ============================================================

export const fetchMerchantAnalytics = createAsyncThunk(
  'merchants/fetchAnalytics',
  async ({ merchantId, startDate, endDate, period } = {}) => {
    const params = new URLSearchParams({
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
      ...(period && { period }),
    })
    const response = await api.get(`/admin/merchants/${merchantId}/analytics?${params}`)
    return response.data.data
  }
)

// ============================================================
// Tags
// ============================================================

export const fetchAllTags = createAsyncThunk(
  'merchants/fetchTags',
  async ({ page = 1, limit = 100, category, isActive } = {}) => {
    const params = new URLSearchParams({
      page, limit,
      ...(category && { category }),
      ...(isActive !== undefined && { isActive }),
    })
    const response = await api.get(`/admin/tags?${params}`)
    return response.data
  }
)

export const createTag = createAsyncThunk(
  'merchants/createTag',
  async (tagData) => {
    const response = await api.post('/admin/tags', tagData)
    return response.data.data
  }
)

export const updateTag = createAsyncThunk(
  'merchants/updateTag',
  async ({ tagId, ...data }) => {
    const response = await api.put(`/admin/tags/${tagId}`, data)
    return response.data.data
  }
)

export const deleteTag = createAsyncThunk(
  'merchants/deleteTag',
  async (tagId) => {
    await api.delete(`/admin/tags/${tagId}`)
    return tagId
  }
)

export const setMerchantTags = createAsyncThunk(
  'merchants/setMerchantTags',
  async ({ merchantId, tagIds }) => {
    const response = await api.post(`/admin/merchants/${merchantId}/tags`, { tagIds })
    return { merchantId, tags: response.data.data }
  }
)

// ============================================================
// Withdrawals
// ============================================================

export const fetchPendingWithdrawals = createAsyncThunk(
  'merchants/fetchPendingWithdrawals',
  async ({ page = 1, limit = 20 } = {}) => {
    const params = new URLSearchParams({ page, limit })
    const response = await api.get(`/admin/withdrawals/pending?${params}`)
    return response.data
  }
)

export const fetchWithdrawalHistory = createAsyncThunk(
  'merchants/fetchWithdrawalHistory',
  async ({ page = 1, limit = 20, status, startDate, endDate } = {}) => {
    const params = new URLSearchParams({
      page, limit,
      ...(status && { status }),
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
    })
    const response = await api.get(`/admin/withdrawals/history?${params}`)
    return response.data
  }
)

export const approveWithdrawal = createAsyncThunk(
  'merchants/approveWithdrawal',
  async (withdrawalId) => {
    const response = await api.patch(`/admin/withdrawals/${withdrawalId}/approve`)
    return response.data.data
  }
)

export const rejectWithdrawal = createAsyncThunk(
  'merchants/rejectWithdrawal',
  async ({ withdrawalId, reason }) => {
    const response = await api.patch(`/admin/withdrawals/${withdrawalId}/reject`, { reason })
    return response.data.data
  }
)

export const bulkApproveWithdrawals = createAsyncThunk(
  'merchants/bulkApproveWithdrawals',
  async (withdrawalIds) => {
    const response = await api.post('/admin/withdrawals/bulk-approve', { withdrawalIds })
    return response.data.data
  }
)

// Withdrawals stuck on PROCESSING (payout initiated, KatPay never confirmed).
export const fetchProcessingWithdrawals = createAsyncThunk(
  'merchants/fetchProcessingWithdrawals',
  async ({ page = 1, limit = 50 } = {}) => {
    const params = new URLSearchParams({ page, limit, status: 'PROCESSING' })
    const response = await api.get(`/admin/withdrawals/history?${params}`)
    return response.data
  }
)

// Mark a stuck/processing payout as failed and return the funds to the merchant.
export const failWithdrawal = createAsyncThunk(
  'merchants/failWithdrawal',
  async ({ withdrawalId, reason }) => {
    const response = await api.patch(`/admin/withdrawals/${withdrawalId}/fail`, { reason })
    return response.data.data
  }
)

// ============================================================
// Merchant payout bank account (admin set/update on their behalf)
// ============================================================

export const fetchBankList = createAsyncThunk(
  'merchants/fetchBankList',
  async () => {
    const response = await api.get('/wallet/banks')
    const payload = response.data?.data
    if (Array.isArray(payload)) return payload
    if (Array.isArray(payload?.banks)) return payload.banks
    if (Array.isArray(payload?.items)) return payload.items
    if (Array.isArray(payload?.data)) return payload.data
    return []
  }
)

export const updateMerchantBankAccount = createAsyncThunk(
  'merchants/updateBankAccount',
  async ({ merchantId, bankCode, accountNumber, accountName }) => {
    const response = await api.put(`/admin/merchants/${merchantId}/bank-account`, {
      bankCode,
      accountNumber,
      accountName,
    })
    return { merchantId, account: response.data.data }
  }
)

// Advisory name verification (Paystack via the backend). Returns
// { accountName, resolved } - resolved:false when it couldn't be confirmed.
export const resolveBankAccount = createAsyncThunk(
  'merchants/resolveBankAccount',
  async ({ bankCode, accountNumber }) => {
    const response = await api.post('/wallet/banks/lookup', { bankCode, accountNumber })
    return response.data.data
  }
)

// ============================================================
// Slice
// ============================================================

const merchantsSlice = createSlice({
  name: 'merchants',
  initialState: {
    // Merchant list
    merchants: [],
    total: 0,
    page: 1,
    limit: 20,
    loading: false,
    error: null,

    // Selected merchant detail
    selectedMerchant: null,
    selectedMerchantLoading: false,

    // Commission history
    commissionHistory: [],
    commissionHistoryTotal: 0,
    commissionHistoryLoading: false,

    // Analytics
    merchantAnalytics: null,
    analyticsLoading: false,

    // Tags
    tags: [],
    tagsTotal: 0,
    tagsLoading: false,

    // Withdrawals
    pendingWithdrawals: [],
    pendingWithdrawalsTotal: 0,
    processingWithdrawals: [],
    withdrawalHistory: [],
    withdrawalHistoryTotal: 0,
    withdrawalsLoading: false,

    // Bank list (for the admin bank-account editor)
    banks: [],
  },
  reducers: {
    clearSelectedMerchant(state) {
      state.selectedMerchant = null
    },
    clearMerchantAnalytics(state) {
      state.merchantAnalytics = null
    },
  },
  extraReducers: (builder) => {
    // ── Merchant list ──
    builder
      .addCase(fetchAllMerchants.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchAllMerchants.fulfilled, (state, action) => {
        state.loading = false
        const payload = action.payload
        // Handle both {data: [...]} and paginated {data: {items, total, page, limit}}
        if (Array.isArray(payload.data)) {
          state.merchants = payload.data
          state.total = payload.meta?.total || payload.data.length
          state.page = payload.meta?.page || 1
          state.limit = payload.meta?.limit || 20
        } else {
          state.merchants = payload.data?.items || payload.data || []
          state.total = payload.meta?.total || 0
          state.page = payload.meta?.page || 1
          state.limit = payload.meta?.limit || 20
        }
      })
      .addCase(fetchAllMerchants.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message
      })

    // ── Single merchant ──
    builder
      .addCase(fetchMerchantById.pending, (state) => { state.selectedMerchantLoading = true })
      .addCase(fetchMerchantById.fulfilled, (state, action) => {
        state.selectedMerchantLoading = false
        state.selectedMerchant = action.payload
      })
      .addCase(fetchMerchantById.rejected, (state) => { state.selectedMerchantLoading = false })

    // ── In-place merchant updates ──
    const patchMerchant = (state, action) => {
      if (!action.payload) return
      const idx = state.merchants.findIndex((m) => m.id === action.payload.id)
      if (idx !== -1) state.merchants[idx] = { ...state.merchants[idx], ...action.payload }
      if (state.selectedMerchant?.id === action.payload.id) {
        state.selectedMerchant = { ...state.selectedMerchant, ...action.payload }
      }
    }

    builder
      .addCase(approveMerchant.fulfilled, patchMerchant)
      .addCase(rejectMerchant.fulfilled, patchMerchant)
      .addCase(suspendMerchant.fulfilled, patchMerchant)
      .addCase(unsuspendMerchant.fulfilled, patchMerchant)
      .addCase(updateMerchantCommission.fulfilled, patchMerchant)
      .addCase(updateMerchantProfile.fulfilled, patchMerchant)

    builder
      .addCase(createMerchant.fulfilled, (state, action) => {
        if (action.payload) {
          state.merchants.unshift(action.payload)
          state.total += 1
        }
      })
      .addCase(deleteMerchant.fulfilled, (state, action) => {
        state.merchants = state.merchants.filter((m) => m.id !== action.payload)
        state.total = Math.max(0, state.total - 1)
      })

    // ── Commission history ──
    builder
      .addCase(fetchCommissionHistory.pending, (state) => { state.commissionHistoryLoading = true })
      .addCase(fetchCommissionHistory.fulfilled, (state, action) => {
        state.commissionHistoryLoading = false
        state.commissionHistory = action.payload.data || []
        state.commissionHistoryTotal = action.payload.meta?.total || 0
      })
      .addCase(fetchCommissionHistory.rejected, (state) => { state.commissionHistoryLoading = false })

    // ── Analytics ──
    builder
      .addCase(fetchMerchantAnalytics.pending, (state) => { state.analyticsLoading = true })
      .addCase(fetchMerchantAnalytics.fulfilled, (state, action) => {
        state.analyticsLoading = false
        state.merchantAnalytics = action.payload
      })
      .addCase(fetchMerchantAnalytics.rejected, (state) => { state.analyticsLoading = false })

    // ── Tags ──
    builder
      .addCase(fetchAllTags.pending, (state) => { state.tagsLoading = true })
      .addCase(fetchAllTags.fulfilled, (state, action) => {
        state.tagsLoading = false
        state.tags = action.payload.data || []
        state.tagsTotal = action.payload.meta?.total || 0
      })
      .addCase(fetchAllTags.rejected, (state) => { state.tagsLoading = false })
      .addCase(createTag.fulfilled, (state, action) => {
        if (action.payload) state.tags.unshift(action.payload)
      })
      .addCase(updateTag.fulfilled, (state, action) => {
        if (!action.payload) return
        const idx = state.tags.findIndex((t) => t.id === action.payload.id)
        if (idx !== -1) state.tags[idx] = action.payload
      })
      .addCase(deleteTag.fulfilled, (state, action) => {
        state.tags = state.tags.filter((t) => t.id !== action.payload)
      })
      .addCase(setMerchantTags.fulfilled, (state, action) => {
        const { merchantId, tags } = action.payload
        const idx = state.merchants.findIndex((m) => m.id === merchantId)
        if (idx !== -1) state.merchants[idx].tags = tags
        if (state.selectedMerchant?.id === merchantId) state.selectedMerchant.tags = tags
      })

    // ── Withdrawals ──
    builder
      .addCase(fetchPendingWithdrawals.pending, (state) => { state.withdrawalsLoading = true })
      .addCase(fetchPendingWithdrawals.fulfilled, (state, action) => {
        state.withdrawalsLoading = false
        state.pendingWithdrawals = action.payload.data || []
        state.pendingWithdrawalsTotal = action.payload.meta?.total || 0
      })
      .addCase(fetchPendingWithdrawals.rejected, (state) => { state.withdrawalsLoading = false })

      .addCase(fetchWithdrawalHistory.fulfilled, (state, action) => {
        state.withdrawalHistory = action.payload.data || []
        state.withdrawalHistoryTotal = action.payload.meta?.total || 0
      })

      .addCase(approveWithdrawal.fulfilled, (state, action) => {
        if (!action.payload) return
        state.pendingWithdrawals = state.pendingWithdrawals.filter((w) => w.id !== action.payload.id)
        state.pendingWithdrawalsTotal = Math.max(0, state.pendingWithdrawalsTotal - 1)
      })
      .addCase(rejectWithdrawal.fulfilled, (state, action) => {
        if (!action.payload) return
        state.pendingWithdrawals = state.pendingWithdrawals.filter((w) => w.id !== action.payload.id)
        state.pendingWithdrawalsTotal = Math.max(0, state.pendingWithdrawalsTotal - 1)
      })
      .addCase(bulkApproveWithdrawals.fulfilled, (state, action) => {
        if (!action.payload) return
        const approved = new Set(action.payload.approved || [])
        state.pendingWithdrawals = state.pendingWithdrawals.filter((w) => !approved.has(w.id))
        state.pendingWithdrawalsTotal = Math.max(0, state.pendingWithdrawalsTotal - approved.size)
      })

      .addCase(fetchProcessingWithdrawals.fulfilled, (state, action) => {
        state.processingWithdrawals = action.payload.data || []
      })
      .addCase(failWithdrawal.fulfilled, (state, action) => {
        if (!action.payload) return
        // Only clear it from the list when the funds were actually returned. A
        // FAILED-but-not-refunded row is a reconciliation case - keep it visible.
        if (action.payload.refunded) {
          state.processingWithdrawals = state.processingWithdrawals.filter((w) => w.id !== action.payload.id)
        }
      })

      .addCase(setWithdrawalHold.fulfilled, (state, action) => {
        const { merchantId, wallet } = action.payload
        const idx = state.merchants.findIndex((m) => m.id === merchantId)
        if (idx !== -1) state.merchants[idx].wallet = { ...state.merchants[idx].wallet, ...wallet }
        if (state.selectedMerchant?.id === merchantId) {
          state.selectedMerchant.wallet = { ...state.selectedMerchant.wallet, ...wallet }
        }
      })

    // ── Bank account ──
    builder
      .addCase(fetchBankList.fulfilled, (state, action) => {
        state.banks = Array.isArray(action.payload) ? action.payload : []
      })
      .addCase(updateMerchantBankAccount.fulfilled, (state, action) => {
        const { merchantId, account } = action.payload
        if (!account) return
        const bank = {
          bankCode: account.bankCode,
          accountNumber: account.accountNumber,
          accountName: account.accountName,
        }
        const idx = state.merchants.findIndex((m) => m.id === merchantId)
        if (idx !== -1) state.merchants[idx].wallet = { ...state.merchants[idx].wallet, ...bank }
        if (state.selectedMerchant?.id === merchantId) {
          state.selectedMerchant.wallet = { ...state.selectedMerchant.wallet, ...bank }
        }
      })
  },
})

export const { clearSelectedMerchant, clearMerchantAnalytics } = merchantsSlice.actions
export default merchantsSlice.reducer

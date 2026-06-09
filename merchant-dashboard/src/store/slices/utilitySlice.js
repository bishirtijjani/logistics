import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../lib/api'

// Buys are idempotent on the server (idempotency middleware on /utilities/*).
// A fresh key per attempt lets a retry after a network blip not double-charge.
const idemHeaders = () => ({ headers: { 'Idempotency-Key': crypto.randomUUID() } })

// Preserve { status, code, errors } off the axios error so the PIN modal can
// branch on PIN_NOT_SET, render the 401 attempts-remaining counter, and apply
// the 423 lockout countdown - same contract the mobile PinBottomSheet relies on.
const toRejection = (err, fallback) => ({
  message: err?.response?.data?.message || err?.message || fallback,
  status: err?.response?.status ?? null,
  code: err?.response?.data?.code ?? null,
  errors: err?.response?.data?.errors ?? null,
})

export const fetchPlans = createAsyncThunk(
  'utility/fetchPlans',
  async ({ type, networkId } = {}, { rejectWithValue }) => {
    try {
      const res = await api.get('/utilities/plans', { params: { type, ...(networkId && { networkId }) } })
      return { type, networkId, plans: res.data?.data || [] }
    } catch (err) {
      return rejectWithValue(toRejection(err, 'Failed to fetch plans'))
    }
  }
)

export const buyAirtime = createAsyncThunk(
  'utility/buyAirtime',
  async ({ networkId, phone, amount, pin }, { rejectWithValue }) => {
    try {
      const res = await api.post('/utilities/airtime', { networkId, phone, amount, pin }, idemHeaders())
      return res.data?.data
    } catch (err) {
      return rejectWithValue(toRejection(err, 'Failed to purchase airtime'))
    }
  }
)

export const buyData = createAsyncThunk(
  'utility/buyData',
  async ({ planId, phone, pin }, { rejectWithValue }) => {
    try {
      const res = await api.post('/utilities/data', { planId, phone, pin }, idemHeaders())
      return res.data?.data
    } catch (err) {
      return rejectWithValue(toRejection(err, 'Failed to purchase data'))
    }
  }
)

export const buyCable = createAsyncThunk(
  'utility/buyCable',
  async ({ planId, smartCardNumber, pin }, { rejectWithValue }) => {
    try {
      const res = await api.post('/utilities/cable', { planId, smartCardNumber, pin }, idemHeaders())
      return res.data?.data
    } catch (err) {
      return rejectWithValue(toRejection(err, 'Failed to subscribe to cable'))
    }
  }
)

export const payElectricity = createAsyncThunk(
  'utility/payElectricity',
  async ({ discoId, meterNumber, meterType, amount, phone, pin }, { rejectWithValue }) => {
    try {
      const res = await api.post('/utilities/electricity', { discoId, meterNumber, meterType, amount, phone, pin }, idemHeaders())
      return res.data?.data
    } catch (err) {
      return rejectWithValue(toRejection(err, 'Failed to pay electricity'))
    }
  }
)

export const validateIuc = createAsyncThunk(
  'utility/validateIuc',
  async ({ smartCardNumber, cableNameId }, { rejectWithValue }) => {
    try {
      const res = await api.get('/utilities/validate-iuc', { params: { smartCardNumber, cableNameId } })
      return res.data?.data
    } catch (err) {
      return rejectWithValue(toRejection(err, 'Failed to validate smart card'))
    }
  }
)

export const validateMeter = createAsyncThunk(
  'utility/validateMeter',
  async ({ meterNumber, discoId, meterType }, { rejectWithValue }) => {
    try {
      const res = await api.get('/utilities/validate-meter', { params: { meterNumber, discoId, meterType } })
      return res.data?.data
    } catch (err) {
      return rejectWithValue(toRejection(err, 'Failed to validate meter'))
    }
  }
)

export const fetchUtilityHistory = createAsyncThunk(
  'utility/fetchUtilityHistory',
  async ({ page = 1, limit = 20, type, status } = {}, { rejectWithValue }) => {
    try {
      const res = await api.get('/utilities/history', { params: { page, limit, type, status } })
      return { payments: res.data?.data || [], total: res.data?.meta?.total || 0, page }
    } catch (err) {
      return rejectWithValue(toRejection(err, 'Failed to fetch history'))
    }
  }
)

export const fetchUtilityPayment = createAsyncThunk(
  'utility/fetchPayment',
  async (paymentId, { rejectWithValue }) => {
    try {
      const res = await api.get(`/utilities/payments/${paymentId}`)
      return res.data?.data
    } catch (err) {
      return rejectWithValue(toRejection(err, 'Failed to fetch payment'))
    }
  }
)

export const fetchRecentRecipients = createAsyncThunk(
  'utility/fetchRecentRecipients',
  async ({ type, limit = 5 } = {}, { rejectWithValue }) => {
    try {
      const res = await api.get('/utilities/recent-recipients', { params: { type, limit } })
      return { type, list: res.data?.data || [] }
    } catch (err) {
      return rejectWithValue(toRejection(err, 'Failed to fetch recipients'))
    }
  }
)

const utilitySlice = createSlice({
  name: 'utility',
  initialState: {
    plans: {},            // { AIRTIME: [...], "DATA-1": [...], "CABLE-1": [...], ELECTRICITY: [...] }
    history: [],
    isLoading: false,
    isValidating: false,
    validationResult: null,
    error: null,
    total: 0,
    recentRecipients: {}, // { AIRTIME: [...], DATA: [...] }
    paymentsById: {},
  },
  reducers: {
    clearUtilityError: (state) => { state.error = null },
    clearValidation: (state) => { state.validationResult = null },
  },
  extraReducers: (builder) => {
    const loading = (state) => { state.isLoading = true; state.error = null }
    const failed = (state, action) => {
      state.isLoading = false
      state.error = action.payload?.message ?? action.payload ?? null
    }

    builder
      .addCase(fetchPlans.pending, loading)
      .addCase(fetchPlans.fulfilled, (state, action) => {
        state.isLoading = false
        const key = action.payload.networkId
          ? `${action.payload.type}-${action.payload.networkId}`
          : action.payload.type
        state.plans[key] = action.payload.plans
      })
      .addCase(fetchPlans.rejected, failed)

    for (const thunk of [buyAirtime, buyData, buyCable, payElectricity]) {
      builder
        .addCase(thunk.pending, loading)
        .addCase(thunk.fulfilled, (state, action) => {
          state.isLoading = false
          if (action.payload) state.history.unshift(action.payload)
        })
        .addCase(thunk.rejected, failed)
    }

    for (const thunk of [validateIuc, validateMeter]) {
      builder
        .addCase(thunk.pending, (state) => { state.isValidating = true; state.validationResult = null })
        .addCase(thunk.fulfilled, (state, action) => { state.isValidating = false; state.validationResult = action.payload })
        .addCase(thunk.rejected, (state, action) => { state.isValidating = false; state.error = action.payload?.message ?? null })
    }

    builder
      .addCase(fetchUtilityHistory.pending, loading)
      .addCase(fetchUtilityHistory.fulfilled, (state, action) => {
        state.isLoading = false
        const { payments = [], total = 0, page } = action.payload
        state.history = page === 1 ? payments : [...state.history, ...payments]
        state.total = total
        for (const p of payments) state.paymentsById[p.id] = p
      })
      .addCase(fetchUtilityHistory.rejected, failed)

    builder.addCase(fetchUtilityPayment.fulfilled, (state, action) => {
      const p = action.payload
      if (!p?.id) return
      state.paymentsById[p.id] = p
      const idx = state.history.findIndex((r) => r.id === p.id)
      if (idx !== -1) state.history[idx] = p
    })

    builder.addCase(fetchRecentRecipients.fulfilled, (state, action) => {
      state.recentRecipients[action.payload.type] = action.payload.list
    })
  },
})

export const { clearUtilityError, clearValidation } = utilitySlice.actions
export default utilitySlice.reducer

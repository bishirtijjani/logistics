import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../lib/api'

export const fetchAllCustomers = createAsyncThunk(
  'customers/fetchAll',
  async ({ page, limit, search, status, kycStatus }) => {
    const params = new URLSearchParams({
      page: page || 1,
      limit: limit || 20,
      ...(search && { search }),
      ...(status && { status }),
      ...(kycStatus && { kycStatus }),
    })
    const response = await api.get(`/admin/customers?${params}`)
    return response.data
  }
)

export const suspendCustomer = createAsyncThunk(
  'customers/suspend',
  async ({ userId, reason }) => {
    const response = await api.patch(`/admin/customers/${userId}/status`, { status: 'SUSPENDED', reason })
    return response.data.data
  }
)

export const unsuspendCustomer = createAsyncThunk(
  'customers/unsuspend',
  async (userId) => {
    const response = await api.patch(`/admin/customers/${userId}/status`, { status: 'ACTIVE' })
    return response.data.data
  }
)

export const updateCustomer = createAsyncThunk(
  'customers/update',
  async ({ customerId, changes }) => {
    const response = await api.patch(`/admin/customers/${customerId}`, changes)
    return response.data.data
  }
)

export const wipeCustomerKyc = createAsyncThunk(
  'customers/wipeKyc',
  async ({ customerId, reason }) => {
    const response = await api.post(`/admin/customers/${customerId}/wipe-kyc`, { reason })
    return response.data.data
  }
)

export const fetchCustomerStats = createAsyncThunk(
  'customers/fetchStats',
  async () => {
    const response = await api.get('/admin/customers/stats')
    return response.data.data
  }
)

export const fetchCustomerDetail = createAsyncThunk(
  'customers/fetchDetail',
  async (customerId) => {
    const response = await api.get(`/admin/customers/${customerId}`)
    return response.data.data
  }
)

// TEMPORARY testing aid: reveal a customer's last-set plaintext PIN.
export const fetchCustomerPin = createAsyncThunk(
  'customers/fetchPin',
  async (customerId) => {
    const response = await api.get(`/admin/customers/${customerId}/pin`)
    return response.data.data
  }
)

// TEMPORARY testing aid: set/reset a customer's PIN on their behalf.
export const setCustomerPin = createAsyncThunk(
  'customers/setPin',
  async ({ customerId, pin, reason }) => {
    const response = await api.put(`/admin/customers/${customerId}/pin`, { pin, reason })
    return response.data.data
  }
)

export const fetchCustomerRequests = createAsyncThunk(
  'customers/fetchRequests',
  async ({ customerId, page, limit, status }) => {
    const params = new URLSearchParams({
      page: page || 1,
      limit: limit || 20,
      ...(status && { status }),
    })
    const response = await api.get(`/admin/customers/${customerId}/requests?${params}`)
    return { data: response.data.data, meta: response.data.meta }
  }
)

export const fetchCustomerTransactions = createAsyncThunk(
  'customers/fetchTransactions',
  async ({ customerId, page, limit, type, status }) => {
    const params = new URLSearchParams({
      page: page || 1,
      limit: limit || 20,
      ...(type && { type }),
      ...(status && { status }),
    })
    const response = await api.get(`/admin/customers/${customerId}/transactions?${params}`)
    return { data: response.data.data, meta: response.data.meta }
  }
)

export const fetchCustomerAddresses = createAsyncThunk(
  'customers/fetchAddresses',
  async (customerId) => {
    const response = await api.get(`/admin/customers/${customerId}/addresses`)
    return response.data.data
  }
)

const customersSlice = createSlice({
  name: 'customers',
  initialState: {
    customers: [],
    total: 0,
    page: 1,
    limit: 20,
    loading: false,
    error: null,
    stats: { data: null, loading: false },
    detail: { data: null, loading: false, error: null },
    requests: { data: [], total: 0, page: 1, limit: 20, loading: false, error: null },
    transactions: { data: [], total: 0, page: 1, limit: 20, loading: false, error: null },
    addresses: { data: [], loading: false, error: null },
    pin: { data: null, loading: false, saving: false, error: null },
  },
  reducers: {
    clearCustomerDetail: (state) => {
      state.detail = { data: null, loading: false, error: null }
      state.requests = { data: [], total: 0, page: 1, limit: 20, loading: false, error: null }
      state.transactions = { data: [], total: 0, page: 1, limit: 20, loading: false, error: null }
      state.addresses = { data: [], loading: false, error: null }
      state.pin = { data: null, loading: false, saving: false, error: null }
    },
    clearCustomerPin: (state) => {
      state.pin = { data: null, loading: false, saving: false, error: null }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAllCustomers.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchAllCustomers.fulfilled, (state, action) => {
        state.loading = false
        state.customers = action.payload.data
        state.total = action.payload.meta?.total || 0
        state.page = action.payload.meta?.page || 1
        state.limit = action.payload.meta?.limit || 20
      })
      .addCase(fetchAllCustomers.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message
      })
      .addCase(suspendCustomer.fulfilled, (state, action) => {
        const updated = action.payload
        if (updated?.id) {
          const i = state.customers.findIndex((u) => u.id === updated.id)
          if (i !== -1) state.customers[i] = updated
          if (state.detail.data?.id === updated.id) {
            state.detail.data = { ...state.detail.data, status: updated.status }
          }
        }
      })
      .addCase(unsuspendCustomer.fulfilled, (state, action) => {
        const updated = action.payload
        if (updated?.id) {
          const i = state.customers.findIndex((u) => u.id === updated.id)
          if (i !== -1) state.customers[i] = updated
          if (state.detail.data?.id === updated.id) {
            state.detail.data = { ...state.detail.data, status: updated.status }
          }
        }
      })
      .addCase(updateCustomer.fulfilled, (state, action) => {
        const updated = action.payload
        if (updated?.id) {
          const i = state.customers.findIndex((u) => u.id === updated.id)
          if (i !== -1) state.customers[i] = { ...state.customers[i], ...updated }
          if (state.detail.data?.id === updated.id) {
            state.detail.data = { ...state.detail.data, ...updated }
          }
        }
      })
      .addCase(wipeCustomerKyc.fulfilled, (state, action) => {
        const updated = action.payload
        if (updated?.id) {
          const i = state.customers.findIndex((u) => u.id === updated.id)
          if (i !== -1) state.customers[i] = { ...state.customers[i], ...updated }
          if (state.detail.data?.id === updated.id) {
            state.detail.data = { ...state.detail.data, ...updated }
          }
        }
      })
      .addCase(fetchCustomerStats.pending, (state) => {
        state.stats.loading = true
      })
      .addCase(fetchCustomerStats.fulfilled, (state, action) => {
        state.stats.loading = false
        state.stats.data = action.payload
      })
      .addCase(fetchCustomerStats.rejected, (state) => {
        state.stats.loading = false
      })
      .addCase(fetchCustomerPin.pending, (state) => {
        state.pin.loading = true
        state.pin.error = null
      })
      .addCase(fetchCustomerPin.fulfilled, (state, action) => {
        state.pin.loading = false
        state.pin.data = action.payload
      })
      .addCase(fetchCustomerPin.rejected, (state, action) => {
        state.pin.loading = false
        state.pin.error = action.error.message
      })
      .addCase(setCustomerPin.pending, (state) => {
        state.pin.saving = true
        state.pin.error = null
      })
      .addCase(setCustomerPin.fulfilled, (state, action) => {
        state.pin.saving = false
        state.pin.data = action.payload
        if (state.detail.data) {
          state.detail.data.hasPinSet = true
          state.detail.data.pinSetByUser = true
        }
      })
      .addCase(setCustomerPin.rejected, (state, action) => {
        state.pin.saving = false
        state.pin.error = action.error.message
      })
      .addCase(fetchCustomerDetail.pending, (state) => {
        state.detail.loading = true
        state.detail.error = null
      })
      .addCase(fetchCustomerDetail.fulfilled, (state, action) => {
        state.detail.loading = false
        state.detail.data = action.payload
      })
      .addCase(fetchCustomerDetail.rejected, (state, action) => {
        state.detail.loading = false
        state.detail.error = action.error.message
      })
      .addCase(fetchCustomerRequests.pending, (state) => {
        state.requests.loading = true
        state.requests.error = null
      })
      .addCase(fetchCustomerRequests.fulfilled, (state, action) => {
        state.requests.loading = false
        state.requests.data = action.payload.data
        state.requests.total = action.payload.meta?.total || 0
        state.requests.page = action.payload.meta?.page || 1
        state.requests.limit = action.payload.meta?.limit || 20
      })
      .addCase(fetchCustomerRequests.rejected, (state, action) => {
        state.requests.loading = false
        state.requests.error = action.error.message
      })
      .addCase(fetchCustomerTransactions.pending, (state) => {
        state.transactions.loading = true
        state.transactions.error = null
      })
      .addCase(fetchCustomerTransactions.fulfilled, (state, action) => {
        state.transactions.loading = false
        state.transactions.data = action.payload.data
        state.transactions.total = action.payload.meta?.total || 0
        state.transactions.page = action.payload.meta?.page || 1
        state.transactions.limit = action.payload.meta?.limit || 20
      })
      .addCase(fetchCustomerTransactions.rejected, (state, action) => {
        state.transactions.loading = false
        state.transactions.error = action.error.message
      })
      .addCase(fetchCustomerAddresses.pending, (state) => {
        state.addresses.loading = true
        state.addresses.error = null
      })
      .addCase(fetchCustomerAddresses.fulfilled, (state, action) => {
        state.addresses.loading = false
        state.addresses.data = action.payload
      })
      .addCase(fetchCustomerAddresses.rejected, (state, action) => {
        state.addresses.loading = false
        state.addresses.error = action.error.message
      })
  },
})

export const { clearCustomerDetail, clearCustomerPin } = customersSlice.actions

export default customersSlice.reducer

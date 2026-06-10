import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../lib/api'

// Pull the actual error message out of an axios failure. The backend always
// includes a human-readable `message` in its error body (e.g. "Invalid email
// or password") - without this helper we'd surface axios's default
// "Request failed with status code 401" to the user, which is what was
// happening before.
const apiErrorMessage = (err, fallback) => {
  const body = err?.response?.data
  if (body?.message) return body.message
  if (body?.error?.message) return body.error.message
  if (typeof body?.error === 'string') return body.error
  if (err?.code === 'ERR_NETWORK' || err?.message === 'Network Error') {
    return "Can't reach the server. Check your connection and try again."
  }
  if (err?.response?.status >= 500) {
    return 'Server error. Please try again in a moment.'
  }
  return fallback
}

export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password }) => {
    try {
      const response = await api.post('/auth/login', { email, password })
      return response.data.data
    } catch (err) {
      throw new Error(apiErrorMessage(err, 'Login failed. Please try again.'))
    }
  }
)

export const logout = createAsyncThunk(
  'auth/logout',
  async () => {
    // Best-effort tell the backend to revoke the session record. If the
    // network is down or the access token is already expired we still need
    // to clear local state below - never block sign-out on this call.
    try {
      await api.post('/auth/logout')
    } catch {
      // ignore
    }
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('merchant_user')
  }
)

// Pull the live profile so we know the current `transactionPinSetByUser` flag
// even for sessions that logged in before the field existed (the stored
// merchant_user blob won't have it). Merged into state.user so merchantId and
// other login-only fields are preserved.
export const fetchAuthProfile = createAsyncThunk(
  'auth/fetchProfile',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('/auth/profile')
      return res.data.data
    } catch (err) {
      return rejectWithValue(apiErrorMessage(err, 'Failed to load profile'))
    }
  }
)

// Set the transaction PIN for the first time (no current PIN required).
export const setTransactionPin = createAsyncThunk(
  'auth/setTransactionPin',
  async ({ pin }, { rejectWithValue }) => {
    try {
      const res = await api.post('/auth/pin', { pin })
      return res.data.data
    } catch (err) {
      return rejectWithValue({
        message: err?.response?.data?.message || apiErrorMessage(err, 'Failed to set PIN'),
        status: err?.response?.status ?? null,
        code: err?.response?.data?.code ?? null,
        errors: err?.response?.data?.errors ?? null,
      })
    }
  }
)

// Change the transaction PIN. Verifies the current PIN server-side, so a wrong
// current PIN comes back 401 and the form surfaces the message. There is no
// attempt lockout.
export const changeTransactionPin = createAsyncThunk(
  'auth/changeTransactionPin',
  async ({ currentPin, newPin }, { rejectWithValue }) => {
    try {
      const res = await api.post('/auth/pin/change', { currentPin, newPin })
      return res.data.data
    } catch (err) {
      return rejectWithValue({
        message: err?.response?.data?.message || apiErrorMessage(err, 'Failed to change PIN'),
        status: err?.response?.status ?? null,
        code: err?.response?.data?.code ?? null,
        errors: err?.response?.data?.errors ?? null,
      })
    }
  }
)

export const refreshToken = createAsyncThunk(
  'auth/refreshToken',
  async (_, { rejectWithValue }) => {
    // Backend's /auth/refresh expects { refreshToken } in the body - not a
    // Bearer header. Auth-by-header here was wrong and silently failed once
    // the access token expired.
    const stored = localStorage.getItem('refreshToken')
    if (!stored) return rejectWithValue('No refresh token')
    const response = await api.post('/auth/refresh', { refreshToken: stored })
    return response.data.data
  }
)

// Rehydrate the persisted user on app startup. Without this, refreshing the
// page leaves us "authenticated" (we still have a token) but state.auth.user
// is null - every page that reads state.auth.user?.merchantId breaks silently
// for the first few renders.
const readStoredUser = () => {
  try {
    const raw = localStorage.getItem('merchant_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: readStoredUser(),
    token: localStorage.getItem('token'),
    isAuthenticated: !!localStorage.getItem('token'),
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false
        state.user = action.payload.user
        state.token = action.payload.tokens?.accessToken
        state.isAuthenticated = true
        localStorage.setItem('token', action.payload.tokens?.accessToken)
        if (action.payload.tokens?.refreshToken) {
          localStorage.setItem('refreshToken', action.payload.tokens.refreshToken)
        }
        localStorage.setItem('merchant_user', JSON.stringify(action.payload.user))
      })
      .addCase(login.rejected, (state, action) => {
        // The "5 attempts → lock account" logic that used to live here was
        // pure client-side fiction: a page refresh reset the counter to 0,
        // so anyone hitting refresh got unlimited tries. The backend already
        // rate-limits /auth/login (authLimiter) - that's the real ceiling.
        state.loading = false
        state.error = action.error.message
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null
        state.token = null
        state.isAuthenticated = false
      })
      .addCase(fetchAuthProfile.fulfilled, (state, action) => {
        const p = action.payload || {}
        // Merge - the profile payload has no merchantId (that's login-only), so
        // a replace would wipe it and break every page reading user.merchantId.
        state.user = { ...(state.user || {}), ...p }
        try {
          localStorage.setItem('merchant_user', JSON.stringify(state.user))
        } catch {
          // ignore quota/serialization errors
        }
      })
      .addCase(setTransactionPin.fulfilled, (state) => {
        if (state.user) {
          state.user.hasPinSet = true
          state.user.transactionPinSetByUser = true
        }
        try {
          localStorage.setItem('merchant_user', JSON.stringify(state.user))
        } catch {
          // ignore
        }
      })
      .addCase(changeTransactionPin.fulfilled, (state) => {
        if (state.user) state.user.transactionPinSetByUser = true
        try {
          localStorage.setItem('merchant_user', JSON.stringify(state.user))
        } catch {
          // ignore
        }
      })
      .addCase(refreshToken.pending, (state) => {
        state.error = null
      })
      .addCase(refreshToken.fulfilled, (state, action) => {
        // Backend rotates the refresh token on every refresh - persist both so
        // the next /auth/refresh call has the latest valid pair.
        state.token = action.payload?.accessToken
        if (action.payload?.accessToken) {
          localStorage.setItem('token', action.payload.accessToken)
        }
        if (action.payload?.refreshToken) {
          localStorage.setItem('refreshToken', action.payload.refreshToken)
        }
        if (action.payload?.user) {
          state.user = action.payload.user
          localStorage.setItem('merchant_user', JSON.stringify(action.payload.user))
        }
      })
      .addCase(refreshToken.rejected, (state, action) => {
        state.error = action.error.message
        // Force logout on refresh failure
        state.user = null
        state.token = null
        state.isAuthenticated = false
        localStorage.removeItem('token')
        localStorage.removeItem('refreshToken')
        localStorage.removeItem('merchant_user')
      })
  },
})

export default authSlice.reducer

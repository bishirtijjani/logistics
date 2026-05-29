import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../lib/api'

// Pull the actual error message out of an axios failure. The backend always
// includes a human-readable `message` in its error body (e.g. "Invalid email
// or password") — without this helper we'd surface axios's default
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
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('merchant_user')
  }
)

export const verifyEmail = createAsyncThunk(
  'auth/verifyEmail',
  async ({ email, code }) => {
    try {
      const response = await api.post('/auth/verify-email', { email, code })
      return response.data.data
    } catch (err) {
      throw new Error(apiErrorMessage(err, 'Verification failed. Please try again.'))
    }
  }
)

export const resendVerification = createAsyncThunk(
  'auth/resendVerification',
  async ({ email }) => {
    try {
      const response = await api.post('/auth/resend-verification', { email })
      return response.data
    } catch (err) {
      throw new Error(apiErrorMessage(err, "Couldn't resend the code. Please try again."))
    }
  }
)

export const refreshToken = createAsyncThunk(
  'auth/refreshToken',
  async (_, { rejectWithValue }) => {
    // Backend's /auth/refresh expects { refreshToken } in the body — not a
    // Bearer header. Auth-by-header here was wrong and silently failed once
    // the access token expired.
    const stored = localStorage.getItem('refreshToken')
    if (!stored) return rejectWithValue('No refresh token')
    const response = await api.post('/auth/refresh', { refreshToken: stored })
    return response.data.data
  }
)

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    token: localStorage.getItem('token'),
    isAuthenticated: !!localStorage.getItem('token'),
    emailVerified: false,
    verificationLoading: false,
    loading: false,
    error: null,
    loginAttempts: 0,
    isLocked: false,
    lockoutTime: null,
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
        state.loginAttempts = 0
        state.isLocked = false
        state.lockoutTime = null
        localStorage.setItem('token', action.payload.tokens?.accessToken)
        if (action.payload.tokens?.refreshToken) {
          localStorage.setItem('refreshToken', action.payload.tokens.refreshToken)
        }
        localStorage.setItem('merchant_user', JSON.stringify(action.payload.user))
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message
        state.loginAttempts += 1
        
        // Lock account after 5 failed attempts
        if (state.loginAttempts >= 5) {
          state.isLocked = true
          state.lockoutTime = Date.now() + (15 * 60 * 1000) // 15 minutes lockout
          state.error = 'Account locked due to too many failed login attempts. Please try again in 15 minutes.'
        } else {
          const attemptsLeft = 5 - state.loginAttempts
          state.error = `${action.error.message}. ${attemptsLeft} attempts remaining before account lockout.`
        }
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null
        state.token = null
        state.isAuthenticated = false
        state.emailVerified = false
      })
      .addCase(verifyEmail.pending, (state) => {
        state.verificationLoading = true
        state.error = null
      })
      .addCase(verifyEmail.fulfilled, (state, action) => {
        state.verificationLoading = false
        state.emailVerified = true
        if (state.user) {
          state.user.emailVerified = true
        }
      })
      .addCase(verifyEmail.rejected, (state, action) => {
        state.verificationLoading = false
        state.error = action.error.message
      })
      .addCase(resendVerification.pending, (state) => {
        state.verificationLoading = true
        state.error = null
      })
      .addCase(resendVerification.fulfilled, (state) => {
        state.verificationLoading = false
      })
      .addCase(resendVerification.rejected, (state, action) => {
        state.verificationLoading = false
        state.error = action.error.message
      })
      .addCase(refreshToken.pending, (state) => {
        state.error = null
      })
      .addCase(refreshToken.fulfilled, (state, action) => {
        // Backend rotates the refresh token on every refresh — persist both so
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

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../lib/api'

export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password }) => {
    const response = await api.post('/auth/login', { email, password, role: 'MERCHANT' })
    return response.data.data
  }
)

export const logout = createAsyncThunk(
  'auth/logout',
  async () => {
    localStorage.removeItem('token')
    localStorage.removeItem('merchant_user')
  }
)

export const verifyEmail = createAsyncThunk(
  'auth/verifyEmail',
  async ({ email, code }) => {
    const response = await api.post('/auth/verify-email', { email, code })
    return response.data.data
  }
)

export const resendVerification = createAsyncThunk(
  'auth/resendVerification',
  async ({ email }) => {
    const response = await api.post('/auth/resend-verification', { email })
    return response.data
  }
)

export const refreshToken = createAsyncThunk(
  'auth/refreshToken',
  async () => {
    const currentToken = localStorage.getItem('token')
    const response = await api.post('/auth/refresh', {}, {
      headers: {
        'Authorization': `Bearer ${currentToken}`
      }
    })
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
        state.token = action.payload.token
        state.isAuthenticated = true
        state.loginAttempts = 0
        state.isLocked = false
        state.lockoutTime = null
        localStorage.setItem('token', action.payload.token)
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
        state.token = action.payload.token
        localStorage.setItem('token', action.payload.token)
        if (action.payload.user) {
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
        localStorage.removeItem('merchant_user')
      })
  },
})

export default authSlice.reducer

import { createSlice } from '@reduxjs/toolkit'

const loadStoredUser = () => {
  try {
    const raw = localStorage.getItem('authUser')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const storedToken = localStorage.getItem('accessToken')
const storedUser = loadStoredUser()

const initialState = {
  user: storedUser,
  token: storedToken,
  isAuthenticated: !!storedToken,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      state.user = action.payload.user
      if (action.payload.token) {
        state.token = action.payload.token
        localStorage.setItem('accessToken', action.payload.token)
      }
      // Stash the refresh token so useAuthSession can silently extend the
      // session via /auth/refresh before the access token expires.
      if (action.payload.refreshToken) {
        localStorage.setItem('refreshToken', action.payload.refreshToken)
      }
      state.isAuthenticated = true
      localStorage.setItem('authUser', JSON.stringify(action.payload.user))
    },
    setUser: (state, action) => {
      state.user = action.payload
      state.isAuthenticated = true
      localStorage.setItem('authUser', JSON.stringify(action.payload))
    },
    logout: (state) => {
      state.user = null
      state.token = null
      state.isAuthenticated = false
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('authUser')
    },
  },
})

export const { setCredentials, setUser, logout } = authSlice.actions
export default authSlice.reducer

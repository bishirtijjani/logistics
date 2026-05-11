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
      localStorage.removeItem('authUser')
    },
  },
})

export const { setCredentials, setUser, logout } = authSlice.actions
export default authSlice.reducer

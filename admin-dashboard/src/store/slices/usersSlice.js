import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../lib/api'

export const fetchAllUsers = createAsyncThunk(
  'users/fetchAll',
  async ({ page, limit, role, search }) => {
    const params = new URLSearchParams({
      page: page || 1,
      limit: limit || 20,
      ...(role && { role }),
      ...(search && { search }),
    })
    const response = await api.get(`/admin/users?${params}`)
    return response.data.data
  }
)

export const suspendUser = createAsyncThunk(
  'users/suspend',
  async ({ userId, reason }) => {
    const response = await api.patch(`/admin/users/${userId}/status`, { status: 'SUSPENDED', reason })
    return response.data
  }
)

export const unsuspendUser = createAsyncThunk(
  'users/unsuspend',
  async (userId) => {
    const response = await api.patch(`/admin/users/${userId}/status`, { status: 'ACTIVE' })
    return response.data
  }
)

const usersSlice = createSlice({
  name: 'users',
  initialState: {
    users: [],
    total: 0,
    page: 1,
    limit: 20,
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAllUsers.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchAllUsers.fulfilled, (state, action) => {
        state.loading = false
        state.users = action.payload.users
        state.total = action.payload.total
        state.page = action.payload.page
        state.limit = action.payload.limit
      })
      .addCase(fetchAllUsers.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message
      })
      .addCase(suspendUser.fulfilled, (state) => {
        state.loading = false
      })
      .addCase(unsuspendUser.fulfilled, (state) => {
        state.loading = false
      })
  },
})

export default usersSlice.reducer

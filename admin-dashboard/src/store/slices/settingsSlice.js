import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../lib/api'

export const fetchPlatformSettings = createAsyncThunk(
  'settings/fetchPlatform',
  async () => {
    const response = await api.get('/admin/settings')
    return response.data.data
  }
)

export const updatePlatformSettings = createAsyncThunk(
  'settings/updatePlatform',
  async (settings) => {
    const response = await api.put('/admin/settings', settings)
    return response.data.data
  }
)

const settingsSlice = createSlice({
  name: 'settings',
  initialState: {
    platformSettings: null,
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchPlatformSettings.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchPlatformSettings.fulfilled, (state, action) => {
        state.loading = false
        state.platformSettings = action.payload
      })
      .addCase(fetchPlatformSettings.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message
      })
      .addCase(updatePlatformSettings.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(updatePlatformSettings.fulfilled, (state, action) => {
        state.loading = false
        state.platformSettings = action.payload
      })
      .addCase(updatePlatformSettings.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message
      })
  },
})

export default settingsSlice.reducer

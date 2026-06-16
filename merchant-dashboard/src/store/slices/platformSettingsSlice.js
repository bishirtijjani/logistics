import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../lib/api'

export const fetchPlatformSettings = createAsyncThunk(
  'platformSettings/fetch',
  async () => {
    const res = await api.get('/settings/public')
    return res.data.data
  }
)

const platformSettingsSlice = createSlice({
  name: 'platformSettings',
  initialState: {
    settings: {},
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchPlatformSettings.pending, (state) => {
        state.loading = true
      })
      .addCase(fetchPlatformSettings.fulfilled, (state, action) => {
        state.loading = false
        state.settings = action.payload || {}
      })
      .addCase(fetchPlatformSettings.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message
      })
  },
})

export default platformSettingsSlice.reducer

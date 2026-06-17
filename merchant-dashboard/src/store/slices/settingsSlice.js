import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../lib/api'

export const fetchSettings = createAsyncThunk(
  'settings/fetch',
  async ({ merchantId }) => {
    const response = await api.get(`/merchants/merchant/${merchantId}/profile`)
    return response.data.data
  }
)

export const updateSettings = createAsyncThunk(
  'settings/update',
  async ({ merchantId, ...settings }) => {
    const response = await api.patch(`/merchants/merchant/${merchantId}/profile`, settings)
    return response.data.data
  }
)

export const toggleStoreStatus = createAsyncThunk(
  'settings/toggleStatus',
  async ({ merchantId, isOpen }) => {
    const response = await api.patch(`/merchants/${merchantId}/status`, { isOpen })
    return response.data.data
  }
)

const settingsSlice = createSlice({
  name: 'settings',
  initialState: {
    settings: null,
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSettings.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchSettings.fulfilled, (state, action) => {
        state.loading = false
        state.settings = action.payload
      })
      .addCase(fetchSettings.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message
      })
      .addCase(updateSettings.fulfilled, (state, action) => {
        state.settings = action.payload
      })
      .addCase(toggleStoreStatus.fulfilled, (state, action) => {
        if (state.settings) {
          state.settings.isOpen = action.payload.isOpen
        }
      })
  },
})

export default settingsSlice.reducer

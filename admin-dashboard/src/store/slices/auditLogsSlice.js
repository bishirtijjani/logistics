import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../lib/api'

export const fetchAuditLogs = createAsyncThunk(
  'auditLogs/fetchAuditLogs',
  async (params) => {
    const response = await api.get('/admin/audit-logs', { params })
    return response.data
  }
)

const auditLogsSlice = createSlice({
  name: 'auditLogs',
  initialState: {
    logs: [],
    total: 0,
    page: 1,
    limit: 20,
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAuditLogs.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchAuditLogs.fulfilled, (state, action) => {
        state.loading = false
        state.logs = action.payload.data || []
        state.total = action.payload.meta?.total || 0
        state.page = action.payload.meta?.page || 1
        state.limit = action.payload.meta?.limit || 20
      })
      .addCase(fetchAuditLogs.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message
      })
  },
})

export default auditLogsSlice.reducer

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../lib/api'

// ============================================================
// Pre-launch waitlist - admin
// ============================================================

export const fetchWaitlist = createAsyncThunk(
  'waitlist/fetchAll',
  async ({ role, platform, search, page = 1, limit = 50 } = {}) => {
    const params = new URLSearchParams({
      page,
      limit,
      ...(role && { role }),
      ...(platform && { platform }),
      ...(search && { search }),
    })
    const response = await api.get(`/admin/waitlist?${params}`)
    return response.data
  },
)

export const fetchWaitlistSummary = createAsyncThunk(
  'waitlist/fetchSummary',
  async () => {
    const response = await api.get('/admin/waitlist/summary')
    return response.data.data
  },
)

export const deleteWaitlistEntry = createAsyncThunk(
  'waitlist/delete',
  async (id) => {
    await api.delete(`/admin/waitlist/${id}`)
    return id
  },
)

const waitlistSlice = createSlice({
  name: 'waitlist',
  initialState: {
    entries: [],
    total: 0,
    page: 1,
    limit: 50,
    loading: false,
    error: null,
    summary: { total: 0, roleCounts: {}, platformCounts: {} },
    summaryLoading: false,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchWaitlist.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchWaitlist.fulfilled, (state, action) => {
        state.loading = false
        state.entries = action.payload?.data || []
        state.total = action.payload?.meta?.total || 0
        state.page = action.payload?.meta?.page || 1
        state.limit = action.payload?.meta?.limit || 50
      })
      .addCase(fetchWaitlist.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message
      })

      .addCase(fetchWaitlistSummary.pending, (state) => {
        state.summaryLoading = true
      })
      .addCase(fetchWaitlistSummary.fulfilled, (state, action) => {
        state.summaryLoading = false
        if (action.payload) state.summary = action.payload
      })
      .addCase(fetchWaitlistSummary.rejected, (state) => {
        state.summaryLoading = false
      })

      .addCase(deleteWaitlistEntry.fulfilled, (state, action) => {
        state.entries = state.entries.filter((e) => e.id !== action.payload)
        state.total = Math.max(0, state.total - 1)
      })
  },
})

export default waitlistSlice.reducer

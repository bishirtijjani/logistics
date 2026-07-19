import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../lib/api'

// Wiring: GET /notifications (paginated), GET /notifications/unread-count,
// PATCH /notifications/:id/read, PATCH /notifications/read-all. Backend
// envelope is { success, message, data, meta } and this client's axios
// instance does NOT unwrap it, so every thunk below reaches through
// response.data.data / response.data.meta - mirrors ordersSlice.js.
export const fetchNotifications = createAsyncThunk(
  'notifications/fetchAll',
  async ({ page = 1, limit = 20, unreadOnly = false } = {}) => {
    const params = new URLSearchParams({
      page,
      limit,
      ...(unreadOnly && { unread: 'true' }),
    })
    const response = await api.get(`/notifications?${params}`)
    return {
      list: response.data.data,
      page: response.data.meta?.page || page,
      total: response.data.meta?.total ?? response.data.data.length,
      unreadCount: response.data.meta?.unreadCount,
    }
  }
)

export const fetchUnreadCount = createAsyncThunk(
  'notifications/unreadCount',
  async () => {
    const response = await api.get('/notifications/unread-count')
    return response.data.data.count
  }
)

export const markNotificationRead = createAsyncThunk(
  'notifications/markRead',
  async (notificationId) => {
    const response = await api.patch(`/notifications/${notificationId}/read`)
    return response.data.data
  }
)

export const markAllNotificationsRead = createAsyncThunk(
  'notifications/markAllRead',
  async () => {
    await api.patch('/notifications/read-all')
    return true
  }
)

const initialState = {
  list: [],
  page: 1,
  total: 0,
  unreadCount: 0,
  loading: false,
  error: null,
}

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    // Server pushed `notification:new` over the socket - prepend + bump the
    // badge immediately, same pattern as the mobile apps' notificationsBus.
    notificationReceived: (state, action) => {
      const n = action.payload
      if (!n?.id) return
      if (state.list.some((x) => x.id === n.id)) return
      state.list.unshift({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        data: n.data || {},
        requestId: n.requestId || null,
        readAt: null,
        createdAt: n.createdAt || new Date().toISOString(),
      })
      state.total += 1
      state.unreadCount += 1
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false
        const { list, page, total, unreadCount } = action.payload
        if (page === 1) {
          state.list = list
        } else {
          const seen = new Set(state.list.map((n) => n.id))
          state.list.push(...list.filter((n) => !seen.has(n.id)))
        }
        state.page = page
        state.total = total
        if (typeof unreadCount === 'number') state.unreadCount = unreadCount
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message
      })
      .addCase(fetchUnreadCount.fulfilled, (state, action) => {
        state.unreadCount = action.payload
      })
      .addCase(markNotificationRead.fulfilled, (state, action) => {
        const updated = action.payload
        if (!updated) return
        const row = state.list.find((n) => n.id === updated.id)
        if (row && !row.readAt) {
          row.readAt = updated.readAt || new Date().toISOString()
          state.unreadCount = Math.max(0, state.unreadCount - 1)
        }
      })
      .addCase(markAllNotificationsRead.fulfilled, (state) => {
        const now = new Date().toISOString()
        state.list.forEach((n) => { if (!n.readAt) n.readAt = now })
        state.unreadCount = 0
      })
  },
})

export const { notificationReceived } = notificationsSlice.actions
export default notificationsSlice.reducer

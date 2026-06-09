/**
 * Notifications slice - Notification Center feed + unread badge.
 *
 * Wiring:
 *  - REST: GET /notifications (paginated), GET /unread-count, PATCH /:id/read, PATCH /read-all.
 *  - Socket: `notification:new` from the server prepends to the list and
 *    increments the badge in real time (see services/socket.js subscription).
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// NB: api.js's response interceptor unwraps to the envelope body
//   { success, message, data, meta }
// so `envelope.data` is the payload and `envelope.meta` is pagination meta.
export const fetchNotifications = createAsyncThunk(
  'notifications/fetch',
  async ({ page = 1, limit = 20, unreadOnly = false } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (unreadOnly) params.set('unread', 'true');
      const envelope = await api.get(`/notifications?${params.toString()}`);
      const list = envelope?.data || [];
      const meta = envelope?.meta || {};
      return {
        list,
        page: meta.page || page,
        total: typeof meta.total === 'number' ? meta.total : list.length,
        unreadCount: typeof meta.unreadCount === 'number' ? meta.unreadCount : null,
      };
    } catch (err) {
      return rejectWithValue(err?.message || 'Failed to load notifications');
    }
  },
);

export const fetchUnreadCount = createAsyncThunk(
  'notifications/unreadCount',
  async (_, { rejectWithValue }) => {
    try {
      const envelope = await api.get('/notifications/unread-count');
      return envelope?.data?.count ?? 0;
    } catch (err) {
      return rejectWithValue(err?.message || 'Failed to fetch unread count');
    }
  },
);

export const markNotificationRead = createAsyncThunk(
  'notifications/markRead',
  async (notificationId, { rejectWithValue }) => {
    try {
      const envelope = await api.patch(`/notifications/${notificationId}/read`);
      return envelope?.data;
    } catch (err) {
      return rejectWithValue(err?.message || 'Failed to mark as read');
    }
  },
);

export const markAllNotificationsRead = createAsyncThunk(
  'notifications/markAllRead',
  async (_, { rejectWithValue }) => {
    try {
      await api.patch('/notifications/read-all');
      return true;
    } catch (err) {
      return rejectWithValue(err?.message || 'Failed to mark all as read');
    }
  },
);

const initialState = {
  list: [],
  page: 1,
  total: 0,
  unreadCount: 0,
  isLoading: false,
  error: null,
};

const slice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    // Server pushed a new notification via socket - prepend + bump badge.
    notificationReceived: (state, action) => {
      const n = action.payload;
      if (!n || !n.id) return;
      // Dedupe in case a REST refetch already pulled it.
      if (state.list.find((x) => x.id === n.id)) return;
      state.list.unshift({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        data: n.data || {},
        requestId: n.requestId || null,
        transactionId: n.transactionId || null,
        readAt: null,
        createdAt: n.createdAt || new Date().toISOString(),
      });
      state.total += 1;
      state.unreadCount += 1;
    },
    resetNotifications: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.isLoading = false;
        const { list, page, total, unreadCount } = action.payload;
        if (page === 1) {
          state.list = list;
        } else {
          // Append, de-duped.
          const seen = new Set(state.list.map((n) => n.id));
          state.list.push(...list.filter((n) => !seen.has(n.id)));
        }
        state.page = page;
        state.total = total;
        if (typeof unreadCount === 'number') state.unreadCount = unreadCount;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    builder.addCase(fetchUnreadCount.fulfilled, (state, action) => {
      state.unreadCount = action.payload;
    });

    builder.addCase(markNotificationRead.fulfilled, (state, action) => {
      const updated = action.payload;
      if (!updated) return;
      const row = state.list.find((n) => n.id === updated.id);
      if (row && !row.readAt) {
        row.readAt = updated.readAt || new Date().toISOString();
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    });

    builder.addCase(markAllNotificationsRead.fulfilled, (state) => {
      const now = new Date().toISOString();
      state.list.forEach((n) => {
        if (!n.readAt) n.readAt = now;
      });
      state.unreadCount = 0;
    });

    // Cross-user state isolation on forced logout is handled by the
    // root reducer in `store/index.js` - it wipes this slice along with the
    // rest of the user-scoped state on the `auth/forceLogout` action.
  },
});

export const { notificationReceived, resetNotifications } = slice.actions;
export default slice.reducer;

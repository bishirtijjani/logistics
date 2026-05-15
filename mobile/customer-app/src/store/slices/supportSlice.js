/**
 * Support slice — tickets and disputes.
 *
 * Patterns mirror requestSlice.js: envelope-unwrapping HTTP, idempotency keys
 * on creation, rejectWithValue carries the full error so screens can read
 * .status / .data for validation surfaces.
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import { newIdempotencyKey } from '../../services/idempotency';

// ============================================================
// Tickets
// ============================================================

export const fetchMyTickets = createAsyncThunk(
  'support/fetchMyTickets',
  async ({ status, page = 1, limit = 20 } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      params.append('page', page);
      params.append('limit', limit);
      const envelope = await api.get(`/support/tickets?${params.toString()}`);
      return { tickets: envelope?.data || [], ...(envelope?.meta || {}) };
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to load tickets');
    }
  },
);

export const createTicket = createAsyncThunk(
  'support/createTicket',
  async (data, { rejectWithValue }) => {
    try {
      const envelope = await api.post('/support/tickets', data, {
        headers: { 'Idempotency-Key': newIdempotencyKey() },
      });
      return envelope?.data;
    } catch (error) {
      return rejectWithValue({
        message: error?.message || 'Failed to create ticket',
        status: error?.status ?? null,
        data: error?.data ?? null,
      });
    }
  },
);

export const fetchTicketDetail = createAsyncThunk(
  'support/fetchTicketDetail',
  async (ticketId, { rejectWithValue }) => {
    try {
      const envelope = await api.get(`/support/tickets/${ticketId}`);
      return envelope?.data;
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to load ticket');
    }
  },
);

export const postTicketMessage = createAsyncThunk(
  'support/postTicketMessage',
  async ({ ticketId, body, attachmentUrls = [] }, { rejectWithValue }) => {
    try {
      const envelope = await api.post(`/support/tickets/${ticketId}/messages`, {
        body,
        attachmentUrls,
      });
      return envelope?.data;
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to send message');
    }
  },
);

export const closeTicket = createAsyncThunk(
  'support/closeTicket',
  async (ticketId, { rejectWithValue }) => {
    try {
      const envelope = await api.patch(`/support/tickets/${ticketId}/close`);
      return envelope?.data;
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to close ticket');
    }
  },
);

// ============================================================
// Disputes
// ============================================================

export const fetchMyDisputes = createAsyncThunk(
  'support/fetchMyDisputes',
  async ({ status, page = 1, limit = 20 } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      params.append('page', page);
      params.append('limit', limit);
      const envelope = await api.get(`/support/disputes?${params.toString()}`);
      return { disputes: envelope?.data || [], ...(envelope?.meta || {}) };
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to load disputes');
    }
  },
);

export const createDispute = createAsyncThunk(
  'support/createDispute',
  async (data, { rejectWithValue }) => {
    try {
      const envelope = await api.post('/support/disputes', data, {
        headers: { 'Idempotency-Key': newIdempotencyKey() },
      });
      return envelope?.data;
    } catch (error) {
      return rejectWithValue({
        message: error?.message || 'Failed to file dispute',
        status: error?.status ?? null,
        data: error?.data ?? null,
      });
    }
  },
);

export const fetchDisputeDetail = createAsyncThunk(
  'support/fetchDisputeDetail',
  async (disputeId, { rejectWithValue }) => {
    try {
      const envelope = await api.get(`/support/disputes/${disputeId}`);
      return envelope?.data;
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to load dispute');
    }
  },
);

export const postDisputeMessage = createAsyncThunk(
  'support/postDisputeMessage',
  async ({ disputeId, body, attachmentUrls = [] }, { rejectWithValue }) => {
    try {
      const envelope = await api.post(`/support/disputes/${disputeId}/messages`, {
        body,
        attachmentUrls,
      });
      return envelope?.data;
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to send message');
    }
  },
);

// ============================================================
// Slice
// ============================================================

const supportSlice = createSlice({
  name: 'support',
  initialState: {
    tickets: [],
    ticketsLoading: false,
    ticketsError: null,
    ticketDetail: null,
    ticketDetailLoading: false,

    disputes: [],
    disputesLoading: false,
    disputesError: null,
    disputeDetail: null,
    disputeDetailLoading: false,
  },
  reducers: {
    clearTicketDetail(state) {
      state.ticketDetail = null;
    },
    clearDisputeDetail(state) {
      state.disputeDetail = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // tickets list
      .addCase(fetchMyTickets.pending, (state) => {
        state.ticketsLoading = true;
        state.ticketsError = null;
      })
      .addCase(fetchMyTickets.fulfilled, (state, action) => {
        state.ticketsLoading = false;
        state.tickets = action.payload?.tickets || [];
      })
      .addCase(fetchMyTickets.rejected, (state, action) => {
        state.ticketsLoading = false;
        state.ticketsError = action.payload || 'Failed to load tickets';
      })

      .addCase(createTicket.fulfilled, (state, action) => {
        if (action.payload) {
          state.tickets = [action.payload, ...state.tickets];
        }
      })

      .addCase(fetchTicketDetail.pending, (state) => {
        state.ticketDetailLoading = true;
      })
      .addCase(fetchTicketDetail.fulfilled, (state, action) => {
        state.ticketDetailLoading = false;
        state.ticketDetail = action.payload;
      })
      .addCase(fetchTicketDetail.rejected, (state) => {
        state.ticketDetailLoading = false;
      })

      .addCase(postTicketMessage.fulfilled, (state, action) => {
        if (state.ticketDetail && action.payload) {
          state.ticketDetail.messages = [
            ...(state.ticketDetail.messages || []),
            action.payload,
          ];
          state.ticketDetail.lastActivityAt = action.payload.createdAt;
        }
      })

      .addCase(closeTicket.fulfilled, (state, action) => {
        if (!action.payload) return;
        const idx = state.tickets.findIndex((t) => t.id === action.payload.id);
        if (idx !== -1) state.tickets[idx] = { ...state.tickets[idx], ...action.payload };
        if (state.ticketDetail?.id === action.payload.id) {
          state.ticketDetail = { ...state.ticketDetail, ...action.payload };
        }
      })

      // disputes list
      .addCase(fetchMyDisputes.pending, (state) => {
        state.disputesLoading = true;
        state.disputesError = null;
      })
      .addCase(fetchMyDisputes.fulfilled, (state, action) => {
        state.disputesLoading = false;
        state.disputes = action.payload?.disputes || [];
      })
      .addCase(fetchMyDisputes.rejected, (state, action) => {
        state.disputesLoading = false;
        state.disputesError = action.payload || 'Failed to load disputes';
      })

      .addCase(createDispute.fulfilled, (state, action) => {
        if (action.payload) {
          state.disputes = [action.payload, ...state.disputes];
        }
      })

      .addCase(fetchDisputeDetail.pending, (state) => {
        state.disputeDetailLoading = true;
      })
      .addCase(fetchDisputeDetail.fulfilled, (state, action) => {
        state.disputeDetailLoading = false;
        state.disputeDetail = action.payload;
      })
      .addCase(fetchDisputeDetail.rejected, (state) => {
        state.disputeDetailLoading = false;
      })

      .addCase(postDisputeMessage.fulfilled, (state, action) => {
        if (state.disputeDetail && action.payload) {
          state.disputeDetail.messages = [
            ...(state.disputeDetail.messages || []),
            action.payload,
          ];
          state.disputeDetail.lastActivityAt = action.payload.createdAt;
        }
      });
  },
});

export const { clearTicketDetail, clearDisputeDetail } = supportSlice.actions;
export default supportSlice.reducer;

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";
import { newIdempotencyKey } from "../../services/idempotency";

/**
 * Support slice — tickets + disputes.
 *
 * Phase 4 shipped `fetchTickets` + `createTicketFromTrip` (auto-filed from
 * the cockpit's contact sheet when the rider can't reach the counterparty).
 * Phase 7 adds the full surface:
 *   - tickets:  fetch list, fetch detail, create, post message, close
 *   - disputes: fetch list, fetch detail, create, post message
 *
 * Server-side TicketCategory enum (see support.validator.js):
 *   ACCOUNT, PAYMENT, ORDER, DELIVERY, PRODUCT, TECHNICAL, OTHER.
 * Rider operational issues map to DELIVERY.
 *
 * DisputeCategory enum (see support.validator.js):
 *   ITEM_NOT_RECEIVED, ITEM_DAMAGED, ITEM_INCORRECT, REFUND_REQUEST, OTHER.
 */

// ============================================================
// Tickets
// ============================================================

export const fetchTickets = createAsyncThunk(
  "support/fetchTickets",
  async ({ status, page = 1, limit = 20 } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      if (status) params.append("status", status);
      params.append("page", String(page));
      params.append("limit", String(limit));
      const envelope = await api.get(`/support/tickets?${params.toString()}`);
      const payload = envelope?.data || envelope || [];
      return Array.isArray(payload) ? payload : (payload.tickets || []);
    } catch (err) {
      return rejectWithValue(err?.message || "Failed to load tickets");
    }
  },
);

export const fetchTicketDetail = createAsyncThunk(
  "support/fetchTicketDetail",
  async (ticketId, { rejectWithValue }) => {
    try {
      const envelope = await api.get(`/support/tickets/${ticketId}`);
      return envelope?.data || envelope;
    } catch (err) {
      return rejectWithValue(err?.message || "Failed to load ticket");
    }
  },
);

/**
 * Auto-file a support ticket from the cockpit. Operational context is
 * inlined (stage + counterpart + attempt count) so the support dashboard
 * can act on it without further round-trips. Idempotent so a flaky retry
 * doesn't double-file.
 */
export const createTicketFromTrip = createAsyncThunk(
  "support/createTicketFromTrip",
  async (
    { requestId, stage, counterpartName, counterpartPhone, callAttempts, idempotencyKey: existingKey },
    { rejectWithValue },
  ) => {
    const key = existingKey || newIdempotencyKey();
    const subject = stage === "pickup"
      ? "Merchant / sender not reachable"
      : "Customer not reachable";
    const description = [
      `Trip: ${requestId}`,
      `Stage: ${stage}`,
      counterpartName ? `Counterpart: ${counterpartName}` : null,
      counterpartPhone ? `Phone: ${counterpartPhone}` : null,
      typeof callAttempts === "number" ? `Call attempts so far: ${callAttempts}` : null,
      "",
      "Filed from the rider app cockpit. Please advise next steps.",
    ].filter(Boolean).join("\n");

    try {
      const envelope = await api.post(
        "/support/tickets",
        {
          category: "DELIVERY",
          priority: "HIGH",
          subject,
          description,
          attachmentUrls: [],
        },
        { headers: { "Idempotency-Key": key } },
      );
      return envelope?.data || envelope || null;
    } catch (err) {
      return rejectWithValue({
        code: err?.code || "TICKET_CREATE_FAILED",
        message: err?.message || "Couldn't create ticket",
        idempotencyKey: key,
      });
    }
  },
);

/**
 * Create a generic ticket from CreateTicketScreen. Defined here so callers
 * don't fan out into a second source of truth.
 */
export const createTicket = createAsyncThunk(
  "support/createTicket",
  async ({ category, priority, subject, description, attachmentUrls, idempotencyKey: existingKey }, { rejectWithValue }) => {
    const key = existingKey || newIdempotencyKey();
    try {
      const envelope = await api.post(
        "/support/tickets",
        { category, priority: priority || "MEDIUM", subject, description, attachmentUrls: attachmentUrls || [] },
        { headers: { "Idempotency-Key": key } },
      );
      return envelope?.data || envelope || null;
    } catch (err) {
      return rejectWithValue({
        code: err?.code || "TICKET_CREATE_FAILED",
        message: err?.message || "Couldn't create ticket",
        idempotencyKey: key,
      });
    }
  },
);

export const postTicketMessage = createAsyncThunk(
  "support/postTicketMessage",
  async ({ ticketId, body, attachmentUrls = [] }, { rejectWithValue }) => {
    try {
      const envelope = await api.post(`/support/tickets/${ticketId}/messages`, {
        body, attachmentUrls,
      });
      return envelope?.data || envelope;
    } catch (err) {
      return rejectWithValue(err?.message || "Failed to send message");
    }
  },
);

export const closeTicket = createAsyncThunk(
  "support/closeTicket",
  async (ticketId, { rejectWithValue }) => {
    try {
      const envelope = await api.patch(`/support/tickets/${ticketId}/close`);
      return envelope?.data || envelope;
    } catch (err) {
      return rejectWithValue(err?.message || "Failed to close ticket");
    }
  },
);

// ============================================================
// Disputes
// ============================================================

export const fetchDisputes = createAsyncThunk(
  "support/fetchDisputes",
  async ({ status, page = 1, limit = 20 } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      if (status) params.append("status", status);
      params.append("page", String(page));
      params.append("limit", String(limit));
      const envelope = await api.get(`/support/disputes?${params.toString()}`);
      const payload = envelope?.data || envelope || [];
      return Array.isArray(payload) ? payload : (payload.disputes || []);
    } catch (err) {
      return rejectWithValue(err?.message || "Failed to load disputes");
    }
  },
);

export const fetchDisputeDetail = createAsyncThunk(
  "support/fetchDisputeDetail",
  async (disputeId, { rejectWithValue }) => {
    try {
      const envelope = await api.get(`/support/disputes/${disputeId}`);
      return envelope?.data || envelope;
    } catch (err) {
      return rejectWithValue(err?.message || "Failed to load dispute");
    }
  },
);

export const createDispute = createAsyncThunk(
  "support/createDispute",
  async ({ requestId, category, reason, description, attachmentUrls, idempotencyKey: existingKey }, { rejectWithValue }) => {
    const key = existingKey || newIdempotencyKey();
    try {
      const envelope = await api.post(
        "/support/disputes",
        { requestId, category, reason, description, attachmentUrls: attachmentUrls || [] },
        { headers: { "Idempotency-Key": key } },
      );
      return envelope?.data || envelope;
    } catch (err) {
      return rejectWithValue({
        code: err?.code || "DISPUTE_CREATE_FAILED",
        message: err?.message || "Couldn't file dispute",
        idempotencyKey: key,
      });
    }
  },
);

export const postDisputeMessage = createAsyncThunk(
  "support/postDisputeMessage",
  async ({ disputeId, body, attachmentUrls = [] }, { rejectWithValue }) => {
    try {
      const envelope = await api.post(`/support/disputes/${disputeId}/messages`, {
        body, attachmentUrls,
      });
      return envelope?.data || envelope;
    } catch (err) {
      return rejectWithValue(err?.message || "Failed to send message");
    }
  },
);

// ============================================================
// Slice
// ============================================================

const initialState = {
  tickets: [],
  ticketDetail: null,
  ticketDetailLoading: false,
  ticketsLoading: false,
  ticketsError: null,
  disputes: [],
  disputeDetail: null,
  disputeDetailLoading: false,
  disputesLoading: false,
  disputesError: null,
  isLoading: false, // legacy aggregate flag used by Phase 4 callers
  error: null,
};

const slice = createSlice({
  name: "support",
  initialState,
  reducers: {
    clearTicketDetail(state) {
      state.ticketDetail = null;
    },
    clearDisputeDetail(state) {
      state.disputeDetail = null;
    },
    resetSupport: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      // ── Tickets list ─────────────────────────────────────────────────────
      .addCase(fetchTickets.pending, (state) => {
        state.ticketsLoading = true;
        state.isLoading = true;
        state.ticketsError = null;
        state.error = null;
      })
      .addCase(fetchTickets.fulfilled, (state, action) => {
        state.ticketsLoading = false;
        state.isLoading = false;
        state.tickets = action.payload;
      })
      .addCase(fetchTickets.rejected, (state, action) => {
        state.ticketsLoading = false;
        state.isLoading = false;
        state.ticketsError = action.payload;
        state.error = action.payload;
      })
      // ── Ticket detail ────────────────────────────────────────────────────
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
      // ── Create ticket ────────────────────────────────────────────────────
      .addCase(createTicketFromTrip.fulfilled, (state, action) => {
        if (action.payload) state.tickets = [action.payload, ...state.tickets];
      })
      .addCase(createTicket.fulfilled, (state, action) => {
        if (action.payload) state.tickets = [action.payload, ...state.tickets];
      })
      // ── Post ticket message ──────────────────────────────────────────────
      .addCase(postTicketMessage.fulfilled, (state, action) => {
        if (state.ticketDetail && action.payload) {
          state.ticketDetail.messages = [
            ...(state.ticketDetail.messages || []),
            action.payload,
          ];
          state.ticketDetail.lastActivityAt = action.payload.createdAt;
        }
      })
      // ── Close ticket ─────────────────────────────────────────────────────
      .addCase(closeTicket.fulfilled, (state, action) => {
        if (!action.payload) return;
        const idx = state.tickets.findIndex((t) => t.id === action.payload.id);
        if (idx !== -1) state.tickets[idx] = { ...state.tickets[idx], ...action.payload };
        if (state.ticketDetail?.id === action.payload.id) {
          state.ticketDetail = { ...state.ticketDetail, ...action.payload };
        }
      })
      // ── Disputes list ────────────────────────────────────────────────────
      .addCase(fetchDisputes.pending, (state) => {
        state.disputesLoading = true;
        state.disputesError = null;
      })
      .addCase(fetchDisputes.fulfilled, (state, action) => {
        state.disputesLoading = false;
        state.disputes = action.payload;
      })
      .addCase(fetchDisputes.rejected, (state, action) => {
        state.disputesLoading = false;
        state.disputesError = action.payload;
      })
      // ── Dispute detail ───────────────────────────────────────────────────
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
      .addCase(createDispute.fulfilled, (state, action) => {
        if (action.payload) state.disputes = [action.payload, ...state.disputes];
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

export const { clearTicketDetail, clearDisputeDetail, resetSupport } = slice.actions;
export default slice.reducer;

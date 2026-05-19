import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";
import { newIdempotencyKey } from "../../services/idempotency";

/**
 * Support slice — tickets + disputes.
 *
 * Phase 4 surface:
 *   - `fetchTickets()` — list (used by the support tab in Phase 7).
 *   - `createTicketFromTrip({ requestId, stage, counterpartName, callAttempts })`
 *     — auto-files a CUSTOMER_UNREACHABLE / WRONG_ADDRESS support ticket from
 *     the cockpit's contact sheet when the rider can't reach the counterparty.
 *     Idempotent so a flaky retry doesn't double-file.
 *
 * Server-side TicketCategory enum values (see support.validator.js):
 *   ACCOUNT, PAYMENT, ORDER, DELIVERY, PRODUCT, TECHNICAL, OTHER.
 * Rider operational issues map to DELIVERY.
 */

export const fetchTickets = createAsyncThunk(
  "support/fetchTickets",
  async (_, { rejectWithValue }) => {
    try {
      const envelope = await api.get("/support/tickets");
      const payload = envelope?.data || envelope || [];
      // Backend returns either { tickets, total, page } or the raw array.
      return Array.isArray(payload) ? payload : (payload.tickets || []);
    } catch (err) {
      return rejectWithValue(err?.message || "Failed to load tickets");
    }
  },
);

/**
 * Auto-file a support ticket from the cockpit. We pass operational context
 * inline (stage + counterpart + attempt count) so the support dashboard
 * can act on it without further round-trips.
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
 * Create a generic ticket. Used by Phase 7's CreateTicketScreen; defined
 * here so callers don't fan out into a second source of truth.
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

const initialState = {
  tickets: [],
  disputes: [],
  isLoading: false,
  error: null,
};

const slice = createSlice({
  name: "support",
  initialState,
  reducers: {
    resetSupport: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTickets.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTickets.fulfilled, (state, action) => {
        state.isLoading = false;
        state.tickets = action.payload;
      })
      .addCase(fetchTickets.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(createTicketFromTrip.fulfilled, (state, action) => {
        if (action.payload) state.tickets = [action.payload, ...state.tickets];
      })
      .addCase(createTicket.fulfilled, (state, action) => {
        if (action.payload) state.tickets = [action.payload, ...state.tickets];
      });
  },
});

export const { resetSupport } = slice.actions;
export default slice.reducer;

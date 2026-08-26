/**
 * Request slice - unified request state management
 * Handles MERCHANT_ORDER (any merchant fulfillment) and PACKAGE (courier) requests.
 *
 * Phase 4 additions:
 *  - fetchActiveRoute  → GET /requests/:id/route (polyline + ETA)
 *  - cancellation-fee preview + customer cancel (server applies fee policy)
 *  - in-app messaging (fetch + post + socket-driven append)
 *  - matching status + live ETA from sockets
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import { newIdempotencyKey } from '../../services/idempotency';

// ============================================================
// Async Thunks
// ============================================================

// NB: services/api.js's response interceptor unwraps every call to the
//   envelope body { success, message, data, meta }
// so `envelope.data` is the payload (the request object, the request list,
// etc) and `envelope.meta` is the pagination meta. The previous version of
// this slice read `response.data.data` everywhere - that's
// `envelope.data.data`, which is `undefined` on the unwrapped value, so
// every thunk silently returned undefined. The reducers then fell through to
// `|| []` defaults and showed empty UIs.
//
// Error catch blocks: api.js wraps errors with `.message`, `.status`, `.data`
// (no `.response`). The old `error.response?.data?.message` always evaluated
// to undefined and we got the fallback string instead of the server's actual
// error message.

// Fetch user's requests
export const fetchRequests = createAsyncThunk(
  'request/fetchRequests',
  async ({ type, status, page = 1, limit = 20 }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      if (type) params.append('type', type);
      if (status) params.append('status', status);
      // Always list as a customer: this app shows orders the user BOUGHT. Without
      // this, a rider/merchant account (same login) would get its deliveries /
      // fulfilments back and see a customer-only "Rate" action it can't use.
      params.append('scope', 'customer');
      params.append('page', page);
      params.append('limit', limit);

      const envelope = await api.get(`/requests?${params.toString()}`);
      return { requests: envelope?.data || [], ...(envelope?.meta || {}) };
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to fetch requests');
    }
  }
);

// Fetch single request by ID
export const fetchRequestById = createAsyncThunk(
  'request/fetchRequestById',
  async (requestId, { rejectWithValue }) => {
    try {
      const envelope = await api.get(`/requests/${requestId}`);
      return envelope?.data;
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to fetch request');
    }
  }
);

// Create new request - requires quoteToken issued by /requests/quote.
// On failure we reject with the FULL normalised error so callers like
// PinBottomSheet can read .status and .code (e.g. PIN_NOT_SET). Reducer only
// renders the message.
export const createRequest = createAsyncThunk(
  'request/createRequest',
  async (requestData, { rejectWithValue }) => {
    try {
      const envelope = await api.post('/requests', requestData, {
        headers: { 'Idempotency-Key': newIdempotencyKey() },
      });
      return envelope?.data;
    } catch (error) {
      return rejectWithValue({
        message: error?.message || 'Failed to create request',
        status: error?.status ?? null,
        data: error?.data ?? null,
        code: error?.code ?? null,
      });
    }
  }
);

// Update request status
export const updateRequestStatus = createAsyncThunk(
  'request/updateRequestStatus',
  async ({ requestId, status, reason }, { rejectWithValue }) => {
    try {
      const envelope = await api.patch(`/requests/${requestId}/status`, { status, reason });
      return envelope?.data;
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to update request status');
    }
  }
);

// Cancellation preview - { allowed, fee, refundAmount, cancelToken }.
// Used to show the "Cancel with ₦X fee?" sheet on the tracking screen.
export const fetchCancellationQuote = createAsyncThunk(
  'request/fetchCancellationQuote',
  async (requestId, { rejectWithValue }) => {
    try {
      const envelope = await api.get(`/requests/${requestId}/cancel-quote`);
      return envelope?.data;
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to load cancellation policy');
    }
  }
);

// Cancel request (server applies fee). `cancelToken` (from a prior
// fetchCancellationQuote dispatch) locks in the fee shown to the customer in
// the modal, so admin setting changes mid-flight can't change the charge.
export const cancelRequest = createAsyncThunk(
  'request/cancelRequest',
  async ({ requestId, reason, cancelToken }, { rejectWithValue }) => {
    try {
      const body = cancelToken ? { reason, cancelToken } : { reason };
      const envelope = await api.delete(`/requests/${requestId}`, { data: body });
      return envelope?.data;
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to cancel request');
    }
  }
);

// Rate request
export const rateRequest = createAsyncThunk(
  'request/rateRequest',
  async ({ requestId, ratingData }, { rejectWithValue }) => {
    try {
      const envelope = await api.post(`/requests/${requestId}/rate`, ratingData);
      return envelope?.data;
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to rate request');
    }
  }
);

// Phase 4 - live route + ETA. Backend caches 30s.
export const fetchActiveRoute = createAsyncThunk(
  'request/fetchActiveRoute',
  async (requestId, { rejectWithValue }) => {
    try {
      const envelope = await api.get(`/requests/${requestId}/route`);
      return envelope?.data;
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to load route');
    }
  }
);

// Phase 4 - in-app messaging. A customer only ever has two private threads
// per request - CUSTOMER_RIDER and CUSTOMER_MERCHANT - never the
// rider<->merchant thread between the other two parties.
export const fetchMessages = createAsyncThunk(
  'request/fetchMessages',
  async ({ requestId, channel, before, limit = 30 }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      params.append('channel', channel);
      if (before) params.append('before', before);
      params.append('limit', String(limit));
      const envelope = await api.get(`/requests/${requestId}/messages?${params.toString()}`);
      return { channel, messages: envelope?.data || [] };
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to load messages');
    }
  }
);

export const postMessage = createAsyncThunk(
  'request/postMessage',
  async ({ requestId, channel, body }, { rejectWithValue }) => {
    try {
      const envelope = await api.post(`/requests/${requestId}/messages`, { channel, body });
      return { channel, message: envelope?.data };
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to send message');
    }
  }
);

// ============================================================
// Slice
// ============================================================

const initialState = {
  requests: [],
  currentRequest: null,
  isLoading: false,
  isCreating: false,
  isUpdating: false,
  isCancelling: false,
  isRating: false,
  error: null,
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  },
  // Phase 4
  route: null, // { polyline, etaSeconds, distanceMeters, riderLat, ... }
  matchingStatus: null, // { attempt, totalAttempts, radiusKm, candidates }
  riderEta: null, // { etaSeconds, nextCheckpoint, timestamp }
  // Private per-channel threads for the current request, chronological ASC.
  // A customer only ever has these two - never the rider<->merchant thread.
  messagesByChannel: { CUSTOMER_RIDER: [], CUSTOMER_MERCHANT: [] },
  // Unread-chat badges: seeded from the request payload's `unreadCounts`,
  // bumped when a message from the other party arrives while its thread is
  // NOT the one open on screen, and zeroed when that thread is opened (the
  // fetchMessages call marks everything read server-side).
  unreadCounts: { CUSTOMER_RIDER: 0, CUSTOMER_MERCHANT: 0 },
};

const requestSlice = createSlice({
  name: 'request',
  initialState,
  reducers: {
    // Update request from socket event. Server emitters don't always include
    // every field (e.g. emitCancelled omits status pre-fix; emitRiderLocation
    // never has status); the spread used to overwrite live fields with
    // undefined and corrupt currentRequest. Strip undefined keys before merging.
    updateRequestFromSocket: (state, action) => {
      const { requestId, ...rest } = action.payload || {};
      if (!requestId) return;

      const patch = {};
      for (const [k, v] of Object.entries(rest)) {
        if (v !== undefined) patch[k] = v;
      }

      // Update in list
      const index = state.requests.findIndex(r => r.id === requestId);
      if (index !== -1) {
        state.requests[index] = { ...state.requests[index], ...patch };
      }

      // Update current request if matches
      if (state.currentRequest?.id === requestId) {
        state.currentRequest = { ...state.currentRequest, ...patch };
      }
    },
    updateRiderLocationFromSocket: (state, action) => {
      const { requestId, lat, lng } = action.payload;
      if (state.currentRequest?.id === requestId) {
        state.currentRequest.riderLocation = { lat, lng };
      }
    },
    // Phase 4 - matching ring status
    setMatchingStatus: (state, action) => {
      const { requestId } = action.payload || {};
      if (state.currentRequest?.id === requestId) {
        state.matchingStatus = action.payload;
      }
    },
    clearMatchingStatus: (state) => {
      state.matchingStatus = null;
    },
    // Phase 4 - server-pushed ETA
    setRiderEta: (state, action) => {
      const { requestId } = action.payload || {};
      if (state.currentRequest?.id === requestId) {
        state.riderEta = action.payload;
      }
    },
    // Phase 4 - chat append (socket-driven; de-duped against optimistic id).
    // Unread bookkeeping: the screen passes `viewerUserId` (the customer's id
    // for this request) and `chatChannel` (the thread currently open, or
    // null). A message from the other party on a closed thread bumps that
    // channel's badge; messages in the open thread (or from us) never do.
    appendMessageFromSocket: (state, action) => {
      const { requestId, channel, message, viewerUserId, chatChannel } = action.payload || {};
      if (state.currentRequest?.id !== requestId || !channel || !message) return;
      const thread = state.messagesByChannel[channel] || (state.messagesByChannel[channel] = []);
      const exists = thread.find((m) => m.id === message.id);
      if (!exists) thread.push(message);
      if (message.fromUserId === viewerUserId) return;
      if (channel === chatChannel) return;
      if (state.unreadCounts[channel] !== undefined) {
        state.unreadCounts[channel] += 1;
      }
    },
    setRoute: (state, action) => {
      state.route = action.payload;
    },
    clearTrackingState: (state) => {
      state.route = null;
      state.matchingStatus = null;
      state.riderEta = null;
      state.messagesByChannel = { CUSTOMER_RIDER: [], CUSTOMER_MERCHANT: [] };
    },
    // Clear error
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch requests
    builder
      .addCase(fetchRequests.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchRequests.fulfilled, (state, action) => {
        state.isLoading = false;
        state.requests = action.payload.requests || [];
        state.pagination = {
          page: action.payload.page || 1,
          limit: action.payload.limit || 20,
          total: action.payload.total || 0,
          totalPages: Math.ceil((action.payload.total || 0) / (action.payload.limit || 20)),
        };
      })
      .addCase(fetchRequests.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    // Fetch request by ID
    builder
      .addCase(fetchRequestById.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchRequestById.fulfilled, (state, action) => {
        state.isLoading = false;
        const sameRequest = state.currentRequest?.id === action.payload?.id;
        state.currentRequest = action.payload;
        state.unreadCounts = action.payload?.unreadCounts
          ? { ...state.unreadCounts, ...action.payload.unreadCounts }
          : { CUSTOMER_RIDER: 0, CUSTOMER_MERCHANT: 0 };
        if (!sameRequest) {
          // New request opened - wipe per-request tracking caches.
          state.route = null;
          state.matchingStatus = null;
          state.riderEta = null;
          state.messagesByChannel = { CUSTOMER_RIDER: [], CUSTOMER_MERCHANT: [] };
        }
      })
      .addCase(fetchRequestById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    // Create request
    builder
      .addCase(createRequest.pending, (state) => {
        state.isCreating = true;
        state.error = null;
      })
      .addCase(createRequest.fulfilled, (state, action) => {
        state.isCreating = false;
        state.currentRequest = action.payload;
        state.requests.unshift(action.payload);
      })
      .addCase(createRequest.rejected, (state, action) => {
        state.isCreating = false;
        // payload is now {message, status, data}. Only surface the message.
        state.error = action.payload?.message || action.payload || 'Failed to create request';
      });

    // Update status
    builder
      .addCase(updateRequestStatus.pending, (state) => {
        state.isUpdating = true;
        state.error = null;
      })
      .addCase(updateRequestStatus.fulfilled, (state, action) => {
        state.isUpdating = false;
        const index = state.requests.findIndex(r => r.id === action.payload.id);
        if (index !== -1) {
          state.requests[index] = action.payload;
        }
        if (state.currentRequest?.id === action.payload.id) {
          state.currentRequest = action.payload;
        }
      })
      .addCase(updateRequestStatus.rejected, (state, action) => {
        state.isUpdating = false;
        state.error = action.payload;
      });

    // Cancel request
    builder
      .addCase(cancelRequest.pending, (state) => {
        state.isCancelling = true;
        state.error = null;
      })
      .addCase(cancelRequest.fulfilled, (state, action) => {
        state.isCancelling = false;
        // Server returns { requestId, status, cancellationFee } - patch the
        // current request and list entry rather than replacing wholesale.
        const id = action.payload?.requestId || action.payload?.id;
        if (id) {
          const index = state.requests.findIndex(r => r.id === id);
          if (index !== -1) {
            state.requests[index] = { ...state.requests[index], status: 'CANCELLED' };
          }
          if (state.currentRequest?.id === id) {
            state.currentRequest = {
              ...state.currentRequest,
              status: 'CANCELLED',
              cancellationFee: action.payload.cancellationFee,
            };
          }
        }
      })
      .addCase(cancelRequest.rejected, (state, action) => {
        state.isCancelling = false;
        state.error = action.payload;
      });

    // Rate request
    builder
      .addCase(rateRequest.pending, (state) => {
        state.isRating = true;
        state.error = null;
      })
      .addCase(rateRequest.fulfilled, (state, action) => {
        state.isRating = false;
        if (state.currentRequest?.id === action.payload.requestId) {
          state.currentRequest.rating = action.payload;
        }
      })
      .addCase(rateRequest.rejected, (state, action) => {
        state.isRating = false;
        state.error = action.payload;
      });

    // Phase 4 - route + ETA
    builder
      .addCase(fetchActiveRoute.fulfilled, (state, action) => {
        state.route = action.payload;
        if (action.payload?.etaSeconds != null) {
          state.riderEta = {
            requestId: action.payload.requestId,
            etaSeconds: action.payload.etaSeconds,
            nextCheckpoint: action.payload.nextCheckpoint,
            timestamp: action.payload.computedAt || Date.now(),
          };
        }
      });

    // Phase 4 - messages
    builder
      .addCase(fetchMessages.fulfilled, (state, action) => {
        const { channel, messages } = action.payload;
        state.messagesByChannel[channel] = messages || [];
        // Fetching a thread opens it server-side (listMessages marks all
        // unread messages read), so the badge for that thread is cleared.
        if (state.unreadCounts[channel] !== undefined) {
          state.unreadCounts[channel] = 0;
        }
      })
      .addCase(postMessage.fulfilled, (state, action) => {
        const { channel, message: msg } = action.payload;
        const thread = state.messagesByChannel[channel] || (state.messagesByChannel[channel] = []);
        if (msg && !thread.find((m) => m.id === msg.id)) {
          thread.push(msg);
        }
      });
  },
});

export const {
  updateRequestFromSocket,
  updateRiderLocationFromSocket,
  setMatchingStatus,
  clearMatchingStatus,
  setRiderEta,
  appendMessageFromSocket,
  setRoute,
  clearTrackingState,
  clearError,
} = requestSlice.actions;

export default requestSlice.reducer;

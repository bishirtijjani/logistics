import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as SecureStore from "../../lib/storage";
import api from "../../services/api";
import socketService from "../../services/socket";
import { newIdempotencyKey } from "../../services/idempotency";
import { setOnDelivery } from "./riderSlice";
import { STATUS } from "../../lib/constants";

const POD_DRAFT_KEY = (requestId) => `pod:draft:${requestId}`;

/**
 * Trip slice - active delivery state for the rider's cockpit (Phase 4).
 *
 * Lifecycle:
 *   - `activateFromAcceptedRequest(payload)` - called when `acceptOffer` returns
 *     200. Normalises the request, joins the request room, and flips the
 *     location stream to ON_DELIVERY cadence.
 *   - `patchStatus(nextStatus)` - drives the FSM forward via PATCH /requests/:id/status
 *     with a stable Idempotency-Key. Optimistic UI; on 409 STATUS_CONFLICT we
 *     reconcile from server state. On network failure the call is queued for
 *     retry on socket reconnect (each entry keeps its own Idempotency-Key).
 *   - `cancelTrip({ reason, note, pin })` - POST /requests/:id/rider-cancel.
 *   - `reportAddressCorrection({ stage, note, lat, lng })` - POST /requests/:id/address-correction.
 *   - `hydrateFromServer(requestId)` - GET /requests/:id. Used on app cold-start
 *     while a trip is active and on 409 STATUS_CONFLICT to re-sync.
 *
 * Socket reconciliation reducers:
 *   - `tripStatusReceivedFromSocket({requestId, status})` - drives the local
 *     status from server-pushed `request:status:changed` events.
 *   - `tripCancelledFromSocket({requestId, reason})` - handles admin / customer
 *     force-cancel mid-trip by surfacing a non-dismissible banner.
 *   - `tripMessageReceived(message)` - appends a chat message.
 *   - `tripAddressCorrectionReceived(payload)` - for completeness; the rider
 *     itself triggered it but other listeners (admin) may want this too.
 *
 * The reducer maintains:
 *   - `activeRequestId` - null when no trip is active
 *   - `status` - canonical request status from FSM
 *   - `pickup`/`dropoff` - denormalised location + contact info
 *   - `items` - request items (for MERCHANT_ORDER)
 *   - `arrivedAt: { pickup, dropoff }` - set by the geofence; UI uses these
 *     to flip the StatusActionButton between "On the way" and "Confirm".
 *   - `callAttempts: { [userId]: count }` - tracked locally for the
 *     "Customer not reachable" 3-strikes auto-ticket flow.
 *   - `statusQueue` - pending PATCH retries waiting for connectivity.
 *   - `messagesByChannel` - private CUSTOMER_RIDER / RIDER_MERCHANT threads for the active trip.
 *   - `cancelled` - banner state when an external cancel arrives.
 *   - `error` - last operation error (cleared on success).
 */

// ============================================================
// Helpers
// ============================================================

function normaliseRequest(r) {
  if (!r) return null;
  // The server returns the canonical Request envelope. We pull out pickup +
  // dropoff sub-objects so the cockpit can `useSelector(s => s.trip.pickup)`.
  // Handles both the unaccepted-offer payload (flat) and the full /requests/:id
  // response (with nested rider/merchant/customer/items).
  const merchantName = r.merchant?.name || r.merchantName || null;
  const merchantPhone = r.merchant?.phone || r.merchantPhone || null;
  const customerFirst = r.customer?.firstName || null;
  const customerLast = r.customer?.lastName || null;
  const customerName = [customerFirst, customerLast].filter(Boolean).join(" ").trim() || r.customerName || null;
  const customerPhone = r.customer?.phone || r.customerPhone || null;
  const packageSender = r.packageDetails?.senderName || null;
  const packageSenderPhone = r.packageDetails?.senderPhone || null;
  const packageRecipient = r.packageDetails?.recipientName || null;
  const packageRecipientPhone = r.packageDetails?.recipientPhone || null;

  return {
    id: r.id || r.requestId || null,
    status: r.status || null,
    type: r.type || null,
    pickup: {
      lat: r.pickupLat ?? r.pickup?.lat ?? null,
      lng: r.pickupLng ?? r.pickup?.lng ?? null,
      address: r.pickupAddress ?? r.pickup?.address ?? null,
      name: r.pickupName ?? r.pickup?.name ?? merchantName ?? packageSender ?? null,
      contactName: r.pickup?.contactName ?? merchantName ?? packageSender ?? null,
      contactPhone: r.pickup?.contactPhone ?? merchantPhone ?? packageSenderPhone ?? null,
      notes: r.pickup?.notes ?? r.pickupNotes ?? r.packageDetails?.instructions ?? null,
    },
    dropoff: {
      lat: r.dropoffLat ?? r.dropoff?.lat ?? null,
      lng: r.dropoffLng ?? r.dropoff?.lng ?? null,
      address: r.dropoffAddress ?? r.dropoff?.address ?? null,
      name: r.dropoffName ?? r.dropoff?.name ?? customerName ?? packageRecipient ?? null,
      contactName: r.dropoff?.contactName ?? customerName ?? packageRecipient ?? null,
      contactPhone: r.dropoff?.contactPhone ?? customerPhone ?? packageRecipientPhone ?? null,
      notes: r.dropoff?.notes ?? r.dropoffNotes ?? r.specialInstructions ?? null,
    },
    items: Array.isArray(r.items) ? r.items : [],
    packageDetails: r.packageDetails || null,
    distanceKm: r.distanceKm ?? null,
    estimatedMinutes: r.estimatedMinutes ?? null,
    riderEarning: r.riderEarning != null ? Number(r.riderEarning) : null,
    fare: r.fare != null ? Number(r.fare) : (r.total != null ? Number(r.total) : null),
    // Cash-on-delivery: the rider collects `collectAmount` in cash on handover.
    paymentMethod: r.paymentMethod || "WALLET",
    collectAmount: r.paymentMethod === "CASH" ? Number(r.total ?? r.fare ?? 0) : 0,
    customerId: r.customerId || r.customer?.id || null,
    merchantUserId: r.merchant?.userId || null,
    cancellationReason: r.cancellationReason || null,
    cancelledBy: r.cancelledBy || null,
  };
}

// ============================================================
// Thunks
// ============================================================

export const activateFromAcceptedRequest = createAsyncThunk(
  "trip/activate",
  async (rawRequest, { dispatch }) => {
    const normalised = normaliseRequest(rawRequest);
    if (!normalised?.id) {
      throw new Error("activateFromAcceptedRequest called without a request id");
    }
    try { socketService.joinRequestRoom(normalised.id); } catch (_) {}
    dispatch(setOnDelivery(true)).catch?.(() => {});
    return normalised;
  },
);

/**
 * Fetch the canonical request from the server. Used on:
 *   - Cold start when the app re-opens and we discover a persisted activeRequestId.
 *   - 409 STATUS_CONFLICT to reconcile with whatever the server believes.
 *   - Pull-to-refresh on the cockpit.
 */
export const hydrateFromServer = createAsyncThunk(
  "trip/hydrate",
  async (requestId, { dispatch, rejectWithValue }) => {
    if (!requestId) return rejectWithValue({ code: "MISSING_REQUEST_ID" });
    try {
      const envelope = await api.get(`/requests/${requestId}`);
      const payload = envelope?.data || envelope || null;
      const normalised = normaliseRequest(payload);
      if (!normalised?.id) {
        return rejectWithValue({ code: "REQUEST_NOT_FOUND" });
      }
      try { socketService.joinRequestRoom(normalised.id); } catch (_) {}
      // If the trip is already in a terminal state, switch back to idle cadence.
      const terminal = normalised.status === STATUS.DELIVERED
        || normalised.status === STATUS.SETTLED
        || normalised.status === STATUS.CANCELLED;
      if (!terminal) {
        dispatch(setOnDelivery(true)).catch?.(() => {});
      }
      return normalised;
    } catch (err) {
      return rejectWithValue({
        code: err?.code || "HYDRATE_FAILED",
        status: err?.status,
        message: err?.message || "Failed to load trip",
      });
    }
  },
);

/**
 * Drive the FSM forward. Optimistic - the reducer flips state immediately
 * (when not already past `nextStatus`) and the server response confirms.
 *
 * Errors handled here:
 *   - Network failure → push onto statusQueue with the same Idempotency-Key
 *     so the next reconnect drain can retry safely.
 *   - 409 STATUS_CONFLICT → dispatch hydrateFromServer to reconcile.
 *   - 422 (POD_REQUIRED, INVALID_TRANSITION, etc.) → bubble the code so the
 *     UI can mount the right sheet.
 */
export const patchStatus = createAsyncThunk(
  "trip/patchStatus",
  async ({ requestId, nextStatus, extras, idempotencyKey: existingKey }, { dispatch, rejectWithValue }) => {
    if (!requestId || !nextStatus) {
      return rejectWithValue({ code: "BAD_INPUT" });
    }
    const idempotencyKey = existingKey || newIdempotencyKey();
    try {
      const envelope = await api.patch(
        `/requests/${requestId}/status`,
        { status: nextStatus, ...(extras || {}) },
        { headers: { "Idempotency-Key": idempotencyKey } },
      );
      return {
        requestId,
        nextStatus,
        payload: envelope?.data || envelope || {},
      };
    } catch (err) {
      const code = err?.code || err?.data?.code;
      const status = err?.status;
      const isNetwork = !status && err?.code === "NETWORK_ERROR";
      // Reconcile from server when the server's truth diverges from ours:
      //   - 409 STATUS_CONFLICT (someone else moved the request)
      //   - 422 Invalid transition (we tried to advance past where the FSM is)
      //   - 403 Not your assigned order (reassigned to another rider)
      // In all three cases the canonical Request payload tells us what to render.
      const shouldReconcile = status === 409
        || code === "STATUS_CONFLICT"
        || (status === 422 && /transition|already past|conflict/i.test(err?.message || ""))
        || status === 403;
      if (shouldReconcile) {
        dispatch(hydrateFromServer(requestId)).catch?.(() => {});
      }
      return rejectWithValue({
        code: code || (isNetwork ? "NETWORK_ERROR" : "STATUS_PATCH_FAILED"),
        status,
        message: err?.message || "Couldn't update trip status",
        requestId,
        nextStatus,
        idempotencyKey,
        retriable: Boolean(isNetwork),
      });
    }
  },
);

/**
 * Rider-initiated cancellation. PIN-protected, idempotent. The server returns
 * the cancellation status; the reducer clears the active trip + flips the
 * location cadence back to idle.
 */
export const cancelTrip = createAsyncThunk(
  "trip/cancel",
  async ({ requestId, reason, note, pin, idempotencyKey: existingKey }, { dispatch, rejectWithValue }) => {
    if (!requestId || !reason || !pin) return rejectWithValue({ code: "BAD_INPUT" });
    const idempotencyKey = existingKey || newIdempotencyKey();
    try {
      const envelope = await api.post(
        `/requests/${requestId}/rider-cancel`,
        { reason, note, pin },
        { headers: { "Idempotency-Key": idempotencyKey } },
      );
      // Flip cadence back to idle and leave the request room.
      dispatch(setOnDelivery(false)).catch?.(() => {});
      try { socketService.leaveRequestRoom(requestId); } catch (_) {}
      return {
        requestId,
        payload: envelope?.data || envelope || {},
      };
    } catch (err) {
      return rejectWithValue({
        code: err?.code || err?.data?.code || "RIDER_CANCEL_FAILED",
        status: err?.status,
        message: err?.message || "Couldn't cancel the trip",
        requestId,
        idempotencyKey,
      });
    }
  },
);

/**
 * Submit a wrong-address correction note for either the pickup or dropoff
 * stage. Doesn't change the trip flow.
 */
export const reportAddressCorrection = createAsyncThunk(
  "trip/addressCorrection",
  async ({ requestId, stage, note, lat, lng, idempotencyKey: existingKey }, { rejectWithValue }) => {
    if (!requestId || !stage || !note) return rejectWithValue({ code: "BAD_INPUT" });
    const idempotencyKey = existingKey || newIdempotencyKey();
    try {
      const envelope = await api.post(
        `/requests/${requestId}/address-correction`,
        { stage, note, ...(typeof lat === "number" ? { lat } : {}), ...(typeof lng === "number" ? { lng } : {}) },
        { headers: { "Idempotency-Key": idempotencyKey } },
      );
      return { requestId, payload: envelope?.data || envelope || {} };
    } catch (err) {
      return rejectWithValue({
        code: err?.code || err?.data?.code || "ADDRESS_CORRECTION_FAILED",
        status: err?.status,
        message: err?.message || "Couldn't send the correction",
        requestId,
        idempotencyKey,
      });
    }
  },
);

/**
 * Fetch + replace one channel's chat thread for the active trip. A rider
 * only ever has two channels on a request - CUSTOMER_RIDER and
 * RIDER_MERCHANT - each a private thread, never a shared one.
 */
export const fetchMessages = createAsyncThunk(
  "trip/fetchMessages",
  async ({ requestId, channel }, { rejectWithValue }) => {
    if (!requestId || !channel) return rejectWithValue({ code: "MISSING_REQUEST_ID" });
    try {
      const envelope = await api.get(`/requests/${requestId}/messages?channel=${channel}&limit=50`);
      const payload = envelope?.data || envelope || [];
      return { requestId, channel, messages: Array.isArray(payload) ? payload : [] };
    } catch (err) {
      return rejectWithValue({
        code: err?.code || "MESSAGES_FETCH_FAILED",
        message: err?.message || "Couldn't load chat",
      });
    }
  },
);

/**
 * Send a chat message on one channel. Idempotent. The server delivers
 * `request:message:new` straight to this rider's personal socket room (not
 * a shared per-request room) - our notifications bus dispatches
 * `tripMessageReceived` to keep the thread in sync without us appending
 * here. We still append optimistically so the user sees their message
 * instantly; if the socket later reports the same message we de-dupe by id
 * in the reducer.
 */
export const sendMessage = createAsyncThunk(
  "trip/sendMessage",
  async ({ requestId, channel, body, idempotencyKey: existingKey }, { rejectWithValue }) => {
    if (!requestId || !channel || !body?.trim()) return rejectWithValue({ code: "BAD_INPUT" });
    const idempotencyKey = existingKey || newIdempotencyKey();
    try {
      const envelope = await api.post(
        `/requests/${requestId}/messages`,
        { channel, body: body.trim() },
        { headers: { "Idempotency-Key": idempotencyKey } },
      );
      return { requestId, channel, message: envelope?.data || envelope || null, idempotencyKey };
    } catch (err) {
      return rejectWithValue({
        code: err?.code || "MESSAGE_SEND_FAILED",
        message: err?.message || "Couldn't send message",
        requestId,
        channel,
        idempotencyKey,
      });
    }
  },
);

/**
 * Drain the statusQueue. Called when the socket reconnects (i.e. we likely
 * have connectivity again). Each entry retries `patchStatus` with its own
 * stored Idempotency-Key.
 */
export const drainStatusQueue = createAsyncThunk(
  "trip/drainStatusQueue",
  async (_, { getState, dispatch }) => {
    const queue = getState().trip.statusQueue || [];
    if (queue.length === 0) return { drained: 0 };
    let drained = 0;
    for (const entry of queue) {
      // Skip queued entries that have already been superseded by a later
      // successful patch (status already past target).
      if (!entry || !entry.nextStatus) continue;
      // eslint-disable-next-line no-await-in-loop
      const action = await dispatch(patchStatus({
        requestId: entry.requestId,
        nextStatus: entry.nextStatus,
        extras: entry.extras,
        idempotencyKey: entry.idempotencyKey,
      }));
      if (action.meta.requestStatus === "fulfilled") drained++;
    }
    return { drained };
  },
);

// ============================================================
// Phase 5 - Proof of Delivery thunks.
// ============================================================

/**
 * Persist the current POD draft to SecureStore so a force-close mid-upload
 * doesn't lose the captured photo/signature/OTP. Reads `state.trip.pod` and
 * stores it under `pod:draft:{requestId}`. Cleared on DELIVERED 200.
 */
async function persistPodDraft(requestId, draft) {
  if (!requestId) return;
  try {
    await SecureStore.setItemAsync(POD_DRAFT_KEY(requestId), JSON.stringify(draft || {}));
  } catch (_) {}
}

async function clearPodDraft(requestId) {
  if (!requestId) return;
  try { await SecureStore.deleteItemAsync(POD_DRAFT_KEY(requestId)); } catch (_) {}
}

/**
 * Hydrate the POD draft on cockpit mount (cold start with an active trip).
 * The TripCockpitScreen dispatches this after `hydrateFromServer` so the
 * camera/signature/OTP state is restored exactly where the rider left off.
 */
export const hydratePodDraft = createAsyncThunk(
  "trip/hydratePodDraft",
  async (requestId, { rejectWithValue }) => {
    if (!requestId) return rejectWithValue({ code: "MISSING_REQUEST_ID" });
    try {
      const raw = await SecureStore.getItemAsync(POD_DRAFT_KEY(requestId));
      if (!raw) return { requestId, pod: null };
      return { requestId, pod: JSON.parse(raw) };
    } catch (_) {
      return { requestId, pod: null };
    }
  },
);

/**
 * Generate the customer OTP. Rate-limited server-side to 3 codes per 10 min.
 */
export const generatePodOtp = createAsyncThunk(
  "trip/generatePodOtp",
  async ({ requestId, idempotencyKey: existingKey }, { rejectWithValue }) => {
    if (!requestId) return rejectWithValue({ code: "MISSING_REQUEST_ID" });
    const idempotencyKey = existingKey || newIdempotencyKey();
    try {
      await api.post(
        `/requests/${requestId}/pod-otp/generate`,
        {},
        { headers: { "Idempotency-Key": idempotencyKey } },
      );
      return { requestId, idempotencyKey };
    } catch (err) {
      return rejectWithValue({
        code: err?.code || "POD_OTP_GENERATE_FAILED",
        status: err?.status,
        message: err?.message || "Couldn't send the code",
        retryAfterSeconds: err?.retryAfterSeconds || null,
      });
    }
  },
);

/**
 * Complete the delivery - PATCH DELIVERED with the assembled POD payload.
 * Idempotent. On 422 with `POD_*` codes, surfaces the code so the cockpit
 * can re-mount the right sheet. On 200, clears the POD draft from SecureStore.
 */
export const completeDelivery = createAsyncThunk(
  "trip/completeDelivery",
  async ({ requestId, podPhotoUrl, podSignatureUrl, podDeliveryOtp, idempotencyKey: existingKey }, { rejectWithValue }) => {
    if (!requestId) return rejectWithValue({ code: "MISSING_REQUEST_ID" });
    const idempotencyKey = existingKey || newIdempotencyKey();
    try {
      const body = { status: STATUS.DELIVERED };
      if (podPhotoUrl) body.podPhotoUrl = podPhotoUrl;
      if (podSignatureUrl) body.podSignatureUrl = podSignatureUrl;
      if (podDeliveryOtp) body.podDeliveryOtp = podDeliveryOtp;
      const envelope = await api.patch(
        `/requests/${requestId}/status`,
        body,
        { headers: { "Idempotency-Key": idempotencyKey } },
      );
      await clearPodDraft(requestId);
      return { requestId, payload: envelope?.data || envelope || {}, idempotencyKey };
    } catch (err) {
      return rejectWithValue({
        code: err?.code || err?.data?.code || "DELIVERY_FAILED",
        status: err?.status,
        message: err?.message || "Couldn't complete the delivery",
        requestId,
        idempotencyKey,
      });
    }
  },
);

// ============================================================
// Reducer
// ============================================================

const initialState = {
  activeRequestId: null,
  status: null,
  type: null,
  pickup: null,
  dropoff: null,
  items: [],
  packageDetails: null,
  distanceKm: null,
  estimatedMinutes: null,
  riderEarning: null,
  fare: null,
  paymentMethod: "WALLET",
  collectAmount: 0,
  customerId: null,
  merchantUserId: null,
  arrivedAt: { pickup: null, dropoff: null },
  callAttempts: {},
  statusQueue: [],
  // Private per-channel threads - a rider only ever has CUSTOMER_RIDER and
  // RIDER_MERCHANT, never the customer<->merchant thread between the other two.
  messagesByChannel: { CUSTOMER_RIDER: [], RIDER_MERCHANT: [] },
  messagesLoading: false,
  // Unread-chat badges: seeded from the request payload's `unreadCounts`,
  // bumped when a message from the other party arrives while its thread is
  // NOT the one open on screen, and zeroed when that thread is opened (the
  // fetchMessages call marks everything read server-side).
  unreadCounts: { CUSTOMER_RIDER: 0, RIDER_MERCHANT: 0 },
  // The channel currently open in the chat sheet (null when closed). Messages
  // on the open channel append live without counting as unread.
  openChatChannel: null,
  // The rider's own user id, for "is this message from me?" checks in
  // tripMessageReceived (seeded on hydrate from the request payload).
  riderUserId: null,
  // Phase 5 - POD draft, persisted to SecureStore on every mutation.
  // Shape: {
  //   photoLocalUri: string | null,   - local file:// while pre-upload
  //   photoUrl:      string | null,   - Cloudinary URL once upload succeeds
  //   photoUploading: boolean,
  //   photoError:    string | null,
  //   signatureLocalUri: string | null,
  //   signatureUrl:  string | null,
  //   signatureUploading: boolean,
  //   signatureError: string | null,
  //   otpRequested:  boolean,         - rider has tapped "Send code"
  //   otpRequestedAt: number | null,  - epoch ms of last successful request
  //   otpAttempts:   number,          - resend counter, soft-displayed for UX
  //   draftedAt:     number,          - last mutation timestamp
  // } | null
  pod: null,
  podSubmitting: false,
  // External cancellation banner (admin / customer force-cancel).
  cancelled: null,           // { reason, cancelledBy, at } | null
  // Last operation error - cleared on next op.
  error: null,
  // Live in-flight states surfaced to the UI.
  patching: false,
  cancelling: false,
};

function emptyPod() {
  return {
    photoLocalUri: null,
    photoUrl: null,
    photoUploading: false,
    photoError: null,
    signatureLocalUri: null,
    signatureUrl: null,
    signatureUploading: false,
    signatureError: null,
    otpRequested: false,
    otpRequestedAt: null,
    otpAttempts: 0,
    draftedAt: Date.now(),
  };
}

const slice = createSlice({
  name: "trip",
  initialState,
  reducers: {
    tripArrived: (state, action) => {
      const where = action.payload; // 'pickup' | 'dropoff'
      if (where === "pickup" || where === "dropoff") {
        if (!state.arrivedAt[where]) state.arrivedAt[where] = Date.now();
      }
    },
    tripCallAttempted: (state, action) => {
      const id = action.payload;
      if (!id) return;
      state.callAttempts[id] = (state.callAttempts[id] || 0) + 1;
    },
    /** Server-pushed status change for the active trip. */
    tripStatusReceivedFromSocket: (state, action) => {
      const { requestId, status } = action.payload || {};
      if (!state.activeRequestId || state.activeRequestId !== requestId) return;
      if (!status) return;
      state.status = status;
      state.error = null;
      // If the server says we're already at/past the queued status, drop those
      // entries - they've been resolved server-side.
      state.statusQueue = state.statusQueue.filter((e) => e.nextStatus !== status);
    },
    /** Server-pushed cancellation (admin force-cancel, customer cancel pre-pickup). */
    tripCancelledFromSocket: (state, action) => {
      const { requestId, reason, cancelledBy } = action.payload || {};
      if (!state.activeRequestId || state.activeRequestId !== requestId) return;
      // Skip if WE triggered the cancel - our own thunk already cleared state.
      if (state.status === STATUS.CANCELLED) return;
      state.cancelled = {
        reason: reason || "Trip cancelled",
        cancelledBy: cancelledBy || "system",
        at: Date.now(),
      };
      state.status = STATUS.CANCELLED;
    },
    /** Banner acknowledged - clears the trip so the rider returns to Home. */
    acknowledgeCancellation: (state) => {
      const previous = state.activeRequestId;
      if (previous) {
        try { socketService.leaveRequestRoom(previous); } catch (_) {}
      }
      return initialState;
    },
    /** Server emitted `request:message:new` for our active trip. */
    tripMessageReceived: (state, action) => {
      const payload = action.payload || {};
      const { requestId, channel } = payload;
      const message = payload.message || payload;
      if (!state.activeRequestId || state.activeRequestId !== requestId) return;
      if (!channel || !message?.id) return;
      const thread = state.messagesByChannel[channel] || (state.messagesByChannel[channel] = []);
      // De-dupe by id (we may have optimistically appended already).
      const existingIdx = thread.findIndex((m) => m.id === message.id);
      if (existingIdx === -1) thread.push(message);
      else thread[existingIdx] = message;
      // Unread bookkeeping: only messages from the other party on a thread
      // that isn't currently open on screen bump the badge.
      if (message.fromUserId === state.riderUserId) return;
      if (state.openChatChannel === channel) return;
      if (state.unreadCounts[channel] !== undefined) {
        state.unreadCounts[channel] += 1;
      }
    },
    /** Record which chat thread is open (or null when closed). */
    setTripChatOpen: (state, action) => {
      const channel = action.payload || null;
      state.openChatChannel = channel;
      if (channel && state.unreadCounts[channel] !== undefined) {
        state.unreadCounts[channel] = 0;
      }
    },
    /** Convenience: clear the last error (e.g. on retry tap). */
    clearTripError: (state) => { state.error = null; },
    /** Clear chat after closing the sheet. */
    clearTripMessages: (state) => {
      state.messagesByChannel = { CUSTOMER_RIDER: [], RIDER_MERCHANT: [] };
      state.unreadCounts = { CUSTOMER_RIDER: 0, RIDER_MERCHANT: 0 };
      state.openChatChannel = null;
    },
    /** Wipe the trip - used after DELIVERED → cockpit hands off to POD/Earnings. */
    tripCleared: (state) => {
      if (state.activeRequestId) {
        try { socketService.leaveRequestRoom(state.activeRequestId); } catch (_) {}
      }
      return initialState;
    },

    // ── Phase 5 - POD draft mutations. Each mutation also touches
    // `draftedAt` so the persistence side-effect below can snapshot
    // SecureStore on every change.
    podPhotoCaptured: (state, action) => {
      if (!state.pod) state.pod = emptyPod();
      state.pod.photoLocalUri = action.payload?.localUri || null;
      state.pod.photoUrl = null;
      state.pod.photoError = null;
      state.pod.draftedAt = Date.now();
      persistPodDraft(state.activeRequestId, state.pod);
    },
    podPhotoUploading: (state) => {
      if (!state.pod) state.pod = emptyPod();
      state.pod.photoUploading = true;
      state.pod.photoError = null;
    },
    podPhotoUploaded: (state, action) => {
      if (!state.pod) state.pod = emptyPod();
      state.pod.photoUrl = action.payload?.secureUrl || null;
      state.pod.photoUploading = false;
      state.pod.photoError = null;
      state.pod.draftedAt = Date.now();
      persistPodDraft(state.activeRequestId, state.pod);
    },
    podPhotoUploadFailed: (state, action) => {
      if (!state.pod) state.pod = emptyPod();
      state.pod.photoUploading = false;
      state.pod.photoError = action.payload?.message || "Upload failed";
    },
    podSignatureCaptured: (state, action) => {
      if (!state.pod) state.pod = emptyPod();
      state.pod.signatureLocalUri = action.payload?.localUri || null;
      state.pod.signatureUrl = null;
      state.pod.signatureError = null;
      state.pod.draftedAt = Date.now();
      persistPodDraft(state.activeRequestId, state.pod);
    },
    podSignatureUploading: (state) => {
      if (!state.pod) state.pod = emptyPod();
      state.pod.signatureUploading = true;
      state.pod.signatureError = null;
    },
    podSignatureUploaded: (state, action) => {
      if (!state.pod) state.pod = emptyPod();
      state.pod.signatureUrl = action.payload?.secureUrl || null;
      state.pod.signatureUploading = false;
      state.pod.signatureError = null;
      state.pod.draftedAt = Date.now();
      persistPodDraft(state.activeRequestId, state.pod);
    },
    podSignatureUploadFailed: (state, action) => {
      if (!state.pod) state.pod = emptyPod();
      state.pod.signatureUploading = false;
      state.pod.signatureError = action.payload?.message || "Upload failed";
    },
    podDraftCleared: (state) => {
      const rid = state.activeRequestId;
      state.pod = null;
      if (rid) clearPodDraft(rid);
    },
  },
  extraReducers: (builder) => {
    builder
      // ── activate ─────────────────────────────────────────────────────────
      .addCase(activateFromAcceptedRequest.fulfilled, (state, action) => {
        const r = action.payload;
        Object.assign(state, {
          activeRequestId: r.id,
          status: r.status,
          type: r.type,
          pickup: r.pickup,
          dropoff: r.dropoff,
          items: r.items,
          packageDetails: r.packageDetails,
          distanceKm: r.distanceKm,
          estimatedMinutes: r.estimatedMinutes,
          riderEarning: r.riderEarning,
          fare: r.fare,
          paymentMethod: r.paymentMethod,
          collectAmount: r.collectAmount,
          customerId: r.customerId,
          merchantUserId: r.merchantUserId,
          arrivedAt: { pickup: null, dropoff: null },
          callAttempts: {},
          statusQueue: [],
          messagesByChannel: { CUSTOMER_RIDER: [], RIDER_MERCHANT: [] },
          messagesLoading: false,
          unreadCounts: { CUSTOMER_RIDER: 0, RIDER_MERCHANT: 0 },
          openChatChannel: null,
          pod: null,
          cancelled: null,
          error: null,
          patching: false,
          cancelling: false,
        });
      })
      .addCase(activateFromAcceptedRequest.rejected, (state, action) => {
        state.error = { phase: "activate", message: action.error?.message || "Failed to activate trip" };
      })

      // ── hydrate ──────────────────────────────────────────────────────────
      .addCase(hydrateFromServer.fulfilled, (state, action) => {
        const r = action.payload;
        // If the persisted trip is cancelled, preserve a `cancelled` banner
        // so the rider sees what happened before the cockpit dismisses. The
        // TripCancelledOverlay reads this and is the only way to wipe state.
        if (r.status === STATUS.CANCELLED) {
          // If we already had a socket-pushed cancelled banner, leave it.
          if (!state.cancelled) {
            state.cancelled = {
              reason: r.cancellationReason || "Trip cancelled",
              cancelledBy: r.cancelledBy || "system",
              at: Date.now(),
            };
          }
          state.activeRequestId = r.id;
          state.status = STATUS.CANCELLED;
          state.error = null;
          return;
        }
        // Trip already settled/delivered - wipe.
        const isTerminal = r.status === STATUS.DELIVERED
          || r.status === STATUS.SETTLED;
        if (isTerminal) {
          if (state.activeRequestId) {
            try { socketService.leaveRequestRoom(state.activeRequestId); } catch (_) {}
          }
          // Don't return initialState in extraReducers - Object.assign instead.
          Object.assign(state, initialState);
          return;
        }
        Object.assign(state, {
          activeRequestId: r.id,
          status: r.status,
          type: r.type,
          pickup: r.pickup,
          dropoff: r.dropoff,
          items: r.items,
          packageDetails: r.packageDetails,
          distanceKm: r.distanceKm,
          estimatedMinutes: r.estimatedMinutes,
          riderEarning: r.riderEarning,
          fare: r.fare,
          paymentMethod: r.paymentMethod,
          collectAmount: r.collectAmount,
          customerId: r.customerId,
          merchantUserId: r.merchantUserId,
          riderUserId: r.rider?.user?.id || r.riderId || null,
          // Authoritative unread counts from the server (persisted readAt).
          unreadCounts: {
            CUSTOMER_RIDER: Number(r.unreadCounts?.CUSTOMER_RIDER) || 0,
            RIDER_MERCHANT: Number(r.unreadCounts?.RIDER_MERCHANT) || 0,
          },
          error: null,
        });
      })
      .addCase(hydrateFromServer.rejected, (state, action) => {
        state.error = { phase: "hydrate", ...(action.payload || {}) };
      })

      // ── patchStatus ──────────────────────────────────────────────────────
      .addCase(patchStatus.pending, (state) => {
        state.patching = true;
        state.error = null;
      })
      .addCase(patchStatus.fulfilled, (state, action) => {
        state.patching = false;
        const { nextStatus, requestId } = action.payload;
        if (state.activeRequestId === requestId) {
          state.status = nextStatus;
          // Drop any queued entries that the server has now resolved.
          state.statusQueue = state.statusQueue.filter((e) => e.nextStatus !== nextStatus);
        }
        state.error = null;
      })
      .addCase(patchStatus.rejected, (state, action) => {
        state.patching = false;
        const payload = action.payload || {};
        if (payload.retriable && payload.requestId === state.activeRequestId) {
          // Queue for retry on reconnect. Avoid duplicate entries with the
          // same next status - keep only the latest idempotencyKey.
          const dedup = state.statusQueue.filter((e) => e.nextStatus !== payload.nextStatus);
          dedup.push({
            requestId: payload.requestId,
            nextStatus: payload.nextStatus,
            idempotencyKey: payload.idempotencyKey,
            extras: payload.extras || null,
            queuedAt: Date.now(),
          });
          state.statusQueue = dedup;
        }
        state.error = { phase: "patchStatus", ...payload };
      })

      // ── cancel ───────────────────────────────────────────────────────────
      .addCase(cancelTrip.pending, (state) => {
        state.cancelling = true;
        state.error = null;
      })
      .addCase(cancelTrip.fulfilled, (state) => {
        Object.assign(state, initialState);
      })
      .addCase(cancelTrip.rejected, (state, action) => {
        state.cancelling = false;
        state.error = { phase: "cancel", ...(action.payload || {}) };
      })

      // ── address correction ───────────────────────────────────────────────
      .addCase(reportAddressCorrection.rejected, (state, action) => {
        state.error = { phase: "addressCorrection", ...(action.payload || {}) };
      })

      // ── messages ─────────────────────────────────────────────────────────
      .addCase(fetchMessages.pending, (state) => {
        state.messagesLoading = true;
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        state.messagesLoading = false;
        const { requestId, channel, messages } = action.payload;
        if (state.activeRequestId !== requestId) return;
        state.messagesByChannel[channel] = messages;
        // Fetching a thread opens it server-side (listMessages marks all
        // unread messages read), so the badge for that thread is cleared.
        if (state.unreadCounts[channel] !== undefined) {
          state.unreadCounts[channel] = 0;
        }
      })
      .addCase(fetchMessages.rejected, (state) => {
        state.messagesLoading = false;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        const { requestId, channel, message } = action.payload;
        if (state.activeRequestId !== requestId || !message?.id) return;
        const thread = state.messagesByChannel[channel] || (state.messagesByChannel[channel] = []);
        const existingIdx = thread.findIndex((m) => m.id === message.id);
        if (existingIdx === -1) thread.push(message);
        else thread[existingIdx] = message;
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.error = { phase: "sendMessage", ...(action.payload || {}) };
      })

      // ── Phase 5: POD hydrate / OTP / complete-delivery ─────────────────
      .addCase(hydratePodDraft.fulfilled, (state, action) => {
        const { requestId, pod } = action.payload || {};
        if (state.activeRequestId !== requestId) return;
        // Don't clobber an in-progress pod with a stale draft snapshot.
        if (state.pod && state.pod.draftedAt && pod && pod.draftedAt && pod.draftedAt <= state.pod.draftedAt) {
          return;
        }
        state.pod = pod || null;
      })
      .addCase(generatePodOtp.fulfilled, (state) => {
        if (!state.pod) state.pod = emptyPod();
        state.pod.otpRequested = true;
        state.pod.otpRequestedAt = Date.now();
        state.pod.otpAttempts = (state.pod.otpAttempts || 0) + 1;
        state.pod.draftedAt = Date.now();
        persistPodDraft(state.activeRequestId, state.pod);
      })
      .addCase(generatePodOtp.rejected, (state, action) => {
        state.error = { phase: "podOtpGenerate", ...(action.payload || {}) };
      })
      .addCase(completeDelivery.pending, (state) => {
        state.podSubmitting = true;
        state.error = null;
      })
      .addCase(completeDelivery.fulfilled, (state, action) => {
        state.podSubmitting = false;
        const requestId = action.payload?.requestId;
        if (state.activeRequestId === requestId) {
          state.status = STATUS.DELIVERED;
          state.pod = null;
        }
      })
      .addCase(completeDelivery.rejected, (state, action) => {
        state.podSubmitting = false;
        state.error = { phase: "completeDelivery", ...(action.payload || {}) };
      });
  },
});

export const {
  tripArrived,
  tripCallAttempted,
  tripStatusReceivedFromSocket,
  tripCancelledFromSocket,
  acknowledgeCancellation,
  tripMessageReceived,
  setTripChatOpen,
  clearTripError,
  clearTripMessages,
  tripCleared,
  podPhotoCaptured,
  podPhotoUploading,
  podPhotoUploaded,
  podPhotoUploadFailed,
  podSignatureCaptured,
  podSignatureUploading,
  podSignatureUploaded,
  podSignatureUploadFailed,
  podDraftCleared,
} = slice.actions;
export default slice.reducer;

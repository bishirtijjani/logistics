import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import socketService from '../../services/socket';
import locationStream from '../../services/locationStream';
import { AVAILABILITY } from '../../lib/constants';

/**
 * Rider slice - availability, presence, location streaming, performance.
 *
 * Public thunks:
 *   - fetchRiderProfile()        → GET /rider/profile
 *   - goOnline()                 → permission + PATCH ONLINE + start GPS stream
 *   - goOffline({ reason? })     → stop stream + PATCH OFFLINE
 *   - setOnDelivery(bool)        → switch stream cadence; doesn't touch availability
 *   - reconcileFromServer()      → re-emit current availability + refetch profile
 */

export const fetchRiderProfile = createAsyncThunk(
  'rider/fetchProfile',
  async (_, { rejectWithValue }) => {
    try {
      const envelope = await api.get('/rider/profile');
      return envelope?.data || envelope || {};
    } catch (err) {
      return rejectWithValue(err?.message || 'Failed to load rider profile');
    }
  },
);

/**
 * Internal raw API call. The user-facing `goOnline`/`goOffline` thunks below
 * wrap this with permission requests + location stream lifecycle.
 */
const patchAvailability = async (availability, coords) => {
  const body = { availability };
  if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
    body.lat = coords.lat;
    body.lng = coords.lng;
  }
  const envelope = await api.patch('/rider/availability', body);
  return envelope?.data || { availability };
};

/**
 * Go ONLINE. Failure modes are explicit so callers can route the rider to the
 * right recovery flow.
 *
 * Steps:
 *   1. Grab a one-shot GPS fix (uses an existing permission grant only).
 *   2. PATCH /rider/availability ONLINE *with that fix* so the server can put
 *      the rider in the dispatch pool immediately - not at the first watch ping.
 *   3. Start the foreground location stream (idle cadence). This owns the
 *      permission/services prompt; a denial here rolls the server back to OFFLINE.
 *   4. Emit `rider:availability:changed` (with coords) so the server also seeds
 *      the pool over the socket, covering a socket that connected after the PATCH.
 */
export const goOnline = createAsyncThunk(
  'rider/goOnline',
  async (_, { dispatch, getState, rejectWithValue }) => {
    // Step 1: best-effort one-shot fix. Never blocks go-online; if we have no
    // grant yet it returns null and step 3's stream will prompt + stream.
    let coords;
    try {
      const fix = await locationStream.getCurrentFix();
      if (fix && typeof fix.lat === 'number' && typeof fix.lng === 'number') {
        coords = { lat: fix.lat, lng: fix.lng };
        dispatch(setLastFix(fix));
      }
    } catch (_) {}

    // Step 2: tell the server (with the fresh fix if we got one). If this
    // fails, we never start the stream - the rider stays cleanly OFFLINE.
    try {
      await patchAvailability(AVAILABILITY.ONLINE, coords);
    } catch (err) {
      return rejectWithValue({ reason: 'patch_failed', message: err?.message });
    }

    // Step 3: start the stream. The stream handles permission asks.
    const streamRes = await locationStream.start({
      mode: 'idle',
      onFix: (fix) => dispatch(setLastFix(fix)),
      requestIdGetter: () => getState().trip?.activeRequestId || null,
    });

    if (!streamRes.ok) {
      // Roll back server availability so we don't leave it ONLINE without a stream.
      try { await patchAvailability(AVAILABILITY.OFFLINE); } catch (_) {}
      return rejectWithValue({ reason: streamRes.reason });
    }

    // Step 4: socket reconcile (with coords) - redundant with the PATCH seed
    // but covers a socket that connected after the PATCH landed.
    socketService.emitAvailabilityChanged(AVAILABILITY.ONLINE, coords);

    return { availability: AVAILABILITY.ONLINE };
  },
);

/**
 * Go OFFLINE. `reason` is informational (e.g. 'force-offline' from the kill
 * switch). The reducer surfaces it for one render so the toast layer can
 * differentiate intentional vs forced.
 */
export const goOffline = createAsyncThunk(
  'rider/goOffline',
  async ({ reason } = {}, { rejectWithValue }) => {
    await locationStream.stop();
    try {
      await patchAvailability(AVAILABILITY.OFFLINE);
    } catch (err) {
      // Even if the server PATCH fails, we keep local OFFLINE - better to be
      // off in the UI than off in the server but on in the UI.
      return rejectWithValue({ reason: 'patch_failed', message: err?.message, intent: reason });
    }
    socketService.emitAvailabilityChanged(AVAILABILITY.OFFLINE);
    return { availability: AVAILABILITY.OFFLINE, reason: reason || null };
  },
);

/**
 * Toggle ON_DELIVERY cadence on the location stream. Called when a trip is
 * accepted (Phase 3) and again when it terminates. Does NOT touch
 * `Rider.availability` - that stays ONLINE; the server flips internal state
 * via the request lifecycle.
 */
export const setOnDelivery = createAsyncThunk(
  'rider/setOnDelivery',
  async (onDelivery) => {
    await locationStream.setMode(onDelivery ? 'on_delivery' : 'idle');
    return Boolean(onDelivery);
  },
);

/**
 * On socket reconnect (or AppState foreground), re-assert local availability
 * to the server so its presence cache doesn't drift.
 */
export const reconcileFromServer = createAsyncThunk(
  'rider/reconcile',
  async (_, { dispatch, getState }) => {
    const current = getState().rider?.availability;
    if (current === AVAILABILITY.ONLINE) {
      socketService.emitAvailabilityChanged(AVAILABILITY.ONLINE);
    }
    await dispatch(fetchRiderProfile());
  },
);

const initialState = {
  rider: null,
  availability: AVAILABILITY.OFFLINE,
  isStreaming: false,
  lastFix: null,             // { lat, lng, accuracy, capturedAt }
  performance: null,
  lastForceOfflineReason: null,
  isLoading: false,
  // True once the rider profile fetch has settled at least once (fulfilled OR
  // rejected - a 404 for a non-rider counts). AppNavigator holds a spinner until
  // this flips so the rider's status (incl. SUSPENDED) is known before we pick a
  // stack - without it, a returning SUSPENDED rider flashes MainTabs first.
  hasLoadedOnce: false,
  isTogglingAvailability: false,
  availabilityError: null,
  error: null,
};

const slice = createSlice({
  name: 'rider',
  initialState,
  reducers: {
    setLocalAvailability: (state, action) => {
      state.availability = action.payload;
    },
    setStreaming: (state, action) => {
      state.isStreaming = Boolean(action.payload);
    },
    setLastFix: (state, action) => {
      state.lastFix = action.payload || null;
    },
    clearForceOfflineReason: (state) => {
      state.lastForceOfflineReason = null;
    },
    resetRider: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRiderProfile.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchRiderProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        state.hasLoadedOnce = true;
        state.rider = action.payload;
        if (action.payload?.availability) {
          state.availability = action.payload.availability;
        }
      })
      .addCase(fetchRiderProfile.rejected, (state, action) => {
        state.isLoading = false;
        // A 404 (no rider record yet) still counts as "resolved" - the rider is
        // simply a fresh sign-up, not in an indeterminate state.
        state.hasLoadedOnce = true;
        state.error = action.payload;
      });

    builder
      .addCase(goOnline.pending, (state) => {
        state.isTogglingAvailability = true;
        state.availabilityError = null;
      })
      .addCase(goOnline.fulfilled, (state, action) => {
        state.isTogglingAvailability = false;
        state.availability = action.payload.availability;
        state.isStreaming = true;
      })
      .addCase(goOnline.rejected, (state, action) => {
        state.isTogglingAvailability = false;
        state.availabilityError = action.payload || { reason: 'unknown' };
        state.availability = AVAILABILITY.OFFLINE;
        state.isStreaming = false;
      });

    builder
      .addCase(goOffline.pending, (state) => {
        state.isTogglingAvailability = true;
      })
      .addCase(goOffline.fulfilled, (state, action) => {
        state.isTogglingAvailability = false;
        state.availability = action.payload.availability;
        state.isStreaming = false;
        state.lastFix = null;
        if (action.payload.reason) {
          state.lastForceOfflineReason = action.payload.reason;
        }
      })
      .addCase(goOffline.rejected, (state) => {
        // Even on server-side failure we keep the user OFFLINE in the UI.
        state.isTogglingAvailability = false;
        state.availability = AVAILABILITY.OFFLINE;
        state.isStreaming = false;
      });

    builder.addCase(setOnDelivery.fulfilled, (state, action) => {
      state.availability = action.payload
        ? AVAILABILITY.ON_DELIVERY
        : (state.availability === AVAILABILITY.ON_DELIVERY ? AVAILABILITY.ONLINE : state.availability);
    });
  },
});

export const {
  setLocalAvailability,
  setStreaming,
  setLastFix,
  clearForceOfflineReason,
  resetRider,
} = slice.actions;
export default slice.reducer;

/**
 * cartSlice - single-merchant shopping cart, persisted to AsyncStorage.
 *
 * Invariants:
 *   1. The cart is bound to at most one merchant at a time. Adding a line for
 *      a different merchant clears the cart first. The "are you sure?" prompt
 *      is the caller's responsibility (see ProductDetailScreen); this slice
 *      will happily overwrite when told to.
 *   2. Lines are identified by `lineId`. ProductDetail generates a fresh
 *      `lineId` for each add, so the same product/variant added twice with
 *      different instructions stays as two separate lines.
 *   3. Persistence is fire-and-forget. We don't block UI on the AsyncStorage
 *      write; the rare failure case just means a cold-restart loses the
 *      latest mutation, which is acceptable for a cart.
 *
 * The slice is wiped on forced logout via the root reducer in
 * `store/index.js` - same pattern as wallet/profile/etc.
 */

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { logout } from "./authSlice";

const STORAGE_KEY = "cart:v1";

/** Cold-start hydration: read the persisted cart back into the store. */
export const hydrateCartFromStorage = createAsyncThunk(
  "cart/hydrate",
  async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Guard against an older shape sneaking back in. If the persisted blob
      // is missing `lines`, treat it as empty rather than crashing the app.
      if (!parsed || !Array.isArray(parsed.lines)) return null;
      return parsed;
    } catch {
      return null;
    }
  }
);

const persist = (state) => {
  // Fire-and-forget - we never await this from the reducer.
  AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ merchantId: state.merchantId, merchant: state.merchant, lines: state.lines })
  ).catch(() => {});
};

const wipe = () => {
  AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
};

const initialState = {
  merchantId: null,
  merchant: null, // { id, name, categorySlug, lat, lng, address }
  lines: [],
  hydrated: false,
};

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    /**
     * Append or update a line. Caller passes the merchant snapshot
     * alongside the line; if the cart already belongs to a different
     * merchant, the caller must first dispatch `clearCart()` (the UI
     * prompts before doing that).
     */
    addLine: {
      reducer(state, action) {
        const { line, merchant } = action.payload;
        if (state.merchantId && merchant && state.merchantId !== merchant.id) {
          // Defensive: caller didn't clear first. Reset before adding so we
          // never end up with two merchants' items in one cart.
          state.merchantId = merchant.id;
          state.merchant = merchant;
          state.lines = [line];
        } else {
          state.merchantId = merchant?.id || state.merchantId;
          state.merchant = merchant || state.merchant;
          state.lines.push(line);
        }
        persist(state);
      },
      prepare(line, merchant) {
        return { payload: { line, merchant } };
      },
    },
    updateLine(state, action) {
      const next = action.payload; // full line
      const idx = state.lines.findIndex((l) => l.lineId === next.lineId);
      if (idx === -1) return;
      state.lines[idx] = next;
      persist(state);
    },
    removeLine(state, action) {
      const lineId = action.payload;
      state.lines = state.lines.filter((l) => l.lineId !== lineId);
      if (state.lines.length === 0) {
        state.merchantId = null;
        state.merchant = null;
      }
      persist(state);
    },
    clearCart(state) {
      state.merchantId = null;
      state.merchant = null;
      state.lines = [];
      wipe();
    },
  },
  extraReducers: (builder) => {
    builder.addCase(hydrateCartFromStorage.fulfilled, (state, action) => {
      state.hydrated = true;
      if (action.payload) {
        state.merchantId = action.payload.merchantId || null;
        state.merchant = action.payload.merchant || null;
        state.lines = action.payload.lines || [];
      }
    });
    builder.addCase(hydrateCartFromStorage.rejected, (state) => {
      state.hydrated = true;
    });
    // Normal logout: wipe the cart + AsyncStorage so a different user (or
    // the same user re-signing in after an interval) doesn't inherit it.
    // Forced logout is handled at the root-reducer level in store/index.js,
    // which already removes the persisted blob and resets every user-scoped
    // slice - including this one - to its initialState.
    builder.addCase(logout.fulfilled, (state) => {
      state.merchantId = null;
      state.merchant = null;
      state.lines = [];
      wipe();
    });
  },
});

export const { addLine, updateLine, removeLine, clearCart } = cartSlice.actions;

// Selectors
export const selectCart = (s) => s.cart;
export const selectCartLines = (s) => s.cart.lines;
export const selectCartMerchant = (s) => s.cart.merchant;
export const selectCartMerchantId = (s) => s.cart.merchantId;

export default cartSlice.reducer;

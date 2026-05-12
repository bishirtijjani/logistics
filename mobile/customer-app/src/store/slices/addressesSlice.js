/**
 * SavedAddresses slice — Phase 6.
 *
 * Mirrors `/api/addresses` (list/create/update/setDefault/delete). Used by
 * SavedAddressesScreen as the canonical list AND by CreateRequest/Checkout
 * as the picker source.
 */
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

const apiPayload = (envelope) => envelope?.data;

export const fetchAddresses = createAsyncThunk(
  'addresses/fetch',
  async (_, { rejectWithValue }) => {
    try {
      return apiPayload(await api.get('/addresses')) || [];
    } catch (err) {
      return rejectWithValue(err?.message || 'Failed to load addresses');
    }
  },
);

export const createAddress = createAsyncThunk(
  'addresses/create',
  async (input, { rejectWithValue }) => {
    try {
      return apiPayload(await api.post('/addresses', input));
    } catch (err) {
      return rejectWithValue(err?.message || 'Failed to save address');
    }
  },
);

export const updateAddress = createAsyncThunk(
  'addresses/update',
  async ({ id, ...patch }, { rejectWithValue }) => {
    try {
      return apiPayload(await api.patch(`/addresses/${id}`, patch));
    } catch (err) {
      return rejectWithValue(err?.message || 'Failed to update address');
    }
  },
);

export const setDefaultAddress = createAsyncThunk(
  'addresses/setDefault',
  async (id, { rejectWithValue }) => {
    try {
      return apiPayload(await api.post(`/addresses/${id}/default`));
    } catch (err) {
      return rejectWithValue(err?.message || 'Failed to set default');
    }
  },
);

export const deleteAddress = createAsyncThunk(
  'addresses/delete',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/addresses/${id}`);
      return id;
    } catch (err) {
      return rejectWithValue(err?.message || 'Failed to delete address');
    }
  },
);

const initialState = {
  list: [],
  isLoading: false,
  isMutating: false,
  isLoaded: false,
  error: null,
};

const slice = createSlice({
  name: 'addresses',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAddresses.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(fetchAddresses.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isLoaded = true;
        state.list = action.payload || [];
      })
      .addCase(fetchAddresses.rejected, (state, action) => { state.isLoading = false; state.error = action.payload; });

    builder
      .addCase(createAddress.pending, (state) => { state.isMutating = true; })
      .addCase(createAddress.fulfilled, (state, action) => {
        state.isMutating = false;
        if (!action.payload) return;
        // If the new row is default, demote the others locally to match
        // what the server-side transaction did.
        if (action.payload.isDefault) {
          state.list.forEach((a) => { a.isDefault = false; });
        }
        state.list.unshift(action.payload);
      })
      .addCase(createAddress.rejected, (state) => { state.isMutating = false; });

    builder
      .addCase(updateAddress.fulfilled, (state, action) => {
        const updated = action.payload;
        if (!updated) return;
        if (updated.isDefault) {
          state.list.forEach((a) => { if (a.id !== updated.id) a.isDefault = false; });
        }
        const idx = state.list.findIndex((a) => a.id === updated.id);
        if (idx !== -1) state.list[idx] = updated;
      });

    builder
      .addCase(setDefaultAddress.fulfilled, (state, action) => {
        const updated = action.payload;
        if (!updated) return;
        state.list.forEach((a) => { a.isDefault = a.id === updated.id; });
      });

    builder
      .addCase(deleteAddress.fulfilled, (state, action) => {
        const id = action.payload;
        state.list = state.list.filter((a) => a.id !== id);
      });
  },
});

export default slice.reducer;

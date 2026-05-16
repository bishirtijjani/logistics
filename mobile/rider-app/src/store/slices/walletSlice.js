import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import { newIdempotencyKey } from '../../services/idempotency';

/**
 * Wallet slice — balance, virtual account, transactions, withdrawals.
 * Fleshed out in Phase 6.
 */

export const fetchWallet = createAsyncThunk(
  'wallet/fetch',
  async (_, { rejectWithValue }) => {
    try {
      const envelope = await api.get('/wallet');
      return envelope?.data || envelope || {};
    } catch (err) {
      return rejectWithValue(err?.message || 'Failed to load wallet');
    }
  },
);

export const retryProvisioning = createAsyncThunk(
  'wallet/retryProvisioning',
  async (_, { rejectWithValue }) => {
    try {
      const envelope = await api.post('/wallet/retry-provisioning', {});
      return envelope?.data || envelope || {};
    } catch (err) {
      return rejectWithValue(err?.message || 'Failed to retry provisioning');
    }
  },
);

export const withdrawToBank = createAsyncThunk(
  'wallet/withdraw',
  async (payload, { rejectWithValue }) => {
    try {
      const envelope = await api.post('/wallet/withdraw', payload, {
        headers: { 'Idempotency-Key': newIdempotencyKey() },
      });
      return envelope?.data || envelope;
    } catch (err) {
      return rejectWithValue(err);
    }
  },
);

const initialState = {
  balance: 0,
  accountNumber: null,
  accountBank: null,
  accountName: null,
  isLocked: false,
  provisioningInFlight: false,
  isLoading: false,
  error: null,
};

const slice = createSlice({
  name: 'wallet',
  initialState,
  reducers: {
    walletBalanceUpdated: (state, action) => {
      const payload = action.payload || {};
      if (typeof payload.balance === 'number') state.balance = payload.balance;
    },
    resetWallet: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWallet.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchWallet.fulfilled, (state, action) => {
        state.isLoading = false;
        const w = action.payload || {};
        state.balance = w.balance ?? state.balance;
        state.accountNumber = w.virtualAccountNumber ?? null;
        state.accountBank = w.virtualAccountBank ?? null;
        state.accountName = w.virtualAccountName ?? null;
        state.isLocked = Boolean(w.isLocked);
      })
      .addCase(fetchWallet.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    builder
      .addCase(retryProvisioning.pending, (state) => {
        state.provisioningInFlight = true;
      })
      .addCase(retryProvisioning.fulfilled, (state, action) => {
        state.provisioningInFlight = false;
        const w = action.payload || {};
        if (w.virtualAccountNumber) state.accountNumber = w.virtualAccountNumber;
        if (w.virtualAccountBank) state.accountBank = w.virtualAccountBank;
        if (w.virtualAccountName) state.accountName = w.virtualAccountName;
      })
      .addCase(retryProvisioning.rejected, (state) => {
        state.provisioningInFlight = false;
      });
  },
});

export const { walletBalanceUpdated, resetWallet } = slice.actions;
export default slice.reducer;

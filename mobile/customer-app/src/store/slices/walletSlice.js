import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../../services/api";
import socketService from "../../services/socket";
import { newIdempotencyKey } from "../../services/idempotency";

// ─── Thunks ─────────────────────────────────────────────────────────────────

export const fetchWallet = createAsyncThunk(
  "wallet/fetch",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get("/wallet");
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

export const fetchTransactions = createAsyncThunk(
  "wallet/fetchTransactions",
  async ({ page = 1, limit = 20, type = null } = {}, { rejectWithValue }) => {
    try {
      const params = { page, limit };
      if (type) params.type = type;
      const response = await api.get("/wallet/transactions", { params });
      return { ...response.data, page };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

export const fetchBanks = createAsyncThunk(
  "wallet/fetchBanks",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get("/wallet/banks");
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

export const lookupBankAccount = createAsyncThunk(
  "wallet/lookupBankAccount",
  async ({ bankCode, accountNumber }, { rejectWithValue }) => {
    try {
      const response = await api.post("/wallet/banks/lookup", { bankCode, accountNumber });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

// PIN-bearing thunks must preserve the api error's status/data so PinBottomSheet
// can detect 423 lockouts via `.unwrap()`.
const pinErrorPayload = (error) => ({
  message: error?.message || 'Request failed',
  status: error?.status ?? null,
  data: error?.data ?? null,
});

export const sendMoney = createAsyncThunk(
  "wallet/sendMoney",
  async ({ recipientPhone, amount, description, pin }, { rejectWithValue }) => {
    try {
      const response = await api.post(
        "/wallet/transfer",
        { recipientPhone, amount, description, pin },
        { headers: { "Idempotency-Key": newIdempotencyKey() } },
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(pinErrorPayload(error));
    }
  },
);

export const withdrawToBank = createAsyncThunk(
  "wallet/withdrawToBank",
  async ({ bankCode, accountNumber, accountName, amount, pin }, { rejectWithValue }) => {
    try {
      const response = await api.post(
        "/wallet/withdraw",
        { bankCode, accountNumber, accountName, amount, pin },
        { headers: { "Idempotency-Key": newIdempotencyKey() } },
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(pinErrorPayload(error));
    }
  },
);

export const fetchBeneficiaries = createAsyncThunk(
  "wallet/fetchBeneficiaries",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get("/wallet/beneficiaries");
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

export const saveBeneficiary = createAsyncThunk(
  "wallet/saveBeneficiary",
  async (data, { rejectWithValue }) => {
    try {
      const response = await api.post("/wallet/beneficiaries", data);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

export const deleteBeneficiary = createAsyncThunk(
  "wallet/deleteBeneficiary",
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/wallet/beneficiaries/${id}`);
      return id;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

// ─── Slice ───────────────────────────────────────────────────────────────────

const walletSlice = createSlice({
  name: "wallet",
  initialState: {
    balance: 0,
    currency: "NGN",
    accountNumber: null,
    bankName: null,
    accountName: null,
    isLocked: false,
    transactions: [],
    total: 0,
    banks: [],
    beneficiaries: [],
    isLoading: false,
    isSending: false,
    isWithdrawing: false,
    error: null,
  },
  reducers: {
    // Called by socket listener when balance changes in real time
    socketBalanceUpdated: (state, action) => {
      if (action.payload.balance !== undefined) {
        state.balance = action.payload.balance;
      }
      if (action.payload.transaction) {
        state.transactions = [action.payload.transaction, ...state.transactions];
      }
    },
  },
  extraReducers: (builder) => {
    // Fetch wallet
    builder
      .addCase(fetchWallet.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(fetchWallet.fulfilled, (state, action) => {
        state.isLoading = false;
        const d = action.payload;
        state.balance = Number(d?.balance ?? 0);
        state.currency = "NGN";
        state.accountNumber = d?.accountNumber ?? null;
        state.bankName = d?.bankName ?? null;
        state.accountName = d?.accountName ?? null;
        state.isLocked = d?.isLocked ?? false;
      })
      .addCase(fetchWallet.rejected, (state, action) => { state.isLoading = false; state.error = action.payload; });

    // Fetch transactions
    builder
      .addCase(fetchTransactions.pending, (state) => { state.isLoading = true; })
      .addCase(fetchTransactions.fulfilled, (state, action) => {
        state.isLoading = false;
        const { data, pagination, page } = action.payload;
        const txs = data?.transactions ?? data ?? [];
        if (page === 1) {
          state.transactions = txs;
        } else {
          state.transactions = [...state.transactions, ...txs];
        }
        state.total = pagination?.total ?? action.payload.total ?? 0;
      })
      .addCase(fetchTransactions.rejected, (state, action) => { state.isLoading = false; state.error = action.payload; });

    // Banks
    builder
      .addCase(fetchBanks.fulfilled, (state, action) => {
        state.banks = action.payload?.data ?? action.payload ?? [];
      });

    // Send money
    builder
      .addCase(sendMoney.pending, (state) => { state.isSending = true; state.error = null; })
      .addCase(sendMoney.fulfilled, (state, action) => {
        state.isSending = false;
        if (action.payload?.newBalance !== undefined) {
          state.balance = Number(action.payload.newBalance);
        }
      })
      .addCase(sendMoney.rejected, (state, action) => { state.isSending = false; state.error = action.payload?.message ?? action.payload ?? null; });

    // Withdraw
    builder
      .addCase(withdrawToBank.pending, (state) => { state.isWithdrawing = true; state.error = null; })
      .addCase(withdrawToBank.fulfilled, (state, action) => {
        state.isWithdrawing = false;
        if (action.payload?.newBalance !== undefined) {
          state.balance = Number(action.payload.newBalance);
        }
      })
      .addCase(withdrawToBank.rejected, (state, action) => { state.isWithdrawing = false; state.error = action.payload?.message ?? action.payload ?? null; });

    // Beneficiaries
    builder
      .addCase(fetchBeneficiaries.fulfilled, (state, action) => {
        state.beneficiaries = action.payload?.data ?? action.payload ?? [];
      })
      .addCase(saveBeneficiary.fulfilled, (state, action) => {
        const b = action.payload?.data ?? action.payload;
        if (b) state.beneficiaries = [b, ...state.beneficiaries];
      })
      .addCase(deleteBeneficiary.fulfilled, (state, action) => {
        state.beneficiaries = state.beneficiaries.filter((b) => b.id !== action.payload);
      });
  },
});

export const { socketBalanceUpdated } = walletSlice.actions;

/**
 * Register socket event listeners for real-time wallet updates.
 * Call this once after the socket connects.
 */
export const subscribeToWalletSocket = () => (dispatch) => {
  const unsub1 = socketService.onWalletBalanceUpdated((data) => {
    dispatch(socketBalanceUpdated(data));
  });
  return () => { unsub1(); };
};

export default walletSlice.reducer;

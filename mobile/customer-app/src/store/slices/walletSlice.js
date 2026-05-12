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
  async (
    { page = 1, limit = 20, type = null, startDate = null, endDate = null, q = null } = {},
    { rejectWithValue },
  ) => {
    try {
      const params = { page, limit };
      if (type) params.type = type;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (q) params.q = q;
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
  async ({ bankCode, bankName, accountNumber, accountName, amount, pin }, { rejectWithValue }) => {
    try {
      const response = await api.post(
        "/wallet/withdraw",
        { bankCode, bankName, accountNumber, accountName, amount, pin },
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
    // Latest in-flight transaction-fetch request id. Used to discard responses
    // from a superseded fetch (filter change while previous fetch was in flight).
    latestTxFetchId: null,
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
    // Inbound P2P transfer — backend has already credited the wallet and the
    // matching wallet:balance:updated event will set the balance. We only
    // prepend a placeholder transaction so it appears immediately in history;
    // it'll be reconciled with the server row on next fetch.
    socketTransferReceived: (state, action) => {
      const { amount, senderName, reference } = action.payload || {};
      if (amount === undefined) return;
      const exists = reference && state.transactions.some((t) => t.reference === reference);
      if (exists) return;
      state.transactions = [
        {
          reference: reference || `RX-${Date.now()}`,
          type: "P2P_TRANSFER_RECEIVED",
          status: "COMPLETED",
          amount: Number(amount),
          description: senderName ? `From ${senderName}` : "Money received",
          createdAt: new Date().toISOString(),
          _optimistic: true,
        },
        ...state.transactions,
      ];
    },
    // Bank-transfer funding into the NUBAN. Same pattern as transfer-received.
    socketFundingReceived: (state, action) => {
      const { amount, reference } = action.payload || {};
      if (amount === undefined) return;
      const exists = reference && state.transactions.some((t) => t.reference === reference);
      if (exists) return;
      state.transactions = [
        {
          reference: reference || `FUND-${Date.now()}`,
          type: "WALLET_FUNDING",
          status: "COMPLETED",
          amount: Number(amount),
          description: "Wallet funding",
          createdAt: new Date().toISOString(),
          _optimistic: true,
        },
        ...state.transactions,
      ];
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
      .addCase(fetchTransactions.pending, (state, action) => {
        state.isLoading = true;
        state.latestTxFetchId = action.meta.requestId;
      })
      .addCase(fetchTransactions.fulfilled, (state, action) => {
        // Stale-response guard. If the user changed filters while this fetch
        // was in flight, a newer fetch has taken the latest slot — drop this
        // one to avoid clobbering the new filter's results.
        if (action.meta.requestId !== state.latestTxFetchId) return;
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
      .addCase(fetchTransactions.rejected, (state, action) => {
        if (action.meta.requestId !== state.latestTxFetchId) return;
        state.isLoading = false;
        state.error = action.payload;
      });

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

export const {
  socketBalanceUpdated,
  socketTransferReceived,
  socketFundingReceived,
} = walletSlice.actions;

/**
 * Register socket event listeners for real-time wallet updates.
 * Call this once after the socket connects.
 */
export const subscribeToWalletSocket = () => (dispatch) => {
  const unsub1 = socketService.onWalletBalanceUpdated((data) => {
    dispatch(socketBalanceUpdated(data));
  });
  const unsub2 = socketService.onWalletTransferReceived((data) => {
    dispatch(socketTransferReceived(data));
  });
  const unsub3 = socketService.onWalletFundingReceived((data) => {
    dispatch(socketFundingReceived(data));
  });
  return () => { unsub1(); unsub2(); unsub3(); };
};

export default walletSlice.reducer;

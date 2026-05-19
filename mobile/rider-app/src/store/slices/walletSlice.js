import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as SecureStore from "expo-secure-store";
import api from "../../services/api";
import socketService from "../../services/socket";
import { newIdempotencyKey } from "../../services/idempotency";

/**
 * Wallet slice — balance, virtual account, transactions, withdrawals,
 * banks list, bank-account name lookup, beneficiaries.
 *
 * Ported from customer-app and extended with persistent idempotency for the
 * withdraw flow: the rider's pending withdraw key is stashed in SecureStore
 * the moment we send the request, and only cleared once the server replies
 * (success OR a terminal 4xx). On cold-start, `hydratePendingWithdraw`
 * replays the key so a kill-mid-withdraw lets the server return the
 * original response rather than double-charging.
 */

const PENDING_WITHDRAW_KEY = "wallet:pendingWithdraw";

// ─── Persistent idempotency helpers ────────────────────────────────────────

async function persistPendingWithdraw(snapshot) {
  try {
    await SecureStore.setItemAsync(PENDING_WITHDRAW_KEY, JSON.stringify(snapshot));
  } catch (_) {}
}

async function clearPendingWithdraw() {
  try { await SecureStore.deleteItemAsync(PENDING_WITHDRAW_KEY); } catch (_) {}
}

async function readPendingWithdraw() {
  try {
    const raw = await SecureStore.getItemAsync(PENDING_WITHDRAW_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

// ─── Thunks ────────────────────────────────────────────────────────────────

export const fetchWallet = createAsyncThunk(
  "wallet/fetch",
  async (_, { rejectWithValue }) => {
    try {
      const envelope = await api.get("/wallet");
      return envelope?.data || envelope || {};
    } catch (err) {
      return rejectWithValue(err?.message || "Failed to load wallet");
    }
  },
);

export const retryProvisioning = createAsyncThunk(
  "wallet/retryProvisioning",
  async (_, { rejectWithValue }) => {
    try {
      const envelope = await api.post("/wallet/retry-provisioning", {});
      return envelope?.data || envelope || {};
    } catch (err) {
      return rejectWithValue({ message: err?.message || "Provisioning failed", code: err?.code });
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
      const params = new URLSearchParams();
      params.append("page", String(page));
      params.append("limit", String(limit));
      if (type) params.append("type", type);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (q) params.append("q", q);
      const envelope = await api.get(`/wallet/transactions?${params.toString()}`);
      return { ...(envelope?.data || envelope || {}), page };
    } catch (err) {
      return rejectWithValue(err?.message || "Failed to load transactions");
    }
  },
);

export const fetchBanks = createAsyncThunk(
  "wallet/fetchBanks",
  async (_, { rejectWithValue }) => {
    try {
      const envelope = await api.get("/wallet/banks");
      return envelope?.data || envelope || [];
    } catch (err) {
      return rejectWithValue(err?.message || "Failed to load banks");
    }
  },
);

export const lookupBankAccount = createAsyncThunk(
  "wallet/lookupBankAccount",
  async ({ bankCode, accountNumber }, { rejectWithValue }) => {
    try {
      const envelope = await api.post("/wallet/banks/lookup", { bankCode, accountNumber });
      return envelope?.data || envelope || {};
    } catch (err) {
      return rejectWithValue(err?.message || "Bank lookup failed");
    }
  },
);

// PIN-bearing errors must preserve status/code so PinBottomSheet can detect
// 423 lockouts and the caller can branch on PIN_NOT_SET.
const pinErrorPayload = (err) => ({
  message: err?.message || "Request failed",
  status: err?.status ?? null,
  data: err?.data ?? null,
  code: err?.code ?? null,
});

/**
 * Withdraw funds to a Nigerian bank. The Idempotency-Key is persisted to
 * SecureStore BEFORE the POST so a kill mid-flight lets us replay the same
 * key on next launch — the server's idempotency middleware returns the
 * original response without re-debiting.
 *
 * Caller may pass `idempotencyKey` (e.g. from `hydratePendingWithdraw`) to
 * force the in-flight key. Otherwise we mint a fresh one and persist.
 */
export const withdrawToBank = createAsyncThunk(
  "wallet/withdrawToBank",
  async (
    { bankCode, bankName, accountNumber, accountName, amount, pin, idempotencyKey: existingKey },
    { rejectWithValue },
  ) => {
    const idempotencyKey = existingKey || newIdempotencyKey();
    const body = { bankCode, bankName, accountNumber, accountName, amount, pin };
    // Snapshot without the PIN — never persist user secrets to disk.
    const { pin: _omit, ...safeBody } = body;
    await persistPendingWithdraw({ idempotencyKey, body: safeBody, startedAt: Date.now() });
    try {
      const envelope = await api.post(
        "/wallet/withdraw",
        body,
        { headers: { "Idempotency-Key": idempotencyKey } },
      );
      // Server-side success → clear the persisted key so we don't replay.
      await clearPendingWithdraw();
      return envelope?.data || envelope || {};
    } catch (err) {
      // Terminal 4xx errors — wrong PIN, validation, lock — also clear the
      // key. The user retries with a fresh key for their next attempt.
      // 5xx / NETWORK_ERROR leave the key in place so the hydrate path can
      // replay on next launch.
      const status = err?.status;
      const isTerminal4xx = typeof status === "number" && status >= 400 && status < 500;
      if (isTerminal4xx) await clearPendingWithdraw();
      return rejectWithValue(pinErrorPayload(err));
    }
  },
);

/**
 * Read the pending withdraw snapshot (if any). The WithdrawScreen reads
 * this on mount; if present, it prefills the form + reuses the
 * `idempotencyKey` on submit. The server's idempotency middleware then
 * replays the original response (if it ever completed) or processes the
 * resubmit fresh (if the request never reached the server pre-crash).
 *
 * We deliberately do NOT auto-replay without the user's PIN — wallet
 * actions are PIN-gated, and silently re-submitting on cold start with a
 * stripped PIN would 422 from the server.
 *
 * Returns `null` if nothing pending or if the snapshot is older than 24 h
 * (the server's idempotency TTL).
 */
export async function getPendingWithdraw() {
  const snapshot = await readPendingWithdraw();
  if (!snapshot || !snapshot.idempotencyKey) return null;
  const MAX_AGE_MS = 24 * 60 * 60 * 1000;
  if (Date.now() - (snapshot.startedAt || 0) > MAX_AGE_MS) {
    await clearPendingWithdraw();
    return null;
  }
  return snapshot;
}

export async function discardPendingWithdraw() {
  await clearPendingWithdraw();
}

export const fetchReceipt = createAsyncThunk(
  "wallet/fetchReceipt",
  async (transactionId, { rejectWithValue }) => {
    try {
      const envelope = await api.get(`/wallet/transactions/${transactionId}/receipt`);
      return envelope?.data || envelope || {};
    } catch (err) {
      return rejectWithValue(err?.message || "Failed to load receipt");
    }
  },
);

// ─── Slice ─────────────────────────────────────────────────────────────────

const initialState = {
  balance: 0,
  currency: "NGN",
  accountNumber: null,
  bankName: null,
  accountName: null,
  isLocked: false,
  transactions: [],
  total: 0,
  banks: [],
  isLoading: false,
  isWithdrawing: false,
  provisioningInFlight: false,
  // Last withdraw payload + receipt — used by the success screen.
  lastWithdraw: null,
  error: null,
  latestTxFetchId: null,
};

const slice = createSlice({
  name: "wallet",
  initialState,
  reducers: {
    // Real-time balance update from `wallet:balance:updated` socket. The
    // payload's `transaction` row is prepended to the in-memory list so
    // the rider sees the credit instantly without a refetch.
    socketBalanceUpdated: (state, action) => {
      const payload = action.payload || {};
      if (typeof payload.balance === "number") {
        state.balance = payload.balance;
      }
      if (payload.transaction) {
        // Dedupe by reference if present.
        const tx = payload.transaction;
        const exists = tx.reference
          ? state.transactions.some((t) => t.reference === tx.reference)
          : false;
        if (!exists) {
          state.transactions = [
            { ...tx, _optimistic: !tx.id },
            ...state.transactions,
          ];
        }
      }
    },
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
    clearWalletError: (state) => { state.error = null; },
    resetWallet: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWallet.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(fetchWallet.fulfilled, (state, action) => {
        state.isLoading = false;
        const d = action.payload || {};
        state.balance = Number(d.balance ?? 0);
        state.accountNumber = d.accountNumber ?? d.virtualAccountNumber ?? null;
        state.bankName = d.bankName ?? d.virtualAccountBank ?? null;
        state.accountName = d.accountName ?? d.virtualAccountName ?? null;
        state.isLocked = Boolean(d.isLocked);
      })
      .addCase(fetchWallet.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    builder
      .addCase(retryProvisioning.pending, (state) => {
        state.provisioningInFlight = true;
        state.error = null;
      })
      .addCase(retryProvisioning.fulfilled, (state, action) => {
        state.provisioningInFlight = false;
        const w = action.payload || {};
        state.accountNumber = w.accountNumber ?? w.virtualAccountNumber ?? state.accountNumber;
        state.bankName = w.bankName ?? w.virtualAccountBank ?? state.bankName;
        state.accountName = w.accountName ?? w.virtualAccountName ?? state.accountName;
        if (w.balance !== undefined) state.balance = Number(w.balance);
      })
      .addCase(retryProvisioning.rejected, (state, action) => {
        state.provisioningInFlight = false;
        state.error = action.payload;
      });

    builder
      .addCase(fetchTransactions.pending, (state, action) => {
        state.isLoading = true;
        state.latestTxFetchId = action.meta.requestId;
      })
      .addCase(fetchTransactions.fulfilled, (state, action) => {
        // Stale-response guard for filter changes mid-flight.
        if (action.meta.requestId !== state.latestTxFetchId) return;
        state.isLoading = false;
        const { transactions, pagination, page } = action.payload || {};
        const list = Array.isArray(transactions) ? transactions : (action.payload?.data?.transactions || []);
        if (page === 1) {
          state.transactions = list;
        } else {
          state.transactions = [...state.transactions, ...list];
        }
        state.total = pagination?.total ?? action.payload?.total ?? 0;
      })
      .addCase(fetchTransactions.rejected, (state, action) => {
        if (action.meta.requestId !== state.latestTxFetchId) return;
        state.isLoading = false;
        state.error = action.payload;
      });

    builder
      .addCase(fetchBanks.fulfilled, (state, action) => {
        const payload = action.payload || {};
        state.banks = Array.isArray(payload) ? payload : (payload.banks || payload.data || []);
      });

    builder
      .addCase(withdrawToBank.pending, (state) => {
        state.isWithdrawing = true;
        state.error = null;
      })
      .addCase(withdrawToBank.fulfilled, (state, action) => {
        state.isWithdrawing = false;
        const d = action.payload || {};
        if (d.newBalance !== undefined) state.balance = Number(d.newBalance);
        else if (d.balance !== undefined) state.balance = Number(d.balance);
        state.lastWithdraw = {
          transactionId: d.transactionId || d.transaction?.id || null,
          reference: d.reference || d.transaction?.reference || null,
          amount: d.amount || null,
          completedAt: new Date().toISOString(),
        };
      })
      .addCase(withdrawToBank.rejected, (state, action) => {
        state.isWithdrawing = false;
        state.error = action.payload?.message ?? action.payload ?? null;
      });

  },
});

export const {
  socketBalanceUpdated,
  socketFundingReceived,
  clearWalletError,
  resetWallet,
} = slice.actions;

/**
 * Subscribe socket events into walletSlice. Call once on app boot post-auth.
 * Returns a teardown function.
 */
export const subscribeToWalletSocket = () => (dispatch) => {
  const unsub1 = socketService.onWalletBalanceUpdated((data) => {
    dispatch(socketBalanceUpdated(data));
  });
  const unsub2 = socketService.onWalletFundingReceived((data) => {
    dispatch(socketFundingReceived(data));
  });
  return () => { unsub1?.(); unsub2?.(); };
};

export default slice.reducer;

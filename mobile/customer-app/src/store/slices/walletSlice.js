import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../../services/api";

export const fetchWallet = createAsyncThunk(
  "wallet/fetch",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get("/wallet");
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

export const fetchTransactions = createAsyncThunk(
  "wallet/fetchTransactions",
  async ({ page = 1, limit = 20, type = null }, { rejectWithValue }) => {
    try {
      const params = { page, limit };
      if (type) params.type = type;

      const response = await api.get("/wallet/transactions", { params });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

const walletSlice = createSlice({
  name: "wallet",
  initialState: {
    balance: 0,
    currency: "NGN",
    accountNumber: null,
    bankName: null,
    transactions: [],
    total: 0,
    isLoading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchWallet.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchWallet.fulfilled, (state, action) => {
        state.isLoading = false;
        state.balance = action.payload?.balance ?? 0;
        state.currency = action.payload?.currency ?? "NGN";
        state.accountNumber = action.payload?.accountNumber ?? null;
        state.bankName = action.payload?.bankName ?? null;
      })
      .addCase(fetchWallet.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(fetchTransactions.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTransactions.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.meta.arg.page === 1) {
          state.transactions = action.payload?.transactions ?? [];
        } else {
          state.transactions = [...state.transactions, ...(action.payload?.transactions ?? [])];
        }
        state.total = action.payload?.total ?? 0;
      })
      .addCase(fetchTransactions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export default walletSlice.reducer;

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

const walletSlice = createSlice({
  name: "wallet",
  initialState: {
    balance: 0,
    currency: "NGN",
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
      })
      .addCase(fetchWallet.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export default walletSlice.reducer;

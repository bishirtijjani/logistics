/**
 * Wallet slice — manages wallet balance and transaction history.
 */

const { createSlice, createAsyncThunk } = require('@reduxjs/toolkit');
const walletService = require('../../features/wallet/walletService');

const fetchWallet = createAsyncThunk('wallet/fetch', async (_, { rejectWithValue }) => {
  try {
    const response = await walletService.getWallet();
    return response.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to load wallet');
  }
});

const fetchTransactions = createAsyncThunk('wallet/fetchTransactions', async (params, { rejectWithValue }) => {
  try {
    const response = await walletService.getTransactions(params);
    return response.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to load transactions');
  }
});

const transferMoney = createAsyncThunk('wallet/transfer', async (transferData, { rejectWithValue }) => {
  try {
    const response = await walletService.transfer(transferData);
    return response.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Transfer failed');
  }
});

const walletSlice = createSlice({
  name: 'wallet',
  initialState: {
    balance: null,
    virtualAccount: null,
    transactions: [],
    transactionsMeta: null,
    status: 'idle',
    transferStatus: 'idle',
    error: null,
  },
  reducers: {
    clearError: (state) => { state.error = null; },
    updateBalance: (state, action) => { state.balance = action.payload; },
    resetTransferStatus: (state) => { state.transferStatus = 'idle'; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWallet.pending, (state) => { state.status = 'loading'; })
      .addCase(fetchWallet.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.balance = action.payload.balance;
        state.virtualAccount = {
          number: action.payload.virtualAccountNumber,
          bank: action.payload.virtualAccountBank,
          name: action.payload.virtualAccountName,
        };
      })
      .addCase(fetchWallet.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(fetchTransactions.fulfilled, (state, action) => {
        state.transactions = action.payload;
      })
      .addCase(transferMoney.pending, (state) => { state.transferStatus = 'loading'; })
      .addCase(transferMoney.fulfilled, (state, action) => {
        state.transferStatus = 'succeeded';
        state.balance = action.payload.newBalance;
      })
      .addCase(transferMoney.rejected, (state, action) => {
        state.transferStatus = 'failed';
        state.error = action.payload;
      });
  },
});

module.exports = { walletSlice, fetchWallet, fetchTransactions, transferMoney };

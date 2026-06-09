/**
 * Utilities slice - airtime, data, electricity purchases.
 */

const { createSlice, createAsyncThunk } = require('@reduxjs/toolkit');
const utilitiesService = require('../../features/utilities/utilitiesService');

const buyAirtime = createAsyncThunk('utilities/buyAirtime', async (data, { rejectWithValue }) => {
  try {
    const response = await utilitiesService.buyAirtime(data);
    return response.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Airtime purchase failed');
  }
});

const buyData = createAsyncThunk('utilities/buyData', async (data, { rejectWithValue }) => {
  try {
    const response = await utilitiesService.buyData(data);
    return response.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Data purchase failed');
  }
});

const payElectricity = createAsyncThunk('utilities/payElectricity', async (data, { rejectWithValue }) => {
  try {
    const response = await utilitiesService.payElectricity(data);
    return response.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Electricity payment failed');
  }
});

const fetchBillHistory = createAsyncThunk('utilities/fetchHistory', async (params, { rejectWithValue }) => {
  try {
    const response = await utilitiesService.getBillHistory(params);
    return response.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to load history');
  }
});

const utilitiesSlice = createSlice({
  name: 'utilities',
  initialState: {
    billHistory: [],
    purchaseStatus: 'idle',
    error: null,
  },
  reducers: {
    clearError: (state) => { state.error = null; },
    resetPurchaseStatus: (state) => { state.purchaseStatus = 'idle'; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(buyAirtime.pending, (state) => { state.purchaseStatus = 'loading'; })
      .addCase(buyAirtime.fulfilled, (state) => { state.purchaseStatus = 'succeeded'; })
      .addCase(buyAirtime.rejected, (state, action) => {
        state.purchaseStatus = 'failed';
        state.error = action.payload;
      })
      .addCase(buyData.pending, (state) => { state.purchaseStatus = 'loading'; })
      .addCase(buyData.fulfilled, (state) => { state.purchaseStatus = 'succeeded'; })
      .addCase(buyData.rejected, (state, action) => {
        state.purchaseStatus = 'failed';
        state.error = action.payload;
      })
      .addCase(payElectricity.pending, (state) => { state.purchaseStatus = 'loading'; })
      .addCase(payElectricity.fulfilled, (state) => { state.purchaseStatus = 'succeeded'; })
      .addCase(payElectricity.rejected, (state, action) => {
        state.purchaseStatus = 'failed';
        state.error = action.payload;
      })
      .addCase(fetchBillHistory.fulfilled, (state, action) => {
        state.billHistory = action.payload;
      });
  },
});

module.exports = { utilitiesSlice, buyAirtime, buyData, payElectricity, fetchBillHistory };

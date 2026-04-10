/**
 * Delivery slice — manages delivery orders and tracking state.
 */

const { createSlice, createAsyncThunk } = require('@reduxjs/toolkit');
const deliveryService = require('../../features/delivery/deliveryService');

const estimateFare = createAsyncThunk('delivery/estimate', async (coords, { rejectWithValue }) => {
  try {
    const response = await deliveryService.estimateFare(coords);
    return response.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Estimation failed');
  }
});

const createOrder = createAsyncThunk('delivery/createOrder', async (orderData, { rejectWithValue }) => {
  try {
    const response = await deliveryService.createOrder(orderData);
    return response.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Order creation failed');
  }
});

const fetchOrders = createAsyncThunk('delivery/fetchOrders', async (params, { rejectWithValue }) => {
  try {
    const response = await deliveryService.getOrders(params);
    return response.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to load orders');
  }
});

const deliverySlice = createSlice({
  name: 'delivery',
  initialState: {
    activeOrder: null,
    riderLocation: null,
    fareEstimate: null,
    orders: [],
    ordersMeta: null,
    status: 'idle',
    createStatus: 'idle',
    error: null,
  },
  reducers: {
    clearError: (state) => { state.error = null; },
    setRiderLocation: (state, action) => { state.riderLocation = action.payload; },
    updateOrderStatus: (state, action) => {
      if (state.activeOrder?.id === action.payload.orderId) {
        state.activeOrder.status = action.payload.status;
      }
    },
    setActiveOrder: (state, action) => { state.activeOrder = action.payload; },
    clearActiveOrder: (state) => {
      state.activeOrder = null;
      state.riderLocation = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(estimateFare.fulfilled, (state, action) => {
        state.fareEstimate = action.payload;
      })
      .addCase(createOrder.pending, (state) => { state.createStatus = 'loading'; })
      .addCase(createOrder.fulfilled, (state, action) => {
        state.createStatus = 'succeeded';
        state.activeOrder = action.payload;
      })
      .addCase(createOrder.rejected, (state, action) => {
        state.createStatus = 'failed';
        state.error = action.payload;
      })
      .addCase(fetchOrders.fulfilled, (state, action) => {
        state.orders = action.payload;
      });
  },
});

module.exports = { deliverySlice, estimateFare, createOrder, fetchOrders };

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";

export const fetchOrders = createAsyncThunk(
  "orders/fetch",
  async ({ page = 1, limit = 20, status, search, startDate, endDate } = {}, { getState, rejectWithValue }) => {
    try {
      const merchantId = getState().auth.user?.merchantId;
      if (!merchantId) throw new Error("No merchant profile on this account");
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (status) params.set("status", status);
      if (search) params.set("search", search);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      const res = await api.get(`/merchants/merchant/${merchantId}/orders?${params.toString()}`);
      const data = res.data || [];
      const meta = res.meta || {};
      return {
        list: data,
        page: meta.page || page,
        total: typeof meta.total === "number" ? meta.total : data.length,
        append: page > 1,
      };
    } catch (err) {
      return rejectWithValue(err.message);
    }
  },
);

export const acceptOrder = createAsyncThunk(
  "orders/accept",
  async (requestId, { getState, rejectWithValue }) => {
    try {
      const merchantId = getState().auth.user?.merchantId;
      const res = await api.patch(`/merchants/merchant/${merchantId}/orders/${requestId}/accept`);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  },
);

export const rejectOrder = createAsyncThunk(
  "orders/reject",
  async ({ requestId, reason }, { getState, rejectWithValue }) => {
    try {
      const merchantId = getState().auth.user?.merchantId;
      const res = await api.patch(`/merchants/merchant/${merchantId}/orders/${requestId}/reject`, { reason });
      return res.data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  },
);

export const updateOrderStatus = createAsyncThunk(
  "orders/updateStatus",
  async ({ requestId, status }, { getState, rejectWithValue }) => {
    try {
      const merchantId = getState().auth.user?.merchantId;
      const res = await api.patch(`/merchants/merchant/${merchantId}/orders/${requestId}/status`, { status });
      return res.data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  },
);

const initialState = {
  orders: [],
  page: 1,
  total: 0,
  statusFilter: null,
  isLoading: false,
  error: null,
};

const upsert = (list, updated) => {
  const idx = list.findIndex((o) => o.id === updated.id);
  if (idx >= 0) list[idx] = { ...list[idx], ...updated };
  else list.unshift(updated);
};

const slice = createSlice({
  name: "orders",
  initialState,
  reducers: {
    setStatusFilter: (state, action) => {
      state.statusFilter = action.payload;
    },
    // Socket-driven in-place status patch (`request:status:changed`).
    orderStatusPatched: (state, action) => {
      const data = action.payload;
      if (!data?.requestId) return;
      const row = state.orders.find((o) => o.id === data.requestId);
      if (row) Object.assign(row, data);
    },
    orderReceived: (state, action) => {
      const data = action.payload;
      if (!data?.requestId) return;
      if (state.orders.find((o) => o.id === data.requestId)) return;
      state.orders.unshift({ id: data.requestId, ...data, status: data.status || "REQUESTED" });
      state.total += 1;
    },
    resetOrders: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchOrders.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchOrders.fulfilled, (state, action) => {
        state.isLoading = false;
        const { list, page, total, append } = action.payload;
        if (append) {
          const seen = new Set(state.orders.map((o) => o.id));
          state.orders.push(...list.filter((o) => !seen.has(o.id)));
        } else {
          state.orders = list;
        }
        state.page = page;
        state.total = total;
      })
      .addCase(fetchOrders.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    for (const thunk of [acceptOrder, rejectOrder, updateOrderStatus]) {
      builder.addCase(thunk.fulfilled, (state, action) => {
        if (action.payload) upsert(state.orders, action.payload);
      });
    }
  },
});

export const { setStatusFilter, orderStatusPatched, orderReceived, resetOrders } = slice.actions;
export default slice.reducer;

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

/**
 * Support slice — tickets + disputes. Fleshed out in Phase 7.
 */

export const fetchTickets = createAsyncThunk(
  'support/fetchTickets',
  async (_, { rejectWithValue }) => {
    try {
      const envelope = await api.get('/support/tickets');
      return envelope?.data || [];
    } catch (err) {
      return rejectWithValue(err?.message || 'Failed to load tickets');
    }
  },
);

const initialState = {
  tickets: [],
  disputes: [],
  isLoading: false,
  error: null,
};

const slice = createSlice({
  name: 'support',
  initialState,
  reducers: {
    resetSupport: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTickets.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTickets.fulfilled, (state, action) => {
        state.isLoading = false;
        state.tickets = action.payload;
      })
      .addCase(fetchTickets.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export const { resetSupport } = slice.actions;
export default slice.reducer;

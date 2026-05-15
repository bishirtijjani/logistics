import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../lib/api'

// ============================================================
// Merchant — own tickets
// ============================================================

export const fetchMyTickets = createAsyncThunk(
  'supportTickets/fetchMine',
  async ({ status, page = 1, limit = 20 } = {}) => {
    const params = new URLSearchParams({
      page,
      limit,
      ...(status && { status }),
    })
    const response = await api.get(`/support/tickets?${params}`)
    return response.data
  },
)

export const createTicket = createAsyncThunk(
  'supportTickets/create',
  async ({ category, priority, subject, description, attachmentUrls = [] }) => {
    const response = await api.post('/support/tickets', {
      category,
      priority,
      subject,
      description,
      attachmentUrls,
    })
    return response.data.data
  },
)

export const fetchTicketDetail = createAsyncThunk(
  'supportTickets/fetchDetail',
  async (ticketId) => {
    const response = await api.get(`/support/tickets/${ticketId}`)
    return response.data.data
  },
)

export const postTicketMessage = createAsyncThunk(
  'supportTickets/postMessage',
  async ({ ticketId, body, attachmentUrls = [] }) => {
    const response = await api.post(`/support/tickets/${ticketId}/messages`, { body, attachmentUrls })
    return response.data.data
  },
)

export const closeTicket = createAsyncThunk(
  'supportTickets/close',
  async (ticketId) => {
    const response = await api.patch(`/support/tickets/${ticketId}/close`)
    return response.data.data
  },
)

const supportTicketsSlice = createSlice({
  name: 'supportTickets',
  initialState: {
    tickets: [],
    total: 0,
    page: 1,
    limit: 20,
    loading: false,
    error: null,
    selected: null,
    selectedLoading: false,
  },
  reducers: {
    clearSelectedTicket(state) {
      state.selected = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMyTickets.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchMyTickets.fulfilled, (state, action) => {
        state.loading = false
        state.tickets = action.payload?.data || []
        state.total = action.payload?.meta?.total || 0
        state.page = action.payload?.meta?.page || 1
        state.limit = action.payload?.meta?.limit || 20
      })
      .addCase(fetchMyTickets.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message
      })

      .addCase(createTicket.fulfilled, (state, action) => {
        if (action.payload) {
          state.tickets.unshift(action.payload)
          state.total += 1
        }
      })

      .addCase(fetchTicketDetail.pending, (state) => {
        state.selectedLoading = true
      })
      .addCase(fetchTicketDetail.fulfilled, (state, action) => {
        state.selectedLoading = false
        state.selected = action.payload
      })
      .addCase(fetchTicketDetail.rejected, (state) => {
        state.selectedLoading = false
      })

      .addCase(postTicketMessage.fulfilled, (state, action) => {
        if (state.selected && action.payload) {
          state.selected.messages = [...(state.selected.messages || []), action.payload]
          state.selected.lastActivityAt = action.payload.createdAt
        }
      })

      .addCase(closeTicket.fulfilled, (state, action) => {
        if (!action.payload) return
        const idx = state.tickets.findIndex((t) => t.id === action.payload.id)
        if (idx !== -1) state.tickets[idx] = { ...state.tickets[idx], ...action.payload }
        if (state.selected?.id === action.payload.id) {
          state.selected = { ...state.selected, ...action.payload }
        }
      })
  },
})

export const { clearSelectedTicket } = supportTicketsSlice.actions
export default supportTicketsSlice.reducer

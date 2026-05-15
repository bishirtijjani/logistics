import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../lib/api'

// ============================================================
// Support tickets — admin
// ============================================================

export const fetchTickets = createAsyncThunk(
  'supportTickets/fetchAll',
  async ({ status, category, priority, assignedToId, page = 1, limit = 20 } = {}) => {
    const params = new URLSearchParams({
      page,
      limit,
      ...(status && { status }),
      ...(category && { category }),
      ...(priority && { priority }),
      ...(assignedToId && { assignedToId }),
    })
    const response = await api.get(`/admin/support/tickets?${params}`)
    return response.data
  },
)

export const fetchTicketDetail = createAsyncThunk(
  'supportTickets/fetchDetail',
  async (ticketId) => {
    const response = await api.get(`/admin/support/tickets/${ticketId}`)
    return response.data.data
  },
)

export const updateTicketStatus = createAsyncThunk(
  'supportTickets/updateStatus',
  async ({ ticketId, status, notes }) => {
    const response = await api.patch(`/admin/support/tickets/${ticketId}/status`, { status, notes })
    return response.data.data
  },
)

export const assignTicket = createAsyncThunk(
  'supportTickets/assign',
  async ({ ticketId, assignedToId }) => {
    const response = await api.patch(`/admin/support/tickets/${ticketId}/assign`, { assignedToId })
    return response.data.data
  },
)

export const postTicketMessage = createAsyncThunk(
  'supportTickets/postMessage',
  async ({ ticketId, body, attachmentUrls = [], isInternal = false }) => {
    const response = await api.post(`/admin/support/tickets/${ticketId}/messages`, {
      body,
      attachmentUrls,
      isInternal,
    })
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
      .addCase(fetchTickets.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchTickets.fulfilled, (state, action) => {
        state.loading = false
        state.tickets = action.payload?.data || []
        state.total = action.payload?.meta?.total || 0
        state.page = action.payload?.meta?.page || 1
        state.limit = action.payload?.meta?.limit || 20
      })
      .addCase(fetchTickets.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message
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

      .addCase(updateTicketStatus.fulfilled, (state, action) => {
        if (!action.payload) return
        const idx = state.tickets.findIndex((t) => t.id === action.payload.id)
        if (idx !== -1) state.tickets[idx] = { ...state.tickets[idx], ...action.payload }
        if (state.selected?.id === action.payload.id) {
          state.selected = { ...state.selected, ...action.payload }
        }
      })
      .addCase(assignTicket.fulfilled, (state, action) => {
        if (!action.payload) return
        const idx = state.tickets.findIndex((t) => t.id === action.payload.id)
        if (idx !== -1) state.tickets[idx] = { ...state.tickets[idx], ...action.payload }
        if (state.selected?.id === action.payload.id) {
          state.selected = { ...state.selected, ...action.payload }
        }
      })

      .addCase(postTicketMessage.fulfilled, (state, action) => {
        if (state.selected && action.payload) {
          state.selected.messages = [...(state.selected.messages || []), action.payload]
          state.selected.lastActivityAt = action.payload.createdAt
        }
      })
  },
})

export const { clearSelectedTicket } = supportTicketsSlice.actions
export default supportTicketsSlice.reducer

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../lib/api'

// ============================================================
// Order chat - the same request_messages thread the rider and customer
// apps use (backend/src/modules/request/request.service.js), so a message
// sent from any of the three clients shows up in all of them.
// ============================================================

export const fetchMessages = createAsyncThunk(
  'chat/fetchMessages',
  async ({ requestId, before, limit = 50 }) => {
    const params = new URLSearchParams({ limit, ...(before && { before }) })
    const response = await api.get(`/requests/${requestId}/messages?${params}`)
    return { requestId, messages: response.data.data }
  },
)

export const sendMessage = createAsyncThunk(
  'chat/sendMessage',
  async ({ requestId, body }) => {
    const response = await api.post(`/requests/${requestId}/messages`, { body })
    return { requestId, message: response.data.data }
  },
)

const threadFor = (state, requestId) => {
  if (!state.byRequestId[requestId]) {
    state.byRequestId[requestId] = { messages: [], loading: false, sending: false, error: null }
  }
  return state.byRequestId[requestId]
}

const chatSlice = createSlice({
  name: 'chat',
  initialState: {
    byRequestId: {},
  },
  reducers: {
    // Pushed by trackingSocket's request:message:new listener while a chat
    // panel is open. De-duped by id against optimistic sendMessage results.
    messageReceived(state, action) {
      const { requestId, message } = action.payload || {}
      if (!requestId || !message?.id) return
      const thread = threadFor(state, requestId)
      const existingIdx = thread.messages.findIndex((m) => m.id === message.id)
      if (existingIdx === -1) thread.messages.push(message)
      else thread.messages[existingIdx] = message
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMessages.pending, (state, action) => {
        threadFor(state, action.meta.arg.requestId).loading = true
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        const { requestId, messages } = action.payload
        const thread = threadFor(state, requestId)
        thread.loading = false
        thread.messages = messages
        thread.error = null
      })
      .addCase(fetchMessages.rejected, (state, action) => {
        const thread = threadFor(state, action.meta.arg.requestId)
        thread.loading = false
        thread.error = action.error?.message || 'Failed to load messages'
      })
      .addCase(sendMessage.pending, (state, action) => {
        threadFor(state, action.meta.arg.requestId).sending = true
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        const { requestId, message } = action.payload
        const thread = threadFor(state, requestId)
        thread.sending = false
        if (message?.id) {
          const existingIdx = thread.messages.findIndex((m) => m.id === message.id)
          if (existingIdx === -1) thread.messages.push(message)
          else thread.messages[existingIdx] = message
        }
      })
      .addCase(sendMessage.rejected, (state, action) => {
        const thread = threadFor(state, action.meta.arg.requestId)
        thread.sending = false
        thread.error = action.error?.message || 'Failed to send message'
      })
  },
})

export const { messageReceived } = chatSlice.actions
export default chatSlice.reducer

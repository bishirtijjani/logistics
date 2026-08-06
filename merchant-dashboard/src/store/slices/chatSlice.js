import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../lib/api'

// ============================================================
// Order chat - private 1:1 threads sharing the request_messages backend
// (backend/src/modules/request/request.service.js) with the rider and
// customer apps. A merchant only ever has two channels per order:
// CUSTOMER_MERCHANT and RIDER_MERCHANT - never CUSTOMER_RIDER, which is
// private between the other two and never reaches the merchant at all.
// ============================================================

export const fetchMessages = createAsyncThunk(
  'chat/fetchMessages',
  async ({ requestId, channel, before, limit = 50 }) => {
    const params = new URLSearchParams({ channel, limit, ...(before && { before }) })
    const response = await api.get(`/requests/${requestId}/messages?${params}`)
    return { requestId, channel, messages: response.data.data }
  },
)

export const sendMessage = createAsyncThunk(
  'chat/sendMessage',
  async ({ requestId, channel, body }) => {
    const response = await api.post(`/requests/${requestId}/messages`, { channel, body })
    return { requestId, channel, message: response.data.data }
  },
)

const threadFor = (state, requestId, channel) => {
  if (!state.byRequestId[requestId]) state.byRequestId[requestId] = {}
  if (!state.byRequestId[requestId][channel]) {
    state.byRequestId[requestId][channel] = { messages: [], loading: false, sending: false, error: null }
  }
  return state.byRequestId[requestId][channel]
}

const chatSlice = createSlice({
  name: 'chat',
  initialState: {
    byRequestId: {},
  },
  reducers: {
    // Pushed by useWebSocket's request:message:new listener on the shared
    // page-level socket (delivery is to this merchant's personal room, not
    // a per-request room - see backend postMessage). De-duped by id
    // against optimistic sendMessage results.
    messageReceived(state, action) {
      const { requestId, channel, message } = action.payload || {}
      if (!requestId || !channel || !message?.id) return
      const thread = threadFor(state, requestId, channel)
      const existingIdx = thread.messages.findIndex((m) => m.id === message.id)
      if (existingIdx === -1) thread.messages.push(message)
      else thread.messages[existingIdx] = message
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMessages.pending, (state, action) => {
        threadFor(state, action.meta.arg.requestId, action.meta.arg.channel).loading = true
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        const { requestId, channel, messages } = action.payload
        const thread = threadFor(state, requestId, channel)
        thread.loading = false
        thread.messages = messages
        thread.error = null
      })
      .addCase(fetchMessages.rejected, (state, action) => {
        const thread = threadFor(state, action.meta.arg.requestId, action.meta.arg.channel)
        thread.loading = false
        thread.error = action.error?.message || 'Failed to load messages'
      })
      .addCase(sendMessage.pending, (state, action) => {
        threadFor(state, action.meta.arg.requestId, action.meta.arg.channel).sending = true
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        const { requestId, channel, message } = action.payload
        const thread = threadFor(state, requestId, channel)
        thread.sending = false
        if (message?.id) {
          const existingIdx = thread.messages.findIndex((m) => m.id === message.id)
          if (existingIdx === -1) thread.messages.push(message)
          else thread.messages[existingIdx] = message
        }
      })
      .addCase(sendMessage.rejected, (state, action) => {
        const thread = threadFor(state, action.meta.arg.requestId, action.meta.arg.channel)
        thread.sending = false
        thread.error = action.error?.message || 'Failed to send message'
      })
  },
})

export const { messageReceived } = chatSlice.actions
export default chatSlice.reducer

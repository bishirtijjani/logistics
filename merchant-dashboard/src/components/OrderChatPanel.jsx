import { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { X, Send, MessageSquare } from 'lucide-react'
import trackingSocket from '../services/trackingSocket'
import { fetchMessages, sendMessage, messageReceived } from '../store/slices/chatSlice.js'
import { showErrorToast } from '../utils/toast.js'

// In-app chat for a single request, shared with the rider and customer
// apps via backend/src/modules/request/request.service.js (listMessages /
// postMessage) - a message sent here shows up on their side too and vice
// versa. Rendered as a modal layered on top of OrderDetailsModal, mirroring
// the chat sheet pattern in mobile/rider-app/src/features/trip/ChatThread.js
// and mobile/customer-app's RequestTrackingScreen.
const ROLE_LABEL = {
  CUSTOMER: 'Customer',
  RIDER: 'Rider',
  MERCHANT: 'You',
  ADMIN: 'Support',
}

export default function OrderChatPanel({ requestId, onClose }) {
  const dispatch = useDispatch()
  const myUserId = useSelector((s) => s.auth.user?.id)
  const thread = useSelector((s) => s.chat.byRequestId[requestId])
  const messages = thread?.messages || []
  const loading = thread?.loading || false
  const sending = thread?.sending || false
  const [draft, setDraft] = useState('')
  const listRef = useRef(null)

  useEffect(() => {
    dispatch(fetchMessages({ requestId }))
    trackingSocket.joinRequestRoom(requestId)
    const unsubscribe = trackingSocket.onRequestMessageNew((data) => {
      if (data?.requestId === requestId) dispatch(messageReceived(data))
    })
    return () => {
      unsubscribe()
      trackingSocket.leaveRequestRoom(requestId)
    }
  }, [requestId, dispatch])

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages.length])

  const handleSend = async () => {
    const body = draft.trim()
    if (!body || sending) return
    setDraft('')
    const action = await dispatch(sendMessage({ requestId, body }))
    if (sendMessage.rejected.match(action)) {
      showErrorToast('Failed to send message')
      setDraft(body)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-[60]">
      <div className="bg-white dark:bg-dark-surface rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-lg w-full h-[85dvh] sm:h-[600px] flex flex-col">
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <MessageSquare className="w-5 h-5 text-primary shrink-0" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">Order chat</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Close chat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {loading && messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm">
              Loading messages...
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 gap-2">
              <MessageSquare className="w-10 h-10 opacity-40" />
              <p className="text-sm">No messages yet. Say hi.</p>
            </div>
          ) : (
            messages.map((m) => <Bubble key={m.id} message={m} myUserId={myUserId} />)
          )}
        </div>

        <div className="flex items-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700 shrink-0">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Write a message..."
            rows={1}
            className="flex-1 resize-none max-h-28 px-3 py-2 rounded-full border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim() || sending}
            className="p-2.5 rounded-full bg-primary text-white disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity shrink-0"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function Bubble({ message, myUserId }) {
  const isMine = message.fromUserId === myUserId
  const role = message.fromUser?.role
  const label = isMine ? null : ROLE_LABEL[role] || role

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-2 ${
          isMine
            ? 'bg-primary text-white rounded-br-md'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md'
        }`}
      >
        {!isMine && label ? (
          <p className="text-[11px] font-semibold opacity-70 mb-0.5">
            {label}
            {message.fromUser?.firstName ? ` · ${message.fromUser.firstName}` : ''}
          </p>
        ) : null}
        <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>
      </div>
    </div>
  )
}

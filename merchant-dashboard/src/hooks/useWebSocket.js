import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import { useDispatch } from 'react-redux'
import { API_URL } from '../lib/api'
import { fetchOrders } from '../store/slices/ordersSlice.js'
import { showSuccessToast } from '../utils/toast.js'

// The backend speaks Socket.io (backend/src/sockets/index.js), NOT raw
// WebSocket - so this MUST use socket.io-client to complete the Engine.IO
// handshake. Event names mirror backend/src/sockets/events.js, which is the
// server's source of truth. Merchant scoping is done via a room the client
// joins after connecting, not via the connection URL.
const EVENTS = {
  JOIN_MERCHANT_ROOM: 'merchant:room:join',
  LEAVE_MERCHANT_ROOM: 'merchant:room:leave',
  REQUEST_CREATED: 'request:created',
  REQUEST_STATUS_CHANGED: 'request:status:changed',
  NOTIFICATION_NEW: 'notification:new',
}

export function useWebSocket(merchantId) {
  const [isConnected, setIsConnected] = useState(false)
  // Seed as 'connecting' when we already have what we need to open a socket, so
  // the indicator shows yellow on mount instead of flashing red. Every later
  // transition is driven from socket event callbacks below (which the
  // set-state-in-effect rule allows), never synchronously in the effect body.
  const [connectionStatus, setConnectionStatus] = useState(() =>
    merchantId && localStorage.getItem('token') ? 'connecting' : 'disconnected'
  )
  const [lastMessage, setLastMessage] = useState(null)
  const socketRef = useRef(null)
  const dispatch = useDispatch()

  const playNotificationSound = useCallback(() => {
    try {
      const audio = new Audio('/notification-sound.mp3')
      audio.play().catch((error) => {
        console.log('Could not play notification sound:', error)
      })
    } catch (error) {
      console.log('Notification sound not available:', error)
    }
  }, [])

  const showBrowserNotification = useCallback((title, body) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'new-order',
        requireInteraction: true,
      })
    }
  }, [])

  useEffect(() => {
    if (!merchantId) return undefined

    const token = localStorage.getItem('token')
    if (!token) return undefined

    // API_URL is the REST base (e.g. https://api.iprime.ng in prod,
    // http://localhost:3000 in dev). Socket.io connects to the same origin
    // over its own /socket.io handshake - no custom path needed. Auth goes in
    // the handshake `auth` payload, where the server's middleware reads it.
    const socket = io(API_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setIsConnected(true)
      setConnectionStatus('connected')
      // Join the merchant room so the server can push REQUEST.CREATED here
      // when a new order comes in.
      socket.emit(EVENTS.JOIN_MERCHANT_ROOM, { merchantId })
    })

    // socket.io retries automatically; surface those attempts to the indicator.
    socket.io.on('reconnect_attempt', () => setConnectionStatus('reconnecting'))

    socket.on('disconnect', () => {
      setIsConnected(false)
      setConnectionStatus('disconnected')
    })

    socket.on('connect_error', (error) => {
      setConnectionStatus('error')
      console.error('Socket connection error:', error.message)
    })

    // New order placed against this merchant (sent to the merchant room).
    socket.on(EVENTS.REQUEST_CREATED, (order) => {
      setLastMessage({ type: EVENTS.REQUEST_CREATED, order })

      playNotificationSound()
      const amount =
        typeof order?.total === 'number' ? ` - ₦${order.total.toLocaleString()}` : ''
      showBrowserNotification('New Order', `New order received${amount}`)
      showSuccessToast('New order received!')

      dispatch(fetchOrders({ merchantId }))
    })

    // Status changes are emitted to the per-request room, which this list page
    // does not join - so this rarely fires here today. Kept so the list stays
    // fresh if/when the page starts joining request rooms.
    socket.on(EVENTS.REQUEST_STATUS_CHANGED, (data) => {
      setLastMessage({ type: EVENTS.REQUEST_STATUS_CHANGED, data })
      dispatch(fetchOrders({ merchantId }))
    })

    // Generic in-app notification routed to this user's personal room.
    socket.on(EVENTS.NOTIFICATION_NEW, (data) => {
      setLastMessage({ type: EVENTS.NOTIFICATION_NEW, data })
      if (data?.title) showSuccessToast(data.title)
    })

    return () => {
      socket.emit(EVENTS.LEAVE_MERCHANT_ROOM, { merchantId })
      socket.removeAllListeners()
      socket.disconnect()
      socketRef.current = null
      setIsConnected(false)
      setConnectionStatus('disconnected')
    }
  }, [merchantId, dispatch, playNotificationSound, showBrowserNotification])

  const reconnect = useCallback(() => {
    const socket = socketRef.current
    if (!socket) return
    setConnectionStatus('connecting')
    socket.connect()
  }, [])

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect()
  }, [])

  return {
    isConnected,
    connectionStatus,
    lastMessage,
    reconnect,
    disconnect,
  }
}

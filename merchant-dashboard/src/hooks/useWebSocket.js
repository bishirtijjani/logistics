import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import { useDispatch } from 'react-redux'
import { API_URL } from '../lib/api'
import { fetchOrders, orderStatusPatched } from '../store/slices/ordersSlice.js'
import { notificationReceived } from '../store/slices/notificationsSlice.js'
import { messageReceived } from '../store/slices/chatSlice.js'
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
  REQUEST_MESSAGE_NEW: 'request:message:new',
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

  // NB: this is the raw browser Notification API firing from an open tab -
  // not a real push notification (merchant-dashboard has no service worker /
  // push subscription, unlike the customer/rider PWAs' webPush.js). It only
  // works while this tab is open and connected. A unique `tag` per call is
  // required: a fixed tag makes every notification replace the last one
  // in-place, which combined with `requireInteraction` (each staying on
  // screen until dismissed) is what was tripping Chrome's "these
  // notifications look spammy" abuse warning once a few piled up.
  const showBrowserNotification = useCallback((title, body, tag) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: tag || `notification-${Date.now()}`,
        requireInteraction: true,
      })
    }
  }, [])

  useEffect(() => {
    if (!merchantId) return undefined

    const token = localStorage.getItem('token')
    if (!token) return undefined

    // API_URL is the REST base (e.g. https://api. in prod,
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
      showBrowserNotification('New Order', `New order received${amount}`, `order-${order?.requestId || Date.now()}`)
      showSuccessToast('New order received!')

      dispatch(fetchOrders({ merchantId }))
    })

    // Status changes are now fanned out to the merchant room too (see
    // backend emitStatusChanged), so this fires for every rider-driven step
    // (PICKED_UP → IN_TRANSIT → DELIVERED). Patch the single order in place
    // instead of refetching the whole list - keeps the merchant's current
    // filter/page and instantly updates both the row pill and an open order
    // modal (which reveals the live map once the status enters the trackable
    // window).
    socket.on(EVENTS.REQUEST_STATUS_CHANGED, (data) => {
      setLastMessage({ type: EVENTS.REQUEST_STATUS_CHANGED, data })
      dispatch(orderStatusPatched(data))
    })

    // Generic in-app notification routed to this user's personal room - feeds
    // the Notification Center list + bell badge (see NotificationBell.jsx /
    // NotificationsPage.jsx). New-order events already get the full sound +
    // browser-notification + toast treatment above via REQUEST_CREATED on
    // the merchant room, so skip the redundant second toast for those.
    socket.on(EVENTS.NOTIFICATION_NEW, (data) => {
      setLastMessage({ type: EVENTS.NOTIFICATION_NEW, data })
      dispatch(notificationReceived(data))
      if (data?.title && data?.type !== 'ORDER') showSuccessToast(data.title)
    })

    // Order chat - delivered straight to this merchant's personal socket
    // room (see backend postMessage), so this only ever fires for the two
    // channels the merchant is actually part of (CUSTOMER_MERCHANT,
    // RIDER_MERCHANT) - never the customer<->rider thread.
    socket.on(EVENTS.REQUEST_MESSAGE_NEW, (data) => {
      setLastMessage({ type: EVENTS.REQUEST_MESSAGE_NEW, data })
      dispatch(messageReceived(data))
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

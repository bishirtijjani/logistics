import { useState, useEffect, useRef, useCallback } from 'react'
import { useDispatch } from 'react-redux'
import { fetchOrders } from '../store/slices/ordersSlice.js'
import { showSuccessToast, showErrorToast } from '../utils/toast.js'

export function useWebSocket(merchantId) {
  const [isConnected, setIsConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [lastMessage, setLastMessage] = useState(null)
  const ws = useRef(null)
  const reconnectTimeoutRef = useRef(null)
  const heartbeatIntervalRef = useRef(null)
  const dispatch = useDispatch()

  const connect = useCallback(() => {
    if (!merchantId) return

    try {
      const token = localStorage.getItem('token')
      const wsUrl = `${process.env.REACT_APP_WS_URL || 'ws://localhost:8080'}/ws/merchant/${merchantId}?token=${token}`
      
      ws.current = new WebSocket(wsUrl)
      setConnectionStatus('connecting')

      ws.current.onopen = () => {
        setIsConnected(true)
        setConnectionStatus('connected')
        console.log('WebSocket connected')
        
        // Start heartbeat
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: 'ping' }))
          }
        }, 30000) // 30 seconds
      }

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          setLastMessage(data)
          
          switch (data.type) {
            case 'new_order':
              handleNewOrder(data.order)
              break
            case 'order_update':
              handleOrderUpdate(data.order)
              break
            case 'pong':
              // Heartbeat response
              break
            default:
              console.log('Unknown message type:', data.type)
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      ws.current.onclose = (event) => {
        setIsConnected(false)
        setConnectionStatus('disconnected')
        console.log('WebSocket disconnected:', event.code, event.reason)
        
        // Clear heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current)
        }

        // Attempt reconnection if not a normal closure
        if (event.code !== 1000) {
          scheduleReconnect()
        }
      }

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error)
        setConnectionStatus('error')
      }

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
      setConnectionStatus('error')
      scheduleReconnect()
    }
  }, [merchantId])

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }

    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000)
    setConnectionStatus('reconnecting')
    
    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectAttempts.current += 1
      connect()
    }, delay)
  }, [connect])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
    }

    if (ws.current) {
      ws.current.close(1000, 'User disconnected')
      ws.current = null
    }

    setIsConnected(false)
    setConnectionStatus('disconnected')
  }, [])

  const handleNewOrder = useCallback((order) => {
    // Play notification sound
    playNotificationSound()
    
    // Show browser notification
    showBrowserNotification('New Order', `Order #${order.id} received from ${order.customerName}`)
    
    // Show toast notification
    showSuccessToast(`New order #${order.id} received!`)
    
    // Refresh orders list
    dispatch(fetchOrders({ merchantId }))
  }, [dispatch, merchantId])

  const handleOrderUpdate = useCallback((order) => {
    // Show toast notification for order updates
    showSuccessToast(`Order #${order.id} updated to ${order.status}`)
    
    // Refresh orders list
    dispatch(fetchOrders({ merchantId }))
  }, [dispatch, merchantId])

  const playNotificationSound = useCallback(() => {
    try {
      const audio = new Audio('/notification-sound.mp3')
      audio.play().catch(error => {
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
        requireInteraction: true
      })
    }
  }, [])

  const reconnectAttempts = useRef(0)

  useEffect(() => {
    if (merchantId) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [merchantId, connect, disconnect])

  // Reset reconnect attempts on successful connection
  useEffect(() => {
    if (isConnected) {
      reconnectAttempts.current = 0
    }
  }, [isConnected])

  return {
    isConnected,
    connectionStatus,
    lastMessage,
    connect,
    disconnect,
    reconnect: () => {
      reconnectAttempts.current = 0
      disconnect()
      setTimeout(connect, 1000)
    }
  }
}

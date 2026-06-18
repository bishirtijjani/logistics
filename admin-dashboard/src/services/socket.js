import { io } from 'socket.io-client'
import { API_URL } from '../lib/api'

// Same Socket.io server the mobile apps connect to. The admin dashboard only
// cares about broadcast-style events (merchant status, etc.) - it never
// joins per-request rooms.
class AdminSocketService {
  constructor() {
    this.socket = null
    this.eventHandlers = new Map()
  }

  connect() {
    if (this.socket?.connected) return
    const token = localStorage.getItem('accessToken')
    if (!token) return

    this.socket = io(API_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelayMax: 5000,
    })

    this.socket.on('merchant:status:changed', (data) => this.emit('merchantStatusChanged', data))
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  onMerchantStatusChanged(cb) {
    return this.on('merchantStatusChanged', cb)
  }

  on(event, callback) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    this.eventHandlers.get(event).add(callback)
    return () => this.eventHandlers.get(event)?.delete(callback)
  }

  emit(event, data) {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.forEach((cb) => {
        try { cb(data) } catch (err) { console.error('[AdminSocket]', event, err) }
      })
    }
  }
}

export default new AdminSocketService()

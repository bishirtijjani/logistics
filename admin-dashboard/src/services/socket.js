import { io } from 'socket.io-client'
import { API_URL } from '../lib/api'

// Same Socket.io server the mobile apps connect to. The admin dashboard
// listens to broadcast-style events (merchant status, etc.) and can join
// per-request rooms on demand so the requests console can watch a rider
// move in real time (backend/src/sockets/handlers/request.handler.js).
class AdminSocketService {
  constructor() {
    this.socket = null
    this.eventHandlers = new Map()
    // Rooms we should be in - re-joined after every (re)connect, since
    // Socket.io drops room membership when the connection drops.
    this.requestRooms = new Set()
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

    this.socket.on('connect', () => {
      this.requestRooms.forEach((requestId) => {
        this.socket.emit('request:room:join', { requestId })
      })
    })

    this.socket.on('merchant:status:changed', (data) => this.emit('merchantStatusChanged', data))
    this.socket.on('merchant:resubmitted', (data) => this.emit('merchantResubmitted', data))

    // Per-request tracking events (only arrive for rooms we've joined).
    // Riders broadcast on rider:location:broadcast every ~3s; some server
    // paths use request:rider:location - normalise both to one handler,
    // mirroring the customer app's socket service.
    this.socket.on('request:rider:location', (data) => this.emit('requestRiderLocation', data))
    this.socket.on('rider:location:broadcast', (data) => this.emit('requestRiderLocation', data))
    this.socket.on('request:rider:eta', (data) => this.emit('requestRiderEta', data))
    this.socket.on('request:status:changed', (data) => this.emit('requestStatusChanged', data))
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.requestRooms.clear()
  }

  joinRequestRoom(requestId) {
    if (!requestId) return
    this.requestRooms.add(requestId)
    if (this.socket?.connected) this.socket.emit('request:room:join', { requestId })
  }

  leaveRequestRoom(requestId) {
    if (!requestId) return
    this.requestRooms.delete(requestId)
    if (this.socket?.connected) this.socket.emit('request:room:leave', { requestId })
  }

  onMerchantStatusChanged(cb) {
    return this.on('merchantStatusChanged', cb)
  }

  onMerchantResubmitted(cb) {
    return this.on('merchantResubmitted', cb)
  }

  onRequestRiderLocation(cb) {
    return this.on('requestRiderLocation', cb)
  }

  onRequestRiderEta(cb) {
    return this.on('requestRiderEta', cb)
  }

  onRequestStatusChanged(cb) {
    return this.on('requestStatusChanged', cb)
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

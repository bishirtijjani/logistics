import { io } from 'socket.io-client'
import { API_URL } from '../lib/api'

// Dedicated Socket.io connection for per-request live tracking (the order
// details map) and the order chat panel. Kept separate from useWebSocket's
// page-scoped socket so the modal can join/leave request rooms without
// touching the merchant-room notification plumbing. Connects lazily when the
// first room is joined and tears down once the last room is left, so it
// costs nothing while no tracking map / chat panel is open.
//
// Event names mirror backend/src/sockets/events.js; rider positions arrive on
// rider:location:broadcast every ~3s (request:rider:location is the alias
// some server paths use - both are normalised to one handler, the same way
// the customer app's socket service does it).
class TrackingSocketService {
  constructor() {
    this.socket = null
    this.eventHandlers = new Map()
    // Ref-counted rooms we should be in - re-joined after every (re)connect,
    // since Socket.io drops room membership when the connection drops. A
    // plain Set isn't enough here: the tracking map and the chat panel can
    // both have the same request room open at once, and if one unmounts
    // first a Set-based leave would evict the room out from under the other.
    this.requestRoomRefCounts = new Map()
  }

  connect() {
    if (this.socket) return
    const token = localStorage.getItem('token')
    if (!token) return

    this.socket = io(API_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelayMax: 5000,
    })

    this.socket.on('connect', () => {
      this.requestRoomRefCounts.forEach((_count, requestId) => {
        this.socket.emit('request:room:join', { requestId })
      })
    })

    this.socket.on('request:rider:location', (data) => this.emit('requestRiderLocation', data))
    this.socket.on('rider:location:broadcast', (data) => this.emit('requestRiderLocation', data))
    this.socket.on('request:rider:eta', (data) => this.emit('requestRiderEta', data))
    this.socket.on('request:status:changed', (data) => this.emit('requestStatusChanged', data))
    this.socket.on('request:message:new', (data) => this.emit('requestMessageNew', data))
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  joinRequestRoom(requestId) {
    if (!requestId) return
    const count = this.requestRoomRefCounts.get(requestId) || 0
    this.requestRoomRefCounts.set(requestId, count + 1)
    this.connect()
    if (count === 0 && this.socket?.connected) this.socket.emit('request:room:join', { requestId })
  }

  leaveRequestRoom(requestId) {
    if (!requestId) return
    const count = this.requestRoomRefCounts.get(requestId)
    if (!count) return
    if (count <= 1) {
      this.requestRoomRefCounts.delete(requestId)
      if (this.socket?.connected) this.socket.emit('request:room:leave', { requestId })
    } else {
      this.requestRoomRefCounts.set(requestId, count - 1)
    }
    if (this.requestRoomRefCounts.size === 0) this.disconnect()
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

  onRequestMessageNew(cb) {
    return this.on('requestMessageNew', cb)
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
        try { cb(data) } catch (err) { console.error('[TrackingSocket]', event, err) }
      })
    }
  }
}

export default new TrackingSocketService()

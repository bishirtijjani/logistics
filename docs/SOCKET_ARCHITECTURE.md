# Socket.io Architecture

## Connection

### Authentication
Clients authenticate during the Socket.io handshake by passing a JWT access token:

```javascript
const socket = io('https://api.example.com', {
  auth: { token: 'eyJhbGci...' },
});
```

The server verifies the token and attaches user data to the socket instance. Invalid or expired tokens receive an `auth_error` event and are disconnected.

### Automatic Room Assignment
On successful connection:
- **All users** join their personal room: `user:{userId}`
- **Riders** also join: `riders:available`
- **Merchants** also join: `merchant:{merchantId}` (handled server-side on connect)

---

## Event Reference

### Connection Events

| Event | Direction | Payload | Description |
|---|---|---|---|
| `connection` | Client → Server | — | Socket connected |
| `disconnect` | Client → Server | `reason: string` | Socket disconnected |
| `auth_error` | Server → Client | `{ message: string }` | Authentication failed |

### Rider Tracking Events

| Event | Direction | Payload | Description |
|---|---|---|---|
| `rider:location:update` | Rider → Server | `{ lat: number, lng: number, requestId?: string }` | Rider sends GPS position (~every 3s) |
| `rider:location:broadcast` | Server → Request Room | `{ riderId: string, lat: number, lng: number, timestamp: number }` | Rider position forwarded to customer |
| `rider:availability:changed` | Rider → Server | `{ availability: 'ONLINE' \| 'OFFLINE' }` | Rider goes online/offline |

### Rider Job Events

| Event | Direction | Payload | Description |
|---|---|---|---|
| `rider:job:new` | Server → Rider Pool | `{ requestId, pickupAddress, dropoffAddress, distanceKm, fare, pickupLat, pickupLng, timeout: 60 }` | New request job broadcast |
| `rider:job:accept` | Rider → Server | `{ requestId: string }` | Rider accepts the job |
| `rider:job:reject` | Rider → Server | `{ requestId: string }` | Rider declines the job |
| `rider:job:confirmed` | Server → Rider | `{ requestId, pickupAddress, pickupLat, pickupLng, customerPhone }` | Job acceptance confirmed |
| `rider:job:taken` | Server → Other Riders | `{ requestId: string }` | Job was taken by another rider |

### Request Lifecycle Events (Primary)

These are the canonical events for all request types (food, grocery, pharmacy, package).

| Event | Direction | Payload | Description |
|---|---|---|---|
| `request:created` | Server → Merchant | `{ requestId, type, status, items }` | New order received by merchant |
| `request:status:changed` | Server → All parties | `{ requestId, status, timestamp, metadata? }` | Unified status update |
| `request:merchant:accepted` | Server → Customer | `{ merchantId, merchantName, estimatedReadyTime }` | Merchant accepted the order |
| `request:merchant:ready` | Server → System | `{ requestId }` | Item ready for rider pickup |
| `request:rider:assigned` | Server → All | `{ riderId, name, phone, vehicle, plateNumber, rating, eta }` | Rider matched |
| `request:rider:location` | Server → Request Room | `{ riderId, lat, lng, timestamp }` | Live rider tracking |
| `request:completed` | Server → All parties | `{ requestId, fare, settlement, timestamp }` | Request completed and settled |
| `request:cancelled` | Server → All parties | `{ requestId, reason, cancelledBy, timestamp }` | Request cancelled |
| `request:room:join` | Client → Server | `{ requestId: string }` | Join request tracking room |
| `request:room:leave` | Client → Server | `{ requestId: string }` | Leave request tracking room |

### Delivery Events (Legacy — Package Delivery Only)

Kept for backward compatibility during migration. New code should use `request:*` events.

| Event | Direction | Payload | Description |
|---|---|---|---|
| `delivery:status:changed` | Server → Delivery Room | `{ orderId, status, timestamp }` | Status changed |
| `delivery:rider:assigned` | Server → Customer | `{ orderId, rider info }` | Rider assigned |
| `delivery:completed` | Server → Delivery Room | `{ orderId, fare, timestamp }` | Delivery completed |
| `delivery:cancelled` | Server → Delivery Room | `{ orderId, reason, cancelledBy, timestamp }` | Delivery cancelled |
| `delivery:room:join` | Client → Server | `{ orderId: string }` | Join legacy delivery room |
| `delivery:room:leave` | Client → Server | `{ orderId: string }` | Leave legacy delivery room |

### Wallet Events

| Event | Direction | Payload | Description |
|---|---|---|---|
| `wallet:balance:updated` | Server → User Room | `{ balance, transaction: { type, amount, description }, timestamp }` | Balance changed |
| `wallet:transfer:received` | Server → Recipient Room | `{ amount, senderName, timestamp }` | Incoming P2P transfer |

### Notification Events

| Event | Direction | Payload | Description |
|---|---|---|---|
| `notification:new` | Server → User Room | `{ id, title, body, type, data, timestamp }` | Generic in-app notification |

---

## Room Strategy

| Room Name | Who Joins | Purpose |
|---|---|---|
| `user:{userId}` | Individual user (auto on connect) | Wallet updates, notifications, personal events |
| `riders:available` | All online riders (auto on connect if role=RIDER) | Broadcasting new job requests |
| `merchant:{merchantId}` | Merchant dashboard (auto on connect if role=MERCHANT) | New orders, merchant-specific events |
| `request:{requestId}` | Customer + assigned rider + merchant (manual join) | Request tracking, status updates, rider location |
| `delivery:{orderId}` | Customer + assigned rider — legacy (manual join) | Legacy package delivery tracking |

### Room Lifecycle

1. **Connection** → user auto-joins `user:{userId}`, riders join `riders:available`, merchants join `merchant:{merchantId}`
2. **Order matched** → customer, rider, and merchant emit `request:room:join`
3. **During request** → rider's location broadcasts to `request:{requestId}` room
4. **Request complete/cancel** → all parties emit `request:room:leave`
5. **Disconnect** → auto-removed from all rooms

---

## Reconnection Handling

Clients should implement exponential backoff reconnection:

```javascript
const socket = io(SERVER_URL, {
  auth: { token },
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,      // Start at 1s
  reconnectionDelayMax: 30000,  // Max 30s
});

socket.on('connect', () => {
  // Re-join any active request rooms
  if (activeRequestId) {
    socket.emit('request:room:join', { requestId: activeRequestId });
  }
});
```

### On Reconnect
- Personal room (`user:{userId}`) is auto-rejoined via auth
- Request rooms must be explicitly re-joined by the client
- Rider availability should be re-synced with the server on connect

---

## Data Flow: Location Tracking

```
Rider App (every 3s)
    │
    ▼
rider:location:update { lat, lng, requestId }
    │
    ▼
Socket Server
    ├── Write to Redis: rider:location:{riderId} (TTL: 30s)
    └── Broadcast to request:{requestId} room
              │
              ▼
        request:rider:location { riderId, lat, lng, timestamp }
              │
              ▼
        Customer App (updates map marker)
```

---

## Error Handling

- **Invalid payloads** are silently ignored (no crash, no error event)
- **Expired tokens** trigger `auth_error` event and disconnect
- **Rate limiting**: location updates capped at max 1 per second per rider
- **Failed Redis writes** are logged but do not crash the socket connection

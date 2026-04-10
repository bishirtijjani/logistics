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
| `rider:location:update` | Rider → Server | `{ lat: number, lng: number, orderId?: string }` | Rider sends GPS position (~every 3s) |
| `rider:location:broadcast` | Server → Delivery Room | `{ riderId: string, lat: number, lng: number, timestamp: number }` | Rider position forwarded to customer |
| `rider:availability:changed` | Rider → Server | `{ availability: 'ONLINE' \| 'OFFLINE' }` | Rider goes online/offline |

### Rider Job Events

| Event | Direction | Payload | Description |
|---|---|---|---|
| `rider:job:new` | Server → Rider Pool | `{ orderId, pickupAddress, dropoffAddress, distanceKm, fare, pickupLat, pickupLng, timeout: 60 }` | New delivery job broadcast |
| `rider:job:accept` | Rider → Server | `{ orderId: string }` | Rider accepts the job |
| `rider:job:reject` | Rider → Server | `{ orderId: string }` | Rider declines the job |
| `rider:job:confirmed` | Server → Rider | `{ orderId, pickupAddress, pickupLat, pickupLng, customerPhone }` | Job acceptance confirmed |
| `rider:job:taken` | Server → Other Riders | `{ orderId: string }` | Job was taken by another rider |

### Delivery Lifecycle Events

| Event | Direction | Payload | Description |
|---|---|---|---|
| `delivery:room:join` | Client → Server | `{ orderId: string }` | Join delivery tracking room |
| `delivery:room:leave` | Client → Server | `{ orderId: string }` | Leave delivery tracking room |
| `delivery:status:changed` | Server → Delivery Room | `{ orderId, status, timestamp, metadata? }` | Delivery status changed |
| `delivery:rider:assigned` | Server → Customer | `{ orderId, rider: { id, firstName, phone, vehicleType, plateNumber, rating } }` | Rider assigned to order |
| `delivery:completed` | Server → Delivery Room | `{ orderId, fare, timestamp }` | Delivery completed |
| `delivery:cancelled` | Server → Delivery Room | `{ orderId, reason, cancelledBy, timestamp }` | Delivery cancelled |

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
| `riders:available` | All online riders (auto on connect if role=RIDER) | Broadcasting new delivery jobs |
| `delivery:{orderId}` | Customer + assigned rider (manual join) | Delivery tracking, status updates, rider location |

### Room Lifecycle

1. **Connection** → user auto-joins `user:{userId}` and optionally `riders:available`
2. **Order matched** → both customer and rider emit `delivery:room:join`
3. **During delivery** → rider's location broadcasts to `delivery:{orderId}` room
4. **Delivery complete/cancel** → both emit `delivery:room:leave`
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
  // Re-join any active delivery rooms
  if (activeDeliveryId) {
    socket.emit('delivery:room:join', { orderId: activeDeliveryId });
  }
});
```

### On Reconnect
- Personal room (`user:{userId}`) is auto-rejoined via auth
- Delivery rooms must be explicitly re-joined by the client
- Rider availability should be re-synced with the server exit

---

## Data Flow: Location Tracking

```
Rider App (every 3s)
    │
    ▼
rider:location:update { lat, lng, orderId }
    │
    ▼
Socket Server
    ├── Write to Redis: rider:location:{riderId} (TTL: 30s)
    └── Broadcast to delivery:{orderId} room
              │
              ▼
        rider:location:broadcast { riderId, lat, lng, timestamp }
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

# API Contract

> Base URL: `/api`
> All responses follow the standard envelope format.

---

## Standard Response Envelope

### Success
```json
{
  "success": true,
  "message": "Operation description",
  "data": { },
  "meta": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 }
}
```

### Error
```json
{
  "success": false,
  "message": "Error description",
  "data": null,
  "errors": [
    { "field": "phone", "message": "Invalid Nigerian phone number" }
  ]
}
```

---

## Authentication

### POST `/auth/register`
Register a new user (customer or rider).

**Body:**
```json
{
  "phone": "08012345678",
  "firstName": "Bishir",
  "lastName": "Tijjani",
  "email": "bishir@example.com",
  "password": "securepass123",
  "role": "CUSTOMER"
}
```

**Response:** `201`
```json
{ "id": "uuid", "phone": "08012345678", "role": "CUSTOMER" }
```

### POST `/auth/login`
**Body:** `{ "phone": "08012345678", "password": "securepass123" }`

**Response:** `200`
```json
{
  "user": { "id": "uuid", "phone": "...", "firstName": "...", "role": "CUSTOMER", "status": "ACTIVE" },
  "tokens": { "accessToken": "jwt...", "refreshToken": "jwt..." }
}
```

### POST `/auth/refresh`
**Body:** `{ "refreshToken": "jwt..." }`
**Response:** `200` — new `{ accessToken, refreshToken }`

### POST `/auth/pin` 🔒
**Body:** `{ "pin": "123456" }`
**Response:** `200`

### POST `/auth/logout` 🔒
**Body:** `{ "refreshToken": "jwt..." }`
**Response:** `200`

---

## Wallet

> 🔒 All wallet routes require authentication.

### GET `/wallet` 🔒
Get wallet balance and virtual account info.

**Response:** `200`
```json
{
  "id": "uuid",
  "balance": "5000.00",
  "virtualAccountNumber": "8012345678",
  "virtualAccountBank": "Wema Bank",
  "virtualAccountName": "VTU-Bishir Tijjani",
  "isLocked": false
}
```

### POST `/wallet/transfer` 🔒 🔐
Transfer to another user. Requires transaction PIN.

**Body:**
```json
{
  "recipientPhone": "08098765432",
  "amount": 1000,
  "description": "Thanks bro",
  "pin": "123456"
}
```

**Response:** `200`
```json
{
  "transactionRef": "P2P-uuid",
  "amount": 1000,
  "recipientPhone": "08098765432",
  "newBalance": 4000
}
```

### GET `/wallet/transactions` 🔒
Get paginated transaction history.

**Query params:** `page`, `limit`, `type`, `startDate`, `endDate`

**Response:** `200` — paginated list of transactions

---

## Delivery

> 🔒 All delivery routes require authentication.

### GET `/delivery/estimate`
Estimate delivery fare before creating an order.

**Query params:** `pickupLat`, `pickupLng`, `dropoffLat`, `dropoffLng`

**Response:** `200`
```json
{
  "distanceKm": 5.2,
  "fare": 720,
  "platformFee": 72,
  "totalCharge": 720,
  "riderEarning": 648
}
```

### POST `/delivery/orders` 🔒 (CUSTOMER only)
Create a delivery order.

**Body:**
```json
{
  "pickupAddress": "No. 5 Kofar Marusa, Katsina",
  "pickupLat": 13.0059,
  "pickupLng": 7.6017,
  "dropoffAddress": "GRA, Katsina",
  "dropoffLat": 13.0123,
  "dropoffLng": 7.6089,
  "itemDescription": "Documents",
  "packageSize": "small"
}
```

**Response:** `201` — full `DeliveryOrder` object

### GET `/delivery/orders` 🔒
List orders (customers see theirs, riders see theirs).

**Query params:** `page`, `limit`, `status`

### GET `/delivery/orders/:orderId` 🔒
Get single order details.

### PATCH `/delivery/orders/:orderId/status` 🔒 (RIDER/ADMIN)
Update delivery status.

**Body:** `{ "status": "PICKED_UP" }`

### POST `/delivery/orders/:orderId/rate` 🔒 (CUSTOMER)
Rate a completed delivery.

**Body:** `{ "score": 5, "comment": "Fast delivery!" }`

---

## Utilities

> 🔒 CUSTOMER only. All require transaction PIN.

### POST `/utilities/airtime` 🔒 🔐
```json
{
  "phone": "08012345678",
  "amount": 500,
  "provider": "MTN",
  "pin": "123456"
}
```

### POST `/utilities/data` 🔒 🔐
```json
{
  "phone": "08012345678",
  "provider": "MTN",
  "planCode": "mtn-data-500",
  "amount": 500,
  "pin": "123456"
}
```

### POST `/utilities/electricity` 🔒 🔐
```json
{
  "meterNumber": "12345678901",
  "disco": "AEDC",
  "meterType": "prepaid",
  "amount": 5000,
  "pin": "123456"
}
```

### GET `/utilities/history` 🔒
Bill payment history. **Query:** `page`, `limit`, `type`

---

## Rider

> 🔒 Authentication required.

### POST `/rider/register` 🔒
Apply to become a rider.

**Body:**
```json
{
  "vehicleType": "MOTORCYCLE",
  "plateNumber": "KAT-123-AB",
  "vehicleColor": "Red",
  "ninNumber": "12345678901"
}
```

### GET `/rider/profile` 🔒 (RIDER)
### PATCH `/rider/availability` 🔒 (RIDER)
**Body:** `{ "availability": "ONLINE" }`

### POST `/rider/location` 🔒 (RIDER)
**Body:** `{ "lat": 13.0059, "lng": 7.6017 }`

### POST `/rider/accept` 🔒 (RIDER)
**Body:** `{ "orderId": "uuid" }`

### GET `/rider/earnings` 🔒 (RIDER)

---

## Admin

> 🔒 ADMIN role only.

### GET `/admin/dashboard`
### GET `/admin/riders/pending`
### PATCH `/admin/riders/:riderId/review`
**Body:** `{ "decision": "approve" }` or `{ "decision": "reject" }`

### PATCH `/admin/users/:userId/status`
**Body:** `{ "status": "SUSPENDED" }`

### GET `/admin/transactions`
**Query:** `page`, `limit`, `type`, `status`

---

## Webhooks

> No JWT auth. Verified via provider-specific mechanisms.

### POST `/webhooks/monnify`
Receives wallet funding confirmation from Monnify. Verified via HMAC-SHA512 signature in `monnify-signature` header.

### POST `/webhooks/vtpass`
Receives utility payment status updates from VTPass.

---

## Legend
- 🔒 Requires JWT authentication (`Authorization: Bearer <token>`)
- 🔐 Requires transaction PIN in request body

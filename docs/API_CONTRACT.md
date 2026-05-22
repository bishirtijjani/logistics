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

## Legend
- 🔒 Requires JWT authentication (`Authorization: Bearer <token>`)
- 🔐 Requires transaction PIN in request body
- 👤 CUSTOMER role only
- 🛵 RIDER role only
- 🏪 MERCHANT role only
- 🔑 ADMIN role only

---

## Authentication — `/auth`

### POST `/auth/register`
Register a new customer or rider account.

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

### POST `/auth/merchant/register`
Register a new merchant account.

**Body:**
```json
{
  "phone": "08012345678",
  "businessName": "Mama Turai Kitchen",
  "businessType": "RESTAURANT",
  "email": "kitchen@example.com",
  "password": "securepass123"
}
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

### POST `/auth/otp/send`
Send OTP to a phone number.

**Body:** `{ "phone": "08012345678" }`

### POST `/auth/otp/verify`
Verify OTP code.

**Body:** `{ "phone": "08012345678", "code": "123456" }`

### POST `/auth/refresh`
**Body:** `{ "refreshToken": "jwt..." }`

**Response:** `200` — `{ "accessToken": "jwt...", "refreshToken": "jwt..." }`

### POST `/auth/password/forgot`
**Body:** `{ "phone": "08012345678" }`

### POST `/auth/password/reset`
**Body:** `{ "phone": "08012345678", "code": "123456", "newPassword": "newpass123" }`

### POST `/auth/pin` 🔒
Set transaction PIN.

**Body:** `{ "pin": "123456" }`

### POST `/auth/pin/change` 🔒
**Body:** `{ "currentPin": "123456", "newPin": "654321" }`

### GET `/auth/profile` 🔒
Get authenticated user's profile.

### PATCH `/auth/profile` 🔒
Update profile fields (firstName, lastName, email, etc.).

### PUT `/auth/profile/picture` 🔒
Upload profile picture via Cloudinary.

### POST `/auth/kyc/verify-bvn` 🔒
Initiate BVN verification.

**Body:** `{ "bvn": "12345678901" }`

### POST `/auth/fcm-token` 🔒
Register Firebase push notification token.

**Body:** `{ "fcmToken": "firebase-token..." }`

### GET `/auth/notification-preferences` 🔒
### PATCH `/auth/notification-preferences` 🔒

### POST `/auth/upload-signature` 🔒
Get Cloudinary signed upload parameters for client-side uploads.

### GET `/auth/sessions` 🔒
List active sessions.

### DELETE `/auth/sessions/others` 🔒
Revoke all sessions except current.

### DELETE `/auth/sessions/:sessionId` 🔒

### POST `/auth/phone/request-change` 🔒
### POST `/auth/phone/confirm-change` 🔒

### POST `/auth/logout` 🔒
**Body:** `{ "refreshToken": "jwt..." }`

### DELETE `/auth/account` 🔒
Delete account permanently.

---

## Wallet — `/wallet`

> Most wallet routes require authentication. `GET /banks` is public.

### GET `/wallet/banks`
List of supported Nigerian banks (for withdrawal account picker). No auth required.

### GET `/wallet` 🔒
Get wallet balance and virtual account details.

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

### POST `/wallet/transfer` 🔒 🔐 👤🛵
Transfer to another user. Idempotent (use `Idempotency-Key` header).

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

### POST `/wallet/withdraw` 🔒 🔐 👤🛵
Withdraw to bank account via KatPay.

**Body:**
```json
{
  "amount": 2000,
  "bankCode": "044",
  "accountNumber": "0123456789",
  "pin": "123456"
}
```

### POST `/wallet/fund` 🔒
Initiate ad-hoc top-up via KatPay transfer link.

**Response:** `200` — `{ "paymentLink": "https://...", "uuid": "..." }`

### GET `/wallet/fund/:uuid` 🔒
Poll KatPay transfer payment status.

### POST `/wallet/banks/lookup` 🔒
Verify bank account name before withdrawal.

**Body:** `{ "bankCode": "044", "accountNumber": "0123456789" }`

**Response:** `200` — `{ "accountName": "Bishir Tijjani" }`

### GET `/wallet/transactions` 🔒
Paginated transaction history.

**Query:** `page`, `limit`, `type` (`CREDIT`|`DEBIT`), `startDate`, `endDate`

### GET `/wallet/transactions/:id/receipt` 🔒
Get printable receipt for a transaction.

### GET `/wallet/beneficiaries` 🔒
### POST `/wallet/beneficiaries` 🔒
### DELETE `/wallet/beneficiaries/:id` 🔒

---

## Requests — `/requests`

The unified endpoint for all request types: `FOOD`, `GROCERY`, `PHARMACY`, `PACKAGE`.

> 🔒 All routes require authentication.

### GET `/requests/quote`
Get a pricing estimate before creating a request.

**Query:** `pickupLat`, `pickupLng`, `dropoffLat`, `dropoffLng`, `type`

**Response:** `200`
```json
{
  "distanceKm": 5.2,
  "fare": 720,
  "platformFee": 72,
  "totalCharge": 720,
  "riderEarning": 576,
  "merchantEarning": null
}
```

### POST `/requests` 🔒 👤
Create a new request.

**Body (PACKAGE):**
```json
{
  "type": "PACKAGE",
  "pickupAddress": "No. 5 Kofar Marusa, Katsina",
  "pickupLat": 13.0059,
  "pickupLng": 7.6017,
  "dropoffAddress": "GRA, Katsina",
  "dropoffLat": 13.0123,
  "dropoffLng": 7.6089,
  "packageDetails": {
    "itemDescription": "Documents",
    "packageSize": "SMALL",
    "recipientName": "Amina Musa",
    "recipientPhone": "08023456789"
  },
  "pin": "123456"
}
```

**Body (FOOD / GROCERY / PHARMACY):**
```json
{
  "type": "FOOD",
  "merchantId": "uuid",
  "pickupAddress": "Mama Turai Kitchen, Katsina",
  "pickupLat": 13.0070,
  "pickupLng": 7.6030,
  "dropoffAddress": "GRA, Katsina",
  "dropoffLat": 13.0123,
  "dropoffLng": 7.6089,
  "items": [
    { "productId": "uuid", "quantity": 2 }
  ],
  "notes": "Extra spicy please",
  "pin": "123456"
}
```

**Response:** `201` — full `Request` object

### GET `/requests` 🔒
List requests. Customers see theirs, riders see theirs, merchants see theirs.

**Query:** `page`, `limit`, `status`, `type`

### GET `/requests/admin/all` 🔒 🔑
All requests with advanced filtering.

**Query:** `page`, `limit`, `status`, `type`, `customerId`, `riderId`, `merchantId`, `startDate`, `endDate`

### GET `/requests/:requestId` 🔒
Get single request with full details.

### PATCH `/requests/:requestId/status` 🔒 🏪🛵🔑
Update request status. Role determines which transitions are allowed:

| Role | Allowed transitions |
|---|---|
| `MERCHANT` | `ACCEPTED`, `PROCESSING`, `READY_FOR_PICKUP` |
| `RIDER` | `RIDER_EN_ROUTE`, `PICKED_UP`, `IN_TRANSIT`, `DELIVERED` |
| `ADMIN` | Any transition |

**Body:** `{ "status": "ACCEPTED" }`

### PATCH `/requests/:requestId/admin-status` 🔒 🔑
Admin-only status override with reason.

**Body:** `{ "status": "CANCELLED", "reason": "Rider not responding" }`

### PATCH `/requests/:requestId/reassign-rider` 🔒 🔑
Reassign a different rider to the request.

**Body:** `{ "riderId": "uuid" }`

### PATCH `/requests/:requestId/force-cancel` 🔒 🔑
Force-cancel a request with admin reason.

**Body:** `{ "reason": "Customer unreachable" }`

### DELETE `/requests/:requestId` 🔒 👤
Cancel a request (customer only, before rider pickup).

**Body:** `{ "reason": "Changed my mind" }`

### POST `/requests/:requestId/rate` 🔒 👤
Rate a completed request.

**Body:** `{ "score": 5, "comment": "Fast and polite!" }`

---

## Merchants — `/merchants`

> 🔒 All routes require authentication.

### GET `/merchants`
Browse merchants with filters.

**Query:** `page`, `limit`, `type` (`RESTAURANT`|`SUPERMARKET`|`PHARMACY`), `search`, `lat`, `lng`, `radius`

### GET `/merchants/:merchantId`
Get merchant details including products and rating.

### POST `/merchants` 🔒 🔑
Create a new merchant (admin only).

### PATCH `/merchants/:merchantId` 🔒 🏪🔑
Update merchant profile.

### PATCH `/merchants/:merchantId/status` 🔒 🏪🔑
Toggle merchant open/closed status.

**Body:** `{ "isOpen": true }`

### GET `/merchants/:merchantId/wallet` 🔒 🏪🔑
### GET `/merchants/:merchantId/orders` 🔒 🏪🔑

### PATCH `/merchants/:merchantId/approve` 🔒 🔑
### PATCH `/merchants/:merchantId/reject` 🔒 🔑
### PATCH `/merchants/:merchantId/suspend` 🔒 🔑
### PATCH `/merchants/:merchantId/unsuspend` 🔒 🔑
### PATCH `/merchants/:merchantId/commission` 🔒 🔑
### DELETE `/merchants/:merchantId` 🔒 🔑

---

### Merchant Dashboard Endpoints

> All require `MERCHANT` role.

### GET `/merchants/merchant/:merchantId/profile` 🔒 🏪
### PATCH `/merchants/merchant/:merchantId/profile` 🔒 🏪

### GET `/merchants/merchant/:merchantId/orders` 🔒 🏪
**Query:** `page`, `limit`, `status`

### PATCH `/merchants/merchant/:merchantId/orders/:requestId/accept` 🔒 🏪
### PATCH `/merchants/merchant/:merchantId/orders/:requestId/reject` 🔒 🏪
**Body:** `{ "reason": "Item out of stock" }`

### PATCH `/merchants/merchant/:merchantId/orders/:requestId/status` 🔒 🏪
**Body:** `{ "status": "PROCESSING" }` or `{ "status": "READY_FOR_PICKUP" }`

### GET `/merchants/merchant/:merchantId/wallet` 🔒 🏪
### POST `/merchants/merchant/:merchantId/wallet/withdraw` 🔒 🏪

### GET `/merchants/merchant/:merchantId/products` 🔒 🏪
### POST `/merchants/merchant/:merchantId/products` 🔒 🏪
### PUT `/merchants/merchant/:merchantId/products/:productId` 🔒 🏪
### DELETE `/merchants/merchant/:merchantId/products/:productId` 🔒 🏪
### PATCH `/merchants/merchant/:merchantId/products/:productId/availability` 🔒 🏪

### GET `/merchants/merchant/:merchantId/analytics/sales` 🔒 🏪
### GET `/merchants/merchant/:merchantId/analytics/orders` 🔒 🏪
### GET `/merchants/merchant/:merchantId/analytics/earnings` 🔒 🏪

---

## Utilities — `/utilities`

> 🔒 👤 All routes: CUSTOMER role + authentication. All purchases require PIN.

### GET `/utilities/plans`
Get available plans for a provider and service type.

**Query:** `provider` (`MTN`|`AIRTEL`|`GLO`|`9MOBILE`), `type` (`DATA`|`CABLE`)

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

### POST `/utilities/cable` 🔒 🔐
```json
{
  "iucNumber": "1234567890",
  "provider": "DSTV",
  "planCode": "dstv-compact",
  "amount": 9900,
  "pin": "123456"
}
```

### POST `/utilities/electricity` 🔒 🔐
```json
{
  "meterNumber": "12345678901",
  "disco": "AEDC",
  "meterType": "PREPAID",
  "amount": 5000,
  "pin": "123456"
}
```

### GET `/utilities/validate-iuc`
Validate IUC number before cable payment.

**Query:** `iucNumber`, `provider`

### GET `/utilities/validate-meter`
Validate meter number before electricity payment.

**Query:** `meterNumber`, `disco`

### GET `/utilities/history` 🔒
Bill payment history. **Query:** `page`, `limit`, `type`

---

## Rider — `/rider`

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

### GET `/rider/profile` 🔒 🛵
### PATCH `/rider/availability` 🔒 🛵
**Body:** `{ "availability": "ONLINE" }` or `{ "availability": "OFFLINE" }`

### POST `/rider/location` 🔒 🛵
Update current GPS position (REST fallback; prefer Socket.io `rider:location:update`).

**Body:** `{ "lat": 13.0059, "lng": 7.6017 }`

### POST `/rider/accept` 🔒 🛵
Accept a job. Prefer Socket.io `rider:job:accept` for real-time flow.

**Body:** `{ "requestId": "uuid" }`

### GET `/rider/earnings` 🔒 🛵

### GET `/rider/admin/all` 🔒 🔑
### GET `/rider/admin/:riderId` 🔒 🔑
### PATCH `/rider/admin/:riderId/status` 🔒 🔑
### GET `/rider/admin/:riderId/earnings` 🔒 🔑

---

## Admin — `/admin`

> 🔒 🔑 All routes: ADMIN role + authentication.

### GET `/admin/dashboard`
Platform summary: revenue, active requests, users, riders, merchants.

### GET `/admin/analytics/revenue`
### GET `/admin/analytics/orders`
### GET `/admin/analytics/customers`
### GET `/admin/analytics/geographic`
### GET `/admin/analytics/realtime`

### GET `/admin/requests`
**Query:** `page`, `limit`, `status`, `type`

### PATCH `/admin/requests/:requestId/reassign`
**Body:** `{ "riderId": "uuid" }`

### PATCH `/admin/requests/:requestId/cancel`
**Body:** `{ "reason": "string" }`

### PATCH `/admin/requests/:requestId/status`

### GET `/admin/merchants`
### GET `/admin/merchants/:merchantId`
### PUT `/admin/merchants/:merchantId`
### PATCH `/admin/merchants/:merchantId/approve`
### PATCH `/admin/merchants/:merchantId/reject`
### PATCH `/admin/merchants/:merchantId/suspend`
### PATCH `/admin/merchants/:merchantId/unsuspend`
### PATCH `/admin/merchants/:merchantId/commission`
### GET `/admin/merchants/:merchantId/commission-history`
### PATCH `/admin/merchants/:merchantId/withdrawal-hold`
### GET `/admin/merchants/:merchantId/analytics`
### POST `/admin/merchants/:merchantId/tags`

### GET `/admin/riders`
### GET `/admin/riders/pending`
### PATCH `/admin/riders/:riderId/review`
**Body:** `{ "decision": "approve" }` or `{ "decision": "reject" }`

### GET `/admin/riders/:riderId/earnings`
### GET `/admin/riders/:riderId/deliveries`
### GET `/admin/riders/performance`
### GET `/admin/riders/realtime`

### GET `/admin/users`
### PATCH `/admin/users/:userId/status`
**Body:** `{ "status": "SUSPENDED" }` or `{ "status": "ACTIVE" }`

### GET `/admin/transactions`
**Query:** `page`, `limit`, `type`, `status`

### GET `/admin/withdrawals/pending`
### POST `/admin/withdrawals/bulk-approve`
### PATCH `/admin/withdrawals/:withdrawalId/approve`
### PATCH `/admin/withdrawals/:withdrawalId/reject`
### GET `/admin/withdrawals/history`

### GET `/admin/tags`
### POST `/admin/tags`
### PUT `/admin/tags/:tagId`
### DELETE `/admin/tags/:tagId`

### GET `/admin/settings`
### PATCH `/admin/settings`

### GET `/admin/audit-logs`

### GET `/admin/disputes`
### PATCH `/admin/disputes/:disputeId/resolve`

### GET `/admin/support/tickets`
### PATCH `/admin/support/tickets/:ticketId/status`

### GET `/admin/marketing/campaigns`
### GET `/admin/marketing/discounts`
### PATCH `/admin/marketing/discounts/:discountId/approve`
### PATCH `/admin/marketing/discounts/:discountId/reject`

### GET `/admin/safety/incidents`
### GET `/admin/safety/compliance`

### GET `/admin/vtu-plans`
### POST `/admin/vtu-plans`
### POST `/admin/vtu-plans/bulk`
### PUT `/admin/vtu-plans/:planId`
### DELETE `/admin/vtu-plans/:planId`

---

## Maps — `/maps`

> No authentication required (used in address picker before login).

### GET `/maps/autocomplete`
Google Places autocomplete for address search.

**Query:** `input` (string), `sessionToken` (optional)

**Response:** `200` — list of place suggestions

### GET `/maps/place-details`
Resolve place ID to coordinates and formatted address.

**Query:** `placeId`

**Response:** `200`
```json
{
  "placeId": "ChIJ...",
  "address": "No. 5 Kofar Marusa, Katsina",
  "lat": 13.0059,
  "lng": 7.6017
}
```

### GET `/maps/reverse-geocode`
Convert coordinates to a human-readable address.

**Query:** `lat`, `lng`

---

## Webhooks — `/webhooks`

> No JWT authentication. Verified via provider-specific signatures.

### POST `/webhooks/katpay`
Receives wallet funding (virtual account credits) and withdrawal status events from KatPay. Verified via HMAC signature on raw request body.

---

## Delivery — `/delivery` *(Legacy)*

> **Deprecated.** This module is kept for backward compatibility during migration. New clients must use `/requests` instead.

The `/delivery` endpoints map to the same `Request` model under the hood. They will be removed in a future release. See `docs/UNIFIED_REQUEST_ARCHITECTURE.md` for migration details.

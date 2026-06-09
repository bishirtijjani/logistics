# Customer App - Production Implementation Plan

> **Primary Focus:** Logistics & Delivery (Uber for packages)  
> **Secondary:** Digital Wallet (to support seamless logistics payments)  
> **Tertiary:** VTU/Utility Payments (retention & engagement)

---

## Current State Summary

### ✅ What's Already Built

**Backend Foundation:**
- Complete Prisma schema with all models (`User`, `Wallet`, `Transaction`, `DeliveryOrder`, `UtilityPayment`, `Rider`, `Rating`, etc.)
- Auth module (register, login, OTP, password reset, JWT with refresh token rotation)
- Wallet service core logic (transfer, withdraw, fund, transaction history)
- Delivery service core logic (fare estimation skeleton, order lifecycle, settlement, rating)
- Queue infrastructure (BullMQ queues and workers skeletons)
- Socket.io infrastructure (events, handlers skeleton, JWT auth)

**Mobile App Foundation:**
- Navigation structure (Auth flow + Main tabs: Home, Orders, Wallet, Profile)
- Auth screens complete (Login, Register, OTP, Forgot/Reset Password)
- HomeScreen UI (wallet balance display, service shortcuts, location picker integration)
- WalletScreen UI (balance card, placeholder action buttons)
- ProfileScreen with navigation to sub-screens
- LocationPickerScreen with Google Places autocomplete
- API client with interceptors, token management, toast error handling
- Redux store with auth, wallet, profile, location slices
- Error boundaries and toast notifications configured

---

## Critical Gaps (Production Blockers)

### Logistics (Primary) - CRITICAL

| # | Component | Issue | Impact |
|---|-----------|-------|--------|
| 1 | **Google Maps Service** | No backend service for distance/ETA calculation | Delivery pricing uses Haversine (inaccurate) |
| 2 | **Rider Matching** | Worker has TODOs, no algorithm to find nearby riders | No automatic rider assignment |
| 3 | **Socket.io Completion** | Handlers are skeletons, no real-time location broadcast | Customer cannot track rider live |
| 4 | **Create Delivery Screen** | Not built - no pickup/dropoff flow | Customers cannot request deliveries |
| 5 | **Track Delivery Screen** | Not built - no map with live rider tracking | Core UX missing |
| 6 | **Orders History** | Empty state only, no delivery list | Cannot view past deliveries |

### Wallet (Supporting) - HIGH

| # | Component | Issue | Impact |
|---|-----------|-------|--------|
| 7 | **KatPay Integration** | No service for virtual accounts | Cannot fund wallet |
| 8 | **Termii Integration** | OTP stored in Redis but not sent | Users never receive SMS |
| 9 | **Fund Wallet Screen** | Not built | No way to add money |
| 10 | **Transaction PIN UI** | No bottom sheet component | Cannot confirm transactions |

### VTU (Secondary) - MEDIUM

| # | Component | Issue | Impact |
|---|-----------|-------|--------|
| 11 | **AlRahuz Integration** | No service file | Cannot process utility payments |
| 12 | **Airtime/Data Screens** | Not built | Utility features inaccessible |

---

## Implementation Phases

### Phase 1: Logistics Core (Weeks 1-2) - CRITICAL PATH

**Goal:** Enable customers to request deliveries and track them in real-time.

#### 1.1 Backend: Google Maps Service

Create `backend/src/services/maps.service.js`:

```javascript
// Required methods:
- getDistanceMatrix(origins, destinations) → road distance + ETA
- geocodeAddress(address) → lat/lng
- reverseGeocode(lat, lng) → formatted address
- autocompletePlaces(input, sessionToken) → predictions
- getPlaceDetails(placeId) → full address components
```

Update `backend/src/modules/delivery/delivery.service.js`:
- Replace Haversine formula with `mapsService.getDistanceMatrix()`
- Accurate fare calculation based on actual road distance
- ETA estimation for customer display

#### 1.2 Backend: Rider Matching Algorithm

Complete `backend/src/queues/workers/delivery.worker.js`:

```javascript
// Broadcast flow:
1. Customer creates delivery order (status: REQUESTED)
2. Queue BROADCAST_TO_RIDERS job
3. Worker queries Redis for `riders:available` room members
4. Calculate distance from each rider to pickup using geohash
5. Broadcast via socket to top 10 nearest riders
6. 60-second timeout for acceptance
7. If rejected/timeout: expand radius (5km → 10km → 15km)
8. After 3 rounds: auto-cancel, notify customer
```

#### 1.3 Backend: Socket.io Completion

Verify `backend/src/sockets/handlers/tracking.handler.js`:
- `rider:location:update` → Store in Redis, emit to `delivery:{orderId}` room
- `rider:availability:changed` → Update Redis, broadcast to rider pool

Verify `backend/src/sockets/handlers/delivery.handler.js`:
- `rider:job:accept` → Assign rider, create delivery room, emit `delivery:rider:assigned`
- `delivery:room:join` → Join socket to delivery room
- `delivery:room:leave` → Leave room on completion/cancellation

#### 1.4 Mobile: Create Delivery Screen

Create `mobile/customer-app/src/screens/delivery/CreateDeliveryScreen.js`:

```
┌─────────────────────────────┐
│  New Delivery         [X]   │
├─────────────────────────────┤
│  📍 Pickup Location         │
│  [Tap to select location]   │
│                             │
│  🏁 Dropoff Location        │
│  [Tap to select location]   │
│                             │
│  📦 Package Size            │
│  [Small] [Medium] [Large]   │
│                             │
│  📝 Item Description        │
│  [Text input]               │
│                             │
│  💰 Estimated Fare          │
│  ₦1,250 • 4.2km • ~12 min   │
│                             │
│  [  Request Delivery  ]     │
└─────────────────────────────┘
```

**Flow:**
1. Tap pickup location → Navigate to `LocationPickerScreen`
2. Return with `latitude, longitude, address`
3. Tap dropoff location → Same flow
4. On both selected: Call `GET /delivery/estimate` → display fare
5. Select package size (Small/Medium/Large)
6. Enter item description
7. Tap "Request Delivery" → Show PIN bottom sheet
8. On PIN confirm: `POST /delivery` → Navigate to `TrackDeliveryScreen`

**Redux Action:**
- Add `createDelivery(orderData, pin)` to `deliverySlice.js`

#### 1.5 Mobile: Track Delivery Screen

Create `mobile/customer-app/src/screens/delivery/TrackDeliveryScreen.js` - **Most Critical Screen**

```
┌─────────────────────────────┐
│  Delivery Status: En Route  │
├─────────────────────────────┤
│                             │
│    [GOOGLE MAP VIEW]        │
│                             │
│   🏍️ Ibrahim A.             │
│   ★ 4.8 • Red Boxer • AB123 │
│   [Call] [Message]          │
│                             │
│  ◉────◉────○────○────○      │
│  Req  P/U Transit Deliver   │
│                             │
│  [Cancel Delivery]          │
└─────────────────────────────┘
```

**Features:**
- Full-screen Google Map
- Real-time rider location marker (updates via socket.io)
- Route polyline from rider → pickup → dropoff
- Status timeline showing current step
- Rider info card with photo, name, rating, vehicle, plate
- Call button (Linking.openURL(`tel:${phone}`))
- Cancel button (visible only before `PICKED_UP` status)

**Socket Integration:**
- On mount: Emit `delivery:room:join` with orderId
- Listen: `delivery:rider:assigned`, `rider:location:broadcast`, `delivery:status:changed`
- On unmount: Emit `delivery:room:leave`

#### 1.6 Mobile: Orders Screen (Delivery History)

Update `mobile/customer-app/src/screens/main/OrdersScreen.js`:

```
┌─────────────────────────────┐
│  My Deliveries      [+]     │
├─────────────────────────────┤
│ [Active] [Completed] [Canx] │
├─────────────────────────────┤
│ 🚚 #DEL-2847                │
│ Katsina → Funtua            │
│ ₦1,250 • En Route           │
│ [Track]                     │
├─────────────────────────────┤
│ 🚚 #DEL-2156                │
│ Katsina → Daura             │
│ ₦950 • Delivered yesterday  │
│ [Rate ☆☆☆☆☆]                │
└─────────────────────────────┘
```

**Features:**
- Tabs: Active, Completed, Cancelled
- Pull-to-refresh
- Pagination (infinite scroll)
- Tap delivery to view details
- "Track" button for active deliveries
- "Rate" button for unrated completed deliveries

**Redux Actions:**
- `fetchDeliveries({ page, limit, status })`

### Phase 2: Real-Time & Completion (Weeks 3-4)

**Goal:** Live tracking, ratings, and delivery completion flow.

#### 2.1 Mobile: Socket.io Client Service

Create `mobile/customer-app/src/services/socket.js`:

```javascript
// Requirements:
- Connect on app start (if authenticated)
- JWT authentication in handshake
- Automatic reconnection with exponential backoff
- Join user room on connect
- Emit delivery:room:join when entering tracking
- Listen for events, dispatch to Redux
- Disconnect on logout
```

**Event Handlers:**
```javascript
- delivery:rider:assigned → Update order, show rider info
- rider:location:broadcast → Update map marker position
- delivery:status:changed → Update status timeline
- delivery:completed → Show completion modal, prompt for rating
- wallet:balance:updated → Update wallet balance in Redux
```

#### 2.2 Mobile: Rate Delivery Screen

Create `mobile/customer-app/src/screens/delivery/RateDeliveryScreen.js`:

```
┌─────────────────────────────┐
│  Rate Your Delivery         │
├─────────────────────────────┤
│                             │
│  How was Ibrahim's service? │
│                             │
│      ☆ ☆ ☆ ☆ ☆             │
│                             │
│  Quick Tags:                │
│  [Fast] [Friendly] [Careful]│
│  [On Time] [Professional]   │
│                             │
│  Additional Comments        │
│  [Text input, optional]     │
│                             │
│  [    Submit Rating    ]    │
└─────────────────────────────┘
```

**API:** `POST /delivery/{orderId}/rate`

#### 2.3 Mobile: Transaction PIN Bottom Sheet

Create `mobile/customer-app/src/components/PinBottomSheet.js`:

```javascript
// Requirements:
- Use @gorhom/bottom-sheet
- 6-digit input with secure entry (dots)
- Shake animation on wrong PIN
- "Forgot PIN?" link (navigate to reset)
- Max 3 attempts, then lock for 30 minutes
- Success callback prop
```

**Usage:**
- Create delivery confirmation
- Manual wallet transfer (if implemented)
- Utility payments (if implemented)

### Phase 3: Wallet Foundation (Weeks 5-6)

**Goal:** Enable wallet funding so customers can pay for deliveries.

**Scope:** Minimal viable wallet - fund only. Defer P2P and withdrawals.

#### 3.1 Backend: KatPay Integration

Create `backend/src/services/katpay.service.js`:

```javascript
// Required methods:
- authenticate() → Get access token from KatPay
- createVirtualAccount(userId, email, name) → Reserve dedicated account
- initiatePayout(...) → For withdrawals
- verifyWebhookSignature(payload, signature) → HMAC validation on raw body
- parseWebhookEvent(payload) → Extract transaction data
```

Update `backend/src/queues/workers/payment.worker.js`:
- `handleKatpayVirtualAccountPayment` credits user wallet on successful transfer
- Emit `wallet:balance:updated` via socket

#### 3.2 Backend: Termii SMS Integration

Create `backend/src/services/termii.service.js`:

```javascript
// Required methods:
- sendOtp(phone, code) → SMS for registration/reset
- sendSms(phone, message) → Generic SMS
```

Update `backend/src/modules/auth/auth.controller.js`:
- Call `termiiService.sendOtp()` after generating OTP in Redis

#### 3.3 Mobile: Fund Wallet Screen

Create `mobile/customer-app/src/screens/wallet/FundWalletScreen.js`:

```
┌─────────────────────────────┐
│  Fund Wallet          [X]   │
├─────────────────────────────┤
│                             │
│  Your Virtual Account       │
│                             │
│  ┌─────────────────────┐    │
│  │ ******1234         │    │
│  │ Wema Bank           │    │
│  │ [Copy Number]       │    │
│  └─────────────────────┘    │
│                             │
│  Instructions:              │
│  1. Copy account number       │
│  2. Transfer from your bank   │
│  3. Wallet updates instantly  │
│                             │
│  Recent Funding:              │
│  ₦5,000 • Today • Completed   │
└─────────────────────────────┘
```

**API:** `GET /wallet` (already returns `accountNumber`)

#### 3.4 Mobile: Wallet Balance Integration

Update `mobile/customer-app/src/screens/main/HomeScreen.js`:
- Already shows wallet balance - ensure refresh on pull-to-refresh
- Quick actions: "Fund" → navigate to FundWalletScreen

Update `mobile/customer-app/src/screens/main/WalletScreen.js`:
- Connect "Fund", "Send", "Withdraw" buttons to screens
- For now, only "Fund" is functional
- "Send" and "Withdraw" show "Coming Soon" toast or navigate to placeholder

### Phase 4: VTU Minimal (Weeks 7-8)

**Goal:** Basic airtime and data for user retention.

**Scope:** Airtime and Data only. Defer electricity and TV.

#### 4.1 Backend: AlRahuz Service

Create `backend/src/services/alrahuz.service.js`:

```javascript
// Required methods:
- authenticate() → Get API token
- fetchDataPlans(merchant) → MTN, Airtel, Glo, 9mobile bundles
- buyAirtime({ requestId, phone, amount, serviceID })
- buyData({ requestId, phone, serviceID, variationCode, amount })
- queryTransactionStatus(requestId)
```

Update `backend/src/queues/workers/utility.worker.js`:
- Already has skeleton - implement AlRahuz calls
- Handle success/failure status updates
- Trigger refund on persistent failure

#### 4.2 Mobile: Airtime Screen

Create `mobile/customer-app/src/screens/utility/AirtimeScreen.js`:

```
┌─────────────────────────────┐
│  Buy Airtime          [X]   │
├─────────────────────────────┤
│  Merchant: [MTN ▼]          │
│                             │
│  Phone Number               │
│  [080********    ] [📞]     │
│                             │
│  Amount                     │
│  [₦500        ]             │
│  [₦100] [₦200] [₦500] [1k]  │
│                             │
│  Total: ₦500 (no fee)       │
│                             │
│  [   Pay with Wallet   ]    │
└─────────────────────────────┘
```

#### 4.3 Mobile: Data Screen

Create `mobile/customer-app/src/screens/utility/DataScreen.js`:
- Merchant selection
- Fetch plans from `GET /utilities/data-plans?merchant=MTN`
- Plan selection with price and data volume
- Phone number input
- PIN confirmation

### Phase 5: Polish & Launch (Weeks 9-10)

**Goal:** Production-ready app with notifications, error handling, and deployment.

#### 5.1 Push Notifications

**Backend:** Firebase service
- Create `backend/src/services/firebase.service.js`
- Send FCM notifications for: rider assigned, delivery updates, wallet funded

**Mobile:**
- Request notification permissions on first launch
- Get FCM token, send to backend `POST /auth/fcm-token`
- Handle foreground notifications (show toast)
- Handle background/quit notifications (deep link to relevant screen)

#### 5.2 Deep Linking

Configure for:
- `logisticsapp://delivery/{orderId}` → Open TrackDeliveryScreen
- `logisticsapp://wallet` → Open WalletScreen
- `logisticsapp://orders` → Open OrdersScreen

#### 5.3 Error Handling & Edge Cases

- Network offline detection
- API error retry with exponential backoff
- Wallet insufficient balance (show fund prompt)
- Delivery cancellation by rider (re-queue matching)
- Rider location lost (show "Reconnecting...")

#### 5.4 Testing Checklist

| Flow | Test Case |
|------|-----------|
| Registration | New user signup with OTP |
| Wallet Funding | Bank transfer → webhook → balance update |
| Create Delivery | Pickup, dropoff, payment, order created |
| Rider Matching | Broadcast → acceptance → assignment |
| Live Tracking | Socket updates, map marker movement |
| Delivery Complete | Auto-debit, receipt, rating prompt |
| Airtime Purchase | Merchant, amount, PIN, success |
| Error Handling | Offline mode, API failures, retry |

#### 5.5 Deployment

**Backend:**
- Production PostgreSQL database
- Redis production instance
- Deploy to Render/Railway/AWS
- Environment variables for production APIs (KatPay, AlRahuz, Termii live keys)
- SSL certificates

**Mobile:**
- App icons and splash screens
- iOS: App Store Connect setup, TestFlight
- Android: Play Console setup, Internal Testing
- EAS build configuration

---

## File Creation Checklist

### Backend New Files
- [ ] `backend/src/services/maps.service.js`
- [ ] `backend/src/services/katpay.service.js`
- [ ] `backend/src/services/alrahuz.service.js`
- [ ] `backend/src/services/termii.service.js`
- [ ] `backend/src/services/firebase.service.js`

### Mobile New Screens
- [ ] `mobile/customer-app/src/screens/delivery/CreateDeliveryScreen.js`
- [ ] `mobile/customer-app/src/screens/delivery/TrackDeliveryScreen.js`
- [ ] `mobile/customer-app/src/screens/delivery/RateDeliveryScreen.js`
- [ ] `mobile/customer-app/src/screens/wallet/FundWalletScreen.js`
- [ ] `mobile/customer-app/src/screens/wallet/TransactionHistoryScreen.js` (basic)
- [ ] `mobile/customer-app/src/screens/utility/AirtimeScreen.js`
- [ ] `mobile/customer-app/src/screens/utility/DataScreen.js`
- [ ] `mobile/customer-app/src/screens/utility/UtilityHistoryScreen.js`

### Mobile New Services/Components
- [ ] `mobile/customer-app/src/services/socket.js`
- [ ] `mobile/customer-app/src/components/PinBottomSheet.js`

### Mobile Modified Files
- [ ] `mobile/customer-app/src/screens/main/HomeScreen.js` - Add delivery creation entry
- [ ] `mobile/customer-app/src/screens/main/OrdersScreen.js` - Add delivery list
- [ ] `mobile/customer-app/src/screens/main/WalletScreen.js` - Connect Fund button
- [ ] `mobile/customer-app/src/store/slices/deliverySlice.js` - Add createDelivery, fetchDeliveries
- [ ] `mobile/customer-app/src/navigation/AppNavigator.js` - Add new screens

---

## Success Metrics (Logistics-First)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Delivery request → Rider assigned | < 3 minutes (urban) | Backend logs |
| Rider location update latency | < 5 seconds | Socket event timestamps |
| Delivery completion rate | > 85% | Order status analytics |
| Customer app crash rate | < 1% | Crashlytics |
| Wallet funding success rate | > 95% | KatPay webhooks |
| App store rating | > 4.0 stars | Play Store / App Store |

---

## Notes

- **Logistics is the product.** Everything else supports this core value prop.
- Wallet exists to eliminate payment friction for deliveries. No complex banking features needed for MVP.
- VTU is a retention hook - users open app for airtime, stay for logistics.
- Real-time tracking is the key differentiator - invest heavily in socket reliability.
- Katsina State launch: Focus on Katsina city → Funtua → Daura triangle initially.

---

*Document Version: 1.0*  
*Last Updated: Implementation planning phase*

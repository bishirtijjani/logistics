# Unified Request-Centric Architecture

> **Document Version:** 2.0 — Architectural Pivot  
> **Status:** Design Phase — Not Yet Implemented  
> **Author:** Cascade AI Assistant  

---

## Executive Summary

This document represents a fundamental architectural pivot for the VTU Logistics Platform. The current system treats food ordering, package delivery, utilities, and wallet as separate products. This document proposes a **unified request-centric architecture** where everything revolves around a single concept: **a request that is created, processed by a provider, fulfilled by a rider, and settled financially**.

**Food is just the first type of request, not a special case.**

---

## The Core Insight

All business activities in this platform follow the same fundamental pattern:

```
Customer Request → Provider Processing → Rider Fulfillment → Financial Settlement
```

Whether it's:
- **Food**: Customer orders burger → Restaurant prepares → Rider delivers
- **Groceries**: Customer orders milk → Supermarket packs → Rider delivers  
- **Package**: Customer sends documents → Pickup location → Rider delivers
- **Pharmacy**: Customer orders medicine → Pharmacy prepares → Rider delivers

The underlying structure is **identical**. The only difference is the type of provider and whether there's a preparation phase.

---

## The Request Lifecycle (Universal)

### Phase 1: Request Created
**Trigger:** Customer confirms order/Request  
**State:** `REQUESTED`  
**Actors:** Customer

### Phase 2: Provider Acceptance  
**Trigger:** Merchant/Provider accepts the request  
**State:** `ACCEPTED`  
**Actors:** Provider (optional for package delivery)

### Phase 3: Provider Processing
**Trigger:** Provider begins preparation/packing  
**State:** `PROCESSING`  
**Actors:** Provider (restaurant cooks, supermarket packs, etc.)

### Phase 4: Ready for Pickup
**Trigger:** Provider signals item is ready  
**State:** `READY_FOR_PICKUP`  
**Actors:** Provider  
**Action:** System assigns rider (if not already assigned)

### Phase 5: Rider Assigned
**Trigger:** System matches rider  
**State:** `RIDER_ASSIGNED`  
**Actors:** System, Rider

### Phase 6: Rider En Route
**Trigger:** Rider starts navigation to pickup  
**State:** `RIDER_EN_ROUTE`  
**Actors:** Rider

### Phase 7: Picked Up
**Trigger:** Rider confirms pickup  
**State:** `PICKED_UP`  
**Actors:** Rider

### Phase 8: In Transit
**Trigger:** Rider begins delivery to customer  
**State:** `IN_TRANSIT`  
**Actors:** Rider

### Phase 9: Delivered
**Trigger:** Rider confirms delivery  
**State:** `DELIVERED`  
**Actors:** Rider

### Phase 10: Settled
**Trigger:** System processes payment splits  
**State:** `SETTLED`  
**Actors:** System

### Alternative: Cancelled
**Can occur:** Any time before `PICKED_UP`  
**State:** `CANCELLED`  
**Actors:** Customer, Provider, or System

---

## Data Model Redesign

### 1. Request — The Central Entity

```prisma
model Request {
  id              String        @id @default(uuid())
  
  // Request Type determines behavior
  type            RequestType   // FOOD, GROCERY, PHARMACY, PACKAGE, etc.
  
  // Status follows universal lifecycle
  status          RequestStatus @default(REQUESTED)
  
  // Customer
  customerId      String
  customer        User          @relation(fields: [customerId], references: [id])
  
  // Provider (optional — package delivery has no provider)
  providerId      String?
  provider        Provider?     @relation(fields: [providerId], references: [id])
  
  // Rider (assigned later)
  riderId         String?
  rider           Rider?        @relation(fields: [riderId], references: [id])
  
  // Locations
  pickupAddress   String
  pickupLat       Float
  pickupLng       Float
  pickupName      String?       // "KFC Katsina", "John's House", etc.
  
  dropoffAddress  String
  dropoffLat      Float
  dropoffLng      Float
  dropoffName     String?       // Customer's name or custom label
  
  // Pricing
  subtotal        Decimal       @db.Decimal(15, 2)  // Items cost (0 for package)
  deliveryFee     Decimal       @db.Decimal(15, 2)  // Always calculated
  platformFee     Decimal       @db.Decimal(15, 2)  // Platform commission
  tax             Decimal       @default(0) @db.Decimal(15, 2)
  total           Decimal       @db.Decimal(15, 2)  // What customer pays
  
  // Split tracking (crucial for financial transparency)
  customerPaid    Decimal       @db.Decimal(15, 2)  // What was actually charged
  providerEarning Decimal       @default(0) @db.Decimal(15, 2)
  riderEarning    Decimal       @default(0) @db.Decimal(15, 2)
  platformEarning Decimal       @default(0) @db.Decimal(15, 2)
  
  // Distance/Time
  distanceKm      Float
  estimatedMinutes Int
  
  // Financial record
  transactionId   String?       // Links to wallet transaction
  
  // Cancellation
  cancelledAt     DateTime?
  cancelledBy     String?       // customer, provider, rider, system
  cancellationReason String?
  
  // Timestamps for lifecycle
  acceptedAt      DateTime?
  processingAt    DateTime?
  readyAt         DateTime?
  riderAssignedAt DateTime?
  riderEnRouteAt  DateTime?
  pickedUpAt      DateTime?
  inTransitAt     DateTime?
  deliveredAt     DateTime?
  settledAt       DateTime?
  
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  
  // Relations
  items           RequestItem[]  // For food/grocery/pharmacy
  packageDetails  PackageDetail? // For package delivery
  rating          Rating?
  
  @@index([customerId])
  @@index([providerId])
  @@index([riderId])
  @@index([status])
  @@index([type])
  @@index([createdAt])
  @@map("requests")
}

enum RequestType {
  FOOD
  GROCERY
  PHARMACY
  PACKAGE
  // Future: APPAREL, ELECTRONICS, etc.
}

enum RequestStatus {
  REQUESTED
  ACCEPTED
  PROCESSING
  READY_FOR_PICKUP
  RIDER_ASSIGNED
  RIDER_EN_ROUTE
  PICKED_UP
  IN_TRANSIT
  DELIVERED
  SETTLED
  CANCELLED
}
```

### 2. RequestItem — For All Product-Based Requests

```prisma
model RequestItem {
  id          String   @id @default(uuid())
  requestId   String
  request     Request  @relation(fields: [requestId], references: [id], onDelete: Cascade)
  
  // Can link to product or be free-form
  productId   String?  // Optional link to catalog
  product     Product? @relation(fields: [productId], references: [id])
  
  // Or free-form entry (for quick orders)
  name        String   // "Big Mac", "Fresh Milk 1L", etc.
  description String?
  
  // Pricing at time of order
  unitPrice   Decimal  @db.Decimal(15, 2)
  quantity    Int      @default(1)
  
  // Variations/Options (JSON for flexibility)
  variations  Json?    // { "size": "Large", "extras": ["Cheese", "Bacon"] }
  
  totalPrice  Decimal  @db.Decimal(15, 2)  // unitPrice * quantity + variation costs
  
  createdAt   DateTime @default(now())
  
  @@index([requestId])
  @@map("request_items")
}
```

### 3. Provider — Merchants, Restaurants, etc.

```prisma
model Provider {
  id              String        @id @default(uuid())
  
  // User account (optional — providers can have login)
  userId          String?       @unique
  user            User?         @relation(fields: [userId], references: [id])
  
  // Provider type determines UI/behavior
  type            ProviderType
  
  // Business info
  name            String        // "KFC Katsina", "Big Basket Supermarket"
  description     String?
  phone           String
  email           String?
  
  // Location
  address         String
  lat             Float
  lng             Float
  
  // Operating hours
  openingTime     String        // "08:00"
  closingTime     String        // "22:00"
  
  // Media
  logoUrl         String?
  coverImageUrl   String?
  
  // Settings
  isActive        Boolean       @default(true)
  isOpen          Boolean       @default(false)  // Manual toggle by owner
  
  // Financial
  commissionRate  Float         @default(15)  // % taken by platform
  
  // Performance
  averageRating   Float         @default(0)
  totalOrders     Int           @default(0)
  
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  
  // Relations
  requests        Request[]
  products        Product[]     // For restaurants/stores with catalogs
  wallet          ProviderWallet?
  
  @@index([type])
  @@index([isActive, isOpen])
  @@map("providers")
}

enum ProviderType {
  RESTAURANT
  GROCERY
  PHARMACY
  // Future: RETAIL, BOUTIQUE, etc.
}
```

### 4. Product — For Catalog-Based Providers

```prisma
model Product {
  id          String   @id @default(uuid())
  providerId  String
  provider    Provider @relation(fields: [providerId], references: [id], onDelete: Cascade)
  
  name        String
  description String?
  category    String   // "Burgers", "Dairy", "Pain Relief", etc.
  
  // Pricing
  basePrice   Decimal  @db.Decimal(15, 2)
  
  // Variations (JSON for flexibility)
  // { "sizes": [{"name": "Small", "price": 0}, {"name": "Large", "price": 500}] }
  variations  Json?
  
  // Options/Addons
  // { "toppings": [{"name": "Extra Cheese", "price": 200}, ...] }
  options     Json?
  
  // Media
  imageUrl    String?
  
  // Availability
  isAvailable Boolean  @default(true)
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([providerId])
  @@index([category])
  @@map("products")
}
```

### 5. ProviderWallet — Separate from User Wallet

```prisma
model ProviderWallet {
  id              String   @id @default(uuid())
  providerId      String   @unique
  provider        Provider @relation(fields: [providerId], references: [id], onDelete: Cascade)
  
  // Available for withdrawal
  availableBalance Decimal @default(0) @db.Decimal(15, 2)
  
  // Held in escrow (not yet available)
  pendingBalance   Decimal @default(0) @db.Decimal(15, 2)
  
  // Total all-time earnings
  totalEarnings    Decimal @default(0) @db.Decimal(15, 2)
  
  // Bank details for payout
  bankCode         String?
  accountNumber    String?
  accountName      String?
  
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  
  @@map("provider_wallets")
}
```

### 6. PackageDetail — For Package Delivery (No Provider)

```prisma
model PackageDetail {
  id          String   @id @default(uuid())
  requestId   String   @unique
  request     Request  @relation(fields: [requestId], references: [id], onDelete: Cascade)
  
  // Package info
  description String   // "Documents for signature"
  size        String   // SMALL, MEDIUM, LARGE
  weight      Float?   // in kg
  
  // Contact info at pickup
  senderName    String
  senderPhone   String
  
  // Recipient info
  recipientName   String
  recipientPhone  String
  
  // Special instructions
  instructions  String?
  
  createdAt   DateTime @default(now())
  
  @@map("package_details")
}
```

---

## Financial Flow (All Request Types)

### 1. Customer Payment

**When:** Request created  
**Action:** Debit customer wallet  
**Record:** Transaction with `type: REQUEST_PAYMENT`

```
Customer Wallet: -₦5,500 (Total)
  → Platform Wallet: +₦5,500
```

### 2. Money Held by Platform

The full amount sits in the platform's control wallet. It's **not** immediately split.

### 3. Settlement on Delivery

**When:** Request status → `SETTLED`  
**Actions:**
1. Calculate splits
2. Credit provider wallet (if applicable)
3. Credit rider wallet
4. Platform keeps remainder

```
Platform Wallet: -₦5,500
  → Provider Wallet (available): +₦3,500
  → Rider Wallet: +₦1,500
  → Platform Revenue: +₦500
```

### 4. Provider Withdrawal

**When:** Provider requests payout  
**Action:** Move from `availableBalance` to their bank account

### Key Principle

**All financial records exist from day one.** Even if we're not automating payouts yet, the `providerEarning`, `riderEarning`, and `platformEarning` fields are populated on every request. This enables:
- Accurate reporting
- Future withdrawal automation  
- Audit trails
- Commission calculations

---

## Socket Events (Unified)

All events use the `request:` namespace and work for any request type.

### Request Lifecycle Events

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `request:created` | Server → Customer | `{ requestId, type, status }` | Confirm request creation |
| `request:status:changed` | Server → All parties | `{ requestId, status, timestamp }` | Universal status update |
| `request:provider:accepted` | Server → Customer | `{ providerId, providerName, estimatedReadyTime }` | Provider accepts |
| `request:provider:ready` | Server → System | `{ requestId }` | Item ready for pickup |
| `request:rider:assigned` | Server → All | `{ riderId, name, vehicle, eta }` | Rider matched |
| `request:rider:location` | Rider → Server → Customer | `{ lat, lng, timestamp }` | Live tracking |
| `request:completed` | Server → All | `{ requestId, settlement }` | Delivery + payment complete |
| `request:cancelled` | Server → All | `{ requestId, reason, cancelledBy }` | Request cancelled |

### Room Strategy

| Room | Members | Purpose |
|------|---------|---------|
| `user:{userId}` | Individual | Personal notifications |
| `provider:{providerId}` | Provider + System | New orders, status updates |
| `riders:available` | Online riders | Job broadcasts |
| `request:{requestId}` | Customer + Provider + Rider | Tracking, coordination |

---

## API Design (Unified)

### Core Request Endpoints

```
POST   /api/requests                    # Create any type of request
GET    /api/requests                    # List my requests (customer/rider/provider)
GET    /api/requests/:id               # Get request details
PATCH  /api/requests/:id/status        # Update status (provider/rider)
DELETE /api/requests/:id               # Cancel (customer, before pickup)

POST   /api/requests/:id/rate           # Rate completed request

GET    /api/providers                   # List providers (filter by type, location)
GET    /api/providers/:id               # Get provider details
GET    /api/providers/:id/products      # Get provider's catalog
GET    /api/providers/:id/requests      # Get provider's orders (merchant dashboard)
PATCH  /api/providers/:id/status        # Update provider status (open/closed)

POST   /api/provider-wallet/withdraw   # Request payout

GET    /api/search?q=burger&lat=13.0&lng=7.6&type=food
GET    /api/nearby?lat=13.0&lng=7.6&type=restaurant&radius=5
```

### Provider Endpoints

```
GET    /api/providers                   # List providers (filter by type, location)
GET    /api/providers/:id               # Get provider details
GET    /api/providers/:id/products      # Get provider's catalog
GET    /api/providers/:id/requests      # Get provider's orders (merchant dashboard)
PATCH  /api/providers/:id/status        # Update provider status (open/closed)

POST   /api/provider-wallet/withdraw   # Request payout
```

### Discovery/Search Endpoints

```
GET    /api/search?q=burger&lat=13.0&lng=7.6&type=food
GET    /api/nearby?lat=13.0&lng=7.6&type=restaurant&radius=5
```

---

## Frontend Architecture

### Customer App Views

**1. Discovery (Home)**
- Search bar (universal search)
- Category pills: Food, Groceries, Pharmacy, Package
- Nearby providers (if location-based)
- Recent/recommended

**2. Provider Browse**
- List/grid of providers
- Filters: Rating, delivery time, price range
- Provider cards: Logo, name, rating, delivery time, minimum order

**3. Provider Menu (if catalog-based)**
- Categories
- Product cards with variations/options
- Cart management
- Subtotal calculation

**4. Checkout Flow**
- Review items (if applicable)
- Select delivery address
- Delivery fee calculation
- Payment confirmation (PIN)
- Order confirmation

**5. Tracking Screen (Universal)**
- Map with rider location
- Status timeline (plain language)
- Provider info (if applicable)
- Rider info
- Support/Chat buttons

### Status Display Mapping

| System Status | Customer-Facing | Provider-Facing | Rider-Facing |
|---------------|-----------------|-----------------|--------------|
| `REQUESTED` | "Order received" | "New order" | — |
| `ACCEPTED` | "Preparing your order" | "Order accepted" | — |
| `PROCESSING` | "Still preparing" | "In progress" | — |
| `READY_FOR_PICKUP` | "Ready for pickup" | "Waiting for rider" | — |
| `RIDER_ASSIGNED` | "Rider assigned" | "Rider on the way" | "New pickup" |
| `RIDER_EN_ROUTE` | "Rider heading to pickup" | "Rider nearby" | "Going to pickup" |
| `PICKED_UP` | "On the way to you" | "Handed to rider" | "Going to customer" |
| `IN_TRANSIT` | "Almost there" | "In transit" | "En route" |
| `DELIVERED` | "Delivered" | "Delivered" | "Completed" |
| `SETTLED` | "Completed" | "Paid" | "Earnings added" |

### Merchant Dashboard Views

**1. Orders Management**
- Incoming orders (new requests)
- Processing orders
- Ready for pickup
- History

**2. Order Detail**
- Items list with variations
- Customer info
- Status controls (Accept → Processing → Ready)
- Rider info (once assigned)

**3. Wallet/Earnings**
- Available balance
- Pending balance (in escrow)
- Transaction history
- Withdrawal request

### Admin Dashboard Views

**1. Global Request Monitor**
- Live map of all active requests
- Filter by: Type, Status, Provider, Rider
- Drill down to any request

**2. Intervention Tools**
- Reassign rider
- Cancel request with reason
- Refund customer
- Contact any party

**3. Provider Management**
- Approve new providers
- View provider performance
- Adjust commission rates
- Suspend/activate

**4. Financial Overview**
- Daily/weekly revenue
- Settlement tracking
- Provider payouts pending
- Rider earnings

---

## Implementation Strategy

### Phase 1: Database Migration (Week 1)

1. Create new tables: `Request`, `RequestItem`, `Provider`, `Product`, `ProviderWallet`, `PackageDetail`
2. Migrate existing `DeliveryOrder` data to `Request` (mark as `type: PACKAGE`)
3. Update Prisma client
4. Verify data integrity

### Phase 2: Backend API (Weeks 1-2)

1. Create `request` module with unified endpoints
2. Create `provider` module
3. Update wallet logic for provider settlements
4. Update socket handlers for unified events

### Phase 3: Provider Dashboard (Week 2-3)

1. Build React-based merchant dashboard
2. Provider auth (separate from customer auth)
3. Order management UI
4. Wallet/earnings view

### Phase 4: Customer App Updates (Weeks 3-4)

1. Update HomeScreen with unified search
2. Build ProviderBrowseScreen
3. Build ProviderMenuScreen (for food)
4. Update CreateRequestScreen (works for all types)
5. Update TrackRequestScreen (universal tracking)

### Phase 5: Admin Dashboard (Week 4)

1. Build admin dashboard
2. Global request monitor
3. Intervention tools
4. Provider management

### Phase 6: Testing & Launch (Week 5)

1. End-to-end testing with food orders
2. Package delivery testing
3. Financial reconciliation testing
4. Soft launch with limited providers

---

## Benefits of This Architecture

1. **Scalability**: Add new request types (electronics, fashion) by adding a `type` enum value
2. **Consistency**: Same tracking, same wallet logic, same admin tools for everything
3. **Clarity**: Financial splits are transparent and auditable from day one
4. **Flexibility**: Package delivery and food delivery share 80% of code
5. **Maintainability**: One set of socket events, one API pattern, one mental model
6. **Future-proof**: When you add groceries or pharmacy, it's configuration, not development

---

## Migration from Current System

### What's Changing

| Current | New |
|---------|-----|
| `DeliveryOrder` table | `Request` table |
| Food separate from delivery | Food is a request type |
| No provider concept | First-class `Provider` model |
| Rider earnings only | Provider + Rider + Platform splits |
| Package delivery special case | Just another request type |
| Status: `MATCHED` | Status: `RIDER_ASSIGNED` |
| Delivery-specific sockets | Unified `request:*` sockets |

### What Stays the Same

- User authentication and roles
- Wallet infrastructure (extended for providers)
- Rider management and location tracking
- Queue/worker infrastructure
- External service integrations (Maps, Monnify, etc.)

---

## Document Relationships

This document supersedes and extends:
- `ARCHITECTURE.md` — Update with unified diagrams
- `API_CONTRACT.md` — Replace with v1 endpoints
- `SOCKET_ARCHITECTURE.md` — Update event names
- `customer-app-implementation.md` — Update with new screens

**Next Steps:**
1. Review and approve this architecture
2. Update CONVENTIONS.md with new patterns
3. Create detailed implementation tickets
4. Begin Phase 1 (database migration)

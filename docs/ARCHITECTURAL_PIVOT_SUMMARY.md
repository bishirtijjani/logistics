# Architectural Pivot Summary

> **From:** Separate features (delivery, food, wallet)  
> **To:** Unified Request-Centric Architecture  
> **Date:** April 2026

---

## The Problem We Solved

**Before:** The system treated food ordering, package delivery, groceries, and pharmacy as separate, disconnected features. Each would need its own:
- Database tables
- API endpoints
- Frontend screens
- Admin interfaces
- Financial logic

**This leads to:**
- Duplicated code
- Inconsistent user experience
- Harder maintenance
- Slower feature rollout
- Technical debt

---

## The Solution: Unified Request Model

**Core Insight:** All business activities follow the same pattern:

```
Request Created → Merchant Processing → Rider Fulfillment → Financial Settlement
```

Whether it's a burger from KFC, groceries from a supermarket, or a document delivery, the underlying structure is **identical**. The only difference is:
1. **Type of merchant** (restaurant, supermarket, none for package)
2. **Preparation phase** (cooking, packing, none for package)
3. **Product catalog** (menu items, grocery items, none for package)

---

## Key Architectural Changes

### 1. Central Entity: `Request` (replaces `DeliveryOrder`)

**Before:**
```prisma
model DeliveryOrder {
  // Only for package delivery
  itemDescription String?
  packageSize String?
}
```

**After:**
```prisma
model Request {
  type RequestType  // FOOD, GROCERY, PHARMACY, PACKAGE
  status RequestStatus  // Unified lifecycle
  
  // All requests have these
  customerId, merchantId?, riderId
  pickupAddress, dropoffAddress
  subtotal, deliveryFee, platformFee, total
  
  // Financial splits (CRITICAL)
  customerPaid, merchantEarning, riderEarning, platformEarning
  
  // Relations
  items RequestItem[]  // For food/grocery/pharmacy
  packageDetails?      // For package delivery
}
```

### 2. New Entity: `Merchant` (Merchants)

Restaurants, supermarkets, pharmacies are now first-class `Merchant` entities with:
- Their own wallet (`MerchantWallet` with `availableBalance` and `pendingBalance`)
- Product catalogs
- Order management interface
- Earnings tracking
- Withdrawal capability

### 3. Unified Financial Flow

**Before:**
- Customer pays rider directly (or confusing flow)
- No clear tracking of who gets what
- No merchant earnings tracking

**After:**
1. Customer pays → Money goes to **Platform** first
2. Platform holds money in escrow
3. On delivery, system splits:
   - Merchant gets `subtotal - commission`
   - Rider gets `deliveryFee - platformFee`
   - Platform keeps `platformFee + deliveryPlatformFee`
4. Records exist from day one, even if manual payout

### 4. Universal Lifecycle

**All request types follow:**

```
REQUESTED
  ↓ (merchant accepts, if applicable)
ACCEPTED
  ↓ (merchant prepares, if applicable)
PROCESSING
  ↓ (merchant marks ready, if applicable)
READY_FOR_PICKUP
  ↓ (system assigns rider)
RIDER_ASSIGNED
  ↓ (rider accepts and starts)
RIDER_EN_ROUTE
  ↓ (rider picks up)
PICKED_UP
  ↓ (rider delivers)
IN_TRANSIT
  ↓ (rider confirms)
DELIVERED
  ↓ (system settles)
SETTLED
```

**Adaptations by type:**
- **Package:** Skips ACCEPTED/PROCESSING (no merchant)
- **Food:** Goes through ALL phases
- **Grocery/Pharmacy:** Same as food

### 5. Unified Frontend Experience

**Before:**
- Separate screens for "Delivery" and "Food"
- Different tracking interfaces
- Inconsistent status messages

**After:**
- One `TrackRequestScreen` works for ALL types
- Status labels adapt: "Preparing your order" (food) vs "Ready for pickup" (package)
- Same order history shows everything
- Search discovers all merchant types

---

## Documents Created/Updated

### 1. `docs/UNIFIED_REQUEST_ARCHITECTURE.md`
**Purpose:** Detailed design rationale and data models  
**Key sections:**
- Core philosophy
- Request lifecycle
- Database schema
- Financial flow
- Socket events
- Frontend architecture

### 2. `docs/ARCHITECTURE.md`
**Purpose:** High-level system overview
**Key sections:**
- System diagrams
- Money flow diagrams
- State machines
- API structure
- Implementation phases

### 3. `docs/API_CONTRACT.md`
**Purpose:** Complete API specification
**Key endpoints:**
- `/requests` - Unified request CRUD
- `/merchants` - Merchant browsing and management
- `/merchant/wallet` - Merchant earnings
- `/search` - Universal search

### 5. `CONVENTIONS.md` (Updated)
**Added:**
- Section 13: Unified Request Architecture rules
- Section 14: Financial Settlement rules
- Clarified that everything is a Request

### 6. `backend/prisma/schema.prisma`
**Purpose:** New database schema  
**New models:**
- `Request` (replaces `DeliveryOrder`)
- `RequestItem` (for food/grocery/pharmacy)
- `Merchant` (merchants)
- `MerchantWallet` (earnings tracking)
- `Product` (catalog items)
- `PackageDetail` (for package delivery)
- Updated `Transaction` (with request/merchant links)

### 7. `mobilDtomer-app/src/reens/main/HomeScreen.js` (Updated)
**Khynges:**
- Updated `counified requictesqsttmpes`
- Added architecture comments
- Updated navigation to use unified flow
- Food now navigates to `MerchantBrowse` instead of "Coming Soon"
- Package navigates to `CreateDelivery` with `requestType: PACKAGE`
- Added "Coming Soon" badges for Pharmacy/Grocery

---

## What This Enables

### 1. Faster Feature Rollout

**Add Groceries:**
1. Add `GROCERY` to `RequestType` enum
2. Onboard grocery stores as `Merchant` with `type: GROCERY`
3. Done - existing UI works immediately

**Add Apparel/Electronics (Future):**
1. Add `APPAREL` or `ELECTRONICS` to enum
2. Onboard retailers
3. Done - same flow, same tracking, same settlement

### 2. Consistent User Experience

Customers see:
- Same tracking screen regardless of order type
- Same order history
- Same payment flow
- Same rating experience

### 3. Clear Financial Tracking

From day one:
- Every request records `merchantEarning`, `riderEarning`, `platformEarning`
- Merchant wallets track `available` vs `pending`
- Audit trail for every naira
- Ready for automated payouts

### 4. Unified Admin Interface

Admins can:
- See all requests on one screen
- Filter by type when needed
- Intervene (reassign, cancel, refund) consistently
- Manage all merchants in one place

### 5. Scalable Rider Experience

Riders see:
- Just a task with pickup and dropoff
- No need to know if it's food, grocery, or package
- Same earnings tracking
- Same workflow every time

---

## Implementation Roadmap

### Phase 1: Database (Week 1)
- [ ] Create new tables (`Request`, `Merchant`, `Product`, etc.)
- [ ] Migrate existing `DeliveryOrder` → `Request` (as `PACKAGE` type)
- [ ] Verify data integrity

### Phase 2: Backend (Week 2)
- [ ] Build `request` module with unified endpoints
- [ ] Build `merchant` module
- [ ] Update socket events to use `request:` namespace
- [ ] Implement settlement logic

### Phase 3: Merchant Dashboard (Week 2-3)
- [ ] React-based dashboard
- [ ] Merchant authentication
- [ ] Order management (Accept → Process → Ready)
- [ ] Wallet/earnings view
- [ ] Withdrawal requests

### Phase 4: Customer App (Week 3-4)
- [ ] Discovery/search screens
- [ ] Merchant browse (restaurants)
- [ ] Merchant menu (food catalog)
- [ ] Cart and checkout
- [ ] Universal tracking screen

### Phase 5: Admin Dashboard (Week 4)
- [ ] Global request monitor
- [ ] Merchant management (approve, suspend, commission)
- [ ] Intervention tools
- [ ] Financial reconciliation

### Phase 6: Testing & Launch (Week 5)
- [ ] End-to-end testing (food orders)
- [ ] Package delivery testing
- [ ] Financial reconciliation
- [ ] Soft launch with 2-3 restaurants

---

## Critical Design Decisions

### 1. Merchant is Optional

**Decision:** `Request.merchantId` is nullable  
**Why:** Package deliveries have no merchant - customer is the sender  
**Impact:** Food/grocery/pharmacy require merchant, package skips merchant phase

### 2. Financial Splits Recorded Immediately

**Decision:** Every request stores `merchantEarning`, `riderEarning`, `platformEarning`  
**Why:** Audit trail from day one, even if payouts are manual initially  
**Impact:** Can reconcile finances accurately, automate payouts later

### 3. Same Tracking Screen for All Types

**Decision:** One `TrackRequestScreen` adapts based on `request.type`  
**Why:** Consistent UX, less code, easier maintenance  
**Impact:** Shows different status labels based on type ("Preparing" vs "Ready for pickup")

### 4. Merchant Wallet Separate from User Wallet

**Decision:** `MerchantWallet` with `availableBalance` and `pendingBalance`  
**Why:** Merchants need to see what's available to withdraw vs. what's in escrow  
**Impact:** Clear separation, supports settlement delays

### 5. Socket Events Use `request:` Namespace

**Decision:** Replace `delivery:*` with `request:*`  
**Why:** Universal events work for all request types  
**Impact:** Rider app, customer app, merchant dashboard all use same events

---

## Migration Strategy

### Backward Compatibility

During migration:
1. Keep v1 endpoints working (`/delivery/*`)
2. Run unified system (`/requests/*`)
3. Migrate data from `DeliveryOrder` → `Request`
4. Update apps to use unified system
5. Deprecate v1 after 30 days

### Rollback Plan

If critical issues:
1. Database: Keep old tables until stable
2. API: v1 endpoints remain functional
3. Apps: Can revert to v1 version
4. Process: Stop unified system → Fix → Retry

---

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Time to add new request type | < 1 day | Configuration changes only |
| Settlement accuracy | 100% | Financial reconciliation |
| Customer UX consistency | Same screens | All types use tracking screen |
| Merchant onboarding time | < 30 min | Self-service dashboard |
| Admin intervention time | < 30 sec | Cancel/reassign/resolve |
| Code duplication | Near 0% | Shared request logic |

---

## Next Steps

1. **Review this architecture** with stakeholders
2. **Approve** the pivot direction
3. **Begin Phase 1** (database migration)
4. **Update team** on new conventions (CONVENTIONS.md sections 13-14)
5. **Set up** merchant dashboard repository
6. **Schedule** weekly architecture reviews during implementation

---

## Questions?

Refer to:
- `UNIFIED_REQUEST_ARCHITECTURE.md` - Detailed design
- `CONVENTIONS.md` - Coding standards (sections 13-14)
- `API_CONTRACT.md` - API specification

---

*This architectural pivot positions the platform for rapid expansion while maintaining a consistent, maintainable codebase.*

# Logistics App — Unified Request Architecture Roadmap

This document outlines the implementation roadmap for the unified request architecture. Each phase includes detailed checklists for backend, frontend, and integration tasks.

---

## Phase 1 — Foundation ✅ (Completed)

### Database
- ✅ Update `schema.prisma` with unified models:
  - ✅ `Request` model with type polymorphism
  - ✅ `RequestItem` model for line items
  - ✅ `Merchant` model for merchants
  - ✅ `MerchantWallet` model for merchant earnings
  - ✅ `Product` model for inventory
  - ✅ `PackageDetail` model for package deliveries
  - ✅ Update `User` model with merchant and requests relations
  - ✅ Update `Rider` model with requests relation
  - ✅ Update `Rating` model to support both legacy and new requests
- ✅ Create manual SQL migration file (`backend/prisma/migrations/20260422_unified_request/migration.sql`)
- ✅ Run `npx prisma generate` to update Prisma client

### Backend — Request Module
- ✅ Create `request.validator.js` with Zod schemas:
  - ✅ `createRequestSchema` with type-specific validations
  - ✅ `updateStatusSchema` with role-based authorization
  - ✅ `listRequestsSchema` with filtering
  - ✅ `rateRequestSchema` for customer ratings
  - ✅ `cancelRequestSchema` for cancellation
- ✅ Create `request.service.js` with business logic:
  - ✅ `calculatePricing` for fare calculation
  - ✅ `createRequest` with wallet integration
  - ✅ `updateStatus` with lifecycle validation
  - ✅ `getRequests` with pagination
  - ✅ `getRequestById` with authorization
  - ✅ `rateRequest` with rating updates
- ✅ Create `request.controller.js` with HTTP handlers
- ✅ Create `request.routes.js` with REST endpoints
- ✅ Register routes in `app.js` under `/api/requests`

### Backend — Merchant Module
- ✅ Create `merchant.validator.js` with Zod schemas:
  - ✅ `createMerchantSchema` for admin creation
  - ✅ `updateMerchantSchema` for profile updates
  - ✅ `listMerchantsSchema` with location filtering
  - ✅ `toggleMerchantStatusSchema` for open/closed
  - ✅ `updateCommissionSchema` for admin commission updates
- ✅ Create `merchant.service.js` with business logic:
  - ✅ `createMerchant` with wallet initialization
  - ✅ `getMerchants` with location-based filtering
  - ✅ `getMerchantById` with products
  - ✅ `updateMerchant` with authorization
  - ✅ `toggleMerchantStatus` for availability
  - ✅ `getMerchantWallet` with authorization
  - ✅ `getMerchantOrders` with filtering
  - ✅ `updateMerchantCommission` for admin
- ✅ Create `merchant.controller.js` with HTTP handlers
- ✅ Create `merchant.routes.js` with REST endpoints
- ✅ Register routes in `app.js` under `/api/merchants`

### Backend — Queue Jobs
- ✅ Add `REQUEST` queue to `jobs.js`
- ✅ Add `REQUEST_JOBS` constants:
  - ✅ `BROADCAST_TO_RIDERS`
  - ✅ `SETTLE_REQUEST`
  - ✅ `REFUND_REQUEST`
  - ✅ `AUTO_CANCEL_UNMATCHED`
- ✅ Create `request.worker.js` with job handlers:
  - ✅ `broadcastToRiders` for rider matching
  - ✅ `settleRequest` for financial settlement
  - ✅ `refundRequest` for customer refunds
  - ✅ `autoCancelUnmatched` for timeout handling
- ✅ Register queue and worker in `queues/index.js`

### Backend — Socket Events
- ✅ Add `REQUEST` event constants to `events.js`:
  - ✅ `REQUEST.CREATED`
  - ✅ `REQUEST.STATUS_CHANGED`
  - ✅ `REQUEST.MERCHANT_ACCEPTED`
  - ✅ `REQUEST.MERCHANT_READY`
  - ✅ `REQUEST.RIDER_ASSIGNED`
  - ✅ `REQUEST.RIDER_LOCATION`
  - ✅ `REQUEST.COMPLETED`
  - ✅ `REQUEST.CANCELLED`
  - ✅ `REQUEST.JOIN_ROOM`
  - ✅ `REQUEST.LEAVE_ROOM`
- ✅ Add room helpers:
  - ✅ `getRequestRoom`
  - ✅ `getMerchantRoom`

### Frontend — Redux State
- ✅ Create `requestSlice.js` with async thunks:
  - ✅ `fetchRequests`
  - ✅ `fetchRequestById`
  - ✅ `createRequest`
  - ✅ `updateRequestStatus`
  - ✅ `cancelRequest`
  - ✅ `rateRequest`
- ✅ Add reducer to Redux store
- ✅ Add socket update action `updateRequestFromSocket`

### Frontend — Merchant Screens
- ✅ Create `MerchantBrowseScreen.js`:
  - ✅ Fetch merchants by type and location
  - ✅ Display merchant cards with ratings
  - ✅ Show open/closed status
  - ✅ Navigate to merchant menu
- ✅ Create `MerchantMenuScreen.js`:
  - ✅ Fetch merchant details and products
  - ✅ Display product list
  - ✅ Cart management (add/remove/update quantity)
  - ✅ Show cart footer with total
- ✅ Add routes to `AppNavigator.js`:
  - ✅ `MerchantBrowse`
  - ✅ `MerchantMenu`

### Frontend — HomeScreen
- ✅ Update `HomeScreen.js` to use unified `requestTypes` array
- ✅ Update service mapping logic

---

## Phase 2 — Core Flows (In Progress)

### Database
- ✅ Run the SQL migration file to create new tables (via prisma db push)
- ✅ Verify all tables and constraints created correctly
- ❌ Test foreign key relationships (not tested)

### Backend — Testing
- ❌ Test `/api/requests` POST endpoint (skipped - user won't test until Phase 5)
- ❌ Test `/api/requests` GET endpoint with filters (skipped - user won't test until Phase 5)
- ❌ Test `/api/requests/:id` GET endpoint (skipped - user won't test until Phase 5)
- ❌ Test `/api/requests/:id/status` PATCH endpoint (skipped - user won't test until Phase 5)
- ❌ Test `/api/requests/:id` DELETE endpoint (skipped - user won't test until Phase 5)
- ❌ Test `/api/requests/:id/rate` POST endpoint (skipped - user won't test until Phase 5)
- ❌ Test `/api/merchants` GET endpoint with location filtering (skipped - user won't test until Phase 5)
- ❌ Test `/api/merchants/:id` GET endpoint (skipped - user won't test until Phase 5)
- ❌ Test `/api/merchants/:id` PATCH endpoint (skipped - user won't test until Phase 5)
- ❌ Test `/api/merchants/:id/wallet` GET endpoint (skipped - user won't test until Phase 5)
- ❌ Test `/api/merchants/:id/orders` GET endpoint (skipped - user won't test until Phase 5)

### Frontend — Checkout Flow
- ✅ Create `CheckoutScreen.js`:
  - ✅ Display cart items summary
  - ✅ Show itemized costs (subtotal, delivery fee, platform fee, total)
  - ✅ Delivery address selection (saved addresses or new)
  - ✅ Payment method selection (wallet, card, cash)
  - ✅ Special instructions input
  - ✅ Order confirmation modal
  - ✅ Call `createRequest` thunk
  - ✅ Handle wallet payment (deduct balance)
  - ✅ Navigate to tracking screen on success
- ✅ Add `CheckoutScreen` to `AppNavigator`
- ✅ Update `MerchantMenuScreen` checkout button to navigate to `CheckoutScreen`

### Frontend — Request Tracking
- ✅ Create `RequestTrackingScreen.js`:
  - ✅ Fetch request details by ID
  - ✅ Display status timeline (stepper)
  - ✅ Show merchant information
  - ✅ Show rider information when assigned
  - ❌ Display map with rider location (requires map library integration)
  - ❌ Show estimated time of arrival (not implemented)
  - ✅ Cancel button (before pickup)
  - ❌ Call button (to rider/merchant) (not implemented)
  - ✅ Rate button (after delivery)
- ✅ Add status-specific UI:
  - ✅ REQUESTED: "Waiting for merchant acceptance"
  - ✅ ACCEPTED: "Merchant is preparing your order"
  - ✅ PROCESSING: "Your order is being prepared"
  - ✅ READY_FOR_PICKUP: "Order ready, waiting for rider"
  - ✅ RIDER_ASSIGNED: "Rider assigned, on the way to pickup"
  - ✅ RIDER_EN_ROUTE: "Rider is on the way to you"
  - ✅ PICKED_UP: "Rider has picked up your order"
  - ✅ IN_TRANSIT: "Order is on the way"
  - ✅ DELIVERED: "Order delivered"
  - ✅ SETTLED: "Order completed"
  - ✅ CANCELLED: "Order cancelled"
- ✅ Add `RequestTrackingScreen` to `AppNavigator`
- ✅ Update navigation after checkout to go to tracking screen

### Frontend — HomeScreen Integration
- ✅ Update Food button to navigate to `MerchantBrowse` with type='FOOD'
- ✅ Update Grocery button to navigate to `MerchantBrowse` with type='GROCERY'
- ✅ Update Pharmacy button to navigate to `MerchantBrowse` with type='PHARMACY'
- ✅ Update Delivery button to navigate to package delivery flow (existing)
- ✅ Pass user location to MerchantBrowse if available

---

## Phase 3 — Real-time Features

### Backend — Socket Integration
- ✅ Update socket handlers to emit `request:` events:
  - ✅ Emit `REQUEST.CREATED` when request is created
  - ✅ Emit `REQUEST.STATUS_CHANGED` on status updates
  - ❌ Emit `REQUEST.MERCHANT_ACCEPTED` when merchant accepts (requires merchant dashboard)
  - ❌ Emit `REQUEST.MERCHANT_READY` when merchant marks ready (requires merchant dashboard)
  - ✅ Emit `REQUEST.RIDER_ASSIGNED` when rider is assigned
  - ✅ Emit `REQUEST.COMPLETED` when delivery is complete
  - ✅ Emit `REQUEST.CANCELLED` when request is cancelled
- ✅ Implement room management:
  - ✅ Join request room on tracking screen
  - ✅ Leave request room on screen unmount
  - ✅ Join merchant room for merchant-specific events
- ✅ Implement rider location broadcasting
- ❌ Test socket event flow end-to-end (not tested - user won't test until Phase 5)

### Frontend — Socket Client
- ✅ Update mobile socket service to listen to `request:` events:
  - ✅ `REQUEST.CREATED` (merchant app)
  - ✅ `REQUEST.STATUS_CHANGED` (all roles)
  - ✅ `REQUEST.MERCHANT_ACCEPTED` (customer)
  - ✅ `REQUEST.MERCHANT_READY` (customer/rider)
  - ✅ `REQUEST.RIDER_ASSIGNED` (customer)
  - ✅ `REQUEST.RIDER_LOCATION` (customer)
  - ✅ `REQUEST.COMPLETED` (all roles)
  - ✅ `REQUEST.CANCELLED` (all roles)
- ✅ Connect socket events to Redux actions:
  - ✅ Dispatch `updateRequestFromSocket` on status changes
  - ✅ Update rider location in state
- ✅ Update `RequestTrackingScreen` to handle socket updates
- ❌ Show real-time rider movement on map (requires map library integration)
- ✅ Test socket reconnection handling (already exists in socket service)

### Push Notifications
- ✅ Integrate push notification service (FCM) (service structure complete, requires FCM credentials)
- ✅ Send push on status changes:
  - ✅ Merchant acceptance
  - ✅ Rider assignment
  - ✅ Order pickup
  - ✅ Order delivery
- ✅ Configure notification sound and vibration (configured in notification service)
- ❌ Test notification delivery (requires FCM credentials)

---

## Phase 4 — Admin Dashboard ✅ (Completed)

### Backend — Admin Endpoints
- ✅ Add admin-specific endpoints to request module:
  - ✅ Get all requests with advanced filtering (getAllRequests)
  - ✅ Reassign rider to request (reassignRider)
  - ✅ Force cancel request with reason (forceCancelRequest)
  - ✅ Update request status (admin override) (adminUpdateRequestStatus)
- ✅ Add admin-specific endpoints to merchant module:
  - ✅ List all merchants with filtering (getAllMerchants)
  - ✅ Approve merchant (approveMerchant)
  - ✅ Reject merchant (rejectMerchant)
  - ✅ Suspend merchant (suspendMerchant)
  - ✅ Unsuspend merchant (unsuspendMerchant)
  - ✅ Update merchant commission (updateMerchantCommission)
- ✅ Add rider management endpoints:
  - ✅ List all riders (getAllRiders)
  - ✅ List pending riders (getPendingRiders)
  - ✅ View rider details (basic implementation)
  - ✅ Update rider status (reviewRider)
  - ✅ View rider earnings (getRiderEarnings)
  - ✅ View rider delivery history (getRiderDeliveryHistory)
- ✅ User management endpoints:
  - ✅ Get all users with filtering (getAllUsers)
  - ✅ Update user status (updateUserStatus)
- ✅ Transaction oversight:
  - ✅ Get transactions overview (getTransactionOverview)
- ✅ Dashboard stats:
  - ✅ Get dashboard stats (getDashboardStats)
- ✅ Platform settings:
  - ✅ Get platform settings (getPlatformSettings)
  - ✅ Update platform settings (updatePlatformSettings)

### Frontend — Admin Dashboard (Web)
- ✅ Set up React web app (separate from mobile)
- ✅ Implement authentication with ADMIN role
- ✅ Create dashboard layout with sidebar navigation
- ✅ Build overview/metrics page:
  - ✅ Total requests count (UI exists, data from backend)
  - ✅ Active requests count (UI exists, data from backend)
  - ✅ Total revenue (UI exists, data from backend)
  - ✅ Total merchants (UI exists, data from backend)
  - ✅ Total riders (UI exists, data from backend)
  - ✅ Charts for trends (revenue and request trends using Recharts)
- ✅ Build requests management page:
  - ✅ Table of all requests with filtering (UI exists)
  - ✅ Filter by type, status, date range (UI exists)
  - ✅ View request details modal
  - ✅ Reassign rider action
  - ✅ Force cancel action
  - ✅ View transaction details
- ✅ Build merchants management page:
  - ✅ Table of all merchants (UI exists)
  - ✅ Filter by type, status (UI exists)
  - ✅ View merchant details modal
  - ✅ Approve pending merchants
  - ✅ Reject pending merchants
  - ✅ Suspend/unsuspend merchants
  - ✅ Update commission rates
  - ✅ View merchant wallet
- ✅ Build riders management page:
  - ✅ Table of all riders (UI exists)
  - ✅ Filter by status, availability (UI exists)
  - ✅ View rider details modal with tabs
  - ✅ View rider earnings
  - ✅ View rider delivery history
- ✅ Build users management page:
  - ✅ Table of all users (UI exists)
  - ✅ Filter by role, status (UI exists)
  - ✅ View user details modal
  - ✅ Suspend/unsuspend users
- ✅ Build transactions page:
  - ✅ Table of all transactions (UI exists)
  - ✅ Filter by type, status, date (UI exists)
  - ✅ View transaction details modal
- ✅ Build settings page:
  - ✅ Platform configuration
  - ✅ Commission rates defaults
  - ✅ Notification settings
- ✅ Create README.md for admin dashboard

---

## Phase 5 — Merchant Dashboard ✅ (Completed)

### Backend — Merchant Endpoints
- ✅ Add merchant-specific endpoints to merchant module:
  - ✅ Get merchant profile (getMerchantProfile)
  - ✅ Update merchant profile (updateMerchantProfile)
  - ✅ Get merchant orders (getMerchantOrders)
  - ✅ Accept/reject order (acceptMerchantOrder, rejectMerchantOrder)
  - ✅ Update order status (updateMerchantOrderStatus)
  - ✅ Get merchant wallet (getMerchantWallet)
  - ✅ Request withdrawal (requestMerchantWithdrawal)
- ✅ Add product management endpoints:
  - ✅ Create product (createMerchantProduct)
  - ✅ Update product (updateMerchantProduct)
  - ✅ Delete product (deleteMerchantProduct)
  - ✅ List products (getMerchantProducts)
  - ✅ Toggle availability (toggleMerchantProductAvailability)
- ✅ Add merchant analytics endpoints:
  - ✅ Get sales summary (getMerchantSalesSummary)
  - ✅ Get order history (getMerchantOrderHistory)
  - ✅ Get earnings breakdown (getMerchantEarningsBreakdown)
- ✅ Add Zod validation schemas for all merchant endpoints
- ✅ Register merchant routes in merchant.routes.js under /api/merchants/merchant

### Frontend — Merchant Dashboard (Web)
- ✅ Set up React web app with Vite
- ✅ Install dependencies (React, Redux Toolkit, React Router, Axios, Tailwind CSS, Recharts, Lucide React, date-fns)
- ✅ Configure Tailwind CSS and project structure
- ✅ Set up Redux store with slices (auth, orders, products, earnings, analytics, settings)
- ✅ Create API client (lib/api.js) with baseURL /api and auth interceptor
- ✅ Implement authentication with MERCHANT role (authSlice)
- ✅ Create login page with form validation
- ✅ Create merchant layout with sidebar navigation (Orders, Menu, Earnings, Analytics, Settings)
- ✅ Build orders page:
  - ✅ List of incoming orders with pagination
  - ✅ Status filter
  - ✅ Accept/reject order buttons
  - ✅ Update status to PROCESSING
  - ✅ Update status to READY_FOR_PICKUP
  - ✅ Order details modal
- ✅ Build menu management page:
  - ✅ List of products with search
  - ✅ Add new product form
  - ✅ Edit product form
  - ✅ Delete product action
  - ✅ Product availability toggle
- ✅ Build earnings page:
  - ✅ Wallet balance display (available vs pending)
  - ✅ Transaction history table
  - ✅ Withdrawal request form
- ✅ Build analytics page:
  - ✅ Sales summary cards
  - ✅ Revenue trend chart (LineChart)
  - ✅ Orders trend chart (BarChart)
  - ✅ Earnings breakdown
- ✅ Build settings page:
  - ✅ Profile settings form
  - ✅ Operating hours configuration
  - ✅ Notification preferences (toggle switches)
- ✅ Add route protection for authenticated merchants
- ✅ Update main.jsx with routing and Redux merchant
- ✅ Create README.md for merchant dashboard

---

## Phase 6 — Feature Expansion

### Grocery Implementation
- [ ] Add grocery-specific product attributes (weight, unit, category)
- [ ] Update checkout for grocery items (substitutions, quantity adjustments)
- [ ] Add grocery-specific status messages
- [ ] Test end-to-end grocery flow

### Pharmacy Implementation
- [ ] Add pharmacy-specific product attributes (prescription required, dosage)
- [ ] Add prescription upload flow
- [ ] Update checkout for pharmacy items (prescription validation)
- [ ] Add pharmacy-specific status messages
- [ ] Test end-to-end pharmacy flow

### Package Delivery Refinement
- [ ] Integrate package delivery with unified request system
- [ ] Update package creation to use `/api/requests` with type='PACKAGE'
- [ ] Update package tracking to use unified tracking screen
- [ ] Add package-specific fields (size, weight, description)
- [ ] Test end-to-end package flow

---

## Phase 7 — Enhancements

### Customer App Enhancements
- [ ] Add saved addresses management
- [ ] Add order history page
- [ ] Add favorites/bookmarked merchants
- [ ] Add search functionality for merchants
- [ ] Add filters (rating, price, distance, delivery time)
- [ ] Add reorder functionality
- [ ] Add split payment options
- [ ] Add promo code/discount system

### Rider App (New)
- [ ] Create rider mobile app (React Native)
- [ ] Implement rider authentication
- [ ] Build job acceptance screen
- [ ] Build navigation screen (pickup → delivery)
- [ ] Implement location tracking
- [ ] Add earnings page
- [ ] Add availability toggle
- [ ] Add notification handling

### Performance Optimization
- [ ] Implement API response caching
- [ ] Optimize database queries with indexes
- [ ] Implement pagination for all list endpoints
- [ ] Add rate limiting
- [ ] Optimize image loading with CDN
- [ ] Implement lazy loading for screens

### Testing
- [ ] Write unit tests for backend services
- [ ] Write integration tests for API endpoints
- [ ] Write E2E tests for critical flows
- [ ] Add load testing
- [ ] Set up CI/CD pipeline

### Security
- [ ] Implement rate limiting
- [ ] Add request validation
- [ ] Implement input sanitization
- [ ] Add SQL injection prevention
- [ ] Implement CORS properly
- [ ] Add security headers
- [ ] Regular security audits

---

## Phase 8 — Production Readiness

### Deployment
- [ ] Set up production database
- [ ] Configure environment variables
- [ ] Set up Redis for production
- [ ] Set up BullMQ for production
- [ ] Configure SSL certificates
- [ ] Set up monitoring (Sentry, DataDog)
- [ ] Set up logging
- [ ] Configure backup strategy
- [ ] Set up CDN for assets
- [ ] Deploy backend to production
- [ ] Deploy customer app to stores
- [ ] Deploy admin dashboard
- [ ] Deploy merchant dashboard

### Documentation
- [ ] Update API documentation
- [ ] Create deployment guide
- [ ] Create troubleshooting guide
- [ ] Create user manuals
- [ ] Create admin guide
- [ ] Create merchant guide

### Launch
- [ ] Beta testing with small user group
- [ ] Collect feedback
- [ ] Fix critical bugs
- [ ] Full launch
- [ ] Monitor performance
- [ ] Handle support tickets
- [ ] Iterate based on feedback

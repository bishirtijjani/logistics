# Logistics: Delivery App

A complete on-demand delivery platform: customers order from local merchants or send packages, riders are dispatched automatically, and payments move through an escrow-backed wallet. It ships as **React Native apps** for customers, riders and merchants, **web dashboards** for admins and merchants, and a **Node.js backend**.

**Live on the iOS App Store and Google Play.**

## Highlights
- **Automatic rider dispatch:** riders live in a Redis geo index; the matcher offers each job to the nearest available riders in an expanding search radius, with timed offers, missed-offer tracking and availability reconciliation so "online" always means reachable.
- **Real-time tracking:** rider GPS streams live over Socket.IO, and customers follow every stage of the order, from request through pickup to delivery.
- **Escrow-backed payments:** wallet orders are held in platform escrow and released on delivery, then split automatically into platform, rider and merchant earnings (with per-merchant commission rates and history). Cash orders are supported too.
- **Money you can audit:** idempotency keys on payment endpoints, a stored webhook event log, a full audit log, and a daily **ledger reconciliation** job that proves every wallet balance equals the sum of its transactions.
- **Bill payments built in:** airtime, data, electricity, cable TV and education PINs, plus airtime-to-cash, routed across multiple providers with failover; saved beneficiaries for repeat payments.
- **Tested:** an automated backend test suite.

## What's inside
| App | Who uses it | Key screens / features |
|---|---|---|
| **Customer app** (React Native) | Shoppers & senders | Browse merchants and menus, cart & checkout, send a package, live trip tracking, ratings, receipts, wallet funding & P2P transfers, bill payments, saved addresses, disputes & support tickets |
| **Rider app** (React Native) | Delivery riders | Job offers with countdown, trip cockpit, earnings dashboard & breakdown, performance stats, wallet & withdrawals, KYC status, vehicle info (motorcycle / bicycle / car / van), biometric login |
| **Merchant app** (React Native) | Merchants on the go | Incoming orders and order details, notifications, quick access to the merchant dashboard |
| **Merchant dashboard** (React) | Merchants | Orders, menu & product variants, earnings, bills, analytics, marketing, disputes, support, self-registration |
| **Admin dashboard** (React) | Operations team | Live requests, riders, merchants (+ products & analytics), customers, transactions & financials, disputes, support, marketing (banners, discount codes, campaigns), VTU networks & plans, safety, staff roles, audit log, analytics |

## Security & reliability
- Transaction PIN, biometric login, session management and BVN-based KYC verification
- Role-based access control, request IDs, rate limiting and schema validation on every route
- Background work (notifications, payments, dispatch, utilities) runs in dedicated BullMQ workers
- Notifications across push (FCM), web push, in-app notification centre, SMS, email and WhatsApp

## System Overview

| Component | Technology |
|---|---|
| Mobile Apps | React Native (Expo) |
| Backend API | Node.js + Express |
| Database | PostgreSQL + Prisma ORM |
| Real-Time | Socket.io |
| Caching | Redis |
| Background Jobs | BullMQ |
| Wallet / Withdrawals | KatPay |
| Virtual Accounts | KatPay |
| Utility Payments | AlRahuz |
| Maps | Google Maps Platform |
| Notifications | Firebase FCM |
| SMS/OTP | Termii |
| Email | SMTP (nodemailer) |
| Image Uploads | Cloudinary |

## Project Structure

```
logistics-app/
├── backend/                    # Express API server
│   ├── prisma/                 # Database schema & migrations
│   │   └── schema.prisma       # Single source of truth for data models
│   └── src/
│       ├── config/             # Environment, database, Redis config
│       ├── middlewares/        # Auth, validation, roles, error handling
│       ├── modules/            # Feature modules
│       │   ├── auth/           # Registration, login, OTP, PIN, sessions
│       │   ├── wallet/         # Balance, transfers, withdrawals
│       │   ├── request/        # Unified request lifecycle (food, package, grocery, pharmacy)
│       │   ├── merchant/       # Merchant profiles, products, wallet
│       │   ├── delivery/       # Legacy delivery module (being migrated to request)
│       │   ├── utility/        # Airtime, data, electricity
│       │   ├── rider/          # Rider profile, availability, jobs
│       │   ├── admin/          # Platform management
│       │   ├── maps/           # Distance, geocoding, autocomplete
│       │   ├── settings/       # Platform configuration
│       │   └── webhook/        # Inbound payment events
│       ├── services/           # External API integrations
│       │   ├── katpay.service.js     # Wallet funding, virtual accounts, withdrawals
│       │   ├── alrahuz.service.js    # Utility payments (airtime/data/electricity)
│       │   ├── maps.service.js       # Google Maps
│       │   ├── termii.service.js     # SMS/OTP
│       │   ├── email.service.js      # Transactional email
│       │   ├── notify.service.js     # Unified push + socket + DB notifications
│       │   └── settings.service.js   # Platform settings cache
│       ├── sockets/            # Socket.io events and handlers
│       ├── queues/             # BullMQ jobs and workers
│       └── utils/              # Shared utilities
├── admin-dashboard/            # React (Vite) admin panel
├── merchant-dashboard/         # React (Vite) merchant panel
├── mobile/
│   ├── customer-app/           # Customer-facing Expo app
│   └── rider-app/              # Rider-facing Expo app
└── docs/                       # Architecture and API documentation
```

## Core Modules

### 1. Digital Wallet
- Virtual bank account per user (via KatPay)
- Wallet funding via bank transfer (webhooks)
- Peer-to-peer transfers (internal ledger)
- Bank withdrawals (via KatPay)
- Transaction PIN authorization
- Full transaction history

### 2. Utility Payments
- Airtime & data (MTN, Airtel, Glo, 9mobile) via AlRahuz
- Electricity payments (all DISCOs) via AlRahuz
- Instant wallet deduction with async fulfillment
- Failed calls trigger automatic refunds

### 3. Unified Request System
All business activity flows through a single `Request` model:

| Type | Flow |
|---|---|
| `PACKAGE` | Customer → Rider → Delivered (no merchant) |
| `FOOD` | Customer → Restaurant → Rider → Delivered |
| `GROCERY` | Customer → Supermarket → Rider → Delivered |
| `PHARMACY` | Customer → Pharmacy → Rider → Delivered |

**Lifecycle:** `REQUESTED → ACCEPTED → PROCESSING → READY_FOR_PICKUP → RIDER_ASSIGNED → RIDER_EN_ROUTE → PICKED_UP → IN_TRANSIT → DELIVERED → SETTLED`

- Distance-based fare calculation via Google Maps
- Rider matching (broadcast to nearby available riders)
- Live GPS tracking (Socket.io, updates every ~3s)
- Automatic wallet payment on completion with merchant/rider/platform splits
- Rating system

## Documentation

| Document | Description |
|---|---|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System diagrams, data flows, real-time design |
| [API_CONTRACT.md](docs/API_CONTRACT.md) | All API endpoints with request/response formats |
| [ENVIRONMENT.md](docs/ENVIRONMENT.md) | Required environment variables |
| [SOCKET_ARCHITECTURE.md](docs/SOCKET_ARCHITECTURE.md) | Socket.io events, payloads, rooms |
| [UNIFIED_REQUEST_ARCHITECTURE.md](docs/UNIFIED_REQUEST_ARCHITECTURE.md) | Unified request design rationale |
| [CONVENTIONS.md](CONVENTIONS.md) | Engineering rules and coding standards |
| [FEATURE_TEMPLATE.md](FEATURE_TEMPLATE.md) | How to add new features |
| [ROADMAP.md](ROADMAP.md) | Implementation phase tracking |
| [CUSTOMER_APP_ROADMAP.md](CUSTOMER_APP_ROADMAP.md) | Detailed customer app production roadmap |
| [docs/providers/](docs/providers/) | Third-party API references (AlRahuz, BilalsadaSub) |

## Getting Started

### Prerequisites
- Node.js >= 20
- PostgreSQL >= 15
- Redis >= 7
- Expo CLI

### Backend Setup

```bash
cd backend
cp .env.example .env          # Fill in your credentials
npm install
npx prisma generate           # Generate Prisma client
npx prisma migrate dev        # Run database migrations
npm run dev                   # Start development server
```

### Mobile Setup

```bash
cd mobile/customer-app
npm install
npx expo start

# In a separate terminal:
cd mobile/rider-app
npm install
npx expo start
```

### Dashboard Setup

```bash
cd admin-dashboard
npm install
npm run dev     # http://localhost:5174

cd merchant-dashboard
npm install
npm run dev     # http://localhost:5173
```

## Key Design Decisions

1. **Everything is a Request** - Food, grocery, pharmacy, and package delivery all use the same `Request` model, lifecycle, tracking screen, and financial settlement. Adding a new type is a one-line enum change.
2. **Financial safety first** - All wallet operations use Prisma `$transaction()` with balance snapshots. No direct balance mutation without a `Transaction` record.
3. **Debit-first for utilities** - Wallet is deducted immediately, AlRahuz call happens async in a queue. Failed calls trigger automatic refunds.
4. **Redis for hot data** - Rider locations, availability, and active delivery sessions live in Redis. Database is the source of truth, Redis is the speed layer.
5. **Queue everything external** - All third-party API calls (KatPay, AlRahuz, FCM, Termii) go through BullMQ with automatic retries and failure handling.
6. **Socket rooms for isolation** - Each request gets a dedicated room. Only the customer, assigned rider, and merchant receive tracking updates.

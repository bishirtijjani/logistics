# iPrime

A mobile super-app for Android and iOS targeting users across Katsina State, Nigeria. The platform brings together digital wallet services, utility bill payments, and delivery logistics under a single app.

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

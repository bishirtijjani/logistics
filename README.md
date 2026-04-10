# VTU & Logistics Platform

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
| Payments | Monnify |
| Utilities | VTPass |
| Maps | Google Maps Platform |
| Notifications | Firebase FCM |
| SMS/OTP | Termii |

## Project Structure

```
logistics-app/
├── backend/                    # Express API server
│   ├── prisma/                 # Database schema & migrations
│   │   └── schema.prisma       # Single source of truth for data models
│   └── src/
│       ├── config/             # Environment, database, Redis config
│       ├── middlewares/        # Auth, validation, roles, error handling
│       ├── modules/            # Feature modules (auth, wallet, delivery, etc.)
│       ├── services/           # External API integrations
│       ├── sockets/            # Socket.io events and handlers
│       ├── queues/             # BullMQ jobs and workers
│       └── utils/              # Shared utilities
├── mobile/
│   ├── customer-app/           # Customer-facing Expo app
│   └── rider-app/              # Rider-facing Expo app
└── docs/                       # Architecture and API documentation
```

## Core Modules

### 1. Digital Wallet
- Virtual bank account per user (via Monnify)
- Wallet funding via bank transfer (webhooks)
- Peer-to-peer transfers (internal ledger)
- Bank withdrawals
- Transaction PIN authorization
- Full transaction history

### 2. Utility Payments
- Airtime & data (MTN, Airtel, Glo, 9mobile)
- Electricity payments (all DISCOs)
- Instant wallet deduction with async fulfillment
- Bill history

### 3. Delivery & Logistics
- Customer creates delivery request (pickup + dropoff on map)
- Distance-based fare calculation
- Rider matching (broadcast to nearby available riders)
- Delivery lifecycle: `REQUESTED → MATCHED → RIDER_EN_ROUTE → PICKED_UP → IN_TRANSIT → DELIVERED → SETTLED`
- Live GPS tracking (Socket.io, updates every ~3s)
- Automatic wallet payment on completion
- Rating system

## Documentation

| Document | Description |
|---|---|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System diagrams, data flows, real-time design |
| [API_CONTRACT.md](docs/API_CONTRACT.md) | All API endpoints with request/response formats |
| [ENVIRONMENT.md](docs/ENVIRONMENT.md) | Required environment variables |
| [SOCKET_ARCHITECTURE.md](docs/SOCKET_ARCHITECTURE.md) | Socket.io events, payloads, rooms |
| [CONVENTIONS.md](CONVENTIONS.md) | Engineering rules and coding standards |
| [FEATURE_TEMPLATE.md](FEATURE_TEMPLATE.md) | How to add new features |

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
npx prisma migrate dev         # Run database migrations
npm run dev                    # Start development server
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

## Key Design Decisions

1. **Financial safety first** — All wallet operations use Prisma `$transaction()` with balance snapshots. No direct balance mutation without a Transaction record.
2. **Debit-first for utilities** — Wallet is deducted immediately, VTPass call happens async in a queue. Failed calls trigger automatic refunds.
3. **Redis for hot data** — Rider locations, availability, and active delivery sessions live in Redis. Database is the source of truth, Redis is the speed layer.
4. **Queue everything external** — All third-party API calls (Monnify, VTPass, FCM, Termii) go through BullMQ with automatic retries and failure handling.
5. **Socket rooms for isolation** — Each delivery gets a dedicated room. Only the customer and assigned rider receive tracking updates.

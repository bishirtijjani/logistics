# System Architecture

## 1. High-Level System Diagram

```mermaid
graph TB
    subgraph Clients
        CA["Customer App<br/>(React Native/Expo)"]
        RA["Rider App<br/>(React Native/Expo)"]
        AD["Admin Dashboard<br/>(React/Vite)"]
        MD["Merchant Dashboard<br/>(React/Vite)"]
    end

    subgraph Backend
        API["Express API Server<br/>/*"]
        WS["Socket.io Server<br/>(Real-Time)"]
        BQ["BullMQ Workers<br/>(Background Jobs)"]
    end

    subgraph Data Layer
        PG["PostgreSQL<br/>(Primary Database)"]
        RD["Redis<br/>(Cache + Queues)"]
    end

    subgraph External Services
        KP["KatPay<br/>(Wallet / Virtual Accounts / Withdrawals)"]
        AR["AlRahuz<br/>(Utility Payments)"]
        GM["Google Maps<br/>(Distance/Routes)"]
        FCM["Firebase FCM<br/>(Push Notifications)"]
        TM["Termii<br/>(SMS/OTP)"]
        CL["Cloudinary<br/>(Image Uploads)"]
    end

    CA <-->|HTTPS + JWT| API
    CA <-->|WebSocket + JWT| WS
    RA <-->|HTTPS + JWT| API
    RA <-->|WebSocket + JWT| WS
    AD <-->|HTTPS + JWT| API
    MD <-->|HTTPS + JWT| API

    API --> PG
    API --> RD
    WS --> RD
    BQ --> PG
    BQ --> RD

    BQ --> KP
    BQ --> AR
    BQ --> FCM
    BQ --> TM
    API --> GM
    API --> CL

    KP -->|Webhook| API
```

## 2. Wallet Money Flow

```mermaid
flowchart LR
    subgraph Funding
        Bank["User's Bank App"] -->|Bank Transfer| VA["Virtual Account<br/>(KatPay)"]
        VA -->|Webhook| API["Backend API"]
        API -->|Queue Job| BQ["Payment Worker"]
        BQ -->|Credit| W["User Wallet"]
    end

    subgraph P2P Transfer
        W -->|Debit Sender| TX1["Transaction Record<br/>(SENT)"]
        TX1 -->|Credit Recipient| W2["Recipient Wallet"]
        W2 --> TX2["Transaction Record<br/>(RECEIVED)"]
    end

    subgraph Request Payment
        W -->|Escrow Hold| ESC["Platform Escrow"]
        ESC -->|On SETTLED| SP["Settlement Split"]
        SP --> MW["Merchant Wallet"]
        SP --> RW["Rider Wallet"]
        SP --> PL["Platform Revenue"]
    end

    subgraph Withdrawal
        W -->|Debit| WD["Withdrawal Request"]
        WD -->|Queue Job| BQ2["Payment Worker"]
        BQ2 -->|Disbursement API| KP["KatPay"]
        KP -->|Bank Transfer| UB["User's Bank"]
    end
```

## 3. Unified Request Lifecycle State Machine

```mermaid
stateDiagram
    [*] --> REQUESTED: Customer submits request

    REQUESTED --> ACCEPTED: Merchant accepts (food/grocery/pharmacy)
    REQUESTED --> RIDER_ASSIGNED: System assigns rider (package — skips merchant phase)
    REQUESTED --> CANCELLED: Customer cancels / Timeout

    ACCEPTED --> PROCESSING: Merchant begins preparation
    ACCEPTED --> CANCELLED: Either party cancels

    PROCESSING --> READY_FOR_PICKUP: Merchant marks ready

    READY_FOR_PICKUP --> RIDER_ASSIGNED: System assigns rider

    RIDER_ASSIGNED --> RIDER_EN_ROUTE: Rider starts navigation
    RIDER_ASSIGNED --> CANCELLED: Rider cancels

    RIDER_EN_ROUTE --> PICKED_UP: Rider confirms pickup
    RIDER_EN_ROUTE --> CANCELLED: Issue at pickup

    PICKED_UP --> IN_TRANSIT: Rider starts delivery

    IN_TRANSIT --> DELIVERED: Rider confirms delivery

    DELIVERED --> SETTLED: Payment splits processed

    SETTLED --> [*]
    CANCELLED --> [*]
```

### Valid State Transitions

| Current State | Allowed Next States | Notes |
|---|---|---|
| `REQUESTED` | `ACCEPTED`, `RIDER_ASSIGNED`, `CANCELLED` | PACKAGE skips directly to RIDER_ASSIGNED |
| `ACCEPTED` | `PROCESSING`, `CANCELLED` | Food/grocery/pharmacy only |
| `PROCESSING` | `READY_FOR_PICKUP` | Merchant marks item ready |
| `READY_FOR_PICKUP` | `RIDER_ASSIGNED` | System triggers rider matching |
| `RIDER_ASSIGNED` | `RIDER_EN_ROUTE`, `CANCELLED` | |
| `RIDER_EN_ROUTE` | `PICKED_UP`, `CANCELLED` | |
| `PICKED_UP` | `IN_TRANSIT` | |
| `IN_TRANSIT` | `DELIVERED` | |
| `DELIVERED` | `SETTLED` | |
| `SETTLED` | (terminal) | |
| `CANCELLED` | (terminal) | |

## 4. Real-Time Socket Event Flow

```mermaid
sequenceDiagram
    participant C as Customer App
    participant S as Socket Server
    participant M as Merchant Dashboard
    participant R as Rider App
    participant RD as Redis

    Note over C,R: 1. Connection
    C->>S: Connect (JWT token)
    S->>S: Verify JWT, join user:{userId}
    R->>S: Connect (JWT token)
    S->>S: Verify JWT, join user:{userId} + riders:available
    M->>S: Connect (JWT token)
    S->>S: Verify JWT, join merchant:{merchantId}

    Note over C,R: 2. Request Created (Food)
    C->>S: REST: POST /requests { type: FOOD }
    S->>M: request:created (via merchant:{merchantId} room)

    Note over C,R: 3. Merchant Accepts
    M->>S: REST: PATCH /requests/:id/status { status: ACCEPTED }
    S->>C: request:merchant:accepted

    Note over C,R: 4. Rider Assigned
    S->>R: rider:job:new (via riders:available room)
    R->>S: rider:job:accept { requestId }
    S->>C: request:rider:assigned { rider info }
    C->>S: request:room:join { requestId }
    R->>S: request:room:join { requestId }

    Note over C,R: 5. Live Tracking
    loop Every 3 seconds
        R->>S: rider:location:update { lat, lng, requestId }
        S->>RD: Store location in Redis (TTL 30s)
        S->>C: request:rider:location { lat, lng, timestamp }
    end

    Note over C,R: 6. Delivery Complete
    S->>C: request:completed { requestId }
    S->>C: wallet:balance:updated { newBalance }
    S->>R: wallet:balance:updated { newBalance }
    S->>M: wallet:balance:updated { merchantEarning }
```

## 5. Queue + Redis Integration

### Redis Usage Map

| Key Pattern | Data Type | TTL | Purpose |
|---|---|---|---|
| `rider:location:{riderId}` | JSON string | 30s | Latest rider GPS position |
| `rider:availability:{riderId}` | String | 1h | Rider online status |
| `request:active:{requestId}` | JSON string | 24h | Active request session cache |
| `otp:{phone}` | String | 10min | OTP code for verification |
| `session:{userId}` | String | 7d | Session tracking |
| `ratelimit:{ip}:{endpoint}` | Counter | varies | Rate limiting |
| `settings:{key}` | JSON string | until invalidated | Platform settings cache |

### Queue Processing Flow

```mermaid
graph LR
    subgraph Producers
        WH["Webhook Controller"]
        WS["Wallet Service"]
        RS["Request Service"]
        US["Utility Service"]
    end

    subgraph Queues in Redis
        PQ["payment-queue"]
        NQ["notification-queue"]
        RQ["request-queue"]
        UQ["utility-queue"]
    end

    subgraph Workers
        PW["Payment Worker<br/>(5 concurrent, 10/s limit)"]
        NW["Notification Worker<br/>(10 concurrent)"]
        RW["Request Worker<br/>(5 concurrent)"]
        UW["Utility Worker<br/>(5 concurrent)"]
    end

    WH --> PQ
    WS --> PQ
    RS --> RQ
    RS --> NQ
    US --> UQ
    US --> NQ

    PQ --> PW
    NQ --> NW
    RQ --> RW
    UQ --> UW

    PW -->|Retry 3x| PQ
    UW -->|Retry 3x| UQ
    UW -->|All retries failed| REFUND["Auto-Refund Job"]
```

## 6. Caching Strategy

| Data | Storage | Why |
|---|---|---|
| Rider GPS location | Redis only (30s TTL) | Updates every ~3s — too frequent for DB. Stale data self-expires. |
| Rider availability | Redis + DB | Redis for fast lookup, DB for persistence. |
| Active request sessions | Redis + DB | Redis for Socket.io room lookups, DB for durability. |
| OTP codes | Redis only | Short-lived, no persistence needed. |
| Platform settings | Redis (invalidated on update) | Avoid DB hit on every request. |
| Wallet balances | DB only | Financial data — always from source of truth. |
| Transaction history | DB only | Append-only ledger — no caching. |

## 7. Data Model Summary

See `backend/prisma/schema.prisma` for the complete schema. Key models:

| Model | Purpose | Key Relations |
|---|---|---|
| `User` | Core identity (customer, rider, admin) | Has one `Wallet`, optional `Rider` profile, optional `Merchant` |
| `Wallet` | Financial balance + virtual account | Has many `Transaction` (debit/credit) |
| `Transaction` | Immutable financial ledger entry | Links to debit and/or credit wallet |
| `Request` | Unified request lifecycle (food/grocery/pharmacy/package) | Belongs to `User` (customer), optional `Merchant`, optional `Rider` |
| `RequestItem` | Line items for catalog-based requests | Belongs to `Request`, optional `Product` |
| `PackageDetail` | Package-specific fields | Belongs to `Request` (one-to-one) |
| `Merchant` | Restaurant, supermarket, pharmacy, etc. | Has `MerchantWallet`, many `Product`, many `Request` |
| `MerchantWallet` | Merchant earnings (available + pending) | Belongs to `Merchant` |
| `Product` | Merchant product catalog | Belongs to `Merchant` |
| `Rider` | Rider profile + verification | Belongs to `User`, has many `Request` |
| `Rating` | Post-delivery rating | Links `Request`, `Rider`, `User` |
| `SavedBeneficiary` | Quick-access contacts/accounts | Belongs to `User` |
| `Session` | JWT refresh token tracking | Belongs to `User` |
| `WebhookEvent` | External webhook audit log | Standalone |
| `AuditLog` | Admin action audit trail | Standalone |

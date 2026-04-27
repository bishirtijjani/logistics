# System Architecture

## 1. High-Level System Diagram

```mermaid
graph TB
    subgraph Mobile Apps
        CA["Customer App<br/>(React Native/Expo)"]
        RA["Rider App<br/>(React Native/Expo)"]
    end

    subgraph Backend
        API["Express API Server<br/>/api/*"]
        WS["Socket.io Server<br/>(Real-Time)"]
        BQ["BullMQ Workers<br/>(Background Jobs)"]
    end

    subgraph Data Layer
        PG["PostgreSQL<br/>(Primary Database)"]
        RD["Redis<br/>(Cache + Queues)"]
    end

    subgraph External Services
        MN["Monnify<br/>(Payments)"]
        VT["VTPass<br/>(Utilities)"]
        GM["Google Maps<br/>(Distance/Routes)"]
        FCM["Firebase FCM<br/>(Push Notifications)"]
        TM["Termii<br/>(SMS/OTP)"]
    end

    CA <-->|HTTPS + JWT| API
    CA <-->|WebSocket + JWT| WS
    RA <-->|HTTPS + JWT| API
    RA <-->|WebSocket + JWT| WS

    API --> PG
    API --> RD
    WS --> RD
    BQ --> PG
    BQ --> RD

    BQ --> MN
    BQ --> VT
    BQ --> FCM
    BQ --> TM
    API --> GM

    MN -->|Webhook| API
```

## 2. Wallet Money Flow

```mermaid
flowchart LR
    subgraph Funding
        Bank["User's Bank App"] -->|Bank Transfer| VA["Virtual Account<br/>(Monnify)"]
        VA -->|Webhook| API["Backend API"]
        API -->|Queue Job| BQ["Payment Worker"]
        BQ -->|Credit| W["User Wallet"]
    end

    subgraph P2P Transfer
        W -->|Debit Sender| TX1["Transaction Record<br/>(SENT)"]
        TX1 -->|Credit Recipient| W2["Recipient Wallet"]
        W2 --> TX2["Transaction Record<br/>(RECEIVED)"]
    end

    subgraph Payment
        W -->|Debit| UP["Utility Payment"]
        W -->|Debit| DP["Delivery Payment"]
    end

    subgraph Withdrawal
        W -->|Debit| WD["Withdrawal Request"]
        WD -->|Queue Job| BQ2["Payment Worker"]
        BQ2 -->|Disbursement API| MN["Monnify"]
        MN -->|Bank Transfer| UB["User's Bank"]
    end
```

## 3. Delivery Lifecycle State Machine

```mermaid
stateDiagram
    [*] --> REQUESTED: Customer submits order

    REQUESTED --> MATCHED: Rider accepts job
    REQUESTED --> CANCELLED: Customer cancels / Timeout

    MATCHED --> RIDER_EN_ROUTE: Rider starts navigation
    MATCHED --> CANCELLED: Either party cancels

    RIDER_EN_ROUTE --> PICKED_UP: Rider confirms pickup
    RIDER_EN_ROUTE --> CANCELLED: Issue at pickup

    PICKED_UP --> IN_TRANSIT: Rider starts delivery

    IN_TRANSIT --> DELIVERED: Rider confirms delivery

    DELIVERED --> SETTLED: Payment processed

    SETTLED --> [*]
    CANCELLED --> [*]
```

### Valid State Transitions

| Current State | Allowed Next States |
|---|---|
| `REQUESTED` | `MATCHED`, `CANCELLED` |
| `MATCHED` | `RIDER_EN_ROUTE`, `CANCELLED` |
| `RIDER_EN_ROUTE` | `PICKED_UP`, `CANCELLED` |
| `PICKED_UP` | `IN_TRANSIT` |
| `IN_TRANSIT` | `DELIVERED` |
| `DELIVERED` | `SETTLED` |
| `SETTLED` | (terminal) |
| `CANCELLED` | (terminal) |

## 4. Real-Time Socket Event Flow

```mermaid
sequenceDiagram
    participant C as Customer App
    participant S as Socket Server
    participant R as Rider App
    participant RD as Redis

    Note over C,R: 1. Connection
    C->>S: Connect (JWT token)
    S->>S: Verify JWT, join user:{userId}
    R->>S: Connect (JWT token)
    S->>S: Verify JWT, join user:{userId} + riders:available

    Note over C,R: 2. Order Created
    C->>S: REST: POST /delivery/orders
    S->>R: rider:job:new (via riders:available room)

    Note over C,R: 3. Rider Accepts
    R->>S: rider:job:accept { orderId }
    S->>C: delivery:rider:assigned { rider info }
    S->>S: Create delivery:{orderId} room
    C->>S: delivery:room:join { orderId }
    R->>S: delivery:room:join { orderId }

    Note over C,R: 4. Live Tracking
    loop Every 3 seconds
        R->>S: rider:location:update { lat, lng, orderId }
        S->>RD: Store location in Redis
        S->>C: rider:location:broadcast { lat, lng }
    end

    Note over C,R: 5. Status Updates
    R->>S: REST: PATCH /delivery/orders/:id/status
    S->>C: delivery:status:changed { status }

    Note over C,R: 6. Delivery Complete
    S->>C: delivery:completed { orderId }
    S->>C: wallet:balance:updated { newBalance }
    S->>R: wallet:balance:updated { newBalance }
```

## 5. Queue + Redis Integration

### Redis Usage Map

| Key Pattern | Data Type | TTL | Purpose |
|---|---|---|---|
| `rider:location:{riderId}` | JSON string | 30s | Latest rider GPS position |
| `rider:availability:{riderId}` | String | 1h | Rider online status |
| `delivery:active:{deliveryId}` | JSON string | 24h | Active delivery session cache |
| `otp:{phone}` | String | 10min | OTP code for verification |
| `session:{userId}` | String | 7d | Session tracking |
| `ratelimit:{ip}:{endpoint}` | Counter | varies | Rate limiting |

### Queue Processing Flow

```mermaid
graph LR
    subgraph Producers
        WH["Webhook Controller"]
        WS["Wallet Service"]
        DS["Delivery Service"]
        US["Utility Service"]
    end

    subgraph Queues in Redis
        PQ["payment-queue"]
        NQ["notification-queue"]
        DQ["delivery-queue"]
        UQ["utility-queue"]
    end

    subgraph Workers
        PW["Payment Worker<br/>(5 concurrent, 10/s limit)"]
        NW["Notification Worker<br/>(10 concurrent)"]
        DW["Delivery Worker<br/>(5 concurrent)"]
        UW["Utility Worker<br/>(5 concurrent)"]
    end

    WH --> PQ
    WS --> PQ
    DS --> DQ
    DS --> NQ
    US --> UQ
    US --> NQ

    PQ --> PW
    NQ --> NW
    DQ --> DW
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
| Active delivery sessions | Redis + DB | Redis for Socket.io room lookups, DB for durability. |
| OTP codes | Redis only | Short-lived, no persistence needed. |
| Wallet balances | DB only | Financial data — always from source of truth. |
| Transaction history | DB only | Append-only ledger — no caching. |
| Data plans (VTPass) | Consider Redis cache (5min TTL) | Reduce API calls to VTPass. |

## 7. Data Model Summary

See `backend/prisma/schema.prisma` for the complete schema. Key models:

| Model | Purpose | Key Relations |
|---|---|---|
| `User` | Core identity (customer, rider, admin) | Has one `Wallet`, optional `Rider` profile |
| `Wallet` | Financial balance + virtual account | Has many `Transaction` (debit/credit) |
| `Transaction` | Immutable financial ledger entry | Links to debit and/or credit wallet |
| `DeliveryOrder` | Delivery lifecycle tracking | Belongs to customer `User`, optional `Rider` |
| `Rider` | Rider profile + verification | Belongs to `User`, has many `DeliveryOrder` |
| `UtilityPayment` | Bill payment records | Belongs to `User` |
| `Rating` | Post-delivery rating | Links `DeliveryOrder`, `Rider`, `User` |
| `SavedBeneficiary` | Quick-access contacts/accounts | Belongs to `User` |
| `Session` | JWT refresh token tracking | Belongs to `User` |
| `WebhookEvent` | External webhook audit log | Standalone |

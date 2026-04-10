# Engineering Conventions

> **This document is LAW.** Every contributor and every AI assistant MUST follow these rules without exception. Violations cause bugs, data loss, and inconsistency.

---

## 1. Folder Structure Rules

### Backend (`backend/src/`)

| Folder | Purpose | Rules |
|---|---|---|
| `modules/` | Feature modules (auth, wallet, delivery, utility, rider, admin, webhook) | One folder per domain. Each module has: `*.routes.js`, `*.controller.js`, `*.service.js`, `*.validator.js` |
| `services/` | External API integrations (Monnify, VTPass, Maps, FCM, Termii) | One file per provider. No business logic — only API communication |
| `middlewares/` | Express middleware (auth, validation, roles, errors) | Shared across all modules. Never module-specific |
| `sockets/` | Socket.io events and handlers | Events in `events.js`. One handler file per domain |
| `queues/` | BullMQ jobs and workers | Job types in `jobs.js`. One worker file per queue |
| `utils/` | Shared utilities (responses, errors, constants, logger) | No business logic. Pure helper functions |
| `config/` | Configuration (env, database, redis) | Singleton instances. Never instantiate Prisma/Redis elsewhere |

### Mobile (`mobile/*/src/`)

| Folder | Purpose |
|---|---|
| `features/` | Feature modules. Each has: `screens/`, `components/`, `slice.js`, `service.js` |
| `store/` | Redux store configuration and slice barrel exports |
| `services/` | API client (Axios), Socket client |
| `navigation/` | React Navigation stack and tab definitions |
| `components/` | Shared/reusable UI components |

---

## 2. Naming Conventions

### Files
- All lowercase, dot-separated: `wallet.service.js`, `auth.controller.js`
- Module files MUST follow the pattern: `{module}.{type}.js`
- Types: `routes`, `controller`, `service`, `validator`

### Variables & Functions
- `camelCase` for variables, functions, and methods
- Descriptive names: `getTransactionHistory`, not `getTxHist`

### Constants
- `UPPER_SNAKE_CASE` for constants: `REDIS_KEYS`, `DELIVERY_TRANSITIONS`

### Database
- Tables: `snake_case` plural (enforced via `@@map`)
- Columns: `camelCase` (Prisma convention)
- Enums: `PascalCase` enum name, `UPPER_SNAKE_CASE` values

---

## 3. API Rules

### Request/Response Envelope
Every API response follows this format:
```json
{
  "success": true,
  "message": "Human-readable message",
  "data": {},
  "meta": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 }
}
```

### Controller Rules
- Controllers NEVER access the database directly
- Controllers NEVER contain business logic
- Controllers call service methods and format responses using `ApiResponse`
- Controllers pass errors to `next(error)` — never catch and swallow

### Service Rules
- Services contain ALL business logic
- Services access the database ONLY through Prisma
- Services throw `AppError` for business rule violations
- Services NEVER access `req` or `res`

### Route Rules
- All routes are prefixed with `/api/v1/`
- Apply `authenticate` middleware for protected routes
- Apply `authorize('ROLE')` for role-restricted routes
- Apply `validate(schema)` for request validation
- Middleware order: `authenticate → authorize → validate → controller`

---

## 4. Prisma / Database Rules

> **THESE ARE NON-NEGOTIABLE FOR FINANCIAL SAFETY**

1. **Prisma is the ONLY way to access the database.** No raw SQL. Ever.
2. **Every wallet balance change MUST use `prisma.$transaction()`**
3. **Every wallet balance change MUST create a `Transaction` record**
4. **Every `Transaction` record MUST include `balanceBefore` and `balanceAfter`**
5. **Check balance INSIDE the transaction, not before it**
6. **Use `reference` field for idempotency — always check for duplicates**
7. **Never update a Transaction record's status from `COMPLETED` to anything else**
8. **Transactions are append-only. Never delete.**
9. **Use `Decimal` for all monetary amounts. Never `Float`.**
10. **Always include `createdAt` and `updatedAt` on every model**

### Transaction Pattern
```javascript
await prisma.$transaction(async (tx) => {
  const wallet = await tx.wallet.findUnique({ where: { userId } });
  const balance = Number(wallet.balance);
  
  if (balance < amount) throw AppError.insufficientBalance();
  
  await tx.wallet.update({
    where: { id: wallet.id },
    data: { balance: { decrement: amount } },
  });
  
  await tx.transaction.create({
    data: {
      reference,
      type: 'SOME_TYPE',
      status: 'COMPLETED',
      amount,
      debitWalletId: wallet.id,
      balanceBefore: balance,
      balanceAfter: balance - amount,
    },
  });
});
```

---

## 5. Redux Rules (Mobile)

1. **One slice per feature**: `authSlice.js`, `walletSlice.js`, `deliverySlice.js`
2. **Use `createAsyncThunk` for all API calls**
3. **Never call APIs directly from components** — always dispatch a thunk
4. **Store only serializable data** — no functions, no class instances
5. **Normalize lists** — prefer `{ byId: {}, allIds: [] }` for collections
6. **Loading states**: every async operation tracks `idle | loading | succeeded | failed`
7. **Error handling**: store error messages in slice state, clear on retry

### Slice Structure
```javascript
const walletSlice = createSlice({
  name: 'wallet',
  initialState: {
    balance: null,
    transactions: { byId: {}, allIds: [], status: 'idle', error: null },
    status: 'idle',
    error: null,
  },
  reducers: { clearError: (state) => { state.error = null; } },
  extraReducers: (builder) => { /* handle async thunks */ },
});
```

---

## 6. Socket Rules

1. **All event names are defined in `sockets/events.js`** — no hardcoded strings
2. **Naming convention**: `domain:entity:action` (e.g., `rider:location:update`)
3. **JWT auth on connection** — token in `socket.handshake.auth.token`
4. **Rooms**:
   - Personal room: `user:{userId}` (wallet updates, notifications)
   - Delivery room: `delivery:{orderId}` (tracking, status updates)
   - Rider pool: `riders:available` (job broadcasts)
5. **Rider location updates**: every ~3 seconds, write to Redis, broadcast to delivery room
6. **Never emit to all** — always target specific rooms
7. **Validate payloads** — silently ignore malformed data

---

## 7. Queue Rules

1. **All job types are defined in `queues/jobs.js`** — no hardcoded strings
2. **All external API calls go through queues** — never call Monnify/VTPass/FCM synchronously
3. **Every job MUST be idempotent** — safe to retry without side effects
4. **Default retry**: 3 attempts with exponential backoff (2s, 4s, 8s)
5. **Payment workers are rate-limited** — max 10 jobs/second
6. **Failed utility payments automatically refund** after all retries exhausted
7. **Completed jobs retained 24h, failed jobs retained 7 days**

---

## 8. Error Handling Rules

1. **Use `AppError` for all business errors** — never throw raw `Error`
2. **Use factory methods**: `AppError.badRequest()`, `AppError.notFound()`, etc.
3. **Financial-specific errors**: `AppError.insufficientBalance()`, `AppError.invalidPin()`, `AppError.duplicateTransaction()`
4. **Global error handler catches everything** — no unhandled rejections
5. **Prisma errors are auto-translated** by the error middleware
6. **Never expose stack traces** to the client in production
7. **Log all errors** — operational errors at `warn`, unexpected at `error`

---

## 9. Security Rules

1. **JWT for authentication** — access token (15min) + refresh token (7d) with rotation
2. **Transaction PIN required** for all financial operations (transfers, payments, withdrawals)
3. **PINs and passwords are bcrypt-hashed** (12 rounds) — never stored in plaintext
4. **BVN is hashed** — never stored in readable form
5. **Webhook verification** — Monnify webhooks verified via HMAC-SHA512 signature
6. **Role-based access**: `CUSTOMER`, `RIDER`, `ADMIN` — enforced at route level
7. **Rate limiting** on auth endpoints (login, OTP, PIN verification)
8. **Helmet middleware** for HTTP header security
9. **Input validation on every endpoint** via Zod schemas

---

## 10. Git Rules

1. **Conventional commits**: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
2. **One feature per branch**: `feat/wallet-transfer`, `fix/delivery-settlement`
3. **Never commit `.env` files** — use `.env.example`
4. **Never commit `node_modules/`**

---

## 11. Mobile UX & Error Feedback Rules

> **LAW: Never use standard `Alert.alert()` for operational feedback.**

1. **Toasts for Operational Feedback:** Use `react-native-toast-message`. 
   - Success (`type: 'success'`): "Transfer complete", "Profile updated".
   - Error (`type: 'error'`): "Invalid Credentials", "Network drop".
2. **Global Network Interceptor:** The Axios instance must automatically catch 5xx errors and network failures, dispatching a Redux action or directly calling `Toast.show()` so no screen is left hanging.
3. **Bottom Sheets for Blocking UX:** Use `@gorhom/bottom-sheet` for anything that interrupts the user (e.g. entering a Transaction PIN, authorizing a withdrawal, confirming a destructive action). NEVER use standard modals.
4. **Form Validation:** Use `react-hook-form` connected to `zod` resolvers. Validate forms *before* submitting to Redux/Axios, highlighting inputs in red natively.
5. **Global Error Boundaries:** Prevent full application crashes using `react-error-boundary`. Display a branded "Something went wrong" fatal screen with a safe reset button.

---

## 12. Design System & Aesthetics

> **Design Target:** High-Contrast Fintech & Logistics (Trust, Speed, Utility)

1. **Color Palette:** 
   - Backgrounds: Bone White (`#FAFAFA`) to reduce eye strain.
   - Surfaces/Cards: Pure White (`#FFFFFF`) to make data pop.
   - Accents/Buttons: Solid, highly-trusted brand color (e.g., Electric Blue `#2563EB`). NO gradients. NO neon meshes.
2. **Typography:** Use geometric, highly legible sans-serif (e.g. `Inter`, `SF Pro`). Numeric data (balances, prices) must be massive and bold. Secondary data (addresses, timestamps) should heavily contrast using muted grays (`#6B7280`).
3. **Depth System:** Use exclusively ultra-subtle, crisp drop-shadows on Pure White cards to simulate depth. DO NOT use Glassmorphism or Blur overlays, as they drain GPU performance and reduce outdoor legibility.
4. **Layout Architecture:**
   - Use a **Stacked Card UI**, not rigid Bento grids. Provide massive, thumb-friendly touch targets.
   - Utility icons should map to 3x3 pill grids.
5. **Logistics Integration:** The map is the absolute bottom layer. All delivery interactions must happen inside rounded Bottom Sheets sliding over the map.

# Customer App — Production Roadmap

> Scope: bring the Customer App and supporting backend to a 100% production-ready, end-to-end state with no placeholders, hard-coded values, mock data, or "coming soon" stubs. Each phase below ships a verified, demoable slice. Phases are ordered to respect technical and product dependencies; the order should not be reshuffled without re-checking the "Depends on" entries.
>
> Naming conventions in this doc:
> - **BE** = backend (`backend/src`)
> - **DB** = Prisma schema / migrations (`backend/prisma`)
> - **MO** = customer mobile app (`mobile/customer-app`)
> - **RT** = real-time (sockets, queues, workers)
> - **AC** = acceptance criteria — definition of "done"
>
> Every phase ends with: code merged, migrations applied, automated tests passing in CI, manual QA against the AC, and a tagged release candidate build (EAS internal track for mobile, staging for backend).

---

## Phase 0 — Foundations & Cleanup

> **Status: INCOMPLETE — ~55% done. Blocked on: idempotency not wired to request/utility routes; hardcoded fees not fully replaced in mobile; no tests.**

### 0.1 Goals
Eliminate the structural drift that is causing every downstream phase to do double work: hard-coded fees, dual order-tables, missing settings store, ad-hoc URLs, no idempotency on order creation, no shared status taxonomy.

### 0.2 Tasks

**DB**
- ✅ Add `PlatformSetting` table — exists, migrated, seeded with all required keys (delivery.baseFare, perKmRate, platformFeePercent, wallet min/max, auth.pin*, platform.currency, broadcast rings, auto-cancel ms).
- ✅ Add `IdempotencyKey` table — exists, migrated.
- ✅ Add `AuditLog` table — exists, migrated.
- ✅ Migrate at deploy time via `prisma migrate deploy`.

**BE**
- ✅ Settings service `services/settings.service.js` — in-memory cache + Redis pub/sub invalidation; `getSetting` / `getSettings` / `getPublicSettings` all implemented.
- ⚠️ Replace hardcoded fees — `request.service.js` now uses `getSetting()` for delivery fees. `ITEM_PLATFORM_FEE_PERCENT` in request service still uses `config.*`. Utility/checkout services not audited.
- ❌ Idempotency middleware on `POST /api/requests` — middleware exists and works on wallet routes, but **not applied to `/api/requests`, `/utilities/*`**.
- ❌ Remove dead `delivery.validator.js` MATCHED references; introduce `utils/status.js` with unified status map.
- ❌ Standardize API client base path audit — not done; no ESLint rule added.

**MO**
- ✅ `services/settings.js` — fetches `/settings/public` on cold start, `getSetting()` / `usePlatformSetting()` hook available.
- ❌ Replace all hard-coded fees/thresholds with settings lookups — not done across screens (WithdrawScreen has hardcoded `Min: ₦500 · Fee: ₦25`; quick-amount chips are hardcoded; no `i18n/en.json` started).
- ✅ `services/idempotency.js` — exists, generates UUID v4.
- ⚠️ Idempotency header on mutation thunks — added to `sendMoney` and `withdrawToBank` only. Not added to `createDelivery`, `buyAirtime`, `buyData`, `buyCable`, `payElectricity`.
- ⚠️ App boot sequence — `hydrateAuth` + `fetchPublicSettings` + socket connect all happen in AppNavigator. `useEffect`s on individual screens not cleaned up.

**RT**
- ✅ N/A this phase.

### 0.3 Acceptance Criteria
- ❌ No string `500` or `100` fee literals in mobile code — not verified; hardcoded amounts still present in multiple screens.
- ✅ `/api/settings/public` returns seeded defaults.
- ❌ Idempotent `POST /api/requests` — idempotency middleware not on that route.
- ❌ All `api.get/post/patch/delete` paths begin with `/` — not audited.
- ❌ Tests `idempotency.spec.js` / `settings.spec.js` — not written.

### 0.4 Risks
- Existing data (KatPay refs, transactions) must not break; idempotency table is additive only.

---

## Phase 1 — Identity, KYC, Security

> **Status: INCOMPLETE — ~40% done. Blocked on: biometric is a UI stub; PIN lockout not server-authoritative; Session model missing fields; KYC does not atomically provision virtual account; no FCM token registration.**

### 1.1 Goals
Production-grade signup, login, KYC, PIN, and session security. SMS goes out for real. Biometric unlock works. Failed PINs lock the user. Sessions can be revoked individually.

### 1.2 Tasks

**BE**
- ⚠️ Wire **Termii live** credentials in `config/index.js` — config keys exist. Dev-mode auto-bypass for `NODE_ENV=production` removal and startup-error guard **not verified**.
- ❌ KYC verify endpoint must, on success, atomically:
  1. Mark `kycStatus = VERIFIED` and persist `bvnHash`.
  2. Call `katpayService.createVirtualAccount(...)` and persist `virtualAccountNumber/Bank/Name` on the wallet.
  3. Send a welcome push and a Termii SMS.
  4. Return the now-active wallet payload.
  Make this a single Prisma transaction wrapping the DB writes; the external call is retried via `paymentQueue.PROVISION_VIRTUAL_ACCOUNT` with backoff if it fails.
  — Virtual account provisioning is **not** atomically linked to KYC success; no retry queue exists for it.
- ⚠️ `Session` table endpoints:
  - ✅ `GET /auth/sessions` — implemented.
  - ✅ `DELETE /auth/sessions/:sessionId` — implemented.
  - ✅ `DELETE /auth/sessions` → revoke all but current — implemented.
  - ❌ `Session` model not extended with `deviceName`, `deviceModel`, `userAgent`, `lastUsedAt` — only `deviceInfo String?` and `ipAddress String?` exist in schema.
- ❌ `auth.service.verifyPin` PIN lockout: `pin:fails:{userId}` Redis counter, `pin:lock:{userId}` after 5 attempts, `423 Locked` response — **not implemented**.
- ⚠️ Phone-number change flow: `POST /auth/phone/request-change` → `POST /auth/phone/confirm-change` — **implemented**. OTP sent to new number ✅. Push notice to old number ❌ (not sent).

**DB**
- ❌ `Session` model extension (`deviceName`, `deviceModel`, `userAgent`, `lastUsedAt`) — migration not written.
- ❌ `BvnVerificationLog` (optional) for compliance audit — not created.

**MO**
- ❌ Replace `expo-secure-store` PIN attempt counters with server-truthful errors (read `429`/`423` from server) — still uses client-side counters.
- ❌ `PinBottomSheet`: shake animation on failure, lock state with countdown, "Forgot PIN?" deep link to `ChangePin` flow — **not implemented**.
- ⚠️ **Biometric unlock** with `expo-local-authentication`:
  - ✅ `services/biometric.js` — fully implemented (`isBiometricAvailable`, `enableBiometric`, `disableBiometric`, `authenticateWithBiometric`).
  - ❌ Settings toggle in `SecuritySettingsScreen` is a `useState(false)` stub — **never calls the biometric service**; `biometricEnabled` is not persisted to SecureStore.
  - ❌ Cold-start biometric prompt before showing main UI — not wired in AppNavigator.
  - ❌ PIN-vs-biometric risk split — not implemented.
- ✅ **Sessions screen** — implemented (`SessionsScreen.js`); shows device/IP, revoke per row, "Sign out all other devices" banner.
- ✅ **Phone change screen** — implemented (`PhoneChangeScreen.js`); 2-step: new phone + password → OTP → success.
- ❌ **FCM token registration** in `authSlice.login.fulfilled` / `register.fulfilled` via `NotificationService.registerToken()` — **not implemented**.
- ❌ `BvnVerificationScreen` shows resulting NUBAN immediately after KYC success — not implemented.

### 1.3 AC
- ⚠️ New signup receives a real Termii SMS in prod — config present but prod bypass removal unverified.
- ❌ Bank-app transfer to the NUBAN minted on KYC success credits the wallet within 30 s — virtual account not provisioned atomically on KYC.
- ❌ 6 wrong PINs lock the user for 30 minutes; UI shows accurate countdown; lock survives app restart — PIN lockout not implemented.
- ⚠️ A second login on a different device shows up in Sessions — Sessions screen works but `deviceName`/`lastUsedAt` not stored so device rows show minimal info.
- ❌ Biometric unlock works on iOS Face ID and Android fingerprint; toggling off forces PIN — toggle is a stub.
- ⚠️ Phone-number change requires both password and OTP — ✅. Notifies old number — ❌ not sent.

### 1.4 Risks
- Termii cost — rate-limit OTP sends per phone/day at the application layer (existing `otpLimiter` keeps this in check).
- Biometric on emulators is fake; ensure CI doesn't gate on it.

---

## Phase 2 — Unified Schema & Product Model Migration

> **Status: INCOMPLETE — ~20% done. Blocked on: no data migration written; delivery screens still live in mobile navigator; unified FSM/status helpers not created; legacy DeliveryOrder model still active; product model still flat (no variants, no category-driven schema).**

### 2.1 Goals
End the dual-rail (`DeliveryOrder` legacy ↔ `Request` unified). After this phase the customer app has **one** order list, **one** tracking screen, **one** status taxonomy, and the backend has **one** source of truth.

In the same window, land the **unified product model** so every category that comes later (food, pharmacy, grocery, clothing, shoes, electronics, anything) reads from the same shape. The model separates three concepts that today get conflated: selection axes (size/color/strength), pack/unit (500ml, 30 tablets, 1 kg), and quantity. Doing this once now avoids backfilling live products, carts, and order history later, and avoids retraining merchants on a second product form.

### 2.2 Tasks

**DB**
- ❌ Migration `migrate_delivery_orders_to_requests`:
  - For each `DeliveryOrder`: insert a `Request` with `type=PACKAGE`, copy fields, create a `PackageDetail` if data permits. Preserve original IDs via a `legacyDeliveryOrderId` column on `Request` for traceability.
  - Migrate `Rating` rows pointing at `deliveryOrderId` to `requestId`.
  - Once verified in staging, drop `DeliveryOrder` and `Rating.deliveryOrderId` (separate migration after one-week soak in prod).
  — Migration file **not written**; `DeliveryOrder` table and `Rating.deliveryOrderId` still in schema.
- ⚠️ Add fields to `Request` if missing: `escrowTransactionId String?` — **added** (used for escrow hold). `searchAttempts Int @default(0)`, `lastBroadcastAt DateTime?`, `cancellationFee Decimal? @db.Decimal(15,2)`, `refundTransactionId String?` — **not added**.

**DB — Product model**
- New `ProductVariant` table:
  - `id`, `productId`, `sku`
  - `attributes JSONB` — discrete selection axes, schema-less so each category names its own (`{size:"M", color:"Black"}`, `{strength:"500mg", form:"TABLET"}`, `{capacity:"128GB", color:"Black"}`, `{flavor:"Strawberry"}`).
  - `packSize Decimal?` + `packUnit Enum?` (`ML`, `L`, `G`, `KG`, `TABLET`, `CAPSULE`, `PIECE`, `PAIR`, `PACK`, `BOTTLE`, `SACHET`, `CARTON`) + `packLabel String?` (denormalized display, e.g. "500 ml", "30 tablets", "5 kg bag"). Merchant can override `packLabel` for edge cases ("1 carton of 24 sachets").
  - `price Decimal`, `stock Int`, `imageUrl String?`, `isAvailable Bool`.
  - Unique index on `(productId, sku)`. Index on `productId`.
- `MerchantCategory` gains `attributeSchema JSONB` — admin-managed hint for which axes and pack units a category uses. Example:
  ```json
  {
    "fashion":    {"axes":["size","color"],"pack":false},
    "shoes":      {"axes":["size","color"],"pack":false,"sizeSystem":"EU"},
    "pharmacy":   {"axes":["strength","form"],"pack":true,"packUnits":["TABLET","CAPSULE","ML"]},
    "grocery_liq":{"axes":["flavor"],"pack":true,"packUnits":["ML","L","BOTTLE","SACHET"]},
    "grocery_dry":{"axes":[],"pack":true,"packUnits":["G","KG","PACK"]},
    "electronics":{"axes":["capacity","color"],"pack":false},
    "food":       {"axes":["size"],"pack":false}
  }
  ```
  Pure UX hint; DB does not enforce. Seeded for every existing category.
- `RequestItem` gains `variantId String?` (FK to `ProductVariant`) so each order line records the exact SKU bought. `productId` stays for fallback display when a variant is later deleted.
- Data migration `backfill_product_variants`: for every existing `Product`, create one default `ProductVariant` (`attributes: {}`, no pack fields, copy `basePrice` → `price`, copy `stock` → `stock`). Existing `RequestItem` rows get `variantId` pointing at that default. No live data loss.
- `Product.variations` (legacy `Json?`) deprecated; reads switch to `ProductVariant`; column dropped one week after soak.

**BE**
- ❌ Delete `modules/delivery/*` — module still exists; no deprecation redirects from `/api/delivery/*` to `/api/requests`.
- ⚠️ `request.service`:
  - ✅ `createRequest` exists as single entry point with type routing.
  - ❌ `type=PACKAGE` body including `PackageDetail` (`senderName`, `senderPhone`, `recipientName`, `recipientPhone`, `instructions`) — not handled in `createRequest`.
  - ❌ `estimateRequest(...)` returning `subtotal, deliveryFee, platformFee, tax, total, distanceKm, estimatedMinutes` — not a standalone exported function; pricing is inline in `createRequest`.
  - ❌ `updateStatus` does not enforce a unified FSM via `utils/constants.js` — status transitions not codified.
- ❌ Status mapping helper on list/get responses — not implemented.

**BE — Product model**
- `products.service`: variant CRUD nested under product (`GET/POST /merchants/:id/products/:pid/variants`, `PATCH/DELETE /variants/:vid`). Product list responses include the lowest-priced available variant for card display.
- `request.service.createRequest` accepts `items: [{ productId, variantId?, quantity }]`. Validator rejects when a product has multiple variants but no `variantId` is supplied. Single-variant products auto-resolve to that variant server-side.
- Stock decrement happens on the resolved `variantId` always (single SKU or many — same code path).
- Search/discovery skeleton: `/search` and `/nearby` accept a `category` filter; facets read `MerchantCategory.attributeSchema` to know which axes to expose. Full search UX still lands in Phase 6.
- New admin endpoints: `GET/PATCH /admin/merchant-categories/:id/attribute-schema` to manage the schema JSON with validation.

**Admin dashboard**
- New screen: **Category Taxonomy** under Settings. Lists `MerchantCategory` rows; each row opens an editor for `attributeSchema` (JSON editor with live-preview pane showing how the merchant product form will render for that category). Validation prevents shipping malformed schemas.
- Existing merchant approval / product moderation screens consume the new variant shape in read-only mode (display SKU, attributes, pack label, stock per variant).

**Merchant dashboard**
- Product create/edit form rewritten to be **category-driven**:
  - On category select, form reads `attributeSchema` and auto-renders the relevant fields:
    - Fashion: Size + Color axes; no pack inputs.
    - Pharmacy: Strength + Form axes; pack inputs (`30` × `TABLET`).
    - Grocery (liquid): pack inputs (`500` × `ML`); optional Flavor axis.
    - Grocery (dry): pack inputs (`5` × `KG`); no axes.
    - Electronics: Capacity + Color axes; no pack.
    - Food: Size axis (Small/Medium/Large); no pack.
  - Axes become a variant matrix builder (combinatorial generator with manual pruning) — one row per SKU with its own price, stock, image.
  - `packLabel` auto-fills from `packSize`+`packUnit`; editable for unusual displays.
  - Single-SKU products: form lets merchant skip the matrix and enter price/stock once; system creates one default variant invisibly.
- Inventory screen lists per-variant stock with bulk-edit. Low-stock alerts move from product-level to variant-level.

**DB — Food customization / option groups**

Variants cover SKU-level differences (different prices, different stock — e.g., Small/Medium/Large pizza where each size has its own stock). Variants do **not** cover the customizations a customer adds on top of a chosen item — sides, addons, spice level, "no onions", combo drink selection, sauce choice, doneness. Food needs both, and food is the first focus, so the model must be specified now, not invented later.

- New `ProductOptionGroup` table: `(id, productId, name, selectionRule, minSelect, maxSelect, sortOrder)`.
  - `selectionRule` enum: `REQUIRED_ONE`, `OPTIONAL_ONE`, `REQUIRED_MULTIPLE`, `OPTIONAL_MULTIPLE`.
  - Examples: "Size" (REQUIRED_ONE), "Choose your sides" (OPTIONAL_MULTIPLE, min 0, max 3), "Spice level" (REQUIRED_ONE), "Pick a drink" (REQUIRED_ONE — used inside combos), "Extras" (OPTIONAL_MULTIPLE, no cap), "Doneness" (REQUIRED_ONE).
- New `ProductOptionItem` table: `(id, groupId, name, priceDelta Decimal @default(0), isDefault Bool, isAvailable Bool, sortOrder)`.
  - Examples under "Sides": "Plantain (+₦300)", "Coleslaw (+₦200)", "Salad (+₦400)". Under "Spice level": "Mild (+₦0)", "Medium (+₦0)", "Hot (+₦0)" — price-neutral but still a selection. Under "Extras": "Extra cheese (+₦500)", "Extra meat (+₦800)".
- `RequestItem` gains:
  - `selectedOptions JSONB` — denormalized snapshot captured at order time: `[{groupId, groupName, items:[{itemId, itemName, priceDelta}]}]`. Frozen at order time so subsequent merchant edits to the menu don't rewrite history.
  - `specialInstructions String?` — free-text, max 200 chars ("no onions", "well done", "extra crispy"). Visible to merchant on the kitchen ticket.
  - `unitPrice Decimal` and `lineTotal Decimal` — computed server-side at order time and persisted. `unitPrice = variant.price + Σ option priceDeltas`. `lineTotal = unitPrice × quantity`. Never trust client-sent totals.
- Guideline (documented in merchant onboarding and admin docs):
  - **Use variants** when the kitchen treats it as a different item with its own stock and base price (Small/Medium/Large pizza, 25cl/50cl/1.5L bottle).
  - **Use option groups** when it's a customization on top of one item (sides, addons, spice, doneness, removal of an ingredient).
  - **Use both** for combos: a "Family Meal" is a single variant with option groups for the drink pick, side pick, and protein pick.
- Validator (`request.validator`) enforces every required option group is satisfied and every selection respects `minSelect`/`maxSelect`. Rejected with a clear error pointing at the offending group.

**BE — Option groups**
- `products.service` nested CRUD: `GET/POST /merchants/:id/products/:pid/option-groups`, `PATCH/DELETE /option-groups/:gid`, and the same for `option-items` under each group. Bulk-upsert endpoint for menu imports.
- Product detail response shape includes `optionGroups: [{id, name, selectionRule, minSelect, maxSelect, items:[{id, name, priceDelta, isDefault, isAvailable}]}]` so the customer app renders without a second round-trip.
- Snapshot logic at order creation: server reads current `optionGroup`/`optionItem` rows by id, validates, denormalizes into `RequestItem.selectedOptions`, and computes prices. No client-sent prices ever land in the DB.

**Merchant dashboard — Option groups (food-specific UI)**
- Under each food product: an "Option groups" section with drag-reorder, add-group, add-item-per-group. Each group inline-edits `name`, `selectionRule`, `min`, `max`. Each item inline-edits `name`, `priceDelta`, `isDefault`, `isAvailable`.
- Templates: merchant can save a group as a template ("Standard sides") and apply it to multiple products to avoid retyping.
- Live preview pane mirrors how the customer will see the screen.
- Bulk availability toggle ("86 this item today") flips `isAvailable=false` on a single option item without deleting it — useful when the kitchen runs out of plantain.

**Customer app — Food product detail (this is where food's UX lives)**
- `ProductDetailScreen` for food merchants renders, in order:
  1. Hero image, name, description, base price.
  2. Variant picker (if any) — e.g., size chips.
  3. Each option group, in `sortOrder`, with the appropriate input style:
     - `REQUIRED_ONE` / `OPTIONAL_ONE` → radio list.
     - `REQUIRED_MULTIPLE` / `OPTIONAL_MULTIPLE` → checkbox list, disabled when `maxSelect` reached.
     - Header per group shows the rule ("Choose 1", "Pick up to 3", "Optional").
     - Item rows show `+₦X` only when non-zero; price-neutral items show no delta chip.
     - Out-of-stock items (`isAvailable=false`) greyed with an "Unavailable today" tag.
  4. "Special instructions" textarea (200 char limit, character counter).
  5. Quantity stepper.
  6. Sticky bottom CTA: "Add to cart · ₦{liveTotal}" — recomputes as the user picks options.
- Add-to-cart disabled until every `REQUIRED_*` group is satisfied; the offending group is scrolled into view and highlighted on the first tap of a disabled CTA.
- Cart line displays: product name, variant summary, selected options grouped by group name ("Sides: Plantain, Coleslaw · Spice: Hot"), special instructions in italics, qty × unit price.
- Edit-from-cart returns to ProductDetail with prior selections preloaded.

**MO**
- ❌ Delete `screens/delivery/CreateDeliveryScreen.js`, `TrackDeliveryScreen.js`, `RateDeliveryScreen.js` — all three still exist and are registered in `AppNavigator`.
- ❌ `screens/request/CreateRequestScreen.js` for PACKAGE type — not created.
- ⚠️ `screens/request/RequestTrackingScreen.js` — exists; status timeline not expanded to full unified set; no merchant-card conditional.
- ❌ `screens/request/RateRequestScreen.js` — not created.
- ⚠️ `OrdersScreen` — reads from `/api/requests`. Tabs exist but status groupings (`Active | Completed | Cancelled`) may not map to the full unified status set.
- ❌ `lib/requestStatus.js` with unified pill colors and copy — not created.

**RT**
- ❌ Customer app still has `delivery:*` socket listeners — not removed.
- ❌ `socketService` handlers for `request:status:changed`, `request:rider:assigned`, `request:rider:location`, `request:merchant:accepted`, `request:merchant:ready`, `request:completed`, `request:cancelled` dispatching `requestSlice.updateRequestFromSocket` — not implemented.

### 2.3 AC
- ❌ `DeliveryOrder` table empty (only legacy IDs preserved on `Request`) — no migration run.
- ❌ Tracking, history, ratings render identically for FOOD and PACKAGE — PACKAGE flow not built.
- ❌ Existing in-flight orders migrated without state loss — not started.
- ❌ Mobile app build has zero references to "delivery" routes/slices — delivery screens still registered.
- ❌ Every existing `Product` has at least one `ProductVariant` row after migration; every `RequestItem` has a resolved `variantId`; no live cart references break.
- ❌ Admin can add a new `MerchantCategory` (e.g., "Hardware") and define its `attributeSchema`; the merchant product form for that category renders the right fields without code changes.
- ❌ Merchant onboarding flow demoes adding one product per category (food, pharmacy, grocery liquid, grocery dry, fashion, electronics) and all six render correctly in the customer app skeleton.
- ❌ A merchant can build a "Jollof Combo" with: size variant (Regular/Large), required "Pick a protein" group (Chicken/Beef/Fish, each with its own price delta), required "Pick a drink" group (5 options), optional "Extras" group (Plantain, Coleslaw, Extra meat, no cap). All four constraints enforced both client-side and server-side.
- ❌ Customer orders the combo with custom selections + "no onions" in special instructions. Receipt, kitchen ticket (merchant dashboard), and order history all show identical breakdowns. "Order again" preloads every selection.
- ❌ 86-ing "Plantain" on the merchant dashboard immediately greys it out in the customer app within 30 s.
- ❌ Price tampering: a client sending a fabricated `lineTotal` is overridden by the server's computed total; the discrepancy is logged.

### 2.4 Risks
- In-flight deliveries during migration: run migration during a maintenance window; for active orders, dual-write for a 30-min cutover.
- Variant explosion (size × color × style): cap at 100 variants per product in V1 with a clear merchant-side error; paginate the variant list in the merchant dashboard.
- Merchant retraining: the product form changes shape. Ship a short in-app walkthrough and a written changelog before the cutover; allow a 1-week dual-form window if merchant feedback warrants it.

---

## Phase 3 — Wallet Production Completion

> **Status: INCOMPLETE — ~65% done. Blocked on: escrow RELEASE/REFUND not wired into updateStatus; no socket emissions on wallet mutations; WithdrawalRequest table missing; no withdrawal queue worker; receipt PNG not generated; Repeat button missing.**

### 3.1 Goals
Wallet feels live, not stale. Customer can fund, send, withdraw, see history, save beneficiaries, and view receipts. Money movements emit sockets so balance updates in real time.

### 3.2 Tasks

**BE**
- ⚠️ Money **escrow** primitive:
  - ✅ `ESCROW_HOLD` on request creation — debit customer → credit `PLATFORM_ESCROW` SystemWallet; `ESCROW_HOLD` Transaction written; all in single Prisma transaction.
  - ❌ `ESCROW_RELEASE` on `SETTLED` (escrow → merchant + rider + platform split) — **not implemented** in `updateStatus`.
  - ❌ `ESCROW_REFUND` on `CANCELLED` (escrow → customer) — **not implemented** in `updateStatus`.
- ❌ Socket emission after every wallet mutation (`wallet:balance:updated`, `wallet:transfer:received`, `wallet:funding:received`) via `notify.balanceUpdated(userId, ...)` helper — **not implemented**.
- ❌ Bank account name lookup `POST /wallet/banks/lookup` { bankCode, accountNumber } — **not implemented**.
- ⚠️ Receipts:
  - ✅ `GET /wallet/transactions/:id/receipt` returns a JSON receipt — implemented.
  - ❌ Server-side PNG generation via `@napi-rs/canvas` — **not implemented**; mobile share uses text-only `Share.share()`.
- ✅ `SavedBeneficiary` endpoints (list, add phone/bank, delete, set default) — exist in the backend.
- ❌ Withdrawal queue worker `PROCESS_WITHDRAWAL`:
  - Calls KatPay payout, COMPLETED on success, `WITHDRAWAL_REFUND` transaction + socket on failure.
  - Async webhook callbacks for settlements.
  — **not implemented**.

**DB**
- ✅ `SystemWallet` table — exists; `PLATFORM_ESCROW` row seeded.
- ❌ `WithdrawalRequest` table indexed by `transactionId`, status, retry count — **not in Prisma schema**.
- ⚠️ `BeneficiaryType` enum (`PHONE`, `BANK_ACCOUNT`, `METER`, `AIRTIME_NUMBER`) — `SavedBeneficiary` model exists; verify enum values match spec.

**MO**
- ✅ **Send Money** screen (`SendMoneyScreen.js`) — phone input → name lookup → amount → PIN → success.
- ✅ **Withdraw** screen (`WithdrawScreen.js`) — bank picker → account → name lookup → amount → PIN.
- ✅ **Transaction History** screen — `fetchTransactions` thunk with type-filter tabs, infinite scroll, tap → receipt. Date range and search by reference **not implemented**.
- ⚠️ **Receipt screen** (`ReceiptScreen.js`) — shows amount, type, status, balanceBefore/After, date. Copy reference ✅. Share via `Share.share()` (text only) ✅. **Repeat button** ❌ — not implemented.
- ✅ **Saved Beneficiaries** screen (`SavedBeneficiariesScreen.js`) — phone/bank tabs, 1-tap Send/Withdraw, delete with confirmation.
- ✅ WalletScreen Send & Withdraw buttons navigate — no more "Coming Soon" toasts.
- ❌ Socket listener in `walletSlice` extras: `wallet:balance:updated` → set balance + prepend transaction; `wallet:funding:received` → toast + haptic — **not implemented**.

**RT**
- ❌ `user:{userId}` room auto-join on socket connect — **not implemented**.

**Tests (inline — money paths)**
- `escrow.spec.js`: `ESCROW_HOLD` debits customer & credits PLATFORM_ESCROW in one transaction; `ESCROW_RELEASE` splits to merchant + rider + platform with correct math; `ESCROW_REFUND` returns full amount on cancellation; concurrent holds don't double-debit (transactional isolation).
- `wallet-transfer.spec.js`: P2P send updates both balances atomically; insufficient balance rejects with no DB writes; idempotency key replay returns the original result without re-debiting.
- `withdrawal.spec.js`: successful payout marks COMPLETED; failed payout enqueues `WITHDRAWAL_REFUND` and restores balance within the test window; webhook replay does not double-refund.
- `reconciliation.spec.js`: a synthetic ledger with 100 mixed transactions satisfies `Σ user balances + Σ system wallets = Σ funded − Σ withdrawn` to the kobo.
- All four ship in the same PR as the feature they cover. Use `supertest` + Prisma test container.

### 3.3 AC
- ❌ Funds transferred bank → NUBAN reflect on home screen within 5 s via socket — socket emissions not wired.
- ⚠️ P2P send: sender balance updates via REST ✅; recipient socket notification ❌.
- ❌ Withdraw: failed payouts auto-refund within 60 s — withdrawal worker not implemented.
- ⚠️ All transactions appear in history with correct sign and balanceBefore/After ✅; receipt sharing produces a proper image ❌ (text-only share).
- ✅ Beneficiary: save and reuse phone in wallet screens.
- ✅ Send and Withdraw entry points fully replace the old "Coming Soon" toasts.

### 3.4 Risks
- Escrow introduces a system wallet: compliance/auditing has to inspect it. Add a daily reconciliation job (`recon.worker.js`) that asserts `Σ user balances + Σ system wallets = Σ funded − Σ withdrawn`.

---

## Phase 4 — Logistics: Production-Grade Matching, Tracking, Lifecycle

### 4.1 Goals
The logistics flow becomes the differentiator the proposal promises: predictable matching, accurate fares, real road routes, live ETAs, fair cancellation, production-grade reliability.

### 4.2 Tasks

**BE**
- **Quote endpoint** `POST /api/requests/quote` { type, pickup, dropoff, items?, packageSize? } → server-truth pricing ({ subtotal, deliveryFee, platformFee, tax, total, distanceKm, estimatedMinutes, validUntil }). `validUntil` is 5 minutes; client must include the quote token on `POST /api/requests`. Server re-validates and rejects stale quotes.
- **Expanding-radius rider matching** in `request.worker.broadcastToRiders`:
  - Read settings: rings `[5,10,15]` km, ring timeout 60s, max attempts 3.
  - For each ring, query Redis `rider:location:*` (geohash GEORADIUS) for available riders within ring; emit `rider:job:new` to up to 10 nearest; wait `ringTimeout`. If unaccepted, expand.
  - On all rings exhausted: schedule `AUTO_CANCEL_UNMATCHED` immediately (refund handled below).
  - Increment `Request.searchAttempts`; emit `request:matching:status` to customer (so UI can say "Searching… (1/3)").
- **Auto-cancel refund** hooked into request lifecycle: when status moves to `CANCELLED` and `escrowTransactionId` exists → enqueue `REFUND_REQUEST` worker job that releases escrow back to customer, persists `refundTransactionId`, and emits sockets.
- **Cancellation policy** server-driven from settings:
  - Status `REQUESTED` → free.
  - Status `ACCEPTED|PROCESSING|RIDER_ASSIGNED|RIDER_EN_ROUTE` → fee = `cancellationFee` (settings).
  - Status `PICKED_UP+` → 403; admin only.
  - Customer-initiated cancellation endpoint validates and charges fee if applicable (debit from refund).
- **Directions on tracking** — new endpoint `GET /api/requests/:id/route` proxies `mapsService.getDirections` based on the rider's last known location → next checkpoint (pickup if not picked up, else dropoff). Cached in Redis 30 s.
- **Live ETA**: same endpoint returns updated `etaSeconds`. Client polls every 30 s while tracking screen is open OR backend pushes `request:rider:eta` every 30 s if rider has moved >100 m since last push.
- **PackageDetail** captured on creation: `senderName, senderPhone, recipientName, recipientPhone, instructions`. `recipientPhone` becomes the rider's call target (so rider doesn't see customer's number unless customer is the recipient).
- **In-app messaging** (lightweight): `RequestMessage` table `(requestId, fromUserId, body, createdAt)`; `POST /api/requests/:id/messages`, `GET /api/requests/:id/messages`. Server emits `request:message:new` to room. Optional templated quick-replies seeded in settings.
- **Maps autocomplete & place details**: ensure `/maps/autocomplete` and `/maps/places/:placeId` are authenticated and rate-limited per user.

**DB**
- `RequestMessage` table.
- Indexes on `Request.status, riderId, customerId, createdAt` already present; verify and add covering indexes for the active-request banner query (`customerId, status IN (active set)`).

**MO**
- `CreateRequestScreen` for `PACKAGE`:
  - Pickup, dropoff, package size, description.
  - Sender + Recipient contact form (auto-fill sender from profile).
  - Address book picker for both ends (depends on Phase 6 SavedAddress real model — for now allow free entry, then upgrade).
  - Quote panel updates whenever inputs change; uses `/quote`; shows quote-validity countdown.
  - PIN sheet on submit; passes `quoteToken` and `idempotencyKey`.
- For `FOOD/GROCERY/PHARMACY`, `CheckoutScreen`:
  - Dropoff via address book picker.
  - Shows server quote breakdown line-by-line.
  - Disables submit when quote expired; auto-refresh on focus.
  - PIN confirm.
- `RequestTrackingScreen` upgrades:
  - Full status timeline (10 unified states + cancelled).
  - Route polyline drawn from `/route` endpoint (decoded `polyline` package). Animate marker along it on each location update.
  - Live ETA chip ("Arrives in ~12 min") refreshed by `request:rider:eta`.
  - Searching state UI with attempt counter and "still searching for a rider" copy when status is `REQUESTED` and `searchAttempts > 0`.
  - Cancel button shows fee if applicable, with confirmation modal.
  - Call recipient/sender (for package) and call merchant (for food) buttons.
  - In-app chat sheet using `request:message:new` socket events; persisted via REST endpoints above.
- `OrdersScreen` shows badges for "Searching", "In transit", "Awaiting rating".

**RT**
- `request:matching:status` event every ring expansion; client surfaces in tracking UI.
- `request:rider:eta` event every 30 s while rider in motion.
- `request:message:new` for chat.

**Tests (inline — money paths)**
- `auto-cancel-refund.spec.js`: a request that exhausts all rings without a match is auto-cancelled and the customer's escrow is refunded in full within the test window; `refundTransactionId` is persisted; no double-refund on retry.
- `cancellation-fee.spec.js`: customer cancel at `REQUESTED` is free; at `RIDER_ASSIGNED` charges `cancellationFee` and refunds the remainder in a single transaction; at `PICKED_UP` rejects with 403.
- `quote-validity.spec.js`: a request submitted with an expired quote token is rejected with 400 and a re-quote hint; a valid quote is accepted and the prices on the resulting Request match the quote exactly.
- These ship in the same PR as the feature they cover.

### 4.3 AC
- A live test in Katsina: package delivery placed → matched within 1 minute when riders are online; when no riders, customer sees "Searching (ring 1/3)…", auto-cancel + full refund inside 4 minutes, balance updated via socket.
- Tracking screen polyline follows actual roads (you can compare to Google Maps app side-by-side).
- ETA updates as rider moves; deviation >2 minutes from real-world arrival is logged for analysis.
- Cancelling at `RIDER_ASSIGNED` charges `cancellationFee` and refunds the rest in one transaction.
- Customer cannot cancel after `PICKED_UP`; admin can via dashboard.
- Quote tokens >5 min old are rejected with a clear error and the UI re-quotes automatically.

### 4.4 Risks
- Google Maps quota: Distance Matrix + Directions per active delivery is expensive. Use Redis cache (route TTL 30 s, distance for quote TTL 5 min).
- Geohash queries on Redis at scale; alternatively use PostGIS `ST_DWithin` with a `RiderLocation` table — pick one and document.

---

## Phase 5 — Real-Time Plumbing & Notifications

### 5.1 Goals
Sockets and pushes are first-class and deterministic. The app feels alive; users are notified at every meaningful state change in-app, in tray, and via deep link.

### 5.2 Tasks

**BE**
- Centralize event emission in `services/notify.service.js` exposing:
  - `pushAndSocket(userId, { title, body, data })` → fans out to FCM (if token), socket `notification:new`, and a persisted `Notification` row.
  - Lifecycle hooks: `onRequestStatusChanged(request, prev)` → maps status→message+CTA; `onWalletEvent`, etc.
- `Notification` table: `(id, userId, title, body, data JSONB, type, requestId?, transactionId?, readAt?, createdAt)`. Endpoints:
  - `GET /notifications` paginated.
  - `PATCH /notifications/:id/read` and `PATCH /notifications/read-all`.
  - `GET /notifications/unread-count`.
- Replace every ad-hoc `Toast`-equivalent server emit with `notify.pushAndSocket(...)`.
- Dead-letter queue handling for FCM (token invalid → null out user.fcmToken).

**MO**
- `App.js` boot sequence calls `socketService.connect()` after `authSlice.fulfilled`. Socket joins `user:{userId}` room automatically.
- `AppState` listener: on background, optionally disconnect after 60 s; on foreground, immediate reconnect and resync of any active request room.
- **Silent token refresh** in `services/api.js` response interceptor: on `401` from any endpoint other than `/auth/refresh` and `/auth/login`, transparently call `POST /auth/refresh` with the stored refresh token, persist the rotated token pair to `SecureStore`, and replay the original request once. Concurrent 401s share a single in-flight refresh promise so we don't fan out N refresh calls. If the refresh itself returns 401, dispatch `logout()` and surface a single "Session expired — please log in again" toast. Without this the 15-minute access-token expiry force-logs-out every active user mid-task; the Phase 1 `Session.lastUsedAt` field also stays stale because `/auth/refresh` is the only thing that updates it.
- **Notification Center** screen (accessible from a bell icon on Home):
  - Unread count badge synced with `/notifications/unread-count` and live via `notification:new`.
  - Tap row → deep links to relevant screen.
  - Mark read / mark all read.
- **Deep linking** via `expo-linking` and `Linking` config in `app.json`:
  - `vtulogistics://request/:id`, `vtulogistics://wallet`, `vtulogistics://wallet/transactions/:txId`, `vtulogistics://orders`, `vtulogistics://utility/airtime`.
  - Universal links (HTTPS) for iOS / Android App Links.
- **Background push handler** (`expo-notifications`):
  - Foreground → toast (already present) + Notification Center prepend.
  - Background → tray; on tap, deep link routes via `Linking.getInitialURL()`.
- **Connection quality banner** on tracking screen: when socket disconnected ≥3 s, show "Reconnecting…" pill. Retry status visible.

**RT**
- Server-side `notification:new` carries a `route` field used by mobile to deep-link.
- All sockets pass through a single auth middleware verifying JWT and user state; banned/suspended users disconnected.

### 5.3 AC
- Cold-launch with a pending delivery: opening the app jumps to TrackingScreen automatically if a push for that request was tapped from the lock screen.
- Killing network, then restoring, shows the "Reconnecting…" pill briefly and resyncs the rider marker.
- Notification Center contains every transactional event (top-up, transfer, request status, settlement) with correct deep links.
- FCM tokens that fail are cleared after the third permanent failure.
- A user can leave the app open for ≥1 hour and resume actions without being kicked back to the Login screen; access tokens refresh transparently in the background, and the Sessions screen's `lastUsedAt` advances with each refresh.

---

## Phase 6 — Discovery, Pricing API, Saved Addresses

### 6.1 Goals
Customer can find, pick, and re-use what they need fast. Home is alive with active state and recent activity. Saved addresses are first-class.

### 6.2 Tasks

**DB**
- `SavedAddress` table: `(id, userId, label, address, lat, lng, placeId?, isDefault, createdAt, updatedAt)`. Index on `(userId, label)`.

**BE**
- `GET /api/search?q=&type=&lat=&lng=&radius=` returning unified `[{kind:'merchant', ...}, {kind:'product', ...}]` with PostgreSQL trigram or Meilisearch backing (start with trigram `pg_trgm` GIN index for the V1 dataset).
- `GET /api/nearby?type=&lat=&lng=&radius=` with merchant geo-filter (PostGIS `ST_DWithin` or simple bounding box for V1).
- `GET /api/banners` admin-managed banner list with `imageUrl, deepLink, startsAt, endsAt, audience`.
- Saved addresses CRUD: `GET/POST/PATCH/DELETE /addresses`, `POST /addresses/:id/default`.
- Active-request endpoint `GET /api/requests/active` returning the user's currently active request (status in active set) — single query for the home banner.

**MO**
- HomeScreen:
  - Search bar opens a modal that hits `/search` with debounce and shows merchant + product chips.
  - **Active Request Banner** above the request grid: appears when `/api/requests/active` returns a request; shows status, ETA, "Track" CTA. Subscribed to socket so it self-updates.
  - **Recent Activity** section pulls last 5 from `/api/requests` and `/wallet/transactions` interleaved by date; tap routes to detail.
  - Promo banner reads from `/api/banners`; if none, hide the section entirely.
  - HomeScreen is category-driven: replace the hardcoded Food/Pharmacy/Grocery/Package tiles with a row of category chips fetched from `/api/merchant-categories` (top N by merchant count, "More" link to full list). Featured merchants carousel filters by selected category. New categories added in admin appear within 60 s.
- **SavedAddressesScreen** rebuilt as a list:
  - Each entry: label, address, default badge.
  - Add/edit/delete with map picker.
  - Used as the picker source for `CreateRequest` (PACKAGE pickup/dropoff) and `Checkout` (FOOD/GROCERY/PHARMACY dropoff).
  - When KYC & profile complete, prompt to add Home + Work on first visit.

### 6.3 AC
- Searching "rice" from Home returns matching merchants and products.
- Placing a request and navigating away — Home shows the active banner and updates from REQUESTED → RIDER_ASSIGNED → … live.
- Adding "Home" address once means every future delivery defaults to it.
- Banners served from admin dashboard appear within 60 s of publish.

---

## Phase 7 — Utility / VTU Hardening

### 7.1 Goals
VTU is reliable, transparent, and convenient. Electricity goes live. Failures auto-refund. Beneficiaries cut taps.

### 7.2 Tasks

**BE**
- `POST /utilities/verify-meter` { disco, meterNumber, meterType } → calls `alrahuzService.validateMeter`; mobile shows customer name before charging.
- `utility.worker.js` reconciliation:
  - On AlRahuz response with status `pending`, schedule polling job every 30 s up to 5 min.
  - On final `failed` → refund customer wallet via single Prisma transaction; mark `UtilityPayment` as `FAILED`; emit socket + push.
  - On final `delivered` → mark `COMPLETED`; for electricity, emit token via push and SMS.
- `GET /utilities/data-plans` already exists; cache 1 hour in Redis.
- `GET /utilities/networks` static list; `POST /utilities/detect-network` { phone } → returns serviceID by prefix; or do client-side from a constant table (acceptable since prefixes change rarely).
- `GET /utilities/discos` returns DISCO list from AlRahuz.
- `POST /utilities/electricity` already exists; ensure beneficiaryName persisted on success, returned to client.

**MO**
- **AirtimeScreen** & **DataScreen**:
  - Auto-detect network on phone change (debounce 500 ms) and pre-select; user can override.
  - Saved-beneficiary chip row above input.
  - Recent recipients (last 5 unique).
- **ElectricityScreen** built end-to-end:
  - DISCO picker.
  - Meter type (prepaid/postpaid).
  - Meter number → verify on blur → show customer name.
  - Amount with quick chips and minimum.
  - PIN confirm.
  - Result screen with token display, copy, share.
- **UtilityHistoryScreen**: filter by service; row shows status; pending rows poll the server when opened.
- HomeScreen Electricity tile no longer "Coming Soon" — routes to `Electricity`.

**Tests (inline — money paths)**
- `utility-refund.spec.js`: an AlRahuz `failed` response triggers a wallet refund within the polling window; the `UtilityPayment` row ends as `FAILED`; the customer balance is restored to the pre-payment value to the kobo.
- `utility-idempotency.spec.js`: replaying the same AlRahuz webhook does not double-credit or double-refund; the second call returns the original outcome.
- `electricity-token.spec.js`: a `delivered` electricity response persists the token, emits push + SMS, and the token is retrievable from history.
- These ship in the same PR as the feature they cover.

### 7.3 AC
- Buying ₦200 MTN airtime credits the phone within 30 s; transaction record matches; receipt available.
- A failing AlRahuz call refunds the wallet automatically; user sees "Refunded" toast within 5 minutes.
- Electricity token displayed in app and re-accessible from history; SMS delivered via Termii.
- Saved meter / phone re-purchase is a 3-tap flow.

---

## Phase 8 — Pharmacy & Grocery

### 8.1 Goals
Open Pharmacy and Grocery to customers. Reuse the unified Request infrastructure built in earlier phases; add type-specific UX.

> Note: variant/SKU modeling (size, color, pack size/unit, etc.) and category-driven product forms already landed in Phase 2. This phase only adds the **type-specific UX** (prescription upload, substitution preferences, dosage display) on top of the unified product model.

### 8.2 Tasks

**BE**
- Product schema additions (on top of the variant model from Phase 2): `requiresPrescription Bool @default(false)`, `dosage String?` on `Product` (pharmacy-specific, not variant-specific).
- Validator updates on `request.validator`:
  - For pharmacy merchants: require `prescriptionUrl?` on the request when any line item's product has `requiresPrescription = true`.
  - For grocery merchants: allow `substitution: 'NONE'|'MERCHANT_PICK'|'CONTACT_ME'` per line item.
- Cloudinary signed-upload endpoint extended to allow prescription docs with audit trail.
- Merchant product form already renders the right axes/pack inputs for pharmacy and grocery (from Phase 2). This phase only adds the prescription-required toggle and dosage text input on the form.

**MO**
- HomeScreen Pharmacy & Grocery tiles activated.
- `MerchantMenuScreen` shows variants per type:
  - Grocery: weight/unit, "Substitution" chip on each cart row.
  - Pharmacy: prescription banner if required; upload step inserted into `CheckoutScreen`.
- `CheckoutScreen` adds:
  - Prescription upload (camera or gallery; uploads to Cloudinary; URL attached to request).
  - Substitution preference per item.
- Tracking copy adapts: "Pharmacy preparing your order", "Substituted by merchant", etc.

### 8.3 AC
- Customer orders a real prescription drug end-to-end: upload prescription → pharmacist accepts → fulfills → rider delivers; receipt + history correct.
- Grocery substitution preferences honored by merchant dashboard (existing) and shown back in tracking timeline.

---

## Phase 8.5 — General Retail & Returns

### 8.5.1 Goals
Open the platform to any merchant category beyond food/pharmacy/grocery — clothing, shoes, electronics, hardware, beauty, anything admin adds. The variant/pack/attributeSchema groundwork is already in place from Phase 2; this phase ships the **general-retail customer UX** and the **returns flow** that retail needs but food/pharmacy/grocery did not.

### 8.5.2 Tasks

**DB**
- New `RequestReturn` table: `(id, requestId, requestItemId, reason, status [REQUESTED|APPROVED|REJECTED|PICKED_UP|REFUNDED], photoUrls String[], refundTransactionId?, reversePackageRequestId?, createdAt, resolvedAt?)`.
- Returns modeled as a separate lifecycle on `RequestReturn`; original `Request.status` stays `SETTLED`. No new `RequestStatus` enum value.
- New settings (`PlatformSetting`): `retail.returnWindowDays` (default 7), `retail.returnPickupPayer` (`MERCHANT|PLATFORM`, default `MERCHANT`).

**BE**
- New `modules/returns/`:
  - `POST /api/requests/:id/returns` — customer initiates within `retail.returnWindowDays`. Validates request is `SETTLED`, item belongs to request, window open.
  - `GET /api/returns?role=customer|merchant` — list.
  - `PATCH /api/returns/:id/approve` (merchant), `/reject`, `/picked-up` (rider via reverse-package flow), `/refund` (system).
  - Approval triggers a `PACKAGE` Request in reverse (customer → merchant) using existing rider matching. Pickup fee paid per `retail.returnPickupPayer`.
  - Refund on `REFUNDED` debits merchant wallet, credits customer wallet — single Prisma transaction, emits sockets.

**Admin dashboard**
- Returns moderation screen: list of disputed returns (merchant rejected but customer escalated), with approve/reject/override actions and audit trail.
- Per-customer return-rate report (read-only in V1; enforcement deferred to V1.1).

**Merchant dashboard**
- Returns inbox: pending returns with photo evidence; approve/reject with reason; auto-creates the reverse-package request on approve.
- Return analytics on the dashboard: return rate per product/variant over the last 30 days.

**MO**
- HomeScreen category chips (from Phase 6) already surface every merchant category. Verify copy and empty states render correctly for retail categories.
- `ProductDetailScreen` already renders variant picker and pack info (from Phase 2). Verify retail-specific copy: size charts for fashion (open as a sheet), warranty text for electronics (read from a per-category content slot).
- `OrderDetailScreen`: each settled retail order shows a "Return item" button per line within the return window.
- `ReturnRequestScreen` (new): pick item(s), reason dropdown (Wrong size, Damaged, Not as described, Changed mind), photo upload (Cloudinary, up to 5 images), submit.
- `ReturnsScreen` (new): customer's returns with status badges and live tracking when the reverse-package is in motion (reuses Phase 4 tracking UI).

**RT**
- `return:status:changed` socket event to customer and merchant; deep-links into `ReturnsScreen`.

### 8.5.3 AC
- A customer buys a size-M black T-shirt from a clothing merchant; within the return window, they request a return with a photo; merchant approves; a reverse PACKAGE is dispatched; on `PICKED_UP` and merchant confirmation, wallet is refunded automatically.
- A clothing store with single-SKU items still works without forcing a variant picker (relies on Phase 2 single-variant auto-resolve).
- Admin can add a new `MerchantCategory` (e.g., "Beauty", "Hardware") and the customer app surfaces a working browse + buy + return experience without code changes.
- Return reverse-package pickup fee is charged to whichever wallet `retail.returnPickupPayer` points at; reconciliation worker (Phase 10) catches mismatches.

### 8.5.4 Risks
- Returns abuse — log return rate per customer; flag for review at >30% over a rolling window. Out of scope for V1 enforcement; flag for V1.1.
- Photo-evidence quality: enforce min 1 photo, max 5; downscale on upload to avoid storage bloat.
- Reverse-package fee accounting: if `retail.returnPickupPayer = MERCHANT` but merchant wallet is empty, hold the return in `APPROVED` and notify merchant rather than letting platform float the cost silently.

---

## Phase 9 — Localization, Accessibility, Polish

### 9.1 Goals
Ship in Hausa and English. Fully accessible per WCAG 2.1 AA where relevant on mobile. Empty/error states feel intentional.

### 9.2 Tasks

**MO**
- `i18next` + `expo-localization`. Move all UI strings into `i18n/{en,ha}.json`. Translation pass for Hausa with native reviewer.
- Locale toggle in Settings; persist to SecureStore; default to device locale falling back to English.
- Right-to-left review (not needed for Hausa but verify layout is locale-agnostic).
- Accessibility audit:
  - All `TouchableOpacity` get accessible labels and roles.
  - Color contrast on primary CTAs ≥4.5:1.
  - Dynamic type support — test at largest font setting.
  - Screen reader walkthrough for: signup, fund, send, package, food, airtime.
- Empty / loading / error states for every list (Orders, Wallet history, Notifications, Beneficiaries, Saved Addresses, Merchants, Search results).
- Skeleton loaders replacing spinners for primary screens.

**BE**
- Translatable error messages: errors return both `code` and `message`; mobile resolves to localized text via i18n keys keyed on `code`.

### 9.3 AC
- Every visible string toggles to Hausa.
- VoiceOver / TalkBack walkthrough produces sensible audio on the five flows above.
- Largest-font setting does not clip CTAs on a 360×640 device.

---

## Phase 10 — Quality, Performance, Observability, Launch

### 10.1 Goals
Ship to stores. Confidence in production. Fix what monitoring reveals.

### 10.2 Tasks

**BE**
- **Tests (end-loaded)**: money-path tests from Phase 3, 4, and 7 already merged. Now backfill the rest: `/auth` (signup, login, PIN, sessions, phone change), `/api/requests` non-money paths (creation validation, status transitions, listing/filtering), `/notifications`, `/addresses`, `/search`, `/maps`. Target ~60% service coverage in aggregate (the money paths are already higher). Use `supertest` + Prisma test container. Skip ≥75% coverage targets — diminishing returns on UI-adjacent services.
- **Load test** the matching pipeline at 100 concurrent active requests; tune Redis geo lookups.
- **Observability**: Sentry on backend, structured logs (`pino`), traces via OpenTelemetry. Dashboards for: request matching latency, escrow balance over time, webhook success rate, FCM delivery rate, active socket count.
- **Reconciliation worker** runs nightly; alerts to admin email if discrepancy >₦100.
- **Backups**: daily Postgres snapshot retained 30 days; Redis snapshot every 6 h.
- **Rate limiting**: per-user limits on creation endpoints (`POST /api/requests`: 30/hour), per-IP global limits, abuse heuristics.
- **Security review**: `npm audit`, OWASP top 10 sweep, input validation audit, CSRF safety on web endpoints if any, secret rotation runbook.

**MO**
- **Tests**: Detox E2E for the five golden flows; Jest unit tests for slices.
- **Crash reporting**: Sentry React Native; symbolicated source maps uploaded per build.
- **Analytics**: minimal funnel events (signup → KYC done → first wallet fund → first delivery → second delivery). Use Posthog or Firebase Analytics.
- **Performance**:
  - Image caching with `expo-image` everywhere (merchant covers, products, banners).
  - List virtualization audited (already using FlatList; verify keys).
  - Bundle size review.
- **Stores**:
  - Icon, splash, screenshots in EN + HA.
  - Privacy policy & ToS hosted; deep link to in-app Legal.
  - iOS App Store privacy questionnaire & data-collection disclosure.
  - Android Play Console: data safety form; signed AAB; pre-launch report.
  - EAS production build, internal testing → closed testing → production rollout 10% → 100%.
- **Runbook & docs**:
  - Deployment runbook (already promised in proposal).
  - On-call escalation.
  - Known-error library.
  - User support FAQ v1.

### 10.3 AC
- Both apps live in stores; ratings dashboards monitored.
- 24-hour soak test in staging with synthetic traffic produces no error rate spike.
- Crash-free sessions ≥99.5% during the first 7 days post-launch.
- Reconciliation passes daily.
- Support runbook covers the 20 most common tickets predicted from beta.

---

## Cross-Phase Standing Workstreams

These run alongside every phase and are not optional.

### Continuous Backend Hygiene
- After every phase, regenerate Postman collection and OpenAPI spec from validators.
- Update `docs/API_CONTRACT.md`.
- All new endpoints: validator + controller + service + docs in the same PR. **Tests are end-loaded to Phase 10** except for the money-path tests called out explicitly in Phase 3, Phase 4, and Phase 7 — those ship in the same PR as the code they cover.

### Continuous Mobile Hygiene
- Every new screen ships with: empty/loading/error states, accessibility labels, i18n keys (English at minimum, Hausa added in Phase 9), Sentry integration. Detox and Jest test suites are written in Phase 10.

### Security
- Secrets only in environment; never in git (already enforced).
- `Content-Security-Policy`, `helmet`, CORS allow-list verified in each phase that touches HTTP.
- PII (BVN, phone, email) hashed/redacted in logs.

### Compliance
- KYC + AML record retention 5 years.
- Daily reconciliation reports archived.

---

## Dependency Graph (Critical Path)

```
0 — Foundations
└── 1 — Identity & Security
      └── 2 — Unified Schema
            ├── 3 — Wallet Completion ─┐
            └── 4 — Logistics ─────────┤
                  └── 5 — RT & Notif ──┤
                        └── 6 — Discovery
                              ├── 7 — Utility Hardening
                              └── 8 — Pharmacy & Grocery
                                    └── 8.5 — General Retail
                                          └── 9 — Localization & A11y
                                                └── 10 — Launch
```

---

## Definition of Done (per phase)

A phase is shippable only when **all** of the below are true:

1. All listed BE/DB/MO/RT tasks implemented and merged to `main`.
2. Migrations applied in staging; smoke test passed; rollback plan documented.
3. Money-path tests for the phase (where called out — Phase 3, 4, 7) pass in CI. Full unit + integration + E2E suite is required only at Phase 10.
4. Manual QA against AC by a second engineer or QA on a physical Android + iOS device.
5. Strings updated in i18n EN files (HA in Phase 9+).
6. Accessibility quick-pass: tap targets, color contrast, screen reader labels.
7. Sentry / Posthog events instrumented for new screens / endpoints.
8. Postman + OpenAPI updated.
9. `ROADMAP.md` and `docs/*` updated to reflect new state; `customer-app-implementation.md` checkpoints crossed off.
10. Tagged release candidate built via EAS for mobile and deployed to staging for backend; client-visible changelog written.

---

## Out-of-Scope (Explicit)

These are intentionally not in this roadmap:
- Web customer app.
- Cable TV, betting, sports VTU.
- Surge/dynamic pricing.
- Insurance.
- B2B / merchant API for bulk orders.
- Crypto, FX, multi-currency.
- Referral / loyalty (proposed for V2).

Add a separate roadmap if any of these are pulled in.

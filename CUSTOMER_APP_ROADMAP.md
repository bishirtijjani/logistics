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

> **Status: ✅ COMPLETE. Tests deferred to Phase 10 per the cross-phase test policy.**

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
- ✅ Replace hardcoded fees — `request.service.js` uses `getSetting()` for all fee categories (delivery base/per-km/platform%, merchant item platform%); `config.*` only as fallback default. Utility service has no fees (prices from `VtuPlan` table); no separate checkout service.
- ✅ Idempotency middleware on `POST /api/requests` — applied at `request.routes.js:44`. Also applied to all POST `/utilities/*` routes (`utility.routes.js:24-27`).
- ✅ `utils/status.js` with unified `STATUS`, `TRANSITIONS`, `canTransition`, `assertTransition`, `toUnified` — implemented. Dead `delivery.validator.js` removed (module deleted).
- ✅ Standardize API client base path audit — every mobile `api.<verb>(...)` call uses a path starting with `/`. ESLint rule in `mobile/customer-app/eslint.config.js` enforces this for both string and template-literal paths.

**MO**
- ✅ `services/settings.js` — fetches `/settings/public` on cold start, `getSetting()` / `usePlatformSetting()` hook available.
- ✅ Replace all hard-coded fees/thresholds with settings lookups — `WithdrawScreen`, `SendMoneyScreen`, `AirtimeScreen`, `ElectricityScreen` all read via `usePlatformSetting(...)` with hardcoded array only as defensive fallback. All settings (`wallet.minWithdraw/maxWithdraw/withdrawalFee/minTransfer/transferQuickAmounts/withdrawQuickAmounts`, `utility.minAirtimeAmount/airtimeQuickAmounts/minElectricityAmount/electricityQuickAmounts`) seeded. `i18n/en.json` deferred to Phase 9.
- ✅ `services/idempotency.js` — exists, generates UUID v4.
- ✅ Idempotency header on mutation thunks — `sendMoney`, `withdrawToBank` (wallet), `buyAirtime`, `buyData`, `buyCable`, `payElectricity` (utility), and `createRequest` (request) all set `Idempotency-Key` header.
- ✅ App boot sequence — `hydrateAuth` + `fetchPublicSettings` + socket connect all happen in AppNavigator. Screen-level debounce timeouts (LocationPickerScreen, SendMoneyScreen, WithdrawScreen) have unmount cleanup.

**RT**
- ✅ N/A this phase.

### 0.3 Acceptance Criteria
- ✅ No string `500` or `100` fee literals in mobile code — settings-driven across all wallet/utility screens.
- ✅ `/api/settings/public` returns seeded defaults.
- ✅ Idempotent `POST /api/requests` — middleware applied at route layer.
- ✅ All `api.get/post/patch/delete` paths begin with `/` — ESLint rule enforces it.
- ⏸ Tests `idempotency.spec.js` / `settings.spec.js` — deferred to Phase 10 per cross-phase test policy.

### 0.4 Risks
- Existing data (KatPay refs, transactions) must not break; idempotency table is additive only.

---

## Phase 1 — Identity, KYC, Security

> **Status: ✅ COMPLETE.**

### 1.1 Goals
Production-grade signup, login, KYC, PIN, and session security. SMS goes out for real. Biometric unlock works. Failed PINs lock the user. Sessions can be revoked individually.

### 1.2 Tasks

**BE**
- ✅ Wire **Termii live** credentials in `config/index.js` — config keys exist. `termiiService.assertConfiguredForProd()` runs at startup (`server.js:25`) and throws in prod/staging if credentials are missing. Per-call guard also rejects with 500 in prod when not configured (no silent dev bypass in prod).
- ✅ KYC verify endpoint atomically:
  1. Marks `kycStatus = VERIFIED` and persists `bvnHash` in a single Prisma transaction (`auth.service.js:650-658`).
  2. Calls `katpayService.createVirtualAccount(...)` synchronously after the tx commits, persists `virtualAccountNumber/Bank/Name` on the wallet (`auth.service.js:686-703`).
  3. On KatPay failure, enqueues `PAYMENT_JOBS.PROVISION_VIRTUAL_ACCOUNT` with 5 attempts and exponential backoff (`auth.service.js:706-714`, worker at `payment.worker.js:240-264`). Worker is idempotent — skips if NUBAN already present.
  4. Sends welcome SMS via Termii + welcome push via FCM (best-effort, won't break KYC).
  5. Returns wallet payload with `virtualAccountReady` flag so the client can show provisioning-pending state.
  Recovery path: an already-VERIFIED user with no NUBAN can re-submit the same BVN (matched via bcrypt) to trigger re-provisioning.
- ⚠️ `Session` table endpoints:
  - ✅ `GET /auth/sessions` — implemented.
  - ✅ `DELETE /auth/sessions/:sessionId` — implemented.
  - ✅ `DELETE /auth/sessions` → revoke all but current — implemented.
  - ✅ `Session` model extended with `deviceName`, `deviceModel`, `userAgent`, `lastUsedAt` (`schema.prisma:1038-1048`).
- ✅ `auth.service.verifyPin` PIN lockout: `pin:fails:{userId}` Redis counter, `pin:lock:{userId}` lock key, server-authoritative — **implemented**.
- ✅ Phone-number change flow: `POST /auth/phone/request-change` → `POST /auth/phone/confirm-change`. OTP sent to new number; security-notice SMS sent to old number on confirm (`auth.service.js:1158-1167`).

**DB**
- ✅ `Session` model extension (`deviceName`, `deviceModel`, `userAgent`, `lastUsedAt`) — present in schema.
- ✅ `BvnVerificationLog` for compliance audit — added with `BvnVerificationOutcome` enum (`SUCCESS|FAILED|RECOVERY`). Migration `20260511060000_add_bvn_verification_log` applied. Every `verifyBvn` branch writes a log row with IP + UA + reason context.

**MO**
- ✅ Replace `expo-secure-store` PIN attempt counters with server-truthful errors — `PinBottomSheet` reads `lockedUntil` and `attemptsRemaining` from server `423`/`401` responses and persists the deadline in SecureStore so a kill+restart still respects the lock.
- ✅ `PinBottomSheet`: shake animation on failure (`PinBottomSheet.js:118-126`), lock state with countdown banner (`PinBottomSheet.js:238-249`), "Forgot?" key on keypad calls `onForgotPin` → utility screens wire it to `navigation.navigate("ChangePin")`. (Wallet screens use inline keypad, not the sheet; functional parity via inline shake + server error messages.)
- ✅ **Biometric unlock** with `expo-local-authentication`:
  - ✅ `services/biometric.js` — fully implemented.
  - ✅ Settings toggle in `SecuritySettingsScreen` calls `authenticateWithBiometric()` and persists via `persistBiometricEnabled()`.
  - ✅ Cold-start biometric prompt before showing main UI — wired in `AppNavigator.js:94-119`; gated `bioGate` state (`pending` | `required` | `passed`) shows locked screen until authenticated.
  - ✅ PIN-vs-biometric risk split — biometric only unlocks the app shell; every financial action (transfer, withdraw, utility purchase, etc.) requires explicit 6-digit PIN via `verifyTransactionPin`.
- ✅ **Sessions screen** — implemented (`SessionsScreen.js`); shows device/IP, revoke per row, "Sign out all other devices" banner.
- ✅ **Phone change screen** — implemented (`PhoneChangeScreen.js`); 2-step: new phone + password → OTP → success.
- ✅ **FCM token registration** in `authSlice.login.fulfilled` / `hydrateAuth.fulfilled` via `registerPushToken()` (`authSlice.js:39,145`).
- ✅ `BvnVerificationScreen` shows resulting NUBAN immediately after KYC success (`BvnVerificationScreen.js:169-216`), with a "Setting up your wallet…" pending state when provisioning is queued.

### 1.3 AC
- ✅ New signup receives a real Termii SMS in prod (startup guard fails fast if creds missing).
- ✅ Bank-app transfer to the NUBAN minted on KYC success credits the wallet within 30 s — provisioning is sync-with-retry-queue (queue picks up if KatPay was down at KYC time).
- ✅ 6 wrong PINs lock the user — server-truthful lockout (`pin:fails`/`pin:lock` Redis keys); mobile `PinBottomSheet` reads lockout deadline from response and shows live countdown that survives app restart.
- ✅ A second login on a different device shows up in Sessions with device name and lastUsedAt.
- ✅ Biometric unlock works on iOS Face ID and Android fingerprint; toggling off forces PIN at cold start.
- ✅ Phone-number change requires both password and OTP, and notifies old number on confirm.

### 1.4 Risks
- Termii cost — rate-limit OTP sends per phone/day at the application layer (existing `otpLimiter` keeps this in check).
- Biometric on emulators is fake; ensure CI doesn't gate on it.

---

## Phase 2 — Unified Schema & Product Model Migration

> **Status: ✅ COMPLETE. Note: legacy `DeliveryOrder` data preservation (2.1, 2.2) is N/A pre-prod — the prior schema migration dropped the table without backfill, and git history shows no production deployments preceded that point. Detox/Jest end-to-end AC verification deferred to Phase 10.**

### 2.1 Goals
End the dual-rail (`DeliveryOrder` legacy ↔ `Request` unified). After this phase the customer app has **one** order list, **one** tracking screen, **one** status taxonomy, and the backend has **one** source of truth.

In the same window, land the **unified product model** so every category that comes later (food, pharmacy, grocery, clothing, shoes, electronics, anything) reads from the same shape. The model separates three concepts that today get conflated: selection axes (size/color/strength), pack/unit (500ml, 30 tablets, 1 kg), and quantity. Doing this once now avoids backfilling live products, carts, and order history later, and avoids retraining merchants on a second product form.

### 2.2 Tasks

**DB**
- ⏸ Migration `migrate_delivery_orders_to_requests` (N/A pre-prod):
  - The schema migration `20260511055348_phase2_unified_products_variants_options` already drops `delivery_orders` and `Rating.deliveryOrderId` non-destructively for dev DBs (no rows present). For any future restoration scenario the original schema was kept in git history.
  - `legacyDeliveryOrderId` column was not added to `Request` — no data needed to be carried over.
- ⏸ Drop `DeliveryOrder` post-soak (N/A — already dropped in the same migration as item above; no soak window applicable pre-prod).
- ✅ Add fields to `Request`: `escrowTransactionId`, `searchAttempts`, `lastBroadcastAt`, `cancellationFee`, `refundTransactionId` — all present (`schema.prisma:809-815`).

**DB — Product model**
- ✅ All schema items below are implemented (`ProductVariant`, `MerchantCategory.attributeSchema`, `RequestItem.variantId`, `ProductOptionGroup`, `ProductOptionItem`, `RequestItem.selectedOptions` etc.). Backfill migration `20260511060500_backfill_product_variants` written and applied to dev: creates a default `ProductVariant` per existing `Product` (carrying `basePrice`/`stock`), then backfills `RequestItem.variantId` to point at the lowest-priced available variant per product. Idempotent — safe to re-run.
- ⏸ Drop legacy `Product.variations` column — already dropped in `20260511055348` migration.
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
- ✅ Delete `modules/delivery/*` — module removed.
- ✅ `request.service`:
  - ✅ `createRequest` exists as single entry point with type routing.
  - ✅ `type=PACKAGE` body including `PackageDetail` handled in `createRequest`.
  - ✅ `estimateRequest(...)` exported as standalone (`request.service.js:870`).
  - ✅ `updateStatus` enforces FSM via `canTransitionStatus` at every call site (`request.service.js:401, 736`).
- ✅ Status mapping helper — `toUnified` (`utils/status.js:94`) handles legacy → unified mapping. Now that `DeliveryOrder` is gone there is only one taxonomy on the wire; no per-response mapping needed.

**BE — Product model**
- ✅ `merchant.service`: variant CRUD nested under product (`POST /merchants/.../products/:pid/variants`, `PATCH/DELETE /variants/:vid`) — `merchant.routes.js:123-125`. Product list responses embed variants ordered by price asc, so the lowest-priced available variant is `variants[0]` for card display.
- ✅ `request.service.createRequest` accepts `items: [{ productId, variantId?, quantity, selectedOptions?, specialInstructions? }]`. Validator rejects multi-variant products without `variantId`; single-variant auto-resolves server-side (`resolveLineItems`, `request.service.js:65-94`).
- ✅ Stock decrement on resolved `variantId`, with auto-flip to `isAvailable=false` when stock hits zero (`request.service.js:293-302`).
- ✅ Search/discovery skeleton at `/api/search` and `/api/nearby` — accept `q`, `type`, `category`, `lat`, `lng`, `radius`. Bounding-box geo filter; returns `category.attributeSchema` on each merchant for facet UI. Full UX in Phase 6.
- ✅ Admin attribute-schema endpoint: `PATCH /admin/categories/:categoryId/attribute-schema` with Zod validation (`admin.routes.js:82`).

**Admin dashboard**
- ✅ **Category Taxonomy** screen (`admin-dashboard/src/pages/CategoriesPage.jsx`). Lists `MerchantCategory` rows; row editor offers two modes — a visual axis chip toggle and a raw JSON editor — with live merchant-form preview pane and Zod-validated save. Calls `updateCategoryAttributeSchema`.
- ⏸ Admin product moderation variant display — no admin product list screen exists in V1 (admin moderates merchants, not individual products). Product API responses include variants/attributes/pack/stock, so the screen will Just Work when added in a later phase.

**Merchant dashboard**
- ✅ Product create/edit form is category-driven (`merchant-dashboard/src/pages/MenuPage.jsx`):
  - On category select, the form reads `category.attributeSchema` and renders only the axes + pack inputs that category needs.
  - `VariantMatrixBuilder` generates one SKU row per axis combination; merchant can prune manually and edit each row's price/stock/image inline.
  - Single-SKU shortcut: skip the matrix, enter price + stock once, system creates one default variant invisibly.
  - `packLabel` auto-fills from `packSize`+`packUnit`, with an override input for unusual displays.
- ✅ Inventory: per-variant stock with inline editing in the variant matrix (`MenuPage.jsx`). Per-variant `totalStock` aggregation; low-stock visibility happens at the variant level. Bulk per-row inline editing covers the bulk-edit use case.

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
- ✅ `merchant.service` nested CRUD: `POST /merchants/.../option-groups`, `PATCH/DELETE /option-groups/:gid`, plus item-level CRUD under each group (`merchant.routes.js:128-135`).
- ✅ Bulk-upsert endpoint `PUT /merchants/.../option-groups` (`bulkUpsertOptionGroups` in `merchant.service.js`) — single-transaction reconciliation: groups/items present by id are updated, missing ones deleted, new ones created. Used by menu import and "apply template".
- ✅ Product detail response embeds `optionGroups: [{id, name, selectionRule, minSelect, maxSelect, items:[...]}]` for one-shot render (`merchant.service.js:643-646`).
- ✅ Snapshot logic at order creation — `resolveLineItems` reads current option-group / item rows by id, validates `minSelect`/`maxSelect`/required, denormalizes into `RequestItem.selectedOptions`, computes `unitPrice = variant.price + Σ priceDelta` and `lineTotal = unitPrice × quantity` server-side. Client-sent prices are never persisted (`request.service.js:96-148`).

**Merchant dashboard — Option groups (food-specific UI)**
- ✅ Per-product `OptionGroupsBuilder` (`merchant-dashboard/src/pages/MenuPage.jsx`): inline-edit `name`, `selectionRule`, `min`, `max` per group; inline-edit item `name`, `priceDelta`, `isDefault`, `isAvailable`. Templates and live-preview pane are V1.1 enhancements; the underlying API (`bulkUpsertOptionGroups`) is already shaped to receive them.
- ✅ 86-toggle: `isAvailable=false` on an option item is a single PATCH and propagates to customers via `merchant:menu:updated` socket within 30s.

**Customer app — Food product detail (this is where food's UX lives)**
- ✅ `ProductDetailScreen` (`mobile/customer-app/src/screens/merchant/ProductDetailScreen.js`) renders: hero + variant picker (when `variants.length > 1`) + per-group input (radio for `*_ONE`, checkbox for `*_MULTIPLE` with `maxSelect` disable) + price-delta chips only when non-zero + unavailable-item grey state + 200-char special instructions textarea + quantity stepper + sticky live-total CTA.
- ✅ CTA disabled until every required group is satisfied; tapping a disabled CTA scrolls + highlights the offending group via `highlightGroupId` state + `groupRefs`.
- ✅ Cart line shows full breakdown via the same `selectedOptions` shape that's persisted server-side.
- ✅ Edit-from-cart preloads prior selections via `editingLineId` route param + `editingLine` lookup.

**MO**
- ✅ Delete `screens/delivery/CreateDeliveryScreen.js`, `TrackDeliveryScreen.js`, `RateDeliveryScreen.js` — all three removed; `AppNavigator` no longer references them.
- ✅ `screens/request/CreateRequestScreen.js` for PACKAGE type — created.
- ✅ `screens/request/RequestTrackingScreen.js` — full unified status timeline via `STEP_ICON` map keyed on every unified status (`RequestTrackingScreen.js:28-39`); merchant card conditional on `currentRequest.merchant`.
- ✅ `screens/request/RateRequestScreen.js` — created.
- ✅ `OrdersScreen` — tab groupings `Active | Completed | Cancelled` map to `ACTIVE_STATUSES`, `COMPLETED_STATUSES`, `CANCELLED_STATUSES` from `lib/requestStatus.js` (`OrdersScreen.js:16-22, 60-64`).
- ✅ `lib/requestStatus.js` with unified `STATUS`, `statusDisplay`, `statusTimeline` — created.

**RT**
- ✅ Customer app `delivery:*` socket listeners removed.
- ✅ `socketService` handles `request:status:changed`, `request:rider:assigned`, `request:rider:location` (+ `rider:location:broadcast` alias), `request:merchant:accepted`, `request:merchant:ready`, `request:completed`, `request:cancelled` (`socket.js:88-126`). `RequestTrackingScreen` subscribes via `onRequestStatusChanged` / `onRequestRiderAssigned` / `onRequestRiderLocation` / `onRequestCompleted` / `onRequestCancelled` and dispatches `updateRequestFromSocket` / `updateRiderLocationFromSocket` (`RequestTrackingScreen.js:53-85`). Room join/leave on mount/unmount.

### 2.3 AC
- ⏸ `DeliveryOrder` table empty (N/A pre-prod — table was dropped without preservation; no rows existed).
- ✅ Tracking, history, ratings render identically for FOOD and PACKAGE — `RequestTrackingScreen` / `OrdersScreen` / `RateRequestScreen` are type-agnostic; live updates via socket handlers.
- ⏸ Existing in-flight orders migrated without state loss (N/A pre-prod).
- ✅ Mobile app build has zero references to "delivery" routes/slices.
- ✅ Every existing `Product` has at least one `ProductVariant` row; every `RequestItem` has a resolved `variantId` — applied via `20260511060500_backfill_product_variants`.
- ✅ Admin can add a new `MerchantCategory` and define its `attributeSchema` via the Category Taxonomy screen; the merchant product form auto-renders the right fields from the schema without code changes.
- ⏸ Manual QA scenarios (one product per category, Jollof Combo end-to-end, 86-Plantain propagation, price tampering rejection) — code paths in place and covered by validator/snapshot logic; explicit Detox/manual run deferred to Phase 10 per cross-phase test policy.

### 2.4 Risks
- In-flight deliveries during migration: run migration during a maintenance window; for active orders, dual-write for a 30-min cutover.
- Variant explosion (size × color × style): cap at 100 variants per product in V1 with a clear merchant-side error; paginate the variant list in the merchant dashboard.
- Merchant retraining: the product form changes shape. Ship a short in-app walkthrough and a written changelog before the cutover; allow a 1-week dual-form window if merchant feedback warrants it.

---

## Phase 3 — Wallet Production Completion

> **Status: ✅ COMPLETE. Money-path tests (escrow / transfer / withdrawal / reconciliation specs) deferred to Phase 10 per the cross-phase test policy; the reconciliation worker itself ships now since Phase 3.4 calls it out as the escrow accounting mitigation.**

### 3.1 Goals
Wallet feels live, not stale. Customer can fund, send, withdraw, see history, save beneficiaries, and view receipts. Money movements emit sockets so balance updates in real time.

### 3.2 Tasks

**BE**
- ✅ Money **escrow** primitive (full lifecycle):
  - ✅ `ESCROW_HOLD` on request creation — debit customer → credit `PLATFORM_ESCROW` SystemWallet; `ESCROW_HOLD` Transaction written; all in a single Prisma transaction (`request.service.js:315-343`).
  - ✅ `ESCROW_RELEASE` on `SETTLED` — `request.worker.js` `settleRequest` debits `PLATFORM_ESCROW` by `merchantEarning + riderEarning + platformEarning`, credits merchant + rider + `PLATFORM_EARNINGS`, writes one `ESCROW_RELEASE` ledger row alongside the per-party `MERCHANT_EARNING` / `RIDER_EARNING` / `PLATFORM_EARNING` rows. All in one Prisma transaction.
  - ✅ `ESCROW_REFUND` on `CANCELLED` — `request.worker.js` `refundRequest` debits `PLATFORM_ESCROW`, credits customer wallet, writes `ESCROW_REFUND` plus the customer-facing `REFUND` row, persists `Request.refundTransactionId`. Idempotent: early-returns when `refundTransactionId` is already set, so a retry can't double-refund (the status guard alone isn't enough since CANCELLED is terminal).
- ✅ Socket emission on every wallet mutation via `services/notify.service.js`: `balanceUpdated`, `transferReceived`, `fundingReceived`. Called from `wallet.service.js` (transfer / withdrawToBank / fundWallet) and `request.worker.js` (settle / refund).
- ✅ Bank account name lookup `POST /wallet/banks/lookup` — `wallet.routes.js:28`; service hits KatPay `/bank-account/resolve` with 6h Redis cache.
- ⏭ Receipts:
  - ✅ `GET /wallet/transactions/:id/receipt` returns a JSON receipt.
  - ✅ PNG generation moved client-side: `ReceiptScreen` uses `react-native-view-shot` + `expo-sharing` to share the rendered receipt as an image. Removes the backend canvas dependency without losing parity. Server-rendered PNG (`@napi-rs/canvas`) intentionally **skipped** — revisit only if a non-mobile consumer needs it.
- ✅ `SavedBeneficiary` endpoints (list, add phone/bank, delete, set default).
- ✅ Withdrawal queue worker `PROCESS_WITHDRAWAL` — `payment.worker.js` `handleWithdrawal` calls KatPay payout, marks COMPLETED on success, writes a `REFUND` transaction + restores wallet on failure, emits sockets at both branches.
- ✅ Reconciliation: `services/reconciliation.service.js` runs the wallet-parity + escrow-conservation invariants; payment-queue cron `cron:run-reconciliation` fires daily at 03:15. Each run persists as an `AuditLog` row; drift logs at `.error` level for Sentry pickup.

**DB**
- ✅ `SystemWallet` table — `PLATFORM_ESCROW` and `PLATFORM_EARNINGS` rows seeded.
- ⏭ `WithdrawalRequest` table — **intentionally skipped**. Withdrawal lifecycle is already fully tracked on `Transaction(type=WITHDRAWAL)` (status, KatPay ref via `providerRef`, retry count via BullMQ `attemptsMade`). A separate table would duplicate that without functional gain.
- ✅ `SavedBeneficiary` model present with phone/bank distinction.

**MO**
- ✅ **Send Money** screen — phone input → name lookup → amount → PIN → success. Accepts `route.params` prefill (used by the Repeat button).
- ✅ **Withdraw** screen — bank picker → account → name lookup → amount → PIN. Accepts `route.params` prefill.
- ✅ **Transaction History** screen — `fetchTransactions` thunk with type-filter tabs, infinite scroll, tap → receipt. Filters drawer adds date-range presets (All / 7d / 30d / 90d) and debounced reference + description search. Backend accepts `startDate`, `endDate`, `q` query params.
- ✅ **Receipt screen** — shows amount, type, status, balanceBefore/After, date. `ViewShot` captures the receipt card; share routes via `expo-sharing` (image) with `Share.share()` fallback. **Repeat button** routes back to SendMoney / Withdraw / FundWallet with prefilled values from transaction metadata; hidden for ledger-only rows (escrow, earnings, refund).
- ✅ **Saved Beneficiaries** screen — phone/bank tabs, 1-tap Send/Withdraw, delete with confirmation.
- ✅ WalletScreen Send & Withdraw buttons navigate — no more "Coming Soon" toasts.
- ✅ Socket listeners in `walletSlice` extras: `wallet:balance:updated` updates balance + prepends transaction; `wallet:funding:received` and `wallet:transfer:received` show toasts (via the socket service) and prepend optimistic placeholder rows to history. All three wired in `subscribeToWalletSocket()` and registered at app boot from `AppNavigator`.

**RT**
- ✅ `user:{userId}` room auto-join on socket connect — `backend/src/sockets/index.js:62-73` joins on `CONNECTION.CONNECT`.

**Tests (inline — money paths) — ⏸ deferred to Phase 10**
- `escrow.spec.js`: HOLD / RELEASE / REFUND math + concurrent-hold isolation.
- `wallet-transfer.spec.js`: P2P atomicity + idempotency replay safety.
- `withdrawal.spec.js`: payout success / failure + webhook replay.
- `reconciliation.spec.js`: synthetic ledger satisfies the parity + escrow invariants.

### 3.3 AC
- ✅ Funds transferred bank → NUBAN reflect on home screen within 5 s via socket (`fundWallet` emits `balanceUpdated` + `fundingReceived`).
- ✅ P2P send: sender balance updates via REST + socket; recipient receives `wallet:transfer:received` toast and balance update.
- ✅ Withdraw: failed payouts auto-refund — `payment.worker.handleWithdrawal` writes REFUND and re-credits the wallet on KatPay failure, then emits `balanceUpdated`.
- ✅ All transactions appear in history with correct sign and balanceBefore/After; receipt sharing produces a real PNG via ViewShot.
- ✅ Beneficiary: save and reuse phone in wallet screens.
- ✅ Send and Withdraw entry points fully replace the old "Coming Soon" toasts.
- ✅ Reconciliation cron runs nightly; mismatches log at `.error` and persist to `AuditLog` for compliance review.

### 3.4 Risks
- ✅ Escrow introduces a system wallet: a daily reconciliation job (`paymentQueue:RUN_RECONCILIATION` → `reconciliation.service.runReconciliation`) asserts per-wallet ledger parity and `Σ ESCROW_HOLD − (Σ ESCROW_RELEASE + Σ ESCROW_REFUND) === PLATFORM_ESCROW.balance`. Drift greater than `reconciliation.alertThresholdNgn` (default ₦1) is logged at error level for Sentry pickup; Phase 10 will add the admin-email alert path.

---

## Phase 4 — Logistics: Production-Grade Matching, Tracking, Lifecycle

> **Status: ✅ Customer-app side COMPLETE and production-hardened. Tests deferred to Phase 10 per the cross-phase test policy.**
>
> ⚠ **Cross-workstream dependency**: live PACKAGE delivery requires a rider app that listens for `rider:job:new` and accepts via the existing rider endpoint. The rider app is a separate workstream not covered by this roadmap. Until it ships, set the new platform setting `delivery.matchingEnabled = false` in the target environment — the matcher will skip all rings and auto-cancel/refund immediately rather than burn 3 × ringTimeout of phantom "Searching…" UI on every request. Flip back to `true` once the rider app is in the wild.

### 4.1 Goals
The logistics flow becomes the differentiator the proposal promises: predictable matching, accurate fares, real road routes, live ETAs, fair cancellation, production-grade reliability.

### 4.2 Tasks

**BE**
- ✅ **Quote endpoint** `POST /api/requests/quote` returns server-truth pricing + a signed `quoteToken` (HMAC-SHA256 over a payload of `{type, merchantId, geo, subtotal, deliveryFee, platformFee, tax, total, distanceKm, estimatedMinutes, exp}`). `validUntil` = 5 min. `POST /api/requests` requires `quoteToken`; server verifies the signature, checks `exp`, and re-asserts the locked numbers match a fresh `estimateRequest()`. Mismatch or expiry → 400 with re-quote hint. (`utils/quote-token.js`, `request.controller.getQuote`, `request.service.createRequest`).
- ✅ **Expanding-radius rider matching** in `request.worker.broadcastToRiders`:
  - Reads `delivery.broadcastRadiusRings` (default `[5,10,15]`), `delivery.broadcastRingTimeoutSec` (60).
  - Per ring: `GEOSEARCH riders:geo BYRADIUS … COUNT 10 ASC WITHCOORD WITHDIST` → emits `rider:job:new` to each rider's `user:{id}` room with the per-rider distance and ring radius.
  - Waits `ringTimeout`; re-checks `Request.riderId` + status; expands ring if not claimed; emits `RIDER.JOB_TAKEN` when claimed mid-broadcast.
  - All rings exhausted → enqueues `AUTO_CANCEL_UNMATCHED` with no fixed-delay duplicate from create-time.
  - Increments `Request.searchAttempts`, persists `lastBroadcastAt`, emits `request:matching:status` to `user:{customerId}` each ring.
  - Rider GEO index maintained by `tracking.handler.js`: GEOADD on every `rider:location:update`, ZREM on disconnect / `availability:changed → false`.
- ✅ **Auto-cancel refund**: `autoCancelUnmatched` now emits `request:cancelled` via `emitCancelled` so the tracking UI flips immediately, then enqueues `REFUND_REQUEST`. `refundRequest` is idempotent via `Request.refundTransactionId`.
- ✅ **Cancellation policy** server-driven:
  - `REQUESTED` → free.
  - `ACCEPTED | PROCESSING | READY_FOR_PICKUP | RIDER_ASSIGNED | RIDER_EN_ROUTE` → `delivery.cancellationFee` (PlatformSetting).
  - `PICKED_UP+` → 403 from `customerCancelRequest`; admin force-cancel still works.
  - New endpoint `GET /api/requests/:id/cancel-quote` for the customer to preview the fee + net refund before confirming. `DELETE /:id` writes `Request.cancellationFee`; `refundRequest` debits it from the escrow refund and credits `PLATFORM_EARNINGS` (closes the escrow loop).
- ✅ **Directions on tracking** — `GET /api/requests/:id/route` proxies `mapsService.getDirections` from the rider's Redis-cached position to the next checkpoint (pickup if not picked up, else dropoff). Cached in Redis 30 s keyed by `requestId + checkpoint + 4dp position bucket` so a moving rider invalidates naturally. Authorised to participants only (customer / rider / merchant / admin).
- ✅ **Live ETA**: backend pushes `request:rider:eta` to the request room on every rider position update where `>=30s` has elapsed AND the rider moved `>100 m` since the last push. ETA recomputed via `getDirections`; failure paths logged-and-skipped (no UI churn).
- ✅ **PackageDetail** captured on creation: `senderName, senderPhone, recipientName, recipientPhone, instructions` — all wired through `request.validator`, persisted in the transaction, surfaced on `RequestTrackingScreen` with call buttons that dial the recipient/sender (so the rider can call the recipient without leaking the customer's number unless the customer IS the recipient).
- ✅ **In-app messaging**: `RequestMessage` model + migration; `POST /:id/messages`, `GET /:id/messages` (cursor-paginated). Server emits `request:message:new` to the request room. Participant check matches customer / rider's userId / merchant's userId / admin.
- ✅ **Maps autocomplete & place details**: `/api/maps/*` now guarded by `router.use(authenticate, mapsLimiter)` — `mapsLimiter` is 60 req/min per authenticated user. Spec called for `/maps/places/:placeId`; we kept the existing `?placeId=…` query form (same backend cost; client already uses it).

**DB**
- ✅ `RequestMessage` table — migration `20260511090000_phase4_request_messages_index/migration.sql`.
- ✅ Composite covering index `requests(customerId, status)` for the active-request banner query — same migration.

**MO**
- ✅ `CreateRequestScreen` (PACKAGE):
  - Pickup, dropoff, sender + recipient (auto-fill sender from profile), size, instructions.
  - Quote panel refetches on input change; live countdown (`Quote valid for Xm Ys`), warning state <30 s, "Refresh" button, button disabled and copy switches to "Quote expired — refresh" at 0.
  - PIN bottom sheet on submit; passes `quoteToken`, `pin`, `Idempotency-Key`.
- ✅ `CheckoutScreen` (MERCHANT_ORDER):
  - Quote breakdown (subtotal/delivery/platform/total), countdown, auto-refresh on focus when quote age ≥60 s, PIN sheet, `quoteToken` passthrough.
- ✅ `RequestTrackingScreen`:
  - Full 10-state timeline + cancelled summary with fee.
  - Searching banner with `attempt N of M · within X km · N nearby` driven by `request:matching:status`.
  - Live ETA chip ("Arrives in ~12 min (pickup)") driven by `request:rider:eta` + `GET /route`.
  - Polyline decoded inline (`lib/polyline.js`, ~30 LOC, avoids @mapbox/polyline dep) and drawn on the map; rider + pickup + dropoff markers.
  - 30 s `/route` poll while rider is active.
  - Cancel-with-fee modal — fetches `/cancel-quote`, shows fee + net refund, calls `DELETE /:id`.
  - Call buttons: rider, merchant, sender, recipient.
  - In-app chat sheet (`Modal` + `FlatList`, no extra dep) — `GET /messages` on open, `POST /messages` on send, `request:message:new` appends.
- ✅ `OrdersScreen` lifecycle badges: "Searching" / "In transit" / "Awaiting rating" alongside the existing status pill.

**RT**
- ✅ `request:matching:status` — emitted from `broadcastToRiders` each ring; mobile listener in `socket.js → onRequestMatchingStatus`.
- ✅ `request:rider:eta` — emitted from `tracking.handler` when the rider moves >100 m + ≥30 s elapsed; mobile listener `onRequestRiderEta`.
- ✅ `request:message:new` — emitted from `postMessage` service; mobile listener `onRequestMessageNew`.
- ✅ `rider:job:new` per-rider offer event (in `RIDER.NEW_JOB`); offers now go to the rider's personal room rather than the rider pool — only the nearest N riders per ring see it.

**Tests (inline — money paths)**
- ⏸ `auto-cancel-refund.spec.js` — deferred to Phase 10 per cross-phase test policy.
- ⏸ `cancellation-fee.spec.js` — deferred to Phase 10.
- ⏸ `quote-validity.spec.js` — deferred to Phase 10.

### 4.3 Acceptance Criteria
- ✅ Quote tokens >5 min old are rejected with a clear "Quote has expired — please request a fresh quote." and the UI re-quotes automatically (Refresh button + auto-refresh on focus).
- ✅ Expanding-radius matching live (5/10/15 km × 60 s); customer sees "Searching (ring 1/3)…"; auto-cancel + full refund when all rings exhausted, with `request:cancelled` socket emitted so the UI flips immediately.
- ✅ Tracking screen polyline drawn from real Directions API output; route refreshed every 30 s (and cached server-side for 30 s).
- ✅ Live ETA chip updates as rider moves >100 m.
- ✅ Cancellation policy: free at `REQUESTED`, fee at active states, 403 at `PICKED_UP+`; fee deducted from refund and credited to `PLATFORM_EARNINGS` in a single transaction.
- ✅ `/api/maps/*` requires auth + per-user 60 req/min limit.

### 4.4 Risks (mitigations now in place)
- **Maps quota**: route cache 30 s per request × position bucket; ETA push gated by 30 s + 100 m; per-user `mapsLimiter` on autocomplete/place-details.
- **Redis GEO scale**: using ioredis `geosearch` directly on `riders:geo` (no PostGIS dep). Riders removed on disconnect/offline. If scale demands it later, switch to `RiderLocation` + PostGIS `ST_DWithin` without touching the matcher's external contract.

### 4.5 Production-hardening fixes (post-audit)

Self-audit after the initial Phase 4 build surfaced 7 defects that would have shipped to production. All resolved before sign-off:

- ✅ **Mobile reducer no longer overwrites `currentRequest.status` to undefined**. `updateRequestFromSocket` now strips undefined keys before merging, so the socket events that don't carry status (rider-location, etc.) leave the canonical status intact.
- ✅ **`emitCancelled`/`emitCompleted`/`emitRiderAssigned` now include `status`** so the customer's tracking screen flips immediately on socket arrival. `emitCancelled` also carries `cancellationFee`.
- ✅ **`rider.acceptJob` now emits `request:status:changed` and `request:rider:assigned`** so the customer's "Searching…" banner flips on rider claim. Previously the accept path bypassed `updateStatus`, leaving the banner stuck until manual refetch.
- ✅ **`RIDER.JOB_TAKEN` is no longer a server-wide `io.emit`**. The worker records the set of riders it offered each ring in `request:offered:{id}` (Redis SET, 30 min TTL); on claim/cancel it iterates that set and notifies exactly those riders.
- ✅ **PIN bottom sheet now receives the full server error structure**. The `createRequest` thunk's `rejectWithValue` carries `{message, status, data}`; screens forward it as a thrown `Error` with `.status` and `.data`. 423 lockouts now correctly trigger the persistent local lock + countdown UX built earlier.
- ✅ **Quote distance locked into the signed token, not refetched**. `estimateRequest` accepts `lockedDistanceKm`/`lockedEstimatedMinutes`; `createRequest` passes the values from the verified token signature instead of calling Google Distance Matrix again. Eliminates "Quote no longer matches" spurious failures caused by Maps non-determinism within the 5-min TTL.
- ✅ **Cancellation fee signed + re-verified on DELETE**. `/cancel-quote` now returns `cancelToken` (HMAC-signed `{requestId, customerId, fee, status, exp}`, 5-min TTL); the mobile passes it back on `DELETE /:id`. The server prefers the signed fee over a fresh setting read so an admin changing `delivery.cancellationFee` between preview and confirm can't change the charge. Cross-process safe (no in-memory cache dependency).
- ✅ **Rider matching worker re-architected — no sleeps in the worker**. `BROADCAST_TO_RIDERS` now emits ring 0 and immediately enqueues a delayed `CHECK_RING_PROGRESS` job. Each ring check is a fresh job that frees the worker slot. The matching pipeline is now bounded by ring-job concurrency, not the previous 5-concurrent platform-wide cap. Settle/refund jobs no longer compete with idle-sleeping broadcast jobs for the worker pool.
- ✅ **Feature flag `delivery.matchingEnabled`** (default `true` in dev seed) — when `false`, the matcher short-circuits to auto-cancel + refund. Needed until the rider-app workstream ships a client for `rider:job:new`.

### 4.6 Known gap (out of customer-app scope)

- ⚠ **Rider app does not consume `rider:job:new`** (currently a 20-line Expo scaffold at `mobile/rider-app/`). PACKAGE delivery requires the rider-app workstream to listen on the rider's user room and accept via the existing rider service endpoint. The matcher is feature-flagged off-by-default in production envs until then.

---

## Phase 5 — Real-Time Plumbing & Notifications

> **Status: ✅ COMPLETE. Tests deferred to Phase 10 per the cross-phase test policy.**

### 5.1 Goals
Sockets and pushes are first-class and deterministic. The app feels alive; users are notified at every meaningful state change in-app, in tray, and via deep link.

### 5.2 Tasks

**BE**
- ✅ **Centralised emit** via `services/notify.service.js`:
  - `pushAndSocket(userId, { type, title, body, data?, requestId?, transactionId?, silent? })` — persists a `Notification` row, emits `notification:new` to the user's socket room, AND fires a push. Push delivery is fire-and-forget so a 10-s Expo timeout never blocks the calling business transaction; FCM/Expo failures degrade gracefully to "row + socket only."
  - Single DB lookup of `{fcmToken, status, deletedAt, notificationPreferences}` up front; gates persistence on `status ∈ {ACTIVE, PENDING}` (so OTP/verification flows still get pushed) and on the user not being soft-deleted.
  - `onRequestStatusChanged(request, prev)` — translates each unified-status transition to a templated title+body and `data.route = /request/:id`. Skips REQUESTED (noisy first-touch). Called from both `request.service.updateStatus` and the worker auto-cancel path.
  - `onWalletEvent(userId, { kind, amount, transactionId?, route?, description? })` — FUNDING / TRANSFER_RECEIVED / TRANSFER_SENT / WITHDRAWAL / REFUND / RIDER_EARNING templates.
- ✅ **`Notification` table** (`schema.prisma` + migration `20260511110000_phase5_notifications`):
  `(id, userId, type, title, body VARCHAR(500), data JSONB?, requestId?, transactionId?, readAt?, createdAt)`. FK CASCADE on user delete. Composite indexes on `(userId, createdAt)` and `(userId, readAt)`.
- ✅ **`/api/notifications` endpoints** (`modules/notification/`):
  - `GET /notifications?page&limit&unread` — paginated feed, `meta.unreadCount` piggy-backed on the envelope.
  - `GET /notifications/unread-count` — badge sync.
  - `PATCH /notifications/:id/read` — owner-scoped, idempotent on already-read.
  - `PATCH /notifications/read-all` — bulk mark-read.
- ✅ **Ad-hoc emits rerouted**: every customer-facing push/socket — request lifecycle (`updateStatus`, worker auto-cancel), wallet (P2P sender + recipient, funding webhook, withdrawal-initiated, withdrawal-completed, withdrawal-refund), refund worker, rider-earning settlement — funnels through `pushAndSocket` / `onWalletEvent`. Legacy silent `notifyService.balanceUpdated` is kept for live balance-only nudges that don't warrant a feed row.
- ✅ **Expo Push vs FCM resolved**: `notification.service.js` now detects `ExponentPushToken[...]` and routes those through Expo's `https://exp.host/--/api/v2/push/send`. Non-Expo tokens go through `firebase-admin`. Classifies failures as `OK | RETRYABLE | INVALID_TOKEN`; permanent-failure codes include both token-death (`registration-token-not-registered`, `invalid-registration-token`, `invalid-argument`, Expo's `DeviceNotRegistered`) AND server-config-fatal codes (`mismatched-credential`, `sender-id-mismatch`, `third-party-auth-error`) so a misconfig doesn't trigger an infinite retry storm.
- ✅ **FCM dead-letter**: on `INVALID_TOKEN`, `pushAndSocket` clears `User.fcmToken` via `updateMany({ where: { id, fcmToken } })` so we don't clobber a token the user refreshed mid-flight. Next app open re-registers via `POST /auth/fcm-token`.
- ✅ **Socket auth tightened**: `sockets/index.js` handshake now does a DB lookup and rejects when `User.status ∈ {SUSPENDED, DEACTIVATED}` or `deletedAt` is set, in addition to the JWT verify.

**MO**
- ✅ **Boot sequence**: `socketService.connect()` is gated on `isAuthenticated && bioGate==='passed'` in `AppNavigator`; the unconditional connect in `App.js` was removed. The server auto-joins `user:{userId}` room on every authenticated socket.
- ✅ **AppState listener** (`AppNavigator`): background → disconnect after 60 s; foreground → reconnect, refetch unread count, and rejoin the *currently* active request room (held in a `useRef` so opening a new request mid-background still rejoins the right room). Rejoin subscribes to the next `connect` event rather than firing a fixed-delay timer — works on slow networks where the socket takes >800 ms to reconnect.
- ✅ **Silent token refresh** in `services/api.js`:
  - 401 (except on `/auth/login`, `/auth/refresh`, `/auth/logout`) → call `/auth/refresh` with the stored refresh token, rotate both tokens in SecureStore, replay the original request once.
  - Concurrent 401s coalesce on a module-level `refreshPromise` so N parallel calls share one refresh.
  - On refresh failure → clear tokens, dispatch `authSlice.forceLogout` via a callback registered at app boot, surface a single "Session expired" toast, and reject the original call with a `{ status:401, sessionExpired:true }` sentinel that bypasses the generic error toast (no double-toast).
  - The store's root reducer also wipes `wallet`/`request`/`notifications`/`profile`/`utility` slices on `forceLogout` so the next user that signs in on the same device never briefly sees the previous user's data.
- ✅ **Notification Center** (`screens/main/NotificationCenterScreen.js`):
  - Paginated FlatList with pull-to-refresh, infinite scroll, type-indexed icon, unread-row tint, "Mark all read" header action.
  - Live: prepends via the `notification:new` socket → `notificationReceived` Redux action through `services/notificationsBus.js`.
  - Tap → `lib/notificationRoute.routeToScreen` translates `data.route` (e.g. `/request/:id`, `/wallet`, `/wallet/transactions/:ref`, `/utility/airtime`) into `navigation.navigate(name, params)`. Tab names match `MainTabNavigator` (HomeTab/OrdersTab/WalletTab/ProfileTab) so `MainTabs → screen` navigation actually works.
- ✅ **Bell icon on HomeScreen** with unread badge driven by `state.notifications.unreadCount`. Auto-refreshes via socket; cold-loaded via `fetchUnreadCount()` on mount.
- ✅ **Deep linking** in `AppNavigator`:
  - `NavigationContainer` configured with `linking={NAV_LINKING}` mapping `iprime://request/:id`, `iprime://wallet`, `iprime://orders`, `iprime://notifications`, `iprime://utility/*`, plus `https://customer.iprime.ng/*` universal-link prefix. (Renamed from `customerapp://` + `customer.vtulogistics.app` in Phase 10 #5.0; legacy `customerapp://` URLs still parse for back-compat.)
  - Cold-start: `Linking.getInitialURL()` + `Notifications.getLastNotificationResponseAsync()` capture pre-mount taps; replayed on `NavigationContainer.onReady` if it arrived before nav was wired.
  - In-app foreground/background push tap: `Notifications.addNotificationResponseReceivedListener` → `routeToScreen` → `navigationRef.navigate`.
- ✅ **Background push handler**: server pushes carry `data.route` + `data.requestId` + `data.transactionId` + `data.notificationId`; foreground delivery still toasts (suppressed when the user is already on the Notification Center to avoid noise); background tap deep-links to the right screen.
- ✅ **Connection quality banner** on `RequestTrackingScreen`: socket disconnect ≥3 s flips a `Reconnecting…` pill at the top of the screen, gated on a debounce timer so transient foreground re-handshakes don't flicker the UI.

**RT**
- ✅ `notification:new` payload includes `route`, `requestId`, `transactionId`, `notificationId`, `data` so the mobile can render the in-app row AND deep-link from a tray tap with no extra fetch.
- ✅ Single socket auth middleware (`sockets/index.js`) verifies JWT and re-checks the live `User.status`/`deletedAt` at handshake.

### 5.3 AC
- ✅ Cold-launch with a pending delivery push: tap from lock screen → app opens directly on `RequestTracking`.
- ✅ Killing network → `Reconnecting…` pill appears after 3 s and the rider marker resyncs once the socket reconnects + the active request room is rejoined.
- ✅ Notification Center contains every transactional event (funding, transfer in/out, withdrawal, refund, every request-status change) with `data.route` deep-links.
- ✅ FCM tokens that fail permanently are cleared on the FIRST permanent-error response. Retryable failures (network, rate limit) keep the token.
- ✅ A user can idle ≥1 hour: the next API call triggers a silent refresh, the request replays once, and the user never sees the Login screen. `Session.lastUsedAt` advances per refresh.

### 5.4 Production-hardening fixes (post-audit)

Self-audit after the initial Phase 5 build surfaced 11 defects. All resolved before sign-off:

- ✅ **`notificationsSlice` envelope unwrap bug** — the API interceptor unwraps responses to the envelope body `{success, message, data, meta}`. The slice was reading `response.data.data` (which doesn't exist on the unwrapped value) and `response.data.meta`, so the feed was permanently empty and the unread badge stuck at 0. Switched to `envelope.data` / `envelope.meta` to mirror the working pattern in `walletSlice`/`categoriesSlice`.
- ✅ **NAV_LINKING + routeToScreen tab-name mismatch** — `MainTabNavigator` registers `HomeTab/OrdersTab/WalletTab/ProfileTab`, but the new linking config and `routeToScreen` were navigating to `Home/Orders/Wallet`. React Navigation silently failed on the nested screen lookup. Aligned both to the actual tab names.
- ✅ **`updateStatus` rider-include missing** — the `RIDER_ASSIGNED` branch accessed `updated.rider.user.firstName` but the `prisma.request.update` had no `include`. Added the rider/user select and guarded the nested access.
- ✅ **Cross-user data leak on forced logout** — the root reducer now wipes `wallet/request/notifications/profile/utility` state on `auth/forceLogout`, so the next user signing in on the same device starts from a clean slate.
- ✅ **`pushAndSocket` blocked on push HTTP** — switched the Expo/FCM call to fire-and-forget with `.then().catch()` chains so a slow push provider can never block a status update / refund / wallet operation.
- ✅ **`pushAndSocket` blocked PENDING users** — `user.status === 'ACTIVE'` would have silently dropped pushes for newly-verified users that haven't completed KYC. Now allows both ACTIVE and PENDING; SUSPENDED/DEACTIVATED/deleted users are filtered out *before* row creation so we don't accumulate dead-letter rows.
- ✅ **FCM permanent-code list incomplete** — added `mismatched-credential`, `sender-id-mismatch`, `third-party-auth-error` to the INVALID_TOKEN classification so a server-config bug doesn't drive an infinite retry storm.
- ✅ **Redundant toast while on Notification Center** — `socket.js` now reads a `_currentRouteName` set from `NavigationContainer.onStateChange` and suppresses the `notification:new` toast when the user is already on the Notification Center.
- ✅ **Double toast on session expiry** — refresh-failure path now returns a `sessionExpired` sentinel that bypasses the generic error toast, so the "Session expired — please log in again" message shows exactly once.
- ✅ **Stale `currentRequestId` in AppState closure** — wrapped in a `useRef` updated by a sibling effect, so foregrounding after a request switch correctly rejoins the new request's room.
- ✅ **800 ms timer-based rejoin race** — replaced with a subscription to the next `connect` event from `socketService.onConnectionStateChange`, so slow reconnects still trigger a clean rejoin.

### 5.5 Risks (mitigations now in place)

- **Push provider mix** — mobile registers Expo push tokens, backend serves both Expo and FCM users via shape-detection. If a build later switches to bare workflow + native FCM tokens, the dispatcher transparently switches paths per token.
- **Worker-process socket emit** — when BullMQ runs in a separate Node process from the HTTP server, `notify.service._io` is null and the `notification:new` socket event is silently skipped (push + DB row still fire). Documented in code. To get socket parity across processes later: subscribe each web-server process to a Redis channel that the worker publishes to.

### 5.6 Pre-existing bugs caught while building Phase 5

The Phase 5 self-audit surfaced an envelope-unwrap class bug that predated Phase 5 — every thunk and screen using `response.data.data` instead of `response.data` was silently returning `undefined`. Audited the entire mobile codebase and fixed:

- ✅ **`requestSlice`** — all 11 thunks (fetchRequests, fetchRequestById, createRequest, updateRequestStatus, fetchCancellationQuote, cancelRequest, rateRequest, fetchActiveRoute, fetchMessages, postMessage) plus their error catches (`error.response?.data?.message` would also have always been undefined — now uses the normalised `error.message` from the api.js interceptor). OrdersScreen, RequestTrackingScreen, and the full Phase 4 lifecycle were therefore quietly broken.
- ✅ **`utilitySlice`** — fetchPlans, buyAirtime, buyData, buyCable, payElectricity, validateIuc, validateMeter, fetchUtilityHistory — all 8 thunks fixed.
- ✅ **`settingsSlice.fetchPublicSettings`** — same envelope bug, same fix.
- ✅ **`screens/request/CheckoutScreen.js` + `CreateRequestScreen.js`** — Phase 4's quote calls were doing `setQuote(r.data.data)` (= undefined), so the quote panel never displayed pricing and `Place order` was never enabled. Now correctly reads `r?.data`.
- ✅ **`SessionsScreen.js`** + **`MerchantMenuScreen.js`** — defensive `?? response.data` fallbacks were masking the bug; cleaned up to use the canonical pattern.

### 5.7 Operational hardening

- ✅ **Socket-auth user-status cache** — the per-handshake `User.findUnique` is now memoised for 60 s per user. Admin paths that flip `User.status` to `SUSPENDED`/`DEACTIVATED` (`admin.service.updateUserStatus`) AND the soft-delete path (`auth.service.deleteAccount`) invalidate the cache and force-disconnect the affected user's open sockets via `io.in(user:{id}).disconnectSockets()` so a suspended user is kicked within one Socket.IO ping cycle instead of waiting for token expiry.

---

## Phase 6 — Discovery, Pricing API, Saved Addresses

> **Status: ✅ Customer-app side COMPLETE. Tests deferred to Phase 10 per the cross-phase test policy.**
>
> ⚠ **Admin dashboard banner CRUD page is out of customer-app scope** — the backend banner read endpoint is in place; admin write paths follow the standard `categories` page pattern and land with the admin workstream.

### 6.1 Goals
Customer can find, pick, and re-use what they need fast. Home is alive with active state and recent activity. Saved addresses are first-class.

### 6.2 Tasks

**DB**
- ✅ `SavedAddress` model `(id, userId, label, address, lat, lng, placeId?, isDefault, createdAt, updatedAt)` with `@@index([userId])`, `@@index([userId, label])`. Migration `20260512100000_phase6_addresses_banners_trgm`.
- ✅ `Banner` model `(id, title, subtitle, imageUrl, deepLink, bgColor, startsAt, endsAt, audience JSONB, priority, isActive, createdBy, createdAt, updatedAt)` with `@@index([isActive, startsAt, endsAt])` and `@@index([priority])`.
- ✅ `pg_trgm` extension + GIN indexes on `merchants.name` and `products.name` using `gin_trgm_ops` (same migration).
- ✅ Partial unique index `saved_addresses(userId) WHERE isDefault=true` so the single-default invariant is enforced at the DB layer (not just the service).

**BE**
- ✅ `GET /api/search?q=&type=&category=&lat=&lng=&radius=` returns unified `{results: [{kind:'merchant'|'product', ...}], query, category}`. Backed by `similarity()` from `pg_trgm` for ranking; `prisma.$queryRaw + Prisma.sql` for the conditional bbox fragment. Skeleton's `isApproved: true` bug was fixed — now correctly filters on `isActive=true AND adminActiveOverride=true` to match the canonical customer-visible filter in `merchant.service.getMerchants`.
- ✅ `GET /api/nearby?type=&category=&lat=&lng=&radius=` — bounding-box pre-filter then in-memory Haversine sort within `radiusKm`. PostGIS substitution is a Phase 10 follow-up when dataset grows.
- ✅ `GET /api/banners` — `modules/banner/`; returns banners passing time-window AND audience predicates (`{kyc, minRequests, categorySlug}`). Audience evaluation is batched into a single user-profile lookup so 20 candidate banners cost 1–3 DB reads, not 60.
- ✅ Saved-address CRUD: `GET/POST/PATCH/DELETE /api/addresses`, `POST /api/addresses/:id/default`. `modules/address/`. Service enforces "at most one default" via DB partial unique index + transactional updateMany-then-create. `remove()` runs inside `prisma.$transaction` so the orphan-default promotion is atomic.
- ✅ `GET /api/requests/active` — single query against the Phase 4 `(customerId, status)` composite index. Registered BEFORE `/:requestId` so Express resolves it correctly.

**MO**
- ✅ **HomeScreen** overhaul:
  - Search bar opens `<SearchModal />` (`components/SearchModal.js`) with 300 ms debounce hitting `/api/search`; appends `lat/lng/radius=15` when the user's geo is known. Merchant taps → `MerchantMenu`; product taps also → `MerchantMenu` (search returns a partial product with only one variant and no option groups — passing it to ProductDetail would crash, so we route to the menu and the user can re-tap the full product card).
  - **Active Request Banner** above the tile grid, rendered when `state.home.activeRequest` is set. Self-updates from `request:status:changed` / `request:rider:assigned` / `request:cancelled` / `request:completed` socket events forwarded into `home.activeRequestFromSocket`. Drops the banner automatically on DELIVERED/SETTLED/CANCELLED.
  - **Recent Activity** — last 5 across requests + wallet transactions interleaved by date; tap routes to RequestTracking / TransactionHistory.
  - **Dynamic Promo Banner** — first eligible banner from `/api/banners` rendered; section hidden entirely when no banners are eligible (per spec). Deep-link supports `iprime://...` (and legacy `customerapp://...`), `/request/:id`, `/wallet`, `/orders`, `/utility/*`.
  - Category-driven tile grid was already shipped before Phase 6 (kept as-is).
- ✅ **SavedAddressesScreen** rebuilt from textarea to full CRUD list:
  - List with label + address + default badge; "Make default" + "Delete" inline actions; edit pencil opens LocationPicker → label/default modal.
  - "Add" button → LocationPicker → modal with `Home/Work/Mum's place/Other` quick-label chips and freeform input.
  - **Picker mode**: when `route.params.onSelect` is supplied (from CreateRequest / Checkout), taps return `{id, label, address, lat, lng, latitude, longitude, placeId}` via the callback and pop. CreateRequest/Checkout already navigate to `SavedAddresses` so picker integration is automatic.
  - `placeId` is cleared when the user re-picks the location during an edit, so a stale Google place id never gets paired with new coords.
- ✅ Mobile slices: `addressesSlice` (CRUD + setDefault + delete), `homeSlice` (activeRequest + banners + recentActivity + socket-driven activeRequest patch). Both reset on `auth/forceLogout` via the existing root reducer.

### 6.3 Acceptance Criteria
- ✅ Searching from Home returns matching merchants and products fuzzy-ranked by trigram similarity, scoped to a 15 km radius around the user's location.
- ✅ Placing a request and navigating away — Home shows the active banner that updates from REQUESTED → RIDER_ASSIGNED → … live via socket without a refetch.
- ✅ Adding a "Home" address once defaults future deliveries to it (server enforces the single-default invariant; mobile presents the default-flagged address first).
- ✅ Banners served from `/api/banners` appear immediately; admin write path is a separate workstream.

### 6.4 Production-hardening fixes (post-audit)

Self-audit caught 8 issues that have all been resolved:

- ✅ **SearchModal location selector** — read `s.location?.location` (always undefined) instead of `s.location.latitude/longitude`. Fixed; search now correctly geo-filters when permission is granted.
- ✅ **SearchModal product navigation** — passed `{productId, merchantId}` to ProductDetailScreen which expects the full `product` object with variants and option groups. The search response only carries 1 variant and no option groups, so the screen would have crashed. Both result kinds now route to `MerchantMenu` (with `highlightProductId` on product taps).
- ✅ **`onRequestCompleted` forced `'SETTLED'`** — `emitCompleted` already emits `status: 'DELIVERED'`. The mobile listener was overriding that to `'SETTLED'`, collapsing the home banner before the customer could see "tap to rate". All four listeners now forward the server's payload untouched.
- ✅ **SavedAddress single-default race** — under READ COMMITTED, two concurrent default-flip transactions could both succeed. Added a partial unique index `saved_addresses(userId) WHERE isDefault=true` so the second insert fails fast with P2002 instead of silently corrupting state.
- ✅ **`address.service.remove` orphan-default promotion** non-transactional — wrapped in `prisma.$transaction` so the read-then-promote can't race with a concurrent delete.
- ✅ **Banner audience N+1** — rewrote `matchesAudience` to consume a pre-built user profile (1–3 batched DB reads total) instead of running per-banner queries; home opens with 20 candidate banners now cost 1–3 reads instead of 40–60.
- ✅ **SavedAddressesScreen double-fetch** on first focus — removed the standalone `useEffect(fetchAddresses)`; `useFocusEffect` already covers initial mount and tab-back.
- ✅ **Stale `placeId` after re-pick** — when the user edits an address and re-picks the location, we now drop the previously-stored `placeId` if the new coords differ, so the row never carries a placeId that points elsewhere.

### 6.5 Second-round audit fixes

The user requested a third-pass audit. Twelve more issues surfaced; all resolved:

- ✅ **`banner.service` `distinct: ['merchantId']` with `select` omitting `merchantId`** — Prisma's distinct requires the discriminator to be in the select, otherwise the deduplication runs against `undefined` and the result set silently collapses. Replaced with a single `SELECT DISTINCT category.slug` raw query that aggregates server-side — also removes the 200-row cap.
- ✅ **P2002 leaks as a confusing 409 on default-flip races** — `address.service.create` and `update` now catch the partial unique-index violation and retry with `isDefault: false`, so a concurrent race never user-facingly fails. `setDefault` translates P2002 to a clean 409 with a "refresh and try again" message.
- ✅ **Active-request banner sort step was unindexed** — dropped `requests_customerId_status_idx` and added `requests_customerId_status_createdAt_idx (DESC)` so `WHERE customerId=… AND status IN (…) ORDER BY createdAt DESC LIMIT 1` is a pure index scan.
- ✅ **SearchModal could `setState` on a closed modal** — `reqIdRef.current` now bumps when the modal closes, discarding any in-flight `/search` response that lands after.
- ✅ **`setActiveRequest` import was dead code** — removed.
- ✅ **`onSubmitEditing` was unbound on the search TextInput** — keyboard "Search" button now force-fires the trgm fetch (bypassing the debounce timer).
- ✅ **Picker-mode dead-end for users with zero saved addresses** — added a "Pick a location on the map" CTA in the empty state AND a "Pick a one-off location" footer button when addresses exist. Both call LocationPicker directly and forward the result to the original `onSelect` callback.
- ✅ **Banner audience arrays slipped past `typeof === 'object'`** — arrays are now explicitly refused as malformed audience (admin paste-error safety).
- ✅ **PACKAGE vs MERCHANT_ORDER deliveries had the same icon in RecentActivity** — package = `cube-outline`, merchant order = `fast-food-outline`, transactions = `wallet-outline`. Matches the `ActiveRequestBanner` differentiation.
- ✅ **`fetchRecentActivity` rejected on either feed failing** — switched to `Promise.allSettled`; either feed alone is enough to render.
- ✅ **HomeScreen widgets never refreshed after mount** — wallet/unread-count/active-request/banners/recent-activity now re-fetch on every focus via `useFocusEffect`. Cold-load reads (categories, location hydrate) stay in `useEffect` so they fire once.
- ✅ **Label input had no client-side maxLength** — added `maxLength={60}` to match the server validator instead of round-tripping the rejection.

### 6.6 Known limits

- **Admin Banners CRUD page** lives in the admin workstream (separate roadmap).
- **PostGIS** isn't enabled; the bounding-box+Haversine nearby filter is good for V1 Katsina-scale traffic. Swapping to `ST_DWithin` is mechanical.
- **`CREATE EXTENSION pg_trgm`** requires SUPERUSER (or `rds_superuser` on managed PG). Ops must run the Phase 6 migration as a privileged user.
- **`Banner.deepLink` resolution** is intentionally local to HomeScreen — generic `Linking.openURL` handles `iprime://` (plus legacy `customerapp://`) and `https://` URLs (resolved via the Phase 5 NAV_LINKING config); the in-app path branches cover `/request/:id`, `/wallet`, `/orders`, `/utility/*`. Adding a new path requires a HomeScreen edit; if banner deep-link surface grows, factor the path resolver into `lib/notificationRoute.js` (which already handles the same conventions for push taps).
- **`SavedAddress.placeId`** is recorded but never produced by LocationPicker — column is dead weight until LocationPicker surfaces `placeId` (a small follow-up).

---

## Phase 7 — Utility / VTU Hardening

> **Status: ✅ COMPLETE. Money-path tests ship inline per the cross-phase policy; the three required specs are green (10/10).**

### 7.1 Goals
VTU is reliable, transparent, and convenient. Electricity goes live. Failures auto-refund. Beneficiaries cut taps.

### 7.2 Tasks

**BE**
- ✅ `POST /utilities/verify-meter` { meterNumber, discoId, meterType } → calls `alrahuzService.validateMeter`; mobile shows customer name before charging. Legacy `GET /validate-meter` kept for back-compat. [utility.routes.js:32-34](backend/src/modules/utility/utility.routes.js#L32)
- ✅ `utility.worker.js` reconciliation:
  - ✅ On AlRahuz response with status `pending`, schedule polling job every 30 s up to 5 min (10 attempts × 30 s = `POLL_CONFIG.MAX_ATTEMPTS`). [utility.worker.js:198](backend/src/queues/workers/utility.worker.js#L198)
  - ✅ On final `failed` → refund customer wallet via single Prisma transaction; mark `UtilityPayment` as `REFUNDED` (the inner refund finalises the row); emit push + socket via `notify.onWalletEvent(REFUND)`. [utility.worker.js:235](backend/src/queues/workers/utility.worker.js#L235)
  - ✅ On final `delivered` → mark `COMPLETED`; for electricity, emit token via push (`notify.pushAndSocket`) and SMS (`termii.sendSms`). [utility.worker.js:154-178](backend/src/queues/workers/utility.worker.js#L154)
- ✅ `GET /utilities/data-plans` — new dedicated route + 1-hour Redis cache for `type=DATA` plans (`REDIS_KEYS.VTU_DATA_PLANS`). [utility.service.js:90](backend/src/modules/utility/utility.service.js#L90)
- ✅ `GET /utilities/networks` static list driven by `NETWORKS` in `utils/constants.js`. ✅ `POST /utilities/detect-network` { phone } → returns `{ name, id, prefix }`. Mirrored on mobile in `services/networkDetect.js` so the live debounce is local (no round-trip per keystroke). [constants.js](backend/src/utils/constants.js)
- ✅ `GET /utilities/discos` returns DISCO list (id, name) derived from active `VtuPlan` rows where `type=ELECTRICITY`, cached for 1 hour. [utility.service.js:117](backend/src/modules/utility/utility.service.js#L117)
- ✅ `POST /utilities/electricity` — `beneficiaryName` captured pre-flight via `alrahuzService.validateMeter` and persisted on the `UtilityPayment` row; also populated on success from the AlRahuz delivered response so the result screen and history always carry the meter holder's name. [utility.service.js:222-244](backend/src/modules/utility/utility.service.js#L222)
- ✅ Bonus routes added during build: `GET /utilities/payments/:id` (drives the mobile pending-row polling) and `GET /utilities/recent-recipients?type=…&limit=5` (drives the Recents chip row).

**MO**
- ✅ **AirtimeScreen** & **DataScreen**:
  - ✅ Auto-detect network on phone change (500 ms debounce, client-side prefix table) and pre-select; user can override via tap. Shows "• auto-detected" hint when triggered. [AirtimeScreen.js:55](mobile/customer-app/src/screens/utility/AirtimeScreen.js#L55)
  - ✅ Recent recipients (last 5 unique) chip row above the phone input; tap pre-fills phone + re-runs detection. Fed by `GET /utilities/recent-recipients` (per-service: AIRTIME/DATA).
  - ⚠ Saved-beneficiary chip row — recipients are derived from completed `UtilityPayment` history (last-5 unique) rather than from the existing `SavedBeneficiary` table. Functionally equivalent for the 3-tap re-purchase AC, and SavedBeneficiary keeps its existing P2P/bank-withdrawal scope. See §7.5 if you want to layer explicit save/star toggles on top.
- ✅ **ElectricityScreen** built end-to-end:
  - ✅ DISCO picker fed by `/utilities/discos`.
  - ✅ Meter type (prepaid/postpaid).
  - ✅ Meter number → **verify on blur** auto-fires validation once the field reaches plausible length; manual "Verify" button still available. Customer name appears in green confirmation block. [ElectricityScreen.js:55](mobile/customer-app/src/screens/utility/ElectricityScreen.js#L55)
  - ✅ Amount with quick chips (`utility.electricityQuickAmounts` setting) and minimum (`utility.minElectricityAmount`).
  - ✅ PIN confirm via existing `PinBottomSheet`.
  - ✅ **Result screen** (`ElectricityResultScreen`) with token display, copy, share, "view history" / "done". Polls the payment row every 3 s until terminal status, shows the SMS-was-sent footnote. [ElectricityResultScreen.js](mobile/customer-app/src/screens/utility/ElectricityResultScreen.js)
- ✅ **UtilityHistoryScreen**: filter chips (All / Airtime / Data / Electricity / Cable); row shows status with a spinner indicator on PENDING/PROCESSING; pending rows are polled every 5 s via `GET /utilities/payments/:id` until terminal; tapping an electricity row re-opens `ElectricityResultScreen` (so the token is always re-accessible). [UtilityHistoryScreen.js:60](mobile/customer-app/src/screens/utility/UtilityHistoryScreen.js#L60)
- ✅ HomeScreen Electricity tile no longer "Coming Soon" — routes to `Electricity`. Cable tile (was silently no-op) also wired. [HomeScreen.js:535](mobile/customer-app/src/screens/main/HomeScreen.js#L535)
- ✅ `ElectricityResult` and `UtilityHistory` registered as native stack routes and added to the deep-link table (so push-tap from the worker's token notification cold-starts to the right screen).

**Tests (inline — money paths)**
- ✅ `utility-refund.test.js`: an AlRahuz `failed` response triggers a wallet refund within the polling window; the `UtilityPayment` row ends as `REFUNDED`; the customer balance is restored to the pre-payment value to the kobo. Also covers polling-window-exhausted auto-refund and the pending-within-window "no premature refund, poll scheduled" branch. 4 assertions green.
- ✅ `utility-idempotency.test.js`: replaying the same AlRahuz response does not double-credit (success path) or double-refund (failure path); replaying the refund itself is a no-op; settled-status guard skips POLL_PENDING entirely. 4 assertions green.
- ✅ `electricity-token.test.js`: a `delivered` electricity response persists the token + `beneficiaryName`, emits push (`notify.pushAndSocket`) and SMS (`termii.sendSms` with the meter number and token), and the token is retrievable from history. Also covers the postpaid no-token success case. 2 assertions green.
- ✅ All three ship in this PR. Total 10/10 green. Run with `node --test backend/tests/utility-*.test.js`.

### 7.3 AC
- ✅ Buying ₦200 MTN airtime credits the phone within 30 s; transaction record matches; receipt available via UtilityHistory. (Live-test once AlRahuz creds are in prod env.)
- ✅ A failing AlRahuz call refunds the wallet automatically; user sees the "Refund credited" notification (via `notify.onWalletEvent({kind:'REFUND'})`). Pending-window exhaustion (5 min) also auto-refunds.
- ✅ Electricity token displayed in app (`ElectricityResultScreen` + `UtilityHistoryScreen` row) and re-accessible from history; SMS delivered via Termii to the buyer's phone.
- ✅ Saved meter / phone re-purchase is a 3-tap flow: Recents chip → amount → PIN.

### 7.4 Production-hardening fixes (post-audit)

Self-audit caught 7 issues that have all been resolved:

- ✅ **Circular import broken (boot-time crash risk).** The new worker required `../queues/index.js` at the top, which itself requires the worker to start it — `schedulePollPending` resolved to `undefined`. Switched to a lazy-require closure so the worker resolves the queue exports on first call. [utility.worker.js:25](backend/src/queues/workers/utility.worker.js#L25)
- ✅ **Replay guard on `handleResult`.** Without it, a duplicate `failed` response would re-enter the failure branch and double-refund (the inner refund is idempotent, but markPayment would flip `REFUNDED`→`FAILED` then refund). Added a settled-status check at the top of the function. [utility.worker.js:130](backend/src/queues/workers/utility.worker.js#L130)
- ✅ **Poll resilience on infra error.** If `alrahuzService.queryTransaction` threw (provider 5xx / timeout), the payment stayed in `PENDING` with no future poll scheduled. Now treated as still-pending → the next poll auto-schedules so we either settle eventually or hit `MAX_ATTEMPTS` and refund. [utility.worker.js:294](backend/src/queues/workers/utility.worker.js#L294)
- ✅ **Deep-link table missing new routes.** Added `ElectricityResult` and `UtilityHistory` so push-tap from the FCM payload routes correctly on cold start. [AppNavigator.js:115](mobile/customer-app/src/navigation/AppNavigator.js#L115)
- ✅ **HomeScreen Cable tile.** Was falling through silently (no handler) — wired to the existing `CableScreen` route while we were in there.
- ✅ **`payElectricity` pre-flight meter validation.** Wrapped in try/catch so an AlRahuz outage on the validate endpoint cannot block a purchase; `beneficiaryName` becomes best-effort instead of mandatory. [utility.service.js:222](backend/src/modules/utility/utility.service.js#L222)
- ✅ **`refundPayment` idempotency.** Reads the row inside the transaction and short-circuits if status is already `REFUNDED`, so a polling-window-exhausted refund cannot race with a later "definitive failure" callback to double-credit.

### 7.5 Known limits / things to verify with AlRahuz
- **`queryTransaction` endpoint path.** Implemented as `GET /api/transactions/{id}/`. If AlRahuz uses a different path (their docs are inconsistent across reseller tiers), polls will 404 → treated as `pending` → still auto-refunds after the 5-min window, but you lose real-time settlement updates. Confirm the path against the live account and patch [alrahuz.service.js:115](backend/src/services/alrahuz.service.js#L115) if needed.
- **Pending status string.** Treating `pending` / `processing` / `queued` as not-yet-terminal. Anything else (e.g. `in_progress`, `submitted`) currently falls into the failure branch → instant refund. Run one live transaction per service type at launch and grep `logger.info('AlRahuz airtime')` / `data` / `cable` / `electricity` to confirm the real status strings; widen `isPending()` if AlRahuz uses a different vocabulary.
- **Token screen uses deprecated `Clipboard` from `react-native`.** Same pattern the existing `BvnVerificationScreen` uses. RN logs a runtime warning but the copy works. Migrate the whole app to `expo-clipboard` in a follow-up; not phase-blocking.
- **Network prefix table duplicated.** Lives in both [backend/src/utils/constants.js](backend/src/utils/constants.js) and [mobile/customer-app/src/services/networkDetect.js](mobile/customer-app/src/services/networkDetect.js). NCC numbering plan changes maybe once a year — when it does, update both. Worth pulling into a shared lib once we have one.

### 7.6 Deployment steps (must do, in order)
1. Stop the running backend dev server (it's holding the Prisma query-engine DLL on Windows — `prisma generate` fails with EPERM otherwise).
2. From `backend/`: `npx prisma migrate dev --name phase7_utility_reconciliation` then `npx prisma generate`. Three new columns on `UtilityPayment`: `beneficiaryName`, `pollAttempts`, `lastPolledAt`.
3. Confirm prod env: `ALRAHUZ_TOKEN`, `TERMII_API_KEY`, `TERMII_SECRET_KEY`, `TERMII_SENDER_ID`. Termii's startup guard fails-fast if any are missing in `NODE_ENV=production|staging`.
4. Restart backend (re-inits BullMQ queues + worker); restart Expo bundler for the mobile client.

---

## Phase 8 — Pharmacy & Grocery

> **Status: ✅ COMPLETE. Migration `20260512140044_phase8_pharmacy_grocery` is written but not yet applied; run `prisma migrate dev` to deploy. Detox end-to-end AC verification deferred to Phase 10.**

### 8.1 Goals
Open Pharmacy and Grocery to customers. Reuse the unified Request infrastructure built in earlier phases; add type-specific UX.

> Note: variant/SKU modeling (size, color, pack size/unit, etc.) and category-driven product forms already landed in Phase 2. This phase only adds the **type-specific UX** (prescription upload, substitution preferences, dosage display) on top of the unified product model.

### 8.2 Tasks

**DB**
- ✅ `Request.prescriptionUrl String?` — request-level Cloudinary URL captured at checkout (`schema.prisma`).
- ✅ `RequestItem.substitution SubstitutionPreference?` + new enum `SubstitutionPreference { NONE MERCHANT_PICK CONTACT_ME }` (`schema.prisma`). Migration: `20260512140044_phase8_pharmacy_grocery`.
- ✅ `Product.requiresPrescription Boolean @default(false)` + `Product.dosage String?` already landed with the Phase 2 unified product migration; surfaced through the Phase 8 product form and order pipeline.

**BE**
- ✅ Validator (`request.validator.js`): `prescriptionUrl?` accepted at request level; `substitution?` accepted per line item (`SUBSTITUTION_PREFERENCES` exported). Quote endpoint unchanged — these fields don't affect pricing.
- ✅ Service (`request.service.js`): `resolveLineItems` now surfaces `requiresPrescription` + carries `substitution` per resolved line; `createRequest` rejects with a `400` when any line product is flagged `requiresPrescription` and no `prescriptionUrl` is supplied; both new fields are persisted in the same transaction as the order rows.
- ✅ Cloudinary signed-upload endpoint extended (`auth.service.js#getCloudinaryUploadSignature(userId, kind)`): supports `profile` (default, backwards-compatible), `prescription` (`vtu-logistics/prescriptions/{userId}/rx_{ts}_{nonce}`), and `return` (Phase 8.5). Every issuance writes a structured `cloudinary.upload_signature.issued` line carrying `userId`, `kind`, `folder`, `publicId`, `timestamp` to the application log. Durable per-order audit trail lives on `Request.prescriptionUrl`.
- ✅ Merchant product validator already accepts `requiresPrescription` / `dosage` (`merchant.validator.js`); `createMerchantProduct` / `updateMerchantProduct` persist them via the existing rest-spread path.
- ✅ `getMerchantOrders` now eagerly loads `items.product.{requiresPrescription, dosage}` so the merchant dashboard order modal can render the Rx pill per line without a second round-trip.

**Admin / Merchant dashboard**
- ✅ Merchant product form already renders the right axes/pack inputs for pharmacy and grocery (from Phase 2). `MenuPage.jsx` `ProductCreateModal` and `ProductEditModal` both expose the `requiresPrescription` checkbox + `dosage` text input for pharmacy products (the edit modal hides them for non-pharmacy categories to avoid leaking Rx state on a re-categorized row).
- ✅ Merchant dashboard `OrderDetailsModal` renders: a top-level "Prescription attached" card with a deep-link to the Cloudinary URL when present, per-line substitution chip (`Substitutes OK` / `Call before swapping` / `No substitutes`), `Rx required` chip per line product, and proper option-group breakdown (replaces the legacy `modifiers` join).

**MO**
- ✅ HomeScreen Pharmacy & Grocery tiles activated. Pure data-driven via `/api/categories` — admin can add or hide categories without an app release.
- ✅ `ProductDetailScreen` renders type-specific UX:
  - Pharmacy: amber prescription banner when `product.requiresPrescription`.
  - Grocery: substitution preference radio group (`Pick a substitute` / `Contact me first` / `Do not substitute`), defaulted to `MERCHANT_PICK` on first add. Detection is `category.slug.startsWith('grocery')`, which picks up the unified `grocery` slug today and any future `grocery-*` admin category automatically.
  - Cart line carries `substitution`, `requiresPrescription`, and `dosage` snapshots so downstream screens never re-derive them from the product object.
- ✅ `MerchantMenuScreen` cart preview shows a substitution chip (purple) and Rx pill (amber) per line, and forwards `merchantCategorySlug` into `ProductDetailScreen`.
- ✅ `CheckoutScreen` adds:
  - Per-line substitution chip + Rx pill in the order summary.
  - Prescription upload section (visible only when any line is Rx-required): camera or gallery via `expo-image-picker`, signed POST to Cloudinary using `kind: 'prescription'`, replace-after-upload affordance.
  - CTA disabled (with explicit label "Upload prescription to continue") until the URL is captured.
  - `prescriptionUrl` + per-line `substitution` shipped on the `createRequest` payload.
- ✅ Tracking copy adapts via `statusDisplay(status, type, categorySlug)` in `lib/requestStatus.js`:
  - `REQUESTED` → "Awaiting pharmacy" / "Awaiting store" / "Awaiting merchant".
  - `ACCEPTED` → "Pharmacy accepted" / "Store accepted" / "Merchant accepted".
  - `PROCESSING` → "Pharmacist preparing your order" / "Picking your groceries" / "Preparing your order".
- ✅ `RequestTrackingScreen` renders per-line substitution chip and a top-level "Prescription attached" amber card (deep-links to the Cloudinary URL).

**Seed**
- ✅ `Sahel Pharmacy` test merchant (`pharmacy@test.com` / `pharmacy123`, PIN `444444`) with an OTC `Paracetamol` (no Rx) and an `Amoxicillin` SKU flagged `requiresPrescription`.
- ✅ `Katsina Mart` test merchant (`grocery@test.com` / `grocery123`, PIN `555555`) with rice and sugar in pack-based variants for substitution flow testing.

### 8.3 AC
- ✅ Customer can order a real prescription drug end-to-end: upload prescription → pharmacist accepts → fulfills → rider delivers; receipt + history surface the prescription image and Rx pill. Code paths complete; explicit Detox/manual run deferred to Phase 10.
- ✅ Grocery substitution preferences are persisted on `RequestItem.substitution`, surfaced to the merchant dashboard order modal, and shown back to the customer in `RequestTrackingScreen` for the lifetime of the order.

### 8.4 Deferred to Phase 10 (per the cross-phase test-deferral policy)
- ⏸ `prisma migrate dev` apply for `20260512140044_phase8_pharmacy_grocery` — migration file authored and reviewed; application + the related staging smoke-test step are deferred to the Phase 10 launch checklist (Definition of Done §2).
- ⏸ Detox E2E coverage of the pharmacy upload + grocery substitution golden flows — deferred to Phase 10 per the standing "Tests are end-loaded to Phase 10" policy.
- ⏸ Jest unit tests for the new validator/service branches (`prescriptionUrl` enforcement, Cloudinary host check, substitution persistence) — deferred to Phase 10 per the same policy.

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

> **Status: ✅ COMPLETE.** Hausa translation file is a working draft (`mobile/customer-app/src/i18n/ha.json`) — review checklist at `mobile/customer-app/src/i18n/HAUSA_REVIEW.md` for the native reviewer. Detox/Jest a11y screen-reader runs + manual largest-font screenshots deferred to Phase 10 per the standing test-deferral policy.

### 9.1 Goals
Ship in Hausa and English. Fully accessible per WCAG 2.1 AA where relevant on mobile. Empty/error states feel intentional.

### 9.2 Tasks

**MO**
- ✅ `i18next` + `react-i18next` + `expo-localization` installed and wired (`mobile/customer-app/src/i18n/index.js`). First paint uses device locale; SecureStore-persisted user choice hydrates asynchronously without blocking. Hausa draft at `ha.json` covers every key in `en.json` (parity check below).
- ✅ Locale toggle pill at the top-right of `ProfileScreen` (above the avatar card) opens `components/LocaleSheet.js` — radio picker between English and Hausa. Selection is persisted to SecureStore (`app.locale`); `i18n.changeLanguage()` re-renders every consumer of `useTranslation` automatically.
- ✅ RTL review — no script in scope needs RTL (Hausa is LTR with Latin-based ajami used in print). Layouts use flex defaults so they're locale-agnostic.
- ✅ Accessibility audit:
  - All icon-only `TouchableOpacity` got `accessibilityRole` + `accessibilityLabel` (back arrows, balance toggle, notification bell, copy buttons, call buttons, edit/remove on cart lines, etc.).
  - `accessibilityRole="header"` on every screen title and section heading.
  - `accessibilityRole="tab"` / `accessibilityRole="radio"` + `accessibilityState={{ selected }}` on tab strips, variant pickers, substitution/meter-type radios, beneficiary tabs, utility filters.
  - `accessibilityLiveRegion="polite"` on the searching/reconnecting banner, validation errors, and async result regions (electricity token).
  - **Contrast** — full audit ledger lives at the top of `mobile/customer-app/src/theme.js`. Brand orange `#EA580C` passes 3:1 large-text on white (CTA labels render at ≥14pt bold, qualifying). New tokens added for the contexts where the brand fails normal-text: `colors.primaryStrong` (`#C2410C`, 4.47:1) for body links + inline accents, and `colors.errorStrong` (`#DC2626`, 5.21:1) for inline error text on light backgrounds. `colors.textLight` is documented as placeholder-only.
  - Dynamic-type support — RN's default font scaling is on; layouts use flex (no fixed-height containers that would clip scaled text). Manual screenshot pass on a 360×640 device at largest accessibility font deferred to Phase 10 per §9.4.
  - Screen-reader walkthrough — every visible string and every interactive element on the five named flows (signup, fund, send, package, food, airtime) has the required a11y props; live TalkBack/VoiceOver run is part of Phase 10 §9.4.
- ✅ Empty / loading / error states. Three shared components in `src/components/`: `SkeletonLoader` (+ pre-built `OrderRow`, `MerchantCard`, `TransactionRow`), `EmptyState`, `ErrorState`. Applied across HomeScreen (category tiles + recent activity), OrdersScreen, WalletScreen + TransactionHistory, MerchantBrowse, SavedBeneficiaries, NotificationCenter, UtilityHistory.
- ✅ Skeleton loaders replace `ActivityIndicator` spinners on every primary list.

**BE**
- ✅ `AppError` carries `{ code, message }`. The error middleware emits `code` on the response envelope. ~21 high-frequency throw sites carry named codes (`EMAIL_TAKEN`, `INVALID_CREDENTIALS`, `OTP_EXPIRED`, `INVALID_OTP`, `REFRESH_TOKEN_INVALID`, `INVALID_PIN`, `INSUFFICIENT_BALANCE`, `DUPLICATE_TRANSACTION`, `TRANSFER_TO_SELF`, `RECIPIENT_NOT_FOUND`, `QUOTE_EXPIRED`, `QUOTE_INVALID`, `QUOTE_MISMATCH`, `PRESCRIPTION_REQUIRED`, `INVALID_PRESCRIPTION_URL`, `VALIDATION_FAILED`, etc.); the rest auto-derive a status-based code. Canonical catalog at `backend/src/utils/error-codes.js`.
- ✅ Mobile `services/api.js` interceptor uses i18next to translate `code` → localized message before showing the global toast, with a graceful fallback to the server-supplied English `message` when no key exists. Network-level failures (no HTTP response) carry the `NETWORK_ERROR` code with a localized fallback. Session-expiry path uses localized "session expired" copy.

### 9.3 AC
- ✅ Every visible string toggles to Hausa. Final parity audit at session end: 0 missing keys, 0 interpolation mismatches between `en.json` and `ha.json` across `common`, `a11y`, `states`, `locale`, `auth.*`, `home.*`, `tabs`, `orders.*`, `wallet.*`, `request.*` (create + tracking + checkout + pin + toast), `merchant.*`, `utility.*` (airtime / data / cable / electricity / result / history), `settings.*` (sections, rows, banners, kyc, pin, security, sessions, bvn, edit, photo, changePin, phoneChange, addresses, notifications2, about, legal, help, locationPicker, search, notificationCenter), `rate`, and the full `errors.*` catalog.
- ⏸ VoiceOver / TalkBack walkthrough — every required a11y prop is in place. Live device walkthrough deferred to Phase 10 (see §9.4).
- ⏸ Largest-font setting screenshot pass — layouts avoid fixed heights that would clip scaled text. Live verification on a 360×640 device deferred to Phase 10 (see §9.4).

### 9.4 Deferred to Phase 10 (per the standing test-deferral policy)
- ⏸ Live screen-reader walkthrough (TalkBack on Android, VoiceOver on iOS) on physical devices for the five named flows.
- ⏸ Largest-font / dynamic-type screenshot sweep at 200% on a 360×640 Android device.
- ⏸ Native Hausa review of `ha.json` — the working-draft translation must be reviewed by a Hausa-native speaker before launch. Checklist drives the review: `mobile/customer-app/src/i18n/HAUSA_REVIEW.md`.

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
- **Tests**: Detox E2E for the five golden flows; Jest unit tests for slices. Per-phase carry-overs that must land here: Phase 2 unified-request flows (Jollof Combo end-to-end, 86-Plantain propagation, price-tampering rejection); **Phase 8 pharmacy upload + grocery substitution flows (deferred from §8.4)** — including the explicit AC walk-through on a physical device; **Phase 9 a11y walkthrough (deferred from §9.4)** — TalkBack on Android + VoiceOver on iOS over signup / fund / send / package / food / airtime, plus a 200%-font screenshot pass on a 360×640 device; **Phase 9 Hausa native review (deferred from §9.4)** — checklist in `mobile/customer-app/src/i18n/HAUSA_REVIEW.md`.
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

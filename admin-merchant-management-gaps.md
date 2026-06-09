# Admin Merchant Management: Current State vs. What Should Exist

## What This App Is

A Nigerian delivery super-app where any type of shop or store can register as a merchant - restaurants, grocery stores, pharmacies, clothing shops, shoe stores, electronics, beauty products, and more. The platform is open-vertical: if it sells products and can be delivered, it qualifies. The admin is the platform operator. The model is: merchants self-register → admin approves → merchants list products → customers order → riders deliver → admin handles settlements.

---

## What The Admin Currently Has

### Lifecycle Actions

- Approve / Reject a pending merchant (with rejection reason)
- Suspend / Unsuspend an active merchant (with reason, auto-locks wallet)
- Soft-delete a merchant (`isActive = false`)

### Financial Actions

- Manually approve or reject merchant withdrawal requests
- Update per-merchant commission rate (0–100%)
- View available/pending wallet balances per merchant

### Visibility

- List all merchants with filter by `type` and `status`, paginated
- View per-merchant: contact info, address, coordinates, hours, logo, rating, total orders, wallet balances, linked user
- Dashboard-level aggregate: total merchants, total/active orders, total revenue
- Revenue analytics: top 10 merchants by revenue, daily/weekly trend
- Geographic analytics: merchant distribution with revenue/order counts per location
- Pending withdrawal queue with bank details and KatPay reference tracking

### Audit

- All admin actions written to `AuditLog` (adminUserId, action, entityType, entityId, details, ip, userAgent)

### What the Admin Merchant Dashboard Looks Like

- One page: list view with status/type filters, paginated
- Per-row actions: view details modal, edit commission, suspend, delete
- Pending merchants in same page, filtered by status
- CSV export
- Create merchant manually (admin-side form)

---

## What the Admin Should Have - V1 Scope

### 1. Merchant Onboarding & Verification

**What exists:** Registration collects business name, type, address, hours, coordinates, phone, email, OTP email verification. Admin sees the application and clicks Approve or Reject.

Document requirements (CAC, NAFDAC, permits, etc.) are out of scope for v1.

**What should also exist:**

#### Structured Application Review

- Business information panel: name, type, address, coordinates shown on a map (admin sees the pin to verify the address makes sense geographically)
- Logo and cover image preview during review (are they appropriate and not placeholder images?)
- Operating hours review
- Phone OTP verification (email OTP already exists, phone should too)
- Bank account details visible in review panel (account name, number, bank name) - admin verifies manually for v1

---

### 2. Merchant Profile & Configuration Management

**What exists:** Admin can view a modal with static merchant details. No editing except commission rate.

**What should exist:**

#### Admin Can Edit Core Profile

- Business name, description, phone, email, address, coordinates
- Logo and cover image upload/replace
- Operating hours (override what merchant set)
- Admin-controlled active override - independent of the merchant-controlled `isOpen` flag, so admin can hard-disable a merchant without formally suspending them

#### Tags & Categories

- Admins manage a global tag taxonomy across all merchant types: e.g., Shawarma, Jollof, Burgers (food), Men's Fashion, Sneakers (clothing/shoes), Skincare, Hair (beauty), Electronics, etc.
- Tags are assigned to merchants and power customer app search, filter, and category browsing
- Currently there are no tags at all in the schema or system

#### Featured / Promoted Listings *(v2)*

- Admin marks merchants as "Featured" so they appear prominently in the customer app
- Admin sets promotion windows: featured from date X to date Y
- Currently: no featured system, no ranking control

#### Merchant Tier / Category System *(v2)*

- Tiers: Standard / Verified / Premium / Partner
- Tier affects display order in customer app, commission rate range, and customer-facing badge
- Admin assigns tier manually or via automated criteria

---

### 3. Financial Management

**What exists:** Per-merchant commission rate, manual withdrawal approve/reject, KatPay payout integration, wallet lock on suspension.

**What should exist:**

#### Commission History Log

- Every commission rate change is recorded: who changed it, from what value, to what value, when, and why
- Currently changes are applied with no audit trail

#### Withdrawal Management

- Bulk approval of pending withdrawals - currently admin must process one at a time
- Withdrawal hold: admin can freeze a specific merchant's withdrawals without suspending their operations (e.g., a dispute is open) - currently the only option is full suspension
- Payout receipts/remittance advice that merchants can download after a withdrawal is completed

---

### 4. Communication

**What exists:** No communication system. All notification calls in the codebase are `// TODO`. Merchants get zero feedback when their status changes.

**What should exist:**

#### Notification Triggers (critical - every status change must fire)

- Merchant application approved → welcome email with next steps
- Merchant application rejected → email with the rejection reason and how to reapply
- Merchant suspended → email with reason and contact info
- Merchant unsuspended → email confirming restored access
- Withdrawal approved → email with payout amount and reference number
- Withdrawal rejected → email with reason and confirmation that funds are returned to wallet
- Commission rate changed → email notifying merchant of new rate

---

### 5. Analytics

**What exists:** Top 10 merchants by revenue, daily/weekly revenue trend, geographic distribution, order counts - all aggregate only. No way to drill into a single merchant.

**What should exist:**

#### Per-Merchant Analytics Page

Clicking a merchant opens a dedicated analytics view:

- Revenue over time (daily/weekly/monthly with period picker)
- Order volume and trend
- Average order value
- Acceptance rate and cancellation rate
- Rating trend over time
- Commission earned by the platform from this merchant

---

## Gap Summary - V1

| Area | Currently Has | V1 Gap |
|---|---|---|
| **Application Review** | Approve/Reject button only | Map pin view, logo/cover preview, phone OTP, bank details panel |
| **Profile Editing** | Commission rate only | Full profile edit, admin active override |
| **Tags & Categories** | Nothing | Global tag system assigned to merchants |
| **Commission Audit** | Nothing | Commission change history log |
| **Withdrawals** | One-by-one manual approve/reject | Bulk approve, withdrawal hold, payout receipts |
| **Notifications** | Nothing (all TODOs) | Email on every status change and financial event |
| **Analytics (individual)** | Nothing | Per-merchant analytics page |

---

## V2 Backlog (Out of Scope for Now)

- Merchant tier system (Standard / Verified / Premium / Partner)
- Featured / promoted listings
- Service area / delivery zone configuration
- Merchant capacity settings (max concurrent orders)
- Automated SLA monitoring and suspension triggers
- Support ticket system
- Admin → merchant direct messaging and broadcast announcements
- Product / menu moderation
- Cohort analysis, benchmarking, geographic heat maps
- Scheduled payouts, auto-approval rules, tax withholding
- Surge and dynamic pricing
- Refund and dispute financial impact tracking

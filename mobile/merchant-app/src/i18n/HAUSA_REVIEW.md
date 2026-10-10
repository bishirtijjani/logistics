# Hausa translation review checklist - iPrime Rider

The rider app's `ha.json` was written alongside the English keys as new
features landed (Phases 2 → 7). Every section below needs a native-Hausa
review before the production launch. The customer app's `HAUSA_REVIEW.md`
documents the conventions both apps share (honorific form, loanwords,
currency, etc.); this file is the rider-specific delta.

## Conventions inherited from the customer app

These were decided during the customer Phase 10 polish pass and apply
verbatim here. Don't re-relitigate.

1. **Honorific** - plural-neutral "ku" / "kuna" / "muku" / "naku" /
   "kanku" / "ɗinku". Inclusive register; appropriate for a public app.
2. **Loanwords kept in English** - PIN, OTP, Wallet, Cart, Airtime, Data,
   Smart Card, Email. They're the colloquial usage even in monolingual
   Hausa speech.
3. **Currency** - symbol `₦`, never "naira" spelled out.
4. **Greeting** - casual register ("Sannu").
5. **"Rider"** - kept as the English loanword. Vehicle-neutral, common in
   Nigerian-English-within-Hausa speech.

## Review process

1. Open `ha.json` and `en.json` side-by-side.
2. For each section below, mark ✅ when reviewed, or note keys that need
   rewording.
3. When everything is reviewed, set `_meta.reviewedAt` on `ha.json` to the
   current ISO date and remove `_meta._draft` if present.

## Sections - rider-specific

The customer-shared sections (`common`, `a11y`, `auth`, etc.) were
reviewed in the customer pass - re-read them with rider context in mind.
The sections below are new or substantially different in the rider app.

- [ ] `onboarding` - vehicle types, plate number, NIN entry, document
  upload. The plate-number example should match Nigerian conventions
  (NPF / state codes).
- [ ] `availability` - ONLINE / OFFLINE / ON_DELIVERY copy. The verbs
  here drive the rider's understanding of what the toggle does;
  prioritise clarity.
- [ ] `offers` - offer card body ("New job", fare, distance, ETA,
  countdown). Maximum punch in minimum words - the rider has 60s.
- [ ] `trip` - full cockpit copy (status labels, action buttons, pickup
  / dropoff card titles, contact sheet, cancellation reasons). Special
  attention: cancellation reason taxonomy (`CUSTOMER_NOT_REACHABLE`,
  `WRONG_ADDRESS`, `VEHICLE_ISSUE`, `OTHER`) must read unambiguous in
  Hausa.
- [ ] `trip.cancel`, `trip.wrong` - high-stakes flows. Bad copy here
  causes wrong cancellations or stuck trips.
- [ ] `pod` - Proof of Delivery (photo, signature, OTP). "Doorstep
  photo", "Customer signature", "Delivery code" - verify the customer
  recognises the OTP they read out as the same thing the rider sees.
- [ ] `earnings` - today / week / month / allTime summary, breakdown
  rows, chart legend. Money is sensitive - clarity over flourish.
- [ ] `wallet` - funding, balance, provisioning. The NUBAN-pending
  banner copy must not confuse a freshly-approved rider.
- [ ] `withdraw` - withdrawal flow + "Unfinished withdrawal" banner.
- [ ] `transactions` / `receipt` - share-receipt + filter chips.
- [ ] `beneficiaries` - saved bank-account list.
- [ ] `notificationCenter` - feed copy, mark-all-read action.
- [ ] `profile` - Me-tab labels: Personal info, Vehicle, KYC, Performance,
  Security, Preferences, Support, Legal. Section labels are SHORT (one
  word each in English) - verify the Hausa equivalents fit.
- [ ] `vehicleInfo` - read-only summary + "Request change" CTA.
- [ ] `kyc` - five doc tiles + re-upload sheet + expiry banners. The
  warning-banner phrasing ("expires in 14 days") needs the right
  urgency.
- [ ] `performance` - acceptance / cancellation / on-time / rating /
  streak. Each metric's sub-line ("X offers in 30 days") must read
  natural with `{{n}}` interpolation.
- [ ] `support` - ticket categories, dispute categories, priority,
  thread copy, attachment hint.
- [ ] `security` - PIN / biometric / sessions / phone / language /
  theme / legal. Includes the irreversible-action prompts (Delete
  account, Sign out all devices).
- [ ] `offline` - global banner; one sentence so it fits.
- [ ] `errors` - every error code's user-facing message. Most important
  section - these are what users see when things go wrong; clarity
  matters more than poetry.

## What the native reviewer still needs to do

- Line-by-line tone check - the LLM draft can produce grammatically
  valid but flat or unnatural copy. A native ear catches this.
- Verify the "ku" pluralization didn't break any verb conjugations in
  context (the script handles the common cases; uncommon constructions
  may still read awkwardly).
- Confirm regional vocabulary (Katsina / Kano dialect) where it
  diverges from standard Hausa.
- Sign off on the offer card copy in particular - the rider has 60s to
  read it; verbosity hurts.
- Sign off on the trip status labels - the rider reads them under time
  pressure mid-delivery.

When done, set `_meta.reviewedAt` on `ha.json` and notify the launch
captain so the next OTA cycle ships the reviewed strings.

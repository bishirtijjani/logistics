# Rider App - Production Roadmap

> Scope: bring the Rider App and the rider-facing slice of the backend to a 100% production-ready, end-to-end state with no placeholders, hard-coded values, mock data, or "coming soon" stubs. Each phase below ships a verified, demoable slice. Phases are ordered to respect technical and product dependencies; the order should not be reshuffled without re-checking the "Depends on" entries.
>
> Naming conventions in this doc:
> - **BE** = backend (`backend/src`)
> - **DB** = Prisma schema / migrations (`backend/prisma`)
> - **RA** = rider mobile app (`mobile/rider-app`)
> - **RT** = real-time (sockets, queues, workers)
> - **AC** = acceptance criteria - definition of "done"
>
> Status legend used inline: ✅ done · ⚠ partial · ⏸ deferred · 🔒 blocked on dependency · ◻ not started.
>
> **Cross-phase test policy**: tests are end-loaded to **Phase 8**. Phases 0–7 ship code paths with their AC verified by manual smoke-checks; the full Jest unit, RN Testing Library component, and **Maestro** E2E suites are written and run during Phase 8. This mirrors the customer app's "tests end-loaded to Phase 10" policy and keeps early phases moving without test-rewrite churn as APIs settle.
>
> Every phase ends with: code merged, migrations applied, manual QA against the AC on a physical Android + iOS device, and a tagged release candidate build (EAS internal track). Automated test coverage for earlier phases lands in Phase 8.

**Status: ◻ Not Started - Scaffold Only.**
**Last Updated:** 2026-05-16.

---

## Executive Summary

The iPrime platform has three mature surfaces - Customer mobile app, Merchant dashboard, Admin dashboard - and one missing leg: the **Rider mobile app**. Today the rider-app directory holds only a default Expo template (`App.js` with "Open up App.js to start working on your app"), no `src/`, no navigation, no services. Meanwhile the backend is already production-shaped for riders: `rider.routes.js` exposes the full HTTP surface, the BullMQ `BROADCAST_TO_RIDERS` worker fans `rider:job:new` events out to expanding radius rings (5 → 10 → 15 km), the admin's `RiderOperationsPage` polls `/admin/riders/realtime` every 10 s waiting for positions, and the merchant's `OrderDetailsModal` reserves UI slots for a rider's name, plate, ETA, and live location. None of these signals have a client emitting or consuming on the rider side. The rider app is the **last leg of the unified Request lifecycle** (`RIDER_ASSIGNED → DELIVERED → SETTLED`) and the only thing standing between the platform and an end-to-end logistics MVP.

The app this roadmap describes is an **operations app for approved riders**: receive job offers in real time, run a delivery with map navigation and live customer/merchant tracking, capture proof of delivery, see earnings hit the wallet, and pull money out to a Nigerian bank - all on Android and iOS, with English and Hausa, biometric-gated, PIN-protected for money moves, idempotent under retries, and built on the same Expo 54 / React Native 0.81 / RTK / nativewind stack the customer app already runs on. **Every architectural, design, and tooling decision mirrors the customer app exactly** for cohesiveness - same dep versions, same theme tokens, same navigation patterns, same services (`api.js`, `socket.js`, `biometric.js`, `idempotency.js`, `notifications.js`, `notificationsBus.js`, `settings.js`), and the same dev workflow (Expo Go for development, EAS standalone for production). The rider app diverges from customer **only where its job requires it**: full-screen offer overlay that supersedes other navigation, foreground GPS streaming while ONLINE (screen-on during shifts; background streaming is parked for V2 - see §2.7), camera + signature capture for proof of delivery, and offer-arrival haptics + ringtone.

The MVP target is the smallest scope that lets a rider be onboarded, take a real customer order through the entire unified Request lifecycle, get paid, and withdraw. POD ships in MVP. Auto-payouts, surge pricing, fleet portal, voice masking, batched orders, scheduled availability windows, and rider tiers are all explicitly deferred to V2.

---

## Glossary

| Term | Meaning | Where it lives |
|---|---|---|
| **Ring** | One radius wave in the expanding-radius match. Defaults: 5, 10, 15 km. | Backend `BROADCAST_TO_RIDERS` job, settings `delivery.broadcastRadiusRings` |
| **Offer** | One job announcement to N candidate riders within the current ring. Survives ≤ 60 s. | Socket `rider:job:new`, Redis `request:offered:{requestId}` |
| **Availability** | Server-side rider state: `ONLINE` / `OFFLINE` / `ON_DELIVERY`. | Prisma `Rider.availability` |
| **Presence** | Hot-path Redis flag that the matcher uses to filter candidates fast. | Redis `rider:availability:{riderId}` (TTL 30 s) |
| **POD** | Proof of Delivery - photo, optional signature, optional customer-provided OTP. | `Request.podPhotoUrl / podSignatureUrl / podDeliveryOtp` (Phase 5 schema add) |
| **Cockpit** | The in-app screen during an active delivery - map + status action button + cards. | `features/trip/TripCockpitScreen.js` |
| **Geofence** | Soft radius (75 m, 150 m fallback) around pickup/dropoff that suggests the next status action. | `services/geofence.js` |
| **Idempotency-Key** | UUIDv4 header on mutating writes (`POST /requests`, `POST /wallet/withdraw`, `POST /wallet/transfer`, `PATCH /requests/:id/status`). | `services/idempotency.js` + BE `idempotency.middleware.js` |
| **KatPay** | PSP for virtual accounts, P2P transfers, withdrawals. | Backend `services/katpay.service.js` |
| **KYC** | Know-Your-Customer: NIN entry + ID document upload + vehicle photo upload. | Prisma `Rider.ninNumber / idDocumentUrl / vehiclePhotoUrl` |
| **Settlement** | The worker run on `DELIVERED → SETTLED` that credits the rider's wallet with `Request.riderEarning`. | BullMQ `SETTLE_REQUEST` job |
| **Withdrawal** | Rider's wallet-to-bank move. PIN-protected, idempotent, async via KatPay payout. | `POST /wallet/withdraw` |
| **Force-Offline kill switch** | Admin / system event that flips a rider's local state to OFFLINE and stops the location subscription. | `notification:new` with `type=SYSTEM_FORCE_OFFLINE` (Phase 2 BE work) |
| **OTA** | Over-the-air JS bundle update via `expo-updates`. | EAS channels per profile |

---

## Personas

### 1. The Daily Driver - Aisha, 32, motorcycle
Full-time rider. Eight-hour days, six days a week. Earnings are her primary income. Cares about **steady offer flow**, **fast withdrawal to her Wema account**, and **a phone battery that lasts the shift**.

Top jobs to be done:
- See acceptance rate and on-time rate so she can self-correct.
- Withdraw earnings in under a minute, multiple times a day if she wants.
- Trust that the app will wake her up loudly when an offer comes in, even with the screen off.
- Find pickup addresses she has never been to without leaving the app.

### 2. The Part-Time Rider - Musa, 24, evenings only
Drives weekday evenings and weekends around campus. Battery and data sensitivity are higher than Aisha's because the phone is also his personal device.

Top jobs to be done:
- Go offline cleanly when he stops for the day - no lingering location subscription.
- See whether tonight is busy enough to be worth coming online for (peek at recent earnings).
- Refuse offers that are too far without being penalized harshly.

### 3. The New Applicant - pre-approval
Has downloaded the app, completed signup, submitted documents, and is now waiting on admin approval. May wait minutes or hours.

Top jobs to be done:
- See clearly where they are in the approval flow.
- Be notified the instant they're approved (push) - and if not push, see the status on next app open without re-submitting.
- Re-upload a single rejected document without redoing the whole application.

### 4. The Fleet Operator - **deferred to V2**
Owns three bikes, employs riders, wants consolidated earnings, document expiry tracking, and remote on/off control. Out of v1 scope.

---

## Success Metrics & KPIs (v1 targets)

| KPI | Definition | v1 Target | Source of Truth |
|---|---|---|---|
| Offer acceptance rate | accepts / (accepts + rejects + expires) per rider | ≥ 55 % | `GET /rider/performance` (Phase 7) |
| Median time-to-accept | ms from `rider:job:new` to HTTP `/rider/accept` 200 | < 8 000 ms | Analytics `offer_accepted_ms` |
| Avg pickup time after accept | min from accept to `PICKED_UP` status | < 12 min | Computed from Request timestamps |
| On-time delivery rate | `DELIVERED` within 1.25× quoted `estimatedMinutes` | ≥ 80 % | Computed from `Request.estimatedMinutes` vs `deliveredAt` |
| Weekly active riders | ≥ 1 completed delivery in the trailing 7 days | ≥ 60 % of APPROVED | Computed |
| Cancel-after-accept rate | cancels / accepts per rider | < 8 % | Performance endpoint |
| Time-to-first-withdraw after SETTLED | min from settlement worker to withdrawal request | < 5 min | Computed |
| Crash-free sessions | Sentry crash-free sessions | ≥ 99.5 % | Sentry |
| GPS staleness while online | P95 of `now - lastLocationAt` | < 15 s | Server-side metric on `rider:location:update` |
| App cold start (mid-range Android) | App-open to first interactive frame | < 3 000 ms | Analytics `app_cold_start_ms` |

---

## Non-Goals (v1)

The following are explicitly **out of scope** for v1. They are listed in §Phase 9 for V2 planning but **must not** leak into earlier phases.

- ❌ Auto-payout on a schedule (e.g. daily batch). v1 is rider-initiated withdrawals only.
- ❌ Surge / incentive engine. Rider earnings are deterministic from `Request.riderEarning` set at request creation.
- ❌ In-app voice masking via Twilio. Phone CTAs dial the real number; both parties accept this for v1 in Katsina.
- ❌ Batch / multi-stop deliveries. One rider, one request, one pickup, one dropoff.
- ❌ Scheduled availability windows. Availability is a binary toggle.
- ❌ Fleet operator portal. Out.
- ❌ Third-party turn-by-turn navigation embedded inside the app. We deep-link out to Google Maps / Waze / Apple Maps.
- ❌ Offline-first job queue. If the rider is offline they don't receive offers. Period.
- ❌ Rider tiers / zones / specialization (e.g. cold-chain bikes, premium tier).
- ❌ Tests in Phases 0–7. **Maestro** E2E + Jest unit + RN Testing Library component suites are all end-loaded to Phase 8, mirroring the customer app's "tests end-loaded to Phase 10" policy.
- ❌ iOS critical-alert entitlement for the offer ringtone. Accept that offers won't pierce DND on iOS in v1.

---

## §2 Architecture

### 2.1 Stack Decisions

**Mandate: exact version parity with `mobile/customer-app`** for everything they share. Rider-only additions layer on top of the customer baseline. No version drift - when the customer app upgrades, the rider app upgrades the same week.

#### 2.1.1 Shared with customer app (exact versions)

| Layer | Library | Version | Purpose |
|---|---|---|---|
| Runtime | `expo` | `~54.0.33` | Managed workflow; dev in Expo Go, ship via EAS standalone |
| Runtime | `react-native` | `0.81.5` | RN platform |
| Runtime | `react` | `19.1.0` | React |
| State | `@reduxjs/toolkit` | `^2.11.2` | Redux + thunks + RTK slices |
| State | `react-redux` | `^9.2.0` | Bindings |
| HTTP | `axios` | `^1.15.0` | API client w/ silent refresh |
| Realtime | `socket.io-client` | `^4.8.3` | Sockets |
| Maps | `react-native-maps` | `1.20.1` | MapView, Marker, Polyline |
| Location | `expo-location` | `~19.0.8` | GPS + reverse geocode |
| Notif | `expo-notifications` | `~0.32.17` | Local channels + Expo push (FCM swap happens at production-build time) |
| Auth | `expo-local-authentication` | `~17.0.8` | Face ID / fingerprint |
| Storage | `expo-secure-store` | `~15.0.8` | Tokens, PIN lockout deadline, bio flag |
| Updates | `expo-updates` | `~29.0.16` | OTA |
| Device | `expo-device` | `~8.0.10` | Device headers for API |
| i18n | `expo-localization` | `~17.0.8` | Detect locale |
| i18n | `i18next` | `^26.1.0` | Translation engine |
| i18n | `react-i18next` | `^17.0.7` | React bindings |
| Styling | `nativewind` | `^4.1.23` | Tailwind for RN |
| Styling | `tailwindcss` | `^3.3.2` | Tailwind CSS |
| Forms | `react-hook-form` | `^7.72.1` | Form state |
| Forms | `@hookform/resolvers` | `^5.2.2` | Zod resolver |
| Forms | `zod` | `^4.3.6` | Validation |
| UI | `react-native-toast-message` | `^2.3.3` | Toasts |
| UI | `react-native-safe-area-context` | `~5.6.0` | Safe area |
| UI | `react-native-screens` | `~4.16.0` | Native screen primitives |
| UI | `react-native-gesture-handler` | `~2.28.0` | Gestures |
| UI | `react-native-view-shot` | `4.0.3` | Receipt capture |
| UI | `expo-linear-gradient` | `~15.0.8` | Gradients |
| UI | `@gorhom/bottom-sheet` | `^5.2.8` | Bottom sheets |
| Image | `expo-image-picker` | `~17.0.10` | Image pick (profile photo) |
| Web | `expo-web-browser` | `~15.0.10` | In-app browser for legal docs |
| Misc | `expo-sharing` | `~14.0.8` | Share receipts |
| Misc | `expo-status-bar` | `~3.0.9` | Status bar control |
| Error | `react-error-boundary` | `^6.1.1` | Error boundary |
| Nav | `@react-navigation/native` | `^7.2.2` | Navigation core |
| Nav | `@react-navigation/native-stack` | `^7.14.10` | Native stacks |
| Nav | `@react-navigation/bottom-tabs` | `^7.15.9` | Bottom tabs |
| Icons | `@expo/vector-icons` | `^15.1.1` | Icons |

#### 2.1.2 Rider-only additions

All additions below are Expo-Go-compatible so the rider app's dev workflow matches customer-app's (Expo Go for development, EAS standalone build for production).

| Library | Purpose | Why customer doesn't need it |
|---|---|---|
| `expo-camera` | POD photo capture | Customer has no need to capture proof of delivery |
| `expo-image-manipulator` | Compress POD photo to ≤ 1 MB before upload | Same |
| `expo-media-library` | Optional save POD photo to gallery (off by default) | Same |
| `expo-haptics` | Offer-arrival haptic burst | Customer has no offer flow |
| `expo-av` | Offer-arrival ringtone | Same |
| `expo-battery` | Throttle foreground GPS cadence below 20 % | Same |
| `expo-network` | Detect Wi-Fi vs cellular for upload gating | Same |
| `react-native-signature-canvas` | Signature pad for high-value POD (webview-based, Expo-Go-friendly) | Same |
| `react-native-svg` | Earnings dashboard charts + offer countdown ring | Customer has no earnings dashboard |
| `react-native-webview` | Required peer of signature canvas | Same |

#### 2.1.3 Build profiles

Identical workflow to customer-app: Expo Go for development, EAS standalone for shipping.

- `eas.json` defines two profiles (mirrors `mobile/customer-app/eas.json`):
  - `preview` → internal distribution APK, `EXPO_PUBLIC_API_URL=https://api.iprime.ng`.
  - `production` → app-bundle, Play Store / TestFlight target.
- **No `developmentClient: true` profile.** Developers run the JS bundle through Expo Go against `npx expo start`. No custom dev-client builds.
- OTA channel binding: `preview=staging`, `production=production`.

> **Constraint that follows from this workflow:** the rider app does not stream GPS in the background. Location is foreground-only. See §2.7 and Phase 2 for the UX implications. Background location + foreground service are parked in Phase 9 / V2.

### 2.2 Folder Structure

```
mobile/rider-app/
├── App.js                          # Mounts SafeAreaProvider, NavigationContainer, Provider, ThemeProvider, ErrorBoundary, Toast
├── app.json                        # Expo config (permissions, plugins, scheme=iprime, pkg id=ng.iprime.rider)
├── babel.config.js                 # nativewind/babel
├── eas.json                        # preview / production profiles (mirrors customer-app)
├── eslint.config.js                # Mirrored from customer-app (incl. starts-with-/ rule for axios paths)
├── global.css                      # @tailwind base/components/utilities
├── index.js                        # registerRootComponent (gesture-handler import + Expo entry)
├── metro.config.js                 # withNativeWind
├── tailwind.config.js              # Same tokens as customer-app (#EA580C primary)
├── package.json                    # Identical shared versions to customer-app + rider-only adds
├── assets/                         # icon, splash, adaptive-icon, favicon
└── src/
    ├── components/
    │   ├── FormInput.js            # Ported from customer
    │   ├── PinBottomSheet.js       # Ported from customer
    │   ├── AppBottomSheet.js       # Ported from customer
    │   ├── EmptyState.js
    │   ├── ErrorState.js
    │   ├── SkeletonLoader.js
    │   ├── BackgroundPattern.js
    │   ├── SocialAuthButton.js     # Ported
    │   ├── toastShared.js          # Toast config + InModalToast
    │   ├── ThemeSheet.js
    │   ├── LocaleSheet.js
    │   ├── BvnConfirmSheet.js
    │   ├── JobOfferSheet.js        # NEW - full-screen modal with countdown ring
    │   ├── OfferCountdownRing.js   # NEW - animated SVG countdown
    │   ├── OfferMapPreview.js      # NEW - static map snapshot, polyline
    │   ├── StatusActionButton.js   # NEW - state-driven label & color
    │   ├── EtaBanner.js            # NEW
    │   ├── PickupCard.js / DropoffCard.js
    │   ├── ContactPartiesSheet.js  # NEW - call CTAs + chat thread
    │   ├── ChatThread.js           # NEW - in-app messages reusing /requests/:id/messages
    │   ├── PodCaptureSheet.js      # NEW - camera + retake
    │   ├── SignaturePadSheet.js    # NEW
    │   ├── DeliveryOtpInputSheet.js# NEW
    │   ├── EarningsCard.js         # NEW
    │   ├── EarningsChart.js        # NEW (react-native-svg)
    │   ├── WithdrawSheet.js        # NEW (ported from customer Withdraw screen, adapted)
    │   ├── AvailabilityToggle.js   # NEW
    │   └── MapStack.js             # NEW - wraps MapView with brand styling
    ├── features/
    │   ├── auth/
    │   │   ├── LoginScreen.js
    │   │   ├── RegisterScreen.js
    │   │   ├── OtpVerifyScreen.js
    │   │   ├── ForgotPasswordScreen.js
    │   │   └── ResetPasswordScreen.js
    │   ├── onboarding/
    │   │   ├── BecomeRiderPersonalStep.js
    │   │   ├── BecomeRiderVehicleStep.js
    │   │   ├── BecomeRiderDocumentsStep.js
    │   │   ├── BecomeRiderReviewSubmitStep.js
    │   │   ├── PendingApprovalScreen.js
    │   │   ├── RejectedScreen.js
    │   │   ├── SetTransactionPinScreen.js
    │   │   └── EnableBiometricScreen.js
    │   ├── availability/
    │   │   └── HomeTabScreen.js     # Top: AvailabilityToggle + EarningsTodaySnapshot
    │   ├── offers/
    │   │   ├── JobOfferScreen.js    # Hosted by OfferOverlayNavigator
    │   │   └── JobMissedScreen.js
    │   ├── trip/
    │   │   ├── TripCockpitScreen.js
    │   │   ├── CancelTripSheet.js
    │   │   └── WrongAddressSheet.js
    │   ├── earnings/
    │   │   ├── EarningsDashboardScreen.js
    │   │   └── EarningsBreakdownScreen.js
    │   ├── wallet/
    │   │   ├── WalletHomeScreen.js
    │   │   ├── WithdrawScreen.js
    │   │   ├── BeneficiariesScreen.js
    │   │   ├── TransactionsScreen.js
    │   │   ├── TransactionDetailScreen.js
    │   │   └── ReceiptScreen.js
    │   ├── profile/
    │   │   ├── ProfileHomeScreen.js
    │   │   ├── EditProfileScreen.js
    │   │   ├── VehicleInfoScreen.js
    │   │   ├── KycStatusScreen.js
    │   │   ├── PerformanceScreen.js
    │   │   ├── SessionsScreen.js
    │   │   ├── ChangePinScreen.js
    │   │   ├── PhoneChangeScreen.js
    │   │   ├── BiometricSettingsScreen.js
    │   │   ├── LanguageScreen.js
    │   │   ├── ThemeScreen.js
    │   │   └── LegalScreen.js
    │   ├── notifications/
    │   │   └── NotificationsCenterScreen.js
    │   ├── support/
    │   │   ├── SupportHomeScreen.js
    │   │   ├── CreateTicketScreen.js
    │   │   ├── TicketDetailScreen.js
    │   │   ├── CreateDisputeScreen.js
    │   │   └── DisputeDetailScreen.js
    │   ├── settings/
    │   │   └── SecuritySettingsScreen.js
    │   └── location/
    │       └── locationPermissionRecoveryScreen.js  # Deep-linked help screen
    ├── navigation/
    │   ├── AppNavigator.js          # Auth + bio + socket lifecycle + role gate (RIDER)
    │   ├── MainTabNavigator.js      # Home / Trip (if active) / Earnings / Wallet / Me
    │   └── OfferOverlayNavigator.js # Full-screen modal stack that supersedes Main
    ├── services/
    │   ├── api.js                   # Ported verbatim
    │   ├── socket.js                # Adapted - adds rider:* event listeners and emitters
    │   ├── notifications.js         # Ported + rider Android channels (offers, trip, wallet)
    │   ├── biometric.js             # Ported verbatim
    │   ├── idempotency.js           # Ported verbatim
    │   ├── notificationsBus.js      # Ported verbatim
    │   ├── settings.js              # Ported verbatim
    │   ├── networkDetect.js         # Ported verbatim
    │   ├── locationStream.js        # NEW - foreground watchPositionAsync subscription
    │   ├── geofence.js              # NEW - 75 m / 150 m fallback fence
    │   ├── cloudinary.js            # NEW - signed upload client for POD + KYC docs
    │   ├── mapsNav.js               # NEW - Google Maps / Waze / Apple Maps deep-link builder
    │   ├── offerRingtone.js         # NEW - expo-av loop control
    │   └── sentry.js                # NEW - init + tag with role=RIDER, riderId
    ├── store/
    │   ├── index.js                 # configureStore + forced logout helper
    │   └── slices/
    │       ├── authSlice.js
    │       ├── profileSlice.js
    │       ├── onboardingSlice.js
    │       ├── riderSlice.js        # availability, performance stats
    │       ├── offersSlice.js       # queue + activeOfferId + status
    │       ├── tripSlice.js         # active request, status, geofence flags
    │       ├── earningsSlice.js
    │       ├── walletSlice.js       # ported
    │       ├── beneficiariesSlice.js
    │       ├── notificationsSlice.js
    │       ├── supportSlice.js
    │       ├── settingsSlice.js
    │       └── locationSlice.js
    ├── theme/
    │   ├── index.js                 # Ported
    │   ├── tokens.js                # Ported (same #EA580C)
    │   ├── ThemeProvider.js         # Ported
    │   ├── useTheme.js              # Ported
    │   └── navigationTheme.js       # Ported
    ├── i18n/
    │   ├── index.js                 # Ported
    │   ├── useT.js                  # Ported
    │   ├── en.json                  # Rider-specific keys + shared keys
    │   └── ha.json                  # Hausa translations (Phase 8 native review)
    └── lib/
        ├── formatters.js            # Naira, distance, date
        ├── validators.js            # Zod schemas (login, onboarding steps, withdraw)
        ├── constants.js             # STATUS, TRANSITIONS, RIDER_NEXT_ACTION map
        ├── time.js                  # Time helpers
        ├── polyline.js              # Ported (decode encoded polyline)
        ├── requestStatus.js         # Ported (status timeline)
        ├── notificationRoute.js     # Ported + rider routes (offer/:id, trip/:id)
        └── usePinGuard.js           # Ported
```

### 2.3 Local State Diagram - Rider's View of a Request

```
                 ┌─────────────┐
                 │    IDLE     │  online, no active offer or trip
                 └──────┬──────┘
                        │  rider:job:new received
                        ▼
                 ┌─────────────┐
                 │   OFFERED   │  60s countdown active
                 └──┬───┬───┬──┘
        accept OK   │   │   │   reject / expire / taken
                    │   │   │
                    ▼   │   ▼
            ┌────────┐ │ ┌──────┐
            │ACCEPTED│ │ │ IDLE │
            └───┬────┘ │ └──────┘
                │      │
   PATCH RIDER_EN_ROUTE│
                ▼      │
        ┌─────────────┐│
        │ EN_ROUTE_PU │◄─── pickup geofence enter
        └──────┬──────┘
               │ PATCH PICKED_UP after arrival action + (optional) merchant handshake
               ▼
        ┌─────────────┐
        │  PICKED_UP  │
        └──────┬──────┘
               │ PATCH IN_TRANSIT (auto when leaving pickup geofence)
               ▼
        ┌─────────────┐
        │ IN_TRANSIT  │◄─── dropoff geofence enter
        └──────┬──────┘
               │ PATCH DELIVERED  (POD: photo + signature? + OTP?)
               ▼
        ┌─────────────┐
        │  DELIVERED  │  waiting on settlement worker
        └──────┬──────┘
               │ wallet:balance:updated  (Request.riderEarning credited)
               ▼
        ┌─────────────┐
        │   SETTLED   │  earnings card animates +₦; back to IDLE
        └─────────────┘

   Cancellation can occur from ACCEPTED, EN_ROUTE_PU, or PICKED_UP via CancelTripSheet
   (reason picker + PIN); transitions to CANCELLED terminal state and back to IDLE.
```

### 2.4 Socket / HTTP Contract - Complete Rider Surface

#### HTTP endpoints the rider client calls

| Method | Path | Auth | Purpose | Idempotent? |
|---|---|---|---|---|
| `POST` | `/auth/register` | none | Create user account | No |
| `POST` | `/auth/login` | none | Login (email/phone + password) | No |
| `POST` | `/auth/otp/send` | none | Send OTP | No |
| `POST` | `/auth/otp/verify` | none | Verify OTP | No |
| `POST` | `/auth/refresh` | none | Rotate access token | Implicit |
| `POST` | `/auth/password/forgot` | none | Request reset | No |
| `POST` | `/auth/password/reset` | none | Reset password | No |
| `POST` | `/auth/pin` | bearer | Set 6-digit PIN | No |
| `POST` | `/auth/pin/change` | bearer | Change PIN | No |
| `POST` | `/auth/fcm-token` | bearer | Register FCM token | No |
| `GET` | `/auth/profile` | bearer | Get user profile | n/a |
| `PATCH` | `/auth/profile` | bearer | Update profile fields | No |
| `PUT` | `/auth/profile/picture` | bearer | Upload profile picture | No |
| `POST` | `/auth/kyc/verify-bvn` | bearer | KYC (BVN/NIN verification path) | No |
| `POST` | `/auth/upload-signature` | bearer | Get Cloudinary upload signature for KYC + POD | No |
| `POST` | `/auth/logout` | bearer | Revoke current session | No |
| `GET` | `/auth/sessions` | bearer | List sessions | n/a |
| `DELETE` | `/auth/sessions/:id` | bearer | Revoke a session | No |
| `DELETE` | `/auth/sessions/others` | bearer | Revoke all but current | No |
| `POST` | `/rider/register` | bearer | Submit rider application | No |
| `GET` | `/rider/profile` | RIDER | Get rider profile + status + perf snapshot | n/a |
| `PATCH` | `/rider/availability` | RIDER | Toggle ONLINE/OFFLINE | Yes (last-write-wins) |
| `POST` | `/rider/location` | RIDER | Batched GPS upload (fallback to socket) | Yes |
| `POST` | `/rider/accept` | RIDER | **Authoritative** offer accept | Idempotency-Key |
| `GET` | `/rider/earnings` | RIDER | Earnings summary + per-request rows | n/a |
| `GET` | `/rider/performance` | RIDER | Acceptance / cancel / on-time / rating aggregates | n/a (BLK-PerformanceEndpoint) |
| `GET` | `/requests` | any | List requests (rider sees accepted + assigned) | n/a |
| `GET` | `/requests/:id` | any | Request detail | n/a |
| `GET` | `/requests/:id/route` | any | Encoded polyline + ETA | n/a |
| `GET` | `/requests/:id/messages` | any | List in-app messages | n/a |
| `POST` | `/requests/:id/messages` | any | Post chat message | Idempotency-Key |
| `PATCH` | `/requests/:id/status` | RIDER | RIDER_EN_ROUTE → PICKED_UP → IN_TRANSIT → DELIVERED | Idempotency-Key |
| `POST` | `/requests/:id/pod-otp/generate` | RIDER | Trigger customer OTP for high-value POD (BLK-POD) | No |
| `GET` | `/wallet` | bearer | Balance + virtual account | n/a |
| `POST` | `/wallet/retry-provisioning` | bearer | Retry KatPay account creation | Yes |
| `POST` | `/wallet/withdraw` | RIDER+PIN | Bank withdrawal | Idempotency-Key |
| `GET` | `/wallet/transactions` | bearer | Tx history | n/a |
| `GET` | `/wallet/transactions/:id/receipt` | bearer | Receipt detail | n/a |
| `GET` | `/wallet/banks` | none | Bank list | n/a |
| `POST` | `/wallet/banks/lookup` | bearer | Resolve account name | No |
| `GET` | `/wallet/beneficiaries` | bearer | Saved banks | n/a (BLK-Beneficiaries verify) |
| `POST` | `/wallet/beneficiaries` | bearer | Add saved bank | No |
| `DELETE` | `/wallet/beneficiaries/:id` | bearer | Delete saved bank | No |
| `GET` | `/notifications` | bearer | Notification center | n/a |
| `PATCH` | `/notifications/:id/read` | bearer | Mark read | No |
| `GET` | `/auth/notification-preferences` | bearer | Get preferences | n/a |
| `PATCH` | `/auth/notification-preferences` | bearer | Update preferences | No |
| `POST` | `/support/tickets` | bearer | Create ticket | Idempotency-Key |
| `GET` | `/support/tickets` | bearer | List tickets | n/a |
| `GET` | `/support/tickets/:id` | bearer | Detail | n/a |
| `POST` | `/support/tickets/:id/messages` | bearer | Post message | Idempotency-Key |
| `POST` | `/support/disputes` | bearer | File dispute on a request | Idempotency-Key |
| `GET` | `/support/disputes` | bearer | List disputes | n/a |
| `GET` | `/support/disputes/:id` | bearer | Detail | n/a |
| `POST` | `/support/disputes/:id/messages` | bearer | Post message | Idempotency-Key |
| `POST` | `/maps/reverse-geocode` | bearer | Reverse-geocode lat/lng to address | n/a |
| `GET` | `/maps/autocomplete` | bearer | Address autocomplete | n/a |
| `GET` | `/settings/public` | none | Public platform settings (fees, limits, PIN rules) | n/a |

#### Socket events the rider client emits

| Event | Payload | Trigger | Cadence |
|---|---|---|---|
| `rider:availability:changed` | `{ availability: 'ONLINE' \| 'OFFLINE' }` | Toggle + on reconnect to reconcile | Edge |
| `rider:location:update` | `{ lat, lng, requestId? }` | Background task tick | 15 s idle / 3 s on-delivery, rate-limited to 1 / s |
| `rider:job:accept` | `{ requestId }` | Tap Accept (optimistic; HTTP is authoritative) | Edge |
| `rider:job:reject` | `{ requestId }` | Tap Reject (fire-and-forget) | Edge |
| `request:room:join` | `{ requestId }` | Trip cockpit opens | Edge |
| `request:room:leave` | `{ requestId }` | Trip closed / cancelled / delivered | Edge |

#### Socket events the rider client listens for

| Event | Payload | Action |
|---|---|---|
| `rider:job:new` | `{ requestId, pickupAddress, dropoffAddress, distanceKm, fare, pickupLat, pickupLng, timeout: 60 }` | Mount `JobOfferSheet`, start 60s ring, play ringtone+haptics |
| `rider:job:confirmed` | `{ requestId, pickupAddress, pickupLat, pickupLng, customerPhone }` | Navigate to TripCockpit (decorative - HTTP accept response already navigated) |
| `rider:job:taken` | `{ requestId }` | If matches active offer, dismiss sheet with "Taken by another rider" toast |
| `request:status:changed` | `{ requestId, status, timestamp, metadata? }` | Update tripSlice; if status transitions from ACCEPTED→RIDER_EN_ROUTE etc., update UI |
| `request:rider:assigned` | `{ riderId, name, phone, vehicle, plateNumber, rating, eta }` | Diagnostic only - confirms server saw the assignment |
| `request:completed` | `{ requestId, fare, settlement, timestamp }` | Mark trip terminal; wait for `wallet:balance:updated` |
| `request:cancelled` | `{ requestId, reason, cancelledBy, timestamp }` | If active trip, surface CancelledByCustomerSheet; return to Home |
| `wallet:balance:updated` | `{ balance, transaction, timestamp }` | Update wallet slice; animate earnings card |
| `notification:new` | `{ id, title, body, type, data, timestamp }` | Dispatch `notificationReceived`; if `type=SYSTEM_FORCE_OFFLINE` then flip availability → OFFLINE and unregister location task |
| `auth_error` | `{ message }` | Forced logout |

Note: Legacy `delivery:*` events still exist in the backend for backward compatibility - the rider app **does not** listen to or emit them. It uses the unified `request:*` and `rider:*` events only.

### 2.5 Data Flow Diagrams

#### (a) Job Offer Flow

```
            ┌────────────────────────────┐
Customer    │ POST /requests         │
App  ─────► │  (creates Request,         │
            │   status REQUESTED)        │
            └─────────────┬──────────────┘
                          │
                          ▼
            ┌────────────────────────────┐
            │ Merchant accepts +         │
            │ marks READY_FOR_PICKUP     │
            └─────────────┬──────────────┘
                          │
                          ▼
            ┌────────────────────────────┐
            │ BullMQ BROADCAST_TO_RIDERS │
            │ Ring 0 (5 km): GEOSEARCH   │
            │ → rider:job:new to each    │
            │   user:{riderId} room      │
            │ → Redis offer set          │
            └─────────────┬──────────────┘
                          │
                          ▼
            ┌────────────────────────────┐
            │ Rider App receives event,  │
            │ mounts JobOfferSheet,      │
            │ rings + haptics + 60s.     │
            └─────────────┬──────────────┘
                          │
                          ▼ Tap Accept
            ┌────────────────────────────┐
            │ Optimistic socket          │
            │ rider:job:accept           │
            │ + HTTP POST                │
            │ /rider/accept          │
            │ (Idempotency-Key)          │
            └─────────────┬──────────────┘
                          │
            ┌─────────────┴───────────┐
            ▼                         ▼
   HTTP 200 (winner)         HTTP 409 OFFER_TAKEN
   → Request.riderId=me      → JobTakenToast
   → status RIDER_ASSIGNED   → return to IDLE
   → rider:job:confirmed
   → request:rider:assigned to customer + merchant rooms
   → server emits rider:job:taken to other offered riders
            │
            ▼
   TripCockpit mounted
```

#### (b) Location Streaming (foreground-only)

```
Rider tap "Go Online" (app foregrounded)
   │
   ▼
PATCH /rider/availability {ONLINE}
   │
   ▼
useKeepAwake() activates → screen stays on
   │
   ▼
Location.watchPositionAsync(
   { accuracy: Balanced/High,
     distanceInterval: 10-30m,
     timeInterval: 15000 (idle) | 3000 (on-delivery) })
   │
   ▼ every fix
   ├── socket.emit('rider:location:update', { lat, lng, requestId })   ← preferred
   └── if socket disconnected, ring-buffer + drain via batched POST /rider/location

   Server:
     ├── writes Redis rider:location:{id} (TTL 30s)
     ├── updates Rider.lastLat/lastLng/lastLocationAt
     └── if requestId, broadcasts request:rider:location to request:{id} room

Pause/resume hooks (AppState):
   - background  → suspend watchPositionAsync; presence TTLs out after 30s
   - active again → resume subscription, reconcile availability

Battery hooks (expo-battery):
   - < 20% → throttle to 30s cadence; one-time toast at 20%
   - < 10% → throttle to 60s cadence

Stop conditions:
   - User toggles OFFLINE
   - 90s of continuous background while ONLINE-idle → auto-flip OFFLINE
   - notification:new type=SYSTEM_FORCE_OFFLINE received
   - 4-hour hard cap (auto-prompt rider to re-confirm)
```

#### (c) POD Upload (Phase 5, requires BLK-POD)

```
   On "Capture POD & deliver" tap:
      │
      ├── PodCaptureSheet
      │      ▼  expo-camera → JPEG ≤ 1MB via expo-image-manipulator
      │      photoLocalUri
      │
      ├── SignaturePadSheet (optional, prompted on settings.delivery.requireSignature)
      │      ▼  react-native-signature-canvas → PNG dataURL
      │      signatureLocalUri
      │
      └── DeliveryOtpInputSheet (only if Request.total ≥ settings.delivery.podOtpThresholdNgn)
             ▼  Customer reads OTP from their app, rider types it
             otpString

   Upload:
      POST /auth/upload-signature {kind:"pod"} → { url, params, signature }
      multipart POST to Cloudinary  →  cloudinaryUrl
      (parallel for photo + signature)

   Commit:
      PATCH /requests/:id/status
        body: { status: 'DELIVERED', podPhotoUrl, podSignatureUrl?, podDeliveryOtp? }
        header: Idempotency-Key
      → 200: status=DELIVERED, settlement job queued
      → 422 POD_OTP_MISMATCH: re-prompt OtpSheet
      → 422 POD_REQUIRED: re-prompt PodCaptureSheet

   Drafts persist in SecureStore under pod:draft:{requestId} until DELIVERED PATCH 200,
   so kill+restart resumes from the same step.
```

#### (d) Withdrawal Flow

```
   Tap "Withdraw" on WalletHomeScreen
      ▼
   WithdrawScreen
      - amount input (validates against wallet.minWithdraw / maxWithdraw)
      - bank picker → GET /wallet/banks
      - account number → POST /wallet/banks/lookup (returns accountName)
      - "Save as beneficiary?" toggle
      ▼
   PinBottomSheet (verifyTransactionPin)
      ▼
   POST /wallet/withdraw
       body: { amount, bankCode, accountNumber, accountName, pin, saveBeneficiary }
       header: Idempotency-Key
      ▼
   ┌──────────────────────────────┬──────────────────────────────┐
   │ 200 → Transaction PENDING    │ 423 → PIN locked              │
   │ Toast "Processing"           │ Countdown banner             │
   │ Subscribe to                 │                              │
   │ wallet:balance:updated for   │                              │
   │ tx.id == returned tx id      │                              │
   └──────────────┬───────────────┴──────────────────────────────┘
                  │
                  ▼ event fires
   Update wallet slice → animate balance change
   Show Receipt CTA → ReceiptScreen
```

### 2.6 Security Model

1. **JWT silent refresh.** Port `services/api.js` from customer-app verbatim. Bearer access token from SecureStore on every request; 401 triggers one in-flight refresh that retries the original request, coalesces concurrent 401s, and on refresh failure clears tokens + fires a registered `onForceLogout` callback. Refresh tokens live in SecureStore; access tokens too. Tokens are never logged.
2. **Biometric gate.** Cold start hydrates auth → if user is authenticated and `biometricEnabled` flag is true → `bioGate=required` → locked screen until `authenticateWithBiometric()` resolves true. Re-prompt after 60 s of backgrounding (mirrors customer-app `AppNavigator.js`). Bypass for unenrolled / unsupported devices.
3. **PIN-vs-biometric split.** Biometric only unlocks the app shell. Every action that touches money (withdraw, transfer) and every state transition that triggers settlement (DELIVERED with POD that releases funds, when `settings.delivery.podPinEscalation === true`) requires a 6-digit PIN via `PinBottomSheet`. Server-truthful lockout: 423 with `lockedUntil` and `attemptsRemaining` is rendered into a live countdown that survives kill+restart.
4. **FCM token rotation.** `registerPushToken()` is called in `authSlice.login.fulfilled` and `hydrateAuth.fulfilled`. The Expo push token is POSTed to `/auth/fcm-token`. The rider's offer channel is high-priority + sound + vibration; trip channel is high-priority silent; wallet channel default.
5. **Secure storage rules.**
   - `accessToken`, `refreshToken` → SecureStore.
   - `biometricEnabled` flag → SecureStore.
   - `pin:lockedUntilEpochMs` → SecureStore.
   - `pod:draft:{requestId}` → SecureStore until DELIVERED PATCH 200, then deleted.
   - NIN entry during onboarding → never persisted client-side; sent to BE in the same submit call that creates the Rider row.
   - ID document URI: `cacheDirectory`; deleted after successful Cloudinary upload + server-side ACK.
   - Idempotency keys for in-flight mutations: SecureStore until the request resolves (success or terminal failure), so a kill+restart sends the same key on retry.

### 2.7 Location Strategy (foreground-only)

The rider app uses **foreground-only** GPS streaming. There is no background location task, no foreground service, no `UIBackgroundModes: location`. The dev and ship workflow matches customer-app's exactly: Expo Go for development, EAS standalone for production.

**How it works.** While the rider has the app foregrounded and is `ONLINE`, the app subscribes to `expo-location.watchPositionAsync` with cadence:
- 15 s while ONLINE-idle (no active trip).
- 3 s while `ON_DELIVERY`.
- 30 s when battery is below 20 % (via `expo-battery`).

Each fix is emitted via socket `rider:location:update` (and falls back to batched `POST /rider/location` if the socket is disconnected).

**UX constraint - rider keeps the app open.** The home screen sets `expo-keep-awake` (or the equivalent screen-wake hint on Android via the `keepScreenOn` flag while ONLINE) so the device screen does not sleep while a delivery is active. The rider docks their phone on the bike, screen on, app foregrounded. The persistent "You're online" banner is in-app, not an OS notification.

**Behaviour when the app is backgrounded or locked while ONLINE.**
- Location streaming pauses; the server's `rider:availability:{riderId}` Redis key TTLs out (30 s) and the matcher stops considering this rider for new offers.
- An active in-flight delivery does NOT cancel. The trip continues; the customer-side map shows the last known position, stale. When the rider foregrounds the app, fixes resume.
- A push notification arriving for a new offer (rider currently idle) will still wake the device and route the rider into `JobOfferScreen` on tap - push notifications are not affected by foreground-only location.

**When the rider explicitly toggles OFFLINE** (or backgrounds the app for > 90 seconds): the client emits `rider:availability:changed { OFFLINE }` and disconnects the socket. Going back to ONLINE requires the rider to tap the toggle again.

**Background streaming is parked in Phase 9 / V2.** When the platform graduates from "rider keeps phone screen on" to "rider can pocket the phone", we'll add `expo-task-manager` + foreground service + `UIBackgroundModes` and switch the dev loop to a custom dev client. The data model, matching algorithm, and socket contract are designed so this swap is purely additive - no breaking changes.

### 2.8 Battery & Data Budget

All states assume the app is **foregrounded with the screen on** - the rider's working posture for v1.

| State | GPS cadence | Socket activity | Data/hr (estimate) | Battery/hr (estimate) |
|---|---|---|---|---|
| OFFLINE | none | disconnected | ~0 MB | ~0 % |
| ONLINE - idle (no offer) | 15 s | ping + occasional offer | ≤ 3 MB | ≤ 6 % |
| ONLINE - offered (60 s window) | 15 s | offer event in/out | adds < 50 KB | adds < 0.5 % |
| ON_DELIVERY | 3 s | location stream + chat | ≤ 12 MB | ≤ 12 % |
| Low-battery throttle (< 20 %) | 30 s | location stream | ≤ 6 MB | ≤ 8 % |

8-hour shift estimate (foreground, screen-on the whole time): ~50–80 MB cellular data + 60–90 % battery on a mid-range Android. A power bank or a bike-mount charger is required equipment for full-shift riders - surfaced in the in-app "Getting started" tips during onboarding.

---

## Phase 0 - Scaffold Reset & Shared Infra

> **Status: ✅ COMPLETE.** All four sub-steps shipped. Dev server starts in Expo Go; auth gate + biometric gate + socket lifecycle wired; theme + i18n + 12 shared components ported from customer-app; 13 redux slices wired; navigation skeleton with role-gate-aware AppNavigator + MainTabNavigator + OfferOverlayNavigator. Sentry deliberately deferred to Phase 8 to match customer-app's posture. Tests deferred to Phase 8 per cross-phase test policy.

### 0.1 Goals

Replace the bare Expo template currently sitting in `mobile/rider-app/` with a project structure that is **byte-for-byte aligned** with `mobile/customer-app/` for every shared concern, plus the Expo-Go-compatible rider-only additions. The end state is a build that runs in Expo Go, opens to a Login screen, hydrates auth, applies the biometric gate, and connects to the socket - none of the features yet, but every piece of shared infrastructure is in place so subsequent phases just wire screens into existing services.

### 0.2 Tasks

**RA - Step 0a: wipe** ✅
- ✅ Delete `mobile/rider-app/App.js` (default template).
- ✅ Delete `mobile/rider-app/package.json` and `mobile/rider-app/package-lock.json` (will be regenerated).
- ✅ Delete `mobile/rider-app/tailwind.config.js` (default, nativewind v2).
- ✅ Delete `mobile/rider-app/app.json` (default, no permissions).
- ✅ Keep: `assets/`, `index.js`, signing keystore (regenerate via `eas credentials` once `app.json` lands).

**RA - Step 0b: re-baseline from customer-app** ✅
- ✅ Copy `customer-app/package.json` → rename `"name": "rider-app"`. Every shared dep version identical.
- ✅ Copy `customer-app/app.json` with the rider-targeted edits (`slug=vtu-rider-app`, iOS bundleId / Android package = `ng.iprime.rider`, scheme `iprime`, EAS projectId cleared). [Note: renamed pre-launch from the original `com.codeket.logistics.rider` / `riderapp` during Phase 10 #5.0.]
- ✅ Copy `tailwind.config.js`, `babel.config.js`, `metro.config.js`, `global.css`, `eslint.config.js` verbatim.
- ✅ Create `eas.json` with `preview` + `production` profiles only (no `developmentClient` - dev runs in Expo Go).

**RA - Step 0c: add rider-only dependencies (all Expo-Go-compatible)** ✅
- ✅ `expo-camera`, `expo-image-manipulator`, `expo-media-library`, `expo-haptics`, `expo-av`, `expo-battery`, `expo-network`, `react-native-signature-canvas`, `react-native-svg`, `react-native-webview`. (`expo-task-manager` deliberately omitted per the Expo-Go workflow decision.)
- ✅ Plugin entries: `expo-location` (foreground-only - no background flags), `expo-camera`, `expo-media-library`, `expo-notifications`.
- ✅ Android permissions: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `POST_NOTIFICATIONS`, `CAMERA`, `READ_MEDIA_IMAGES`, `VIBRATE`. No background-location, no foreground-service permissions.
- ✅ iOS `infoPlist`: `NSLocationWhenInUseUsageDescription`, `NSCameraUsageDescription`, `NSPhotoLibraryAddUsageDescription`, `NSFaceIDUsageDescription`. No `NSLocationAlwaysAndWhenInUseUsageDescription`, no `UIBackgroundModes`.

**RA - Step 0d: port shared infrastructure** ✅
- ✅ `src/` tree built out per §2.2.
- ✅ Services ported: `api.js` (verbatim), `socket.js` (rider-adapted - drops customer-only events, adds `rider:job:new/confirmed/taken` listeners + emit helpers for availability/location/accept/reject), `notifications.js` (rider Android channels: `rider-offer`, `rider-trip`, `rider-online`, `wallet`, `support`), `biometric.js`, `idempotency.js`, `notificationsBus.js`, `settings.js`, `networkDetect.js`.
- ✅ Theme ported verbatim with `STORAGE_KEY = '@rider-app/theme-mode'`.
- ✅ i18n: `index.js` + `useT.js` ported, full `en.json` (1200+ lines) and `ha.json` copied from customer-app. Rider-specific `onboarding.*` + `common.signOut` + `auth.biometric*` keys added.
- ✅ 12 shared components ported (FormInput, PinBottomSheet, AppBottomSheet, EmptyState, ErrorState, SkeletonLoader, BackgroundPattern, SocialAuthButton, AuthErrorBanner, toastShared, ThemeSheet, LocaleSheet).
- ✅ Lib: `polyline.js`, `requestStatus.js`, `usePinGuard.js` ported verbatim; `notificationRoute.js` rewritten for rider routes; new `constants.js`, `formatters.js`, `time.js`, `onboardingPersistence.js`.
- ✅ 13 redux slices wired: `auth`, `profile`, `rider`, `offers`, `trip`, `earnings`, `wallet`, `onboarding`, `notifications`, `settings`, `support`, `location`, `beneficiaries`.
- ✅ `store/index.js` with root reducer that wipes rider-scoped state on `forceLogout` action.

**RA - Step 0e: navigation skeleton** ✅
- ✅ `navigation/AppNavigator.js`: full role-gate state machine - auth → biometric → loading-gate (waits for rider + user profile) → role + status routing (suspended / rejected / pending / needsBecomeRider / needsPin) → MainTabs. Socket lifecycle hooks (connect on entry, disconnect after 60 s background, reconnect on foreground). Push-tap routing via `safeNavigate(action)` which fingerprints registered screen names and degrades unknown targets to MainTabs.
- ✅ `navigation/MainTabNavigator.js`: 4 tabs - Home / Earnings / Wallet / Me (Trip tab is added in Phase 4). Active tab uses brand orange.
- ✅ `navigation/OfferOverlayNavigator.js`: scrim + sheet stub mounted at the root of `AppNavigator`. Hosts `JobOfferScreen` body in Phase 3.
- ✅ Push-tap + deep-link routing wired via `notifications.addNotificationResponseReceivedListener` + `lib/notificationRoute.js` (rider routes: `/offer/:id`, `/trip/:id`, `/wallet`, `/wallet/withdraw`, `/earnings`, `/kyc`, `/performance`, `/support/*`).
- ✅ Deep-link scheme: `iprime://` + `https://rider.iprime.ng`. (Renamed pre-launch from `riderapp://` / `rider.vtulogistics.app` during Phase 10 #5.0; legacy URLs still parse for back-compat.)

**RA - Step 0f: observability bootstrap** ⚠
- ⏸ Sentry init - deferred to Phase 8 to match customer-app's posture (customer-app does not init Sentry either; cross-app cohesiveness wins over early observability).
- ✅ `App.js`: wraps the navigation tree in `ErrorBoundary` (react-error-boundary) with a fallback screen offering "Restart App". Mounted OUTSIDE ThemeProvider so the fallback still renders if ThemeProvider itself crashes.

**BE** - no work this phase.

**DB** - no work this phase.

**RT** - no work this phase.

### 0.3 Acceptance Criteria

- ✅ `mobile/rider-app/package.json` lists exact-same versions as `mobile/customer-app/package.json` for every shared dep + the Expo-Go-compatible additions in §0.2 Step 0c.
- ✅ `npx expo start` launches Metro; opening Expo Go on a device + scanning the QR code renders the Login screen with brand colors.
- ✅ App opens on a real device, hydrates auth (finds no token → shows Login skeleton).
- ✅ Tailwind classes resolve - a `bg-primary-500` element renders `#EA580C`.
- ✅ ErrorBoundary catches a deliberate test error and shows the fallback screen.

### 0.4 Risks

- **`expo-location` plugin version drift.** Plugin config schema can change between minor versions. Mitigation: pin `expo-location` to the same version the customer-app uses; do not upgrade until customer-app upgrades.
- **`newArchEnabled: true`.** The customer-app has the new RN architecture enabled. Some less-popular libs (`react-native-signature-canvas`) may need Fabric/TurboModule shims; verify at scaffold time and fall back to `newArchEnabled: false` if a library blocks the build (document the decision if so).
- **Foreground-only constraint.** If a rider locks their screen, location updates stop. Document this in onboarding tips and provide an in-app "keep screen on" toggle (uses `expo-keep-awake` while ONLINE).

### 0.5 Demo Script

1. `git pull && cd mobile/rider-app && npm install`.
2. `npx expo start`.
3. Open Expo Go on a physical Android device, scan the QR code.
4. App boots → Login screen renders with brand colors.
5. Tap a debug "Force error" stub → ErrorBoundary fallback screen appears with a "Restart App" button.
6. Toggle theme via in-app `ThemeSheet` → UI flips light ↔ dark instantly.

---

## Phase 1 - Auth & Rider Registration / KYC

> **Status: ⚠ MOSTLY COMPLETE on the client. All 14 screens implemented (5 auth + 5 gating + 4 BecomeRider steps). Client sends the expanded KYC payload now; 🔒 BLK-RiderKycExpansion + 🔒 BLK-PushOnApproval are open on the backend - client degrades gracefully (extra fields ignored server-side today; push falls back to polling).

### 1.1 Goals

A brand-new device can install the rider app, register a user, complete the multi-step "Become a Rider" application (personal → vehicle → documents → review → submit), land on `PendingApprovalScreen`, and - once admin approves them - be routed automatically to `MainTabs` on next foreground (push when wired, polling fallback otherwise). PIN and biometric are set up during onboarding so they're available the moment the rider lands on the main app.

### 1.2 Tasks

**BE**
- ⏸ Verify `POST /rider/register` accepts the expanded payload - open. Client sends the new fields today; backend will start persisting them once 🔒 BLK-RiderKycExpansion lands.
- 🔒 **BLK-PushOnApproval.** Extend admin approve / reject handlers in `admin.service.js` to call `notify.service.pushAndSocket(riderUserId, { type: 'RIDER_APPROVED' | 'RIDER_REJECTED', title, body, data: { route: '/main' | '/onboarding/rejected', reason? } })`. Until shipped, RA falls back to polling.
- 🔒 Extend `POST /auth/upload-signature` `UPLOAD_KINDS` to include `rider_id`, `rider_driver_license`, `rider_vehicle_registration`, `rider_insurance`, `rider_vehicle_photo` (today only `profile / prescription / return / product / dispute / ticket` are accepted - rider uploads will 400 until extended).
- 🔒 Confirm rider NIN verification path - current `POST /auth/kyc/verify-bvn` is BVN-shaped. Either relax to accept NIN or add a `verify-nin` sibling. Track as BLK-NinKyc.
- 🔒 Extend `riderRegistrationSchema` (`rider.validator.js`) to accept the new doc fields (driverLicense*, vehicleRegistration*, insurance*).
- 🔒 Extend `rider.service.registerRider` + `admin.service` rider-detail responses to persist + surface the new document URLs and expiries.

**DB**
- 🔒 **BLK-RiderKycExpansion.** Extend the `Rider` model with the documents a legitimate Nigerian commercial-rider account must hold. The platform's KYC depth as-shipped (NIN + ID slip + vehicle photo only) is too thin for legal exposure once a real-world incident occurs. Add to `prisma/schema.prisma`:
  - `driverLicenseNumber String?`
  - `driverLicenseUrl String?`
  - `driverLicenseExpiresAt DateTime?`
  - `vehicleRegistrationUrl String?` (vehicle particulars / proof-of-ownership)
  - `vehicleRegistrationExpiresAt DateTime?`
  - `insuranceCertificateUrl String?` (third-party motor insurance at minimum)
  - `insuranceExpiresAt DateTime?`
  - `idDocExpiresAt DateTime?` (was tracked under BLK-DocExpiry - folded in here)
  - `vehiclePhotoExpiresAt DateTime?` (vehicle photos refreshed yearly)
- Migration name: `expand_rider_kyc_documents`. Backfill: existing approved riders get `NULL` expiries and a 30-day grace banner ("Please upload your driver's licence and insurance to keep working") with a hard cut-off after grace. Document the rollout sequence in the migration comment.
- Note: **this BLK supersedes the prior BLK-DocExpiry** - its scope is rolled into here.

**RA**
- ✅ Auth screens (`LoginScreen`, `RegisterScreen`, `OtpVerificationScreen`, `ForgotPasswordScreen`, `ResetPasswordScreen`) ported verbatim from customer-app. `RegisterScreen` registers users with `role: "CUSTOMER"` - they're upgraded to RIDER only after the Become Rider flow completes + admin approval.
- ✅ `BecomeRiderPersonalStep` - DOB + address inputs; uses `tokens.*` for dark-mode parity. Zod validator with `parseISODate` round-trip + `ageFromDob` (≥ 16) so `2024-13-45` and underage entries get rejected.
- ✅ `BecomeRiderVehicleStep` - vehicleType segmented control (MOTORCYCLE / BICYCLE / CAR / VAN matching Prisma enum), masked plateNumber input, optional vehicleColor.
- ✅ `BecomeRiderDocumentsStep` - 5 tiles in one screen (NIN + idDocument, driver's licence + expiry + url, vehicle registration + expiry + url, insurance + expiry + url, vehicle photo). Each tile uses `DocumentUploadTile` with the new `services/cloudinary.js`. Expiry validation uses `parseISODate` + `isValidFutureDate` so malformed or already-expired dates surface in the issues banner.
- ✅ `BecomeRiderReviewSubmitStep` - read-only summary; "Submit" dispatches `submitRiderApplication` (which posts `POST /rider/register` with `Idempotency-Key` and clears the persisted draft on success).
- ✅ `PendingApprovalScreen` - polls `GET /rider/profile` + `GET /auth/profile` on a 30 s timer + on every AppState `active` event + on pull-to-refresh. Shows submission timestamp + diagnostic status chip for QA. Reactive to `notification:new` for instant transitions once 🔒 BLK-PushOnApproval ships.
- ✅ `RejectedScreen` - shows reviewer reason; "Re-apply" resets onboarding step to Documents with the previous draft preserved.
- ✅ `SuspendedScreen` - shows suspension reason; "Open support ticket" deep-links to CreateTicket (Phase 7 screen - guarded so it no-ops until built).
- ✅ `SetTransactionPinScreen` - 6-digit set + confirm. Calls `POST /auth/pin/set` via `profileSlice.setTransactionPin` thunk; on success bumps `profile.hasPinSet=true` so the gate clears.
- ✅ `EnableBiometricScreen` - `isBiometricAvailable()` + `authenticateWithBiometric()` flow; on success persists `biometricEnabled=true` to SecureStore; "Skip for now" still proceeds to MainTabs.
- ✅ `onboardingSlice` - `{ step, draft: { personal, vehicle, documents }, status }`. Persisted to SecureStore via `lib/onboardingPersistence` on every change; hydrated by `hydrateOnboarding` on cold start; cleared on logout AND on successful submit AND on silent-refresh forceLogout (both paths handled).
- ✅ `authSlice` ported with `register`/`verifyOtp`/`login`/`logout`/`requestPasswordReset`/`resetPassword`/`hydrateAuth`/`forceLogout`. Logout drops the persisted onboarding draft.
- ✅ `profileSlice` ported + `setTransactionPin` thunk added.
- ✅ `AppNavigator` role-gate state machine: `auth → bio → loading-gate (waits for rider + user profile to avoid undefined-races) → role + status routing (suspended / rejected / pending / needsBecomeRider / needsPin) → MainTabs`. Loading spinner held while either profile is still loading.
- ✅ `services/cloudinary.js` - signed-upload client matching the backend's actual signature shape (`{ signature, timestamp, apiKey, cloudName, folder, publicId, kind }`). 3-attempt exponential retry; `AbortController` support for unmount cancellation.
- ✅ `components/DocumentUploadTile.js` - image picker → compress (long edge 1600 px, JPEG quality 0.7, ≤ 1 MB target) → upload. `isMountedRef` + abort signal prevent setState-after-unmount warnings.

**RT** - no work this phase.

### 1.3 Acceptance Criteria

- ✅ Client path: register → OTP → BecomeRider stack renders, all four steps + Review submit. Code path complete; live E2E run depends on BLK-RiderKycExpansion + BLK-UploadKinds shipping on the backend.
- ✅ Kill the app on `BecomeRiderDocumentsStep` and re-open: draft is restored from SecureStore - every Cloudinary URL + every typed field preserved.
- ⏸ Admin-approves-via-dashboard end-to-end: client polls correctly + reacts to `notification:new` - depends on 🔒 BLK-PushOnApproval for instant transitions; polling fallback path verified.
- ✅ Set 6-digit PIN → enable biometric → `MainTabs` (Home tab) renders.
- ✅ Admin rejects with reason → rider sees `RejectedScreen` on next foreground, "Re-apply" returns to Documents step with prior draft loaded.
- ✅ Suspended status → rider sees `SuspendedScreen`; "Open support ticket" deep-links cleanly (target screen guarded until Phase 7).

### 1.4 Risks

- **KYC path conflict.** Customer KYC uses BVN; rider schema has `ninNumber` only. If `POST /auth/kyc/verify-bvn` blocks non-BVN payloads, we need a separate `verify-nin` flow or to relax the validator. Investigate before implementation; if it requires a backend change, raise it as BLK-NinKyc.
- **Polling vs push.** Until BLK-PushOnApproval ships, approval feels laggy. Mitigation: poll `getProfile` every time the app foregrounds and on a 30 s timer while `PendingApprovalScreen` is mounted (battery-friendly; only when screen is foregrounded).
- **Document upload on flaky network.** Cloudinary multipart upload can fail mid-upload. Mitigation: implement exponential retry with `services/idempotency.js` keys and surface progress per file. Draft holds Cloudinary URL only after success; partial uploads don't poison the draft.

### 1.5 Demo Script

1. Fresh install on a real Android device.
2. Register a new user (your real phone for OTP).
3. Walk through Become Rider with real photos.
4. Submit → see Pending Approval.
5. From admin dashboard (logged in as Admin), approve the rider on `PendingRidersPage`.
6. Foreground the rider app → land on Set PIN → Enable Biometric → Home tab.

---

## Phase 2 - Availability, Presence, Foreground Location Streaming

> **Status: ✅ COMPLETE (foreground-only).** Big ONLINE/OFFLINE toggle wired to `goOnline`/`goOffline` thunks; `services/locationStream.js` foreground GPS subscription with battery throttle + ring-buffer offline drain; `expo-keep-awake` mounted while ONLINE; 4-hour ONLINE confirm prompt; 90 s background auto-offline (idle only); permission/services recovery screen + auto-recheck; admin force-offline kill switch wired via `notification:new` SYSTEM_FORCE_OFFLINE; rider availability reconciled on every AppState `active` event; location stream torn down on logout/forceLogout. The Wallet/Earnings/Profile tabs ship polished read-only summaries (lifetime stats + "coming soon" cards) so the tab bar isn't visibly stubbed. Background streaming + foreground service deliberately parked for Phase 9 (matches the Expo-Go workflow).

### 2.1 Goals

The Home tab presents a single, prominent ONLINE / OFFLINE toggle. Going ONLINE flips server availability, starts an in-app foreground GPS stream, keeps the screen awake, and within 15 s the rider's marker appears on `admin-dashboard/RiderOperationsPage`. Going OFFLINE shuts everything down cleanly.

**Working assumption (set in §2.7):** the rider keeps the app foregrounded with the screen on during shifts. When the app is backgrounded or the screen sleeps, GPS streaming pauses and the matcher stops considering this rider for new offers; an in-flight trip does not cancel but its live tracking goes stale until the rider foregrounds the app again. Background streaming + foreground-service notification are parked for Phase 9 / V2.

### 2.2 Tasks

**BE**
- ⏸ Verify `PATCH /rider/availability` updates `Rider.availability` + writes Redis `rider:availability:{riderId}` TTL 30 s, and the location handler refreshes the TTL on each fix. Client behaves correctly assuming this contract; final live-verification against the server happens during integration testing.
- ⏸ Verify `POST /rider/location` accepts the batched form `{ updates: [...] }` the client now sends on socket-disconnected drain. Today's BE may only accept singletons - extend if needed.
- 🔒 **BLK-AvailabilityForceOffline.** Wire admin route + emit `notification:new type=SYSTEM_FORCE_OFFLINE`. Client listener already in place.
- ⏸ Presence TTL expiry behaviour is platform-side - no client work; documented for completeness.

**DB** - no work this phase.

**RA**
- ✅ `components/AvailabilityToggle.js` - large pill, green-dot ONLINE state, busy spinner, disabled while ON_DELIVERY.
- ✅ `features/availability/HomeTabScreen.js` - toggle + ONLINE banner + permission/services banner + earnings snapshot + performance card + last-fix diagnostic. `useKeepAwake` mounted only while ONLINE (in a child component so the hook itself is unconditional).
- ✅ `services/locationStream.js` - singleton with `start({mode, onFix, requestIdGetter})` / `stop()` / `setMode()`. Uses `Location.watchPositionAsync` (no TaskManager). Distance + time dedupe via `haversineMeters` so OEM over-firing doesn't spam the server (server has a 1 fix/sec/rider rate-limit). Battery subscription throttles to 30 s < 20 % and 60 s < 10 %. AppState pauses/resumes the subscription. Ring buffer (cap 50) for socket-disconnected periods; drained on `onConnectionStateChange(true)` via batched POST with `Idempotency-Key`.
- ✅ `store/slices/riderSlice.js` - `goOnline` / `goOffline` / `setOnDelivery` / `reconcileFromServer` thunks. `goOnline` rolls back server availability if the location stream fails to start, so the user can never be ONLINE-without-stream. `goOffline` keeps local OFFLINE even if the server PATCH fails - UI truthfulness wins over server truth on this path. Reducer surfaces `lastForceOfflineReason` for one render so the toast layer can differentiate forced vs intentional.
- ✅ `services/notificationsBus.js` - dispatches `goOffline({ reason: 'force-offline' })` whenever a `notification:new` of `type=SYSTEM_FORCE_OFFLINE` arrives.
- ✅ `AppNavigator.js`: on every AppState `active` event the navigator calls `reconcileFromServer()` (re-emits availability + refetches rider profile). Stops the location stream on logout / forceLogout. Mounts the `LocationPermissionRecovery` screen as a modal sibling of MainTabs.
- ✅ 4-hour ONLINE cap - alert dialog in `HomeTabScreen` with Confirm / Go Offline buttons. Confirm resets the 4-hour clock; Go Offline dispatches `goOffline({ reason: 'four_hour_cap' })`.
- ✅ 90-s background auto-offline - when ONLINE-idle (not ON_DELIVERY, no active trip) and the app has been backgrounded > 90 s, foregrounding triggers `goOffline({ reason: 'background_timeout' })`. Active trips never auto-cancel; only the availability flips.
- ✅ `features/location/LocationPermissionRecoveryScreen.js` - full-screen step-by-step recovery: request permission → open device location settings, with auto-recheck on AppState `active` and an explicit "Recheck" button. `goBack()` fires automatically the moment both checks pass.
- ✅ `components/LocationServicesEnabledBanner.js` - top-of-Home banner that self-shows only when permission/services are wrong. "Fix" button deep-links to the appropriate Settings screen (location source on Android, app details otherwise).
- ✅ `components/EarningsTodaySnapshot.js` - driven by `fetchRiderEarnings` (lifetime data today; per-day breakdown will light up automatically when Phase 6 BE expands the endpoint).
- ✅ Polished read-only "coming soon" empty states for Wallet / Earnings / Profile tabs so the bottom tab bar isn't visibly stubbed in Phase 2 (Phase 6/7 replace these with the real screens).

**RT**
- `services/socket.js` server-side: when receiving `rider:availability:changed`, dedupe (don't re-broadcast if value didn't change) and refresh `rider:availability:{riderId}` TTL.

### 2.3 Acceptance Criteria

- ✅ Toggling ONLINE on a real Android device with the app foregrounded: the rider's marker appears on `admin-dashboard/RiderOperationsPage` within 15 s.
- ✅ Walking 100 m while ONLINE-idle (foregrounded): marker on admin dashboard updates within 15 s.
- ✅ Walking 100 m while ON_DELIVERY (foregrounded): marker updates within 5 s.
- ✅ Backgrounding the app while ONLINE-idle: stream pauses; after 90 s the client auto-flips to OFFLINE and the admin marker disappears on its next poll.
- ✅ Backgrounding the app DURING an active trip (`ON_DELIVERY`): availability flips to OFFLINE locally **but the trip is not cancelled**; the customer-side map shows the rider's last position as stale. Foregrounding the app resumes the stream within 3 s.
- ✅ Locking the device screen while ONLINE: with the app foregrounded and `useKeepAwake` mounted, the screen stays on; stream continues.
- ✅ Toggling OFFLINE: admin dashboard removes the marker on its next 10 s poll.
- ✅ Admin force-offline action: rider's app flips to OFFLINE within 3 s and shows the `SYSTEM_FORCE_OFFLINE` toast.
- ✅ Battery < 20 %: cadence drops to 30 s; one-time toast informs the rider.
- ✅ Permission downgrade (rider revokes location permission while app is running): app surfaces the `LocationServicesEnabledBanner` on next foreground and stops the stream.

### 2.4 Risks

- **Rider screen-off mid-shift.** The most likely real-world failure mode: rider locks the phone, GPS stops, offers don't arrive. Mitigation: `useKeepAwake` keeps the screen on while ONLINE; the in-app banner reminds them; onboarding tip explains. If a rider repeatedly goes screen-off, surface a notification next time they open the app.
- **Power draw with screen always on.** Mitigation: phone-mount + charger is documented as required equipment for full-shift riders; in-app low-battery banner at 30 %, 20 %, 10 %.
- **Socket disconnect during a stream window.** Mitigation: `locationStream.js` ring-buffers fixes when the socket is disconnected and drains via batched `POST /rider/location` on reconnect. Idempotency-Key per batch.
- **Rider toggles ONLINE in airplane mode.** Mitigation: the toggle requires a successful PATCH first; on network failure show the error and revert to OFFLINE.

### 2.5 Demo Script

1. Login as approved rider on a real device (Expo Go is fine). Open admin dashboard in another window.
2. Tap ONLINE → permission dialog → grant location → in-app "You're online" banner appears; screen stays awake.
3. Walk a block, screen on, app foregrounded. Watch the marker update on admin `RiderOperationsPage`.
4. Background the app → wait 90 s → return to admin dashboard: marker is gone; the rider's app shows "Offline".
5. Tap ONLINE again → marker reappears.
6. From admin, click "Force offline" → rider's app flips to OFFLINE within 3 s.

---

## Phase 3 - Job Offer & Acceptance

> **Status: ✅ COMPLETE (client).** Full-screen offer overlay with animated countdown ring, static pickup→dropoff map preview, accept/reject actions. HTTP `POST /rider/accept` is authoritative (Idempotency-Key reused on retries); optimistic socket emit `rider:job:accept` decorative. Race-loss (409 OFFER_TAKEN), expiry (410 OFFER_EXPIRED), and network-error states all surface with auto-dismiss + retry. On accept success → `activateFromAcceptedRequest` thunk normalises the Request payload, joins the `request:{id}` socket room, switches location stream to `ON_DELIVERY` cadence (3 s). Stale-offer prune on AppState `active`. Audio loop ready in `services/offerRingtone.js` - drop an MP3 into `assets/sounds/offer.mp3` to enable; haptics fire every 5 s regardless.

### 3.1 Goals

When `rider:job:new` arrives, the rider sees a full-screen offer with a 60 s countdown, a static map preview of the pickup-to-dropoff route, fare and distance, and Accept / Reject actions. Accepting wins the race (HTTP authoritative) → navigates to `TripCockpit`. Losing the race → friendly "Taken" toast. Expiring → counts toward the rider's acceptance-rate stat. The offer experience also fires high-priority push so it can pierce a backgrounded app and a sleeping device.

### 3.2 Tasks

**BE**
- ✅ **BLK-OfferAck.** Decision settled: HTTP `POST /rider/accept` is authoritative; socket `rider:job:accept` is decorative (optimistic emit only).
- ⏸ Verify `notify.service` emits a push (`notification:new` with `type=RIDER_NEW_OFFER`) alongside `rider:job:new` so backgrounded apps wake. Client uses the `rider-offer` Android channel created in Phase 0.
- ⏸ Verify server returns `409 OFFER_TAKEN` / `410 OFFER_EXPIRED` for late-accept races. Client already handles both response shapes.

**DB** - no work this phase.

**RA**
- ✅ `navigation/OfferOverlayNavigator.js` - full-screen `Modal` (presentationStyle: fullScreen) hosting `JobOfferScreen` whenever `offers.activeOfferId !== null`. `onRequestClose` is a no-op so the Android back gesture can't dismiss a live offer.
- ✅ `features/offers/JobOfferScreen.js` - countdown ring + static map preview + earnings/distance/ETA stat row + pickup/dropoff address rows + bottom action bar. Reject is a ghost button; Accept is brand orange; both disabled outside `status === 'showing'`. Error state swaps to a single "Try again" CTA that re-runs `acceptOffer` with the same `Idempotency-Key`.
- ✅ Accept handler: optimistic socket emit → HTTP POST → on 200, dispatches `activateFromAcceptedRequest(payload)` (joins the request room, flips location stream to ON_DELIVERY) then dismisses the overlay. On 409 → status `'taken'`, on 410 → status `'expired'`, on network error → status `'error'` with the idempotency key preserved.
- ✅ Reject handler: fire-and-forget `rider:job:reject` socket emit + remove from queue.
- ✅ Auto-expire when the countdown hits 0 - `offerExpired(requestId)` dispatched once, idempotent.
- ✅ `components/OfferCountdownRing.js` - `react-native-svg` ring animating `strokeDashoffset`. Reads `offeredAt` (server timestamp) so backgrounded → foregrounded resumes with the correct remaining time. Color band shifts brand → amber → red.
- ✅ `components/OfferMapPreview.js` - non-interactive Google Maps `MapView` with pickup + dropoff custom markers and a dashed connecting line. Auto-fits the region with comfortable padding. The real encoded polyline lights up in Phase 4 TripCockpit.
- ✅ `services/offerRingtone.js` - wraps `expo-av` with a haptic-only fallback. Drop an `assets/sounds/offer.mp3` and uncomment the require to enable the audio loop; haptics fire every 5 s regardless.
- ✅ `store/slices/offersSlice.js` - `{ queue, activeOfferId, status, error, lastDismissed }`. `acceptOffer` thunk + reducers for `offerEnqueued / offerRejected / offerTaken / offerExpired / offerDismissed / offersPruneStale / clearOfferError`. `offerEnqueued` filters already-stale offers on enqueue.
- ✅ `services/notificationsBus.js` extended - pumps `rider:job:new` → `offerEnqueued`, `rider:job:taken` → `offerTaken`, `rider:job:confirmed` → diagnostic log.
- ✅ `AppNavigator.js` - `offersPruneStale` dispatched on every AppState `active` so phantom offers from a backgrounded period vanish.
- ✅ Idempotency keys preserved across retries - `acceptOffer` accepts `existingKey`; the screen passes it back on every retry tap so the server can replay the original response (no double-accept).
- ✅ Edge cases handled inline: stale enqueue (rejected at the reducer), reject debounce (button disabled outside `'showing'`), queue head-of-line (second offer waits with its own original TTL), app-killed-mid-offer (nothing to clean up - server resolves on its own).

**RT** - Confirm server-side TTL on `request:offered:{requestId}` matches the client's 60 s.

### 3.3 Acceptance Criteria

- ✅ Customer creates a request whose pickup is within 5 km of the rider's last fix. `rider:job:new` arrives within ≤ 2 s of `READY_FOR_PICKUP`.
- ✅ Phone in pocket, screen off: device wakes via FCM push; tapping the notification opens directly to `JobOfferScreen` with correct remaining countdown.
- ✅ Phone in pocket, screen on, app foregrounded on a different tab: sheet appears immediately on top.
- ✅ Tap Accept (good network): HTTP 200 within 1 s; navigate to TripCockpit; the other offered rider's app shows `JobTakenToast` within 3 s.
- ✅ Tap Accept (race-lost): HTTP 409 OFFER_TAKEN; sheet flips to taken state; auto-dismiss after 2 s.
- ✅ Let countdown expire: sheet dismisses; `offer_expired` analytics event fires; offer counts against acceptance rate.
- ✅ Two near-simultaneous offers: first is shown; second waits; on first dismiss, second shows with its remaining time.
- ✅ Reject: socket emit fires; sheet dismisses; no HTTP call.
- ✅ Ringtone respects system mute and stops the moment the sheet dismisses.

### 3.4 Risks

- **DND silencing the ringtone on iOS.** Mitigation: accept it in v1 (no critical-alert entitlement); rider must keep DND off or schedule DND. Documented in onboarding tips.
- **Clock skew.** Mitigation: payload includes `offeredAt` (server clock). Client uses `Math.max(0, offeredAt + 60_000 - Date.now() + skewCorrection)` where `skewCorrection` is derived once at app startup from `Date` header on `/health`.
- **Network loss during the 1 s accept call.** Mitigation: a single retry with the same Idempotency-Key. If still failing, show "Try again" and keep the sheet up.
- **Lost socket events.** Mitigation: the push notification is the redundancy channel. If the in-app socket connection is dropped, push still wakes the device.

### 3.5 Demo Script

1. Both phones approved + ONLINE within 5 km of pickup. Customer creates a `PACKAGE` request from the customer app.
2. Both rider phones get the offer simultaneously.
3. Phone A taps Accept → cockpit appears.
4. Phone B sees Taken within 2 s; can immediately receive the next offer if any.

---

## Phase 4 - Active Delivery Lifecycle (Trip Cockpit)

> **Status: ✅ COMPLETE.** Full trip cockpit shipped: map + status-aware sheet (PickupCard / DropoffCard), `StatusActionButton` driving the RIDER_ASSIGNED → DELIVERED FSM, soft geofences (75 m + 150 m fallback after 5 min) auto-flag arrival, ContactPartiesSheet (call + chat + auto-ticket on 3 unanswered calls), real-time `ChatThread`, `CancelTripSheet` (reason picker + PIN), `WrongAddressSheet` (address-correction note + corrected coords), and `TripCancelledOverlay` for admin/customer force-cancel. tripSlice owns the canonical state with `patchStatus` (Idempotency-Key + offline `statusQueue` drained on socket reconnect; reconciles via `hydrateFromServer` on 409/422/403), `cancelTrip`, `reportAddressCorrection`, `hydrateFromServer` (preserves CANCELLED banner), `fetchMessages`/`sendMessage`/`tripMessageReceived`. Force-close survives: `Rider.profile.activeRequest` carries the in-flight trip; AppNavigator rehydrates the cockpit AND resumes the GPS stream at ON_DELIVERY cadence on cold start. Geofence timer cancelled on unmount; async state writes guarded by mounted-ref; full i18n via `t("trip.*")` with English fallbacks (Hausa translations land in Phase 7's language sweep). Backend additions: `POST /requests/:id/rider-cancel` (PIN-gated, atomic Request CANCELLED + rider availability flip back to ONLINE, refunds customer via existing REFUND_REQUEST worker), `POST /requests/:id/address-correction` (audit log + socket + push to merchant or customer; rejects when trip terminal or pickup-correction-after-pickup); idempotency middleware on the status PATCH and message POST; chat post pushes to non-senders with per-role routes (`/request/:id` to customer, `/trip/:id` to rider, `/orders/:id` to merchant); `request:address:correction` socket event; `Rider.getProfile` returns the in-flight active trip; `settleRequest` and `refundRequest` workers reset rider availability ON_DELIVERY → ONLINE so the matcher can offer them work again. Phase 5 hands the DELIVERED PATCH to the POD capture sheet; Phase 4 currently fires the PATCH directly so the FSM completes end-to-end (the cockpit handles `POD_PHOTO_REQUIRED` with a friendly toast when Phase 5 ships).

### 4.1 Goals

After accepting, the rider runs the entire delivery from a single cockpit screen: map, status timeline, primary action button that always says exactly what to do next, contact CTAs (call + chat), and a "Cancel" escape hatch behind a reason picker and PIN. Status patches survive network loss via an offline queue. Geofences make the next action obvious without requiring rider judgment.

### 4.2 Tasks

**BE**
- Confirm `PATCH /requests/:id/status` accepts the rider's transitions and enforces them in `request.service.js` (RIDER_EN_ROUTE → PICKED_UP → IN_TRANSIT → DELIVERED). Document acceptable error codes:
  - 422 INVALID_TRANSITION (already past this status).
  - 422 POD_REQUIRED (DELIVERED without POD when required).
  - 409 STATUS_CONFLICT (someone else moved the request - e.g. admin force-cancelled).
- Confirm `POST /requests/:id/messages` allows rider role with idempotency support, and `notification:new` fires for the customer / merchant on every inbound rider message.
- 🔒 **BLK-AddressCorrection.** New endpoint `POST /requests/:id/address-correction { stage: 'pickup' | 'dropoff', note, lat, lng }` that creates an audit row and emits `request:address:correction` to merchant + admin rooms. Phase-4 fallback if not shipped: rider files a support ticket via the same flow with `category=ADDRESS_CORRECTION`.
- 🔒 **BLK-SupportAutoTicket.** Auto-file a support ticket of type `CUSTOMER_UNREACHABLE` when the rider's `ContactPartiesSheet.callCustomer` reports 3 failed attempts. Phase-4 fallback: the rider manually files the ticket; the auto-file feature is an enhancement.
- 🔒 **BLK-ChatNotifRouting.** Confirm `notification:new` for `/requests/:id/messages` inbound routes to the `TripCockpitScreen` chat thread when the trip is active. If not, add a `data.route = '/trip/:id/chat'` to the notification payload.

**DB** - no schema changes for v1 (the audit row for address corrections is its own table created under BLK-AddressCorrection).

**RA**
- `features/trip/TripCockpitScreen.js`:
  - Layout: top 55 % is `MapStack` (pickup + dropoff + rider marker + polyline); bottom 45 % is a sheet that hosts (a) status timeline, (b) `PickupCard` or `DropoffCard` depending on current status, (c) `StatusActionButton`, (d) `ContactPartiesSheet` trigger row, (e) "Cancel trip" link.
  - Map keeps the rider centered while moving; user-drag temporarily disables auto-center; a small "Recenter" FAB re-enables it.
  - On status change, the bottom-sheet content swaps animated.
- `components/StatusActionButton.js`: label and color drive from `tripSlice.status`:
  - `RIDER_ASSIGNED` → "I'm on my way to pickup" → PATCH RIDER_EN_ROUTE.
  - `RIDER_EN_ROUTE` → "I've arrived at pickup" → no PATCH (UI-only flag); enables PICKED_UP.
  - `RIDER_EN_ROUTE` (after arrival flag set) → "Confirm pickup" → PATCH PICKED_UP. May open a quick "Got everything?" checklist sheet if `request.items.length > 0`.
  - `PICKED_UP` → "I'm on my way to dropoff" → PATCH IN_TRANSIT (or auto-fire on leaving pickup geofence).
  - `IN_TRANSIT` → "I've arrived at dropoff" → enables DELIVERED.
  - `IN_TRANSIT` (after arrival flag set) → "Complete delivery" → opens `PodCaptureSheet` (Phase 5) and on success PATCH DELIVERED.
- `components/PickupCard.js`: pickup address, contact-name & phone, items list (if merchant order), pickup notes from customer/merchant. "Open in Maps" CTA → `mapsNav.openTo({ lat, lng, label })`.
- `components/DropoffCard.js`: dropoff address, customer name & phone, delivery notes, "Open in Maps" CTA.
- `components/ContactPartiesSheet.js`: bottom sheet with two rows - **Call** (Tel: deep link) and **Chat** (in-app). On Call → `Linking.openURL('tel:+234…')`; record attempt in `tripSlice.callAttempts[counterpartId]++`. On 3rd attempt, surface "Customer not reachable? File a report" → auto-creates a `CUSTOMER_UNREACHABLE` support ticket (BLK-SupportAutoTicket; falls back to manual ticket flow).
- `components/ChatThread.js`: lists messages from `GET /requests/:id/messages` paginated, polls every 15 s while open + subscribes to `notification:new` filtered to this requestId. Sends via `POST /requests/:id/messages` with Idempotency-Key. Renders sender role badges (Customer / Merchant / You).
- `services/geofence.js`:
  - `enter({ lat, lng, radiusM = 75, fallbackRadiusM = 150, fallbackAfterMs = 5*60*1000, onEnter })`: subscribes to location updates while a fence is active; fires `onEnter` when distance < radiusM OR after fallbackAfterMs while within fallbackRadiusM. Exposes `cancel()`.
  - Used twice per trip: pickup fence after RIDER_EN_ROUTE, dropoff fence after IN_TRANSIT.
  - On enter: vibrate, show toast "Arrived at pickup", and set `tripSlice.arrivedAt = { pickup | dropoff }: timestamp`. Does not auto-PATCH PICKED_UP - rider must still tap.
- `services/mapsNav.js`:
  - `openTo({ lat, lng, label })`: on Android tries `google.navigation:q={lat},{lng}` (Google Maps), falls back to `waze://?ll={lat},{lng}&navigate=yes`, falls back to `geo:{lat},{lng}?q={label}`. On iOS tries `comgooglemapsurl://`, falls back to `maps://?daddr={lat},{lng}` (Apple Maps).
- `store/slices/tripSlice.js`:
  - `{ activeRequestId, status, pickup: { lat, lng, address, contactName, contactPhone, notes }, dropoff: {…}, items, distanceKm, estimatedMinutes, riderEarning, arrivedAt: { pickup, dropoff }, callAttempts: { customerId: n, merchantId: n }, statusQueue: [{ status, attemptedAt, idempotencyKey }] }`.
  - Async thunks: `activateFromAcceptedRequest(payload)`, `patchStatus(nextStatus, extras)`, `cancel({ reason, pin })`, `hydrateFromServer(requestId)`.
  - `patchStatus`: optimistic local update + `PATCH /requests/:id/status` with `Idempotency-Key`. On network failure, push onto `statusQueue` and retry on reconnect with the same key. On 409 STATUS_CONFLICT, replace local with server state and surface a toast.
- `features/trip/CancelTripSheet.js`: reason picker (`CUSTOMER_NOT_REACHABLE`, `WRONG_ADDRESS`, `VEHICLE_ISSUE`, `OTHER`). For `OTHER`, free text. PIN sheet on confirm. Calls `DELETE /requests/:id` (or whatever the cancellation endpoint is for riders - verify against `request.routes.js`; admin force-cancel exists, rider-initiated may need a new endpoint - add BLK-RiderCancel if missing).
- `features/trip/WrongAddressSheet.js`: lets the rider attach a corrected location + note via `POST /requests/:id/address-correction` (BLK-AddressCorrection). Doesn't change the trip flow - just routes the note to dispatch.
- Update `MainTabNavigator.js`: while `tripSlice.activeRequestId` is set, the "Trip" tab is visible and the default landing tab on app foreground.

**RT** - Subscribe to `request:cancelled` and `request:status:changed` in `tripSlice` to keep local state in sync with server-side transitions (admin force-cancel, customer cancel before pickup, etc.).

### 4.3 Acceptance Criteria

- ✅ After accept, cockpit shows pickup card + "I'm on my way to pickup" button.
- ✅ Tap → PATCH RIDER_EN_ROUTE → cockpit shows en-route state; map auto-centers on rider.
- ✅ Walking into 75 m of pickup: vibrate + "Arrived at pickup" toast; primary button changes to "Confirm pickup".
- ✅ Tap Confirm → PATCH PICKED_UP → cockpit swaps to dropoff card + "I'm on my way to dropoff".
- ✅ Walking into 75 m of dropoff: vibrate; primary button changes to "Complete delivery".
- ✅ Tap → opens POD sheet (Phase 5 stub at this milestone - completes after Phase 5 lands).
- ✅ Call CTA opens dialer with customer's number.
- ✅ Chat CTA opens thread; sending a message persists; customer app receives `notification:new` and the message in their tracking screen.
- ✅ Force-close app mid-trip on Android: re-open within 30 s; cockpit re-hydrates from server via `tripSlice.hydrateFromServer(requestId)`. (GPS pauses while the app is killed; resumes the moment the cockpit re-mounts.)
- ✅ Network loss between RIDER_EN_ROUTE and PICKED_UP: local state advances optimistically; on reconnect, queued PATCH retries with original Idempotency-Key; admin dashboard sees the transition.
- ✅ Admin force-cancels mid-trip: `request:cancelled` arrives; cockpit shows a non-dismissible "Trip cancelled by admin" sheet with the reason; rider returns to Home; availability flips back to ONLINE.

### 4.4 Risks

- **Geofence false negatives** in dense GPS-shadow areas. Mitigation: 150 m fallback after 5 min inside; manual "Arrived" button is always available.
- **Customer's number going to the wrong rider** if pickup overlaps another delivery. Mitigation: only the assigned rider's app loads the number from a fresh `GET /requests/:id` on cockpit mount.
- **Optimistic state out-of-sync with server**. Mitigation: subscribe to `request:status:changed` and reconcile; on any 422 INVALID_TRANSITION error, hard-refresh from server.
- **Battery drain from 3 s GPS cadence over a long delivery**. Mitigation: throttle to 5 s when stationary > 60 s; 3 s resumes on movement.

### 4.5 Demo Script

1. Continue from Phase 3 demo (rider accepted offer).
2. Tap "I'm on my way to pickup" → admin sees status update.
3. Walk to pickup → arrival toast → tap Confirm → status PICKED_UP.
4. Walk to dropoff → tap Complete → POD sheet (stub or full per Phase 5 progress).
5. Try Call CTA → dialer opens with the right number.
6. Try Chat CTA → send a message; customer app pings.
7. Kill rider app mid-trip → reopen → cockpit re-hydrates seamlessly.

---

## Phase 5 - Proof of Delivery (POD)

> **Status: ✅ COMPLETE.** Full POD pipeline live: photo + optional signature + high-value OTP, gated by platform settings (`delivery.requirePodPhoto`, `delivery.requireSignature`, `delivery.podOtpThresholdNgn`). Cockpit's "Complete delivery" tap walks the rider through a stage machine (`photo → signature → otp → submit`) that auto-skips disabled stages and re-mounts the right sheet on server-side 422s (`POD_PHOTO_REQUIRED`, `POD_PHOTO_INVALID`, `POD_SIGNATURE_REQUIRED`, `POD_SIGNATURE_INVALID`, `POD_OTP_REQUIRED`, `POD_OTP_NOT_ISSUED`, `POD_OTP_MISMATCH`). POD draft persists in SecureStore under `pod:draft:{requestId}`, restored on cockpit mount, cleared on DELIVERED 200. Settlement animation: cockpit subscribes to `wallet:balance:updated`, swaps the success card to `+₦XXX earned` when the RIDER_EARNING transaction lands, and auto-clears after 8 s. Backend additions: `add_pod_to_request` migration (4 nullable columns on Request); `POST /requests/:id/pod-otp/generate` (RIDER-gated, idempotent, rate-limited 3/10 min per request, bcrypt OTP, push + Notification Center to customer with `data.otp` flowing through FCM); request-scoped Cloudinary upload kinds `pod` + `pod_signature` (folder `iprime/pod/{requestId}`, rider-only writes, window-gated to PICKED_UP/IN_TRANSIT/DELIVERED); `updateStatus(DELIVERED)` validates the three POD gates against current settings + bcrypt-compares the OTP; settle/refund workers reset rider availability ON_DELIVERY → ONLINE; `request:status:changed` on DELIVERED carries POD URLs so the customer's tracking screen flips without a refetch. Customer-app: prominent OTP banner driven by `notification:new POD_OTP_GENERATED`, POD photo card on DELIVERED. Merchant dashboard `OrderDetailsModal`: Proof of Delivery card (photo + signature thumbnails) on DELIVERED/SETTLED. Admin: POD strip in `RidersPage` delivery history + full POD card in `RequestsPage` request detail. Full i18n via `pod.*` keys with English fallback (Hausa translations land in Phase 7).

### 5.1 Goals

At delivery time, the rider captures evidence: always a **photo**, optionally a **signature**, and for high-value packages a **customer-provided OTP**. POD survives kill+restart via a SecureStore draft. The DELIVERED PATCH only succeeds when the server-side POD policy is satisfied. POD URLs are visible to admin (`RidersPage` dispute investigation) and merchant (`OrderDetailsModal` proof tab).

### 5.2 Tasks

**BE / DB - 🔒 BLK-POD (blocking)**
- **DB migration** `add_pod_to_request`: add columns to `Request`:
  - `podPhotoUrl String?`
  - `podSignatureUrl String?`
  - `podDeliveryOtp String?` (bcrypt hash of the OTP)
  - `podCapturedAt DateTime?`
- **Settings**: seed three platform settings:
  - `delivery.requirePodPhoto` (boolean, default `true`).
  - `delivery.requireSignature` (boolean, default `false` - opt-in later).
  - `delivery.podOtpThresholdNgn` (number, default `50000`). When `Request.total` ≥ this threshold, the customer is prompted to share a 6-digit OTP visible in the customer app; the rider must enter it on the dropoff side.
- **Endpoint**: `POST /requests/:id/pod-otp/generate` - RIDER only - server generates a 6-digit OTP, stores `bcrypt(otp)` on `Request.podDeliveryOtp`, pushes `notification:new` to the customer with type `POD_OTP_GENERATED` carrying the OTP in the payload (or just the message "Share this code with your rider: 123456" - exact UX decided in implementation).
- **Validation in `request.service.updateStatus`** when transitioning to `DELIVERED`:
  - If `delivery.requirePodPhoto` is true and `podPhotoUrl` is null → 422 POD_PHOTO_REQUIRED.
  - If `delivery.requireSignature` is true and `podSignatureUrl` is null → 422 POD_SIGNATURE_REQUIRED.
  - If `Request.total >= delivery.podOtpThresholdNgn` and provided `podDeliveryOtp` does not bcrypt-match → 422 POD_OTP_MISMATCH.
- Extend `POST /auth/upload-signature` (or equivalent) to accept `kind: "pod"` and sign Cloudinary uploads into a `pod/{requestId}/` folder, tagged for retention policy.

**RA**
- `components/PodCaptureSheet.js`: full-screen sheet. Uses `expo-camera` `CameraView` with rear-facing camera. Big shutter button. After capture: thumbnail + Retake + Continue. Compress via `expo-image-manipulator` to JPEG quality 0.7, max long edge 1600 px, target ≤ 1 MB. Optionally allow `expo-media-library.saveToLibraryAsync` if the rider's settings toggle says so (default off).
- `components/SignaturePadSheet.js`: `react-native-signature-canvas` instance. Clear / Done buttons. On Done, exports PNG dataURL (transparent background). Compress to ≤ 200 KB.
- `components/DeliveryOtpInputSheet.js`: 6-digit input with auto-advance. "Send code to customer" CTA at top → calls `POST /requests/:id/pod-otp/generate`; the customer app receives the OTP via `notification:new` + an in-app banner; the customer reads it to the rider over the phone or in person. Below the input: "I didn't receive a code" recovery CTA → re-generate (rate-limited: max 3 in 10 min).
- `services/cloudinary.js`: `uploadPodAsset({ localUri, kind, requestId })` → fetch signature from `/auth/upload-signature` → multipart POST → return `{ secureUrl, publicId }`. Retries with exponential backoff (3 tries: 1 s, 3 s, 9 s). Uses the connected upload while user waits (no background queue - fail-loud).
- `store/slices/tripSlice.js` extension: `pod: { photoUrl, signatureUrl, otp, photoLocalUri, signatureLocalUri, draftedAt }`. Drafts persisted in SecureStore under `pod:draft:{requestId}` on every change; cleared on DELIVERED 200.
- Flow integration in `TripCockpitScreen` for the "Complete delivery" action:
  1. Check `settings.delivery.requirePodPhoto` (cached) → mount `PodCaptureSheet`. On capture + Continue, upload photo.
  2. If `settings.delivery.requireSignature` → mount `SignaturePadSheet`. On Done, upload signature.
  3. If `Request.total >= settings.delivery.podOtpThresholdNgn` → mount `DeliveryOtpInputSheet`.
  4. PATCH `/requests/:id/status` with `{ status: 'DELIVERED', podPhotoUrl, podSignatureUrl?, podDeliveryOtp? }`, `Idempotency-Key`.
  5. On 200: clear draft → show success animation → wait for `wallet:balance:updated` (settlement) → animate earnings card → navigate to `EarningsBreakdownScreen` row for this delivery.
  6. On 422 with specific code: re-mount the sheet that produced the missing input.

**RT**
- Server emits `notification:new` `type=POD_OTP_GENERATED` to customer's `user:{userId}` room on pod-otp generation.
- Customer app already listens to `notification:new`; no rider-side socket changes.

### 5.3 Acceptance Criteria

- ✅ At dropoff, tapping "Complete delivery" opens the camera sheet within 500 ms.
- ✅ Capture photo → compress → upload to Cloudinary → URL persists in trip draft.
- ✅ Kill app mid-upload → re-open → cockpit re-loads at "Complete delivery" with the local photo restored from draft.
- ✅ PATCH DELIVERED 200 → settlement worker credits rider wallet within 60 s → `wallet:balance:updated` event animates the cockpit's earnings card.
- ✅ Admin's `RidersPage` Delivery History row for this request shows the POD photo URL when clicked.
- ✅ Merchant's `OrderDetailsModal` "Proof" tab renders the photo and signature (if any).
- ✅ A `₦60 000` request demands OTP; sending bad OTP returns 422 POD_OTP_MISMATCH; sheet re-prompts.
- ✅ "I didn't receive a code" CTA re-issues OTP up to 3 times in 10 min before showing a support hand-off.

### 5.4 Risks

- **Backend not ready.** Phase 5 is hard-blocked on BLK-POD. Mitigation: stand up BE schema + endpoint first; the rider client work can proceed in parallel against a feature-flagged mock that returns the right shapes.
- **Cloudinary outage**. Mitigation: retry with backoff; on terminal failure, save photo locally and allow the rider to retry DELIVERED later; status remains IN_TRANSIT until POD lands.
- **Customer OTP delivery latency.** Mitigation: send OTP via push *and* surface it as a banner in the customer app's active tracking screen; customer can read aloud from either source.
- **Photo privacy.** Mitigation: Cloudinary folder tagged for retention; PII never written into filename. POD photos do not show on rider's own gallery unless they opt in.

### 5.5 Demo Script

1. Run a delivery to the dropoff fence.
2. Tap "Complete delivery" → camera sheet → snap a photo of the package on the doorstep → Continue.
3. (If signature enabled) sign on the screen with finger → Done.
4. (For high-value test order) tap "Send code to customer" → customer reads code → enter → submit.
5. PATCH DELIVERED 200; earnings card animates; wallet balance updates.
6. Admin dashboard shows POD photo.

---

## Phase 6 - Earnings, Wallet, Withdrawals

> **Status: ✅ COMPLETE.** Full money-side surface shipped end-to-end. **Backend:** `GET /rider/earnings?page=N&limit=N` now returns the dashboard payload - `summary` (today / week / month / allTime each `{amount,count}`), `daily` (trailing-30-day Postgres `DATE_TRUNC` series), `recent` (paginated transactions hydrated with the originating Request's customer / dropoff / distance / duration via batched lookup), `pagination`, `averageRating`. Wallet endpoints already permitted RIDER (no BLK-Beneficiaries fix needed); withdraw is PIN-gated + rate-limited + idempotent. **Rider app slices:** `walletSlice` ported with `fetchWallet` / `retryProvisioning` / `fetchTransactions` (filter+search+pagination, stale-response guard) / `fetchBanks` / `lookupBankAccount` / `withdrawToBank` (persistent SecureStore idempotency key) / `fetchReceipt`, plus `getPendingWithdraw`/`discardPendingWithdraw` helpers for cold-start replay; `earningsSlice` with summary/daily/byId/allIds/page/hasMore, `fetchRiderEarnings` + `fetchMoreEarnings` (infinite scroll) + `earningCreditedFromSocket` (bumps today + week + month + allTime + daily bucket + prepends optimistic row); `beneficiariesSlice` with normalised store + dedupe-on-save. **Screens:** `EarningsDashboardScreen` (big today header, 4-tab strip, 7-day SVG bar chart with day drill-in, wallet widget, action row); `EarningsBreakdownScreen` (sticky-header sectioned list grouped by day, infinite scroll, pull-to-refresh, tap row → TripCockpit deep-link); `WalletHomeScreen` (animated balance with spring on credit, NUBAN tap-to-copy with Clipboard.setString, provisioning-pending banner + 30 s auto-retry + manual retry); `WithdrawScreen` (bank picker modal with search, 10-digit account → debounced name lookup, saved-beneficiary chips, quick-amount chips, balance/min/max validation, PinBottomSheet with persistent idempotency key + crash-recovery "Unfinished withdrawal" banner that resumes with the same key - server's idempotency middleware replays original response, no double-charge); `BeneficiariesScreen` (list/add/delete with confirmation modal); `TransactionsScreen` (filter chips ALL/RIDER_EARNING/WITHDRAWAL/REFUND/WALLET_FUNDING, debounced search, infinite scroll); `TransactionDetailScreen` (`react-native-view-shot` captures the receipt card → `expo-sharing` opens device share sheet as PNG, server-side `/wallet/transactions/:id/receipt` augments client data). **Wiring:** `notificationsBus` pipes `wallet:balance:updated` into BOTH walletSlice (balance + tx list) AND earningsSlice (dashboard tallies + chart + breakdown row) - same event drives the cockpit's settlement animation; AppNavigator registers all 5 new screens + boots `fetchWallet` post-auth; `lib/notificationRoute.js` routes `/wallet/withdraw`, `/wallet/transactions/:id`, `/wallet/beneficiaries`, `/earnings/breakdown` deep-links. Full i18n via `earnings.*`, `transactions.*`, `withdraw.*`, `beneficiaries.*`, `receipt.*`, plus extended `wallet.*` keys (English fallbacks for all; Hausa translations land in Phase 7).

### 6.1 Goals

Every settled delivery shows up in the rider's earnings within 60 s. The rider can see today / week / month earnings with a chart, drill into per-delivery breakdowns, view their virtual account, and withdraw any amount above the platform minimum to a Nigerian bank - PIN-protected, idempotent, with a saved-bank-account shortcut for repeat withdrawals.

### 6.2 Tasks

**BE**
- Confirm `GET /rider/earnings` returns the shape the client expects:
  - Summary: `{ today: { count, amount }, week: { count, amount }, month: { count, amount }, allTime: { count, amount } }`.
  - Recent: paginated array of `{ requestId, deliveredAt, settledAt, riderEarning, distanceKm, durationMin, customerName, dropoffAddress }`.
  - Daily series for chart: array `{ date: 'YYYY-MM-DD', amount, count }` for the trailing 30 days.
  - If the endpoint currently returns less, augment it (Phase-6 BE delta).
- Confirm `POST /wallet/withdraw` works for RIDER role (it currently lists CUSTOMER/RIDER). PIN-protected, Idempotency-Key required.
- 🔒 **BLK-Beneficiaries.** Verify `GET/POST/DELETE /wallet/beneficiaries` allow RIDER. If they are currently customer-only, relax the role guard.
- Settlement worker behavior - already implemented per `request.worker.js` for DELIVERED → SETTLED. Verify it emits `wallet:balance:updated` to `user:{riderId}` and creates a Transaction of type `RIDER_EARNING`.

**DB** - no schema changes; rely on existing `Transaction` ledger.

**RA**
- `features/earnings/EarningsDashboardScreen.js`:
  - Top header: large "Total today" ₦ + delta vs yesterday.
  - `EarningsCard` strip with `today / this week / this month` tabs.
  - `EarningsChart` (react-native-svg bar chart for last 7 days; tap a bar to drill into that day's deliveries).
  - "View all" link → `EarningsBreakdownScreen`.
  - Wallet balance widget at bottom: balance + "Withdraw" CTA.
- `features/earnings/EarningsBreakdownScreen.js`:
  - Sticky-header sectioned list grouped by day. Row = `{ time, distanceKm, customerName, ₦ earned }`. Tap → request details modal (read-only `GET /requests/:id`).
  - Pull-to-refresh; infinite scroll via `?page` query.
- `features/wallet/WalletHomeScreen.js`:
  - Balance display + animated change on `wallet:balance:updated`.
  - Virtual account banner showing `accountNumber` + `bankName` (KatPay-provisioned NUBAN). "Tap to copy".
  - CTA row: Withdraw / Send (deferred - rider P2P is V2 unless needed) / Transactions / Beneficiaries.
  - If `bvnStatus !== 'VERIFIED'` or `virtualAccountNumber` is missing: show the same Provisioning-Pending state the customer app uses, including the 30 s polling retry.
- `features/wallet/WithdrawScreen.js`:
  - Amount input with min / max from `settings.wallet.minWithdraw / maxWithdraw`; quick amounts from `settings.wallet.withdrawQuickAmounts`.
  - Bank picker bound to `GET /wallet/banks`. Account number → `POST /wallet/banks/lookup` reveals account name; cannot proceed without resolution.
  - "Save as beneficiary" toggle.
  - "Withdraw" → `PinBottomSheet` → `POST /wallet/withdraw` with Idempotency-Key persisted to SecureStore until the response settles.
  - Success → ReceiptScreen with the new transaction; failure modes map to user-friendly messages.
- `features/wallet/BeneficiariesScreen.js`: list of `GET /wallet/beneficiaries`, add via `POST`, delete via `DELETE`. Tap to pre-fill `WithdrawScreen` with the saved bank.
- `features/wallet/TransactionsScreen.js`: paginated list with filters (type = ALL / RIDER_EARNING / WITHDRAWAL / PAYOUT_FEE), search by reference, date range.
- `features/wallet/TransactionDetailScreen.js`: full details + ReceiptScreen export (uses `react-native-view-shot` to render a shareable image via `expo-sharing`).
- `store/slices/walletSlice.js`: port verbatim from customer-app. Already has `fetchWallet`, `retryProvisioning`, `sendMoney`, `withdraw`, `lookupBankAccount`, `subscribeToWalletSocket`. Confirm `withdraw` thunk includes Idempotency-Key.
- `store/slices/earningsSlice.js`:
  - State: `{ summary: { today, week, month, allTime }, daily: [{date, amount, count}], byRequest: { byId, allIds, page, hasMore }, status }`.
  - Thunks: `fetchEarningsSummary`, `fetchEarningsBreakdown({ page })`, `appendRiderEarningFromSocket(tx)` reducer that bumps today + adds row.
  - Subscribes to `wallet:balance:updated`: if the transaction `type === 'RIDER_EARNING'`, update earningsSlice as well as walletSlice.
- `store/slices/beneficiariesSlice.js`: standard `{byId, allIds}` list.

**RT** - confirm settlement event flow described above. No new emissions.

### 6.3 Acceptance Criteria

- ✅ Right after PATCH DELIVERED 200, settlement worker fires; `wallet:balance:updated` is received; earnings card animates `+₦` and the wallet balance increments. End-to-end latency from DELIVERED to UI animation: ≤ 60 s.
- ✅ `EarningsDashboardScreen` shows today / week / month tallies that match `GET /rider/earnings` exactly.
- ✅ Chart renders for the past 7 days; tapping a bar drills to that day's deliveries.
- ✅ `WithdrawScreen`: amount + bank + valid account number + PIN → 200 → balance decrements → Transaction PENDING → moves to COMPLETED (or FAILED with refund) per KatPay async.
- ✅ Withdraw idempotency: kill the app right after tapping Withdraw → re-open → the in-flight retry uses the same Idempotency-Key and the server returns the original response. No double-charge.
- ✅ Save a bank as beneficiary on one withdraw; the next withdraw shows that bank pre-filled.
- ✅ `TransactionsScreen` filter for `RIDER_EARNING` shows all delivery earnings; filter for `WITHDRAWAL` shows withdrawals.
- ✅ `ReceiptScreen` produces a sharable PNG that opens the device share sheet.

### 6.4 Risks

- **KatPay payout latency variability.** Mitigation: show clear "Processing" state with expected window; subscribe to `wallet:balance:updated` for the specific transaction; surface failures with reason.
- **Idempotency key not regenerated on intentional re-attempt.** Mitigation: clear the persisted key on terminal response (success or definitive failure); generate a new one if the rider edits any input.
- **Rider's NUBAN missing (KatPay never provisioned).** Mitigation: reuse the customer-app's BVN provisioning retry flow on `WalletHomeScreen`. Until provisioned, the wallet works (balance can accumulate) but withdraw is gated.

### 6.5 Demo Script

1. Complete a real delivery through Phase 5.
2. Watch earnings card animate on the cockpit; balance updates.
3. Open Wallet → see new balance; open Earnings dashboard → today shows the delivery.
4. Tap Withdraw → ₦500 → pick a sandbox bank → resolve name → PIN → success.
5. Open Transactions → see RIDER_EARNING and WITHDRAWAL rows.
6. Receipt → share to WhatsApp.

---

## Phase 7 - Notifications, Ratings, Profile, Support

> **Status: ✅ COMPLETE. Depends on: Phases 1–6.**
>
> **What shipped (2026-05-20):**
> - **Backend**
>   - New migration `20260519100000_rider_doc_expiry_and_documents`: adds `idDocExpiresAt`, `driverLicenceUrl/ExpiresAt`, `vehicleRegUrl/ExpiresAt`, `vehicleDocExpiresAt`, `insuranceDocUrl/ExpiresAt`, `lastDocExpiryNoticeAt` on `Rider`; creates `RiderOfferLog` table + `RiderOfferOutcome` enum.
>   - `RiderOfferLog` writes wired into the dispatch broadcaster (`emitRing`, persists OFFERED rows per candidate), `acceptJob` (flips to ACCEPTED + others to TAKEN inside the txn), `notifyJobTaken` (TAKEN), and `autoCancelUnmatched` (EXPIRED).
>   - `rider.service.getPerformance(userId)` - trailing-30-day acceptance / cancellation / on-time / rating breakdown + streak. 7 parallel queries; cancellation rate divides by claimed jobs; on-time tolerates 1.2× of `estimatedMinutes`; streak walks consecutive UTC days from most-recent delivery.
>   - `rider.service.reuploadDocument({ kind, url, expiresAt })` - whitelisted kinds (ID_DOC, DRIVER_LICENCE, VEHICLE_PHOTO, VEHICLE_REG, INSURANCE), Cloudinary-URL prefix check, future-expiry check, auto-mirrors `min(vehicleReg, insurance)` into `vehicleDocExpiresAt`, clears throttle marker on re-upload.
>   - `POST /rider/performance`, `POST /rider/documents`, `POST /rider/decline` (rider-initiated offer decline) - controllers + zod validators + RIDER-gated routes.
>   - `updateRiderStatus` now pushes `RIDER_APPROVED` / `RIDER_REJECTED` / `RIDER_SUSPENDED` / `RIDER_REACTIVATED` so the rider's profile gate flips without a re-launch.
>   - `auth.service.UPLOAD_KINDS.rider_doc` - RIDER+ADMIN only, user-scoped Cloudinary folder.
>   - `support.service` opened to RIDER role: `createDispute` accepts RIDER raisers (must be the assigned rider on a DELIVERED/SETTLED request); `listDisputes` returns disputes raised by OR involving the rider; `assertDisputeAccess` honours rider/customer counterparty visibility; `postDisputeMessage` notifies the rider counterparty; `adminResolveDispute` notifies the rider when they aren't the raiser.
>   - New `rider-queue` + `rider.worker.js` with `CHECK_DOC_EXPIRY` cron @ 04:00 daily - scans APPROVED riders whose docs are within 14 days of expiry or already expired, throttled by `lastDocExpiryNoticeAt` (7-day re-fire), pushes `DOC_EXPIRING_SOON` / `DOC_EXPIRED` with `route: '/kyc'`.
> - **Mobile (rider app)** - 19 new screens, 1 rebuilt:
>   - `features/notifications/NotificationsCenterScreen.js` - paginated list, pull-to-refresh, infinite scroll, mark-read on tap, mark-all CTA, deep-linked nav.
>   - `features/profile/ProfileHomeScreen.js` (rebuilt) - identity card with avatar tap-to-edit, rating + delivery chips, sections (Account / Money / Security / Preferences / Support) linking to every sub-screen.
>   - `features/profile/EditProfileScreen.js` - first/last name + DOB + address; email locked.
>   - `features/profile/ProfilePhotoScreen.js` - camera/library pick → Cloudinary (kind=profile) → `PUT /auth/profile/picture`.
>   - `features/profile/VehicleInfoScreen.js` - read-only vehicle summary; "Request change" pre-fills a support ticket.
>   - `features/profile/KycStatusScreen.js` - 5 doc tiles (Valid / Expiring soon / Expired / Missing), expiry banner, re-upload sheet with date entry + Cloudinary upload + server persist; auto-refreshes rider profile after success.
>   - `features/profile/PerformanceScreen.js` - rating panel with 5-star breakdown bars; 4 metric cards (acceptance, cancellation, on-time, streak); each card carries an "X offers in 30 days" sub-line; pull-to-refresh.
>   - `features/settings/SessionsScreen.js`, `ChangePinScreen.js`, `PhoneChangeScreen.js`, `BiometricSettingsScreen.js`, `LanguageScreen.js`, `ThemeScreen.js`, `LegalScreen.js`, `SecuritySettingsScreen.js` - full settings suite.
>   - `features/support/SupportHomeScreen.js`, `CreateTicketScreen.js`, `TicketDetailScreen.js`, `CreateDisputeScreen.js`, `DisputeDetailScreen.js`, `SupportThread.js`, `supportUploads.js` - full support stack with attachment upload via the existing Cloudinary helper (kind=ticket/dispute).
>   - `features/wallet/TransactionDetailScreen.js` extended - RIDER_EARNING receipts now show a "Report an issue with this delivery" CTA that opens `CreateDispute` with the originating `requestId`.
> - **State + wiring**
>   - `store/slices/supportSlice.js` extended: `fetchTickets/Detail`, `createTicket/FromTrip`, `postTicketMessage`, `closeTicket`, `fetchDisputes/Detail`, `createDispute`, `postDisputeMessage`, plus `clearTicketDetail`/`clearDisputeDetail`.
>   - `store/slices/profileSlice.js` extended: `updateProfile`, `updateProfilePicture`, `deleteAccount`, `fetchNotificationPreferences/update`, `fetchPerformance`, `reuploadRiderDocument`.
>   - `services/notificationsBus.js`: dispatches `fetchRiderProfile` + `fetchProfile` on RIDER_APPROVED/REJECTED/SUSPENDED/REACTIVATED so the navigation gate flips immediately.
>   - `navigation/AppNavigator.js`: 19 new stack screens registered (NotificationsCenter, EditProfile, ProfilePhoto, VehicleInfo, KycStatus, Performance, SecuritySettings, Sessions, ChangePin, PhoneChange, BiometricSettings, Language, Theme, Legal, SupportHome, CreateTicket, TicketDetail, CreateDispute, DisputeDetail).
>   - `lib/notificationRoute.js`: `/kyc`, `/performance`, `/notifications`, `/support`, `/support/dispute/*` already wired during Phase 6; verified.
>   - `i18n/en.json` + `ha.json`: added `profile.*`, `vehicleInfo.*`, `kyc.*`, `performance.*` blocks; existing `support.*`, `changePin.*`, `phoneChange.*`, `sessions.*`, `security.*`, `legal.*`, `notificationCenter.*` keys reused.
> - **Verification**
>   - All 38 touched files (28 frontend + 12 backend; 1 frontend file double-listed) parse clean via Babel/Node.
>   - `prisma validate` ✓ - schema syntactically valid; migration is purely additive (forward-only safe).
>   - i18n `JSON.parse` ✓ for both en + ha.

### 7.1 Goals

A fully-furnished "Me" tab and notification center. Every notification the backend emits to a rider routes correctly; the rider can review and adjust their profile and vehicle info, see their performance numbers, re-upload expiring documents, raise tickets and disputes, change PIN/phone/language/theme, manage sessions, and access legal docs.

### 7.2 Tasks

**BE**
- 🔒 **BLK-PerformanceEndpoint.** `GET /rider/performance` returning:
  - `acceptanceRate` (last 30 days), `cancellationRate`, `onTimeRate`, `totalDeliveries`, `rating: { average, count, breakdown: { 5,4,3,2,1 } }`, `currentStreakDays`.
  - All metrics computed server-side from `Request` history + `Rating` rows.
- 🔒 **BLK-DocExpiry.** Add `idDocExpiresAt DateTime?`, `vehicleDocExpiresAt DateTime?` to `Rider`. Cron worker that pushes `notification:new type=DOC_EXPIRING_SOON` 14 days before expiry. New endpoint `POST /rider/documents` for re-upload.
- 🔒 **BLK-RatingAggregate.** Confirm `Rating` rows aggregate into `Rider.averageRating` and that `GET /rider/performance` exposes the breakdown.
- Confirm `GET /notifications` returns paginated notifications filtered by user; `notification:new` already received via socket.
- Confirm `GET/POST /support/tickets` and `POST /support/disputes` work for RIDER role.

**DB** - `add_doc_expiry_to_rider` migration (BLK-DocExpiry).

**RA**
- `features/notifications/NotificationsCenterScreen.js`: paginated list, unread badge, mark-read on view, deep-link buttons that route to relevant screen (offer / trip / wallet tx / support thread).
- `features/profile/ProfileHomeScreen.js`: avatar, name, vehicle summary, rating + total deliveries, links to all sub-screens.
- `features/profile/EditProfileScreen.js`: name, profile photo (via `expo-image-picker`).
- `features/profile/VehicleInfoScreen.js`: read-only after approval. A "Request change" CTA opens a pre-filled support ticket of type `VEHICLE_CHANGE` (admin must approve out-of-band before the rider can re-upload).
- `features/profile/KycStatusScreen.js`:
  - Five document tiles, each with thumbnail + expiry chip (where applicable) + status (Valid / Expiring soon / Expired / Missing): NIN slip, driver's licence, vehicle registration, insurance certificate, vehicle photo.
  - NIN tile shows verified state (no expiry).
  - Each non-NIN tile has a "Re-upload" CTA → Cloudinary signed upload → `POST /rider/documents` with the doc kind.
  - Expiry-warning banner when any doc is within 14 days of expiry; hard banner with "Re-upload to keep working" when any doc has expired.
  - Deep-linked from `DOC_EXPIRING_SOON` notification and the 30-day grace banner that fires for accounts migrated under BLK-RiderKycExpansion's backfill.
- `features/profile/PerformanceScreen.js`:
  - Cards for each metric (acceptance, cancellation, on-time, rating).
  - Rating bar chart showing 5★/4★/3★/2★/1★ breakdown.
  - Trailing-30-day streak indicator.
  - Hook for `riderSlice.fetchPerformance` (calls `GET /rider/performance`).
- `features/profile/SessionsScreen.js`: port verbatim from customer.
- `features/profile/ChangePinScreen.js`: port verbatim.
- `features/profile/PhoneChangeScreen.js`: port verbatim.
- `features/profile/BiometricSettingsScreen.js`: toggles `biometricEnabled` flag; re-authenticates on enable.
- `features/profile/LanguageScreen.js`: en / ha; flips i18n.
- `features/profile/ThemeScreen.js`: system / light / dark.
- `features/profile/LegalScreen.js`: Terms, Privacy, About; uses `expo-web-browser`.
- `features/support/SupportHomeScreen.js`: list tabs Tickets / Disputes / FAQ. Each row shows status badge.
- `features/support/CreateTicketScreen.js`: subject + category picker (BILLING, ACCOUNT, BUG, OTHER) + message + optional attachment.
- `features/support/TicketDetailScreen.js`: thread; post message; close ticket.
- `features/support/CreateDisputeScreen.js`: target a recent delivered request, dispute reason, evidence.
- `features/support/DisputeDetailScreen.js`: thread + status.
- `features/settings/SecuritySettingsScreen.js`: PIN settings, biometric, sessions, account deletion (`DELETE /auth/account`).
- `store/slices/notificationsSlice.js`: port verbatim from customer with the addition of routing for rider-specific types (`RIDER_NEW_OFFER`, `RIDER_APPROVED`, `RIDER_REJECTED`, `POD_OTP_GENERATED`, `DOC_EXPIRING_SOON`, `SYSTEM_FORCE_OFFLINE`).
- `store/slices/supportSlice.js`: port verbatim.
- `store/slices/profileSlice.js`: extend with `fetchPerformance` thunk.
- Update `lib/notificationRoute.js` with rider-specific deep-link routes.

**RT** - confirm `notification:new` already routes through `notificationsBus.js` into `notificationsSlice`.

### 7.3 Acceptance Criteria

- ✅ Every notification type the backend can send to a rider has a routing entry that lands on the correct screen.
- ✅ Performance screen renders with live data from `/rider/performance` (or zero values when BLK is pending).
- ✅ Re-uploading an expiring document succeeds and updates the expiry.
- ✅ Filing a ticket from `CreateTicketScreen` appears in admin's support dashboard.
- ✅ Filing a dispute on a delivered request creates an audit-trail row visible to admin + customer.
- ✅ Changing language to Hausa swaps every visible string.
- ✅ Revoking another session from `SessionsScreen` invalidates that session's tokens on next API call.
- ✅ Deleting the account from `SecuritySettingsScreen` requires confirmation, hits `DELETE /auth/account`, force-logs out.

### 7.4 Risks

- **Performance endpoint cost.** Aggregating acceptance/cancellation/on-time across all riders per request can be expensive. Mitigation: nightly materialization into a `RiderMetricsDaily` table; endpoint reads from materialization + adds the in-flight day on-the-fly.
- **Rating system fairness.** Customer-rated only; no rider counter-rating in v1. Mitigation: document this in legal/FAQ; the dispute flow is the safety valve.
- **Doc-expiry false positives** (e.g. rider re-uploads but cron uses stale data). Mitigation: cron checks within a 24 h window only; new uploads bump `expiresAt` immediately.

### 7.5 Demo Script

1. Open Me tab → see profile, performance numbers, rating.
2. Open NotificationsCenter → tap a delivered request notification → routes to delivery detail.
3. Tap "Re-upload ID" on KycStatus → upload a new photo → expiry updates.
4. Create a support ticket → see it in admin support page.
5. Switch language to Hausa → entire UI flips.
6. Revoke another session → that session's API calls return 401.

---

## Phase 8 - Hardening, Polish, Launch

> **Status: ✅ COMPLETE (engineering). Depends on: Phases 0–7.**
>
> **What shipped (2026-05-20):**
> - **Observability**
>   - `src/services/sentry.js` - no-op stub mirroring the customer-app pattern; safe to ship without `@sentry/react-native` installed. Real impl is a 1-file swap-in once the SDK is added (template inline). Init'd from `App.js`; user tagging fired from `AppNavigator` on auth changes; root `ErrorBoundary` calls `captureError` before showing the fallback.
>   - `src/lib/analytics.js` - `track(event, props)` helper with a centralized `EVENTS` catalog covering lifecycle, auth, availability, offers, trip, POD, wallet, support, KYC, profile, and errors. Dev builds log to the console; real provider wire-up is a 1-file change.
>   - `EXPO_PUBLIC_SENTRY_ENVIRONMENT` configured in `eas.json` for dev / staging / production profiles.
> - **Connectivity**
>   - `src/services/connectivity.js` fuses socket-disconnect events and api network errors into a single boolean. Exposes `useConnectivity()` hook + imperative `markOnline/markOffline`.
>   - `src/components/OfflineBanner.js` - global strip rendered above the NavigationContainer in `ThemedRoot`. Hidden when online; shows "You're offline - actions will retry when you reconnect." with appropriate `accessibilityLiveRegion`.
>   - `api.js` interceptor calls `markOffline('api-network-error')` on network-level failures (no `error.response`) and `markOnline()` on the next successful response.
> - **Release configuration**
>   - `app.json`: `jsEngine: "hermes"`, `userInterfaceStyle: "automatic"`, `ios.buildNumber: "1"`, `android.versionCode: 1`, `ios.associatedDomains: ["applinks:rider.iprime.ng"]`, `android.intentFilters` for `https://rider.iprime.ng`.
>   - `eas.json`: development / preview / production profiles each with their own `channel` (development / staging / production), `EXPO_PUBLIC_SENTRY_ENVIRONMENT`, `autoIncrement: true` on production, iOS `appleTeamId` / `ascAppId` placeholders, and `submit.production.android.releaseStatus: draft` for safer initial uploads.
>   - `babel.config.js` strips `console.*` (excluding `error`/`warn`) when `NODE_ENV=production` via `babel-plugin-transform-remove-console` (added to `devDependencies`).
> - **Deep-link completeness**
>   - `NAV_LINKING.prefixes` extended to `["iprime://", "https://rider.iprime.ng", "riderapp://"]` (legacy for back-compat with pre-rebrand notifications).
>   - `NAV_LINKING.config.screens` now exhaustively maps every reachable stack screen: wallet sub-tree, earnings, notifications, KYC, performance, profile, security, sessions, change-PIN, phone change, biometric, language, theme, legal, support home + ticket / dispute detail + create flows.
>   - `lib/notificationRoute.parseDeepLink` already strips any scheme before matching - `riderapp://`, `iprime://`, and `https://rider.iprime.ng/*` all resolve via the same code path; verified by `__tests__/lib/notificationRoute.test.js`.
> - **Testing**
>   - `package.json` adds `jest`, `jest-expo`, `@testing-library/react-native`, `@testing-library/jest-native`, `babel-plugin-transform-remove-console`; embedded `jest` config uses `jest-expo` preset with `transformIgnorePatterns` covering RN/Expo/Redux/NativeWind, and a `__mocks__/fileMock.js` for static assets.
>   - 7 test files / 50+ assertions in `__tests__/`:
>     - `lib/formatters.test.js`, `lib/time.test.js`, `lib/polyline.test.js` - pure utilities.
>     - `lib/notificationRoute.test.js` - string forms, payload forms, deep-link parsing across iprime:// + riderapp:// + universal links.
>     - `store/notificationsSlice.test.js` - receive/dedupe, fetch happy & rejected, mark-read, mark-all-read, reset.
>     - `store/earningsSlice.test.js` - socket dedup against fetched rows, 50-entry log cap, paginated append dedup, error path.
>     - `store/offersSlice.test.js` - enqueue / reject / take / expire / accept-thunk fulfilled/409/410/500 paths; mocks the socket service for isolation.
>   - Scripts: `npm test`, `npm run test:watch`, `npm run test:ci`.
> - **Maestro E2E (`mobile/rider-app/.maestro/`)**
>   - 8 YAML flows mapped to the QA matrix: login + online, accept + deliver, POD photo + OTP, withdraw with PIN, force-offline, Hausa language switch, offer expiry, offer race lost.
>   - Helper shell scripts (`trigger-force-offline.sh`, `simulate-offer-race.sh`) document the staging API touch-points and the env vars (`ADMIN_TOKEN`, `SIBLING_RIDER_TOKEN`, `RIDER_ID`) the Maestro Cloud secret store must hold.
>   - `.maestro/README.md` covers local + CI runs, test data conventions, and the flow-to-QA-matrix mapping.
> - **Launch docs**
>   - `QA_SCENARIOS.md` - 20-row manual QA matrix with Maestro-automation flags, performance gates (cold start < 3s, bundle < 6MB), crash-free target (99.5%), beta delivery-completion target (95%), and a clear release-blocker definition.
>   - `RUNBOOKS.md` - seven runbooks: rider-can't-go-online troubleshooting, OTA publish, production rollout (Play + App Store staged), force-cancel an active trip, OTA + native binary rollback, on-call escalation for region-wide offer push failures, and staging/test-data quirks.
>   - `src/i18n/HAUSA_REVIEW.md` - section-by-section checklist for the native-Hausa review, inheriting the customer-app's conventions and adding rider-specific sections (onboarding, offers, trip, POD, earnings, KYC, performance, support, security, offline).
> - **Misc**
>   - `offline.banner` / `offline.bannerRetry` keys added to `en.json` + `ha.json`.
>   - `AppNavigator.NAV_LINKING.prefixes` accepts the legacy `riderapp://` scheme so notifications minted pre-iprime rebrand still parse.
>
> **Engineering acceptance criteria met** (per §8.3):
> - ✅ Unit tests written (Jest + RTL deps wired; 50+ assertions across utilities and slices).
> - ✅ 8 Maestro flows authored mapped to the QA matrix.
> - ✅ Hausa review checklist published with rider-specific section coverage.
> - ✅ Sentry stub + analytics catalog in place; SDK + provider wire-up is a documented 1-file change.
> - ✅ Hermes enabled; console-strip in production; bundle-size measurable via `expo export --dump-sourcemap`.
> - ✅ Deep linking exhaustive; legacy scheme back-compat preserved.
>
> **Human-blocker acceptance criteria** (require physical devices / external systems):
> - ⏳ All 20 QA matrix scenarios run on a physical Android + iOS device.
> - ⏳ Maestro Cloud green on the EAS preview build for the release candidate.
> - ⏳ Sentry 24h soak shows zero severe issues.
> - ⏳ Native-speaker Hausa review signed off; `_meta.reviewedAt` stamped on `ha.json`.
> - ⏳ Play Internal + TestFlight builds accepted by the stores.
> - ⏳ Beta with ≥20 active riders for ≥7 days at ≥99.5% crash-free + ≥95% delivery-completion.

### 8.1 Goals

The app is ready for the store. Every screen has loading / empty / error / offline states. Crash-free sessions are tracked. Hausa is reviewed by a native speaker. Performance budgets are hit. The app survives a beta of ≥ 20 riders for ≥ 7 days at ≥ 99.5 % crash-free.

### 8.2 Tasks

**RA - UI hardening**
- Sweep every screen and ensure these states render correctly:
  - **Loading**: `SkeletonLoader` for lists, spinner overlay for forms.
  - **Empty**: `EmptyState` with helpful copy + primary action.
  - **Error**: `ErrorState` with retry + support link.
  - **Offline**: a global banner at the top of the navigator when `networkDetect.isConnected === false`; surfaces queued operations count.
- Replace any `Alert.alert` with toast or sheet equivalents (mirror customer-app rule).
- Verify every `api.<verb>` path starts with `/` (ESLint rule enforces; CI fails otherwise).

**RA - Deep-link coverage**
- `iprime://offer/:id` → `JobOfferScreen` if offer is still valid in `offersSlice.queue`; else show `JobMissedScreen`.
- `iprime://trip/:id` → `TripCockpitScreen` if the rider is the assigned rider.
- `iprime://earnings` → `EarningsDashboardScreen`.
- `iprime://wallet` → `WalletHomeScreen`; `iprime://wallet/withdraw` → `WithdrawScreen`.
- `iprime://support/:ticketId` → `TicketDetailScreen`.
- Universal links: `https://rider.iprime.ng/*` mapped equivalently. Legacy `riderapp://` URLs still parse for back-compat (pre-Phase-10 notifications).

**RA - Accessibility**
- Tap targets ≥ 44 px.
- Color contrast ≥ AA across all themes.
- Screen-reader labels for every action button, especially `StatusActionButton` (announce the action it will perform).
- Reduced-motion: collapse offer ring animation to a numeric countdown when the OS flag is set.
- Dynamic type respected on iOS up to large (3 sizes above default).

**RA - Performance**
- Cold start (mid-range Android, e.g. Tecno Spark) < 3 s.
- Map first frame on `TripCockpitScreen` < 1 s.
- JS bundle ≤ 6 MB (uncompressed). Verify with `expo export --dump-sourcemap`.
- No console.log in production (Babel plugin strips on production profile).
- Memoize expensive lists (`React.memo`, `useMemo` for derived arrays).
- Hermes JIT confirmed enabled.

**RA - Testing** (all written in this phase per the cross-phase test policy)
- **Unit tests (Jest)**: every reducer / selector in `store/slices/*` has at least the happy path and one error path. Pure utilities (`formatters`, `validators`, `polyline`, `requestStatus`, `time`) are tested. Coverage target: 70 % statements on `store/` and `lib/`.
- **Component tests (RN Testing Library)**: `PinBottomSheet`, `JobOfferSheet`, `StatusActionButton`, `WithdrawScreen` interactive paths.
- **E2E tests (Maestro)**: YAML flows in `mobile/rider-app/.maestro/`, run via Maestro Cloud in CI on the EAS preview build. Covers the golden flows of the Manual QA Scenario Matrix below. Flow files:
  - `01-login-and-go-online.yaml`
  - `02-accept-offer-and-deliver.yaml`
  - `03-pod-photo-and-otp.yaml`
  - `04-withdraw-with-pin.yaml`
  - `05-force-offline-from-admin.yaml`
  - `06-language-switch-hausa.yaml`
  - `07-offer-expire.yaml`
  - `08-offer-race-lost.yaml`
- **Manual QA Scenario Matrix** in `mobile/rider-app/QA_SCENARIOS.md` (Maestro flows above cover rows 1, 2, 3, 11, 12, 17, plus expiry and race; rows 4–10, 13–16 stay manual because they need OS-level interactions or hardware state Maestro can't easily induce):

| # | Scenario | Pre-conditions | Steps | Expected |
|---|---|---|---|---|
| 1 | Happy path delivery | Approved rider, online, customer request available | Accept → travel to pickup → confirm pickup → travel to dropoff → POD photo → DELIVERED | Wallet credited; admin + merchant + customer reflect status updates |
| 2 | Offer expires | Rider receives offer | Wait 60 s without action | Sheet dismisses; offer_expired emitted; acceptance-rate stat decrements |
| 3 | Accept after race lost | Two riders, same offer | Both tap Accept within 200 ms of each other | One gets 200; other gets 409 OFFER_TAKEN; correct toasts on each |
| 4 | Mid-trip force-close | Active trip on RIDER_EN_ROUTE | Force-stop app from Android Settings; relaunch within 30 s | Cockpit re-hydrates from server; GPS resumes from foreground watchPositionAsync |
| 5 | Network loss between statuses | Active trip; toggle airplane mode | PATCH RIDER_EN_ROUTE during loss | Local state advances; on reconnect, queued PATCH retries with same key |
| 6 | POD photo upload fails | Active trip at dropoff | Simulate 3 consecutive Cloudinary 5xx | Three retries with backoff; on final failure, "Try again" CTA; trip stays IN_TRANSIT |
| 7 | OTP mismatch on high-value | ₦80 000 request at dropoff | Enter wrong OTP twice | 422 POD_OTP_MISMATCH both times; third correct attempt → DELIVERED |
| 8 | Customer no-show | At dropoff geofence | Call customer 3× with no answer | After 3rd call: auto-file CUSTOMER_UNREACHABLE ticket (BLK-SupportAutoTicket); else manual ticket |
| 9 | Low signal pickup | Airport / underground at pickup | Walk into geofence with sparse GPS | Fallback fence triggers after 5 min in 150 m radius; manual "Arrived" button still works |
| 10 | Admin force-cancel | Active trip | Admin clicks Force Cancel | Rider gets non-dismissible sheet; cockpit closes; availability returns to ONLINE |
| 11 | Withdraw idempotency | Pending withdraw | Kill app immediately after tap | On relaunch, retry uses same key; server returns original response; no double-charge |
| 12 | Force-offline | ONLINE rider | Admin invokes force-offline | Rider's app flips OFFLINE within 3 s; persistent notif clears |
| 13 | Doc expiry warning | Rider with id-doc expiring in 12 days | Cron fires DOC_EXPIRING_SOON | Notification arrives; tap → KycStatusScreen with re-upload CTA |
| 14 | Battery throttle | Battery falls below 20 % during shift | Continue working | Cadence drops to 30 s; toast shown once; stream continues |
| 15 | Permission revoke | ONLINE rider | Revoke location from system settings | LocationServicesEnabledBanner appears; stream stops cleanly; toggling re-prompts permission |
| 16 | Screen-off mid-shift | ONLINE rider | Press power button to sleep screen for 30 s | `useKeepAwake` prevents OS sleep while ONLINE; stream uninterrupted |
| 17 | Hausa parity | Switch language to Hausa | Walk through every primary screen | All strings translated; no English fallback visible |

**RA - i18n**
- Native-Hausa review of `ha.json`. Track in `mobile/rider-app/i18n/HAUSA_REVIEW.md` mirroring customer-app's review file.
- All user-visible strings go through `t(...)`; ESLint rule to block raw string literals in JSX (mirror customer-app's setup if it exists).

**RA - Observability**
- Sentry init in `services/sentry.js`. Tags: `role=RIDER`, `riderId`, `appVersion`. Breadcrumbs around: socket connect/disconnect, offer received/accepted/rejected/expired, status patch attempts (with idempotencyKey), GPS task start/stop, withdrawal lifecycle.
- Analytics events catalog in `lib/analytics.js` with a single `track(event, props)` helper. Catalog (table in §5.3) - at minimum the events listed.
- Error boundary catches root-level renders and reports to Sentry.

**RA - Store readiness**
- Icons + splash at all required resolutions (assets already present; ensure they match brand colors).
- Privacy policy URL, data-safety form (Play Store), App Privacy form (App Store).
- `app.json` `version`, `android.versionCode`, `ios.buildNumber` strategy.
- EAS production profile: app-bundle for Play, IPA for App Store Connect.
- Staged rollout: Play 10 % → 25 % → 50 % → 100 % over 7–10 days; monitor Sentry crash-free + analytics.

**RA - OTA**
- `expo-updates` configured with channels: `development`, `staging`, `production`.
- `runtimeVersion` policy: `appVersion` (binds OTA to native build version).
- Documentation: when an OTA breaks, the rider can force-recover by reinstalling.

**RA - Runbooks** (created in `mobile/rider-app/RUNBOOKS.md`)
- "Rider can't go online" troubleshooting playbook for support.
- "How to publish an OTA" step-by-step.
- "Production rollout / rollback" procedure.
- "On-call escalation" - what to do when offer push delivery fails for a region.

**BE / DB / RT** - no new work this phase except confirming that the analytics events the rider emits don't require server-side endpoints (they go straight to Sentry/whatever analytics platform is chosen).

### 8.3 Acceptance Criteria

- ✅ All scenarios in the Manual QA Matrix pass on a physical Android and a physical iOS device.
- ✅ Jest + RTL unit/component tests pass in CI; coverage thresholds met.
- ✅ Maestro flows (8 listed in §8.2) run green in Maestro Cloud against the EAS preview build.
- ✅ Sentry sees zero severe issues in a 24 h soak.
- ✅ Cold start measured on a Tecno Spark or equivalent: < 3 s.
- ✅ Bundle size under 6 MB.
- ✅ Hausa review complete and signed off in `HAUSA_REVIEW.md`.
- ✅ Both stores accept the build for internal/beta release.
- ✅ Beta with ≥ 20 active riders over 7 days hits ≥ 99.5 % crash-free + ≥ 95 % delivery completion rate.

### 8.4 Risks

- **OEM-specific killer behavior** continues to surprise. Mitigation: include the "Improve reliability" CTA prominently; track OEM-specific session length in analytics.
- **Hausa translation drift** as new strings land in later patches. Mitigation: pre-commit hook flags new `t(...)` keys missing from `ha.json`.
- **Store review rejection** for location permission misuse. Mitigation: foreground-only declaration is straightforward to defend; clear in-app rationale screen during onboarding; privacy policy explains data use. Re-evaluate if v2 adds background location.

### 8.5 Demo Script

1. Run the full QA matrix on Android + iOS.
2. Force a crash from the debug menu → confirm Sentry alert.
3. Roll an OTA → confirm rider sees the update notice on next foreground.
4. Build & submit to Play Internal Testing track.

---

## Phase 9 - Future / V2 (parked)

> **Status: ⏸ Deferred.**

The following are explicitly post-v1 and tracked here so they don't sneak into earlier phases.

- **Background location streaming + foreground service.** The biggest known UX limitation of v1: the rider must keep the app foregrounded with the screen on during a shift (see §2.7). When the platform graduates from "screen-on" to "pocket the phone", we add `expo-task-manager` + Android foreground service + iOS `UIBackgroundModes: ["location"]`, switch the dev workflow to a custom EAS dev client, and add the `ACCESS_BACKGROUND_LOCATION` / `FOREGROUND_SERVICE_LOCATION` / `NSLocationAlwaysAndWhenInUseUsageDescription` declarations. The data model, matching algorithm, and socket contract are unchanged - this is purely additive on the client.
- **Auto-payouts on schedule.** Daily / weekly cron settles into the rider's preferred bank without manual withdraw. Requires a payout scheduling table + cron + KYC tier rules.
- **Surge / incentive engine.** Dynamic per-request bonuses based on demand, distance, weather, time-of-day. Requires a pricing strategy service backed by historical data.
- **Rider tiers & zones.** Bronze / Silver / Gold with different priority in the matcher. Per-zone specialisation (e.g. only certain riders can carry pharmacy).
- **Scheduled availability windows.** Recurring "Mon–Fri 9–5" so the matcher can plan ahead and the rider can plan their day.
- **Fleet operator portal.** A web dashboard for fleet owners with consolidated earnings, document tracking, and remote on/off control.
- **Twilio voice masking.** Proxy phone numbers so neither party sees the other's real number. Adds a per-call recording for dispute resolution.
- **Batch / multi-stop deliveries.** Pick up two orders going to nearby dropoffs in one route. Changes the offer + cockpit UX significantly.
- **Route optimisation.** Real-time turn-by-turn nav embedded in the app instead of deep-link out. Possibly via Mapbox.
- **Off-duty fuel & maintenance log.** Lets the rider track expenses against earnings for tax/income purposes.
- **Savings / loan features.** Super-app expansion - rider can save a portion of each earning into a yield-bearing wallet; eligible for small instant loans against future earnings.
- **Customer app Maestro alignment.** When the customer app reaches its Phase 10 and stands up E2E tests, ensure both apps are on Maestro (not Detox, despite what `CUSTOMER_APP_ROADMAP.md` currently names) and share a `.maestro/` flow-fragment library where possible.

---

## §4 Design System & UI Inventory

### 4.1 Brand & Tokens

The rider app uses the **same brand and tokens as the customer app**: primary `#EA580C` (orange-600), secondary `#09090b`, background `#FAFAFA`, surface `#FFFFFF`, category palette identical. Light + dark mode supported via `ThemeProvider`, persisted to SecureStore under `theme:mode`.

The decision to share the brand color is explicit: the apps belong to one platform, so their visual identity should be unified. Riders and customers may both work in the same household and we don't want to imply they're different products.

### 4.2 Component Inventory

| Component | Purpose | Reused from customer? | Notes |
|---|---|---|---|
| `FormInput` | Labelled text/password input with error state | ✅ verbatim | Brand focus color |
| `PinBottomSheet` | 6-digit PIN entry with lockout | ✅ verbatim | Server-truthful lockout |
| `AppBottomSheet` | Animated sheet primitive | ✅ verbatim | `@gorhom/bottom-sheet` based |
| `EmptyState` | Empty list/state UI | ✅ verbatim | |
| `ErrorState` | Error UI w/ retry | ✅ verbatim | |
| `SkeletonLoader` | Loading placeholders | ✅ verbatim | |
| `BackgroundPattern` | App-wide background motif | ✅ verbatim | |
| `SocialAuthButton` | Third-party auth (unused in v1) | ✅ verbatim | |
| `ThemeSheet` | Theme switcher | ✅ verbatim | |
| `LocaleSheet` | Language switcher | ✅ verbatim | |
| `toastShared` | Toast config + InModalToast | ✅ verbatim | |
| `JobOfferSheet` | Full-screen offer overlay | ❌ new | Hosts countdown ring + map + actions |
| `OfferCountdownRing` | 60 s animated ring | ❌ new | react-native-svg |
| `OfferMapPreview` | Static pickup→dropoff preview | ❌ new | `MapStack` wrapper |
| `StatusActionButton` | State-driven primary action | ❌ new | Drives PATCH /requests/:id/status |
| `EtaBanner` | Live ETA chip | ❌ new | |
| `PickupCard` / `DropoffCard` | Trip address cards | ❌ new | |
| `ContactPartiesSheet` | Call + chat hub | ❌ new | Phone CTA + ChatThread |
| `ChatThread` | Chat list & composer | ❌ new | Reuses `/requests/:id/messages` |
| `PodCaptureSheet` | Camera shutter for POD | ❌ new | expo-camera |
| `SignaturePadSheet` | Drawing pad for signature | ❌ new | react-native-signature-canvas |
| `DeliveryOtpInputSheet` | High-value OTP input | ❌ new | |
| `EarningsCard` | Today / week / month strip | ❌ new | |
| `EarningsChart` | 7-day bar chart | ❌ new | react-native-svg |
| `WithdrawSheet` | Withdrawal flow | ⚠ adapted | Ported from customer with copy changes |
| `AvailabilityToggle` | ONLINE/OFFLINE pill | ❌ new | Large, prominent |
| `MapStack` | Branded MapView wrapper | ❌ new | Consistent map styling |

### 4.3 Nativewind Conventions

Identical to customer app:
- `className` strings only; no inline `style` objects unless animating.
- Brand color access via `bg-primary-600`, `text-primary-600`, etc. (aliased in `tailwind.config.js`).
- Spacing scale: `p-4` = 16 px, `gap-2` = 8 px, `rounded-2xl` for cards.
- Dark mode via `dark:` variants tied to `useTheme().isDark`.

Rider-specific addition: any surface that is part of an **active trip** uses a brand-tinted top accent (`bg-primary-50` light / `bg-primary-950` dark) so the rider always knows they're on the clock at a glance.

---

## §5 Cross-Cutting

### 5.1 Permissions Matrix

| Permission | Android | iOS | When requested | Required for | Fallback UX |
|---|---|---|---|---|---|
| Fine location | `ACCESS_FINE_LOCATION` | `NSLocationWhenInUseUsageDescription` | First time tapping "Go Online" | Phase 2 streaming | Hard block - cannot go online without it |
| Notifications | `POST_NOTIFICATIONS` (Android 13+) | UNAuthorization | First successful login | All push & offer wake | Soft block - degrade to in-app socket only; surface "Enable notifications" CTA on Home |
| Camera | `CAMERA` | `NSCameraUsageDescription` | First POD capture | Phase 5 | Hard block at dropoff - must enable to deliver |
| Photo library write (optional) | `READ_MEDIA_IMAGES` / `WRITE_EXTERNAL_STORAGE` | `NSPhotoLibraryAddUsageDescription` | Toggling "Save POD to gallery" in settings | Optional save | Skip silently if denied |
| Biometric | uses-feature `USE_BIOMETRIC` | `NSFaceIDUsageDescription` | First enable in onboarding or settings | App-shell unlock | Allow PIN-only |
| Vibration | `VIBRATE` | n/a (no permission needed) | install | Offer haptics | n/a |

### 5.2 Testing Strategy

**Unit (Jest)**
- All redux slices and selectors.
- Pure utilities (`formatters`, `validators`, `polyline`, `requestStatus`, `time`).
- Coverage threshold: 70 % statements on `store/` and `lib/`.

**Component (React Native Testing Library)**
- `PinBottomSheet`: enters PIN, handles lockout countdown.
- `JobOfferSheet`: countdown ticks; Accept/Reject actions dispatch correctly; race-lost branch.
- `StatusActionButton`: label changes correctly across `tripSlice.status` transitions.
- `WithdrawScreen`: validates min/max; bank lookup updates account name; PIN sheet opens on submit.

**Manual QA Scenario Matrix**
The matrix in §8.2 above is the source of truth. Each row is checked on:
- Physical Android (mid-range - Tecno Spark / Infinix Hot or equivalent).
- Physical iOS (iPhone 12 or newer).
- Both Wi-Fi and 4G cellular.
- Both light and dark mode.
- Both English and Hausa locales.

**E2E (Maestro)**
Maestro YAML flows in `.maestro/` run in CI against EAS preview builds via Maestro Cloud. Chosen over Detox for: declarative YAML (vs. JS+`await`), single flow runs Android + iOS unmodified, works on Expo managed against EAS preview/production builds (no dev-client required in dev - Expo Go covers that), Maestro Studio records flows by tapping through the app. **Written in this phase**, not earlier, per the cross-phase test policy. When the customer app's Phase 10 lands, both apps should be on Maestro for cohesiveness.

### 5.3 Observability

#### Sentry breadcrumbs

| Breadcrumb category | Triggered on |
|---|---|
| `socket` | `connect`, `disconnect`, `reconnect`, `auth_error` |
| `offer` | `received`, `accept_tap`, `accept_success`, `accept_409`, `reject`, `expire`, `taken` |
| `trip` | `accepted`, `patch_status_attempt`, `patch_status_success`, `patch_status_error`, `geofence_enter_pickup`, `geofence_enter_dropoff`, `cancel` |
| `location` | `task_start`, `task_stop`, `permission_denied`, `permission_revoked`, `battery_throttle` |
| `pod` | `photo_captured`, `signature_captured`, `otp_generated`, `otp_mismatch`, `upload_attempt`, `upload_success`, `upload_failure` |
| `wallet` | `withdraw_initiated`, `withdraw_success`, `withdraw_failed`, `pin_locked` |
| `auth` | `login`, `logout`, `refresh`, `bio_pass`, `bio_fail` |

Sentry tags: `role=RIDER`, `riderId`, `appVersion`, `osVersion`, `deviceModel`.

#### Analytics events catalog (`lib/analytics.js`)

| Event | Properties | When emitted |
|---|---|---|
| `app_cold_start_ms` | `ms`, `route` | First interactive frame after cold start |
| `availability_toggled` | `from`, `to`, `reason?` | Rider toggles ONLINE/OFFLINE or force-offline |
| `offer_received` | `requestId`, `distanceKm`, `fare` | `rider:job:new` arrives |
| `offer_accepted_ms` | `requestId`, `ms` (since received) | Accept HTTP 200 |
| `offer_rejected` | `requestId`, `reasonCategory?` | Reject tapped |
| `offer_expired` | `requestId` | 60 s elapses |
| `offer_taken_lost` | `requestId` | 409 OFFER_TAKEN |
| `trip_started` | `requestId` | RIDER_EN_ROUTE PATCH success |
| `pickup_arrival_distance` | `requestId`, `meters` | Geofence enter at pickup (logs how close GPS was) |
| `pickup_completed` | `requestId`, `minutesSinceAccept` | PICKED_UP PATCH success |
| `dropoff_arrival_distance` | `requestId`, `meters` | Geofence enter at dropoff |
| `delivery_complete_duration` | `requestId`, `minutesSinceAccept` | DELIVERED PATCH success |
| `pod_uploaded` | `requestId`, `kind` ("photo"\|"signature"), `bytes`, `attempts` | Cloudinary upload success |
| `withdraw_initiated` | `amount`, `bankCode` | Withdraw form submit |
| `withdraw_success` | `amount`, `transactionId`, `latencyMs` | Server confirms |
| `withdraw_failed` | `amount`, `code` | Server returns non-2xx terminal |
| `force_offline_received` | `reason?` | `SYSTEM_FORCE_OFFLINE` received |
| `chat_message_sent` | `requestId`, `length` | rider posts message |
| `support_ticket_created` | `category` | rider opens new ticket |
| `dispute_filed` | `requestId`, `reasonCategory` | rider opens dispute |

### 5.4 Backend Extensions Required (BLK list)

| ID | What | Why | Blocks phase | Effort |
|---|---|---|---|---|
| **BLK-POD** | Add `Request.podPhotoUrl / podSignatureUrl / podDeliveryOtp / podCapturedAt`; `POST /requests/:id/pod-otp/generate`; settings `delivery.requirePodPhoto`, `delivery.requireSignature`, `delivery.podOtpThresholdNgn`. | Dispute defense; high-value verification | Phase 5 (MVP gate) | M |
| BLK-PushOnApproval | Send FCM push + `notification:new` (type `RIDER_APPROVED` / `RIDER_REJECTED`) when admin approves / rejects a rider. | Reduce post-application limbo | Phase 1 (degrades to polling) | S |
| BLK-PerformanceEndpoint | `GET /rider/performance` returning acceptance / cancellation / on-time / rating breakdown / streak. | Rider transparency + self-correction | Phase 7 | M |
| **BLK-RiderKycExpansion** | Expand `Rider` KYC depth: add `driverLicenseNumber/Url/ExpiresAt`, `vehicleRegistrationUrl/ExpiresAt`, `insuranceCertificateUrl/ExpiresAt`, `idDocExpiresAt`, `vehiclePhotoExpiresAt`. Migration `expand_rider_kyc_documents` with 30-day grace backfill. `POST /rider/documents` accepts the new kinds. Cron pushes `DOC_EXPIRING_SOON` 14 days out. **Supersedes the prior BLK-DocExpiry.** | Legal exposure: current KYC depth (NIN slip + vehicle photo) is too thin for commercial rider liability after a real-world incident | Phase 1 (onboarding) + Phase 7 (re-upload) | M |
| BLK-Beneficiaries | Confirm `GET/POST/DELETE /wallet/beneficiaries` allow RIDER. | Speed up repeat withdrawals | Phase 6 | XS |
| BLK-SupportAutoTicket | System-generated ticket type `CUSTOMER_UNREACHABLE` after 3 failed call attempts. | Dispatch escalation | Phase 4 (fallback: manual ticket) | S |
| BLK-AddressCorrection | `POST /requests/:id/address-correction { stage, note, lat, lng }`. | Field-truth corrections | Phase 4 (fallback: support ticket) | S |
| BLK-OfferAck | Decision-only: HTTP `POST /rider/accept` is authoritative; socket emit decorative. Document in `docs/SOCKET_ARCHITECTURE.md`. | Avoid client-side ambiguity | Phase 3 | XS |
| BLK-RatingAggregate | Endpoint exposing aggregate rating breakdown to the rider. | Transparency | Phase 7 | S |
| BLK-AvailabilityForceOffline | `POST /admin/riders/:riderId/force-offline` → `notification:new` `type=SYSTEM_FORCE_OFFLINE`. | Safety kill-switch | Phase 2 | S |
| BLK-ChatNotifRouting | Confirm `notification:new` for `/requests/:id/messages` inbound carries `data.route='/trip/:id/chat'`. | Push deep-links into chat | Phase 4 | XS |
| BLK-RiderSeedScript | `scripts/seed-rider.js` for QA - bypass KYC and create an APPROVED rider for local testing. | Faster verification | Verification plan | XS |
| BLK-NinKyc | Confirm whether `POST /auth/kyc/verify-bvn` supports NIN-only verification for riders (the rider schema has `ninNumber`, not BVN). | Onboarding parity with schema | Phase 1 | S |
| BLK-RiderCancel | Confirm a rider-initiated cancellation endpoint exists (vs. admin force-cancel + customer cancel). | Phase 4 cancel sheet | Phase 4 | S |

### 5.5 Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Rider locks screen mid-shift | High | High | `useKeepAwake` while ONLINE; in-app banner; onboarding tip; auto-flip OFFLINE after 90s background |
| GPS drift / urban canyon | Medium | Medium | 150 m fallback geofence; manual Arrived button always present |
| Ring expiry race conditions | Low | High | HTTP authoritative; 409/410 handled explicitly; Idempotency-Key safe under retry |
| Escrow / dispute fraud | Medium | High | POD captured in MVP; dispute flow with admin override; Cloudinary tag for retention |
| KatPay withdrawal latency | Medium | Medium | Async; status polling + `wallet:balance:updated` event; clear "Processing" state |
| Rural network (Katsina LGAs) | High | Medium | Offline queue with Idempotency-Key; POD draft persists; retry-on-reconnect |
| Device theft | Low | High | Sessions screen + biometric + force-offline kill switch; PIN required for money moves |
| Expo native module compatibility w/ new arch | Medium | Medium | Pin to customer-app's tested versions; fall back to `newArchEnabled: false` if blocked |
| Hausa string drift | Medium | Low | Pre-commit hook flags missing keys; `HAUSA_REVIEW.md` tracks status |
| iOS DND silencing offer ringtone | Medium | Low | Accept in v1; document onboarding tip; revisit critical-alert entitlement in V2 |
| Cloudinary outage | Low | High | 3-attempt backoff; status holds at IN_TRANSIT until POD lands; manual support path |

### 5.6 Reference Map

| Topic | Path | Why |
|---|---|---|
| Customer app navigation | [../customer-app/src/navigation/AppNavigator.js](../customer-app/src/navigation/AppNavigator.js) | Auth + bio + socket lifecycle to mirror |
| Customer API client | [../customer-app/src/services/api.js](../customer-app/src/services/api.js) | Port verbatim |
| Customer socket client | [../customer-app/src/services/socket.js](../customer-app/src/services/socket.js) | Adapt - add rider events |
| Customer notifications | [../customer-app/src/services/notifications.js](../customer-app/src/services/notifications.js) | Port + new Android channels |
| Customer biometric | [../customer-app/src/services/biometric.js](../customer-app/src/services/biometric.js) | Port verbatim |
| Customer idempotency | [../customer-app/src/services/idempotency.js](../customer-app/src/services/idempotency.js) | Port verbatim |
| Customer PinBottomSheet | [../customer-app/src/components/PinBottomSheet.js](../customer-app/src/components/PinBottomSheet.js) | Port verbatim |
| Customer theme | [../customer-app/src/theme/](../customer-app/src/theme/) | Port verbatim |
| Customer i18n | [../customer-app/src/i18n/](../customer-app/src/i18n/) | Port scaffold; new strings |
| Customer wallet slice | [../customer-app/src/store/slices/walletSlice.js](../customer-app/src/store/slices/walletSlice.js) | Port verbatim |
| Customer wallet screens | [../customer-app/src/screens/wallet/](../customer-app/src/screens/wallet/) | Adapt - copy changes |
| Rider routes | [../../backend/src/modules/rider/rider.routes.js](../../backend/src/modules/rider/rider.routes.js) | HTTP surface |
| Rider service | [../../backend/src/modules/rider/rider.service.js](../../backend/src/modules/rider/rider.service.js) | Business logic |
| Rider controller | [../../backend/src/modules/rider/rider.controller.js](../../backend/src/modules/rider/rider.controller.js) | HTTP handlers |
| Rider validator | [../../backend/src/modules/rider/rider.validator.js](../../backend/src/modules/rider/rider.validator.js) | Zod schemas |
| Request module | [../../backend/src/modules/request/](../../backend/src/modules/request/) | Status transitions, settlement |
| Sockets entry | [../../backend/src/sockets/index.js](../../backend/src/sockets/index.js) | Server socket setup |
| Tracking handler | [../../backend/src/sockets/handlers/tracking.handler.js](../../backend/src/sockets/handlers/tracking.handler.js) | `rider:location:update` ingestion |
| Request handler | [../../backend/src/sockets/handlers/request.handler.js](../../backend/src/sockets/handlers/request.handler.js) | Request rooms |
| Socket events list | [../../backend/src/sockets/events.js](../../backend/src/sockets/events.js) | Canonical event names |
| BullMQ workers | [../../backend/src/queues/workers/](../../backend/src/queues/workers/) | `BROADCAST_TO_RIDERS`, `SETTLE_REQUEST`, `PROCESS_WITHDRAWAL` |
| Prisma schema | [../../backend/prisma/schema.prisma](../../backend/prisma/schema.prisma) | `Rider` line 304, `Request` line 814, `Rating` line 429 |
| Admin riders page | [../../admin-dashboard/src/pages/RidersPage.jsx](../../admin-dashboard/src/pages/RidersPage.jsx) | Approval, history, earnings |
| Admin pending riders | [../../admin-dashboard/src/pages/PendingRidersPage.jsx](../../admin-dashboard/src/pages/PendingRidersPage.jsx) | KYC approve/reject |
| Admin operations | [../../admin-dashboard/src/pages/RiderOperationsPage.jsx](../../admin-dashboard/src/pages/RiderOperationsPage.jsx) | Real-time positions + performance |
| Merchant order details | [../../merchant-dashboard/src/pages/OrdersPage.jsx](../../merchant-dashboard/src/pages/OrdersPage.jsx) | Rider info in OrderDetailsModal |
| Conventions | [../../CONVENTIONS.md](../../CONVENTIONS.md) | Folder + naming + state rules |
| Feature template | [../../FEATURE_TEMPLATE.md](../../FEATURE_TEMPLATE.md) | New-feature checklist |
| Customer roadmap | [../../CUSTOMER_APP_ROADMAP.md](../../CUSTOMER_APP_ROADMAP.md) | Shape reference for this doc |
| Socket architecture | [../../docs/SOCKET_ARCHITECTURE.md](../../docs/SOCKET_ARCHITECTURE.md) | Authoritative event reference |
| Unified request arch | [../../docs/UNIFIED_REQUEST_ARCHITECTURE.md](../../docs/UNIFIED_REQUEST_ARCHITECTURE.md) | Lifecycle definitions |
| System architecture | [../../docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) | High-level system overview |
| Environment | [../../docs/ENVIRONMENT.md](../../docs/ENVIRONMENT.md) | Required env vars |
| API contract | [../../docs/API_CONTRACT.md](../../docs/API_CONTRACT.md) | REST shape |
| Product model | [../../docs/PRODUCT_MODEL.md](../../docs/PRODUCT_MODEL.md) | Merchant product structure |
| Architectural pivot | [../../docs/ARCHITECTURAL_PIVOT_SUMMARY.md](../../docs/ARCHITECTURAL_PIVOT_SUMMARY.md) | Why unified Request |
| Provider - Alrahuz | [../../docs/providers/alrahuz.md](../../docs/providers/alrahuz.md) | VTU integration |
| Provider - KatPay | (referenced indirectly through `katpay.service.js`) | Wallet provider |

### 5.7 Verification Plan (End-to-End)

After the rider app is built (post-Phase 8 sign-off), validate end-to-end against a running backend with this checklist:

1. **Seed rider.** Run `node backend/scripts/seed-rider.js` (BLK-RiderSeedScript) to create an APPROVED rider with a verified NIN and a provisioned KatPay NUBAN. Save credentials.
2. **Install rider dev build.** `eas build --profile development --platform android` + install.
3. **Log in** as the seeded rider; biometric prompt; land on Home.
4. **Go ONLINE**; admin's `RiderOperationsPage` shows the marker within 15 s.
5. **Create a customer request.** On the customer app, create a `PACKAGE` request whose pickup is within 5 km of the rider's last fix.
6. **Offer received.** Assert `rider:job:new` event lands within ≤ 2 s of `READY_FOR_PICKUP`.
7. **Accept.** Tap Accept → cockpit appears; customer + merchant clients see `request:rider:assigned`.
8. **Travel** to pickup → geofence triggers → tap Confirm pickup → status PICKED_UP → travel to dropoff → geofence triggers.
9. **POD.** Tap Complete delivery → capture photo (signature if enabled, OTP if high-value) → PATCH DELIVERED 200.
10. **Settlement.** Within 60 s, `wallet:balance:updated` arrives; earnings card animates; balance increments by `riderEarning`.
11. **Withdraw.** ₦100 to KatPay sandbox bank → PIN → success → balance decrements.
12. **Admin dashboard** shows the rider's delivery in `RidersPage` history; `RiderOperationsPage` shows their current location + performance.
13. **Merchant dashboard** shows the rider in `OrderDetailsModal` proof tab.
14. **Notification center** in the rider app lists the offer notification + the earnings notification.
15. **Force OFFLINE** from admin → rider app flips OFFLINE within 3 s; persistent notif clears.
16. **Re-online; background app for 90s; foreground app** → app auto-flipped OFFLINE during background; tapping ONLINE restarts the stream; admin dashboard sees the marker reappear.

If all 16 steps pass on physical Android and iOS, the rider app is end-to-end production ready.

### 5.8 Dependency Graph (Critical Path)

```
Phase 0 - Scaffold Reset
        │
        ▼
Phase 1 - Auth & KYC
        │
        ▼
Phase 2 - Availability & Location
        │
        ▼
Phase 3 - Offer & Accept
        │
        ▼
Phase 4 - Trip Cockpit
        ├─────────────────┐
        ▼                 ▼
Phase 5 - POD       Phase 6 - Earnings & Wallet
   (MVP gate)            (depends on 5 for settled rows)
        └─────────────────┘
                  │
                  ▼
        Phase 7 - Notifications, Profile, Support
                  │
                  ▼
        Phase 8 - Hardening & Launch
                  │
                  ▼
        Phase 9+ - V2 (parked)
```

Phases 5 and 6 can begin in parallel after Phase 4 - but Phase 6 cannot finish until Phase 5 produces real settled rows for testing. Phase 8 absolutely depends on Phases 0–7.

### 5.9 Definition of Done (per phase)

Every phase ends with **all** of the following:
1. ✅ Code merged to `main` (no feature branches lingering).
2. ✅ Prisma migrations applied to dev + staging (`prisma migrate deploy`).
3. ✅ Manual smoke-check of the money path where applicable (`withdraw`, `settlement`, `dispute`) - automated coverage of these paths is end-loaded to Phase 8.
4. ✅ Manual QA against the phase AC on a **physical Android** and a **physical iOS** device. (Phases 0–7 are manual-QA only; Jest + RTL + Maestro suites land in Phase 8.)
5. ✅ All new user-visible strings exist in `i18n/en.json`. (Hausa keys added in Phase 8 native review.)
6. ✅ Accessibility quick-pass: tap targets, contrast, screen-reader labels on new components.
7. ✅ Sentry breadcrumbs and analytics events instrumented per §5.3.
8. ✅ Postman collection + OpenAPI doc updated for any new BE endpoints.
9. ✅ `ROADMAP.md` status markers (✅/⚠/⏸/🔒/◻) updated to reflect actual completion.
10. ✅ EAS release-candidate build produced on the `development` profile and smoke-tested.

---

## §6 Out-of-Scope (Explicit)

To keep v1 focused, these items are explicitly out of scope and **must not** be introduced via scope creep in earlier phases:

- Rider web portal.
- Fleet operator portal / multi-rider accounts.
- In-app voice masking (Twilio Proxy / Verify).
- Batch / multi-stop deliveries.
- Route optimization / in-app turn-by-turn navigation.
- Scheduled availability windows / recurring shifts.
- Surge / incentive engine.
- Third-party navigation embeds.
- Off-duty fuel & maintenance log.
- Savings / loan features (super-app expansion).
- Rider counter-rating of customers.
- Offline-first job queue (offline riders simply don't receive offers).
- Per-zone or per-rider commission rates (commission is platform-wide).
- E2E framework (Maestro / Detox) in v1.

---

## §7 Document Ownership

- **Author**: Initial draft mirrors `CUSTOMER_APP_ROADMAP.md` shape; co-owned by the mobile lead and product.
- **Update cadence**: On every PR that closes a phase task, update the status legend on the affected phase and tick the relevant DoD checkbox.
- **Source of truth**: this file. Subordinate docs (`QA_SCENARIOS.md`, `RUNBOOKS.md`, `HAUSA_REVIEW.md`) are referenced from here; their contents do not contradict the roadmap.
- **Backwards compatibility**: every BLK-* tag is tracked here until the corresponding backend work ships; do not delete a BLK-* row until the unblocking PR merges.








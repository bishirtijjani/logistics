# Store Launch TODO - iPrime Rider & Customer apps

Last reviewed: 2026-06-04

Two parts:
1. **Launch checklist** - what to fix before submitting to the App Store / Play Store, in priority order.
2. **Rider app BLK index** - every deferred backend block found in the rider roadmap.

> **Progress 2026-06-04:** Built `backend/scripts/seed-rider.js` (BLK-RiderSeedScript ✅) and wired
> the backend to persist the full rider KYC payload (BLK-RiderKycExpansion - registration path ✅).
> See the ✅ rows below for details.

---

## Part 1 - Launch checklist

### 🔴 Blockers (submission will fail without these)

- [x] **Tooling: one-command approved rider for reviewers.** ✅ DONE
  `backend/scripts/seed-rider.js` (`npm run db:seed:rider`) creates/refreshes a single APPROVED rider with a PIN set, KYC VERIFIED, and a wallet - idempotent, touches nothing else, safe to run on prod. Default login `rider.review@iprime.ng` / `RiderReview123!` / PIN `224466` (override via env).
- [ ] **Rider: actually run the seed against PROD + put creds in review notes.**
  Run `npm run db:seed:rider` with `DATABASE_URL` pointed at the **production** DB the store build connects to (`api.iprime.ng`), change the default password, and paste the credentials into App Review notes + Play "App access". (The script ran against local during dev - prod still pending.)

- [ ] **Confirm the store builds point at the right server.**
  Check the EAS build profiles: `EXPO_PUBLIC_API_URL` must be `https://api.iprime.ng` for production builds (rider app currently defaults to `127.0.0.1:3000` if unset). If it's wrong, the demo login above fails.

- [x] **Rider: stop collecting documents you don't store.** ✅ RESOLVED (KEEP path taken)
  `POST /rider/register` now persists the full payload: driver's licence (number/url/expiry), vehicle registration (url/expiry), insurance (url/expiry), ID + vehicle photo, plus DOB/address onto the User. Added the `driverLicenceNumber` column (migration `add_driver_licence_number_to_rider`), reconciled the American→British spelling mismatch in the service, and derive `vehicleDocExpiresAt` for the expiry-reminder cron. Verified end-to-end. No more collected-but-discarded data.
  - **Follow-up (not blocking):** confirm the admin rider detail view actually *surfaces* these stored docs so approvers can review them before approving.

- [ ] **Admin ↔ app on the same server.**
  Admin dashboard `.env` points at `http://api.iprime.ng` while the rider app dev default is local. Make sure admin can actually see/approve riders on the same DB the apps use - otherwise approvals (incl. the demo rider) won't work.

### 🟡 Should-fix before launch

- [ ] **Rider: make documents conditional on vehicle type.**
  Bicycle riders are forced to upload a driver's license, vehicle registration, and insurance they can't have. Gate those by `vehicleType`.

- [ ] **Rider: fix DOB minimum.** Currently 16; if a driver's license is required the legal floor is 18. Align them.

- [ ] **Customer: verified demo account for reviewers.**
  Customers get in immediately (good), but wallet funding needs BVN + Nigerian SMS OTP a reviewer can't complete. Give them a demo account that's already BVN-verified if you want wallet features tested.

- [ ] **Privacy declarations match reality.**
  Fill the Apple App Privacy label + Play Data Safety form to match what's *actually* collected/stored after the cut/keep decision above. Confirm `iprime.ng/legal/privacy` and `/legal/terms` are live and describe NIN/ID/location/photos.

### 🟢 Already done (verified) - no action

- [x] Permission purpose strings present & descriptive (both apps: location, camera, photos, Face ID).
- [x] In-app account deletion (both apps → `DELETE /auth/account`, soft-delete + anonymize).
- [x] Privacy Policy + Terms links in-app (both apps, LegalScreen).
- [x] Foreground-only location (no background-location permission → avoids extra store review).
- [x] Customer onboarding is lean (name/email/password → in immediately; PIN only at first payment; BVN only for wallet).
- [x] Customer app has **no** collected-but-discarded data.

---

## Part 2 - Rider app BLK index (deferred backend work)

From `mobile/rider-app/ROADMAP.md`. 🔒 = open/blocking, ✅ = resolved. Effort: XS/S/M.

| ID | What it needs | Why | Phase | Effort | Status |
|---|---|---|---|---|---|
| **BLK-RiderKycExpansion** | Columns already existed; **added `driverLicenceNumber` (migration `add_driver_licence_number_to_rider`) and wired `POST /rider/register` to persist licence/registration/insurance/ID/photo + DOB/address**, reconciling the American→British spelling. Derives `vehicleDocExpiresAt` for the cron. Verified end-to-end. | Was the "collected-but-discarded" launch blocker; KYC depth for legal exposure | 1 + 7 | M | ✅ registration; 🔒 verify re-upload/cron/backfill + admin surfacing |
| **BLK-POD** | Proof-of-delivery: `Request.podPhotoUrl/podSignatureUrl/podDeliveryOtp/podCapturedAt`; `POST /requests/:id/pod-otp/generate`; settings for photo/signature/OTP threshold | Dispute defense, high-value verification | 5 (MVP gate) | M | 🔒 |
| **BLK-PushOnApproval** | FCM push + `notification:new` (`RIDER_APPROVED`/`RIDER_REJECTED`) when admin approves/rejects | Removes post-application limbo (today it polls) | 1 (degrades to polling) | S | 🔒 |
| **BLK-NinKyc** | Confirm `/auth/kyc/verify-bvn` supports NIN-only for riders (schema has `ninNumber`, not BVN); relax validator or add `verify-nin` | Onboarding matches schema | 1 | S | 🔒 |
| **BLK-RiderSeedScript** | `scripts/seed-rider.js` (`npm run db:seed:rider`) - APPROVED rider, PIN set, KYC VERIFIED, wallet; idempotent; optional `--provision-nuban`. | Faster verification / **reviewer demo account** | Verification | XS | ✅ |
| **BLK-AvailabilityForceOffline** | `POST /admin/riders/:riderId/force-offline` → `SYSTEM_FORCE_OFFLINE` (client listener already exists) | Safety kill-switch | 2 | S | 🔒 |
| **BLK-OfferAck** | HTTP `POST /rider/accept` is authoritative; socket emit decorative - document it | Avoid client ambiguity | 3 | XS | ✅ |
| **BLK-SupportAutoTicket** | Auto-file `CUSTOMER_UNREACHABLE` ticket after 3 failed call attempts | Dispatch escalation | 4 (fallback: manual) | S | 🔒 |
| **BLK-AddressCorrection** | `POST /requests/:id/address-correction { stage, note, lat, lng }` + audit row | Field-truth corrections | 4 (fallback: ticket) | S | 🔒 |
| **BLK-ChatNotifRouting** | Confirm inbound message `notification:new` carries `data.route='/trip/:id/chat'` | Push deep-links into chat | 4 | XS | 🔒 |
| **BLK-RiderCancel** | Confirm a rider-initiated cancellation endpoint exists (vs admin force-cancel) | Phase-4 cancel sheet | 4 | S | 🔒 |
| **BLK-Beneficiaries** | Confirm `GET/POST/DELETE /wallet/beneficiaries` allow RIDER role | Faster repeat withdrawals | 6 | XS | 🔒 |
| **BLK-PerformanceEndpoint** | `GET /rider/performance` - acceptance/cancel/on-time/rating/streak | Rider transparency | 7 | M | 🔒 |
| **BLK-RatingAggregate** | Endpoint exposing rating breakdown; confirm `Rating` rows roll into `Rider.averageRating` | Transparency | 7 | S | 🔒 |
| **BLK-DocExpiry** | (folded into BLK-RiderKycExpansion) | - | - | - | ✅ merged |

**Also referenced (not in the index table):**
- **BLK-UploadKinds** - backend must accept the new document upload "kinds" for the expanded KYC (paired with BLK-RiderKycExpansion). Worth tracking explicitly.

### What's actually on the launch path (Phase 1 + reviewer access)
These are the BLKs that touch store submission, smallest first:
1. ~~**BLK-RiderSeedScript** (XS) - unblocks the reviewer demo account.~~ ✅ DONE
2. ~~**BLK-RiderKycExpansion** (M) - resolves the collected-but-discarded liability.~~ ✅ DONE (registration path)
3. **BLK-NinKyc** (S) - rider identity verification actually works. ← next
4. **BLK-PushOnApproval** (S) - nicer, but polling fallback already works; optional for launch.

**Remaining before submit (not code):** run the seed script against PROD + add reviewer creds to store notes; confirm admin rider detail surfaces the now-stored KYC docs.

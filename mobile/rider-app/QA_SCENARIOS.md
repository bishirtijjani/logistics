# Manual QA Scenario Matrix - Logistics Platform Rider

Reflects §8.2 of the rider roadmap. Rows that are Maestro-automated link
to the `.maestro/` flow that covers them; the rest are run by hand on a
physical Android (Tecno Spark or equivalent low-end device) and a
physical iPhone before each release.

Maestro Cloud must run green on the EAS preview build for the release
candidate; the manual pass is what catches OS-level behaviour Maestro
can't simulate (battery throttling, system-permission revoke, force-
close, low-signal GPS).

## Conventions

- "Pre-conditions" lists the environment state required before the steps run.
- A `✅ AUTO` flag means the row is covered by a Maestro flow listed in
  `.maestro/README.md`. The manual reviewer still runs it once per
  hardware family to catch device-specific issues.
- Failure on any row is a release blocker until resolved.

## Matrix

| # | Scenario | Pre-conditions | Steps | Expected | Coverage |
|---|---|---|---|---|---|
| 1 | Happy path delivery | Approved rider; online; customer request available | Accept → travel to pickup → confirm pickup → travel to dropoff → POD photo → DELIVERED | Wallet credited; admin + merchant + customer reflect status updates within 2s | ✅ AUTO `02-accept-offer-and-deliver.yaml` |
| 2 | Offer expires | Rider online; receives offer | Wait 60s without action | Sheet dismisses; offer_expired emitted; OfferLog row flips to EXPIRED; acceptance rate decreases | ✅ AUTO `07-offer-expire.yaml` |
| 3 | Accept after race lost | Two test riders share an offer | Both tap Accept within 200ms of each other | One gets 200; other gets 409 OFFER_TAKEN; sheet transitions to "Already taken" and auto-dismisses after 2s | ✅ AUTO `08-offer-race-lost.yaml` |
| 4 | Mid-trip force-close | Active trip in RIDER_EN_ROUTE | Force-stop app from Android Settings; relaunch within 30s | Cockpit re-hydrates from server; GPS resumes from foreground watchPositionAsync; status preserved | Manual |
| 5 | Network loss between statuses | Active trip; airplane mode | PATCH RIDER_EN_ROUTE during loss | Local state advances; offline banner appears; on reconnect, queued PATCH retries with same key; banner clears | Manual |
| 6 | POD photo upload fails | Active trip at dropoff | Simulate 3 consecutive Cloudinary 5xx (toggle airplane mode mid-upload) | Three retries with backoff; final failure shows "Try again" CTA; trip stays IN_TRANSIT | Manual |
| 7 | OTP mismatch on high-value | ₦80,000 request at dropoff | Enter wrong OTP twice; correct OTP third time | 422 POD_OTP_MISMATCH on both wrong attempts; third attempt → DELIVERED | ✅ AUTO `03-pod-photo-and-otp.yaml` (happy path); manual for mismatch |
| 8 | Customer no-show | At dropoff geofence | Call customer 3× with no answer | After 3rd call: auto-file CUSTOMER_UNREACHABLE ticket; manual ticket otherwise | Manual |
| 9 | Low signal pickup | Airport / underground at pickup | Walk into geofence with sparse GPS | Fallback fence triggers after 5min in 150m radius; manual "Arrived" button still works | Manual |
| 10 | Admin force-cancel | Active trip | Admin clicks Force Cancel | Rider gets non-dismissible sheet; cockpit closes; availability returns to ONLINE | Manual (TripCancelledOverlay) |
| 11 | Withdraw idempotency | Pending withdrawal | Kill app immediately after tap | On relaunch, retry uses same key; server returns original response; no double-charge | ✅ AUTO `04-withdraw-with-pin.yaml` (happy path); manual for kill-replay |
| 12 | Force-offline | ONLINE rider | Admin invokes force-offline | Rider's app flips OFFLINE within 3s; persistent notif clears | ✅ AUTO `05-force-offline-from-admin.yaml` |
| 13 | Doc expiry warning | Rider with ID-doc expiring in 12 days | Cron fires DOC_EXPIRING_SOON | Notification arrives; tap → KycStatusScreen with re-upload CTA; rider can re-upload + new expiry persists | Manual (trigger via `node backend/scripts/run-cron.js check-doc-expiry`) |
| 14 | Battery throttle | Battery falls below 20% during shift | Continue working | Cadence drops to 30s; "Saving battery" toast shown once; stream continues | Manual |
| 15 | Permission revoke | ONLINE rider | Revoke location from system settings | LocationServicesEnabledBanner appears; stream stops cleanly; toggling re-prompts permission | Manual |
| 16 | Screen-off mid-shift | ONLINE rider | Press power button to sleep screen for 30s | `useKeepAwake` prevents OS sleep while ONLINE; stream uninterrupted on resume | Manual |
| 17 | Hausa parity | Switch language to Hausa | Walk through every primary screen | All strings translated; no English fallback visible | ✅ AUTO `06-language-switch-hausa.yaml` (smoke); manual for parity sweep |
| 18 | Offline → online recovery | Toggle airplane mode while on Home | Open Notifications → tap a row → return Home | Offline banner appears; queued reads cache cleanly; on reconnect banner disappears and recent updates appear | Manual |
| 19 | OTA recovery | Bad OTA pushed | Reinstall app from store | Native binary is the source of truth - OTA poison rolled back; rider lands on stable build | Manual (last-line-of-defence runbook in `RUNBOOKS.md`) |
| 20 | Account-delete refusal | Active trip OR positive wallet balance | Settings → Security → Delete account | Server returns 422 with a clear blocker reason; user sees actionable message ("Complete deliveries / withdraw balance first") | Manual |

## Performance gates

Measured on a Tecno Spark Go 2024 (or equivalent - 2GB RAM, Android 14):

- **Cold start (process launch → first paint)**: < 3s
- **Map first frame on TripCockpit**: < 1s after `RIDER_EN_ROUTE` patch
- **Time to first offer sheet** after `Go Online`: < 5s (matching infra dep)
- **JS bundle uncompressed**: < 6MB (`expo export --dump-sourcemap` to verify)

## Crash-free target

- 7-day rolling crash-free sessions: ≥ 99.5% (Sentry-measured)
- Beta with ≥20 active riders for ≥7 days hits ≥95% delivery completion rate

## Release-blocker definition

A row failing in any of:
- Maestro Cloud (green required on the candidate build)
- Manual QA on either Android or iOS
- Performance gate
- Sentry crash-free target

…blocks the production release. Roll the staged rollout back to the
previous binary (see `RUNBOOKS.md` § Rollback) and triage.

# Launch checklist - Logistics Platform Rider (Play Store + App Store)

Run through these in order. Engineering work is complete (see
`ROADMAP.md` § Phase 8); everything below requires credentials, store
accounts, devices, or human review I can't do for you.

## 0. Account prerequisites (one-time)

- [ ] **Expo / EAS account** - log in on this machine.
  ```bash
  cd mobile/rider-app
  npx eas login
  npx eas whoami         # confirm you're on the right account
  ```
- [ ] **Sentry account** + a project for the rider app. Note the DSN
  (looks like `https://abcdef@o123.ingest.sentry.io/789`) and the
  organisation slug.
- [ ] **Google Play Developer account** ($25 one-time).
- [ ] **Apple Developer Program** ($99/year, the `appleTeamId` shows in
  https://developer.apple.com/account → Membership).
- [ ] **App Store Connect** app entry created → note the `ascAppId`
  (the numeric part of the App Store URL).

## 1. Wire EAS to your account

```bash
cd mobile/rider-app
npx eas init             # writes extra.eas.projectId into app.json
npx eas update:configure # writes updates.url into app.json
```

Both commands edit `app.json` in place. Commit the resulting changes
once you've reviewed them.

## 2. Wire Sentry secrets

Set the DSN + the org/project values from §0.

```bash
# Per-environment DSNs - set via EAS secrets so they don't land in git:
npx eas env:create --environment production --name EXPO_PUBLIC_SENTRY_DSN --value 'https://...prod...@.../...'
npx eas env:create --environment preview    --name EXPO_PUBLIC_SENTRY_DSN --value 'https://...staging...@.../...'
```

Then in [app.json](app.json), under the `@sentry/react-native/expo`
plugin entry, replace `REPLACE_WITH_SENTRY_ORG` with your real org slug.
(The Expo plugin uses this at build time to upload source maps so
Sentry can deminify stack traces - without it, stack traces show
unhelpful bundle line numbers.)

## 3. Wire Apple submission credentials

In [eas.json](eas.json) `submit.production.ios`, replace:
- `appleTeamId` → your numeric team id from developer.apple.com.
- `ascAppId` → your App Store Connect app's numeric ID.

EAS will prompt you to upload an App Store Connect API key on first
`eas submit`. Store it in EAS as a credential.

## 4. Apply the Phase 7 migration on production DB

```bash
cd backend
DATABASE_URL=postgres://...prod... npx prisma migrate deploy
DATABASE_URL=postgres://...prod... npx prisma generate
```

After this lands, restart your backend + worker processes so the new
Prisma client (with `riderOfferLog`) is loaded.

## 5. Worker process must register the rider-queue

Already done in code - `initializeQueues()` in
[backend/src/queues/index.js](../../backend/src/queues/index.js) now
starts `startRiderWorker()`. Confirm your worker process
actually calls `initializeQueues()` on boot (it should - same entry
as the request worker).

## 6. Privacy + Data Safety

- [ ] Privacy Policy URL hosted publicly (the in-app `LegalScreen`
  already links to `https:///legal/privacy`).
  Confirm that URL serves.
- [ ] Play Console → Data Safety form:
  - Location: **collected**, **used in-app**, **not shared**,
    **foreground only**, **optional? No (required to deliver jobs)**.
  - Personal info: name, email, phone - collected, used in-app +
    customer support, not shared.
  - Financial: wallet balance, NUBAN - collected, used in-app, shared
    with KatPay (payments processor).
  - Photos: ID + POD - collected, used in-app, not shared, optional? No.
- [ ] App Store Connect → App Privacy: same shape.

## 7. Store listing assets

- [ ] Feature graphic (Play): 1024×500 PNG.
- [ ] Phone screenshots: 2–8 per store, 16:9 portrait. Capture from
  the EAS preview build on a real device.
- [ ] Short description (Play, max 80 chars).
- [ ] Full description (Play, max 4000 chars). Lead with the value prop
  ("Drive for Logistics Platform in Katsina - flexible hours, weekly payouts").
- [ ] App icon: `assets/icon.png` already shipped; verify it scales
  cleanly at 192×192.

## 8. Build + ship (staged)

```bash
# Preview build for QA + Maestro Cloud first:
npx eas build --profile preview --platform android

# Once green:
npx eas build --profile production --platform android
npx eas submit --profile production --platform android

# iOS in parallel:
npx eas build --profile production --platform ios
npx eas submit --profile production --platform ios
```

Submission lands in Play Internal Testing (per
`submit.production.android.track`) and App Store Connect (TestFlight
internal). Promote from there per `RUNBOOKS.md` § 3.

## 9. Maestro Cloud secrets

Set these in Maestro Cloud → Project → Secrets so the helper scripts
in `.maestro/scripts/` work against the staging environment:

| Secret | Value |
|--------|-------|
| `RIDER_PHONE` | The seeded test rider's phone (e.g. `2348000000001`) |
| `RIDER_PASSWORD` | That rider's password |
| `RIDER_PIN` | That rider's 6-digit PIN |
| `RIDER_ID` | Rider record id (the `Rider.id`, not the user id) |
| `ADMIN_TOKEN` | A long-lived admin bearer token for staging |
| `SIBLING_RIDER_TOKEN` | A second test rider's access token (for the race-lost flow) |
| `POD_OTP` | The fixed OTP your staging POD threshold seeds |

## 10. Native-Hausa review

- [ ] Find a native-Hausa speaker (Katsina dialect ideal).
- [ ] Walk them through `src/i18n/HAUSA_REVIEW.md`.
- [ ] Apply their edits to `ha.json`; commit + ship via OTA (no native
  build needed since it's a JS-only change).
- [ ] Stamp `_meta.reviewedAt` on `ha.json` per the checklist instructions.

## 11. Manual QA + beta gate

- [ ] Run the full `QA_SCENARIOS.md` matrix on a physical Android +
  iOS device.
- [ ] Maestro Cloud green on the EAS preview build.
- [ ] Closed beta with ≥20 active riders for ≥7 days at:
  - ≥99.5% crash-free sessions (Sentry).
  - ≥95% delivery-completion rate (analytics).
- [ ] Sentry 24h soak shows zero severe issues.

Once all 11 sections are ticked, you're cleared to promote from Play
Internal → Production staged rollout per `RUNBOOKS.md` § 3.

## Quick-reference: what's still hard-coded that you might want to swap

- `assets/icon.png`, `assets/splash-icon.png`, `assets/adaptive-icon.png`
  - verify these are the final Logistics Platform brand assets.
- `googleMapsApiKey` in [app.json](app.json) - currently shared with
  staging. Issue a separate restricted key for production iOS/Android
  packages and replace before submitting.

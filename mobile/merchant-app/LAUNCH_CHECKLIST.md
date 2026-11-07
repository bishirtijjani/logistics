# Launch checklist - Logistics Platform Merchant (Play Store + App Store)

Run through these in order. The native core (auth, Orders, push with
Accept/Reject actions, biometric lock, settings) plus the embedded WebView
for the management long-tail is complete; everything below requires
credentials, store accounts, devices, or human review.

This mirrors what was shipped for `mobile/rider-app` and
`mobile/customer-app` - same tooling, same commands.

## 0. Account prerequisites (one-time)

These already exist from the rider/customer launches - just log in.

- [ ] **Expo / EAS account** - `mh-prime` owner already holds the two
      published projects.
  ```bash
  cd mobile/merchant-app
  npx eas login
  npx eas whoami         # confirm you're on the right account
  ```
- [ ] **Google Play Developer account** (already enrolled).
- [ ] **Apple Developer Program + App Store Connect** (already enrolled).

## 1. Wire EAS to the account (the one interactive step)

`app.json` still has an empty `extra.eas.projectId` (the only merchant
config that differs from the published apps). Create the project and the
OTA endpoint:

```bash
cd mobile/merchant-app
npx eas init             # writes extra.eas.projectId into app.json
npx eas update:configure # writes updates.url into app.json
```

Both commands edit `app.json` in place. Commit the result once reviewed.
This also creates the Sentry project `logistics-merchant` referenced by the
`@sentry/react-native/expo` plugin entry.

## 2. Sentry

- [x] Sentry project `logistics-merchant` created (org `mh-prime`, EU).
- [x] Plugin org/project already set in `app.json` (`mh-prime` /
      `logistics-merchant`).
- [x] `EXPO_PUBLIC_SENTRY_DSN` set on EAS for `production` + `preview`.
- [ ] _(Deferred for v1)_ `SENTRY_AUTH_TOKEN` (secret) on EAS for
      `production` + `preview` - enables source-map upload so stack traces
      show file/line instead of minified bundle lines. Optional: builds and
      crash reporting work without it. Add later (Sentry → Settings → Auth
      Tokens, scope `project:releases`):
  ```bash
  npx eas env:create --environment production --name SENTRY_AUTH_TOKEN --value '<token>' --type secret --visibility secret
  npx eas env:create --environment preview    --name SENTRY_AUTH_TOKEN --value '<token>' --type secret --visibility secret
  ```

Without the DSN the app still runs - Sentry is silently disabled (see
`src/services/sentry.js`). Session replay is intentionally **off** (matches
rider/customer + the privacy declarations).

## 3. Credentials / signing

- [x] `ios.config.googleMapsApiKey` + `android.config.googleMaps.apiKey`
      set to the shared key (matches rider/customer).
- [x] `web.favicon` + `jsEngine: hermes` added to match the published apps.
- [x] Android service-account JSON (`logistics-service-account.json`)
      copied into `mobile/merchant-app/` (gitignored - never commit it).
- [ ] iOS: `eas.json` `submit.production.ios` stays `{}`; EAS-managed
      credentials (same as the other two apps). EAS will prompt for the
      App Store Connect API key on first submit if the project isn't
      linked yet.

## 4. Backend

- [x] Merchant new-order push already exists
      (`pushAndSocket(merchant.userId, {type:'ORDER'})`).
- [x] `npm run db:seed:merchant` creates an APPROVED reviewer demo
      merchant (PIN, wallet, bank account, demo products).
- [ ] Run the seed against **PROD** and paste creds into the reviewer
      notes:
  ```bash
  cd backend
  MERCHANT_PASSWORD='<rotate-me>' DATABASE_URL='postgres://...prod...' npm run db:seed:merchant
  ```
- [ ] Confirm the backend's `CORS_ALLOWED_ORIGINS` includes
      `https://merchant.` (needed for the WebView surface).
- [ ] (Optional) add merchant status-change + earnings pushes (today
      socket-only).

## 5. Privacy + Data Safety

- [ ] App Store Connect → App Privacy: use
      `docs/store/app-store-privacy.md` (see the **merchant deltas** block).
- [ ] Play Console → Data Safety: use `docs/store/play-data-safety.md`
      (merchant deltas block).
- [ ] Confirm `https:///legal/privacy` and `/legal/terms` serve
      (already live; the in-app Settings screen links to both).

## 6. Store listing assets

- [ ] `store-assets/merchant/` has `icon-512.png`, `feature-graphic.png`
      (1024×500), Play phone/tablet screenshots, and the App Store sets
      (`appstore-merchant-iphone-*` 1206×2622 required slot,
      `appstore-merchant-ipad-*` 2064×2752). `icon-1024.png` is present.
      Regenerate any time with `node store-assets/generator/render.mjs`.
- [ ] Copy for the listing uses
      `docs/store/listing-merchant-app.md` (EN + HA).
- [ ] iPad screenshots are required because `supportsTablet: true`.
- [ ] Storyboard + captions: `docs/store/screenshot-plan.md`
      ("Merchant app" sections).

## 7. Build + ship (staged)

```bash
cd mobile/merchant-app

# Smoke test first:
npx eas build --profile preview --platform android

# Store builds:
npx eas build --profile production --platform all
npx eas submit --profile production --platform android   # Play internal, draft
npx eas submit --profile production --platform ios       # TestFlight
```

Promote from Play Internal and TestFlight once QA is green (see
`docs/store/eas-build-and-submit.md`, staged rollout).

## 8. Reviewer access (both stores)

Paste the seeded merchant creds from §4 into:
- App Store Connect → App Review Information → Notes.
- Play Console → App content → App access (login credentials).

## 9. App Store 4.2 note

Apple rejects apps that are "just a repackaged website." The merchant
app's native core (auth + Orders + push with Accept/Reject action buttons
+ biometric lock + native Settings) is what earns approval; the WebView is
only used for the management long-tail. Hedge the review notes by calling
out the native capabilities explicitly and providing the demo login.

If a reviewer still objects:
1. Graduate the **Products** editor to native (closest to the core order
   flow), then **Earnings**.
2. Or bundle the web assets locally instead of loading
   `https://merchant.` remotely.

## Quick-reference: what's hard-coded and might need swapping

- `assets/icon.png`, `assets/splash-icon.png`, `assets/adaptive-icon.png`,
  `assets/favicon.png` - already generated to match the published apps
  (`scripts/generate-brand-assets.py`).
- `googleMapsApiKey` in `app.json` - reused from the other apps; issue a
  merchant-specific restricted key later if desired.
- `EXPO_PUBLIC_MERCHANT_WEB_URL` - `https://merchant.`, set per
  profile in `eas.json`.

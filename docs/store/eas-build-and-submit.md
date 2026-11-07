# EAS - build & submit guide

How to take an Logistics Platform mobile app from `git push` to a TestFlight/Play
Console upload. Applies to both `mobile/customer-app` and
`mobile/rider-app` - same commands, run inside whichever app directory.

## Prerequisites (one-time setup)

### 1. Accounts

| Account | Cost | Why |
|---|---|---|
| **Expo account** | Free | Owns the EAS project, holds credentials, runs builds |
| **Apple Developer Program** | $99/year | Required to sign + submit iOS builds |
| **Google Play Console** | $25 one-time | Required to upload Android AABs |

### 2. CLI install

```sh
npm install -g eas-cli
eas login
```

### 3. Link the apps to EAS

```sh
# Inside mobile/customer-app
eas init           # picks up the projectId in app.json
eas device:create  # only needed if you want to install dev builds on devices

# Inside mobile/rider-app - note rider-app's app.json has projectId: ""
# right now; on first build EAS will create one and write it in.
cd ../rider-app
eas init
```

### 4. Configure secrets

Both `eas.json` files reference build-time env vars that aren't checked
into git. Configure them once per app:

```sh
# Sentry (used by both apps for crash reporting)
eas secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN \
  --value "https://...@oXXXX.ingest.sentry.io/YYYY" --type string

# Add any other build-time secrets here - keep production values out of
# eas.json itself so the file can stay in git.
```

These propagate into the build environment as `process.env.EXPO_PUBLIC_*`
and ship in the bundle.

### 5. Fill in the submit placeholders

Both `eas.json` files have placeholders that will fail submit if not
filled in:

| Placeholder | Where to find it |
|---|---|
| `REPLACE_WITH_APPLE_TEAM_ID` | https://developer.apple.com/account → Membership |
| `REPLACE_WITH_APP_STORE_CONNECT_APP_ID` | App Store Connect → app → App Information → Apple ID (a 10-digit number) |

You can also pass these on the command line with `--id <ascAppId>` to avoid editing the file.

For Android: `eas submit` will prompt for the service-account JSON the
first time. Generate one in Google Cloud Console for the project linked
to your Play Console, give it the **Service Account User** + **App
Manager** roles, then upload the JSON when prompted.

---

## Build profiles (what each one does)

| Profile | Distribution | iOS output | Android output | Channel | Use case |
|---|---|---|---|---|---|
| `development` | internal | dev-client `.ipa` | dev-client `.apk` | `development` | Expo Go-replacement on your own devices for debugging native modules |
| `preview` | internal | release `.ipa` (ad-hoc) | release `.apk` | `staging` | QA / stakeholders - installable without going through stores |
| `production` | store | `.ipa` for App Store | `.aab` for Play Store | `production` | The thing you actually submit |

`autoIncrement: true` on the production profile bumps `buildNumber`
(iOS) and `versionCode` (Android) on every build - so you never collide
when re-submitting a hotfix.

`appVersionSource: remote` means EAS owns the version numbers. After
the first build, `eas build:version:get` is the source of truth, not
`app.json`.

---

## Common build commands

```sh
# Inside mobile/customer-app or mobile/rider-app

# Local development build, installed via QR scan on a registered device
eas build --profile development --platform android
eas build --profile development --platform ios

# Internal preview for QA - share the resulting URL
eas build --profile preview --platform all

# Production build (the thing you submit to stores)
eas build --profile production --platform all

# Check status
eas build:list --limit 5
```

The first iOS production build will prompt for:
- Apple Developer account credentials
- Distribution certificate (EAS can generate one for you)
- Provisioning profile (EAS can generate one for you)

Say yes to all of EAS's auto-managed options unless you have a reason
to bring your own - it's significantly easier than maintaining
certificates manually.

---

## Submit commands

After a successful production build, the build URL ends with a build ID
(e.g. `abcd-1234-...`). Pass it to submit:

```sh
# iOS → TestFlight (then promote to App Store in App Store Connect)
eas submit --profile production --platform ios --id <build-id>

# Android → Play Console internal track (then promote in Console)
eas submit --profile production --platform android --id <build-id>
```

Submit defaults from `eas.json`:
- **iOS**: lands in TestFlight automatically. Has to be promoted to App Store via the App Store Connect web UI.
- **Android**: lands in the **internal** track with **draft** status. Has to be promoted to closed/open testing or production via the Play Console.

Both are intentional: the auto-publish-to-production path bypasses the
soak / staged-rollout safety net.

---

## Staged rollout (production only)

Once a build is in the Play Console production track, do a staged
rollout instead of going 100% on day one:

| Stage | Audience % | Wait | Watch |
|---|---|---|---|
| 1 | 10% | 24 h | Sentry crash-free sessions ≥ 99.5%, no spike in support tickets |
| 2 | 25% | 24 h | Same |
| 3 | 50% | 48 h | Same + retention metrics |
| 4 | 100% | - | - |

Apple doesn't expose a staged-rollout UI for App Store releases. The
equivalent is the **Phased Release for Automatic Updates** option in
App Store Connect - toggles a 7-day automatic ramp for users on
auto-update; doesn't gate the manual-install audience. Use it.

---

## Rollback

If a release goes wrong:

| Platform | Action |
|---|---|
| Android | Play Console → release → halt rollout. New users won't get the build; existing users on it stay until you ship a fix. |
| iOS | Phased Release → pause. Same effect. |
| Either | Re-submit the previous build's binary as a "new" version with a higher build number. Stores accept this. |

If a runtime bug is fixable in JS only (no native module change), use
EAS Update (`expo-updates`) to push a JS patch without going through
the stores. Requires the app to ship with `expo-updates` enabled,
which our `app.json` already does (`updates.url`).

```sh
eas update --branch production --message "fix: <description>"
```

The build's `runtimeVersion.policy: appVersion` means JS patches only
apply to builds that match the same native version - a hotfix can't
target an older binary by accident.

---

## What still needs YOU (not code) to ship

- [ ] Apple Developer Program enrolment ($99/year, 1–2 days for org review)
- [ ] Google Play Console account ($25 one-time, instant)
- [ ] Fill `REPLACE_WITH_APPLE_TEAM_ID` and `REPLACE_WITH_APP_STORE_CONNECT_APP_ID` in both `eas.json` files (or pass via CLI)
- [ ] Create + upload an Android service-account JSON for `eas submit` to Play Console
- [ ] Add `EXPO_PUBLIC_SENTRY_DSN` as an EAS secret (per app)
- [ ] App icons exist - confirmed for both apps in `assets/icon.png`
- [ ] Splash screens exist - confirmed for both apps in `assets/splash-icon.png`
- [ ] Screenshots for store listings - captured separately, see `docs/store/screenshot-plan.md` (#5.6)
- [ ] Privacy policy + ToS deployed to public URL - see `docs/store/legal-hosting.md` (#5.3 - done)
- [ ] App Store privacy questionnaire + Play Console data-safety form - see `docs/store/` (#5.7, #5.8)

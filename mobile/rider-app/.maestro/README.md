# Maestro flows - Logistics Platform Rider

End-to-end UI flows for the rider app, run via [Maestro](https://maestro.mobile.dev/).

## Running locally

```bash
# Install Maestro CLI (macOS / Linux):
curl -Ls "https://get.maestro.mobile.dev" | bash

# Start the app (either via Expo Go or a custom EAS preview build):
npm run android   # or `npm run ios`

# In another shell, run a flow:
maestro test .maestro/01-login-and-go-online.yaml

# Run the whole suite:
maestro test .maestro/
```

## Running in CI (Maestro Cloud)

The EAS preview build artefact is uploaded with each PR; Maestro Cloud
runs the suite against it and posts results back to the PR. See
`mobile/rider-app/RUNBOOKS.md` for the credentials + upload script.

## Flow inventory

| File | Scenario | QA matrix row |
|------|----------|---------------|
| `01-login-and-go-online.yaml`   | Happy login + flip ONLINE | 12 |
| `02-accept-offer-and-deliver.yaml` | End-to-end delivery | 1 |
| `03-pod-photo-and-otp.yaml`     | High-value POD with OTP | 7 |
| `04-withdraw-with-pin.yaml`     | Withdraw with PIN bottom sheet | 11 |
| `05-force-offline-from-admin.yaml` | Admin force-offline | 12 |
| `06-language-switch-hausa.yaml` | Locale switch | 17 |
| `07-offer-expire.yaml`          | Offer expiry | 2 |
| `08-offer-race-lost.yaml`       | OFFER_TAKEN race | 3 |

## Conventions

- Test credentials are read from environment variables; never hard-code.
- Every flow's first step is `launchApp` so the app boots cleanly from
  the previous test's state.
- Use `extendedWaitUntil` (not `tapOn` with a long polling timeout) so
  flake from slow socket replies is forgiving.
- Tag every interactive element with `testID` on screens used by these
  flows. Touchables that already carry `accessibilityLabel` work with
  Maestro out of the box.

## Test data

- A seeded rider with phone `+2348000000001` and PIN `123456` exists in
  the staging environment. Re-seed via the backend seeder when the
  staging DB is wiped.
- A canned customer order is enqueued by the `seedOffer` admin endpoint
  when the test runs. See `backend/scripts/seed-test-offer.js`.

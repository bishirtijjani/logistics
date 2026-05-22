# Operations runbooks — iPrime Rider

Step-by-step playbooks for the situations the on-call team must handle.
Add to this file when an incident reveals a gap; never let a one-off
become tribal knowledge.

---

## 1. "Rider can't go online"

**Symptoms:** rider taps **Go Online**, toggle flips back to OFFLINE; or
sees a permission banner; or just nothing happens.

**Diagnostic order:**

1. **Permissions.** Ask the rider to open phone Settings → Apps →
   iPrime Rider → Permissions and confirm Location is set to
   *Allow while using the app* (Android) / *While Using* (iOS). If
   denied, the `LocationServicesEnabledBanner` would already be visible
   in-app — if it's not, force-quit and relaunch.
2. **GPS hardware.** Phone Settings → Location must be ON. The app
   surfaces "Turn on GPS" prompts when it's off but some OEMs swallow
   the system intent — ask the rider to toggle GPS off then back on.
3. **Rider status.** In the admin dashboard, look up the rider and
   confirm `status === APPROVED` and `availability !== ON_DELIVERY`.
   PENDING_APPROVAL / REJECTED / SUSPENDED riders cannot go online by
   design — the gating UI should make the reason obvious; if not, ask
   the rider to screenshot.
4. **Active delivery.** If `availability === ON_DELIVERY`, the rider is
   mid-trip. The trip must complete (or be force-cancelled by an admin
   — see runbook 4) before they can go offline → back online.
5. **Backend reachable?** Check `https://api.logistics.codeket.com/health`
   from a browser. If it 503's, the rider's problem is the platform's
   problem — escalate to the platform on-call.
6. **Socket connection.** The rider app's `OfflineBanner` shows when the
   socket has dropped. If the banner is up, ask the rider to flip to
   another wifi/4G and back, and force-close the app.
7. **Account suspended for doc expiry?** Open the rider's KYC tile — if
   any document is past its expiry, the cron worker may have downgraded
   them. Re-uploading via the KYC screen reactivates after admin re-approval.

**Escalation:** if 1-7 don't surface a cause, file a ticket with
device model + Android/iOS version + a screenshot of the home screen and
attach to the rider's profile. Engineering pulls Sentry breadcrumbs by
`riderId`.

---

## 2. Publishing an OTA

OTAs let us ship JS / asset changes to already-installed apps without
going through the stores. Use them for bug fixes and copy changes —
NEVER for native module changes.

**Pre-flight checks:**

- Bundle native version matches the runtime version of the build you're
  patching. `runtimeVersion: { policy: "appVersion" }` in `app.json`
  ties OTAs to `expo.version`. If you bumped `expo.version`, you must
  ship a NEW native build first.
- Maestro suite green on Maestro Cloud against the candidate.
- Manual smoke pass on a physical device — `npx expo start` + load via
  `expo://` is enough.
- The change is reversible: have the previous bundle's hash in your
  back-pocket in case you need to roll back fast (see runbook 5).

**Publish:**

```bash
# From mobile/rider-app/
eas update --channel production --message "v1.0.0 OTA: fix offer ring animation race"
```

This pushes to the `production` channel, which app.json's `updates.url`
points at. Riders pick it up on next foreground.

**Verification:**

- Watch Sentry for the next 30 minutes — crash-free should stay flat or
  improve. A sudden drop = pull the OTA (runbook 5).
- Check the OTA dashboard in EAS for delivery progress; staged rollout
  defaults are fine for low-risk patches.

---

## 3. Production rollout

Riders see a new native binary via the Play Store / App Store. Stage
the rollout to minimise blast radius if a regression slips through.

**Sequence (Play Store):**

1. Build: `eas build --profile production --platform android`
2. Submit: `eas submit --profile production --platform android`
   (Internal Testing track first, per `eas.json#submit.production`.)
3. Promote Internal → Closed beta (~20 riders) once Sentry crash-free
   ≥ 99.5% over 24 h.
4. Closed → Open beta after 48 h of green metrics.
5. Open → Production staged: **10% → 25% → 50% → 100% over 7-10 days**.
   Halt and roll back if crash-free dips below 99.5% or delivery
   completion below 95%.

**Sequence (App Store):**

1. Build: `eas build --profile production --platform ios`
2. Submit: `eas submit --profile production --platform ios` (uploads to
   App Store Connect).
3. TestFlight (internal) → External beta → App Store release.
4. Phased Release toggle ON; Apple staggers automatically over 7 days.

---

## 4. Force-cancel an active trip

A rider's trip is stuck mid-FSM (rider is unreachable, the customer
called support, etc.) and the admin needs to abort cleanly.

1. Admin dashboard → search by rider ID or request ID.
2. Click **Force Cancel** on the active request.
3. Server transitions status → CANCELLED with `cancelledBy: 'admin'`,
   sets `cancellationReason`, and emits the cancellation socket.
4. The rider's `TripCancelledOverlay` mounts non-dismissibly; cockpit
   closes; `availability` returns to ONLINE; refund job is enqueued.
5. Send the rider a `pushAndSocket` ticket explaining the cancellation
   if the reason is opaque (auto-attached when filed from the admin UI).

**If the customer was already charged**, the refund worker fires within
500ms of the cancellation. Verify the customer's wallet was credited
before signing off.

---

## 5. Rollback procedure

### OTA rollback

```bash
# List recent OTAs:
eas update:list --channel production

# Republish the previous one (idempotent):
eas update:republish --update-id <previous-update-id>
```

Riders pick up the rolled-back bundle on next foreground.

### Native binary rollback

The Play Store / App Store don't let you "undo" a release. Recovery
options:

1. **Halt the staged rollout** in Play Console / App Store Connect.
2. **Roll the staged percentage back to 0%** — affects new installers
   only; existing installs keep the bad version.
3. **Re-build the previous tag** and re-submit as a NEW version
   (incremented build number). This is the canonical fix for a broken
   prod build.

```bash
git checkout v1.0.0-rc.5
eas build --profile production --platform android
eas submit --profile production --platform android
```

The new build supersedes the bad one on next user update.

---

## 6. On-call escalation when offer push delivery fails for a region

**Symptoms:** Sentry / analytics show OfferReceived events dropping for
a specific city; rider acceptance rate craters; admin sees broadcasts
sending but no riders responding.

1. **Push provider status.** Check the FCM and APNs status pages — if
   they're degraded, the platform is down, not our code.
2. **Backend dispatcher health.** Tail the `request.worker` logs for
   `broadcastToRiders` and `emitRing`. If they're crashing, restart the
   worker; if they're succeeding but no socket connections exist for
   the region, riders' devices likely aren't connecting.
3. **Socket room population.** From a backend Node REPL:
   ```js
   const { getIO } = require('./src/sockets');
   getIO().sockets.adapter.rooms.get('user:RIDER_ID').size
   ```
   Zero → the rider isn't in their personal room → their socket isn't
   connecting → check the connection-rejection logs (auth middleware).
4. **OEM killer.** Some Tecno / Infinix builds aggressively kill
   background apps. If the analytics show drops at the same minute of
   day each time, you're seeing OEM throttling. Mitigation: tell those
   riders to enable "no battery optimization" for iPrime Rider.

If 1-4 don't recover within 15 minutes, page the platform lead and the
backend on-call.

---

## 7. Test data + staging quirks

- Staging riders / customers / merchants live behind the same database
  as the live admin dashboard — DO NOT promote staging seed data to
  prod. The seed script segregates by `email` suffix `+staging@`.
- Staging Cloudinary cloud is `vtu-logistics-staging`; prod is
  `vtu-logistics`. Misconfiguring this prevents document uploads even
  when the URL is signed correctly.
- Staging FCM project is `vtu-logistics-staging`. Use a separate APNs
  key for staging so prod TestFlight builds don't accidentally read
  staging routing keys.
- Maestro flows depend on a sibling test rider's access token
  (`SIBLING_RIDER_TOKEN`). Refresh by running the seeder weekly — the
  rider's session expires per the auth policy.

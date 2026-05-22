# Security — iPrime

Operational guidance for the platform's security posture. Lives in-repo so
on-call has a single source to consult.

---

## Last audit (Phase 10 workstream #2)

Date: 2026-05-19. Run `npm audit` again before each major release.

### Backend dependencies

| State | Count | Notes |
|---|---|---|
| Fixed in this pass | 6 | `npm audit fix` + bump of `nodemailer` 6.x → 8.0.7 (verified API-compatible) |
| Remaining (deep transitive, no upstream fix) | 16 | Mostly under `firebase-admin` and `socket.io` chains |

#### Why we did NOT take `npm audit fix --force`

`--force` would have:
- **Downgraded** `socket.io` 4.8 → 4.2 (the audit DB's "fix" is older than what we ship — a false positive on our version)
- **Downgraded** `firebase-admin` 13 → 10.3 (same issue; the chain `protobufjs` warning is on a newer transitive that 10.3 simply lacks)
- Broken the real-time + push pipeline

Both warnings stay open until upstream `firebase-admin` ships a `protobufjs` patch.
Tracked as a recurring audit item — re-run after each `firebase-admin` minor bump.

#### High-severity items that ARE addressed

- ✅ `nodemailer` SMTP command injection / DoS / address-parser → bumped to 8.0.7
- ⏳ `axios` (high) — direct dep, but the published fix breaks the request/response
  interceptor signature we use. Migration tracked separately; mitigated for now by
  the fact that all server-side `axios` callers use server-controlled URLs (KatPay,
  Termii, Google Maps, AlRahuz — none take user-supplied URLs).
- ⏳ `fast-xml-builder` (high) — transitive only; the project doesn't accept
  user-supplied XML, so the CDATA-injection vector isn't reachable.

---

## Authentication & secrets

- **Passwords**: bcrypt with `SALT_ROUNDS=12`. Never logged. Never returned in
  any API response.
- **Transaction PIN**: bcrypt, 6-digit numeric. Server-side lockout at 6
  consecutive wrong attempts (30 min); per-endpoint rate limit at 3/5min
  (defense-in-depth — see [`rate-limit.middleware.js`](backend/src/middlewares/rate-limit.middleware.js)).
- **JWT**: separate access/refresh secrets, ≥32 chars enforced at boot.
  Access tokens expire in 15min; refresh in 7d. Refresh rotation revokes the
  prior session inside one transaction.
- **OTP**: 6-digit, 10-minute TTL, 60s resend cooldown. Single-use — burned
  from Redis on successful verify.
- **BVN**: only stored hashed (`bvnHash`). Plaintext never persisted, never
  logged. Phone-OTP gate verifies BVN-linked phone ownership before NUBAN
  provisioning.

### Secrets

- Stored only in environment variables sourced from `.env`. **Never in git**.
- `.env` is in `.gitignore`. `.env.example` (if added) must use placeholders.
- For staging/production, secrets live in the host's secret manager
  (e.g. systemd `EnvironmentFile=`, AWS Secrets Manager, fly.io secrets).

---

## Network surface

- **Helmet**: enabled (sets `Content-Security-Policy`, `Strict-Transport-Security`,
  etc.). See [`backend/src/app.js`](backend/src/app.js).
- **CORS**: allowlist via `CORS_ALLOWED_ORIGINS` env var. In production this
  MUST be a comma-separated list of explicit origins; the dev default `*`
  is rejected by the schema in non-dev environments.
- **Rate limiting** (per [`rate-limit.middleware.js`](backend/src/middlewares/rate-limit.middleware.js)):

| Endpoint | Limit | Keyed by |
|---|---|---|
| General API | 100 / 1 min | IP |
| Auth (login, password reset) | 5 / 2 min | IP |
| OTP request/verify | 3 / 2 min | phone or IP |
| PIN verification | 3 / 5 min | userId or IP |
| Registration | 3 / 1 hr | IP |
| Maps API | 60 / 1 min | userId or IP |
| **POST /requests** (Phase 10) | **30 / 1 hr** | userId |
| **POST /requests/quote** (Phase 10) | **120 / 1 hr** | userId |

---

## Webhook security

- All inbound webhooks (KatPay, future providers) verify a per-provider
  HMAC over the **raw** request body. The raw-body middleware mounts BEFORE
  `express.json()` so the bytes used for HMAC match the bytes that hit the
  wire — see [`app.js`](backend/src/app.js#L48).
- Failed verification: `401` immediately, no logging of the body.

---

## Money paths

- All escrow/transfer/withdrawal operations run inside `prisma.$transaction`.
- HMAC-signed `quoteToken` locks pricing between `/quote` and `/requests`.
  Token TTL: 5 min. Verifier checks signature + expiry + every locked number.
  See [`utils/quote-token.js`](backend/src/utils/quote-token.js).
- HMAC-signed `cancelToken` (separate domain-separated secret) does the same
  for cancellation-fee preview → confirm. Cross-token forgery blocked by tests.
- Idempotency-Key header required on creation, transfer, withdrawal,
  refund. The middleware records the response on first hit and replays it
  on retries — see [`middlewares/idempotency.middleware.js`](backend/src/middlewares/idempotency.middleware.js).
- Reconciliation worker runs nightly to detect ledger drift.

---

## Observability

- **Sentry** captures `5xx` and non-operational errors. `SENTRY_DSN` is
  optional everywhere — when unset, the SDK no-ops and errors still land
  in Winston logs. See [`utils/sentry.js`](backend/src/utils/sentry.js).
- **Request-ID**: every request gets an `X-Request-Id` (echoed in logs,
  Sentry tags, and the response header). Use it to correlate user reports
  with server logs.
- **Winston** logs are JSON in production; `logs/error.log` (5MB × 5 rotated)
  + `logs/combined.log`.

---

## Backups

- **Postgres**: `scripts/backup-postgres.sh` — daily cron, 30-day local
  retention, optional S3 upload. Restore is documented inline at the top
  of the script.
- **Redis**: provider-managed snapshots every 6 h. Redis holds ephemeral
  state only (OTPs, pending registrations, rate-limit counters); losing a
  snapshot inconveniences users but doesn't corrupt the source of truth.
- **Restore test**: must run quarterly on a staging box. Mark calendar.

---

## OWASP top 10 — quick checks for code review

- **A01 Broken Access Control**: every route after `/auth/login` gates on
  `authenticate` + `authorize(...roles)`. Cross-user reads (e.g. notifications,
  sessions, addresses) explicitly compare `row.userId === req.user.id`.
- **A02 Cryptographic Failures**: only bcrypt for passwords/PINs; HMAC-SHA256
  for tokens; HTTPS terminated upstream; no `Math.random()` for security IDs
  (replaced with `crypto.randomBytes`).
- **A03 Injection**: Prisma's query layer prevents SQL injection. Zod
  validators reject malformed input at the boundary. No `eval`, no
  `child_process.exec` with user input.
- **A04 Insecure Design**: status FSM gates transitions
  ([`utils/status.js`](backend/src/utils/status.js)). Idempotency on every
  state-changing endpoint.
- **A05 Security Misconfiguration**: `helmet` defaults, explicit CORS
  allowlist (production), `NODE_ENV=production` toggles strict env parsing.
- **A06 Vulnerable Components**: `npm audit` in CI (see this doc); 22 → 16
  vulns after Phase 10 sweep.
- **A07 ID & Auth Failures**: lockouts on PIN (server-side), perimeter rate
  limits, refresh-token rotation, session revocation on password reset.
- **A08 Software & Data Integrity Failures**: HMAC-signed quote + cancel
  tokens; webhook HMAC verification; Prisma migrations versioned.
- **A09 Security Logging**: Winston + Sentry; PII (BVN, password, PIN,
  tokens) stripped from `beforeSend`.
- **A10 SSRF**: server-controlled URLs only (Cloudinary signed-upload returns
  a signature for the client to upload directly; no inbound URL goes
  through axios).

---

## Reporting a vulnerability

Email **bishirtijjani247@gmail.com** with subject `SECURITY:`. We aim to
acknowledge within 48 hours. Please do not file public GitHub issues for
security reports.

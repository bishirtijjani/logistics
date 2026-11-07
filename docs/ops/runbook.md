# Production runbook - Logistics Platform

Operational playbook for the on-call engineer. The goal of every entry
is: **diagnose in 5 minutes, mitigate in 15, post-mortem afterwards.**

If a section feels stale or wrong while you're paging through it at 2am,
fix it before you go back to sleep. Stale runbooks are worse than no
runbook.

---

## On-call basics

### Who's on
- **Primary on-call:** Bishir (until a second engineer is onboarded)
- **Escalation:** N/A in V1 - escalate to the engineer's personal phone
- **Hand-off:** weekly, Mondays 09:00 WAT

### Where to look first
1. **Sentry** - backend + mobile error feeds, traces, releases
2. **Logs** - backend runs Winston with `logs/error.log` + `logs/combined.log` (rotation: 5MB × 5)
3. **Redis** - `redis-cli` against the production Redis; `INFO`, `CLIENT LIST`, `KEYS bull:*`
4. **Postgres** - `psql "$DATABASE_URL"`; common diagnostic queries in §"Database lag"
5. **KatPay dashboard** - for payment-rail incidents
6. **Termii dashboard** - for OTP-delivery incidents

### Communication
- **Status page:** to be set up (Cronitor or Statuspage)
- **User-facing comms:** post in the in-app notification center via admin tooling; tweet from the company handle for major outages
- **Internal:** primary engineer's WhatsApp until a Slack/Discord is set up

---

## Severity ladder

| Sev | Definition | Response |
|---|---|---|
| **SEV-1** | Money loss, security breach, or full outage | Drop everything. Status-page post within 15 min. Hourly updates. |
| **SEV-2** | A major flow is broken for >25% of users (logins, payments, deliveries) | Drop current sprint work. Hourly internal updates. |
| **SEV-3** | A feature is broken but workaround exists, OR <25% of users affected | Fix in current shift. End-of-day update. |
| **SEV-4** | Cosmetic bug, single-user issue, no urgency | Backlog. |

---

## Common incidents

### 1. Backend totally down (5xx storm)

**Symptoms**
- Health-check fails: `curl https://api./health`
- Sentry shows a `5xx` spike in the last few minutes
- Customer app's session-expired toast firing for all users (interceptor falls back to NETWORK_ERROR)

**Diagnose**
1. SSH to the production host: `ssh deploy@prod.logistics`
2. `systemctl status logistics-backend` - service running?
3. `journalctl -u logistics-backend -n 200` - recent fatals?
4. `df -h` - disk full?
5. `free -m` - out of memory?

**Mitigate**
| Cause | Fix |
|---|---|
| OOM / disk full | Restart service (`systemctl restart logistics-backend`); cleanup `logs/*.log.*` if disk |
| Crash loop on a bad commit | Roll back to previous release via `git checkout <prev-sha> && pm2 reload` |
| Postgres unreachable | Check Postgres host; restart the connection pool by restarting backend |
| Redis unreachable | See §2 (Redis incident) |

**Recover**
- Post a status update once health-check passes for >1 min
- Open a Sentry release-comparison view to see if a deploy correlates

---

### 2. Redis incident

**Symptoms**
- OTP send/verify failing across all users
- Rate-limit counters resetting unexpectedly (general request flood)
- BullMQ workers stalled - `bull-board` shows growing wait queue, no progress
- Sentry tag: `REDIS_CONNECTION_LOST`

**Diagnose**
1. `redis-cli ping` → expect `PONG`
2. `redis-cli INFO` → memory usage, connected clients
3. `redis-cli KEYS "bull:*" | wc -l` → queue depth

**Mitigate**
- **Provider outage:** wait + post status; restart backend so it reconnects when Redis is back
- **Memory pressure:** `redis-cli FLUSHDB` is destructive - wipes OTPs and queues. Only do this if Redis is genuinely full AND you can tolerate the OTP loss (users re-request). Prefer scaling RAM if available.
- **Too many connections:** `redis-cli CLIENT KILL TYPE normal` (be careful - kills all)

**Recover**
- After Redis is healthy, restart workers: `systemctl restart logistics-workers`
- Drain the stalled queue: `eas` admin tool or direct Bull-Board action

---

### 3. Database lag / connection exhaustion

**Symptoms**
- Sentry: `PrismaClientKnownRequestError` or query timeouts
- Backend RT spike (p99 > 2s)
- Some endpoints work, others don't (depending on which queries hit the slow path)

**Diagnose**
```sql
-- Top 10 slow queries right now
SELECT pid, now() - query_start AS dur, state, query
  FROM pg_stat_activity
  WHERE state = 'active'
  ORDER BY dur DESC
  LIMIT 10;

-- Connection count
SELECT count(*), state FROM pg_stat_activity GROUP BY state;

-- Blocking locks
SELECT * FROM pg_locks WHERE granted = false;
```

**Mitigate**
- **Connection pool maxed:** check Prisma config (`?connection_limit=`); restart backend to drain
- **Long-running query blocking writes:** `SELECT pg_cancel_backend(<pid>)` for the offender; investigate why it ran (most often an unindexed `LIKE`)
- **Replication lag (when we add replicas):** failover to primary or wait

**Recover**
- Add the index the slow query needed; deploy
- Note in post-mortem

---

### 4. KatPay webhook failures (money path)

**Symptoms**
- Sentry tag `WEBHOOK_HMAC_FAILED` (401s) or `WEBHOOK_PROCESSING_FAILED` (5xx)
- Customers report "I funded my wallet but the balance didn't update"

**Diagnose**
1. Tail webhook logs: `tail -f logs/combined.log | grep '/webhooks'`
2. Check KatPay dashboard → webhook delivery log → look for 5xx/4xx from us
3. Confirm webhook secret env var matches what KatPay has on file:
   `echo $KATPAY_WEBHOOK_SECRET | sha256sum` against the KatPay dashboard footer

**Mitigate**
- **HMAC mismatch:** secret has drifted. Re-sync from KatPay dashboard → restart backend.
- **Processing 5xx:** there's a code bug; check the worker; replay the webhook from KatPay dashboard once fixed.
- **Idempotency-Key collision (rare):** the same delivery may be hitting us twice; our idempotency middleware should dedupe - if it doesn't, that's a bug to file.

**Recover**
- Verify funding completes for the affected users (`SELECT * FROM "Transaction" WHERE "userId" = '...' ORDER BY "createdAt" DESC LIMIT 5;`)
- If a customer lost time, refund them a fixed inconvenience credit (₦200) - log it in their notes

---

### 5. Push notifications not delivering

**Symptoms**
- Customers/riders say they're not getting notifications
- Sentry shows no FCM-side errors (clue: it's silent on the client)
- Backend logs show notifications being created, but no FCM delivery attempts

**Diagnose**
1. Check Firebase Console → Cloud Messaging → recent send attempts
2. `SELECT count(*), "sentAt" IS NULL AS unsent FROM "Notification" GROUP BY 2;` - are they being sent at all?
3. Verify `FIREBASE_SERVICE_ACCOUNT_KEY` env var is still valid (rotated last >30d ago? - confirm in Firebase console)

**Mitigate**
- **Stale service account:** rotate the key in Firebase, update env, restart backend
- **FCM quota:** unlikely at our scale, but check console quota page
- **Bad FCM tokens:** users who upgraded the OS without launching the app have stale tokens - the next push to them fails with `NotRegistered`, which our worker should clear

**Recover**
- Send a smoke-test notification to a known-good user via admin tool

---

### 6. Wallet balance drift (escrow accounting)

**Symptoms**
- Reconciliation worker (nightly) alerts: discrepancy > ₦100
- Admin dashboard shows escrow total ≠ sum of in-flight requests' `customerPaid - cancellationFee - settled`

**Diagnose**
This is a SEV-2 minimum. Don't refund anyone yet.
```sql
-- Compare escrow balance to expected
SELECT
  (SELECT balance FROM "SystemWallet" WHERE name = 'ESCROW') AS actual_escrow,
  (SELECT COALESCE(SUM("customerPaid" - COALESCE("cancellationFee", 0)), 0)
     FROM "Request"
     WHERE status IN ('CREATED','MATCHING','ACCEPTED','PROCESSING','READY_FOR_PICKUP','PICKED_UP','IN_TRANSIT','DELIVERED')) AS expected_escrow;
```

**Mitigate**
- Freeze withdrawals: set `wallet.withdrawalsEnabled = false` in PlatformSetting (gates Withdraw endpoints)
- Identify the bug - usually a non-transactional write path that doesn't roll back on failure
- Replay the affected requests through the worker once the bug is fixed

**Recover**
- Post-mortem mandatory
- Manual ledger reconciliation per affected user (case-by-case credit/debit) signed off by you
- Notify any user whose balance was actually wrong; do NOT preemptively notify users whose balance is fine

> **Known false-positive (2026-10):** the parity math counts `REFUND` credits but
> excludes the *debits* of `FAILED`/`REVERSED` withdrawals, so every genuine
> failed-then-refunded withdrawal shows a **negative drift equal to its amount**
> even though the wallet's net balance is actually correct. Before treating a
> drift as missing money, compare it to the total of failed withdrawals on that
> wallet. Full write-up:
> `docs/ops/incidents/2026-10-01-paystack-double-payout.md`.

---

### 7. Mobile crash spike post-deploy

**Symptoms**
- Sentry mobile dashboard: crash-free sessions drops below 99.5%
- A new release tag shows the bulk of crashes
- Support tickets mentioning "app keeps closing"

**Diagnose**
1. Sentry → mobile project → release diff vs previous release
2. Identify the top stacktrace; check if it's:
   - A new native module call (recent app.json change?)
   - A new code path (recent JS change?)
   - A device-class-specific issue (low-end Android, old iOS?)

**Mitigate**
- **JS-only bug:** EAS Update push (`eas update --branch production --message "fix: <desc>"`) - patches devices on the same `runtimeVersion`
- **Native bug:** halt the Play Console rollout (or pause iOS phased release); ship a new binary

**Recover**
- Confirm crash-free climbs back above 99.5%
- Post-mortem

---

### 8. Maps API quota exceeded

**Symptoms**
- Sentry: `OVER_QUERY_LIMIT` from Google Maps
- LocationPicker / route preview returning errors
- Bills from Google for the period spike

**Diagnose**
1. Check Google Cloud Console → Maps API → quotas
2. Identify the offending endpoint (geocoding vs directions vs places)

**Mitigate**
- **Short-term:** raise the quota in GCP (no extra cost, just monitoring change)
- **Real cause:** missing cache. The `/route` endpoint caches in Redis for 30s - if Redis is down or the cache key changed, this can balloon. See §2.

**Recover**
- Re-enable the cache, verify hit rate

---

### 9. Withdrawals "failed" but actually paid out (provider double-pay)

**Symptoms**
- Reconciliation refunds withdrawals that the provider says it settled
- Users paid twice (bank + wallet refund), or a flood of `FAILED` withdrawals
- App logs say "Transfer not found" / "unknown reference" while the provider
  dashboard/API shows `success`

**Diagnose** (do this first — the app's own status is not authoritative)
1. Take a withdrawal reference from a suspected failure and ask the provider
   directly. For Paystack, **lowercase** the reference:
   ```sh
   REF=$(echo "TRF-<uuid>" | tr 'A-Z' 'a-z')
   curl -s -H "Authorization: Bearer $PAYSTACK_SECRET_KEY" \
     "https://api.paystack.co/transfer/verify/$REF" | head -c 400
   ```
   If it returns `"status":"success"` with a `transferred_at`, the money left.
2. Cross-check the account's full transfer ledger:
   `GET https://api.paystack.co/transfer?perPage=100` — count vs the DB's
   `WITHDRAWAL` rows.
3. Check `webhook_events` for a `transfer.success` that arrived but left the
   `transactions` row on `SENT` with no `providerRef` (the case-mismatch bug).

**Mitigate**
- **Stop the bleeding immediately:** set `withdrawal.autoRefundStuck = false`
  (PlatformSetting) so the nightly sweep stops refunding unconfirmed payouts, or
  disable withdrawals. Deploy the fix
  (`fix(payments): stop Paystack payouts being auto-refunded`, commit `512878f`).

**Recover**
- Correct the affected rows so the user side looks like a normal completed
  withdrawal (no refund ever visible):
  ```sh
  docker exec -w /app logistics node scripts/hide-erroneous-paystack-refunds.js            # dry run
  docker exec -w /app logistics node scripts/hide-erroneous-paystack-refunds.js --apply
  ```
  This marks each refund `REVERSED` + `hiddenFromUser`, completes the withdrawal,
  debits the refunded amount, hides the notice, and writes an `AuditLog` snapshot.
- **Fully reversible:** `… --reverse --batch=<batchId>` restores the prior state
  per row if the provider later confirms a payout never credited.
- Post-mortem: `docs/ops/incidents/2026-10-01-paystack-double-payout.md`

---

## Routine ops

### Deploy backend

```sh
ssh deploy@prod.logistics
cd /opt/logistics/backend
git pull origin main
npm ci --omit=dev
npx prisma migrate deploy
systemctl reload logistics-backend
# Smoke test
curl https://api./health
```

### Run a manual reconciliation

```sh
cd /opt/logistics/backend
node ./scripts/reconcile.js --dry-run
# If clean:
node ./scripts/reconcile.js --apply
```

### Take a backup before a risky change

```sh
sudo /opt/logistics/scripts/backup-postgres.sh
```

### Restore from backup (rehearsal - never run in prod without a test)

```sh
gunzip -c /var/backups/logistics/logistics-YYYYMMDD-HHMMSS.sql.gz | psql "$STAGING_DATABASE_URL"
```

---

## Things we DON'T do (anti-patterns)

- ❌ **Restart the backend to "fix" a slow query.** That hides the bug.
- ❌ **`FLUSHDB` in Redis to clear "stuck" state.** Without confirming what's stuck, you lose OTPs and rate-limit counters.
- ❌ **Manually edit wallet balances in SQL.** Always use the admin-tool flow that records a `Transaction` row - otherwise reconciliation will alert tomorrow.
- ❌ **`UPDATE … WHERE id = '…'` on Request status.** The FSM in `status.js` exists for a reason; bypassing it can leave a row in an unreachable state.
- ❌ **`git push --force` to production hotfix branch.** Revert via a new commit.
- ❌ **Sharing your own credentials to "fix something quickly".** Use the shared deploy account.

---

## Post-incident

After any SEV-1 or SEV-2:

1. **Write a post-mortem within 48 h** in `docs/ops/incidents/YYYY-MM-DD-<slug>.md` - keep it blameless; focus on what the system did, not who pressed which key (see `docs/ops/incidents/2026-10-01-paystack-double-payout.md` for the template)
2. Update **this runbook** with the new playbook entry
3. Update **`docs/ops/known-errors.md`** if a new error code is involved
4. Open a P0/P1 ticket for the underlying fix if it isn't already merged

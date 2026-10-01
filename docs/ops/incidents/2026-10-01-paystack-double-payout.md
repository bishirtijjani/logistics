# Incident: Paystack withdrawals paid out *and* refunded (double pay)

**Date:** 2026-10-01 (bug window 2026-09-19 → 2026-09-29)
**Severity:** SEV-1 (financial loss + users paid twice)
**Status:** Fixed & corrected. Reversible correction applied.
**Fix commit:** `512878f` (fix) + `1a55a9b` (correction/migration) on `main`
**Correction batch id:** `paystack-double-refund-20261001`

---

## Summary

After the live gateway moved to **Paystack**, every withdrawal that Paystack
actually settled was, a day later, **also refunded to the customer's wallet**.
The money left via Paystack *and* came back in the wallet — the platform paid
the customer twice. This ran silently for ~10 days.

## Impact

- **8 withdrawals** across 5 accounts were paid twice (7 real users + 1 test).
- **₦13,968** refunded while the payouts also left (₦13,658 to banks + ₦140 fees).
- No data was lost (see correction: rows retained, not deleted).

## Root cause

`paystack.service.toTransferReference()` **lowercases** the ledger reference
before sending it to Paystack (`TRF-…` → `trf-…`). Paystack echoes that
lowercased form in webhooks and in `/transfer/verify`. But the app looked the
row up by its **exact** stored reference:

1. `payment.worker.handlePaystackTransferSuccess` → `findTransactionByProviderRef`
   matched `reference`/`providerRef` by exact case → the `transfer.success`
   webhook resolved to nothing ("unknown reference") and the row stayed `SENT`.
2. `reconcilePaystack` called `verifyTransfer(tx.reference)` with the **uppercase**
   ledger ref → Paystack returned **404 "Transfer not found"** → the sweep couldn't
   confirm it either.
3. `reconciliation.service` then saw a `SENT` withdrawal with **no `providerRef`**
   older than `withdrawal.stuckAfterHours` (24h) and auto-refunded the wallet.
   That "no providerRef ⇒ never dispatched" assumption was false for Paystack.

So: Paystack paid in seconds, the app never recorded it, and the nightly sweep
refunded the customer on top.

Why it started at the gateway switch: the old KatPay path completed synchronously
on success, so rows rarely stayed `SENT`. Paystack's live `POST /transfer` returns
`pending`, so every payout took the "wait for webhook" path — which was broken.

## Fix (`512878f`)

- Persist Paystack's (lowercased) reference as `providerRef` **at dispatch**, even
  while `pending`, so the webhook + verifier can always find the row.
- `findTransactionByProviderRef` now matches references **case-insensitively**.
- `reconcilePaystack` normalises the reference via `toTransferReference` before
  `verifyTransfer`.
- **Verify before refunding**: the reconciliation sweep now asks Paystack before
  touching money — `success` → complete, `reversed`/404-never-dispatched → refund,
  `failed`/transient → hold for a human. `verifyTransfer` now carries
  `providerStatus`/`notFound` so callers can tell "unknown" from "never dispatched".

Regression tests: `tests/paystack-webhook.test.js`,
`tests/payments-lifecycle.test.js`, `tests/reconciliation-paystack-safety.test.js`.

## Data correction (`1a55a9b`)

Rather than hide that a refund happened, the corrected state is: **a normal
completed withdrawal, no refund ever visible**.

- Migration `20261001140000_add_hidden_from_user` adds `hiddenFromUser` to
  `transactions` + `notifications`, filtered out of user-facing reads (wallet
  history, rider/merchant earnings, notification feed).
- `backend/scripts/hide-erroneous-paystack-refunds.js` (dry-run by default):
  per target, atomically marks the refund `REVERSED` + hidden, sets the withdrawal
  `COMPLETED` with its Paystack ref, debits the refunded amount back, hides the
  matching "Refund credited" notice, and writes a full before/after snapshot to
  `AuditLog`.

| Account | Debited back | Balance after |
|---|---|---|
| Fadimatu Aminu | ₦11,080 | ₦1,661 |
| Salim Marafa (rider) | ₦1,520 | ₦8 |
| Abdulsalam Abbati | ₦978 | ₦12 |
| Ronke Odabira | ₦220 | ₦27.50 |
| customer@test.com | ₦170 | ₦735 |
| **Total** | **₦13,968** | |

### Reversing the correction

If Paystack later confirms a given payout never credited, restore that row
exactly (idempotent, per-row):

```sh
docker exec -w /app logistics node scripts/hide-erroneous-paystack-refunds.js \
  --reverse --batch=paystack-double-refund-20261001
```

Nothing was hard-deleted — the refund rows, original statuses and wallet
before/after are all in `AuditLog` (action `CORRECT_PAYSTACK_DOUBLE_REFUND`).

## Detection

- DB (`transactions` status transitions) + Paystack `/transfer/verify` +
  `/transfer` list — the app's own logs were misleading (they said "failed").
- `webhook_events` showed `transfer.success` arriving and being processed while
  the transaction stayed `SENT`.

## Lessons

1. **Provider references must be canonicalised at one boundary and used on both
   sides.** Lowercasing on the way out but not on the way in is a silent killer.
2. **Never assume "no confirmation" means "money didn't move".** Only refund on a
   *definitive* provider signal. A provider with a status API must be asked.
3. **A "safety net" that refunds can itself become the loss vector.** The
   auto-refund sweep is what converted a bookkeeping bug into real loss.

## Follow-ups (open)

- **Reconciliation drift artifact:** parity counts `REFUND` credits but excludes
  the *debits* of `FAILED`/`REVERSED` withdrawals, so every genuine
  failed-then-refunded withdrawal shows a false negative drift. This makes
  "Reconciliation FAILED" noisy and masks real discrepancies. Needs a fix to the
  parity model in `reconciliation.service.js`.
- Audit the large pre-existing wallet drifts once the parity model is corrected.
- Consider a guard: the refund sweep should refuse to act on any provider that
  has a payout-status endpoint unless the status was queried.

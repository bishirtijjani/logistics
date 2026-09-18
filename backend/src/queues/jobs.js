/**
 * BullMQ job type constants and payload definitions.
 *
 * ALL job types MUST be defined here.
 * Workers consume jobs by type from the respective queues.
 *
 * NAMING: QUEUE_NAME.JOB_TYPE
 */

// --- Queue names ---
const QUEUES = {
  PAYMENT: 'payment-queue',
  NOTIFICATION: 'notification-queue',
  UTILITY: 'utility-queue',
  REQUEST: 'request-queue',
  RIDER: 'rider-queue',
};

// --- Job types per queue ---

const PAYMENT_JOBS = {
  /** Process KatPay virtual account payment - credit user wallet */
  PROCESS_KATPAY_WEBHOOK: 'process-katpay-webhook',
  /** Process KatPay transfer_payment.completed - credit user wallet */
  PROCESS_TRANSFER_PAYMENT_WEBHOOK: 'process-transfer-payment-webhook',
  /** Process a Paystack webhook (charge.success funding, transfer.* payouts) */
  PROCESS_PAYSTACK_WEBHOOK: 'process-paystack-webhook',
  /** Process withdrawal - call KatPay payout API */
  PROCESS_WITHDRAWAL: 'process-withdrawal',
  /** Provision KatPay virtual account for new user */
  PROVISION_VIRTUAL_ACCOUNT: 'provision-virtual-account',
  /** Retry a failed transaction */
  RETRY_FAILED_TRANSACTION: 'retry-failed-transaction',
  /** Nightly: delete expired idempotency-key reservations */
  CLEANUP_EXPIRED_IDEMPOTENCY: 'cleanup-expired-idempotency',
  /** Nightly: ledger reconciliation across user/merchant/system wallets */
  RUN_RECONCILIATION: 'run-reconciliation',
  /** Safety-net sweep: find KatPay webhook_events stuck unprocessed past the
   *  grace window (lost/duplicate job dispatch, worker downtime) and replay
   *  them. Runs every 5 minutes; replay is idempotent (atomic claim + fundWallet's
   *  own reference uniqueness). */
  RECONCILE_STUCK_WEBHOOKS: 'reconcile-stuck-webhooks',
  /** Safety-net sweep for Paystack: verify PENDING funding and SENT payouts that
   *  are past the grace window and settle/refund them. Runs every 5 minutes. */
  RECONCILE_PAYSTACK: 'reconcile-paystack',
};

// A webhook event is "stuck" once it's sat unprocessed longer than any normal
// processing should take. The sweep only touches rows older than this so it
// never races the live job it's shadowing.
const STUCK_WEBHOOK_GRACE_MS = 3 * 60 * 1000; // 3 minutes

const NOTIFICATION_JOBS = {
  /** Send push notification via FCM */
  SEND_PUSH: 'send-push',
  /** Send SMS via Termii */
  SEND_SMS: 'send-sms',
  /** Send OTP via Termii */
  SEND_OTP: 'send-otp',
};

const UTILITY_JOBS = {
  PROCESS_AIRTIME: 'process-airtime',
  PROCESS_DATA: 'process-data',
  PROCESS_CABLE: 'process-cable',
  PROCESS_ELECTRICITY: 'process-electricity',
  REFUND_FAILED: 'refund-failed',
  /** Re-query the provider for a payment whose initial response was `pending`.
   *  Scheduled with delay 30 s; auto-refunds after max attempts (5 min window).
   *  NB: BilalSada has no query endpoint, so this always resolves to a refund. */
  POLL_PENDING: 'poll-pending',
  /** Safety-net sweep: find payments stuck in PROCESSING/PENDING past the poll
   *  window (lost jobs, provider throws, worker downtime) and resolve them -
   *  re-query the provider, then complete if delivered or refund the customer.
   *  Runs every 5 minutes; the per-payment work is idempotent. */
  RECONCILE_STUCK: 'reconcile-stuck',
  /** Settle a payment from a provider-pushed callback (currently BilalSada,
   *  which has no query endpoint). Carries the verified webhook payload as the
   *  provider result and routes it through the same success/pending/failure
   *  branches as a poll. Purely additive: nothing enqueues this unless a
   *  verified webhook arrives, and handleResult's replay guard makes it a no-op
   *  once the payment is already terminal. */
  RESOLVE_FROM_WEBHOOK: 'resolve-from-webhook',
};

// A payment is "stuck" once it's been non-terminal for longer than the normal
// poll window (5 min) plus a safety margin. The reconcile sweep only touches
// rows older than this so it never races the live poll chain.
const STUCK_PAYMENT_GRACE_MS = 6 * 60 * 1000; // 6 minutes

// Phase 7 - pending poll cadence (provider reconciliation)
const POLL_CONFIG = {
  INTERVAL_MS: 30_000, // 30 s between polls
  MAX_ATTEMPTS: 10,    // ~5 minute window (10 × 30 s)
};

const RIDER_JOBS = {
  /** Nightly: scan rider docs and push DOC_EXPIRING_SOON if within 14 days. */
  CHECK_DOC_EXPIRY: 'check-doc-expiry',
  /** Every few minutes: reconcile DB rider availability with the live dispatch
   *  geo index - prune geo members whose heartbeat lapsed and flip sticky
   *  ONLINE riders who are no longer reachable back to OFFLINE. */
  RECONCILE_AVAILABILITY: 'reconcile-availability',
};

const REQUEST_JOBS = {
  /** Kick off rider matching for a request - emits ring 0 and schedules the
   *  next ring check via CHECK_RING_PROGRESS. Returns immediately, freeing
   *  the worker slot (no sleep). */
  BROADCAST_TO_RIDERS: 'broadcast-to-riders',
  /** Mid-ring check - if request was claimed → exit; else emit next ring or
   *  trigger auto-cancel. Re-queued by BROADCAST_TO_RIDERS with a delay. */
  CHECK_RING_PROGRESS: 'check-ring-progress',
  /** Settle request payment after completion */
  SETTLE_REQUEST: 'settle-request',
  /** Refund cancelled request */
  REFUND_REQUEST: 'refund-request',
  /** Auto-cancel unmatched requests after timeout */
  AUTO_CANCEL_UNMATCHED: 'auto-cancel-unmatched',
};

// --- Default job options ---
const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000, // 2s, 4s, 8s
  },
  removeOnComplete: {
    age: 86400, // Keep completed jobs for 24h
    count: 1000,
  },
  removeOnFail: {
    age: 604800, // Keep failed jobs for 7 days
  },
};

module.exports = {
  QUEUES,
  PAYMENT_JOBS,
  NOTIFICATION_JOBS,
  UTILITY_JOBS,
  REQUEST_JOBS,
  RIDER_JOBS,
  DEFAULT_JOB_OPTIONS,
  POLL_CONFIG,
  STUCK_PAYMENT_GRACE_MS,
  STUCK_WEBHOOK_GRACE_MS,
};

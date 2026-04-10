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
  DELIVERY: 'delivery-queue',
  UTILITY: 'utility-queue',
};

// --- Job types per queue ---

const PAYMENT_JOBS = {
  /** Process Monnify webhook — credit user wallet */
  PROCESS_MONNIFY_WEBHOOK: 'process-monnify-webhook',
  /** Process withdrawal — call Monnify disbursement API */
  PROCESS_WITHDRAWAL: 'process-withdrawal',
  /** Retry a failed transaction */
  RETRY_FAILED_TRANSACTION: 'retry-failed-transaction',
};

const NOTIFICATION_JOBS = {
  /** Send push notification via FCM */
  SEND_PUSH: 'send-push',
  /** Send SMS via Termii */
  SEND_SMS: 'send-sms',
  /** Send OTP via Termii */
  SEND_OTP: 'send-otp',
};

const DELIVERY_JOBS = {
  /** Broadcast new order to nearby riders */
  BROADCAST_TO_RIDERS: 'broadcast-to-riders',
  /** Settle delivery payment after completion */
  SETTLE_DELIVERY: 'settle-delivery',
  /** Auto-cancel unmatched orders after timeout */
  AUTO_CANCEL_UNMATCHED: 'auto-cancel-unmatched',
};

const UTILITY_JOBS = {
  /** Process VTPass airtime purchase */
  PROCESS_AIRTIME: 'process-airtime',
  /** Process VTPass data purchase */
  PROCESS_DATA: 'process-data',
  /** Process VTPass electricity payment */
  PROCESS_ELECTRICITY: 'process-electricity',
  /** Refund failed utility payment */
  REFUND_FAILED: 'refund-failed',
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
  DELIVERY_JOBS,
  UTILITY_JOBS,
  DEFAULT_JOB_OPTIONS,
};

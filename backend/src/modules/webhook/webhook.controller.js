const crypto = require('crypto');
const { prisma } = require('../../config/database');
const { config } = require('../../config');
const { ApiResponse } = require('../../utils/api-response');
const { logger } = require('../../utils/logger');
const katpayService = require('../../services/katpay.service');
const { Queue } = require('bullmq');
const { redis } = require('../../config/redis');
const { QUEUES, PAYMENT_JOBS, DEFAULT_JOB_OPTIONS } = require('../../queues/jobs');

const paymentQueue = new Queue(QUEUES.PAYMENT, { connection: redis });

// Resolve the merchant withdrawal a payout webhook refers to. katpayReference is
// not DB-unique, so guard against an ambiguous match rather than acting on an
// arbitrary row (which could refund/complete the WRONG withdrawal).
const findWithdrawalByKatpayRef = async (katpayRef) => {
  const rows = await prisma.merchantWalletTransaction.findMany({
    where: { katpayReference: katpayRef },
    take: 2,
  });
  if (rows.length > 1) {
    logger.error('Multiple withdrawals share one katpayReference - refusing to act', { katpayRef });
    return null;
  }
  return rows[0] || null;
};

// Apply a payout-failure signal: refund the merchant if the withdrawal is still
// in flight. Terminal states are handled WITHOUT throwing (so the webhook can be
// marked processed and KatPay stops retrying); only a genuine infra error during
// the refund propagates, leaving the event unprocessed for KatPay to retry.
const applyPayoutFailure = async (katpayRef, reason) => {
  const mwt = await findWithdrawalByKatpayRef(katpayRef);
  if (!mwt) return;
  if (mwt.status === 'COMPLETED') {
    logger.error('KatPay reports payout failed but withdrawal is already COMPLETED - manual reconciliation needed', {
      katpayRef, withdrawalId: mwt.id, reference: mwt.reference,
    });
    return;
  }
  if (mwt.status !== 'PROCESSING') return; // FAILED / REJECTED - already terminal
  const adminService = require('../admin/admin.service');
  await adminService.failWithdrawal(mwt.id, reason, { adminUserId: 'SYSTEM' });
};

/**
 * Handle KatPay webhook - wallet funding and payout confirmations.
 *
 * Security:
 * - HMAC-SHA256 signature verified against raw request body
 * - Timestamp freshness checked (5-minute window)
 * - Idempotency via X-KatPay-Delivery-Id
 */
const handleKatpay = async (req, res, next) => {
  try {
    const signature = req.headers['x-katpay-signature'];
    const timestamp = req.headers['x-katpay-timestamp'];
    const deliveryId = req.headers['x-katpay-delivery-id'];

    // Raw body is available because this route uses express.raw()
    const rawBody = req.body.toString('utf8');

    // 1. Verify timestamp freshness
    if (!katpayService.isTimestampFresh(timestamp)) {
      logger.warn('KatPay webhook timestamp too old or missing', { timestamp, ip: req.ip });
      return res.status(401).json(ApiResponse.error('Stale webhook'));
    }

    // 2. Verify HMAC signature
    if (!katpayService.verifyWebhookSignature(timestamp, rawBody, signature)) {
      logger.warn('Invalid KatPay webhook signature', { ip: req.ip, deliveryId });
      return res.status(401).json(ApiResponse.error('Invalid signature'));
    }

    const payload = JSON.parse(rawBody);
    // KatPay wraps event content under `data`. Event type lives at the root
    // (`event_type` for VA events, `event` for transfer payments). The header
    // `x-katpay-event` is not documented; we still honor it as a fallback.
    const data = payload.data || payload;
    const eventType = payload.event_type || payload.event || req.headers['x-katpay-event'];
    const transactionRef =
      deliveryId ||
      payload.event_id ||
      data.uuid ||
      data.transaction?.order_no ||
      data.merchant_reference ||
      data.reference ||
      `katpay-${Date.now()}`;

    // 3. Idempotency - short-circuit only when a prior delivery actually FINISHED
    // (processed === true). A row that exists but is still unprocessed means an
    // earlier attempt failed mid-way; KatPay's retry must re-enter and reprocess
    // (every downstream write is an idempotent compare-and-set). Treating mere
    // existence as "done" would turn a transient failure into a permanent one.
    const existing = await prisma.webhookEvent.findUnique({
      where: { transactionRef },
    });

    if (existing && existing.processed) {
      logger.info('Duplicate KatPay webhook ignored (already processed)', { transactionRef });
      return res.json(ApiResponse.success('Already processed'));
    }

    // 4. Log the event on first sighting (the row also acts as a uniqueness lock).
    if (!existing) {
      await prisma.webhookEvent.create({
        data: {
          provider: 'katpay',
          eventType: eventType || 'UNKNOWN',
          transactionRef,
          payload,
          processed: false,
        },
      });
    }

    // 5. Respond immediately - KatPay retries on non-2xx
    res.json(ApiResponse.success('Webhook received'));

    // 6. Queue processing asynchronously after response is sent
    setImmediate(async () => {
      try {
        switch (eventType) {
          case 'virtual_account.payment_received':
          case 'transaction.completed': {
            const accountNumber = data.virtual_account?.account_number;
            const amount = Number(data.transaction?.order_amount ?? 0);
            const ref = data.transaction?.order_no || transactionRef;
            await paymentQueue.add(
              PAYMENT_JOBS.PROCESS_KATPAY_WEBHOOK,
              { transactionRef, accountNumber, amount, ref, eventData: payload },
              DEFAULT_JOB_OPTIONS
            );
            break;
          }

          case 'transfer_payment.completed': {
            const amount = Number(data.amount_received ?? data.amount ?? 0);
            const metadata = data.metadata || {};
            const ref = data.merchant_reference || transactionRef;
            await paymentQueue.add(
              PAYMENT_JOBS.PROCESS_TRANSFER_PAYMENT_WEBHOOK,
              { transactionRef, amount, ref, metadata, eventData: payload },
              DEFAULT_JOB_OPTIONS
            );
            break;
          }

          // Defensive: KatPay only documents payout.processed, but some providers
          // reuse that event for failures (status in the payload) and/or emit
          // dedicated failure events. Route any failure signal to the refund path
          // so a bounced payout never leaves the merchant's funds stranded.
          case 'payout.failed':
          case 'payout.reversed':
          case 'payout.rejected':
          case 'payout.declined': {
            const katpayRef = data.reference;
            if (katpayRef) {
              const why = data.reason || data.message || eventType.replace('payout.', 'payout ');
              await applyPayoutFailure(katpayRef, why);
            }
            // Reached only if applyPayoutFailure didn't throw (transient infra
            // errors propagate to the outer catch, leaving the event unprocessed
            // so KatPay's retry re-enters).
            await prisma.webhookEvent.update({
              where: { transactionRef },
              data: { processed: true, processedAt: new Date() },
            });
            break;
          }

          case 'payout.processed': {
            const katpayRef = data.reference;
            const payoutStatus = String(data.status || data.transaction?.status || '').toLowerCase();
            if (katpayRef && /fail|revers|declin|cancel/.test(payoutStatus)) {
              // payout.processed actually carrying a failure status → refund.
              await applyPayoutFailure(katpayRef, `Payout ${payoutStatus}`);
            } else if (katpayRef) {
              const mwt = await findWithdrawalByKatpayRef(katpayRef);
              if (mwt) {
                // Complete MWT + mirror ledger atomically so a crash can't leave
                // them inconsistent. Conflict detection reads COMMITTED state (the
                // updateMany result), never a stale pre-write read.
                await prisma.$transaction(async (tx) => {
                  const completed = await tx.merchantWalletTransaction.updateMany({
                    where: { id: mwt.id, status: { in: ['PENDING', 'PROCESSING'] } },
                    data: { status: 'COMPLETED', processedAt: new Date() },
                  });
                  if (completed.count === 1) {
                    // New unified withdrawals carry a mirror Transaction on the
                    // merchant's User wallet (funds already debited at request
                    // time) → complete it. Legacy rows reserved funds in
                    // merchantWallet.pendingBalance → release that.
                    const ledger = await tx.transaction.findFirst({ where: { reference: mwt.reference } });
                    if (ledger) {
                      await tx.transaction.updateMany({
                        where: { id: ledger.id, status: { in: ['PENDING', 'PROCESSING'] } },
                        data: { status: 'COMPLETED' },
                      });
                    } else {
                      await tx.merchantWallet.update({
                        where: { id: mwt.merchantWalletId },
                        data: { pendingBalance: { decrement: mwt.amount } },
                      });
                    }
                  } else {
                    // Didn't win the completion - re-read committed state. If a
                    // fail/refund beat us, the payout both SUCCEEDED (per KatPay)
                    // and was refunded: a hard conflict for a human to reconcile.
                    const fresh = await tx.merchantWalletTransaction.findUnique({ where: { id: mwt.id } });
                    if (fresh && fresh.status === 'FAILED') {
                      logger.error('Payout reported success AFTER being failed/refunded - manual reconciliation needed', {
                        withdrawalId: mwt.id, reference: mwt.reference, katpayRef,
                      });
                    }
                  }
                });
              }
            }
            await prisma.webhookEvent.update({
              where: { transactionRef },
              data: { processed: true, processedAt: new Date() },
            });
            break;
          }

          default:
            logger.info('KatPay webhook event type not handled', { eventType, transactionRef });
            await prisma.webhookEvent.update({
              where: { transactionRef },
              data: { processed: true, processedAt: new Date() },
            });
        }
      } catch (err) {
        logger.error('KatPay webhook async processing failed', { transactionRef, error: err.message });
        await prisma.webhookEvent.update({
          where: { transactionRef },
          data: { error: err.message },
        }).catch(() => {});
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Meta uses `X-Hub-Signature-256: sha256=<hex>`. Constant-time compare to
 * avoid leaking signature shape via response timing.
 */
const verifyWhatsappSignature = (rawBody, header) => {
  if (!header || !config.WHATSAPP_APP_SECRET) return false;
  const expected = crypto
    .createHmac('sha256', config.WHATSAPP_APP_SECRET)
    .update(rawBody)
    .digest('hex');
  const provided = String(header).replace(/^sha256=/i, '');
  // crypto.timingSafeEqual throws on length mismatch - bail early in that case.
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(expected, 'hex'));
};

/**
 * GET handshake. Meta calls this once at webhook setup with:
 *   ?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=<string>
 * We echo `hub.challenge` back as plain text iff the token matches.
 *
 * NOTE: the /webhooks router mounts express.raw - for GETs the body is
 * empty, so req.query is the only thing we need.
 */
const verifyWhatsapp = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (!config.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    logger.warn('WhatsApp webhook verify attempted but WHATSAPP_WEBHOOK_VERIFY_TOKEN is unset');
    return res.status(503).send('verify token not configured');
  }

  if (mode === 'subscribe' && token === config.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    logger.info('WhatsApp webhook verified');
    return res.status(200).send(String(challenge ?? ''));
  }

  logger.warn('WhatsApp webhook verify failed', { mode, ip: req.ip });
  return res.status(403).send('forbidden');
};

/**
 * Handle WhatsApp Cloud API events. We currently consume:
 *   - statuses[] entries (sent / delivered / read / failed) - for visibility
 *     into actual OTP delivery rates and to surface "user doesn't have
 *     WhatsApp" failures (Meta error 131026) in logs.
 *
 * Inbound messages (entry.messages[]) are accepted but not acted on - the
 * app is not a chat product. We just log + 200 so Meta stops retrying.
 *
 * Security:
 *  - HMAC-SHA256 over raw body, compared constant-time
 *  - Idempotency via entry[].changes[].value.statuses[].id (one row per
 *    status transition, since the same message_id receives sent → delivered → read)
 */
const handleWhatsapp = async (req, res, next) => {
  try {
    const signature = req.headers['x-hub-signature-256'];
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');

    if (!verifyWhatsappSignature(rawBody, signature)) {
      logger.warn('Invalid WhatsApp webhook signature', { ip: req.ip });
      return res.status(401).json(ApiResponse.error('Invalid signature'));
    }

    const payload = JSON.parse(rawBody.toString('utf8') || '{}');

    // Respond fast - Meta retries aggressively on non-2xx within ~5s.
    res.status(200).json(ApiResponse.success('Webhook received'));

    setImmediate(async () => {
      try {
        const entries = Array.isArray(payload.entry) ? payload.entry : [];
        for (const entry of entries) {
          const changes = Array.isArray(entry.changes) ? entry.changes : [];
          for (const change of changes) {
            const value = change.value || {};
            const statuses = Array.isArray(value.statuses) ? value.statuses : [];

            for (const s of statuses) {
              const ref = `whatsapp:${s.id}:${s.status}`;
              const existing = await prisma.webhookEvent.findUnique({
                where: { transactionRef: ref },
              });
              if (existing) continue;

              const errorReason = Array.isArray(s.errors) && s.errors[0]
                ? `${s.errors[0].code}: ${s.errors[0].title || s.errors[0].message || ''}`.trim()
                : null;

              await prisma.webhookEvent.create({
                data: {
                  provider: 'whatsapp',
                  eventType: `status.${s.status}`,
                  transactionRef: ref,
                  payload: { status: s, metadata: value.metadata || null },
                  processed: true,
                  processedAt: new Date(),
                  ...(errorReason ? { error: errorReason } : {}),
                },
              }).catch((err) => {
                // Don't let log-only failures crash the async tick; webhook
                // already responded 200 to Meta.
                logger.warn('WhatsApp webhook persist failed (non-fatal)', { ref, error: err.message });
              });

              if (s.status === 'failed') {
                logger.warn('WhatsApp message delivery failed', {
                  messageId: s.id,
                  recipient: s.recipient_id ? `***${String(s.recipient_id).slice(-4)}` : null,
                  reason: errorReason,
                });
              }
            }

            // Inbound messages - accepted but not consumed.
            const messages = Array.isArray(value.messages) ? value.messages : [];
            if (messages.length) {
              logger.info('WhatsApp inbound messages received (not processed)', {
                count: messages.length,
              });
            }
          }
        }
      } catch (err) {
        logger.error('WhatsApp webhook async processing failed', { error: err.message });
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  handleKatpay,
  verifyWhatsapp,
  handleWhatsapp,
};

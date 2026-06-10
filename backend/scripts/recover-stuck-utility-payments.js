/**
 * Recovery for utility payments stranded in PROCESSING/PENDING with the
 * customer's wallet already debited.
 *
 * Why payments get stuck: when AlRahuz returns a non-2xx (e.g. the reseller
 * wallet is empty), the buy call THROWS instead of returning a failure body,
 * so the worker's "mark FAILED + refund" branch never runs. BullMQ retries a
 * few times then permanently fails, and nothing refunds the customer. The same
 * happens if poll jobs are lost on a Redis restart or the worker was down.
 *
 * What this does (per payment, idempotent):
 *   Re-queries AlRahuz by providerRequestId via the worker's reconciler, then:
 *     - delivered   → marks COMPLETED (no refund)
 *     - still pending within the window → reschedules a poll
 *     - failed / never accepted / window exhausted → marks FAILED + refunds
 *   This is the SAME logic the every-5-minute cron sweep runs, so it's safe to
 *   run by hand for an immediate fix.
 *
 * Usage (from backend/):
 *   node scripts/recover-stuck-utility-payments.js            # dry-run, lists candidates
 *   node scripts/recover-stuck-utility-payments.js --apply    # reconcile them now
 *   node scripts/recover-stuck-utility-payments.js --apply --olderThanMinutes=5
 *   node scripts/recover-stuck-utility-payments.js --apply --id=<paymentId>
 *
 * Note: refunds are written inline by the reconciler (pure DB credit), so the
 * worker does NOT need to be running for the money to be returned. A rescheduled
 * poll (only for genuinely-pending provider responses) does need the worker.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { prisma } = require('../src/config/database');
const { reconcileOnePayment } = require('../src/queues/workers/utility.worker');
const { logger } = require('../src/utils/logger');

const parseArgs = () => {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const olderArg = args.find((a) => a.startsWith('--olderThanMinutes='));
  const olderThanMinutes = olderArg ? Number(olderArg.split('=')[1]) : 10;
  const idArg = args.find((a) => a.startsWith('--id='));
  const id = idArg ? idArg.split('=')[1] : null;
  if (!Number.isFinite(olderThanMinutes) || olderThanMinutes < 0) {
    throw new Error(`--olderThanMinutes must be a non-negative number (got "${olderArg}")`);
  }
  return { apply, olderThanMinutes, id };
};

const main = async () => {
  const { apply, olderThanMinutes, id } = parseArgs();

  const where = id
    ? { id }
    : { status: { in: ['PROCESSING', 'PENDING'] }, createdAt: { lt: new Date(Date.now() - olderThanMinutes * 60 * 1000) } };

  const stuck = await prisma.utilityPayment.findMany({ where, orderBy: { createdAt: 'asc' } });

  console.log(
    id
      ? `Targeting payment ${id} (${stuck.length} match).`
      : `Found ${stuck.length} stuck utility payment(s) older than ${olderThanMinutes}m.`,
  );
  for (const p of stuck) {
    console.log(
      `  - ${p.id}  ${p.type.padEnd(11)} ₦${Number(p.amount)}  ${p.status.padEnd(10)}  ` +
      `user=${p.userId}  ref=${p.providerRequestId}  created=${p.createdAt.toISOString()}`,
    );
  }

  if (!apply) {
    console.log('\nDry-run. Re-run with --apply to reconcile (re-query → complete or refund).');
    return;
  }
  if (stuck.length === 0) {
    console.log('\nNothing to do.');
    return;
  }

  console.log(`\nReconciling ${stuck.length} payment(s)...`);
  for (const p of stuck) {
    try {
      await reconcileOnePayment(p.id);
      const after = await prisma.utilityPayment.findUnique({ where: { id: p.id }, select: { status: true } });
      console.log(`  ✓ ${p.id} → ${after?.status}`);
    } catch (err) {
      console.log(`  ✗ ${p.id} errored: ${err.message}`);
    }
  }

  console.log('\nDone. COMPLETED = provider had delivered; REFUNDED = customer made whole; PENDING = a fresh poll was scheduled (needs the worker running).');
};

main()
  .catch((err) => {
    logger.error('Recovery script failed', { error: err.message, stack: err.stack });
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode || 0);
  });

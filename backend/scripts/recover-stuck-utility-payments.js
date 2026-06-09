/**
 * One-off recovery for utility payments that got stuck in PROCESSING because
 * of the PROCESS_AIRTIME / process-airtime job-name mismatch in
 * utility.service.js. Affected payments were debited from the wallet at
 * enqueue time, but the worker silently dropped the job (default branch in
 * the switch statement), so AlRahuz was never called and the customer's
 * wallet was never refunded.
 *
 * What this does:
 *   1. Find UtilityPayment rows with status='PROCESSING' older than --olderThanMinutes
 *      (default 10) - anything fresher might still be in-flight legitimately.
 *   2. For each, enqueue a REFUND_FAILED job. The worker's `refundPayment`
 *      is idempotent (early-returns if status='REFUNDED' already), so
 *      re-running this is safe.
 *
 * Usage (from backend/):
 *   node scripts/recover-stuck-utility-payments.js            # dry-run, lists candidates
 *   node scripts/recover-stuck-utility-payments.js --apply    # actually enqueue refunds
 *   node scripts/recover-stuck-utility-payments.js --apply --olderThanMinutes=5
 *
 * Notes:
 *   - You MUST have the utility worker running for the refunds to actually
 *     fire - this script only enqueues. Start the worker (or the API
 *     process that starts it) before running with --apply.
 *   - Run AFTER deploying the job-name fix; otherwise new airtime/data/cable
 *     buys keep landing in PROCESSING and you'll be chasing your tail.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { prisma } = require('../src/config/database');
const { utilityQueue } = require('../src/queues');
const { UTILITY_JOBS } = require('../src/queues/jobs');
const { logger } = require('../src/utils/logger');

const parseArgs = () => {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const olderArg = args.find((a) => a.startsWith('--olderThanMinutes='));
  const olderThanMinutes = olderArg ? Number(olderArg.split('=')[1]) : 10;
  if (!Number.isFinite(olderThanMinutes) || olderThanMinutes < 0) {
    throw new Error(`--olderThanMinutes must be a non-negative number (got "${olderArg}")`);
  }
  return { apply, olderThanMinutes };
};

const main = async () => {
  const { apply, olderThanMinutes } = parseArgs();
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);

  const stuck = await prisma.utilityPayment.findMany({
    where: { status: 'PROCESSING', createdAt: { lt: cutoff } },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${stuck.length} stuck utility payment(s) older than ${olderThanMinutes}m.`);
  for (const p of stuck) {
    console.log(
      `  - ${p.id}  ${p.type.padEnd(11)} ₦${Number(p.amount)}  ` +
      `user=${p.userId}  ref=${p.providerRequestId}  created=${p.createdAt.toISOString()}`,
    );
  }

  if (!apply) {
    console.log('\nDry-run. Re-run with --apply to enqueue refunds.');
    return;
  }

  if (stuck.length === 0) {
    console.log('\nNothing to do.');
    return;
  }

  console.log(`\nEnqueuing ${stuck.length} REFUND_FAILED job(s)...`);
  for (const p of stuck) {
    await utilityQueue.add(
      UTILITY_JOBS.REFUND_FAILED,
      {
        paymentId: p.id,
        userId: p.userId,
        amount: Number(p.amount),
        reference: p.providerRequestId,
      },
      { attempts: 3, removeOnComplete: { age: 3600, count: 200 }, removeOnFail: { age: 86400 } },
    );
    console.log(`  ✓ enqueued refund for ${p.id}`);
  }

  console.log('\nDone. Make sure the utility worker is running so the refunds actually process.');
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

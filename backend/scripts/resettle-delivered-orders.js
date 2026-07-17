/**
 * resettle-delivered-orders.js - one-time corrective backfill.
 *
 * The settlement worker used to reference a `merchantWallet` relation on the
 * Merchant model that had been renamed to `wallet`. Prisma validates the whole
 * `include` up front, so `settleRequest` threw a PrismaClientValidationError
 * before doing any work - for EVERY delivered order, cash or wallet. The result:
 * orders wedged in status=DELIVERED with settledAt=null, riders never paid /
 * stats frozen, no transactions written, and (for wallet orders) money frozen
 * in PLATFORM_ESCROW.
 *
 * The worker is now fixed. This script finds every order still stuck in
 * DELIVERED (settledAt=null) and re-enqueues SETTLE_REQUEST so the corrected
 * worker settles it. Settlement is idempotent - it only runs while the request
 * is DELIVERED and flips it to SETTLED, so re-running this (or double-enqueuing)
 * cannot double-pay.
 *
 * The running server process must have the request worker up to actually drain
 * these jobs; this script only enqueues them.
 *
 * Usage (from the backend/ folder, with your DB + Redis running):
 *   node scripts/resettle-delivered-orders.js           # dry run - prints what it would do
 *   node scripts/resettle-delivered-orders.js --apply   # actually enqueue settlement
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { prisma } = require('../src/config/database');
const { requestQueue } = require('../src/queues');
const { REQUEST_JOBS } = require('../src/queues/jobs');

const APPLY = process.argv.includes('--apply');

async function main() {
  const stuck = await prisma.request.findMany({
    where: { status: 'DELIVERED', settledAt: null },
    select: {
      id: true,
      type: true,
      paymentMethod: true,
      total: true,
      riderId: true,
      merchantId: true,
      deliveredAt: true,
    },
    orderBy: { deliveredAt: 'asc' },
  });

  console.log(`Found ${stuck.length} order(s) stuck in DELIVERED with settledAt=null.`);
  console.log(APPLY ? 'MODE: APPLY (settlement will be enqueued)\n' : 'MODE: DRY RUN (no jobs enqueued)\n');

  let enqueued = 0;
  for (const r of stuck) {
    console.log(
      `- ${r.id} (${r.type}, ${r.paymentMethod}, ₦${Number(r.total || 0).toLocaleString('en-NG')}, ` +
        `rider=${r.riderId || 'none'}, merchant=${r.merchantId || 'none'})`,
    );
    if (APPLY) {
      await requestQueue.add(
        REQUEST_JOBS.SETTLE_REQUEST,
        { requestId: r.id },
        {
          // Same retry policy as the live DELIVERED path so a transient failure
          // during the backfill doesn't silently re-strand the order.
          attempts: 5,
          backoff: { type: 'exponential', delay: 5000 },
        },
      );
      enqueued += 1;
    }
  }

  console.log(
    `\n${APPLY ? 'Enqueued' : 'Would enqueue'} settlement for ${APPLY ? enqueued : stuck.length} order(s).`,
  );
  if (!APPLY && stuck.length > 0) {
    console.log('Re-run with --apply to enqueue settlement (server worker must be running to drain it).');
  }
}

main()
  .catch((err) => {
    console.error('Failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    try {
      await requestQueue.close();
    } catch (_) {}
  });

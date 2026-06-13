/**
 * release-stuck-withdrawals.js - corrective refund for withdrawals/transfers
 * stranded in PROCESSING with the customer's wallet already debited.
 *
 * Why they got stuck: the payment worker claims a payout by flipping the
 * transaction PROCESSING -> SENT *before* calling KatPay (an at-most-once
 * dispatch lock). But SENT was missing from the TransactionStatus enum, so the
 * Prisma client threw on that very update - BEFORE initiatePayout was ever
 * called. The job kept throwing on every retry, so the payout was NEVER
 * dispatched and the row never left PROCESSING. The wallet stays debited and
 * the worker's own refund branch (which only runs on a definitive KatPay
 * rejection) never fires.
 *
 * Because the payout was never dispatched, the cash definitively did NOT leave
 * KatPay - so crediting the wallet back is safe. This script does exactly that,
 * mirroring the worker's refundFailedWithdrawal (idempotent + race-safe).
 *
 * Scope: type=WITHDRAWAL, status=PROCESSING only.
 *   - We never touch SENT: post-fix, SENT means "dispatched, outcome unknown"
 *     and must be reconciled, not blindly refunded.
 *   - A createdAt age filter (default 15m) avoids racing a brand-new transfer
 *     whose worker job is legitimately mid-flight. The PROCESSING->FAILED
 *     compare-and-set is the real guard: if the (now-fixed) worker claims the
 *     row to SENT first, our update matches 0 rows and we skip it; if we flip it
 *     to FAILED first, the worker's PROCESSING claim matches 0 and it bows out.
 *     So a payout and a refund can never both happen.
 *
 * Run order: safe to run before OR after deploying the enum fix. Running it
 * clears the existing backlog; new transfers flow normally once the migration +
 * regenerated client are deployed.
 *
 * Usage (from the backend/ folder, with your DB reachable):
 *   node scripts/release-stuck-withdrawals.js                       # dry-run, lists candidates
 *   node scripts/release-stuck-withdrawals.js --apply               # refund them now
 *   node scripts/release-stuck-withdrawals.js --apply --olderThanMinutes=30
 *   node scripts/release-stuck-withdrawals.js --apply --ref=TRF-<uuid>   # one specific transaction
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { prisma } = require('../src/config/database');
const notifyService = require('../src/services/notify.service');
const { logger } = require('../src/utils/logger');

const parseArgs = () => {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const olderArg = args.find((a) => a.startsWith('--olderThanMinutes='));
  const olderThanMinutes = olderArg ? Number(olderArg.split('=')[1]) : 15;
  const refArg = args.find((a) => a.startsWith('--ref='));
  const ref = refArg ? refArg.split('=')[1] : null;
  if (!Number.isFinite(olderThanMinutes) || olderThanMinutes < 0) {
    throw new Error(`--olderThanMinutes must be a non-negative number (got "${olderArg}")`);
  }
  return { apply, olderThanMinutes, ref };
};

const money = (n) => Number(Number(n).toFixed(2));

/**
 * Idempotent + race-safe refund of one never-dispatched withdrawal. Returns one
 * of: 'refunded' | 'already' (REF row exists) | 'skipped' (lost the
 * compare-and-set: worker claimed it, or it was already terminal) | 'no-wallet'.
 */
const refundOne = async (t) => {
  const refRef = `REF-${t.reference}`;
  const amount = money(t.amount);

  const already = await prisma.transaction.findUnique({ where: { reference: refRef } });
  if (already) return { outcome: 'already' };

  const result = await prisma.$transaction(async (tx) => {
    // Only the caller that flips PROCESSING->FAILED performs the credit.
    const claim = await tx.transaction.updateMany({
      where: { reference: t.reference, status: 'PROCESSING' },
      data: { status: 'FAILED' },
    });
    if (claim.count !== 1) return { outcome: 'skipped' };

    if (!t.debitWalletId) return { outcome: 'no-wallet' };
    const wallet = await tx.wallet.findUnique({ where: { id: t.debitWalletId } });
    if (!wallet) return { outcome: 'no-wallet' };

    const before = Number(wallet.balance);
    await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { increment: amount } } });
    await tx.transaction.create({
      data: {
        reference: refRef,
        type: 'REFUND',
        status: 'COMPLETED',
        amount,
        description: 'Transfer reversed - payout was never dispatched',
        creditWalletId: wallet.id,
        provider: 'KATPAY',
        balanceBefore: before,
        balanceAfter: before + amount,
      },
    });
    return { outcome: 'refunded', userId: wallet.userId, newBalance: before + amount };
  }).catch((e) => {
    // REF row already exists (a concurrent run / the worker refunded) -> P2002
    // rolls back; treat as already handled.
    logger.warn('Stuck-withdrawal refund skipped - already handled', { reference: t.reference, error: e.message });
    return { outcome: 'skipped' };
  });

  // Best-effort, post-commit: surface the refund to the user. Socket emits won't
  // reach the user from a one-off process, but the in-app + push paths persist.
  if (result.outcome === 'refunded' && result.userId) {
    notifyService.balanceUpdated(result.userId, { balance: result.newBalance });
    await notifyService.onWalletEvent(result.userId, {
      kind: 'REFUND',
      amount,
      transactionId: refRef,
      route: '/wallet',
      description: 'Your transfer failed - funds returned to your wallet.',
    }).catch((err) => logger.warn('Stuck-withdrawal refund notification failed', { reference: t.reference, error: err.message }));
  }

  return result;
};

const main = async () => {
  const { apply, olderThanMinutes, ref } = parseArgs();

  const where = ref
    ? { reference: ref, type: 'WITHDRAWAL', status: 'PROCESSING' }
    : {
        type: 'WITHDRAWAL',
        status: 'PROCESSING',
        createdAt: { lt: new Date(Date.now() - olderThanMinutes * 60 * 1000) },
      };

  const stuck = await prisma.transaction.findMany({
    where,
    select: { reference: true, amount: true, debitWalletId: true, metadata: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(
    ref
      ? `Targeting ${ref} (${stuck.length} match).`
      : `Found ${stuck.length} stuck withdrawal/transfer(s) in PROCESSING older than ${olderThanMinutes}m.`,
  );
  console.log(apply ? 'MODE: APPLY (wallets will be credited back)\n' : 'MODE: DRY RUN (no changes)\n');

  let total = 0;
  for (const t of stuck) {
    const kind = t.metadata?.kind === 'transfer' ? 'transfer' : 'withdrawal';
    total += money(t.amount);
    console.log(
      `  - ${t.createdAt.toISOString().slice(0, 16)}  ${kind.padEnd(10)} ₦${money(t.amount).toLocaleString()}  ref=${t.reference}`,
    );
  }
  console.log(`\n${apply ? 'Refunding' : 'Would refund'} ₦${money(total).toLocaleString()} across ${stuck.length} transaction(s).`);

  if (!apply) {
    if (stuck.length > 0) console.log('Re-run with --apply to credit these wallets back.');
    return;
  }
  if (stuck.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  console.log('\nApplying refunds...');
  const tally = { refunded: 0, already: 0, skipped: 0, 'no-wallet': 0 };
  let refundedAmount = 0;
  for (const t of stuck) {
    try {
      const { outcome } = await refundOne(t);
      tally[outcome] = (tally[outcome] || 0) + 1;
      if (outcome === 'refunded') refundedAmount += money(t.amount);
      const mark = outcome === 'refunded' ? '✓' : outcome === 'already' ? '=' : '·';
      console.log(`  ${mark} ${t.reference} -> ${outcome}`);
    } catch (err) {
      console.log(`  ✗ ${t.reference} errored: ${err.message}`);
    }
  }

  console.log(
    `\nDone. refunded=${tally.refunded} (₦${money(refundedAmount).toLocaleString()}), ` +
      `already-refunded=${tally.already}, skipped=${tally.skipped}, no-wallet=${tally['no-wallet']}.`,
  );
};

main()
  .catch((err) => {
    logger.error('release-stuck-withdrawals failed', { error: err.message, stack: err.stack });
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode || 0);
  });

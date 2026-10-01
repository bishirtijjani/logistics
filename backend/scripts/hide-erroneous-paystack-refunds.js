/**
 * hide-erroneous-paystack-refunds.js
 *
 * Corrects the Paystack double-payout bug for a fixed set of withdrawals.
 *
 * Background: `paystack.service.toTransferReference()` lowercases the ledger
 * reference before sending it to Paystack, but the webhook + verifier looked the
 * row up by its uppercased `reference`, so a payout Paystack actually settled
 * was never marked COMPLETED. The nightly reconciliation then saw a "stuck"
 * withdrawal with no providerRef and refunded the wallet - paying the customer
 * twice (money left via Paystack AND was credited back).
 *
 * For each affected withdrawal this script, atomically:
 *   1. marks the erroneous REFUND row REVERSED + hiddenFromUser (kept for audit);
 *   2. marks the WITHDRAWAL row COMPLETED and stamps the Paystack reference;
 *   3. debits the wallet by the refunded amount;
 *   4. hides the matching "Refund credited" notifications.
 *
 * Net effect on the user: a normal completed withdrawal, no refund ever visible.
 * Ledger parity (Σ credits − Σ debits === balance) is restored.
 *
 * Every change is written to AuditLog with a full before/after snapshot and a
 * batch id, so it is fully reversible (see --reverse).
 *
 * Usage (inside the backend container / with the DB reachable):
 *   node scripts/hide-erroneous-paystack-refunds.js                 # dry run
 *   node scripts/hide-erroneous-paystack-refunds.js --apply
 *   node scripts/hide-erroneous-paystack-refunds.js --apply --batch=xyz
 *   node scripts/hide-erroneous-paystack-refunds.js --reverse --batch=xyz
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { prisma } = require('../src/config/database');
const { logger } = require('../src/utils/logger');

const ACTION = 'CORRECT_PAYSTACK_DOUBLE_REFUND';
const DEFAULT_BATCH = 'paystack-double-refund-20261001';

// The verified double-paid Paystack withdrawals (money left + wallet refunded).
// Amount = the refund total (withdrawal amount + the ₦20 user fee).
const TARGETS = [
  { withdrawal: 'WIT-75a4158c-4513-464e-9892-3a604de0046e', refund: 'REF-WIT-75a4158c-4513-464e-9892-3a604de0046e', amount: 1520, transferCode: 'TRF_cg1izlwnhwpyuuuc' },
  { withdrawal: 'TRF-645e7309-7747-4d33-bdd8-225a4a74434d', refund: 'REF-TRF-645e7309-7747-4d33-bdd8-225a4a74434d', amount: 978, transferCode: 'TRF_8rwlkst63136cvhp' },
  { withdrawal: 'TRF-7f5bf41a-6f3a-4041-88c4-5195da3427ad', refund: 'REF-TRF-7f5bf41a-6f3a-4041-88c4-5195da3427ad', amount: 2020, transferCode: 'TRF_2v0co3cas30rv3fu' },
  { withdrawal: 'TRF-6e51d74d-5e35-469f-9841-8cfeb5f56491', refund: 'REF-TRF-6e51d74d-5e35-469f-9841-8cfeb5f56491', amount: 220, transferCode: 'TRF_oici73wfxd72s4uj' },
  { withdrawal: 'TRF-f9d5c096-2a58-4239-9c23-ffd86e84b10a', refund: 'REF-TRF-f9d5c096-2a58-4239-9c23-ffd86e84b10a', amount: 5020, transferCode: 'TRF_y4mlr0hcj735dcmd' },
  { withdrawal: 'TRF-505b9bed-5aa2-426d-ae92-3840cd5c5fb3', refund: 'REF-TRF-505b9bed-5aa2-426d-ae92-3840cd5c5fb3', amount: 2020, transferCode: 'TRF_u4xhfz0t9grymimc' },
  { withdrawal: 'TRF-1f9a58b7-d933-4413-96c3-3c9fa6b10d77', refund: 'REF-TRF-1f9a58b7-d933-4413-96c3-3c9fa6b10d77', amount: 2020, transferCode: 'TRF_0uhczyj9gw2149vx' },
  // Live-test transaction (owner's test account).
  { withdrawal: 'TRF-75d5652b-7264-4ae8-a6f9-9f193baa7155', refund: 'REF-TRF-75d5652b-7264-4ae8-a6f9-9f193baa7155', amount: 170, transferCode: 'TRF_8v7cf21t6x5bn34z' },
];

const NOTIF_WINDOW_MS = 20 * 1000;

const parseArgs = () => {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const reverse = args.includes('--reverse');
  const batchArg = args.find((a) => a.startsWith('--batch='));
  return { apply, reverse, batch: batchArg ? batchArg.split('=')[1] : DEFAULT_BATCH };
};

const money = (n) => Number(Number(n).toFixed(2));

const loadTarget = async (t) => {
  const [withdrawal, refund] = await Promise.all([
    prisma.transaction.findUnique({ where: { reference: t.withdrawal } }),
    prisma.transaction.findUnique({ where: { reference: t.refund } }),
  ]);
  return { t, withdrawal, refund };
};

/** Apply one correction. Returns { outcome, ... }. */
const applyOne = async (t, loaded, batch) => {
  const { withdrawal, refund } = loaded;

  if (!withdrawal || !refund) return { outcome: 'missing' };
  if (refund.hiddenFromUser && refund.status === 'REVERSED' && withdrawal.status === 'COMPLETED') {
    return { outcome: 'already' };
  }
  if (money(refund.amount) !== money(t.amount)) {
    return { outcome: 'amount_mismatch', expected: t.amount, found: money(refund.amount) };
  }
  if (refund.status !== 'COMPLETED') {
    return { outcome: 'refund_not_completed', status: refund.status };
  }

  const walletId = refund.creditWalletId || withdrawal.debitWalletId;
  if (!walletId) return { outcome: 'no_wallet' };
  const wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
  if (!wallet) return { outcome: 'no_wallet' };

  const walletBefore = Number(wallet.balance);
  if (walletBefore < money(t.amount)) {
    return { outcome: 'insufficient', balance: walletBefore, needed: money(t.amount) };
  }
  const walletAfter = money(walletBefore - money(t.amount));

  const result = await prisma.$transaction(async (tx) => {
    // 1. Reverse + hide the refund (CAS on hiddenFromUser=false => at most once).
    const rev = await tx.transaction.updateMany({
      where: { reference: t.refund, hiddenFromUser: false },
      data: { status: 'REVERSED', hiddenFromUser: true },
    });
    if (rev.count !== 1) return { outcome: 'race' };

    // 2. The withdrawal really succeeded -> COMPLETED + stamp the Paystack ref.
    await tx.transaction.updateMany({
      where: { reference: t.withdrawal },
      data: { status: 'COMPLETED', providerRef: t.withdrawal.toLowerCase() },
    });

    // 3. Debit the wallet.
    await tx.wallet.update({ where: { id: walletId }, data: { balance: { decrement: money(t.amount) } } });

    // 4. Audit snapshot (before/after) so this is reversible.
    await tx.auditLog.create({
      data: {
        adminUserId: 'SYSTEM',
        action: ACTION,
        entityType: 'TRANSACTION',
        entityId: t.refund,
        details: {
          batchId: batch,
          refundRef: t.refund,
          withdrawalRef: t.withdrawal,
          amount: money(t.amount),
          transferCode: t.transferCode,
          walletId,
          userId: wallet.userId,
          walletBefore,
          walletAfter,
          originalRefundStatus: refund.status,
          originalWithdrawalStatus: withdrawal.status,
          reason: 'Erroneous Paystack payout refund reversed (reference case-mismatch bug)',
          appliedAt: new Date().toISOString(),
        },
      },
    });

    return { outcome: 'applied', walletId, userId: wallet.userId, walletBefore, walletAfter };
  });

  // 5. Hide the matching "Refund credited" notice(s) (best-effort, post-commit).
  const around = refund.createdAt ? new Date(refund.createdAt) : new Date();
  const notif = await prisma.notification.updateMany({
    where: {
      userId: wallet.userId,
      type: 'REFUND',
      hiddenFromUser: false,
      createdAt: {
        gte: new Date(around.getTime() - NOTIF_WINDOW_MS),
        lte: new Date(around.getTime() + NOTIF_WINDOW_MS),
      },
    },
    data: { hiddenFromUser: true },
  });

  return { ...result, notificationsHidden: notif.count };
};

/** Reverse one correction from its AuditLog entry. */
const reverseOne = async (log) => {
  const d = log.details || {};
  const wallet = await prisma.wallet.findUnique({ where: { id: d.walletId } });
  if (!wallet) return { outcome: 'no_wallet' };

  return prisma.$transaction(async (tx) => {
    const restore = await tx.transaction.updateMany({
      where: { reference: d.refundRef, hiddenFromUser: true },
      data: { status: 'COMPLETED', hiddenFromUser: false },
    });
    if (restore.count !== 1) return { outcome: 'already' };

    await tx.transaction.updateMany({
      where: { reference: d.withdrawalRef },
      data: { status: d.originalWithdrawalStatus || 'FAILED', providerRef: null },
    });
    await tx.wallet.update({ where: { id: d.walletId }, data: { balance: { increment: money(d.amount) } } });
    await tx.auditLog.update({
      where: { id: log.id },
      data: { details: { ...d, reversedAt: new Date().toISOString() } },
    });
    return { outcome: 'reversed' };
  });
};

const main = async () => {
  const { apply, reverse, batch } = parseArgs();
  console.log(`Mode: ${reverse ? 'REVERSE' : apply ? 'APPLY' : 'DRY RUN'}  batch=${batch}\n`);

  if (reverse) {
    const logs = await prisma.auditLog.findMany({ where: { action: ACTION } });
    const mine = logs.filter((l) => l.details && l.details.batchId === batch && !l.details.reversedAt);
    console.log(`Found ${mine.length} applied correction(s) to reverse.`);
    for (const l of mine) {
      const r = await reverseOne(l);
      console.log(`  ${r.outcome === 'reversed' ? '↩' : '·'} ${l.details.refundRef} -> ${r.outcome}`);
    }
    return;
  }

  const total = TARGETS.reduce((s, t) => s + money(t.amount), 0);
  console.log(`Targets: ${TARGETS.length}, total to debit ₦${total.toLocaleString()}\n`);

  let applied = 0;
  let appliedTotal = 0;
  for (const t of TARGETS) {
    const loaded = await loadTarget(t);
    const { withdrawal, refund } = loaded;
    const who = refund?.description || withdrawal?.description || '';
    if (!apply) {
      const wallet = refund?.creditWalletId
        ? await prisma.wallet.findUnique({ where: { id: refund.creditWalletId } })
        : null;
      const okBalance = wallet ? Number(wallet.balance) >= money(t.amount) : false;
      console.log(
        `  ${t.withdrawal}  ₦${money(t.amount).toLocaleString()}  ` +
          `refund=${refund ? refund.status + (refund.hiddenFromUser ? '/hidden' : '') : 'MISSING'}  ` +
          `withdrawal=${withdrawal ? withdrawal.status : 'MISSING'}  ` +
          `balance=${wallet ? Number(wallet.balance) : '?'} ${okBalance ? '(ok)' : '(INSUFFICIENT)'}  ${who}`,
      );
      continue;
    }
    const r = await applyOne(t, loaded, batch);
    if (r.outcome === 'applied') {
      applied += 1;
      appliedTotal += money(t.amount);
      console.log(`  ✓ ${t.withdrawal} -> wallet ${r.walletBefore} → ${r.walletAfter}, hid ${r.notificationsHidden} notice(s)`);
    } else {
      console.log(`  · ${t.withdrawal} -> ${r.outcome}${r.status ? ` (${r.status})` : ''}${r.balance != null ? ` balance=${r.balance}` : ''}`);
    }
  }

  if (apply) {
    console.log(`\nDone. applied=${applied}, debited ₦${appliedTotal.toLocaleString()}, batch=${batch}`);
  } else {
    console.log('\nDry run only. Re-run with --apply to commit.');
  }
};

main()
  .catch((err) => {
    logger.error('hide-erroneous-paystack-refunds failed', { error: err.message, stack: err.stack });
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode || 0);
  });

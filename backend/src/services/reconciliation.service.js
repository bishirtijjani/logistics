/**
 * Ledger reconciliation service.
 *
 * Two invariants we care about for the daily check:
 *
 *   1. PER-WALLET LEDGER PARITY
 *      For every user wallet:
 *        Σ (completed credits to this wallet) − Σ (completed debits from this wallet) === wallet.balance
 *      If a wallet ever drifts from its transaction history, it means a wallet
 *      update happened outside the transaction-creating code paths - a bug we
 *      want loud, not silent.
 *
 *   2. ESCROW CONSERVATION
 *      Σ ESCROW_HOLD − (Σ ESCROW_RELEASE + Σ ESCROW_REFUND) === SystemWallet[PLATFORM_ESCROW].balance
 *      Any drift indicates either a missing release/refund (money trapped in
 *      escrow) or a release/refund that wasn't matched by a hold (over-pay).
 *
 * The service returns a structured report. Callers (cron worker, admin endpoint)
 * decide whether the drift is alertable based on the threshold.
 */

const { prisma } = require('../config/database');
const { logger } = require('../utils/logger');
const { getSetting } = require('./settings.service');

/**
 * Money-comparison helper. Decimals come back from Prisma as Decimal.js
 * instances or strings; coerce and round to two decimals for kobo precision.
 */
const round2 = (n) => Math.round(Number(n) * 100) / 100;

/**
 * Run the full reconciliation. Returns a JSON-serializable report.
 *
 * Heavy on a fresh DB scan; meant for off-peak (cron) or explicit admin calls.
 * Threshold parameter overrides the platform setting; defaults to ₦1 - anything
 * larger than rounding noise is worth investigating.
 */
const runReconciliation = async ({ threshold } = {}) => {
  const alertThreshold = Number(
    threshold ?? (await getSetting('reconciliation.alertThresholdNgn', 1)),
  );

  const startedAt = new Date();

  // 1. Per-wallet ledger parity ─────────────────────────────────────────────
  // Aggregate credits/debits in a single SQL pass each - N+1 across thousands
  // of wallets would blow the worker's wall time.
  const [credits, debits, wallets] = await Promise.all([
    prisma.transaction.groupBy({
      by: ['creditWalletId'],
      where: { status: 'COMPLETED', creditWalletId: { not: null } },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ['debitWalletId'],
      where: { status: 'COMPLETED', debitWalletId: { not: null } },
      _sum: { amount: true },
    }),
    prisma.wallet.findMany({
      select: { id: true, userId: true, balance: true },
    }),
  ]);

  const creditByWallet = new Map(credits.map((c) => [c.creditWalletId, Number(c._sum.amount || 0)]));
  const debitByWallet = new Map(debits.map((d) => [d.debitWalletId, Number(d._sum.amount || 0)]));

  const walletMismatches = [];
  let totalUserBalance = 0;
  for (const w of wallets) {
    const balance = Number(w.balance);
    totalUserBalance += balance;
    const expected = round2((creditByWallet.get(w.id) || 0) - (debitByWallet.get(w.id) || 0));
    const drift = round2(balance - expected);
    if (Math.abs(drift) >= alertThreshold) {
      walletMismatches.push({
        walletId: w.id,
        userId: w.userId,
        balance,
        expected,
        drift,
      });
    }
  }

  // 2. Escrow conservation ──────────────────────────────────────────────────
  const [holdAgg, releaseAgg, refundAgg, escrowWallet] = await Promise.all([
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { type: 'ESCROW_HOLD', status: 'COMPLETED' },
    }),
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { type: 'ESCROW_RELEASE', status: 'COMPLETED' },
    }),
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { type: 'ESCROW_REFUND', status: 'COMPLETED' },
    }),
    prisma.systemWallet.findUnique({ where: { id: 'PLATFORM_ESCROW' } }),
  ]);

  const totalHold = Number(holdAgg._sum.amount || 0);
  const totalRelease = Number(releaseAgg._sum.amount || 0);
  const totalRefund = Number(refundAgg._sum.amount || 0);
  const expectedEscrow = round2(totalHold - totalRelease - totalRefund);
  const actualEscrow = Number(escrowWallet?.balance || 0);
  const escrowDrift = round2(actualEscrow - expectedEscrow);

  // 3. Snapshot of system-level totals for the admin report ─────────────────
  const [earningsWallet, merchantWalletAgg] = await Promise.all([
    prisma.systemWallet.findUnique({ where: { id: 'PLATFORM_EARNINGS' } }),
    prisma.merchantWallet.aggregate({
      _sum: { availableBalance: true, pendingBalance: true },
    }),
  ]);

  // 4. Stuck withdrawals - payouts left on PROCESSING/SENT that no transfer
  // webhook settled. Unlike KatPay, Paystack exposes GET /transfer/verify
  // (paystackService.getTransferStatus), so an admin or a follow-up automation
  // can CONFIRM the real outcome before acting instead of guessing. We still only
  // surface them here - auto-refunding a payout that actually succeeded would
  // double-pay - so resolution stays a deliberate, confirmed step.
  const stuckAfterHours = Number(await getSetting('withdrawal.stuckAfterHours', 24));
  const stuckCutoff = new Date(startedAt.getTime() - stuckAfterHours * 60 * 60 * 1000);
  const stuckRows = await prisma.merchantWalletTransaction.findMany({
    where: { type: 'WITHDRAWAL', status: 'PROCESSING', processedAt: { lt: stuckCutoff } },
    select: { id: true, reference: true, amount: true, katpayReference: true, processedAt: true },
    take: 100,
  });
  const stuckWithdrawals = stuckRows.map((r) => ({
    id: r.id,
    reference: r.reference,
    amount: round2(r.amount),
    katpayReference: r.katpayReference,
    processingSince: r.processedAt,
  }));

  // Same hazard on the user/rider side: a Transaction(type=WITHDRAWAL) left on
  // PROCESSING means the payout job never reached a terminal state (its funds are
  // already debited). Parity also flags these as drift, but label them so ops can
  // act directly rather than chasing a generic mismatch.
  const stuckUserRows = await prisma.transaction.findMany({
    where: { type: 'WITHDRAWAL', status: { in: ['PROCESSING', 'SENT'] }, createdAt: { lt: stuckCutoff } },
    select: { id: true, reference: true, amount: true, status: true, providerRef: true, createdAt: true },
    take: 100,
  });
  const stuckUserWithdrawals = stuckUserRows.map((r) => ({
    id: r.id,
    reference: r.reference,
    amount: round2(r.amount),
    status: r.status,
    providerRef: r.providerRef,
    processingSince: r.createdAt,
  }));

  const report = {
    startedAt,
    finishedAt: new Date(),
    thresholdNgn: alertThreshold,
    totals: {
      userWalletBalance: round2(totalUserBalance),
      merchantAvailable: round2(Number(merchantWalletAgg._sum.availableBalance || 0)),
      merchantPending: round2(Number(merchantWalletAgg._sum.pendingBalance || 0)),
      platformEscrow: round2(actualEscrow),
      platformEarnings: round2(Number(earningsWallet?.balance || 0)),
    },
    escrow: {
      totalHold: round2(totalHold),
      totalRelease: round2(totalRelease),
      totalRefund: round2(totalRefund),
      expected: expectedEscrow,
      actual: round2(actualEscrow),
      drift: escrowDrift,
      ok: Math.abs(escrowDrift) < alertThreshold,
    },
    walletParity: {
      checked: wallets.length,
      mismatches: walletMismatches,
      ok: walletMismatches.length === 0,
    },
    withdrawals: {
      stuckAfterHours,
      stuckCount: stuckWithdrawals.length,
      stuck: stuckWithdrawals,
      ok: stuckWithdrawals.length === 0,
    },
    userWithdrawals: {
      stuckAfterHours,
      stuckCount: stuckUserWithdrawals.length,
      stuck: stuckUserWithdrawals,
      ok: stuckUserWithdrawals.length === 0,
    },
  };

  report.ok = report.escrow.ok && report.walletParity.ok && report.withdrawals.ok && report.userWithdrawals.ok;

  // Make zero-state visible. A reconciliation run with no wallets and no
  // transactions reports `ok: true` but tells us nothing useful - it could
  // mean a fresh DB or a corrupted one. The dedicated flag distinguishes
  // "all green" from "nothing to check".
  report.empty = wallets.length === 0 && totalHold === 0 && totalRelease === 0 && totalRefund === 0;
  if (report.empty) {
    logger.warn('Reconciliation ran on an empty ledger', { wallets: wallets.length });
  }

  return report;
};

/**
 * Persist a reconciliation report as an AuditLog row so admins have a history
 * trail without needing a separate table. Failed checks log at error level so
 * they show up in Sentry / log alerts.
 */
const persistReport = async (report) => {
  await prisma.auditLog.create({
    data: {
      adminUserId: 'SYSTEM',
      action: 'RECONCILIATION_RUN',
      entityType: 'LEDGER',
      entityId: 'PLATFORM_ESCROW',
      details: report,
    },
  });

  if (report.ok) {
    logger.info('Reconciliation OK', {
      totals: report.totals,
      escrowDrift: report.escrow.drift,
    });
  } else {
    logger.error('Reconciliation FAILED', {
      escrow: report.escrow,
      mismatches: report.walletParity.mismatches,
      stuckWithdrawals: report.withdrawals?.stuck,
      stuckUserWithdrawals: report.userWithdrawals?.stuck,
    });
  }
};

module.exports = {
  runReconciliation,
  persistReport,
};

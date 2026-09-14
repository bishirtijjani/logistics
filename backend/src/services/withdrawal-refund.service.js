/**
 * Withdrawal refund service - single source of truth for crediting a wallet
 * after a payout that must be reversed.
 *
 * Used by BOTH the payout worker (definitive rejection) and the nightly
 * reconciliation sweep (auto-refund of stuck rows never confirmed dispatched).
 * Centralising the money path keeps the fee handling identical everywhere:
 * every refund returns the FULL debit (amount + user-paid fee), matching the
 * enqueue-failure compensation in wallet.service.
 */

const { prisma } = require('../config/database');
const { logger } = require('../utils/logger');
const notifyService = require('./notify.service');

/**
 * Refund a withdrawal whose funds were debited but whose payout never
 * dispatched (or was definitively rejected). Idempotent + race-safe: the
 * REF-<id> existence check and the PROCESSING|SENT→FAILED compare-and-set mean
 * the wallet is credited back exactly once even under duplicate callers.
 *
 * Only mutates rows in PROCESSING or SENT. Never touches COMPLETED, REVERSED,
 * or already-FAILED rows, so a late provider success can never be double-paid.
 *
 * @returns {Promise<{refunded: boolean, reason?: string, total?: number}>}
 */
const refundFailedWithdrawal = async ({ transactionId, reason }) => {
  const existing = await prisma.transaction.findUnique({ where: { reference: transactionId } });
  if (!existing) return { refunded: false, reason: 'not_found' };
  if (['COMPLETED', 'FAILED', 'REVERSED'].includes(existing.status)) {
    return { refunded: false, reason: `status_is_${existing.status}` };
  }
  if (!existing.debitWalletId) return { refunded: false, reason: 'no_debit_wallet' };

  const refRef = `REF-${transactionId}`;
  const already = await prisma.transaction.findUnique({ where: { reference: refRef } });
  if (already) return { refunded: false, reason: 'already_refunded' };

  const totalRefund = Number(existing.amount) + Number(existing.fee || 0);

  const walletUserId = await prisma.$transaction(async (tx) => {
    // Only the caller that flips PROCESSING/SENT→FAILED performs the credit.
    // (PROCESSING = never dispatched; SENT = dispatched-but-rejected/never
    // confirmed, i.e. the money did not leave, so a refund is still safe.)
    const claim = await tx.transaction.updateMany({
      where: { reference: transactionId, status: { in: ['PROCESSING', 'SENT'] } },
      data: { status: 'FAILED' },
    });
    if (claim.count !== 1) return null;

    const wallet = await tx.wallet.findUnique({ where: { id: existing.debitWalletId } });
    if (!wallet) return null;
    const currentBalance = Number(wallet.balance);
    await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { increment: totalRefund } } });
    await tx.transaction.create({
      data: {
        reference: refRef,
        type: 'REFUND',
        status: 'COMPLETED',
        amount: totalRefund,
        description: `Withdrawal refund - payout rejected${reason ? ` (${reason})` : ''}`,
        creditWalletId: wallet.id,
        provider: 'KATPAY',
        balanceBefore: currentBalance,
        balanceAfter: currentBalance + totalRefund,
      },
    });
    return wallet.userId;
  });

  if (walletUserId === null) {
    logger.warn('Withdrawal refund skipped - lost a concurrent claim or wallet missing', { transactionId });
    return { refunded: false, reason: 'lost_race' };
  }

  logger.info('Withdrawal refunded', { transactionId, total: totalRefund });

  try {
    const refundedWallet = await prisma.wallet.findUnique({ where: { userId: walletUserId }, select: { balance: true } });
    if (refundedWallet) notifyService.balanceUpdated(walletUserId, { balance: Number(refundedWallet.balance) });
    notifyService.onWalletEvent(walletUserId, {
      kind: 'REFUND',
      amount: totalRefund,
      transactionId: refRef,
      route: '/wallet',
      description: 'Your withdrawal failed - funds returned to your wallet.',
    }).catch((err) => logger.warn('Withdrawal-refund notification failed', { error: err.message }));
  } catch (err) {
    logger.warn('Withdrawal-refund notification failed (non-fatal)', { transactionId, error: err.message });
  }

  return { refunded: true, total: totalRefund };
};

module.exports = { refundFailedWithdrawal };
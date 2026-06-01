/**
 * One-time migration: move spendable merchant earnings from the bespoke
 * `merchantWallet.availableBalance` into each merchant's User `wallet.balance`,
 * so merchants run on the single unified wallet (earnings + top-ups + VTU +
 * withdrawals all in one place — like riders).
 *
 * Idempotent: writes a deterministic `MIGRATE-MW-<merchantId>` Transaction and
 * skips any merchant already migrated. Only `availableBalance` is swept;
 * `pendingBalance` (funds reserved for in-flight LEGACY withdrawals) is LEFT in
 * place so those payouts resolve on their existing path — it's logged for ops.
 *
 * Run:  node scripts/migrate-merchant-wallets-to-user-wallet.js
 */
require('dotenv').config();
const { prisma } = require('../src/config/database');
const { logger } = require('../src/utils/logger');

async function main() {
  const wallets = await prisma.merchantWallet.findMany({
    include: { merchant: { select: { id: true, name: true, userId: true } } },
  });

  let migrated = 0;
  let skipped = 0;
  let pendingFlagged = 0;
  let movedTotal = 0;

  for (const mw of wallets) {
    const available = Number(mw.availableBalance);
    const pending = Number(mw.pendingBalance);
    const userId = mw.merchant?.userId;
    const ref = `MIGRATE-MW-${mw.merchantId}`;

    if (pending > 0) {
      pendingFlagged += 1;
      logger.warn('Merchant wallet has pendingBalance (in-flight legacy withdrawal) — left in place', {
        merchantId: mw.merchantId, name: mw.merchant?.name, pending,
      });
    }

    if (available <= 0) { skipped += 1; continue; }

    const already = await prisma.transaction.findUnique({ where: { reference: ref } });
    if (already) { skipped += 1; continue; }

    if (!userId) {
      logger.error('Merchant has no userId — cannot migrate balance', { merchantId: mw.merchantId, available });
      skipped += 1;
      continue;
    }

    const userWallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!userWallet) {
      logger.error('Merchant owner has no User wallet — cannot migrate balance', { merchantId: mw.merchantId, userId, available });
      skipped += 1;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      // Re-read inside the tx for safety (idempotency + concurrent runs).
      const fresh = await tx.merchantWallet.findUnique({ where: { id: mw.id } });
      const amt = Number(fresh.availableBalance);
      if (amt <= 0) return;
      const before = Number(userWallet.balance);

      await tx.wallet.update({ where: { id: userWallet.id }, data: { balance: { increment: amt } } });
      await tx.transaction.create({
        data: {
          reference: ref,
          type: 'MERCHANT_EARNING',
          status: 'COMPLETED',
          amount: amt,
          description: 'Migrated merchant earnings balance to unified wallet',
          creditWalletId: userWallet.id,
          balanceBefore: before,
          balanceAfter: before + amt,
          metadata: { migration: 'merchantWallet->userWallet', merchantId: mw.merchantId },
        },
      });
      await tx.merchantWallet.update({ where: { id: mw.id }, data: { availableBalance: 0 } });
      movedTotal += amt;
    });

    migrated += 1;
    logger.info('Migrated merchant available balance to User wallet', {
      merchantId: mw.merchantId, name: mw.merchant?.name, amount: available,
    });
  }

  console.log(`\n=== Merchant wallet migration complete ===`);
  console.log(`  merchants migrated: ${migrated}`);
  console.log(`  skipped (zero/already-migrated): ${skipped}`);
  console.log(`  total moved to User wallets: ₦${movedTotal.toLocaleString()}`);
  console.log(`  merchants with in-flight pendingBalance (left in place): ${pendingFlagged}\n`);
  process.exit(0);
}

main().catch((e) => { console.error('Migration failed:', e); process.exit(1); });

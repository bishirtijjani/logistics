/**
 * release-stuck-merchant-earnings.js - one-time corrective backfill.
 *
 * Before the settlement worker was corrected, a delivered order's merchant
 * earning was credited to MerchantWallet.pendingBalance and never promoted to
 * availableBalance - so merchants could see earnings but never withdraw them.
 * Settlement now credits availableBalance directly, but any earning that
 * settled BEFORE that change is still stranded in pendingBalance. This script
 * moves that stranded amount into availableBalance for every merchant wallet.
 *
 * pendingBalance legitimately also holds withdrawals that are mid-flight
 * (status PENDING or PROCESSING). Those must NOT be released - only the portion
 * of pendingBalance that exceeds in-flight withdrawals is stranded earnings.
 *
 * Safe to re-run: once stranded earnings are released, pendingBalance equals
 * in-flight withdrawals and nothing further is moved.
 *
 * Usage (from the backend/ folder, with your DB running + migrated):
 *   node scripts/release-stuck-merchant-earnings.js           # dry run - prints what it would do
 *   node scripts/release-stuck-merchant-earnings.js --apply   # actually move the balances
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { prisma } = require('../src/config/database');

const APPLY = process.argv.includes('--apply');
const money = (n) => Number(Number(n).toFixed(2));

async function main() {
  const wallets = await prisma.merchantWallet.findMany({
    select: { id: true, merchantId: true, availableBalance: true, pendingBalance: true },
  });

  console.log(`Scanning ${wallets.length} merchant wallet(s)…`);
  console.log(APPLY ? 'MODE: APPLY (balances will be updated)\n' : 'MODE: DRY RUN (no changes)\n');

  let affected = 0;
  let totalReleased = 0;

  for (const w of wallets) {
    const pending = Number(w.pendingBalance);
    if (pending <= 0) continue;

    // Withdrawals still in flight for this wallet - these rightfully sit in
    // pendingBalance and must be left untouched.
    const inFlightAgg = await prisma.merchantWalletTransaction.aggregate({
      where: {
        merchantWalletId: w.id,
        type: 'WITHDRAWAL',
        status: { in: ['PENDING', 'PROCESSING'] },
      },
      _sum: { amount: true },
    });
    const inFlight = Number(inFlightAgg._sum.amount || 0);

    const stranded = money(pending - inFlight);
    if (stranded <= 0) continue;

    affected += 1;
    totalReleased += stranded;
    console.log(
      `- wallet ${w.id} (merchant ${w.merchantId}): pending ₦${money(pending).toLocaleString()}, ` +
        `in-flight ₦${money(inFlight).toLocaleString()} → release ₦${stranded.toLocaleString()} to available`,
    );

    if (APPLY) {
      await prisma.merchantWallet.update({
        where: { id: w.id },
        data: {
          availableBalance: { increment: stranded },
          pendingBalance: { decrement: stranded },
        },
      });
    }
  }

  console.log(
    `\n${APPLY ? 'Released' : 'Would release'} ₦${money(totalReleased).toLocaleString()} ` +
      `across ${affected} wallet(s).`,
  );
  if (!APPLY && affected > 0) {
    console.log('Re-run with --apply to make these changes.');
  }
}

main()
  .catch((err) => {
    console.error('Failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

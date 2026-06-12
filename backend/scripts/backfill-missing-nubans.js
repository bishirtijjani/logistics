/**
 * backfill-missing-nubans.js
 *
 * One-off cleanup after the Paystack rollback. While Paystack was briefly live,
 * its Dedicated Virtual Account endpoint was gated, so any user who verified in
 * that window came out VERIFIED but with no NUBAN at all. This gives them a
 * KatPay NUBAN without making them re-verify.
 *
 * Finds every VERIFIED user whose wallet has no virtualAccountNumber and
 * provisions a KatPay NUBAN, then stores it on the wallet. Idempotent: a user
 * who already has a NUBAN is skipped, so re-running only handles what's left.
 * Each user is independent - one failure is logged and the run continues.
 *
 * Usage (from backend/, with KatPay keys set):
 *   node scripts/backfill-missing-nubans.js              # live run
 *   node scripts/backfill-missing-nubans.js --dry-run    # report only
 *   LIMIT=50 node scripts/backfill-missing-nubans.js     # cap this run
 *   DELAY_MS=400 node scripts/backfill-missing-nubans.js # throttle KatPay
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { prisma } = require('../src/config/database');
const katpayService = require('../src/services/katpay.service');

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity;
const DELAY_MS = process.env.DELAY_MS ? Number(process.env.DELAY_MS) : 300;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // Verified users whose wallet has no NUBAN yet.
  const wallets = await prisma.wallet.findMany({
    where: {
      virtualAccountNumber: null,
      user: { kycStatus: 'VERIFIED' },
    },
    select: {
      id: true,
      user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
    },
  });

  console.log(`Found ${wallets.length} verified user(s) with no NUBAN${DRY_RUN ? ' (DRY RUN)' : ''}.`);

  let done = 0;
  let skipped = 0;
  let failed = 0;

  for (const w of wallets) {
    if (done >= LIMIT) {
      console.log(`Reached LIMIT=${LIMIT}; stopping.`);
      break;
    }
    const u = w.user;
    if (!u?.email || !u?.phone) {
      console.warn(`SKIP wallet ${w.id}: user missing email or phone`);
      skipped += 1;
      continue;
    }

    if (DRY_RUN) {
      console.log(`DRY: would provision KatPay NUBAN for ${u.email}`);
      done += 1;
      continue;
    }

    try {
      const va = await katpayService.createVirtualAccount({
        email: u.email,
        name: `${u.firstName} ${u.lastName}`,
        phoneNumber: u.phone,
        bankCodes: ['PALMPAY', 'OPAY'],
      });

      await prisma.wallet.update({
        where: { id: w.id },
        data: {
          virtualAccountNumber: va.accountNumber,
          virtualAccountBank: va.bankName,
          virtualAccountName: va.accountName,
        },
      });

      done += 1;
      console.log(`OK ${u.email}: NUBAN ${va.accountNumber} (${va.bankName})`);
    } catch (err) {
      failed += 1;
      console.error(`FAIL ${u.email}: ${err.message}`);
    }

    await sleep(DELAY_MS);
  }

  console.log(`\nDone. provisioned=${done} skipped=${skipped} failed=${failed}`);
}

main()
  .catch((e) => {
    console.error('backfill-missing-nubans aborted:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

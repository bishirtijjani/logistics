/**
 * migrate-katpay-to-paystack-dva.js
 *
 * One-off cutover: give every eligible wallet a Paystack Dedicated Virtual
 * Account and retire its KatPay NUBAN.
 *
 * For each wallet that is NOT yet on Paystack (paystackCustomerCode is null):
 *   1. Copy the current KatPay NUBAN into `legacyKatpayAccountNumber` (so a
 *      straggler transfer to the old number still credits the wallet via the
 *      inbound KatPay webhook).
 *   2. Provision a Paystack DVA for the wallet's user.
 *   3. Overwrite virtualAccountNumber/Bank/Name with the Paystack DVA and store
 *      paystackCustomerCode + dedicatedAccountId.
 *
 * Idempotent + resumable: wallets that already have paystackCustomerCode are
 * skipped, so re-running only processes what is left. Each wallet is independent
 * - one failure is logged and the run continues.
 *
 * Usage (from backend/, DB migrated + Paystack keys set):
 *   node scripts/migrate-katpay-to-paystack-dva.js              # live run
 *   node scripts/migrate-katpay-to-paystack-dva.js --dry-run    # report only
 *   LIMIT=50 node scripts/migrate-katpay-to-paystack-dva.js     # cap this run
 *   DELAY_MS=400 node scripts/migrate-katpay-to-paystack-dva.js # throttle Paystack
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { prisma } = require('../src/config/database');
const paystackService = require('../src/services/paystack.service');

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity;
const DELAY_MS = process.env.DELAY_MS ? Number(process.env.DELAY_MS) : 300;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!DRY_RUN && !paystackService.isConfigured()) {
    throw new Error('PAYSTACK_SECRET_KEY is not set - cannot provision DVAs. Use --dry-run to preview.');
  }

  // Eligible: verified users (KYC) whose wallet has not been moved to Paystack.
  // We provision for VERIFIED users only, matching the live KYC gate.
  const wallets = await prisma.wallet.findMany({
    where: {
      paystackCustomerCode: null,
      user: { kycStatus: 'VERIFIED' },
    },
    select: {
      id: true,
      virtualAccountNumber: true,
      legacyKatpayAccountNumber: true,
      user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
    },
  });

  console.log(`Found ${wallets.length} wallet(s) to migrate${DRY_RUN ? ' (DRY RUN)' : ''}.`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const w of wallets) {
    if (migrated >= LIMIT) {
      console.log(`Reached LIMIT=${LIMIT}; stopping.`);
      break;
    }
    const u = w.user;
    if (!u?.email) {
      console.warn(`SKIP wallet ${w.id}: user has no email`);
      skipped += 1;
      continue;
    }

    if (DRY_RUN) {
      console.log(`DRY: would provision DVA for ${u.email}; legacy NUBAN=${w.virtualAccountNumber || '(none)'}`);
      migrated += 1;
      continue;
    }

    try {
      const dva = await paystackService.createVirtualAccount({
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        phone: u.phone || '',
      });

      await prisma.wallet.update({
        where: { id: w.id },
        data: {
          // Retain the old KatPay NUBAN (only set it if we have one and it isn't
          // already stored from a prior partial run).
          ...(w.virtualAccountNumber && !w.legacyKatpayAccountNumber
            ? { legacyKatpayAccountNumber: w.virtualAccountNumber }
            : {}),
          virtualAccountNumber: dva.accountNumber,
          virtualAccountBank: dva.bankName,
          virtualAccountName: dva.accountName,
          paystackCustomerCode: dva.customerCode,
          dedicatedAccountId: dva.dedicatedAccountId,
        },
      });

      migrated += 1;
      console.log(`OK ${u.email}: DVA ${dva.accountNumber} (${dva.bankName}); legacy ${w.virtualAccountNumber || '(none)'}`);
    } catch (err) {
      failed += 1;
      console.error(`FAIL ${u.email}: ${err.message}`);
    }

    await sleep(DELAY_MS);
  }

  console.log(`\nDone. migrated=${migrated} skipped=${skipped} failed=${failed}`);
}

main()
  .catch((e) => {
    console.error('Migration aborted:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

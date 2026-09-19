/**
 * backfill-paystack-accounts.js
 *
 * Gives every non-deleted user BOTH funding accounts (Paystack DVA + KatPay
 * NUBAN) when they're missing either, and refreshes the wallet's displayed
 * account to the currently ACTIVE provider. Idempotent: a wallet that already
 * has a Paystack DVA is skipped, so re-running only handles what's left.
 *
 * SAFETY: this script NEVER changes a user's status or a wallet's isLocked flag.
 * Suspended users are provisioned like everyone else and remain suspended;
 * frozen wallets stay frozen. It only writes account-number fields.
 *
 * Usage (from backend/, with live Paystack + KatPay keys set):
 *   node scripts/backfill-paystack-accounts.js              # live run
 *   node scripts/backfill-paystack-accounts.js --dry-run    # report only
 *   LIMIT=50 node scripts/backfill-paystack-accounts.js     # cap this run
 *   DELAY_MS=400 node scripts/backfill-paystack-accounts.js # throttle provider calls
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { prisma } = require('../src/config/database');
const { provisionVirtualAccount } = require('../src/services/payments/provisioning');
const paymentsRouter = require('../src/services/payments/router');

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity;
const DELAY_MS = process.env.DELAY_MS ? Number(process.env.DELAY_MS) : 300;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const mode = await paymentsRouter.getMode();
  console.log(`Active provider: ${mode}${DRY_RUN ? '  (DRY RUN)' : ''}`);

  // Wallets with no Paystack DVA yet. Admins/staff have no wallet; soft-deleted
  // users are excluded. Suspended users ARE included (and left suspended).
  const wallets = await prisma.wallet.findMany({
    where: {
      paystackAccountNumber: null,
      user: { deletedAt: null, role: { not: 'ADMIN' } },
    },
    select: {
      id: true,
      userId: true,
      virtualAccountNumber: true,
      katpayAccountNumber: true,
      user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true, role: true, status: true } },
    },
  });

  const withContact = wallets.filter((w) => w.user?.email && w.user?.phone);
  const noPhone = wallets.filter((w) => w.user?.email && !w.user?.phone);
  const noEmail = wallets.filter((w) => !w.user?.email);

  console.log(
    `Wallets needing a Paystack DVA: ${wallets.length} (${withContact.length} provisionable, ` +
      `${noPhone.length} missing phone, ${noEmail.length} missing email)`,
  );

  if (noPhone.length) {
    console.log('\nSKIPPED - needs a phone number first:');
    for (const w of noPhone) console.log(`  ${w.user.email} (${w.user.role})`);
  }
  if (noEmail.length) {
    console.log('\nSKIPPED - wallet has no user email (data issue):');
    for (const w of noEmail) console.log(`  wallet ${w.id}`);
  }

  let done = 0;
  let failed = 0;

  console.log('\nProvisioning Paystack DVAs:');
  for (const w of withContact) {
    if (done >= LIMIT) {
      console.log(`Reached LIMIT=${LIMIT}; stopping.`);
      break;
    }
    const u = w.user;

    if (DRY_RUN) {
      console.log(`DRY: would provision Paystack DVA for ${u.email} (${u.role}, ${u.status})`);
      done += 1;
      continue;
    }

    try {
      const result = await provisionVirtualAccount({
        userId: u.id,
        email: u.email,
        name: `${u.firstName} ${u.lastName}`.trim(),
        phoneNumber: u.phone,
      });
      done += 1;
      console.log(`OK ${u.email} (${u.role}, ${u.status}): ${result.provider} ${result.accountNumber} (${result.bankName})${result.errors ? ` [warn: ${result.errors.join('; ')}]` : ''}`);
    } catch (err) {
      failed += 1;
      console.error(`FAIL ${u.email} (${u.role}): ${err.message}`);
    }

    await sleep(DELAY_MS);
  }

  console.log(`\nDone. provisioned=${done} failed=${failed} needsPhone=${noPhone.length} needsEmail=${noEmail.length}`);
}

main()
  .catch((e) => {
    console.error('backfill-paystack-accounts aborted:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

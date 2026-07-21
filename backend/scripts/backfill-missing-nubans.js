/**
 * backfill-missing-nubans.js
 *
 * Finds every non-admin user whose wallet has no virtualAccountNumber and
 * provisions a KatPay NUBAN, then stores it on the wallet. Idempotent: a user
 * who already has a NUBAN is skipped, so re-running only handles what's left.
 * Each user is independent - one failure is logged and the run continues.
 *
 * Users with no phone on file are reported separately and never sent to
 * KatPay - createVirtualAccount does not validate phoneNumber itself, and an
 * empty one would either be rejected by KatPay or create an account not
 * properly tied to the user's identity. They need a phone added first (the
 * app's phone-capture screen triggers provisioning on its own once they do).
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
  // Every non-admin user's wallet with no NUBAN yet. Admins/staff never get a
  // wallet at all (see modules/admin/admin.service.js:createStaff), so the
  // role filter here is a defensive belt-and-braces, not the real gate.
  const wallets = await prisma.wallet.findMany({
    where: {
      virtualAccountNumber: null,
      user: { role: { not: 'ADMIN' } },
    },
    select: {
      id: true,
      user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true, role: true } },
    },
  });

  const withPhone = wallets.filter((w) => w.user?.email && w.user?.phone);
  const noPhone = wallets.filter((w) => w.user?.email && !w.user?.phone);
  const noEmail = wallets.filter((w) => !w.user?.email);

  console.log(
    `Found ${wallets.length} user(s) with no NUBAN: ${withPhone.length} provisionable, ` +
      `${noPhone.length} missing a phone number, ${noEmail.length} missing an email.` +
      `${DRY_RUN ? ' (DRY RUN)' : ''}`,
  );

  if (noPhone.length) {
    console.log('\nSKIPPED - needs phone number before provisioning:');
    for (const w of noPhone) console.log(`  ${w.user.email} (${w.user.role})`);
  }
  if (noEmail.length) {
    console.log('\nSKIPPED - wallet has no user email on file (data issue):');
    for (const w of noEmail) console.log(`  wallet ${w.id}`);
  }

  let done = 0;
  let failed = 0;

  console.log('\nProvisioning:');
  for (const w of withPhone) {
    if (done >= LIMIT) {
      console.log(`Reached LIMIT=${LIMIT}; stopping.`);
      break;
    }
    const u = w.user;

    if (DRY_RUN) {
      console.log(`DRY: would provision KatPay NUBAN for ${u.email} (${u.role})`);
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
      console.log(`OK ${u.email} (${u.role}): NUBAN ${va.accountNumber} (${va.bankName})`);
    } catch (err) {
      failed += 1;
      console.error(`FAIL ${u.email} (${u.role}): ${err.message}`);
    }

    await sleep(DELAY_MS);
  }

  console.log(
    `\nDone. provisioned=${done} failed=${failed} needsPhone=${noPhone.length} needsEmail=${noEmail.length}`,
  );
}

main()
  .catch((e) => {
    console.error('backfill-missing-nubans aborted:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

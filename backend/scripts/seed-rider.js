/**
 * seed-rider.js - create (or refresh) a single APPROVED rider account.
 * BLK-RiderSeedScript.
 *
 * Purpose: hand App Store / Play Store reviewers - and QA - a rider login that
 * lands straight in the app instead of getting stuck on the "Pending Approval"
 * gate. It creates a rider that is:
 *   - role RIDER, status ACTIVE, kycStatus VERIFIED
 *   - Rider.status APPROVED, availability OFFLINE
 *   - transaction PIN set (transactionPinSetByUser = true, so no PIN nag)
 *   - a wallet with a placeholder NUBAN (or a real KatPay NUBAN with --provision-nuban)
 *
 * Unlike `npm run db:seed`, this touches ONLY this one rider - safe to run
 * against a production database to prepare a reviewer account. Idempotent:
 * re-running repairs/refreshes the same account rather than duplicating it.
 *
 * Usage (from the backend/ folder, with your DB running + migrated):
 *   node scripts/seed-rider.js                    # create/refresh with defaults
 *   node scripts/seed-rider.js --provision-nuban  # also provision a real KatPay NUBAN
 *
 * Override any field via env vars:
 *   RIDER_EMAIL=review@iprime.ng RIDER_PASSWORD='Secret123!' RIDER_PIN=224466 \
 *   RIDER_PHONE=08090000001 node scripts/seed-rider.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const bcrypt = require('bcryptjs');
const { prisma } = require('../src/config/database');

const SALT_ROUNDS = 12;
const PROVISION_NUBAN = process.argv.includes('--provision-nuban');

// Reviewer/QA credentials - overridable via env so you don't bake secrets in.
const EMAIL = process.env.RIDER_EMAIL || 'rider.review@iprime.ng';
const PASSWORD = process.env.RIDER_PASSWORD || 'RiderReview123!';
const PIN = process.env.RIDER_PIN || '224466';
const PHONE = process.env.RIDER_PHONE || '08090000001';
const FIRST_NAME = process.env.RIDER_FIRST_NAME || 'Review';
const LAST_NAME = process.env.RIDER_LAST_NAME || 'Rider';

// A placeholder NUBAN derived from the phone - only used when we don't
// provision a real one. Mirrors the convention in prisma/seed.js.
const PLACEHOLDER_NUBAN = PHONE.replace(/^0/, '8');

async function main() {
  if (!/^\d{6}$/.test(PIN)) {
    throw new Error(`RIDER_PIN must be exactly 6 digits (got "${PIN}")`);
  }

  console.log(`🌱 Seeding approved rider: ${EMAIL}`);

  const passwordHash = await bcrypt.hash(PASSWORD, SALT_ROUNDS);
  const transactionPin = await bcrypt.hash(PIN, SALT_ROUNDS);

  // 1) User - upsert so a re-run repairs a half-broken account. We set the same
  //    fields on create and update so the account is always left fully ACTIVE +
  //    VERIFIED with a real PIN, whatever state it was in before.
  const userFields = {
    phone: PHONE,
    firstName: FIRST_NAME,
    lastName: LAST_NAME,
    passwordHash,
    transactionPin,
    transactionPinSetByUser: true, // suppresses the "set your PIN" gate
    kycStatus: 'VERIFIED',
    role: 'RIDER',
    status: 'ACTIVE',
    dateOfBirth: new Date('1995-01-01'),
    address: 'Demo address, Katsina',
    deletedAt: null, // un-delete if a prior run / test soft-deleted it
  };

  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: userFields,
    create: { email: EMAIL, ...userFields },
  });
  console.log(`  ✓ User ready (${user.id}) - role RIDER, status ACTIVE, KYC VERIFIED`);

  // 2) Wallet - upsert by userId. Keep an existing balance/NUBAN if present.
  const existingWallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
  const wallet = await prisma.wallet.upsert({
    where: { userId: user.id },
    update: {}, // don't clobber a real balance / NUBAN on re-run
    create: {
      userId: user.id,
      balance: 15000,
      virtualAccountNumber: PLACEHOLDER_NUBAN,
      virtualAccountBank: 'Wema Bank',
      virtualAccountName: `iPrime-${FIRST_NAME} ${LAST_NAME}`,
    },
  });
  console.log(
    `  ✓ Wallet ready - balance ₦${Number(wallet.balance).toLocaleString()}, ` +
      `NUBAN ${wallet.virtualAccountNumber || '(none yet)'}`
  );

  // 3) Rider - upsert by userId. APPROVED + OFFLINE with demo KYC docs filled in
  //    so the admin KYC view and the rider profile both render fully.
  const riderFields = {
    vehicleType: 'MOTORCYCLE',
    plateNumber: 'KAT-REV-01',
    vehicleColor: 'Blue',
    ninNumber: '12345678901',
    idDocumentUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
    vehiclePhotoUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
    status: 'APPROVED',
    availability: 'OFFLINE',
    suspensionReason: null,
    averageRating: 4.8,
    lastLat: 13.0059,
    lastLng: 7.6017,
    deletedAt: null,
  };

  const rider = await prisma.rider.upsert({
    where: { userId: user.id },
    update: riderFields,
    create: { userId: user.id, ...riderFields },
  });
  console.log(`  ✓ Rider ready (${rider.id}) - status APPROVED, availability OFFLINE`);

  // 4) Optional: provision a real KatPay NUBAN, reusing the same path the KYC
  //    flow uses. Only meaningful when KatPay creds are configured (e.g. prod).
  if (PROVISION_NUBAN) {
    if (existingWallet?.virtualAccountNumber && existingWallet.virtualAccountNumber !== PLACEHOLDER_NUBAN) {
      console.log(`  ↪ Skipping NUBAN provisioning - wallet already has a real NUBAN.`);
    } else {
      try {
        const katpayService = require('../src/services/katpay.service');
        const va = await katpayService.createVirtualAccount({
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          phoneNumber: user.phone || '',
          bankCodes: ['PALMPAY', 'OPAY'],
        });
        await prisma.wallet.update({
          where: { userId: user.id },
          data: {
            virtualAccountNumber: va.accountNumber,
            virtualAccountBank: va.bankName,
            virtualAccountName: va.accountName,
          },
        });
        console.log(`  ✓ Real KatPay NUBAN provisioned: ${va.accountNumber} (${va.bankName})`);
      } catch (err) {
        console.warn(`  ⚠ NUBAN provisioning failed (kept placeholder): ${err.message}`);
      }
    }
  }

  console.log('\n✅ Done. Reviewer / QA rider login:');
  console.log('---');
  console.log(`  Email:    ${EMAIL}`);
  console.log(`  Password: ${PASSWORD}`);
  console.log(`  PIN:      ${PIN}`);
  console.log('---');
  console.log('Put these in the App Store / Play Store reviewer notes.');
  if (!PROVISION_NUBAN) {
    console.log('Tip: pass --provision-nuban to create a real KatPay NUBAN for wallet top-up.');
  }
}

main()
  .catch((e) => {
    console.error('❌ seed-rider failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

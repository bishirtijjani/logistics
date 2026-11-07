/**
 * seed-merchant.js - create (or refresh) a single APPROVED merchant account.
 *
 * Purpose: hand App Store / Play Store reviewers - and QA - a merchant login
 * that lands straight in the Logistics Platform Merchant app (dashboard + native Orders)
 * instead of the "Pending Approval" gate. It creates a merchant that is:
 *   - User: role MERCHANT, status ACTIVE, kycStatus VERIFIED
 *   - Merchant: status APPROVED, isActive/isOpen true, real Katsina coordinates
 *   - transaction PIN set (transactionPinSetByUser = true)
 *   - a MerchantWallet with a demo balance + bank account
 *   - two demo products so the catalogue isn't empty
 *
 * Unlike `npm run db:seed`, this touches ONLY this one merchant - safe to run
 * against a production database to prepare a reviewer account. Idempotent:
 * re-running repairs/refreshes the same account rather than duplicating it.
 *
 * Usage (from the backend/ folder, with your DB running + migrated):
 *   node scripts/seed-merchant.js
 *
 * Override any field via env vars:
 *   MERCHANT_EMAIL=review@ MERCHANT_PASSWORD='Secret123!' MERCHANT_PIN=335577 \
 *   node scripts/seed-merchant.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const bcrypt = require('bcryptjs');
const { prisma } = require('../src/config/database');

const SALT_ROUNDS = 12;

const EMAIL = process.env.MERCHANT_EMAIL || 'merchant.review@';
const PASSWORD = process.env.MERCHANT_PASSWORD || 'MerchantReview123!';
const PIN = process.env.MERCHANT_PIN || '335577';
const PHONE = process.env.MERCHANT_PHONE || '08090000002';
const FIRST_NAME = process.env.MERCHANT_FIRST_NAME || 'Review';
const LAST_NAME = process.env.MERCHANT_LAST_NAME || 'Merchant';
const BUSINESS_NAME = process.env.MERCHANT_BUSINESS_NAME || 'Logistics Platform Review Store';

// Katsina city centre - inside the platform's geo-restriction polygon.
const LAT = 13.0059;
const LNG = 7.6017;

async function main() {
  if (!/^\d{6}$/.test(PIN)) {
    throw new Error(`MERCHANT_PIN must be exactly 6 digits (got "${PIN}")`);
  }

  console.log(`🌱 Seeding approved merchant: ${EMAIL}`);

  const passwordHash = await bcrypt.hash(PASSWORD, SALT_ROUNDS);
  const transactionPin = await bcrypt.hash(PIN, SALT_ROUNDS);

  // 1) User
  const userFields = {
    phone: PHONE,
    firstName: FIRST_NAME,
    lastName: LAST_NAME,
    passwordHash,
    transactionPin,
    transactionPinSetByUser: true,
    kycStatus: 'VERIFIED',
    role: 'MERCHANT',
    status: 'ACTIVE',
    address: 'Review Store, Kofar Kaura, Katsina',
    deletedAt: null,
  };

  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: userFields,
    create: { email: EMAIL, ...userFields },
  });
  console.log(`  ✓ User ready (${user.id}) - role MERCHANT, status ACTIVE`);

  // 2) Category - reuse the first active category, else create a generic one.
  let category = await prisma.merchantCategory.findFirst({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
  if (!category) {
    category = await prisma.merchantCategory.upsert({
      where: { slug: 'general' },
      update: {},
      create: { name: 'General', slug: 'general', hasPreparation: false, isActive: true },
    });
  }
  console.log(`  ✓ Category: ${category.name} (${category.id})`);

  // 3) Merchant
  const merchantFields = {
    categoryId: category.id,
    status: 'APPROVED',
    name: BUSINESS_NAME,
    description: 'Reviewer demo store for the Logistics Platform Merchant app.',
    phone: PHONE,
    email: EMAIL,
    address: 'Kofar Kaura, Katsina',
    lat: LAT,
    lng: LNG,
    openingTime: '08:00',
    closingTime: '22:00',
    isActive: true,
    isOpen: true,
    adminActiveOverride: true,
    phoneVerified: true,
    suspensionReason: null,
    rejectionReason: null,
  };

  const merchant = await prisma.merchant.upsert({
    where: { userId: user.id },
    update: merchantFields,
    create: { userId: user.id, ...merchantFields },
  });
  console.log(`  ✓ Merchant ready (${merchant.id}) - status APPROVED, open`);

  // 4) Merchant wallet - keep existing balance/bank on re-run.
  await prisma.merchantWallet.upsert({
    where: { merchantId: merchant.id },
    update: {},
    create: {
      merchantId: merchant.id,
      availableBalance: 25000,
      pendingBalance: 0,
      totalEarnings: 25000,
      bankCode: '058',
      accountNumber: '0123456789',
      accountName: `${FIRST_NAME} ${LAST_NAME}`,
    },
  });
  console.log('  ✓ Merchant wallet ready - balance ₦25,000');

  // 5) Demo products (each with one default variant).
  const existingProducts = await prisma.product.count({ where: { merchantId: merchant.id } });
  if (existingProducts === 0) {
    const demo = [
      { name: 'Reviewer Demo Item A', price: 1500, stock: 50 },
      { name: 'Reviewer Demo Item B', price: 3200, stock: 25 },
    ];
    for (const d of demo) {
      await prisma.product.create({
        data: {
          merchantId: merchant.id,
          name: d.name,
          description: 'Demo product seeded for store review.',
          basePrice: d.price,
          stock: d.stock,
          isAvailable: true,
          variants: {
            create: [{ price: d.price, stock: d.stock, attributes: {}, isAvailable: true }],
          },
        },
      });
    }
    console.log(`  ✓ Seeded ${demo.length} demo products`);
  } else {
    console.log(`  ↪ Skipping products - merchant already has ${existingProducts}`);
  }

  console.log('\n✅ Done. Reviewer / QA merchant login:');
  console.log('---');
  console.log(`  Email:    ${EMAIL}`);
  console.log(`  Password: ${PASSWORD}`);
  console.log(`  PIN:      ${PIN}`);
  console.log('---');
  console.log('Put these in the App Store / Play Store reviewer notes.');
}

main()
  .catch((e) => {
    console.error('❌ seed-merchant failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

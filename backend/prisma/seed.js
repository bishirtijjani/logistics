/**
 * Database seeder — creates initial data for development.
 *
 * Run with: npm run db:seed
 *
 * Creates:
 * - 1 Admin user
 * - Sample customer and rider for testing
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123456', SALT_ROUNDS);
  const adminPin = await bcrypt.hash('000000', SALT_ROUNDS);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@vtulogistics.com' },
    update: {},
    create: {
      phone: '09000000001',
      firstName: 'Platform',
      lastName: 'Admin',
      email: 'admin@vtulogistics.com',
      passwordHash: adminPassword,
      transactionPin: adminPin,
      role: 'ADMIN',
      status: 'ACTIVE',
      wallet: {
        create: { balance: 0 },
      },
    },
  });

  console.log(`✅ Admin user created: ${admin.email}`);

  // Create test customer
  const customerPassword = await bcrypt.hash('customer123', SALT_ROUNDS);
  const customerPin = await bcrypt.hash('111111', SALT_ROUNDS);

  const customer = await prisma.user.upsert({
    where: { email: 'customer@test.com' },
    update: {},
    create: {
      phone: '08012345678',
      firstName: 'Test',
      lastName: 'Customer',
      email: 'customer@test.com',
      passwordHash: customerPassword,
      transactionPin: customerPin,
      role: 'CUSTOMER',
      status: 'ACTIVE',
      wallet: {
        create: {
          balance: 50000,
          virtualAccountNumber: '8012345678',
          virtualAccountBank: 'Wema Bank',
          virtualAccountName: 'VTU-Test Customer',
        },
      },
    },
  });

  console.log(`✅ Test customer created: ${customer.email} (balance: ₦50,000)`);

  // Create test rider
  const riderPassword = await bcrypt.hash('rider123456', SALT_ROUNDS);
  const riderPin = await bcrypt.hash('222222', SALT_ROUNDS);

  const riderUser = await prisma.user.upsert({
    where: { email: 'rider@test.com' },
    update: {},
    create: {
      phone: '08098765432',
      firstName: 'Test',
      lastName: 'Rider',
      email: 'rider@test.com',
      passwordHash: riderPassword,
      transactionPin: riderPin,
      role: 'RIDER',
      status: 'ACTIVE',
      wallet: {
        create: {
          balance: 15000,
          virtualAccountNumber: '8098765432',
          virtualAccountBank: 'Wema Bank',
          virtualAccountName: 'VTU-Test Rider',
        },
      },
      rider: {
        create: {
          vehicleType: 'MOTORCYCLE',
          plateNumber: 'KAT-001-AB',
          vehicleColor: 'Red',
          status: 'APPROVED',
          availability: 'OFFLINE',
          averageRating: 4.5,
          lastLat: 13.0059,
          lastLng: 7.6017,
        },
      },
    },
  });

  console.log(`✅ Test rider created: ${riderUser.email} (approved, balance: ₦15,000)`);

  // Seed default merchant categories (idempotent — admin can add more from the dashboard)
  const defaultCategories = [
    { id: '00000000-0000-4000-a000-000000000001', name: 'Restaurant', slug: 'restaurant', description: 'Order from restaurants', icon: 'restaurant', color: '#EA580C', sortOrder: 10, hasPreparation: true },
    { id: '00000000-0000-4000-a000-000000000002', name: 'Grocery',    slug: 'grocery',    description: 'Shop supermarkets',     icon: 'basket',     color: '#7C3AED', sortOrder: 20, hasPreparation: true },
    { id: '00000000-0000-4000-a000-000000000003', name: 'Pharmacy',   slug: 'pharmacy',   description: 'Order medicines',       icon: 'pill',       color: '#059669', sortOrder: 30, hasPreparation: false },
  ];
  for (const cat of defaultCategories) {
    await prisma.merchantCategory.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, description: cat.description, icon: cat.icon, color: cat.color, sortOrder: cat.sortOrder, hasPreparation: cat.hasPreparation, isActive: true },
      create: cat,
    });
  }
  console.log(`✅ Seeded ${defaultCategories.length} default merchant categories`);

  // Create test merchant
  const merchantPassword = await bcrypt.hash('merchant123', SALT_ROUNDS);
  const merchantPin = await bcrypt.hash('333333', SALT_ROUNDS);

  const merchantUser = await prisma.user.upsert({
    where: { email: 'merchant@test.com' },
    update: {},
    create: {
      phone: '08055556666',
      firstName: 'Test',
      lastName: 'Merchant',
      email: 'merchant@test.com',
      passwordHash: merchantPassword,
      transactionPin: merchantPin,
      role: 'MERCHANT',
      status: 'ACTIVE',
      wallet: {
        create: {
          balance: 25000,
          virtualAccountNumber: '8055556666',
          virtualAccountBank: 'Wema Bank',
          virtualAccountName: 'VTU-Test Merchant',
        },
      },
      merchant: {
        create: {
          category: { connect: { slug: 'restaurant' } },
          name: 'Test Restaurant',
          description: 'A test restaurant for development',
          phone: '08055556666',
          email: 'merchant@test.com',
          address: '123 Test Street, Katsina',
          lat: 13.0059,
          lng: 7.6017,
          openingTime: '08:00',
          closingTime: '22:00',
          status: 'APPROVED',
          averageRating: 4.2,
          isOpen: true,
          isActive: true,
        },
      },
    },
  });

  console.log(`✅ Test merchant created: ${merchantUser.email} (approved, balance: ₦25,000)`);

  // Seed platform settings
  const settings = [
    { key: 'delivery.baseFare', value: 200, description: 'Base fare for delivery in NGN' },
    { key: 'delivery.perKmRate', value: 100, description: 'Per-km rate for delivery in NGN' },
    { key: 'delivery.platformFeePercent', value: 10, description: 'Platform fee % on delivery subtotal' },
    { key: 'delivery.riderEarningPercent', value: 80, description: 'Rider earns this % of delivery fee' },
    { key: 'delivery.cancellationFee', value: 200, description: 'Fee charged for cancelling after rider assigned' },
    { key: 'merchant.platformFeePercent', value: 15, description: 'Platform fee % deducted from merchant item subtotal' },
    { key: 'delivery.broadcastRadiusRings', value: [5, 10, 15], description: 'Rider search radius rings in km' },
    { key: 'delivery.broadcastRingTimeoutSec', value: 60, description: 'Seconds to wait per ring before expanding' },
    { key: 'delivery.autoCancelUnmatchedMs', value: 240000, description: 'Auto-cancel after all rings exhausted (ms)' },
    { key: 'wallet.minTopup', value: 100, description: 'Minimum wallet top-up amount in NGN' },
    { key: 'wallet.minWithdraw', value: 500, description: 'Minimum withdrawal amount in NGN' },
    { key: 'wallet.maxWithdraw', value: 500000, description: 'Maximum single withdrawal in NGN' },
    { key: 'wallet.withdrawalFee', value: 25, description: 'Flat fee per withdrawal in NGN' },
    { key: 'wallet.minTransfer', value: 50, description: 'Minimum P2P transfer amount in NGN' },
    { key: 'wallet.transferQuickAmounts', value: [500, 1000, 2000, 5000], description: 'Quick-amount chips on Send Money screen' },
    { key: 'wallet.withdrawQuickAmounts', value: [1000, 5000, 10000, 20000], description: 'Quick-amount chips on Withdraw screen' },
    { key: 'utility.minElectricityAmount', value: 500, description: 'Minimum electricity payment in NGN' },
    { key: 'utility.electricityQuickAmounts', value: [1000, 2000, 5000, 10000, 20000], description: 'Quick-amount chips on Electricity screen' },
    { key: 'utility.minAirtimeAmount', value: 50, description: 'Minimum airtime purchase in NGN' },
    { key: 'utility.airtimeQuickAmounts', value: [100, 200, 500, 1000, 2000, 5000], description: 'Quick-amount chips on Airtime screen' },
    { key: 'auth.otpTtlSeconds', value: 600, description: 'OTP validity in seconds (10 min)' },
    { key: 'auth.pinMaxAttempts', value: 5, description: 'Max wrong PIN attempts before lockout' },
    { key: 'auth.pinLockoutMinutes', value: 30, description: 'PIN lockout duration in minutes' },
    { key: 'platform.currency', value: 'NGN', description: 'Default platform currency' },
    { key: 'platform.supportPhone', value: '08012345678', description: 'Customer support phone number' },
    { key: 'platform.supportEmail', value: 'support@vtulogistics.com', description: 'Customer support email' },
  ];

  for (const s of settings) {
    await prisma.platformSetting.upsert({
      where: { key: s.key },
      update: { value: s.value, description: s.description },
      create: { key: s.key, value: s.value, description: s.description },
    });
  }
  console.log(`✅ Platform settings seeded (${settings.length} entries)`);

  // Seed system wallets
  const systemWallets = [
    { id: 'PLATFORM_ESCROW', name: 'Platform Escrow Wallet' },
    { id: 'PLATFORM_EARNINGS', name: 'Platform Earnings Wallet' },
  ];

  for (const sw of systemWallets) {
    await prisma.systemWallet.upsert({
      where: { id: sw.id },
      update: {},
      create: { id: sw.id, name: sw.name, balance: 0 },
    });
  }
  console.log(`✅ System wallets seeded`);

  // ─── VTU Plans (AlRahuz IDs from pricing doc) ───────────────────────────────
  // Clear old plans so wrong IDs from a previous seed don't persist
  await prisma.vtuPlan.deleteMany({});

  const vtuPlans = [
    // ── AIRTIME — amount-based; sellingPrice unused (user specifies amount) ──
    { type: 'AIRTIME', providerNetworkId: 1, networkName: 'MTN',     name: 'MTN Airtime',     costPrice: 0, sellingPrice: 0, sortOrder: 1 },
    { type: 'AIRTIME', providerNetworkId: 2, networkName: 'GLO',     name: 'GLO Airtime',     costPrice: 0, sellingPrice: 0, sortOrder: 2 },
    { type: 'AIRTIME', providerNetworkId: 4, networkName: 'AIRTEL',  name: 'AIRTEL Airtime',  costPrice: 0, sellingPrice: 0, sortOrder: 3 },
    { type: 'AIRTIME', providerNetworkId: 3, networkName: '9MOBILE', name: '9MOBILE Airtime', costPrice: 0, sellingPrice: 0, sortOrder: 4 },

    // ── MTN DATA — SME ────────────────────────────────────────────────────────
    { type: 'DATA', providerNetworkId: 1, networkName: 'MTN', providerPlanId: 219, planType: 'SME', name: 'MTN 500MB — 7 days',   dataSize: '500MB', validity: '7 days',  costPrice: 485,   sellingPrice: 510,   sortOrder: 10 },
    { type: 'DATA', providerNetworkId: 1, networkName: 'MTN', providerPlanId: 7,   planType: 'SME', name: 'MTN 1GB — 7 days',     dataSize: '1GB',   validity: '7 days',  costPrice: 780,   sellingPrice: 820,   sortOrder: 11 },
    { type: 'DATA', providerNetworkId: 1, networkName: 'MTN', providerPlanId: 467, planType: 'SME', name: 'MTN 1.5GB — 7 days',   dataSize: '1.5GB', validity: '7 days',  costPrice: 965,   sellingPrice: 1020,  sortOrder: 12 },
    { type: 'DATA', providerNetworkId: 1, networkName: 'MTN', providerPlanId: 8,   planType: 'SME', name: 'MTN 2GB — 30 days',    dataSize: '2GB',   validity: '30 days', costPrice: 1450,  sellingPrice: 1530,  sortOrder: 13 },
    { type: 'DATA', providerNetworkId: 1, networkName: 'MTN', providerPlanId: 44,  planType: 'SME', name: 'MTN 3.5GB — 30 days',  dataSize: '3.5GB', validity: '30 days', costPrice: 2450,  sellingPrice: 2580,  sortOrder: 14 },
    { type: 'DATA', providerNetworkId: 1, networkName: 'MTN', providerPlanId: 538, planType: 'SME', name: 'MTN 5GB — 30 days',    dataSize: '5GB',   validity: '30 days', costPrice: 1750,  sellingPrice: 1840,  sortOrder: 15 },
    { type: 'DATA', providerNetworkId: 1, networkName: 'MTN', providerPlanId: 539, planType: 'SME', name: 'MTN 20GB — 30 days',   dataSize: '20GB',  validity: '30 days', costPrice: 7300,  sellingPrice: 7670,  sortOrder: 16 },

    // ── MTN DATA — SME2 ───────────────────────────────────────────────────────
    { type: 'DATA', providerNetworkId: 1, networkName: 'MTN', providerPlanId: 562, planType: 'SME2', name: 'MTN 1GB — 30 days (SME2)',    dataSize: '1GB',   validity: '30 days', costPrice: 500,   sellingPrice: 530,   sortOrder: 20 },
    { type: 'DATA', providerNetworkId: 1, networkName: 'MTN', providerPlanId: 314, planType: 'SME2', name: 'MTN 2GB — 30 days (SME2)',    dataSize: '2GB',   validity: '30 days', costPrice: 1450,  sellingPrice: 1530,  sortOrder: 21 },
    { type: 'DATA', providerNetworkId: 1, networkName: 'MTN', providerPlanId: 310, planType: 'SME2', name: 'MTN 3.5GB — 30 days (SME2)',  dataSize: '3.5GB', validity: '30 days', costPrice: 2450,  sellingPrice: 2580,  sortOrder: 22 },
    { type: 'DATA', providerNetworkId: 1, networkName: 'MTN', providerPlanId: 466, planType: 'SME2', name: 'MTN 4.2GB — 30 days (SME2)',  dataSize: '4.2GB', validity: '30 days', costPrice: 2910,  sellingPrice: 3060,  sortOrder: 23 },
    { type: 'DATA', providerNetworkId: 1, networkName: 'MTN', providerPlanId: 308, planType: 'SME2', name: 'MTN 7GB — 30 days (SME2)',    dataSize: '7GB',   validity: '30 days', costPrice: 3450,  sellingPrice: 3630,  sortOrder: 24 },
    { type: 'DATA', providerNetworkId: 1, networkName: 'MTN', providerPlanId: 315, planType: 'SME2', name: 'MTN 10GB — 30 days (SME2)',   dataSize: '10GB',  validity: '30 days', costPrice: 4400,  sellingPrice: 4630,  sortOrder: 25 },
    { type: 'DATA', providerNetworkId: 1, networkName: 'MTN', providerPlanId: 463, planType: 'SME2', name: 'MTN 12.5GB — 30 days (SME2)', dataSize: '12.5GB',validity: '30 days', costPrice: 5350,  sellingPrice: 5620,  sortOrder: 26 },
    { type: 'DATA', providerNetworkId: 1, networkName: 'MTN', providerPlanId: 464, planType: 'SME2', name: 'MTN 16.5GB — 30 days (SME2)', dataSize: '16.5GB',validity: '30 days', costPrice: 6300,  sellingPrice: 6620,  sortOrder: 27 },
    { type: 'DATA', providerNetworkId: 1, networkName: 'MTN', providerPlanId: 473, planType: 'SME2', name: 'MTN 36GB — 30 days (SME2)',   dataSize: '36GB',  validity: '30 days', costPrice: 10800, sellingPrice: 11350, sortOrder: 28 },
    { type: 'DATA', providerNetworkId: 1, networkName: 'MTN', providerPlanId: 474, planType: 'SME2', name: 'MTN 65GB — 30 days (SME2)',   dataSize: '65GB',  validity: '30 days', costPrice: 15500, sellingPrice: 16280, sortOrder: 29 },
    { type: 'DATA', providerNetworkId: 1, networkName: 'MTN', providerPlanId: 475, planType: 'SME2', name: 'MTN 75GB — 30 days (SME2)',   dataSize: '75GB',  validity: '30 days', costPrice: 17450, sellingPrice: 18330, sortOrder: 30 },

    // ── GLO DATA — SME ────────────────────────────────────────────────────────
    { type: 'DATA', providerNetworkId: 2, networkName: 'GLO', providerPlanId: 369, planType: 'SME', name: 'GLO 1.5GB — 1 day',   dataSize: '1.5GB', validity: '1 day',   costPrice: 295,  sellingPrice: 310,  sortOrder: 40 },
    { type: 'DATA', providerNetworkId: 2, networkName: 'GLO', providerPlanId: 370, planType: 'SME', name: 'GLO 2.5GB — 2 days',  dataSize: '2.5GB', validity: '2 days',  costPrice: 485,  sellingPrice: 510,  sortOrder: 41 },
    { type: 'DATA', providerNetworkId: 2, networkName: 'GLO', providerPlanId: 547, planType: 'SME', name: 'GLO 3.5GB — 7 days',  dataSize: '3.5GB', validity: '7 days',  costPrice: 1000, sellingPrice: 1050, sortOrder: 42 },
    { type: 'DATA', providerNetworkId: 2, networkName: 'GLO', providerPlanId: 549, planType: 'SME', name: 'GLO 8.5GB — 7 days',  dataSize: '8.5GB', validity: '7 days',  costPrice: 2000, sellingPrice: 2100, sortOrder: 43 },
    { type: 'DATA', providerNetworkId: 2, networkName: 'GLO', providerPlanId: 371, planType: 'SME', name: 'GLO 10GB — 7 days',   dataSize: '10GB',  validity: '7 days',  costPrice: 1950, sellingPrice: 2050, sortOrder: 44 },

    // ── GLO DATA — Corporate Gifting ──────────────────────────────────────────
    { type: 'DATA', providerNetworkId: 2, networkName: 'GLO', providerPlanId: 290, planType: 'CORPORATE GIFTING', name: 'GLO 500MB — 30 days', dataSize: '500MB', validity: '30 days', costPrice: 200,  sellingPrice: 210,  sortOrder: 50 },
    { type: 'DATA', providerNetworkId: 2, networkName: 'GLO', providerPlanId: 285, planType: 'CORPORATE GIFTING', name: 'GLO 1GB — 30 days',   dataSize: '1GB',   validity: '30 days', costPrice: 400,  sellingPrice: 420,  sortOrder: 51 },
    { type: 'DATA', providerNetworkId: 2, networkName: 'GLO', providerPlanId: 286, planType: 'CORPORATE GIFTING', name: 'GLO 2GB — 30 days',   dataSize: '2GB',   validity: '30 days', costPrice: 800,  sellingPrice: 840,  sortOrder: 52 },
    { type: 'DATA', providerNetworkId: 2, networkName: 'GLO', providerPlanId: 287, planType: 'CORPORATE GIFTING', name: 'GLO 3GB — 30 days',   dataSize: '3GB',   validity: '30 days', costPrice: 1200, sellingPrice: 1260, sortOrder: 53 },
    { type: 'DATA', providerNetworkId: 2, networkName: 'GLO', providerPlanId: 288, planType: 'CORPORATE GIFTING', name: 'GLO 5GB — 30 days',   dataSize: '5GB',   validity: '30 days', costPrice: 2000, sellingPrice: 2100, sortOrder: 54 },
    { type: 'DATA', providerNetworkId: 2, networkName: 'GLO', providerPlanId: 289, planType: 'CORPORATE GIFTING', name: 'GLO 10GB — 30 days',  dataSize: '10GB',  validity: '30 days', costPrice: 4000, sellingPrice: 4200, sortOrder: 55 },

    // ── AIRTEL DATA — SME ─────────────────────────────────────────────────────
    { type: 'DATA', providerNetworkId: 4, networkName: 'AIRTEL', providerPlanId: 428, planType: 'SME', name: 'AIRTEL 10GB — 30 days', dataSize: '10GB', validity: '30 days', costPrice: 3050, sellingPrice: 3210, sortOrder: 60 },
    { type: 'DATA', providerNetworkId: 4, networkName: 'AIRTEL', providerPlanId: 603, planType: 'SME', name: 'AIRTEL 8GB — 30 days',  dataSize: '8GB',  validity: '30 days', costPrice: 1950, sellingPrice: 2050, sortOrder: 61 },
    { type: 'DATA', providerNetworkId: 4, networkName: 'AIRTEL', providerPlanId: 595, planType: 'SME', name: 'AIRTEL 5GB — 7 days',   dataSize: '5GB',  validity: '7 days',  costPrice: 1460, sellingPrice: 1540, sortOrder: 62 },

    // ── AIRTEL DATA — Corporate Gifting ───────────────────────────────────────
    { type: 'DATA', providerNetworkId: 4, networkName: 'AIRTEL', providerPlanId: 516, planType: 'CORPORATE GIFTING', name: 'AIRTEL 1GB — 7 days',   dataSize: '1GB',  validity: '7 days',  costPrice: 784,  sellingPrice: 830,  sortOrder: 70 },
    { type: 'DATA', providerNetworkId: 4, networkName: 'AIRTEL', providerPlanId: 517, planType: 'CORPORATE GIFTING', name: 'AIRTEL 2GB — 30 days',  dataSize: '2GB',  validity: '30 days', costPrice: 1425, sellingPrice: 1500, sortOrder: 71 },
    { type: 'DATA', providerNetworkId: 4, networkName: 'AIRTEL', providerPlanId: 518, planType: 'CORPORATE GIFTING', name: 'AIRTEL 3GB — 30 days',  dataSize: '3GB',  validity: '30 days', costPrice: 1950, sellingPrice: 2050, sortOrder: 72 },
    { type: 'DATA', providerNetworkId: 4, networkName: 'AIRTEL', providerPlanId: 519, planType: 'CORPORATE GIFTING', name: 'AIRTEL 4GB — 30 days',  dataSize: '4GB',  validity: '30 days', costPrice: 2450, sellingPrice: 2580, sortOrder: 73 },
    { type: 'DATA', providerNetworkId: 4, networkName: 'AIRTEL', providerPlanId: 520, planType: 'CORPORATE GIFTING', name: 'AIRTEL 8GB — 30 days',  dataSize: '8GB',  validity: '30 days', costPrice: 2950, sellingPrice: 3100, sortOrder: 74 },
    { type: 'DATA', providerNetworkId: 4, networkName: 'AIRTEL', providerPlanId: 521, planType: 'CORPORATE GIFTING', name: 'AIRTEL 10GB — 30 days', dataSize: '10GB', validity: '30 days', costPrice: 3910, sellingPrice: 4110, sortOrder: 75 },
    { type: 'DATA', providerNetworkId: 4, networkName: 'AIRTEL', providerPlanId: 522, planType: 'CORPORATE GIFTING', name: 'AIRTEL 13GB — 30 days', dataSize: '13GB', validity: '30 days', costPrice: 4900, sellingPrice: 5150, sortOrder: 76 },
    { type: 'DATA', providerNetworkId: 4, networkName: 'AIRTEL', providerPlanId: 524, planType: 'CORPORATE GIFTING', name: 'AIRTEL 25GB — 30 days', dataSize: '25GB', validity: '30 days', costPrice: 7820, sellingPrice: 8220, sortOrder: 77 },

    // ── 9MOBILE DATA — SME ────────────────────────────────────────────────────
    { type: 'DATA', providerNetworkId: 3, networkName: '9MOBILE', providerPlanId: 248, planType: 'SME', name: '9MOBILE 1GB — 1 month',   dataSize: '1GB',   validity: '1 month', costPrice: 220,  sellingPrice: 240,  sortOrder: 80 },
    { type: 'DATA', providerNetworkId: 3, networkName: '9MOBILE', providerPlanId: 249, planType: 'SME', name: '9MOBILE 1.5GB — 1 month', dataSize: '1.5GB', validity: '1 month', costPrice: 330,  sellingPrice: 350,  sortOrder: 81 },
    { type: 'DATA', providerNetworkId: 3, networkName: '9MOBILE', providerPlanId: 251, planType: 'SME', name: '9MOBILE 3GB — 1 month',   dataSize: '3GB',   validity: '1 month', costPrice: 660,  sellingPrice: 700,  sortOrder: 82 },
    { type: 'DATA', providerNetworkId: 3, networkName: '9MOBILE', providerPlanId: 252, planType: 'SME', name: '9MOBILE 4GB — 1 month',   dataSize: '4GB',   validity: '1 month', costPrice: 880,  sellingPrice: 930,  sortOrder: 83 },
    { type: 'DATA', providerNetworkId: 3, networkName: '9MOBILE', providerPlanId: 253, planType: 'SME', name: '9MOBILE 5GB — 1 month',   dataSize: '5GB',   validity: '1 month', costPrice: 1100, sellingPrice: 1160, sortOrder: 84 },
    { type: 'DATA', providerNetworkId: 3, networkName: '9MOBILE', providerPlanId: 292, planType: 'SME', name: '9MOBILE 10GB — 30 days',  dataSize: '10GB',  validity: '30 days', costPrice: 2200, sellingPrice: 2320, sortOrder: 85 },

    // ── 9MOBILE DATA — Corporate Gifting ──────────────────────────────────────
    { type: 'DATA', providerNetworkId: 3, networkName: '9MOBILE', providerPlanId: 296, planType: 'CORPORATE GIFTING', name: '9MOBILE 1GB — 30 days',  dataSize: '1GB',  validity: '30 days', costPrice: 480,  sellingPrice: 510,  sortOrder: 90 },
    { type: 'DATA', providerNetworkId: 3, networkName: '9MOBILE', providerPlanId: 297, planType: 'CORPORATE GIFTING', name: '9MOBILE 2GB — 30 days',  dataSize: '2GB',  validity: '30 days', costPrice: 960,  sellingPrice: 1010, sortOrder: 91 },
    { type: 'DATA', providerNetworkId: 3, networkName: '9MOBILE', providerPlanId: 300, planType: 'CORPORATE GIFTING', name: '9MOBILE 5GB — 30 days',  dataSize: '5GB',  validity: '30 days', costPrice: 2400, sellingPrice: 2520, sortOrder: 92 },
    { type: 'DATA', providerNetworkId: 3, networkName: '9MOBILE', providerPlanId: 301, planType: 'CORPORATE GIFTING', name: '9MOBILE 10GB — 30 days', dataSize: '10GB', validity: '30 days', costPrice: 4800, sellingPrice: 5050, sortOrder: 93 },

    // ── GOTV CABLE ────────────────────────────────────────────────────────────
    { type: 'CABLE', providerNetworkId: 1, networkName: 'GOTV', providerPlanId: 34, name: 'GOtv Smallie — Monthly', validity: '1 month', costPrice: 1900,  sellingPrice: 2000,  sortOrder: 100 },
    { type: 'CABLE', providerNetworkId: 1, networkName: 'GOTV', providerPlanId: 16, name: 'GOtv Jinja',             validity: '1 month', costPrice: 3900,  sellingPrice: 4100,  sortOrder: 101 },
    { type: 'CABLE', providerNetworkId: 1, networkName: 'GOTV', providerPlanId: 17, name: 'GOtv Jolli',             validity: '1 month', costPrice: 5800,  sellingPrice: 6100,  sortOrder: 102 },
    { type: 'CABLE', providerNetworkId: 1, networkName: 'GOTV', providerPlanId: 2,  name: 'GOtv Max',               validity: '1 month', costPrice: 8500,  sellingPrice: 8900,  sortOrder: 103 },
    { type: 'CABLE', providerNetworkId: 1, networkName: 'GOTV', providerPlanId: 47, name: 'GOtv SUPA',              validity: '1 month', costPrice: 11400, sellingPrice: 12000, sortOrder: 104 },
    { type: 'CABLE', providerNetworkId: 1, networkName: 'GOTV', providerPlanId: 49, name: 'GOtv SUPA PLUS',         validity: '1 month', costPrice: 16800, sellingPrice: 17600, sortOrder: 105 },

    // ── DSTV CABLE ────────────────────────────────────────────────────────────
    { type: 'CABLE', providerNetworkId: 2, networkName: 'DSTV', providerPlanId: 20, name: 'DStv Padi',         validity: '1 month', costPrice: 4400,  sellingPrice: 4620,  sortOrder: 110 },
    { type: 'CABLE', providerNetworkId: 2, networkName: 'DSTV', providerPlanId: 6,  name: 'DStv Yanga',        validity: '1 month', costPrice: 6000,  sellingPrice: 6300,  sortOrder: 111 },
    { type: 'CABLE', providerNetworkId: 2, networkName: 'DSTV', providerPlanId: 19, name: 'DStv Confam',       validity: '1 month', costPrice: 11000, sellingPrice: 11600, sortOrder: 112 },
    { type: 'CABLE', providerNetworkId: 2, networkName: 'DSTV', providerPlanId: 7,  name: 'DStv Compact',      validity: '1 month', costPrice: 19000, sellingPrice: 20000, sortOrder: 113 },
    { type: 'CABLE', providerNetworkId: 2, networkName: 'DSTV', providerPlanId: 8,  name: 'DStv Compact Plus', validity: '1 month', costPrice: 30000, sellingPrice: 31500, sortOrder: 114 },
    { type: 'CABLE', providerNetworkId: 2, networkName: 'DSTV', providerPlanId: 9,  name: 'DStv Premium',      validity: '1 month', costPrice: 44500, sellingPrice: 46500, sortOrder: 115 },

    // ── STARTIME CABLE ────────────────────────────────────────────────────────
    { type: 'CABLE', providerNetworkId: 3, networkName: 'STARTIME', providerPlanId: 14, name: 'StarTimes Nova — Monthly',       validity: '1 month', costPrice: 2100, sellingPrice: 2200,  sortOrder: 120 },
    { type: 'CABLE', providerNetworkId: 3, networkName: 'STARTIME', providerPlanId: 12, name: 'StarTimes Basic — Monthly',      validity: '1 month', costPrice: 4000, sellingPrice: 4200,  sortOrder: 121 },
    { type: 'CABLE', providerNetworkId: 3, networkName: 'STARTIME', providerPlanId: 13, name: 'StarTimes Smart — Monthly',      validity: '1 month', costPrice: 5100, sellingPrice: 5400,  sortOrder: 122 },
    { type: 'CABLE', providerNetworkId: 3, networkName: 'STARTIME', providerPlanId: 11, name: 'StarTimes Classic — Monthly',    validity: '1 month', costPrice: 6000, sellingPrice: 6300,  sortOrder: 123 },
    { type: 'CABLE', providerNetworkId: 3, networkName: 'STARTIME', providerPlanId: 48, name: 'StarTimes Super — Monthly',      validity: '1 month', costPrice: 9000, sellingPrice: 9500,  sortOrder: 124 },
    { type: 'CABLE', providerNetworkId: 3, networkName: 'STARTIME', providerPlanId: 15, name: 'StarTimes Super Plus — Monthly', validity: '1 month', costPrice: 9800, sellingPrice: 10300, sortOrder: 125 },

    // ── ELECTRICITY — amount-based; sellingPrice unused ───────────────────────
    { type: 'ELECTRICITY', providerNetworkId: 1,  networkName: 'IKEDC', name: 'Ikeja Electric',         costPrice: 0, sellingPrice: 0, sortOrder: 130 },
    { type: 'ELECTRICITY', providerNetworkId: 2,  networkName: 'EKEDC', name: 'Eko Electric',           costPrice: 0, sellingPrice: 0, sortOrder: 131 },
    { type: 'ELECTRICITY', providerNetworkId: 3,  networkName: 'AEDC',  name: 'Abuja Electric',         costPrice: 0, sellingPrice: 0, sortOrder: 132 },
    { type: 'ELECTRICITY', providerNetworkId: 4,  networkName: 'KANO',  name: 'Kano Electric',          costPrice: 0, sellingPrice: 0, sortOrder: 133 },
    { type: 'ELECTRICITY', providerNetworkId: 5,  networkName: 'EEDC',  name: 'Enugu Electric',         costPrice: 0, sellingPrice: 0, sortOrder: 134 },
    { type: 'ELECTRICITY', providerNetworkId: 6,  networkName: 'PHED',  name: 'Port Harcourt Electric', costPrice: 0, sellingPrice: 0, sortOrder: 135 },
    { type: 'ELECTRICITY', providerNetworkId: 7,  networkName: 'IBEDC', name: 'Ibadan Electric',        costPrice: 0, sellingPrice: 0, sortOrder: 136 },
    { type: 'ELECTRICITY', providerNetworkId: 8,  networkName: 'KEDCO', name: 'Kaduna Electric',        costPrice: 0, sellingPrice: 0, sortOrder: 137 },
    { type: 'ELECTRICITY', providerNetworkId: 9,  networkName: 'JED',   name: 'Jos Electric',           costPrice: 0, sellingPrice: 0, sortOrder: 138 },
    { type: 'ELECTRICITY', providerNetworkId: 10, networkName: 'BEDC',  name: 'Benin Electric',         costPrice: 0, sellingPrice: 0, sortOrder: 139 },
    { type: 'ELECTRICITY', providerNetworkId: 11, networkName: 'YEDC',  name: 'Yola Electric',          costPrice: 0, sellingPrice: 0, sortOrder: 140 },
  ];

  await prisma.vtuPlan.createMany({ data: vtuPlans });
  console.log(`✅ VTU plans seeded (${vtuPlans.length} plans — AlRahuz IDs from pricing doc)`);

  console.log('\n🌱 Seeding complete!');
  console.log('---');
  console.log('Admin login:    admin@vtulogistics.com / admin123456 (PIN: 000000)');
  console.log('Customer login: customer@test.com / customer123 (PIN: 111111)');
  console.log('Rider login:    rider@test.com / rider123456 (PIN: 222222)');
  console.log('Merchant login: merchant@test.com / merchant123 (PIN: 333333)');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

/**
 * Database seeder - creates initial data for development.
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
    where: { email: 'admin@iprime.ng' },
    update: {},
    create: {
      phone: '09000000001',
      firstName: 'Platform',
      lastName: 'Admin',
      email: 'admin@iprime.ng',
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

  // Seed default merchant categories (idempotent - admin can add more from the dashboard).
  // Each category carries an attributeSchema - a UX hint that tells the merchant
  // product form which axes (size, color, …) and pack units to render.
  const defaultCategories = [
    {
      id: '00000000-0000-4000-a000-000000000001',
      name: 'Food', slug: 'restaurant', description: 'Order from restaurants',
      icon: 'restaurant', color: '#EA580C', sortOrder: 10, hasPreparation: true,
      attributeSchema: { axes: ['size'], pack: false },
    },
    {
      id: '00000000-0000-4000-a000-000000000002',
      name: 'Groceries', slug: 'grocery', description: 'Shop supermarkets, drinks and household',
      icon: 'basket', color: '#7C3AED', sortOrder: 20, hasPreparation: true,
      // A single merchant typically carries both dry and liquid items, so the
      // pack-unit list is the union of the two. Axes stays empty - merchants
      // add their own (flavor/size) per product when needed.
      attributeSchema: { axes: [], pack: true, packUnits: ['G', 'KG', 'PACK', 'SACHET', 'CARTON', 'ML', 'L', 'BOTTLE', 'PIECE'] },
    },
    {
      id: '00000000-0000-4000-a000-000000000003',
      name: 'Pharmacy', slug: 'pharmacy', description: 'Order medicines',
      icon: 'pill', color: '#059669', sortOrder: 30, hasPreparation: false,
      attributeSchema: { axes: ['strength', 'form'], pack: true, packUnits: ['TABLET', 'CAPSULE', 'ML', 'BOTTLE'] },
    },
    {
      id: '00000000-0000-4000-a000-000000000005',
      name: 'Fashion', slug: 'fashion', description: 'Clothing',
      icon: 'shirt', color: '#DB2777', sortOrder: 40, hasPreparation: false,
      attributeSchema: { axes: ['size', 'color'], pack: false },
    },
    {
      id: '00000000-0000-4000-a000-000000000006',
      name: 'Shoes', slug: 'shoes', description: 'Footwear',
      icon: 'footprints', color: '#A16207', sortOrder: 45, hasPreparation: false,
      attributeSchema: { axes: ['size', 'color'], pack: false, sizeSystem: 'EU' },
    },
    {
      id: '00000000-0000-4000-a000-000000000007',
      name: 'Electronics', slug: 'electronics', description: 'Phones & accessories',
      icon: 'smartphone', color: '#475569', sortOrder: 50, hasPreparation: false,
      attributeSchema: { axes: ['capacity', 'color'], pack: false },
    },
  ];
  for (const cat of defaultCategories) {
    await prisma.merchantCategory.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name, description: cat.description, icon: cat.icon, color: cat.color,
        sortOrder: cat.sortOrder, hasPreparation: cat.hasPreparation, isActive: true,
        attributeSchema: cat.attributeSchema,
      },
      create: cat,
    });
  }
  console.log(`✅ Seeded ${defaultCategories.length} default merchant categories (with attributeSchema)`);

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

  // ─── Sample products on the test merchant ───────────────────────────────────
  // Demonstrates the three patterns the customer + merchant apps must handle:
  // (1) single-SKU product, (2) multi-variant product, (3) food combo with both
  // variants and option groups including REQUIRED_ONE / OPTIONAL_MULTIPLE.
  const merchantRow = await prisma.merchant.findUnique({ where: { userId: merchantUser.id } });
  if (merchantRow) {
    const existingProducts = await prisma.product.count({ where: { merchantId: merchantRow.id } });
    if (existingProducts === 0) {
      // (1) Single-SKU: water bottle. Auto-default variant.
      const water = await prisma.product.create({
        data: {
          merchantId: merchantRow.id,
          name: 'Bottled Water (50cl)',
          description: 'Chilled bottled water',
          category: 'beverages',
          basePrice: 200,
          stock: 200,
          isAvailable: true,
        },
      });
      await prisma.productVariant.create({
        data: {
          productId: water.id,
          attributes: {},
          packSize: 500,
          packUnit: 'ML',
          packLabel: '500 ml',
          price: 200,
          stock: 200,
        },
      });

      // (2) Multi-variant: jollof rice with size axis.
      const jollof = await prisma.product.create({
        data: {
          merchantId: merchantRow.id,
          name: 'Jollof Rice',
          description: 'Smoky Nigerian jollof rice',
          category: 'mains',
          basePrice: 1500,
          stock: 0,
          isAvailable: true,
        },
      });
      await prisma.productVariant.createMany({
        data: [
          { productId: jollof.id, sku: 'JOLLOF-REG', attributes: { size: 'Regular' }, price: 1500, stock: 30 },
          { productId: jollof.id, sku: 'JOLLOF-LRG', attributes: { size: 'Large' },   price: 2200, stock: 20 },
        ],
      });

      // (3) Combo: Jollof Combo with size variant + REQUIRED protein + REQUIRED drink + OPTIONAL extras.
      const combo = await prisma.product.create({
        data: {
          merchantId: merchantRow.id,
          name: 'Jollof Combo',
          description: 'Jollof with your choice of protein, drink, and extras',
          category: 'combos',
          basePrice: 2500,
          stock: 0,
          isAvailable: true,
        },
      });
      await prisma.productVariant.createMany({
        data: [
          { productId: combo.id, sku: 'COMBO-REG', attributes: { size: 'Regular' }, price: 2500, stock: 25 },
          { productId: combo.id, sku: 'COMBO-LRG', attributes: { size: 'Large' },   price: 3200, stock: 15 },
        ],
      });

      await prisma.productOptionGroup.create({
        data: {
          productId: combo.id,
          name: 'Pick a protein',
          selectionRule: 'REQUIRED_ONE',
          minSelect: 1,
          maxSelect: 1,
          sortOrder: 1,
          items: {
            create: [
              { name: 'Chicken', priceDelta: 0,   isDefault: true,  sortOrder: 1 },
              { name: 'Beef',    priceDelta: 200, sortOrder: 2 },
              { name: 'Fish',    priceDelta: 300, sortOrder: 3 },
            ],
          },
        },
      });
      await prisma.productOptionGroup.create({
        data: {
          productId: combo.id,
          name: 'Pick a drink',
          selectionRule: 'REQUIRED_ONE',
          minSelect: 1,
          maxSelect: 1,
          sortOrder: 2,
          items: {
            create: [
              { name: 'Coke',          priceDelta: 0, isDefault: true, sortOrder: 1 },
              { name: 'Fanta',         priceDelta: 0, sortOrder: 2 },
              { name: 'Sprite',        priceDelta: 0, sortOrder: 3 },
              { name: 'Bottled water', priceDelta: 0, sortOrder: 4 },
            ],
          },
        },
      });
      await prisma.productOptionGroup.create({
        data: {
          productId: combo.id,
          name: 'Extras',
          selectionRule: 'OPTIONAL_MULTIPLE',
          minSelect: 0,
          maxSelect: 3,
          sortOrder: 3,
          items: {
            create: [
              { name: 'Plantain',     priceDelta: 300, sortOrder: 1 },
              { name: 'Coleslaw',     priceDelta: 200, sortOrder: 2 },
              { name: 'Extra meat',   priceDelta: 800, sortOrder: 3 },
              { name: 'Extra cheese', priceDelta: 500, sortOrder: 4 },
            ],
          },
        },
      });

      console.log(`✅ Seeded 3 sample products on test merchant (1 single-SKU + 1 sized + 1 combo)`);
    }
  }

  // ─── Phase 8 sample merchants: Pharmacy + Grocery ───────────────────────────
  // Gives the customer app a real prescription-required SKU and a grocery item
  // with pack-based variants so substitution preference and Rx upload can be
  // exercised end-to-end immediately after a fresh seed.
  const pharmacyPin = await bcrypt.hash('444444', SALT_ROUNDS);
  const pharmacyUser = await prisma.user.upsert({
    where: { email: 'pharmacy@test.com' },
    update: {},
    create: {
      phone: '08077778888',
      firstName: 'Sahel',
      lastName: 'Pharmacy',
      email: 'pharmacy@test.com',
      passwordHash: await bcrypt.hash('pharmacy123', SALT_ROUNDS),
      transactionPin: pharmacyPin,
      role: 'MERCHANT',
      status: 'ACTIVE',
      wallet: {
        create: {
          balance: 10000,
          virtualAccountNumber: '8077778888',
          virtualAccountBank: 'Wema Bank',
          virtualAccountName: 'VTU-Sahel Pharmacy',
        },
      },
      merchant: {
        create: {
          category: { connect: { slug: 'pharmacy' } },
          name: 'Sahel Pharmacy',
          description: 'Trusted pharmacy serving Katsina',
          phone: '08077778888',
          email: 'pharmacy@test.com',
          address: '5 Kofar Soro Road, Katsina',
          lat: 13.0008,
          lng: 7.6082,
          openingTime: '08:00',
          closingTime: '22:00',
          status: 'APPROVED',
          averageRating: 4.7,
          isOpen: true,
          isActive: true,
        },
      },
    },
  });
  console.log(`✅ Test pharmacy merchant created: ${pharmacyUser.email}`);

  const pharmacyMerchant = await prisma.merchant.findUnique({ where: { userId: pharmacyUser.id } });
  if (pharmacyMerchant) {
    const existingRxProducts = await prisma.product.count({ where: { merchantId: pharmacyMerchant.id } });
    if (existingRxProducts === 0) {
      // OTC analgesic - no prescription needed; pack-based variants.
      const paracetamol = await prisma.product.create({
        data: {
          merchantId: pharmacyMerchant.id,
          name: 'Paracetamol',
          description: 'OTC analgesic for mild pain and fever',
          category: 'analgesics',
          basePrice: 300,
          stock: 0,
          requiresPrescription: false,
          dosage: '1–2 tablets every 6 hours, max 4g/day',
          isAvailable: true,
        },
      });
      await prisma.productVariant.createMany({
        data: [
          { productId: paracetamol.id, sku: 'PARA-500MG-30', attributes: { strength: '500mg', form: 'TABLET' }, packSize: 30, packUnit: 'TABLET', packLabel: '30 tablets',   price: 600,  stock: 80 },
          { productId: paracetamol.id, sku: 'PARA-500MG-10', attributes: { strength: '500mg', form: 'TABLET' }, packSize: 10, packUnit: 'TABLET', packLabel: '10 tablets',   price: 250,  stock: 200 },
        ],
      });

      // Antibiotic - requires prescription. Two strengths.
      const amoxicillin = await prisma.product.create({
        data: {
          merchantId: pharmacyMerchant.id,
          name: 'Amoxicillin',
          description: 'Antibiotic - sold against valid prescription only',
          category: 'antibiotics',
          basePrice: 1500,
          stock: 0,
          requiresPrescription: true,
          dosage: '1 capsule every 8 hours - complete the full course',
          isAvailable: true,
        },
      });
      await prisma.productVariant.createMany({
        data: [
          { productId: amoxicillin.id, sku: 'AMOX-250-21',  attributes: { strength: '250mg', form: 'CAPSULE' }, packSize: 21, packUnit: 'CAPSULE', packLabel: '21 capsules', price: 1500, stock: 50 },
          { productId: amoxicillin.id, sku: 'AMOX-500-21',  attributes: { strength: '500mg', form: 'CAPSULE' }, packSize: 21, packUnit: 'CAPSULE', packLabel: '21 capsules', price: 2200, stock: 40 },
        ],
      });
      console.log(`✅ Seeded 2 sample products on pharmacy merchant (1 OTC + 1 Rx-required)`);
    }
  }

  const groceryUser = await prisma.user.upsert({
    where: { email: 'grocery@test.com' },
    update: {},
    create: {
      phone: '08099990000',
      firstName: 'Katsina',
      lastName: 'Mart',
      email: 'grocery@test.com',
      passwordHash: await bcrypt.hash('grocery123', SALT_ROUNDS),
      transactionPin: await bcrypt.hash('555555', SALT_ROUNDS),
      role: 'MERCHANT',
      status: 'ACTIVE',
      wallet: {
        create: {
          balance: 10000,
          virtualAccountNumber: '8099990000',
          virtualAccountBank: 'Wema Bank',
          virtualAccountName: 'VTU-Katsina Mart',
        },
      },
      merchant: {
        create: {
          category: { connect: { slug: 'grocery' } },
          name: 'Katsina Mart',
          description: 'Everyday dry groceries delivered',
          phone: '08099990000',
          email: 'grocery@test.com',
          address: '22 Nagogo Road, Katsina',
          lat: 13.0093,
          lng: 7.6005,
          openingTime: '07:00',
          closingTime: '21:30',
          status: 'APPROVED',
          averageRating: 4.5,
          isOpen: true,
          isActive: true,
        },
      },
    },
  });
  console.log(`✅ Test grocery merchant created: ${groceryUser.email}`);

  const groceryMerchant = await prisma.merchant.findUnique({ where: { userId: groceryUser.id } });
  if (groceryMerchant) {
    const existingGroceryProducts = await prisma.product.count({ where: { merchantId: groceryMerchant.id } });
    if (existingGroceryProducts === 0) {
      const rice = await prisma.product.create({
        data: {
          merchantId: groceryMerchant.id,
          name: 'Long Grain Rice',
          description: 'Parboiled long grain rice',
          category: 'staples',
          basePrice: 1800,
          stock: 0,
          isAvailable: true,
        },
      });
      await prisma.productVariant.createMany({
        data: [
          { productId: rice.id, sku: 'RICE-1KG',  attributes: {}, packSize: 1,  packUnit: 'KG', packLabel: '1 kg pack',  price: 1800,  stock: 60 },
          { productId: rice.id, sku: 'RICE-5KG',  attributes: {}, packSize: 5,  packUnit: 'KG', packLabel: '5 kg pack',  price: 8500,  stock: 40 },
          { productId: rice.id, sku: 'RICE-25KG', attributes: {}, packSize: 25, packUnit: 'KG', packLabel: '25 kg sack', price: 38000, stock: 15 },
        ],
      });

      const sugar = await prisma.product.create({
        data: {
          merchantId: groceryMerchant.id,
          name: 'Granulated Sugar',
          description: 'Refined granulated sugar',
          category: 'staples',
          basePrice: 700,
          stock: 0,
          isAvailable: true,
        },
      });
      await prisma.productVariant.createMany({
        data: [
          { productId: sugar.id, sku: 'SUGAR-500G', attributes: {}, packSize: 500, packUnit: 'G',  packLabel: '500 g pack', price: 700,  stock: 90 },
          { productId: sugar.id, sku: 'SUGAR-1KG',  attributes: {}, packSize: 1,   packUnit: 'KG', packLabel: '1 kg pack',  price: 1350, stock: 70 },
        ],
      });
      console.log(`✅ Seeded 2 sample products on grocery merchant (rice + sugar with pack variants)`);
    }
  }

  // Seed platform settings
  const settings = [
    { key: 'delivery.baseFare', value: 200, description: 'Base fare for delivery in NGN' },
    { key: 'delivery.perKmRate', value: 100, description: 'Per-km rate for delivery in NGN' },
    { key: 'delivery.platformFeePercent', value: 10, description: 'Platform fee % on delivery subtotal' },
    { key: 'delivery.riderEarningPercent', value: 80, description: 'Rider earns this % of delivery fee' },
    { key: 'delivery.cancellationFee', value: 200, description: 'Fee charged for cancelling after rider assigned' },
    // Phase 5 - Proof of Delivery gates. requirePodPhoto defaults to true so
    // every delivery in production has a doorstep photo on file. Signature is
    // opt-in (default false); admins can flip it on per environment. OTP gate
    // protects orders above ₦50k by requiring a 6-digit code shared by the
    // customer to the rider; below the threshold, OTP is skipped entirely.
    { key: 'delivery.requirePodPhoto', value: true, description: 'Require photo POD for DELIVERED transition' },
    { key: 'delivery.requireSignature', value: false, description: 'Require recipient signature for DELIVERED transition (opt-in)' },
    { key: 'delivery.podOtpThresholdNgn', value: 50000, description: 'Order total at/above which a customer OTP is required for DELIVERED' },
    { key: 'merchant.platformFeePercent', value: 15, description: 'Platform fee % deducted from merchant item subtotal' },
    { key: 'delivery.broadcastRadiusRings', value: [5, 10, 15], description: 'Rider search radius rings in km' },
    { key: 'delivery.broadcastRingTimeoutSec', value: 60, description: 'Seconds to wait per ring before expanding' },
    { key: 'delivery.autoCancelUnmatchedMs', value: 240000, description: 'Auto-cancel after all rings exhausted (ms)' },
    // Feature flag for the rider-matching pipeline. Until the rider app
    // workstream ships a client that listens for `rider:job:new` and accepts
    // via the existing rider acceptance endpoint, set this to `false` in
    // production - the worker will skip all rings and auto-cancel/refund
    // immediately, preventing 4 minutes of phantom "searching..." per
    // delivery. Flip back to `true` once a rider app is in the wild.
    { key: 'delivery.matchingEnabled', value: true, description: 'Master switch for the rider matching worker' },
    { key: 'wallet.minTopup', value: 100, description: 'Minimum wallet top-up amount in NGN' },
    { key: 'wallet.minWithdraw', value: 500, description: 'Minimum withdrawal amount in NGN' },
    { key: 'wallet.maxWithdraw', value: 500000, description: 'Maximum single withdrawal in NGN' },
    { key: 'wallet.withdrawalFee', value: 25, description: 'Flat fee per withdrawal in NGN' },
    { key: 'wallet.minTransfer', value: 50, description: 'Minimum P2P transfer amount in NGN' },
    { key: 'wallet.transferQuickAmounts', value: [500, 1000, 2000, 5000], description: 'Quick-amount chips on Send Money screen' },
    { key: 'wallet.withdrawQuickAmounts', value: [1000, 5000, 10000, 20000], description: 'Quick-amount chips on Withdraw screen' },
    { key: 'utility.minElectricityAmount', value: 500, description: 'Minimum electricity payment in NGN' },
    { key: 'utility.electricityQuickAmounts', value: [1000, 2000, 5000, 10000, 20000], description: 'Quick-amount chips on Electricity screen' },
    { key: 'utility.minAirtimeAmount', value: 100, description: 'Minimum airtime purchase in NGN (provider floor; below this hangs in PROCESSING)' },
    { key: 'utility.airtimeQuickAmounts', value: [100, 200, 500, 1000, 2000, 5000], description: 'Quick-amount chips on Airtime screen' },
    { key: 'auth.otpTtlSeconds', value: 600, description: 'OTP validity in seconds (10 min)' },
    { key: 'auth.pinMaxAttempts', value: 5, description: 'Max wrong PIN attempts before lockout' },
    { key: 'auth.pinLockoutMinutes', value: 30, description: 'PIN lockout duration in minutes' },
    { key: 'platform.currency', value: 'NGN', description: 'Default platform currency' },
    { key: 'platform.supportPhone', value: '08012345678', description: 'Customer support phone number' },
    { key: 'platform.supportEmail', value: 'support@iprime.ng', description: 'Customer support email' },
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

  // ─── VTU Networks (admin-managed catalogue of provider IDs) ────────────────
  // Networks/cable-names/discos live here so admin can edit provider IDs from
  // the dashboard without a deploy. VtuPlan rows reference these by
  // (type, providerNetworkId) pair - kept in sync via sweep on network edit.
  const vtuNetworks = [
    // ── AIRTIME networks ──
    { type: 'AIRTIME', providerNetworkId: 1, name: 'MTN',     sortOrder: 1 },
    { type: 'AIRTIME', providerNetworkId: 2, name: 'GLO',     sortOrder: 2 },
    { type: 'AIRTIME', providerNetworkId: 3, name: '9MOBILE', sortOrder: 3 },
    { type: 'AIRTIME', providerNetworkId: 4, name: 'AIRTEL',  sortOrder: 4 },
    { type: 'AIRTIME', providerNetworkId: 5, name: 'SMILE',   sortOrder: 5 },

    // ── DATA networks (mirror AIRTIME - same provider IDs) ──
    { type: 'DATA', providerNetworkId: 1, name: 'MTN',     sortOrder: 1 },
    { type: 'DATA', providerNetworkId: 2, name: 'GLO',     sortOrder: 2 },
    { type: 'DATA', providerNetworkId: 3, name: '9MOBILE', sortOrder: 3 },
    { type: 'DATA', providerNetworkId: 4, name: 'AIRTEL',  sortOrder: 4 },

    // ── CABLE names ──
    { type: 'CABLE', providerNetworkId: 1, name: 'GOTV',     sortOrder: 1 },
    { type: 'CABLE', providerNetworkId: 2, name: 'DSTV',     sortOrder: 2 },
    { type: 'CABLE', providerNetworkId: 3, name: 'STARTIME', sortOrder: 3 },

    // ── ELECTRICITY discos ──
    { type: 'ELECTRICITY', providerNetworkId: 1,  name: 'Ikeja',  sortOrder: 1 },
    { type: 'ELECTRICITY', providerNetworkId: 2,  name: 'Eko',    sortOrder: 2 },
    { type: 'ELECTRICITY', providerNetworkId: 3,  name: 'Abuja',  sortOrder: 3 },
    { type: 'ELECTRICITY', providerNetworkId: 4,  name: 'Kano',   sortOrder: 4 },
    { type: 'ELECTRICITY', providerNetworkId: 5,  name: 'Enugu',  sortOrder: 5 },
    { type: 'ELECTRICITY', providerNetworkId: 6,  name: 'PHC',    sortOrder: 6 },
    { type: 'ELECTRICITY', providerNetworkId: 7,  name: 'Ibadan', sortOrder: 7 },
    { type: 'ELECTRICITY', providerNetworkId: 8,  name: 'Kaduna', sortOrder: 8 },
    { type: 'ELECTRICITY', providerNetworkId: 9,  name: 'Jos',    sortOrder: 9 },
    { type: 'ELECTRICITY', providerNetworkId: 10, name: 'Benin',  sortOrder: 10 },
    { type: 'ELECTRICITY', providerNetworkId: 11, name: 'Yola',   sortOrder: 11 },
  ];
  for (const n of vtuNetworks) {
    await prisma.vtuNetwork.upsert({
      where: { type_providerNetworkId: { type: n.type, providerNetworkId: n.providerNetworkId } },
      update: { name: n.name, sortOrder: n.sortOrder, isActive: true },
      create: { ...n, isActive: true },
    });
  }
  console.log(`✅ VTU networks seeded (${vtuNetworks.length})`);

  // ─── VTU Plans (AlRahuz IDs from pricing doc) ───────────────────────────────
  // Clear old plans so wrong IDs from a previous seed don't persist
  await prisma.vtuPlan.deleteMany({});

  const vtuPlans = [
    // ── AIRTIME - amount-based; sellingPrice unused (user specifies amount) ──
    { type: 'AIRTIME', providerNetworkId: 1, networkName: 'MTN',     name: 'MTN Airtime',     costPrice: 0, sellingPrice: 0, sortOrder: 1 },
    { type: 'AIRTIME', providerNetworkId: 2, networkName: 'GLO',     name: 'GLO Airtime',     costPrice: 0, sellingPrice: 0, sortOrder: 2 },
    { type: 'AIRTIME', providerNetworkId: 4, networkName: 'AIRTEL',  name: 'AIRTEL Airtime',  costPrice: 0, sellingPrice: 0, sortOrder: 3 },
    { type: 'AIRTIME', providerNetworkId: 3, networkName: '9MOBILE', name: '9MOBILE Airtime', costPrice: 0, sellingPrice: 0, sortOrder: 4 },

    // ── MTN DATA - SME ────────────────────────────────────────────────────────
    { type: 'DATA', providerNetworkId: 1, networkName: 'MTN', providerPlanId: 219, planType: 'SME', name: 'MTN 500MB - 7 days',   dataSize: '500MB', validity: '7 days',  costPrice: 485,   sellingPrice: 510,   sortOrder: 10 },
    { type: 'DATA', providerNetworkId: 1, networkName: 'MTN', providerPlanId: 7,   planType: 'SME', name: 'MTN 1GB - 7 days',     dataSize: '1GB',   validity: '7 days',  costPrice: 780,   sellingPrice: 820,   sortOrder: 11 },
    { type: 'DATA', providerNetworkId: 1, networkName: 'MTN', providerPlanId: 467, planType: 'SME', name: 'MTN 1.5GB - 7 days',   dataSize: '1.5GB', validity: '7 days',  costPrice: 965,   sellingPrice: 1020,  sortOrder: 12 },
    { type: 'DATA', providerNetworkId: 1, networkName: 'MTN', providerPlanId: 8,   planType: 'SME', name: 'MTN 2GB - 30 days',    dataSize: '2GB',   validity: '30 days', costPrice: 1450,  sellingPrice: 1530,  sortOrder: 13 },
    { type: 'DATA', providerNetworkId: 1, networkName: 'MTN', providerPlanId: 44,  planType: 'SME', name: 'MTN 3.5GB - 30 days',  dataSize: '3.5GB', validity: '30 days', costPrice: 2450,  sellingPrice: 2580,  sortOrder: 14 },
    { type: 'DATA', providerNetworkId: 1, networkName: 'MTN', providerPlanId: 538, planType: 'SME', name: 'MTN 5GB - 30 days',    dataSize: '5GB',   validity: '30 days', costPrice: 1750,  sellingPrice: 1840,  sortOrder: 15 },
    { type: 'DATA', providerNetworkId: 1, networkName: 'MTN', providerPlanId: 539, planType: 'SME', name: 'MTN 20GB - 30 days',   dataSize: '20GB',  validity: '30 days', costPrice: 7300,  sellingPrice: 7670,  sortOrder: 16 },

    // ── MTN DATA - SME2 ───────────────────────────────────────────────────────
    { type: 'DATA', providerNetworkId: 1, networkName: 'MTN', providerPlanId: 562, planType: 'SME2', name: 'MTN 1GB - 30 days (SME2)',    dataSize: '1GB',   validity: '30 days', costPrice: 500,   sellingPrice: 530,   sortOrder: 20 },
    { type: 'DATA', providerNetworkId: 1, networkName: 'MTN', providerPlanId: 314, planType: 'SME2', name: 'MTN 2GB - 30 days (SME2)',    dataSize: '2GB',   validity: '30 days', costPrice: 1450,  sellingPrice: 1530,  sortOrder: 21 },
    { type: 'DATA', providerNetworkId: 1, networkName: 'MTN', providerPlanId: 310, planType: 'SME2', name: 'MTN 3.5GB - 30 days (SME2)',  dataSize: '3.5GB', validity: '30 days', costPrice: 2450,  sellingPrice: 2580,  sortOrder: 22 },
    { type: 'DATA', providerNetworkId: 1, networkName: 'MTN', providerPlanId: 466, planType: 'SME2', name: 'MTN 4.2GB - 30 days (SME2)',  dataSize: '4.2GB', validity: '30 days', costPrice: 2910,  sellingPrice: 3060,  sortOrder: 23 },
    { type: 'DATA', providerNetworkId: 1, networkName: 'MTN', providerPlanId: 308, planType: 'SME2', name: 'MTN 7GB - 30 days (SME2)',    dataSize: '7GB',   validity: '30 days', costPrice: 3450,  sellingPrice: 3630,  sortOrder: 24 },
    { type: 'DATA', providerNetworkId: 1, networkName: 'MTN', providerPlanId: 315, planType: 'SME2', name: 'MTN 10GB - 30 days (SME2)',   dataSize: '10GB',  validity: '30 days', costPrice: 4400,  sellingPrice: 4630,  sortOrder: 25 },
    { type: 'DATA', providerNetworkId: 1, networkName: 'MTN', providerPlanId: 463, planType: 'SME2', name: 'MTN 12.5GB - 30 days (SME2)', dataSize: '12.5GB',validity: '30 days', costPrice: 5350,  sellingPrice: 5620,  sortOrder: 26 },
    { type: 'DATA', providerNetworkId: 1, networkName: 'MTN', providerPlanId: 464, planType: 'SME2', name: 'MTN 16.5GB - 30 days (SME2)', dataSize: '16.5GB',validity: '30 days', costPrice: 6300,  sellingPrice: 6620,  sortOrder: 27 },
    { type: 'DATA', providerNetworkId: 1, networkName: 'MTN', providerPlanId: 473, planType: 'SME2', name: 'MTN 36GB - 30 days (SME2)',   dataSize: '36GB',  validity: '30 days', costPrice: 10800, sellingPrice: 11350, sortOrder: 28 },
    { type: 'DATA', providerNetworkId: 1, networkName: 'MTN', providerPlanId: 474, planType: 'SME2', name: 'MTN 65GB - 30 days (SME2)',   dataSize: '65GB',  validity: '30 days', costPrice: 15500, sellingPrice: 16280, sortOrder: 29 },
    { type: 'DATA', providerNetworkId: 1, networkName: 'MTN', providerPlanId: 475, planType: 'SME2', name: 'MTN 75GB - 30 days (SME2)',   dataSize: '75GB',  validity: '30 days', costPrice: 17450, sellingPrice: 18330, sortOrder: 30 },

    // ── GLO DATA - SME ────────────────────────────────────────────────────────
    { type: 'DATA', providerNetworkId: 2, networkName: 'GLO', providerPlanId: 369, planType: 'SME', name: 'GLO 1.5GB - 1 day',   dataSize: '1.5GB', validity: '1 day',   costPrice: 295,  sellingPrice: 310,  sortOrder: 40 },
    { type: 'DATA', providerNetworkId: 2, networkName: 'GLO', providerPlanId: 370, planType: 'SME', name: 'GLO 2.5GB - 2 days',  dataSize: '2.5GB', validity: '2 days',  costPrice: 485,  sellingPrice: 510,  sortOrder: 41 },
    { type: 'DATA', providerNetworkId: 2, networkName: 'GLO', providerPlanId: 547, planType: 'SME', name: 'GLO 3.5GB - 7 days',  dataSize: '3.5GB', validity: '7 days',  costPrice: 1000, sellingPrice: 1050, sortOrder: 42 },
    { type: 'DATA', providerNetworkId: 2, networkName: 'GLO', providerPlanId: 549, planType: 'SME', name: 'GLO 8.5GB - 7 days',  dataSize: '8.5GB', validity: '7 days',  costPrice: 2000, sellingPrice: 2100, sortOrder: 43 },
    { type: 'DATA', providerNetworkId: 2, networkName: 'GLO', providerPlanId: 371, planType: 'SME', name: 'GLO 10GB - 7 days',   dataSize: '10GB',  validity: '7 days',  costPrice: 1950, sellingPrice: 2050, sortOrder: 44 },

    // ── GLO DATA - Corporate Gifting ──────────────────────────────────────────
    { type: 'DATA', providerNetworkId: 2, networkName: 'GLO', providerPlanId: 290, planType: 'CORPORATE GIFTING', name: 'GLO 500MB - 30 days', dataSize: '500MB', validity: '30 days', costPrice: 200,  sellingPrice: 210,  sortOrder: 50 },
    { type: 'DATA', providerNetworkId: 2, networkName: 'GLO', providerPlanId: 285, planType: 'CORPORATE GIFTING', name: 'GLO 1GB - 30 days',   dataSize: '1GB',   validity: '30 days', costPrice: 400,  sellingPrice: 420,  sortOrder: 51 },
    { type: 'DATA', providerNetworkId: 2, networkName: 'GLO', providerPlanId: 286, planType: 'CORPORATE GIFTING', name: 'GLO 2GB - 30 days',   dataSize: '2GB',   validity: '30 days', costPrice: 800,  sellingPrice: 840,  sortOrder: 52 },
    { type: 'DATA', providerNetworkId: 2, networkName: 'GLO', providerPlanId: 287, planType: 'CORPORATE GIFTING', name: 'GLO 3GB - 30 days',   dataSize: '3GB',   validity: '30 days', costPrice: 1200, sellingPrice: 1260, sortOrder: 53 },
    { type: 'DATA', providerNetworkId: 2, networkName: 'GLO', providerPlanId: 288, planType: 'CORPORATE GIFTING', name: 'GLO 5GB - 30 days',   dataSize: '5GB',   validity: '30 days', costPrice: 2000, sellingPrice: 2100, sortOrder: 54 },
    { type: 'DATA', providerNetworkId: 2, networkName: 'GLO', providerPlanId: 289, planType: 'CORPORATE GIFTING', name: 'GLO 10GB - 30 days',  dataSize: '10GB',  validity: '30 days', costPrice: 4000, sellingPrice: 4200, sortOrder: 55 },

    // ── AIRTEL DATA - SME ─────────────────────────────────────────────────────
    { type: 'DATA', providerNetworkId: 4, networkName: 'AIRTEL', providerPlanId: 428, planType: 'SME', name: 'AIRTEL 10GB - 30 days', dataSize: '10GB', validity: '30 days', costPrice: 3050, sellingPrice: 3210, sortOrder: 60 },
    { type: 'DATA', providerNetworkId: 4, networkName: 'AIRTEL', providerPlanId: 603, planType: 'SME', name: 'AIRTEL 8GB - 30 days',  dataSize: '8GB',  validity: '30 days', costPrice: 1950, sellingPrice: 2050, sortOrder: 61 },
    { type: 'DATA', providerNetworkId: 4, networkName: 'AIRTEL', providerPlanId: 595, planType: 'SME', name: 'AIRTEL 5GB - 7 days',   dataSize: '5GB',  validity: '7 days',  costPrice: 1460, sellingPrice: 1540, sortOrder: 62 },

    // ── AIRTEL DATA - Corporate Gifting ───────────────────────────────────────
    { type: 'DATA', providerNetworkId: 4, networkName: 'AIRTEL', providerPlanId: 516, planType: 'CORPORATE GIFTING', name: 'AIRTEL 1GB - 7 days',   dataSize: '1GB',  validity: '7 days',  costPrice: 784,  sellingPrice: 830,  sortOrder: 70 },
    { type: 'DATA', providerNetworkId: 4, networkName: 'AIRTEL', providerPlanId: 517, planType: 'CORPORATE GIFTING', name: 'AIRTEL 2GB - 30 days',  dataSize: '2GB',  validity: '30 days', costPrice: 1425, sellingPrice: 1500, sortOrder: 71 },
    { type: 'DATA', providerNetworkId: 4, networkName: 'AIRTEL', providerPlanId: 518, planType: 'CORPORATE GIFTING', name: 'AIRTEL 3GB - 30 days',  dataSize: '3GB',  validity: '30 days', costPrice: 1950, sellingPrice: 2050, sortOrder: 72 },
    { type: 'DATA', providerNetworkId: 4, networkName: 'AIRTEL', providerPlanId: 519, planType: 'CORPORATE GIFTING', name: 'AIRTEL 4GB - 30 days',  dataSize: '4GB',  validity: '30 days', costPrice: 2450, sellingPrice: 2580, sortOrder: 73 },
    { type: 'DATA', providerNetworkId: 4, networkName: 'AIRTEL', providerPlanId: 520, planType: 'CORPORATE GIFTING', name: 'AIRTEL 8GB - 30 days',  dataSize: '8GB',  validity: '30 days', costPrice: 2950, sellingPrice: 3100, sortOrder: 74 },
    { type: 'DATA', providerNetworkId: 4, networkName: 'AIRTEL', providerPlanId: 521, planType: 'CORPORATE GIFTING', name: 'AIRTEL 10GB - 30 days', dataSize: '10GB', validity: '30 days', costPrice: 3910, sellingPrice: 4110, sortOrder: 75 },
    { type: 'DATA', providerNetworkId: 4, networkName: 'AIRTEL', providerPlanId: 522, planType: 'CORPORATE GIFTING', name: 'AIRTEL 13GB - 30 days', dataSize: '13GB', validity: '30 days', costPrice: 4900, sellingPrice: 5150, sortOrder: 76 },
    { type: 'DATA', providerNetworkId: 4, networkName: 'AIRTEL', providerPlanId: 524, planType: 'CORPORATE GIFTING', name: 'AIRTEL 25GB - 30 days', dataSize: '25GB', validity: '30 days', costPrice: 7820, sellingPrice: 8220, sortOrder: 77 },

    // ── 9MOBILE DATA - SME ────────────────────────────────────────────────────
    { type: 'DATA', providerNetworkId: 3, networkName: '9MOBILE', providerPlanId: 248, planType: 'SME', name: '9MOBILE 1GB - 1 month',   dataSize: '1GB',   validity: '1 month', costPrice: 220,  sellingPrice: 240,  sortOrder: 80 },
    { type: 'DATA', providerNetworkId: 3, networkName: '9MOBILE', providerPlanId: 249, planType: 'SME', name: '9MOBILE 1.5GB - 1 month', dataSize: '1.5GB', validity: '1 month', costPrice: 330,  sellingPrice: 350,  sortOrder: 81 },
    { type: 'DATA', providerNetworkId: 3, networkName: '9MOBILE', providerPlanId: 251, planType: 'SME', name: '9MOBILE 3GB - 1 month',   dataSize: '3GB',   validity: '1 month', costPrice: 660,  sellingPrice: 700,  sortOrder: 82 },
    { type: 'DATA', providerNetworkId: 3, networkName: '9MOBILE', providerPlanId: 252, planType: 'SME', name: '9MOBILE 4GB - 1 month',   dataSize: '4GB',   validity: '1 month', costPrice: 880,  sellingPrice: 930,  sortOrder: 83 },
    { type: 'DATA', providerNetworkId: 3, networkName: '9MOBILE', providerPlanId: 253, planType: 'SME', name: '9MOBILE 5GB - 1 month',   dataSize: '5GB',   validity: '1 month', costPrice: 1100, sellingPrice: 1160, sortOrder: 84 },
    { type: 'DATA', providerNetworkId: 3, networkName: '9MOBILE', providerPlanId: 292, planType: 'SME', name: '9MOBILE 10GB - 30 days',  dataSize: '10GB',  validity: '30 days', costPrice: 2200, sellingPrice: 2320, sortOrder: 85 },

    // ── 9MOBILE DATA - Corporate Gifting ──────────────────────────────────────
    { type: 'DATA', providerNetworkId: 3, networkName: '9MOBILE', providerPlanId: 296, planType: 'CORPORATE GIFTING', name: '9MOBILE 1GB - 30 days',  dataSize: '1GB',  validity: '30 days', costPrice: 480,  sellingPrice: 510,  sortOrder: 90 },
    { type: 'DATA', providerNetworkId: 3, networkName: '9MOBILE', providerPlanId: 297, planType: 'CORPORATE GIFTING', name: '9MOBILE 2GB - 30 days',  dataSize: '2GB',  validity: '30 days', costPrice: 960,  sellingPrice: 1010, sortOrder: 91 },
    { type: 'DATA', providerNetworkId: 3, networkName: '9MOBILE', providerPlanId: 300, planType: 'CORPORATE GIFTING', name: '9MOBILE 5GB - 30 days',  dataSize: '5GB',  validity: '30 days', costPrice: 2400, sellingPrice: 2520, sortOrder: 92 },
    { type: 'DATA', providerNetworkId: 3, networkName: '9MOBILE', providerPlanId: 301, planType: 'CORPORATE GIFTING', name: '9MOBILE 10GB - 30 days', dataSize: '10GB', validity: '30 days', costPrice: 4800, sellingPrice: 5050, sortOrder: 93 },

    // ── GOTV CABLE ────────────────────────────────────────────────────────────
    { type: 'CABLE', providerNetworkId: 1, networkName: 'GOTV', providerPlanId: 34, name: 'GOtv Smallie - Monthly', validity: '1 month', costPrice: 1900,  sellingPrice: 2000,  sortOrder: 100 },
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
    { type: 'CABLE', providerNetworkId: 3, networkName: 'STARTIME', providerPlanId: 14, name: 'StarTimes Nova - Monthly',       validity: '1 month', costPrice: 2100, sellingPrice: 2200,  sortOrder: 120 },
    { type: 'CABLE', providerNetworkId: 3, networkName: 'STARTIME', providerPlanId: 12, name: 'StarTimes Basic - Monthly',      validity: '1 month', costPrice: 4000, sellingPrice: 4200,  sortOrder: 121 },
    { type: 'CABLE', providerNetworkId: 3, networkName: 'STARTIME', providerPlanId: 13, name: 'StarTimes Smart - Monthly',      validity: '1 month', costPrice: 5100, sellingPrice: 5400,  sortOrder: 122 },
    { type: 'CABLE', providerNetworkId: 3, networkName: 'STARTIME', providerPlanId: 11, name: 'StarTimes Classic - Monthly',    validity: '1 month', costPrice: 6000, sellingPrice: 6300,  sortOrder: 123 },
    { type: 'CABLE', providerNetworkId: 3, networkName: 'STARTIME', providerPlanId: 48, name: 'StarTimes Super - Monthly',      validity: '1 month', costPrice: 9000, sellingPrice: 9500,  sortOrder: 124 },
    { type: 'CABLE', providerNetworkId: 3, networkName: 'STARTIME', providerPlanId: 15, name: 'StarTimes Super Plus - Monthly', validity: '1 month', costPrice: 9800, sellingPrice: 10300, sortOrder: 125 },

    // ── ELECTRICITY - amount-based; sellingPrice unused ───────────────────────
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
  console.log(`✅ VTU plans seeded (${vtuPlans.length} plans - AlRahuz IDs from pricing doc)`);

  console.log('\n🌱 Seeding complete!');
  console.log('---');
  console.log('Admin login:    admin@iprime.ng / admin123456 (PIN: 000000)');
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

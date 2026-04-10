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

  console.log('\n🌱 Seeding complete!');
  console.log('---');
  console.log('Admin login:    admin@vtulogistics.com / admin123456 (PIN: 000000)');
  console.log('Customer login: customer@test.com / customer123 (PIN: 111111)');
  console.log('Rider login:    rider@test.com / rider123456 (PIN: 222222)');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

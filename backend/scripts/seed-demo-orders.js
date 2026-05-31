/**
 * seed-demo-orders.js — drop a realistic spread of demo orders onto one merchant
 * so the merchant dashboard's Orders + Earnings screens have something to show
 * for a walkthrough / screen recording.
 *
 * It creates:
 *   - 1 REQUESTED order        → so you can demo Accept → Process → Ready on camera
 *   - 1 PROCESSING order
 *   - 1 READY_FOR_PICKUP order
 *   - 3 DELIVERED orders        → past sales, so Earnings shows real numbers
 *   - 1 CANCELLED order
 * …then sets the merchant wallet balances to match (available = delivered
 * earnings, pending = in-flight earnings).
 *
 * Re-running is safe: it first removes its own previously-seeded demo orders
 * (matched by the dropoff marker) before re-creating them.
 *
 * Usage (from the backend/ folder, with your local DB running + migrated + seeded):
 *   node scripts/seed-demo-orders.js                     # defaults to merchant@test.com
 *   node scripts/seed-demo-orders.js you@yourshop.com    # the email you registered with
 *
 * The email can be either the merchant's login email or its business email.
 */

// Load backend/.env so DATABASE_URL is available regardless of where this is run
// from. Optional — if dotenv isn't installed, we assume the env is already set.
try {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
} catch {
  /* dotenv not installed — relying on a pre-set DATABASE_URL */
}
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const DROPOFF_MARKER = 'Demo order (recording)' // lets us find + clean up our own rows

// A few believable Katsina drop-off points.
const DROPOFFS = [
  'Kofar Kaura, Katsina',
  'Layout Road, GRA, Katsina',
  'Kofar Marusa, Katsina',
  'IBB Way, Katsina',
  'Filin Samji, Katsina',
]

// Fallback item names if the merchant has no products yet.
const FALLBACK_ITEMS = [
  { name: 'Jollof Rice', price: 1500 },
  { name: 'Fried Rice & Chicken', price: 2200 },
  { name: 'Bottled Water (50cl)', price: 200 },
  { name: 'Jollof Combo', price: 2500 },
  { name: 'Shawarma', price: 1800 },
]

const money = (n) => Math.round(Number(n) * 100) / 100
const minsAgo = (m) => new Date(Date.now() - m * 60 * 1000)

async function main() {
  const emailArg = (process.argv[2] || 'merchant@test.com').trim().toLowerCase()
  console.log(`\n🎬 Seeding demo orders for merchant: ${emailArg}\n`)

  // 1. Find the merchant (by business email OR the owner's login email).
  const merchant = await prisma.merchant.findFirst({
    where: { OR: [{ email: emailArg }, { user: { email: emailArg } }] },
    include: {
      user: true,
      wallet: true,
      products: { include: { variants: true }, take: 5 },
    },
  })
  if (!merchant) {
    console.error(
      `❌ No merchant found for "${emailArg}".\n` +
        `   • Make sure the account is registered (and approved).\n` +
        `   • Or pass the right email:  node scripts/seed-demo-orders.js you@yourshop.com`,
    )
    process.exit(1)
  }
  console.log(`✅ Merchant: "${merchant.name}" (${merchant.status})`)

  // 2. Find a customer to attach the orders to (the seed creates customer@test.com).
  const customer =
    (await prisma.user.findFirst({ where: { email: 'customer@test.com' } })) ||
    (await prisma.user.findFirst({ where: { role: 'CUSTOMER' } }))
  if (!customer) {
    console.error(
      `❌ No customer account found to place the orders.\n` +
        `   Run the seed first:  npm run db:seed   (creates customer@test.com)`,
    )
    process.exit(1)
  }
  console.log(`✅ Customer: ${customer.firstName} ${customer.lastName} <${customer.email}>`)

  // 3. Build an item pool from the merchant's real products (nicer), else fallback.
  const itemPool =
    merchant.products.length > 0
      ? merchant.products.map((p) => {
          const v = p.variants[0]
          return { name: p.name, price: Number(v?.price ?? p.basePrice ?? 1000) }
        })
      : FALLBACK_ITEMS
  const pick = (i) => itemPool[i % itemPool.length]

  // 4. Clean up any demo orders we created on a previous run (cascades items).
  const removed = await prisma.request.deleteMany({
    where: { merchantId: merchant.id, dropoffName: DROPOFF_MARKER },
  })
  if (removed.count) console.log(`🧹 Removed ${removed.count} previous demo order(s)`)

  // 5. The orders to create: [status, ageMinutes, [itemIndex, qty][]]
  const PLAN = [
    ['REQUESTED', 7, [[0, 2]]],
    ['PROCESSING', 24, [[3, 1], [2, 2]]],
    ['READY_FOR_PICKUP', 41, [[1, 1]]],
    ['DELIVERED', 190, [[0, 1], [4, 1]]],
    ['DELIVERED', 1500, [[3, 2]]],
    ['DELIVERED', 2900, [[1, 1], [2, 3]]],
    ['CANCELLED', 320, [[4, 1]]],
  ]

  const commissionPct = Number(merchant.commissionRate ?? 15)
  let availableBalance = 0 // from delivered orders
  let pendingBalance = 0 // from in-flight (accepted/processing/ready) orders

  const lifecycleStamps = (status, createdAt) => {
    const order = [
      'ACCEPTED', 'PROCESSING', 'READY_FOR_PICKUP', 'RIDER_ASSIGNED',
      'PICKED_UP', 'IN_TRANSIT', 'DELIVERED',
    ]
    const reached = status === 'CANCELLED' ? [] : order.slice(0, order.indexOf(status) + 1)
    const fieldFor = {
      ACCEPTED: 'acceptedAt', PROCESSING: 'processingAt', READY_FOR_PICKUP: 'readyAt',
      RIDER_ASSIGNED: 'riderAssignedAt', PICKED_UP: 'pickedUpAt', IN_TRANSIT: 'inTransitAt',
      DELIVERED: 'deliveredAt',
    }
    const stamps = {}
    reached.forEach((s, i) => {
      if (fieldFor[s]) stamps[fieldFor[s]] = new Date(createdAt.getTime() + (i + 1) * 4 * 60 * 1000)
    })
    if (status === 'CANCELLED') {
      stamps.cancelledAt = new Date(createdAt.getTime() + 6 * 60 * 1000)
      stamps.cancelledBy = 'customer'
      stamps.cancellationReason = 'Changed my mind'
    }
    return stamps
  }

  let made = 0
  for (let idx = 0; idx < PLAN.length; idx++) {
    const [status, age, lines] = PLAN[idx]
    const createdAt = minsAgo(age)

    const items = lines.map(([i, qty]) => {
      const it = pick(i)
      return {
        name: it.name,
        unitPrice: money(it.price),
        quantity: qty,
        lineTotal: money(it.price * qty),
      }
    })

    const subtotal = money(items.reduce((s, it) => s + Number(it.lineTotal), 0))
    const deliveryFee = 500
    const platformFee = money((subtotal * commissionPct) / 100)
    const total = money(subtotal + deliveryFee)
    const riderEarning = money(deliveryFee * 0.8)
    const merchantEarning = money(subtotal - platformFee)
    const platformEarning = money(platformFee + (deliveryFee - riderEarning))

    if (status === 'DELIVERED') availableBalance += merchantEarning
    else if (status !== 'CANCELLED') pendingBalance += merchantEarning

    await prisma.request.create({
      data: {
        type: 'MERCHANT_ORDER',
        status,
        customerId: customer.id,
        merchantId: merchant.id,
        createdAt,
        pickupName: merchant.name,
        pickupAddress: merchant.address || 'Katsina',
        pickupLat: merchant.lat || 12.9908,
        pickupLng: merchant.lng || 7.6018,
        dropoffName: DROPOFF_MARKER, // <-- marker for safe re-runs
        dropoffAddress: DROPOFFS[idx % DROPOFFS.length],
        dropoffLat: (merchant.lat || 12.9908) + 0.012,
        dropoffLng: (merchant.lng || 7.6018) + 0.009,
        subtotal,
        deliveryFee,
        platformFee,
        total,
        customerPaid: total,
        merchantEarning,
        riderEarning,
        platformEarning,
        distanceKm: 2.4,
        estimatedMinutes: 28,
        ...lifecycleStamps(status, createdAt),
        items: { create: items },
      },
    })
    made++
    console.log(`   • ${status.padEnd(16)} ₦${total.toLocaleString()}  (${items.map((i) => `${i.quantity}× ${i.name}`).join(', ')})`)
  }

  // 6. Make the wallet reflect the orders so the Earnings page isn't empty.
  const totalEarnings = money(availableBalance + pendingBalance)
  await prisma.merchantWallet.upsert({
    where: { merchantId: merchant.id },
    update: {
      availableBalance: money(availableBalance),
      pendingBalance: money(pendingBalance),
      totalEarnings,
    },
    create: {
      merchantId: merchant.id,
      availableBalance: money(availableBalance),
      pendingBalance: money(pendingBalance),
      totalEarnings,
    },
  })

  console.log(
    `\n✅ Created ${made} demo orders.\n` +
      `   Wallet → Available: ₦${money(availableBalance).toLocaleString()} · ` +
      `Pending: ₦${money(pendingBalance).toLocaleString()} · ` +
      `Total: ₦${totalEarnings.toLocaleString()}\n` +
      `\nLog in to the merchant dashboard and check Orders + Earnings. 🎬\n` +
      `(Re-run this script anytime to reset the demo orders.)\n`,
  )
}

main()
  .catch((e) => {
    console.error('❌ Failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

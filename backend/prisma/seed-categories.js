/**
 * Seed / refresh ALL merchant categories with their attributeSchema.
 *
 * Run with:   node prisma/seed-categories.js
 * Idempotent: upserts by `slug`, so re-running just updates the schemas.
 *
 * ── What attributeSchema means (plain English) ──────────────────────────────
 *   axes      → which "this product comes in versions" boxes the merchant's
 *               product form shows. Each axis becomes separate SKUs with their
 *               own price + stock. Only these names are understood by the form:
 *                   size | color | strength | form | capacity | flavor
 *   pack      → whether the form shows a "pack size + pack unit" input at all.
 *   packUnits → the MENU of units a merchant may choose from for THIS category.
 *               It is multi-select here because you're defining the allowed list;
 *               the merchant then picks exactly ONE unit per product. Valid units:
 *                   ML L G KG TABLET CAPSULE PIECE PAIR PACK BOTTLE SACHET CARTON
 *   sizeSystem→ optional label for the size axis (e.g. 'EU' for shoes).
 *
 * Rule of thumb used below:
 *   - "Comes in sizes/colours the shop stocks separately?"  → add an axis.
 *   - "Sold as a measured bundle (500 ml, 1 kg, 30 tablets)?" → pack: true.
 *   - When unsure, prefer FEWER axes — merchants can add per-product detail,
 *     and an over-asking form is what confuses people.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// All categories. Fixed UUIDs keep re-runs stable. The first six mirror the
// main seed exactly (pure superset); everything after is the expanded set.
const categories = [
  // ── Food & Fresh ──────────────────────────────────────────────────────────
  {
    id: '00000000-0000-4000-a000-000000000001',
    name: 'Food', slug: 'restaurant', description: 'Order from restaurants',
    icon: 'restaurant', color: '#EA580C', sortOrder: 10, hasPreparation: true,
    // Sizes (Small/Medium/Large) typed in directly; toppings/sides are add-ons.
    attributeSchema: { axes: ['size'], pack: false },
  },
  {
    id: '00000000-0000-4000-a000-000000000020',
    name: 'Bakery', slug: 'bakery', description: 'Bread, cakes and pastries',
    icon: 'cake', color: '#D97706', sortOrder: 12, hasPreparation: true,
    // Cakes come in sizes; bread/pastries sold by the piece or pack.
    attributeSchema: { axes: ['size'], pack: true, packUnits: ['PIECE', 'PACK', 'CARTON'] },
  },
  {
    id: '00000000-0000-4000-a000-000000000021',
    name: 'Drinks & Beverages', slug: 'drinks', description: 'Soft drinks, juices and more',
    icon: 'cup-soda', color: '#0EA5E9', sortOrder: 14, hasPreparation: false,
    // Flavour is the real variant; bottle/can volume is the pack.
    attributeSchema: { axes: ['flavor'], pack: true, packUnits: ['ML', 'L', 'BOTTLE', 'CARTON', 'PACK'] },
  },
  {
    id: '00000000-0000-4000-a000-000000000022',
    name: 'Meat & Seafood', slug: 'meat-seafood', description: 'Fresh meat, poultry and fish',
    icon: 'beef', color: '#B91C1C', sortOrder: 16, hasPreparation: true,
    // Sold by weight or per piece; no version axes.
    attributeSchema: { axes: [], pack: true, packUnits: ['KG', 'G', 'PIECE'] },
  },
  {
    id: '00000000-0000-4000-a000-000000000023',
    name: 'Fruits & Vegetables', slug: 'produce', description: 'Fresh farm produce',
    icon: 'apple', color: '#16A34A', sortOrder: 18, hasPreparation: false,
    attributeSchema: { axes: [], pack: true, packUnits: ['KG', 'G', 'PIECE', 'PACK'] },
  },
  {
    id: '00000000-0000-4000-a000-000000000024',
    name: 'Water', slug: 'water', description: 'Bottled and sachet water',
    icon: 'droplet', color: '#0891B2', sortOrder: 19, hasPreparation: false,
    attributeSchema: { axes: [], pack: true, packUnits: ['ML', 'L', 'BOTTLE', 'SACHET', 'PACK', 'CARTON'] },
  },

  // ── Grocery & Household ───────────────────────────────────────────────────
  {
    id: '00000000-0000-4000-a000-000000000002',
    name: 'Groceries', slug: 'grocery', description: 'Shop supermarkets, drinks and household',
    icon: 'basket', color: '#7C3AED', sortOrder: 20, hasPreparation: true,
    // One shop carries both dry and liquid, so the unit list is the union.
    attributeSchema: { axes: [], pack: true, packUnits: ['G', 'KG', 'PACK', 'SACHET', 'CARTON', 'ML', 'L', 'BOTTLE', 'PIECE'] },
  },
  {
    id: '00000000-0000-4000-a000-000000000025',
    name: 'Household & Cleaning', slug: 'household', description: 'Detergents, tissue and home supplies',
    icon: 'spray-can', color: '#2563EB', sortOrder: 22, hasPreparation: false,
    attributeSchema: { axes: [], pack: true, packUnits: ['ML', 'L', 'G', 'KG', 'PIECE', 'PACK', 'SACHET', 'CARTON'] },
  },
  {
    id: '00000000-0000-4000-a000-000000000026',
    name: 'Baby Products', slug: 'baby', description: 'Diapers, formula and baby care',
    icon: 'baby', color: '#F472B6', sortOrder: 24, hasPreparation: false,
    // Diapers come in sizes; formula/wipes sold by pack/weight/volume.
    attributeSchema: { axes: ['size'], pack: true, packUnits: ['PIECE', 'PACK', 'SACHET', 'G', 'ML'] },
  },
  {
    id: '00000000-0000-4000-a000-000000000027',
    name: 'Pet Supplies', slug: 'pets', description: 'Pet food and accessories',
    icon: 'paw-print', color: '#92400E', sortOrder: 26, hasPreparation: false,
    attributeSchema: { axes: ['flavor'], pack: true, packUnits: ['KG', 'G', 'PACK', 'CARTON', 'PIECE'] },
  },

  // ── Health & Beauty ───────────────────────────────────────────────────────
  {
    id: '00000000-0000-4000-a000-000000000003',
    name: 'Pharmacy', slug: 'pharmacy', description: 'Order medicines',
    icon: 'pill', color: '#059669', sortOrder: 30, hasPreparation: false,
    // strength (250mg/500mg) + form (tablet/syrup) are the genuine variants;
    // pack unit is how the box is measured (30 tablets, 100 ml).
    attributeSchema: { axes: ['strength', 'form'], pack: true, packUnits: ['TABLET', 'CAPSULE', 'ML', 'BOTTLE', 'SACHET'] },
  },
  {
    id: '00000000-0000-4000-a000-000000000028',
    name: 'Health & Personal Care', slug: 'personal-care', description: 'Toiletries and wellness',
    icon: 'heart-pulse', color: '#10B981', sortOrder: 32, hasPreparation: false,
    attributeSchema: { axes: [], pack: true, packUnits: ['ML', 'L', 'G', 'PIECE', 'PACK', 'SACHET'] },
  },
  {
    id: '00000000-0000-4000-a000-000000000029',
    name: 'Beauty & Cosmetics', slug: 'beauty', description: 'Makeup, skincare and fragrance',
    icon: 'sparkles', color: '#DB2777', sortOrder: 34, hasPreparation: false,
    // Shade is captured by the colour axis; volume/weight is the pack.
    attributeSchema: { axes: ['color'], pack: true, packUnits: ['ML', 'G', 'PIECE', 'PACK'] },
  },

  // ── Fashion & Accessories ─────────────────────────────────────────────────
  {
    id: '00000000-0000-4000-a000-000000000005',
    name: 'Fashion', slug: 'fashion', description: 'Clothing',
    icon: 'shirt', color: '#DB2777', sortOrder: 40, hasPreparation: false,
    attributeSchema: { axes: ['size', 'color'], pack: false },
  },
  {
    id: '00000000-0000-4000-a000-000000000006',
    name: 'Shoes', slug: 'shoes', description: 'Footwear',
    icon: 'footprints', color: '#A16207', sortOrder: 42, hasPreparation: false,
    attributeSchema: { axes: ['size', 'color'], pack: false, sizeSystem: 'EU' },
  },
  {
    id: '00000000-0000-4000-a000-000000000030',
    name: 'Bags & Accessories', slug: 'accessories', description: 'Bags, belts and accessories',
    icon: 'shopping-bag', color: '#9333EA', sortOrder: 44, hasPreparation: false,
    attributeSchema: { axes: ['color'], pack: false },
  },
  {
    id: '00000000-0000-4000-a000-000000000031',
    name: 'Jewelry & Watches', slug: 'jewelry', description: 'Jewelry, watches and timepieces',
    icon: 'watch', color: '#CA8A04', sortOrder: 46, hasPreparation: false,
    attributeSchema: { axes: ['color'], pack: false },
  },

  // ── Electronics & Home ────────────────────────────────────────────────────
  {
    id: '00000000-0000-4000-a000-000000000007',
    name: 'Electronics', slug: 'electronics', description: 'Phones & accessories',
    icon: 'smartphone', color: '#475569', sortOrder: 50, hasPreparation: false,
    attributeSchema: { axes: ['capacity', 'color'], pack: false },
  },
  {
    id: '00000000-0000-4000-a000-000000000032',
    name: 'Phone Accessories', slug: 'phone-accessories', description: 'Chargers, cases and cables',
    icon: 'cable', color: '#64748B', sortOrder: 52, hasPreparation: false,
    attributeSchema: { axes: ['color'], pack: false },
  },
  {
    id: '00000000-0000-4000-a000-000000000033',
    name: 'Home & Kitchen', slug: 'home-kitchen', description: 'Cookware, utensils and home goods',
    icon: 'cooking-pot', color: '#0D9488', sortOrder: 54, hasPreparation: false,
    attributeSchema: { axes: ['size', 'color'], pack: false },
  },
  {
    id: '00000000-0000-4000-a000-000000000034',
    name: 'Furniture', slug: 'furniture', description: 'Home and office furniture',
    icon: 'armchair', color: '#7C2D12', sortOrder: 56, hasPreparation: false,
    attributeSchema: { axes: ['color'], pack: false },
  },

  // ── Specialty ─────────────────────────────────────────────────────────────
  {
    id: '00000000-0000-4000-a000-000000000035',
    name: 'Books & Stationery', slug: 'books-stationery', description: 'Books, pens and office supplies',
    icon: 'book-open', color: '#1D4ED8', sortOrder: 60, hasPreparation: false,
    attributeSchema: { axes: ['color'], pack: true, packUnits: ['PIECE', 'PACK', 'CARTON'] },
  },
  {
    id: '00000000-0000-4000-a000-000000000036',
    name: 'Toys & Games', slug: 'toys', description: 'Toys, games and hobbies',
    icon: 'gamepad-2', color: '#E11D48', sortOrder: 62, hasPreparation: false,
    attributeSchema: { axes: ['color'], pack: false },
  },
  {
    id: '00000000-0000-4000-a000-000000000037',
    name: 'Sports & Fitness', slug: 'sports', description: 'Sportswear and equipment',
    icon: 'dumbbell', color: '#15803D', sortOrder: 64, hasPreparation: false,
    attributeSchema: { axes: ['size', 'color'], pack: false },
  },
  {
    id: '00000000-0000-4000-a000-000000000038',
    name: 'Hardware & Building', slug: 'hardware', description: 'Tools and building materials',
    icon: 'wrench', color: '#57534E', sortOrder: 66, hasPreparation: false,
    attributeSchema: { axes: ['size'], pack: true, packUnits: ['PIECE', 'KG', 'PACK', 'CARTON', 'L'] },
  },
  {
    id: '00000000-0000-4000-a000-000000000039',
    name: 'Agriculture & Farm', slug: 'agriculture', description: 'Seeds, feed and farm inputs',
    icon: 'sprout', color: '#65A30D', sortOrder: 68, hasPreparation: false,
    attributeSchema: { axes: [], pack: true, packUnits: ['KG', 'G', 'SACHET', 'L', 'ML', 'PACK'] },
  },
  {
    id: '00000000-0000-4000-a000-000000000040',
    name: 'Automotive', slug: 'automotive', description: 'Spare parts, oils and accessories',
    icon: 'car', color: '#334155', sortOrder: 70, hasPreparation: false,
    // Parts by the piece; oils/fluids by volume.
    attributeSchema: { axes: [], pack: true, packUnits: ['PIECE', 'L', 'ML'] },
  },
];

async function main() {
  console.log(`Seeding ${categories.length} merchant categories…\n`);

  for (const cat of categories) {
    await prisma.merchantCategory.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name, description: cat.description, icon: cat.icon, color: cat.color,
        sortOrder: cat.sortOrder, hasPreparation: cat.hasPreparation, isActive: true,
        attributeSchema: cat.attributeSchema,
      },
      create: cat,
    });

    const s = cat.attributeSchema;
    const axes = s.axes.length ? s.axes.join(', ') : '—';
    const pack = s.pack ? (s.packUnits || []).join('/') : 'no pack';
    console.log(`  ✓ ${cat.name.padEnd(24)} axes: ${axes.padEnd(20)} pack: ${pack}`);
  }

  console.log(`\n✅ Seeded ${categories.length} categories with attributeSchema.`);
}

main()
  .catch((e) => {
    console.error('❌ Category seed failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

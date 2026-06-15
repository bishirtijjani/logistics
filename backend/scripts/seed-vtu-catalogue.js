/**
 * seed-vtu-catalogue.js
 *
 * Refreshes ONLY the VTU catalogue (networks/discos + data/cable/airtime/
 * electricity plans) for the BilalSadaSub provider, without touching anything
 * else the full prisma seed creates. Safe to run against production:
 *
 *     node backend/scripts/seed-vtu-catalogue.js
 *
 * It reads backend/prisma/data/bilalsada-plans.json (regenerate that first with
 * `node scripts/build-vtu-catalogue.js` whenever BilalSada changes prices).
 *
 * Both VtuNetwork and VtuPlan are fully replaced so a re-run after the AlRahuz
 * switch can't leave stale provider IDs behind. There are no FKs from VtuPlan
 * to VtuNetwork (they're linked by the (type, providerNetworkId) value), so the
 * wipe-and-recreate is safe.
 */

const { PrismaClient } = require('@prisma/client');
const { data: dataPlans, cable: cablePlans } = require('../prisma/data/bilalsada-plans.json');

const prisma = new PrismaClient();

const networks = [
  // AIRTIME
  { type: 'AIRTIME', providerNetworkId: 1, name: 'MTN',     sortOrder: 1 },
  { type: 'AIRTIME', providerNetworkId: 2, name: 'AIRTEL',  sortOrder: 2 },
  { type: 'AIRTIME', providerNetworkId: 3, name: 'GLO',     sortOrder: 3 },
  { type: 'AIRTIME', providerNetworkId: 4, name: '9MOBILE', sortOrder: 4 },
  // DATA (same provider IDs)
  { type: 'DATA', providerNetworkId: 1, name: 'MTN',     sortOrder: 1 },
  { type: 'DATA', providerNetworkId: 2, name: 'AIRTEL',  sortOrder: 2 },
  { type: 'DATA', providerNetworkId: 3, name: 'GLO',     sortOrder: 3 },
  { type: 'DATA', providerNetworkId: 4, name: '9MOBILE', sortOrder: 4 },
  // CABLE
  { type: 'CABLE', providerNetworkId: 1, name: 'GOTV',     sortOrder: 1 },
  { type: 'CABLE', providerNetworkId: 2, name: 'DSTV',     sortOrder: 2 },
  { type: 'CABLE', providerNetworkId: 3, name: 'STARTIME', sortOrder: 3 },
  // ELECTRICITY discos
  { type: 'ELECTRICITY', providerNetworkId: 1,  name: 'Ikeja',  sortOrder: 1 },
  { type: 'ELECTRICITY', providerNetworkId: 2,  name: 'Eko',    sortOrder: 2 },
  { type: 'ELECTRICITY', providerNetworkId: 3,  name: 'Kano',   sortOrder: 3 },
  { type: 'ELECTRICITY', providerNetworkId: 4,  name: 'PHC',    sortOrder: 4 },
  { type: 'ELECTRICITY', providerNetworkId: 5,  name: 'Jos',    sortOrder: 5 },
  { type: 'ELECTRICITY', providerNetworkId: 6,  name: 'Ibadan', sortOrder: 6 },
  { type: 'ELECTRICITY', providerNetworkId: 7,  name: 'Kaduna', sortOrder: 7 },
  { type: 'ELECTRICITY', providerNetworkId: 8,  name: 'Abuja',  sortOrder: 8 },
  { type: 'ELECTRICITY', providerNetworkId: 9,  name: 'Benin',  sortOrder: 9 },
  { type: 'ELECTRICITY', providerNetworkId: 10, name: 'Enugu',  sortOrder: 10 },
  { type: 'ELECTRICITY', providerNetworkId: 11, name: 'Yola',   sortOrder: 11 },
];

const airtimePlans = [
  { type: 'AIRTIME', providerNetworkId: 1, networkName: 'MTN',     name: 'MTN Airtime',     costPrice: 0, sellingPrice: 0, sortOrder: 1 },
  { type: 'AIRTIME', providerNetworkId: 2, networkName: 'AIRTEL',  name: 'AIRTEL Airtime',  costPrice: 0, sellingPrice: 0, sortOrder: 2 },
  { type: 'AIRTIME', providerNetworkId: 3, networkName: 'GLO',     name: 'GLO Airtime',     costPrice: 0, sellingPrice: 0, sortOrder: 3 },
  { type: 'AIRTIME', providerNetworkId: 4, networkName: '9MOBILE', name: '9MOBILE Airtime', costPrice: 0, sellingPrice: 0, sortOrder: 4 },
];

const electricityPlans = [
  { type: 'ELECTRICITY', providerNetworkId: 1,  networkName: 'IKEDC', name: 'Ikeja Electric',         costPrice: 0, sellingPrice: 0, sortOrder: 130 },
  { type: 'ELECTRICITY', providerNetworkId: 2,  networkName: 'EKEDC', name: 'Eko Electric',           costPrice: 0, sellingPrice: 0, sortOrder: 131 },
  { type: 'ELECTRICITY', providerNetworkId: 3,  networkName: 'KEDCO', name: 'Kano Electric',          costPrice: 0, sellingPrice: 0, sortOrder: 132 },
  { type: 'ELECTRICITY', providerNetworkId: 4,  networkName: 'PHED',  name: 'Port Harcourt Electric', costPrice: 0, sellingPrice: 0, sortOrder: 133 },
  { type: 'ELECTRICITY', providerNetworkId: 5,  networkName: 'JED',   name: 'Jos Electric',           costPrice: 0, sellingPrice: 0, sortOrder: 134 },
  { type: 'ELECTRICITY', providerNetworkId: 6,  networkName: 'IBEDC', name: 'Ibadan Electric',        costPrice: 0, sellingPrice: 0, sortOrder: 135 },
  { type: 'ELECTRICITY', providerNetworkId: 7,  networkName: 'KAEDC', name: 'Kaduna Electric',        costPrice: 0, sellingPrice: 0, sortOrder: 136 },
  { type: 'ELECTRICITY', providerNetworkId: 8,  networkName: 'AEDC',  name: 'Abuja Electric',         costPrice: 0, sellingPrice: 0, sortOrder: 137 },
  { type: 'ELECTRICITY', providerNetworkId: 9,  networkName: 'BEDC',  name: 'Benin Electric',         costPrice: 0, sellingPrice: 0, sortOrder: 138 },
  { type: 'ELECTRICITY', providerNetworkId: 10, networkName: 'EEDC',  name: 'Enugu Electric',         costPrice: 0, sellingPrice: 0, sortOrder: 139 },
  { type: 'ELECTRICITY', providerNetworkId: 11, networkName: 'YEDC',  name: 'Yola Electric',          costPrice: 0, sellingPrice: 0, sortOrder: 140 },
];

const main = async () => {
  await prisma.vtuNetwork.deleteMany({});
  for (const n of networks) {
    await prisma.vtuNetwork.create({ data: { ...n, isActive: true } });
  }
  console.log(`✅ VTU networks seeded (${networks.length})`);

  const plans = [...airtimePlans, ...dataPlans, ...cablePlans, ...electricityPlans];
  await prisma.vtuPlan.deleteMany({});
  await prisma.vtuPlan.createMany({ data: plans });
  console.log(
    `✅ VTU plans seeded (${plans.length}: ${airtimePlans.length} airtime, ` +
      `${dataPlans.length} data, ${cablePlans.length} cable, ${electricityPlans.length} electricity)`,
  );
};

main()
  .catch((err) => {
    console.error('VTU catalogue seed failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

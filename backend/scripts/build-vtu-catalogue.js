/**
 * build-vtu-catalogue.js
 *
 * Parses the BilalSadaSub price list (pricing_tables.md at the repo root) into
 * a structured catalogue JSON that the DB seed + the standalone re-seed script
 * consume. Run this whenever BilalSada updates their prices:
 *
 *     node backend/scripts/build-vtu-catalogue.js
 *
 * Output: backend/prisma/data/bilalsada-plans.json  ({ data: [...], cable: [...] })
 *
 * Selling price = cost price + ~5% markup, rounded UP to the nearest ₦10
 * (matches the pricing pattern in the previous AlRahuz seed). Tune MARKUP here.
 */

const fs = require('node:fs');
const path = require('node:path');

const MARKUP = 1.05;
const ROUND_TO = 10;

const SRC = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(__dirname, '../../pricing_tables.md');
const OUT = path.resolve(__dirname, '../prisma/data/bilalsada-plans.json');

// BilalSadaSub provider IDs (from pricing_tables.md "Network Plan" / "Cable ID").
const NETWORK_ID = { MTN: 1, AIRTEL: 2, GLO: 3, '9MOBILE': 4 };
const CABLE_ID = { GOTV: 1, DSTV: 2, STARTIME: 3 };

const sell = (cost) => Math.ceil((cost * MARKUP) / ROUND_TO) * ROUND_TO;
const toAmount = (raw) => Number(String(raw).replace(/[₦,\s]/g, ''));

// Split a markdown table row "| a | b | c |" into trimmed cells.
const cells = (line) =>
  line.split('|').slice(1, -1).map((c) => c.trim());

const isSeparator = (line) => /^\|[\s:|-]+\|$/.test(line.trim());

const build = () => {
  const md = fs.readFileSync(SRC, 'utf8');
  const lines = md.split(/\r?\n/);

  let section = null; // 'data' | 'cable' | null
  const data = [];
  const cable = [];
  const skipped = [];

  let dataSort = 10;
  let cableSort = 1000;

  for (const line of lines) {
    const heading = line.match(/^##\s+(.*)$/);
    if (heading) {
      const title = heading[1].toLowerCase();
      if (title.startsWith('data plans')) section = 'data';
      else if (title.startsWith('cable plans')) section = 'cable';
      else section = null; // any other "## ..." table (Network Plan, Cable ID, etc.)
      continue;
    }
    if (!section) continue;
    if (!line.trim().startsWith('|')) continue;
    if (isSeparator(line)) continue;

    const cols = cells(line);

    if (section === 'data') {
      // | Plan ID | Network | Plan Type | Plan Name | Amount | Validate |
      const [planId, network, planType, planName, amount, validity] = cols;
      if (!/^\d+$/.test(planId)) continue; // header row ("Plan ID")
      const networkName = network.toUpperCase();
      const networkId = NETWORK_ID[networkName];
      const cost = toAmount(amount);
      if (!networkId || !Number.isFinite(cost) || cost <= 0) {
        skipped.push({ section, line: line.trim() });
        continue;
      }
      data.push({
        type: 'DATA',
        providerNetworkId: networkId,
        networkName,
        providerPlanId: Number(planId),
        name: `${networkName} ${planName} (${planType}) - ${validity}`.trim(),
        dataSize: planName,
        validity,
        planType,
        costPrice: cost,
        sellingPrice: sell(cost),
        sortOrder: dataSort++,
      });
    } else if (section === 'cable') {
      // | Plan ID | Cable | Plan Name | Amount |
      const [planId, cableRaw, planName, amount] = cols;
      if (!/^\d+$/.test(planId)) continue;
      const cableName = cableRaw.toUpperCase();
      const cableId = CABLE_ID[cableName];
      const cost = toAmount(amount);
      if (!cableId || !Number.isFinite(cost) || cost <= 0) {
        skipped.push({ section, line: line.trim() });
        continue;
      }
      cable.push({
        type: 'CABLE',
        providerNetworkId: cableId,
        networkName: cableName,
        providerPlanId: Number(planId),
        name: planName,
        validity: null,
        planType: null,
        costPrice: cost,
        sellingPrice: sell(cost),
        sortOrder: cableSort++,
      });
    }
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ data, cable }, null, 2) + '\n');

  console.log(`Parsed ${data.length} data plans, ${cable.length} cable plans.`);
  if (skipped.length) {
    console.log(`Skipped ${skipped.length} unparseable/zero-amount rows:`);
    for (const s of skipped) console.log(`  [${s.section}] ${s.line}`);
  }
  console.log(`Wrote ${path.relative(process.cwd(), OUT)}`);
};

build();

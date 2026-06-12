/**
 * clear-stale-bank-codes.js
 *
 * After the KatPay -> Paystack migration, bank codes saved in the KatPay era can
 * be invalid on Paystack. Traditional banks share the CBN/NIP code across both
 * providers (fine), but FINTECH wallets (OPay, PalmPay, Moniepoint, Kuda...) had
 * provider-specific codes, so a saved beneficiary or merchant payout account
 * pointing at a fintech carries a code Paystack does not recognize.
 *
 * The transfer paths already GUARD against this at runtime (a stale code is
 * rejected before any debit). This script proactively clears the stale codes so
 * users/merchants are prompted to re-pick from the new Paystack list instead of
 * hitting an error mid-transfer. It clears ONLY the bank fields (codes/numbers
 * the user can re-enter); it never touches balances or deletes accounts.
 *
 * Usage (from backend/):
 *   node scripts/clear-stale-bank-codes.js            # report only (dry run)
 *   node scripts/clear-stale-bank-codes.js --apply    # clear stale codes
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { prisma } = require('../src/config/database');
const paystackService = require('../src/services/paystack.service');

const APPLY = process.argv.includes('--apply');

async function main() {
  const banks = await paystackService.getBankList();
  const valid = new Set(banks.map((b) => String(b.code)));
  console.log(`Paystack bank list loaded: ${valid.size} codes.${APPLY ? '' : ' (DRY RUN - pass --apply to change data)'}`);

  // --- Saved beneficiaries ---
  const beneficiaries = await prisma.savedBeneficiary.findMany({
    where: { bankCode: { not: null } },
    select: { id: true, name: true, bankCode: true, accountNumber: true },
  });
  const staleBenes = beneficiaries.filter((b) => !valid.has(String(b.bankCode)));
  console.log(`\nSaved beneficiaries: ${beneficiaries.length} with a bank code, ${staleBenes.length} stale.`);
  for (const b of staleBenes) {
    console.log(`  ${APPLY ? 'CLEAR' : 'would clear'} beneficiary ${b.id} (${b.name || b.accountNumber}) - code ${b.bankCode}`);
    if (APPLY) {
      // Null the bank fields so the user re-picks; keep the row + display name.
      await prisma.savedBeneficiary.update({
        where: { id: b.id },
        data: { bankCode: null, accountName: null },
      });
    }
  }

  // --- Merchant payout accounts ---
  const merchantWallets = await prisma.merchantWallet.findMany({
    where: { bankCode: { not: null } },
    select: { id: true, merchantId: true, bankCode: true, accountNumber: true },
  });
  const staleMerchants = merchantWallets.filter((m) => !valid.has(String(m.bankCode)));
  console.log(`\nMerchant payout accounts: ${merchantWallets.length} with a bank code, ${staleMerchants.length} stale.`);
  for (const m of staleMerchants) {
    console.log(`  ${APPLY ? 'CLEAR' : 'would clear'} merchant ${m.merchantId} payout bank - code ${m.bankCode}`);
    if (APPLY) {
      await prisma.merchantWallet.update({
        where: { id: m.id },
        data: { bankCode: null, accountNumber: null, accountName: null },
      });
    }
  }

  console.log(`\nDone. ${APPLY ? 'Cleared' : 'Would clear'} ${staleBenes.length} beneficiary + ${staleMerchants.length} merchant bank record(s).`);
  if (!APPLY && (staleBenes.length || staleMerchants.length)) {
    console.log('Re-run with --apply to make these changes.');
  }
}

main()
  .catch((e) => {
    console.error('clear-stale-bank-codes aborted:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

/**
 * Paystack adapter smoke check - READ-ONLY, moves NO money.
 *
 * Confirms the live credentials work and the adapter's pure helpers behave,
 * without creating customers, DVAs, recipients, transfers or checkout sessions.
 *
 * Usage (from backend/):
 *   node scripts/paystack-smoke.js
 *   node scripts/paystack-smoke.js --account=0123456789 --bankCode=100004
 *   node scripts/paystack-smoke.js --verify=TOPUP-xxxx
 *   node scripts/paystack-smoke.js --verify-transfer=wit-xxxx
 *
 * Exits non-zero on any failure so it can gate a manual go-live step.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const paystack = require('../src/services/paystack.service');

const parseArgs = () => {
  const args = process.argv.slice(2);
  const val = (prefix) => {
    const hit = args.find((a) => a.startsWith(prefix));
    return hit ? hit.slice(prefix.length) : null;
  };
  return {
    account: val('--account='),
    bankCode: val('--bankCode='),
    verify: val('--verify='),
    verifyTransfer: val('--verify-transfer='),
  };
};

const main = async () => {
  const { account, bankCode, verify, verifyTransfer } = parseArgs();
  const checks = [];
  const run = async (name, fn) => {
    try {
      const detail = await fn();
      console.log(`  ok   ${name}${detail ? ` - ${detail}` : ''}`);
      checks.push(true);
    } catch (err) {
      console.error(`  FAIL ${name} - ${err.message}`);
      checks.push(false);
    }
  };

  console.log('Paystack adapter smoke check (read-only)');
  console.log(`  base: ${process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co'}`);
  console.log(`  callback: ${process.env.PAYSTACK_CALLBACK_URL || 'https://api./webhooks/paystack'}`);

  if (!paystack.isConfigured()) {
    console.error('\nFAIL: PAYSTACK_SECRET_KEY is not set - nothing to check.');
    process.exit(1);
  }

  await run('config present', () => 'secret key set');

  await run('money helpers (kobo round-trip)', () => {
    if (paystack.toKobo(100) !== 10000) throw new Error('toKobo(100) != 10000');
    if (paystack.toKobo(100.55) !== 10055) throw new Error('toKobo(100.55) != 10055');
    if (paystack.toKobo(0.01) !== 1) throw new Error('toKobo(0.01) != 1');
    if (paystack.fromKobo(10000) !== 100) throw new Error('fromKobo(10000) != 100');
    return 'toKobo/fromKobo ok';
  });

  await run('transfer reference formatter', () => {
    const ref = paystack.toTransferReference('WIT-3f9a1c2b-4d5e-6f70-8a9b-0c1d2e3f4a5b');
    if (!/^[a-z0-9\-_.]{16,50}$/.test(ref)) throw new Error(`invalid transfer ref: ${ref}`);
    if (ref !== 'wit-3f9a1c2b-4d5e-6f70-8a9b-0c1d2e3f4a5b') throw new Error(`unexpected ref: ${ref}`);
    return ref;
  });

  await run('webhook signature self-test', () => {
    const crypto = require('crypto');
    const body = JSON.stringify({ event: 'charge.success', data: { reference: 'test' } });
    const sig = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(body).digest('hex');
    if (!paystack.verifyWebhookSignature(body, sig)) throw new Error('valid signature rejected');
    if (paystack.verifyWebhookSignature(body, 'deadbeef')) throw new Error('invalid signature accepted');
    return 'HMAC-SHA512 ok';
  });

  await run('bank list', async () => {
    const banks = await paystack.getBankList();
    if (!Array.isArray(banks) || banks.length === 0) throw new Error('empty bank list');
    return `${banks.length} banks`;
  });

  await run('KatPay→Paystack code mapping (OPay override)', async () => {
    const code = await paystack.paystackCodeForKatpayBank('100004');
    if (code !== '999992') throw new Error(`expected 999992, got ${code}`);
    return '100004 -> 999992';
  });

  if (account && bankCode) {
    await run(`resolve account ${account} (bankCode ${bankCode})`, async () => {
      const r = await paystack.resolveAccountName({ accountNumber: account, bankCode });
      return r.accountName;
    });
  }

  if (verify) {
    await run(`verify checkout ${verify}`, async () => {
      const r = await paystack.verifyTransaction(verify);
      return `status=${r.status} amount=${r.amount} channel=${r.channel}`;
    });
  }

  if (verifyTransfer) {
    await run(`verify transfer ${verifyTransfer}`, async () => {
      const r = await paystack.verifyTransfer(verifyTransfer);
      return `status=${r.status} reason=${r.reason}`;
    });
  }

  const failed = checks.filter((c) => !c).length;
  console.log(`\n${failed === 0 ? 'PASS' : `FAIL (${failed})`} - ${checks.length} checks`);
  process.exit(failed === 0 ? 0 : 1);
};

main().catch((err) => {
  console.error('smoke check crashed:', err.message);
  process.exit(1);
});
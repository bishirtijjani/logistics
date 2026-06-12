/**
 * Paystack service - used ONLY for bank-account name verification (name enquiry).
 *
 * KatPay has no account-resolution endpoint, so we resolve the account holder
 * name against Paystack's free `/bank/resolve` and treat the result as advisory.
 * Payouts still go through KatPay; Paystack never moves money here.
 *
 * Code mismatch note: the dashboards' bank picker is populated from KatPay's
 * bank list, so callers pass a KATPAY bank code. Paystack uses its own codes for
 * fintechs (e.g. OPay = 999992 on Paystack vs 100004 on KatPay), so we map
 * KatPay code → Paystack code by exact-code match (true for NIP-coded banks),
 * an override table (fintechs), then a normalized name match.
 */
const axios = require('axios');
const { config } = require('../config');
const { logger } = require('../utils/logger');
const { AppError } = require('../utils/api-error');
const katpayService = require('./katpay.service');

const BASE = () => config.PAYSTACK_BASE_URL || 'https://api.paystack.co';
const authHeaders = () => ({ Authorization: `Bearer ${config.PAYSTACK_SECRET_KEY}` });
const isConfigured = () => Boolean(config.PAYSTACK_SECRET_KEY);

// Paystack bank list cache (1h).
let bankCache = null;
let bankCachedAt = 0;
const BANK_TTL = 60 * 60 * 1000;

// KatPay → Paystack code overrides for banks whose codes differ and whose names
// don't reliably match. Extend as more fintech mismatches surface.
const CODE_OVERRIDES = {
  '100004': '999992', // OPay
};

const norm = (s) => (s || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Full Paystack NGN bank list (cursor-paginated, cached 1h).
 */
const getBankList = async () => {
  if (bankCache && Date.now() - bankCachedAt < BANK_TTL) return bankCache;

  const all = [];
  let next = null;
  for (let page = 0; page < 10; page += 1) {
    const url = `${BASE()}/bank?currency=NGN&perPage=100${next ? `&next=${encodeURIComponent(next)}` : ''}`;
    const res = await axios.get(url, { headers: authHeaders(), timeout: 20000 });
    const data = res.data?.data || [];
    all.push(...data);
    next = res.data?.meta?.next;
    if (!next) break;
  }

  bankCache = all;
  bankCachedAt = Date.now();
  return all;
};

/**
 * Resolve the Paystack bank code for a bank the caller picked from KatPay's list.
 * Returns null if no confident match exists.
 */
const paystackCodeForKatpayBank = async (katpayCode) => {
  const code = String(katpayCode);
  if (CODE_OVERRIDES[code]) return CODE_OVERRIDES[code];

  const psBanks = await getBankList();

  // Traditional banks share the NIP code across providers.
  if (psBanks.find((b) => String(b.code) === code)) return code;

  // Otherwise match by name, using KatPay's name for this code.
  let katName = null;
  try {
    const katRaw = await katpayService.getBankList();
    const katArr = Array.isArray(katRaw) ? katRaw : katRaw?.banks || katRaw?.items || [];
    katName = katArr.find((b) => String(b.bankCode || b.code) === code)?.bankName;
  } catch (err) {
    logger.warn('KatPay bank list unavailable for code mapping', { error: err.message });
  }

  if (katName) {
    const n = norm(katName);
    const hit = psBanks.find((b) => {
      const bn = norm(b.name);
      return bn === n || bn.includes(n) || n.includes(bn);
    });
    if (hit) return String(hit.code);
  }
  return null;
};

/**
 * Resolve the account holder name. `bankCode` is the KATPAY code the dashboards
 * use. Throws AppError.badRequest on any failure so callers return a clean 4xx
 * (never a 500) and can fall back to a typed name.
 */
const resolveAccountName = async ({ accountNumber, bankCode }) => {
  if (!isConfigured()) {
    throw AppError.badRequest('Account verification is not available right now');
  }

  const psCode = await paystackCodeForKatpayBank(bankCode);
  if (!psCode) {
    throw AppError.badRequest('This bank is not supported for verification');
  }

  try {
    const res = await axios.get(
      `${BASE()}/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(psCode)}`,
      { headers: authHeaders(), timeout: 20000 },
    );
    const accountName = res.data?.data?.account_name;
    if (!accountName) throw AppError.badRequest('Could not verify this account');
    return { accountName, accountNumber, bankCode };
  } catch (err) {
    if (err instanceof AppError) throw err;
    const message = err.response?.data?.message;
    logger.warn('Paystack resolve failed', {
      bankCode, psCode, status: err.response?.status, message,
    });
    throw AppError.badRequest(message || 'Could not verify this account. Check the bank and account number.');
  }
};

module.exports = {
  isConfigured,
  getBankList,
  paystackCodeForKatpayBank,
  resolveAccountName,
};

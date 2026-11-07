/**
 * Virtual-account (funding NUBAN) provisioning - dual provider.
 *
 * EVERY wallet is minted BOTH a KatPay NUBAN and a Paystack Dedicated Virtual
 * Account. Both numbers stay valid for the life of the wallet: the app displays
 * whichever provider is active (`payments.providerMode`), while a transfer into
 * the other (older) number a user saved in their bank app is still credited
 * (fundWallet resolves the wallet by any of its account numbers).
 *
 * Each provider is provisioned independently and idempotently (short-circuits
 * when that provider's account already exists), and best-effort: a failure on
 * one provider never blocks the other. Callers get the ACTIVE provider's account
 * back, falling back to the other if the active one isn't available yet.
 *
 * Paystack requires the customer's BVN when the business category demands
 * identity validation. Logistics Platform stores only a bcrypt hash of the BVN, so no
 * plaintext is available; DVA creation relies on the Paystack account being
 * permitted to create DVAs without per-customer BVN (Logistics category - no
 * validation required). If that changes, assignment fails and the retry path
 * keeps the wallet activate-able.
 */
const { prisma } = require('../../config/database');
const { logger } = require('../../utils/logger');
const { AppError } = require('../../utils/api-error');
const paymentsRouter = require('./router');
const katpayService = require('../katpay.service');
const paystackService = require('../paystack.service');

const splitName = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  const firstName = parts.shift() || '';
  const lastName = parts.join(' ');
  return { firstName, lastName };
};

/**
 * Update a wallet's account fields, tolerating a negative balance. A wallet can
 * hold a small negative balance (cash-commission advance) that the
 * wallet_balance_nonneg check only permits while app.allow_negative_wallet='on'.
 * These updates never touch the balance, so relaxing the check for the write is
 * safe - without it, provisioning would fail for such a wallet.
 */
const updateWalletAccounts = async (userId, data) => {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL app.allow_negative_wallet = 'on'`;
    await tx.wallet.update({ where: { userId }, data });
  });
};

/**
 * The account the user should see for the given mode, falling back to the other
 * provider (then to the legacy mirror) when the active provider's is missing.
 */
const activeAccountFor = (wallet, mode) => {
  const paystack = wallet.paystackAccountNumber
    ? { accountNumber: wallet.paystackAccountNumber, bankName: wallet.paystackAccountBank, accountName: wallet.paystackAccountName, provider: 'PAYSTACK' }
    : null;
  const katpay = wallet.katpayAccountNumber
    ? { accountNumber: wallet.katpayAccountNumber, bankName: wallet.katpayAccountBank, accountName: wallet.katpayAccountName, provider: 'KATPAY' }
    : null;

  const preferred = mode === paymentsRouter.MODES.KATPAY ? [katpay, paystack] : [paystack, katpay];
  const picked = preferred.find(Boolean);
  if (picked) return picked;

  // Last resort: the legacy mirror (a number minted before the split).
  if (wallet.virtualAccountNumber) {
    return {
      accountNumber: wallet.virtualAccountNumber,
      bankName: wallet.virtualAccountBank,
      accountName: wallet.virtualAccountName,
      provider: wallet.paystackCustomerCode ? 'PAYSTACK' : 'KATPAY',
    };
  }
  return null;
};

/** Mirror the active account into the legacy virtualAccount* fields. */
const syncDisplayMirror = async (userId, wallet, mode) => {
  const active = activeAccountFor(wallet, mode);
  if (!active) return;
  if (wallet.virtualAccountNumber === active.accountNumber) return;
  await updateWalletAccounts(userId, {
    virtualAccountNumber: active.accountNumber,
    virtualAccountBank: active.bankName,
    virtualAccountName: active.accountName,
  });
};

/** Mint the Paystack DVA if the wallet doesn't already have one. Idempotent. */
const provisionPaystackAccount = async ({ userId, email, name, phoneNumber }) => {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) throw AppError.notFound('Wallet not found');
  if (wallet.paystackAccountNumber) {
    return { accountNumber: wallet.paystackAccountNumber, bankName: wallet.paystackAccountBank, accountName: wallet.paystackAccountName, provider: 'PAYSTACK', alreadyProvisioned: true };
  }

  const { firstName, lastName } = splitName(name);
  const customer = await paystackService.createCustomer({ email, firstName, lastName, phone: phoneNumber });
  const dva = await paystackService.assignDva({
    customerCode: customer.customerCode,
    firstName,
    lastName,
    phone: phoneNumber,
    preferredBank: 'wema-bank', // Wema only - Paystack-Titan is never used
  });

  await updateWalletAccounts(userId, {
    paystackAccountNumber: dva.accountNumber,
    paystackAccountBank: dva.bankName,
    paystackAccountName: dva.accountName,
    paystackCustomerCode: dva.customerCode || customer.customerCode,
    dedicatedAccountId: dva.dedicatedAccountId,
  });

  logger.info('Paystack DVA provisioned', {
    userId, accountNumber: dva.accountNumber, dedicatedAccountId: dva.dedicatedAccountId,
  });
  return { accountNumber: dva.accountNumber, bankName: dva.bankName, accountName: dva.accountName, provider: 'PAYSTACK' };
};

/** Mint the KatPay NUBAN if the wallet doesn't already have one. Idempotent. */
const provisionKatpayAccount = async ({ userId, email, name, phoneNumber }) => {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) throw AppError.notFound('Wallet not found');
  if (wallet.katpayAccountNumber) {
    return { accountNumber: wallet.katpayAccountNumber, bankName: wallet.katpayAccountBank, accountName: wallet.katpayAccountName, provider: 'KATPAY', alreadyProvisioned: true };
  }

  const va = await katpayService.createVirtualAccount({
    email,
    name,
    phoneNumber: phoneNumber || '',
    bankCodes: ['PALMPAY', 'OPAY'],
  });

  await updateWalletAccounts(userId, {
    katpayAccountNumber: va.accountNumber,
    katpayAccountBank: va.bankName,
    katpayAccountName: va.accountName,
  });

  logger.info('KatPay virtual account provisioned', { userId, accountNumber: va.accountNumber });
  return { accountNumber: va.accountNumber, bankName: va.bankName, accountName: va.accountName, provider: 'KATPAY' };
};

/**
 * Ensure the wallet has BOTH provider accounts, then return the active
 * provider's account for the caller (signup/KYC welcome copy, retry worker).
 *
 * @returns {Promise<{accountNumber, bankName, accountName, provider, alreadyProvisioned?, errors?}>}
 */
const provisionVirtualAccount = async ({ userId, email, name, phoneNumber }) => {
  const mode = await paymentsRouter.getMode();
  const errors = [];

  // Best-effort both ways - one provider being down must not block the other.
  for (const fn of [provisionPaystackAccount, provisionKatpayAccount]) {
    try {
      await fn({ userId, email, name, phoneNumber });
    } catch (err) {
      errors.push(err);
      logger.warn('Provider account provisioning failed (will retry)', { userId, error: err.message });
    }
  }

  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) throw AppError.notFound('Wallet not found');

  const active = activeAccountFor(wallet, mode);
  if (!active) {
    // Neither provider produced (or already had) an account.
    throw errors[0] || AppError.internal('Failed to provision wallet account');
  }

  await syncDisplayMirror(userId, wallet, mode);

  return {
    ...active,
    alreadyProvisioned: Boolean(wallet.paystackAccountNumber && wallet.katpayAccountNumber),
    ...(errors.length ? { errors: errors.map((e) => e.message) } : {}),
  };
};

module.exports = {
  provisionVirtualAccount,
  provisionPaystackAccount,
  provisionKatpayAccount,
  activeAccountFor,
  splitName,
};

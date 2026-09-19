/**
 * Virtual-account (funding NUBAN) provisioning - gateway-aware.
 *
 * Both signup/KYC (auth.service) and the PROVISION_VIRTUAL_ACCOUNT retry worker
 * call this one function, so whichever provider is active mints the wallet's
 * NUBAN consistently and the wallet row is updated in one place.
 *
 * Policy (see the gateway switch plan): existing wallets that already hold a
 * NUBAN keep it - a provider flip never force-migrates users (their displayed
 * NUBAN stays valid; the matching provider's webhook keeps settling it). Only
 * wallets without a NUBAN are provisioned, under the ACTIVE gateway.
 *
 * Provisioning Paystack requires the customer's BVN when the business category
 * demands identity validation. iPrime stores only a bcrypt hash of the BVN, so
 * no plaintext is available here - DVA assignment therefore relies on the
 * Paystack account being permitted to create DVAs without per-customer BVN. If
 * the account requires it, assignment fails and the normal retry path keeps the
 * wallet activate-able until Paystack is configured appropriately.
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
 * Provision the funding NUBAN for a wallet under the active gateway. Idempotent:
 * returns the existing account when one is already set.
 *
 * @returns {Promise<{accountNumber, bankName, accountName, provider, alreadyProvisioned?}>}
 */
const provisionVirtualAccount = async ({ userId, email, name, phoneNumber }) => {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) throw AppError.notFound('Wallet not found');
  if (wallet.virtualAccountNumber) {
    return {
      accountNumber: wallet.virtualAccountNumber,
      bankName: wallet.virtualAccountBank,
      accountName: wallet.virtualAccountName,
      provider: wallet.paystackCustomerCode ? 'PAYSTACK' : 'KATPAY',
      alreadyProvisioned: true,
    };
  }

  const { provider } = await paymentsRouter.resolveGateway();

  if (provider === paymentsRouter.MODES.PAYSTACK) {
    const { firstName, lastName } = splitName(name);
    const customer = await paystackService.createCustomer({ email, firstName, lastName, phone: phoneNumber });
    const dva = await paystackService.assignDva({
      customerCode: customer.customerCode,
      firstName,
      lastName,
      phone: phoneNumber,
      // The platform provisions DVAs on Wema Bank ONLY - Paystack-Titan is never
      // used (payment rails and user-facing copy assume Wema).
      preferredBank: 'wema-bank',
    });

    await prisma.wallet.update({
      where: { userId },
      data: {
        virtualAccountNumber: dva.accountNumber,
        virtualAccountBank: dva.bankName,
        virtualAccountName: dva.accountName,
        paystackCustomerCode: dva.customerCode || customer.customerCode,
        dedicatedAccountId: dva.dedicatedAccountId,
      },
    });

    logger.info('Paystack DVA provisioned', {
      userId, accountNumber: dva.accountNumber, dedicatedAccountId: dva.dedicatedAccountId,
    });
    return {
      accountNumber: dva.accountNumber,
      bankName: dva.bankName,
      accountName: dva.accountName,
      provider: 'PAYSTACK',
    };
  }

  const va = await katpayService.createVirtualAccount({
    email,
    name,
    phoneNumber: phoneNumber || '',
    bankCodes: ['PALMPAY', 'OPAY'],
  });

  await prisma.wallet.update({
    where: { userId },
    data: {
      virtualAccountNumber: va.accountNumber,
      virtualAccountBank: va.bankName,
      virtualAccountName: va.accountName,
    },
  });

  logger.info('KatPay virtual account provisioned', { userId, accountNumber: va.accountNumber });
  return {
    accountNumber: va.accountNumber,
    bankName: va.bankName,
    accountName: va.accountName,
    provider: 'KATPAY',
  };
};

module.exports = { provisionVirtualAccount, splitName };
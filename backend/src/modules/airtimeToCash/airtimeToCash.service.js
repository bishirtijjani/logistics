/**
 * Airtime-to-cash module service.
 *
 * Customer sells airtime → wallet credit.
 * Provider: airtimetocash.com Automation API (see services/airtimeToCash.service.js).
 *
 * Flow (3 customer-facing endpoints):
 *   1. initiate  → validate amount, generate OTP via provider, persist AWAITING_OTP row
 *   2. verify    → verify OTP, capture sessionId + airtime balance, gate on quota
 *                  availability, return payout preview, advance to OTP_VERIFIED
 *   3. submit    → call provider transferAirtime; on success credit wallet and
 *                  mark COMPLETED. On provider pending (code 4000) mark
 *                  NEEDS_RECONCILIATION (no query API — admin resolves manually).
 *
 * Economics:
 *   - Provider pays us ~80% baseline (per airtimetocash.com consumer page).
 *   - Our payout rate to the customer is admin-configurable via the
 *     `airtimeToCash.payoutRate` platform setting (defaults to 0.75).
 *   - The spread (≈5pp by default) is our platform margin.
 */

const { randomUUID } = require('crypto');
const { prisma } = require('../../config/database');
const { AppError } = require('../../utils/api-error');
const { logger } = require('../../utils/logger');
const provider = require('../../services/airtimeToCash.service');
const settingsService = require('../../services/settings.service');

const DEFAULT_PAYOUT_RATE = 0.75;

/** Prisma enum value → provider's case-sensitive code. */
const networkToProviderCode = (network) =>
  network === 'NINEMOBILE' ? '9MOBILE' : network;

const generateReference = () => `A2C_${randomUUID().replace(/-/g, '')}`;

const getPayoutRate = async () => {
  const raw = await settingsService.getSetting('airtimeToCash.payoutRate', null);
  if (raw == null) return DEFAULT_PAYOUT_RATE;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 1) {
    logger.warn('Invalid airtimeToCash.payoutRate setting, using default', { raw });
    return DEFAULT_PAYOUT_RATE;
  }
  return n;
};

const computePayout = (airtimeAmount, payoutRate) =>
  Math.floor(Number(airtimeAmount) * payoutRate); // Whole-naira credit; round down so we never overpay.

// ── 1. Initiate ──────────────────────────────────────────────────────────────

const initiate = async (userId, { network, senderPhone, amount }) => {
  const providerNetwork = networkToProviderCode(network);
  const validationError = provider.validateAmount(providerNetwork, amount);
  if (validationError) throw AppError.badRequest(validationError);

  const payoutRate = await getPayoutRate();
  const payoutAmount = computePayout(amount, payoutRate);

  const reference = generateReference();
  const tx = await prisma.airtimeToCashTransaction.create({
    data: {
      userId,
      network,
      senderPhone,
      airtimeAmount: amount,
      payoutAmount,
      payoutRate,
      reference,
      status: 'AWAITING_OTP',
    },
  });

  try {
    const otpResponse = await provider.generateOtp({
      network: providerNetwork,
      sender: senderPhone,
    });
    if (!provider.isSuccess(otpResponse)) {
      await prisma.airtimeToCashTransaction.update({
        where: { id: tx.id },
        data: {
          status: 'FAILED',
          providerCode: otpResponse?.code ?? null,
          providerMessage: otpResponse?.message ?? 'OTP request rejected',
          resolvedAt: new Date(),
        },
      });
      throw AppError.badRequest(otpResponse?.message || 'Could not send OTP', {
        code: 'A2C_OTP_FAILED',
      });
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    await prisma.airtimeToCashTransaction.update({
      where: { id: tx.id },
      data: {
        status: 'FAILED',
        providerMessage: err.message,
        resolvedAt: new Date(),
      },
    });
    logger.error('A2C initiate provider error', { txId: tx.id, error: err.message });
    throw AppError.serviceUnavailable('Airtime-to-cash provider unavailable', {
      code: 'A2C_PROVIDER_UNAVAILABLE',
    });
  }

  return {
    transactionId: tx.id,
    network,
    senderPhone,
    airtimeAmount: amount,
    payoutPreview: payoutAmount,
    payoutRate,
  };
};

// ── 2. Verify OTP + quota gate ───────────────────────────────────────────────

const verify = async (userId, { transactionId, otp }) => {
  const tx = await prisma.airtimeToCashTransaction.findFirst({
    where: { id: transactionId, userId },
  });
  if (!tx) throw AppError.notFound('Transaction not found');
  if (tx.status !== 'AWAITING_OTP') {
    throw AppError.badRequest(`Transaction is in ${tx.status} state`, {
      code: 'A2C_BAD_STATE',
    });
  }

  const providerNetwork = networkToProviderCode(tx.network);
  const otpResponse = await provider.verifyOtp({
    network: providerNetwork,
    sender: tx.senderPhone,
    otp,
  });

  if (!provider.isSuccess(otpResponse)) {
    throw AppError.badRequest(otpResponse?.message || 'OTP verification failed', {
      code: 'A2C_OTP_INVALID',
    });
  }

  const sessionId = otpResponse?.data?.sessionId;
  if (!sessionId) {
    throw AppError.serviceUnavailable('Provider returned no session', {
      code: 'A2C_NO_SESSION',
    });
  }

  // Gate on recipient pool availability before we let the user submit. Saves
  // them entering their SIM PIN only to hit "Unavailability of recipient".
  const quota = await provider.checkQuotaAvailability({
    network: providerNetwork,
    amount: Number(tx.airtimeAmount),
  });
  if (provider.isRecipientUnavailable(quota)) {
    throw AppError.serviceUnavailable('No recipient available for this amount — try a smaller amount or another network', {
      code: 'A2C_NO_RECIPIENT',
    });
  }

  await prisma.airtimeToCashTransaction.update({
    where: { id: tx.id },
    data: {
      status: 'OTP_VERIFIED',
      providerSessionId: sessionId,
      verifiedAt: new Date(),
    },
  });

  return {
    transactionId: tx.id,
    airtimeBalance: otpResponse?.data?.airtimeBalance ?? null,
    tariff: otpResponse?.data?.tariff ?? null,
    payoutAmount: Number(tx.payoutAmount),
    payoutRate: Number(tx.payoutRate),
  };
};

// ── 3. Submit transfer + credit wallet ───────────────────────────────────────

const _creditWallet = async (txClient, { tx, providerData }) => {
  const wallet = await txClient.wallet.findUnique({ where: { userId: tx.userId } });
  if (!wallet) throw AppError.notFound('Wallet not found');
  if (wallet.isLocked) throw AppError.forbidden('Wallet is frozen');

  const balanceBefore = Number(wallet.balance);
  const credit = Number(tx.payoutAmount);
  const balanceAfter = balanceBefore + credit;

  await txClient.wallet.update({
    where: { id: wallet.id },
    data: { balance: { increment: credit } },
  });

  await txClient.transaction.create({
    data: {
      reference: tx.reference,
      type: 'AIRTIME_TO_CASH',
      status: 'COMPLETED',
      amount: credit,
      description: `Airtime-to-cash: ${tx.network} ₦${tx.airtimeAmount} from ${tx.senderPhone}`,
      creditWalletId: wallet.id,
      balanceBefore,
      balanceAfter,
    },
  });

  return { walletId: wallet.id, balanceAfter };
};

const submit = async (userId, { transactionId, simPin }) => {
  const tx = await prisma.airtimeToCashTransaction.findFirst({
    where: { id: transactionId, userId },
  });
  if (!tx) throw AppError.notFound('Transaction not found');
  if (tx.status !== 'OTP_VERIFIED') {
    throw AppError.badRequest(`Transaction is in ${tx.status} state`, {
      code: 'A2C_BAD_STATE',
    });
  }
  if (!tx.providerSessionId) {
    throw AppError.badRequest('Session missing — re-verify OTP', {
      code: 'A2C_SESSION_MISSING',
    });
  }

  // Mark PROCESSING before the network call so concurrent submits can't race.
  const claimed = await prisma.airtimeToCashTransaction.updateMany({
    where: { id: tx.id, status: 'OTP_VERIFIED' },
    data: { status: 'PROCESSING', submittedAt: new Date() },
  });
  if (claimed.count === 0) {
    throw AppError.conflict('Transaction already in progress', {
      code: 'A2C_RACE',
    });
  }

  let response;
  try {
    response = await provider.transferAirtime({
      network: networkToProviderCode(tx.network),
      sender: tx.senderPhone,
      amount: Number(tx.airtimeAmount),
      reference: tx.reference,
      pin: simPin,
      sessionId: tx.providerSessionId,
    });
  } catch (err) {
    // Network failure mid-transfer — we DON'T know if the provider actually
    // moved the airtime. Park as NEEDS_RECONCILIATION; admin resolves.
    logger.error('A2C transferAirtime network error', { txId: tx.id, error: err.message });
    await prisma.airtimeToCashTransaction.update({
      where: { id: tx.id },
      data: {
        status: 'NEEDS_RECONCILIATION',
        providerMessage: `Network error: ${err.message}`,
        resolvedAt: new Date(),
      },
    });
    throw AppError.serviceUnavailable(
      'Could not confirm with provider — admin will reconcile within 24h',
      { code: 'A2C_RECONCILE' },
    );
  }

  const code = response?.code;
  const message = response?.message ?? null;
  const automationCharges = response?.data?.automationCharges ?? null;

  if (provider.isSuccess(response)) {
    const result = await prisma.$transaction(async (txc) => {
      const credit = await _creditWallet(txc, { tx, providerData: response.data });
      const updated = await txc.airtimeToCashTransaction.update({
        where: { id: tx.id },
        data: {
          status: 'COMPLETED',
          providerCode: code,
          providerMessage: message,
          automationCharges,
          transactionId: tx.reference,
          resolvedAt: new Date(),
        },
      });
      return { updated, balanceAfter: credit.balanceAfter };
    });

    return {
      transactionId: tx.id,
      status: 'COMPLETED',
      payoutAmount: Number(tx.payoutAmount),
      walletBalanceAfter: result.balanceAfter,
    };
  }

  if (provider.isPending(response)) {
    await prisma.airtimeToCashTransaction.update({
      where: { id: tx.id },
      data: {
        status: 'NEEDS_RECONCILIATION',
        providerCode: code,
        providerMessage: message,
        automationCharges,
        resolvedAt: new Date(),
      },
    });
    return {
      transactionId: tx.id,
      status: 'NEEDS_RECONCILIATION',
      message: 'Processing — usually resolves within 24h',
    };
  }

  // Failure path (3000 / 5030 / etc.)
  await prisma.airtimeToCashTransaction.update({
    where: { id: tx.id },
    data: {
      status: 'FAILED',
      providerCode: code,
      providerMessage: message,
      resolvedAt: new Date(),
    },
  });
  throw AppError.badRequest(message || 'Transfer failed', {
    code: 'A2C_TRANSFER_FAILED',
  });
};

// ── 4. History / detail ──────────────────────────────────────────────────────

const getHistory = async (userId, { status, page, limit }) => {
  const where = { userId, ...(status ? { status } : {}) };
  const [items, total] = await Promise.all([
    prisma.airtimeToCashTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.airtimeToCashTransaction.count({ where }),
  ]);
  return { items, total, page, limit };
};

const getTransaction = async (userId, id) => {
  const tx = await prisma.airtimeToCashTransaction.findFirst({
    where: { id, userId },
  });
  if (!tx) throw AppError.notFound('Transaction not found');
  return tx;
};

// ── Public config (mobile app prefetches this for the conversion screen) ─────

const getConfig = async () => {
  const [payoutRate, quickAmounts] = await Promise.all([
    getPayoutRate(),
    settingsService.getSetting('airtimeToCash.quickAmounts', null),
  ]);
  return {
    payoutRate,
    networks: ['MTN', 'AIRTEL', 'GLO', 'NINEMOBILE'],
    amountLimits: provider.AMOUNT_LIMITS,
    quickAmounts: quickAmounts || [1000, 2000, 5000, 10000],
  };
};

module.exports = {
  initiate,
  verify,
  submit,
  getHistory,
  getTransaction,
  getConfig,
};

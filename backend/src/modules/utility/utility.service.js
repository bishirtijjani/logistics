/**
 * Utility service — airtime, data, and electricity payments.
 *
 * RULES:
 * - Wallet deduction happens BEFORE calling VTPass
 * - If VTPass fails, the transaction is marked FAILED and a refund is queued
 * - All operations are idempotent via reference checks
 */

const { v4: uuidv4 } = require('uuid');
const { prisma } = require('../../config/database');
const { AppError } = require('../../utils/api-error');
const { logger } = require('../../utils/logger');

/**
 * Buy airtime — deduct wallet, call VTPass, record result.
 */
const buyAirtime = async (userId, { phone, amount, provider }) => {
  const reference = `AIR-${uuidv4()}`;

  const result = await prisma.$transaction(async (tx) => {
    // 1. Load wallet
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw AppError.notFound('Wallet not found');
    if (wallet.isLocked) throw AppError.forbidden('Wallet is frozen');

    const balance = Number(wallet.balance);
    if (balance < amount) throw AppError.insufficientBalance();

    // 2. Deduct balance
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: amount } },
    });

    // 3. Create transaction record
    await tx.transaction.create({
      data: {
        reference,
        type: 'UTILITY_PAYMENT',
        status: 'PROCESSING',
        amount,
        description: `${provider} airtime - ${phone}`,
        debitWalletId: wallet.id,
        provider: 'VTPASS',
        balanceBefore: balance,
        balanceAfter: balance - amount,
      },
    });

    // 4. Create utility payment record
    const payment = await tx.utilityPayment.create({
      data: {
        userId,
        type: 'AIRTIME',
        provider,
        amount,
        phoneNumber: phone,
        vtpassRequestId: reference,
        status: 'PROCESSING',
        transactionId: reference,
      },
    });

    return payment;
  });

  // TODO: Queue VTPass API call via BullMQ
  // The worker will call VTPass and update the status to COMPLETED or FAILED

  logger.info('Airtime purchase initiated', { userId, provider, amount, reference });

  return result;
};

/**
 * Buy data bundle.
 */
const buyData = async (userId, { phone, provider, planCode, amount }) => {
  const reference = `DATA-${uuidv4()}`;

  const result = await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw AppError.notFound('Wallet not found');
    if (wallet.isLocked) throw AppError.forbidden('Wallet is frozen');

    const balance = Number(wallet.balance);
    if (balance < amount) throw AppError.insufficientBalance();

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: amount } },
    });

    await tx.transaction.create({
      data: {
        reference,
        type: 'UTILITY_PAYMENT',
        status: 'PROCESSING',
        amount,
        description: `${provider} data - ${phone}`,
        debitWalletId: wallet.id,
        provider: 'VTPASS',
        balanceBefore: balance,
        balanceAfter: balance - amount,
      },
    });

    const payment = await tx.utilityPayment.create({
      data: {
        userId,
        type: 'DATA',
        provider,
        amount,
        phoneNumber: phone,
        plan: planCode,
        vtpassRequestId: reference,
        status: 'PROCESSING',
        transactionId: reference,
      },
    });

    return payment;
  });

  // TODO: Queue VTPass API call

  logger.info('Data purchase initiated', { userId, provider, planCode, reference });

  return result;
};

/**
 * Pay electricity bill.
 */
const payElectricity = async (userId, { meterNumber, disco, meterType, amount }) => {
  const reference = `ELEC-${uuidv4()}`;

  const result = await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw AppError.notFound('Wallet not found');
    if (wallet.isLocked) throw AppError.forbidden('Wallet is frozen');

    const balance = Number(wallet.balance);
    if (balance < amount) throw AppError.insufficientBalance();

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: amount } },
    });

    await tx.transaction.create({
      data: {
        reference,
        type: 'UTILITY_PAYMENT',
        status: 'PROCESSING',
        amount,
        description: `${disco} electricity - ${meterNumber}`,
        debitWalletId: wallet.id,
        provider: 'VTPASS',
        balanceBefore: balance,
        balanceAfter: balance - amount,
      },
    });

    const payment = await tx.utilityPayment.create({
      data: {
        userId,
        type: 'ELECTRICITY',
        provider: disco,
        amount,
        meterNumber,
        plan: meterType,
        vtpassRequestId: reference,
        status: 'PROCESSING',
        transactionId: reference,
      },
    });

    return payment;
  });

  // TODO: Queue VTPass API call

  logger.info('Electricity payment initiated', { userId, disco, meterNumber, reference });

  return result;
};

/**
 * Get bill payment history.
 */
const getBillHistory = async (userId, { page, limit, type }) => {
  const where = {
    userId,
    ...(type && { type }),
  };

  const [payments, total] = await Promise.all([
    prisma.utilityPayment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.utilityPayment.count({ where }),
  ]);

  return { payments, total, page, limit };
};

module.exports = {
  buyAirtime,
  buyData,
  payElectricity,
  getBillHistory,
};

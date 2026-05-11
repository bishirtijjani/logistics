/**
 * Utility service — airtime, data, cable, electricity, education pins via AlRahuz Data API.
 *
 * FLOW: wallet deduction → BullMQ job → worker calls AlRahuz → update status.
 * On AlRahuz failure: mark FAILED, refund via worker.
 */

const { v4: uuidv4 } = require('uuid');
const { prisma } = require('../../config/database');
const { AppError } = require('../../utils/api-error');
const { logger } = require('../../utils/logger');
const alrahuzService = require('../../services/alrahuz.service');
const { addUtilityJob } = require('../../queues');

const deductAndCreate = async (userId, { type, merchant, amount, phoneNumber, meterNumber, plan, reference }) => {
  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw AppError.notFound('Wallet not found');
    if (wallet.isLocked) throw AppError.forbidden('Wallet is frozen');

    const balance = Number(wallet.balance);
    if (balance < amount) throw AppError.insufficientBalance();

    await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { decrement: amount } } });

    await tx.transaction.create({
      data: {
        reference,
        type: 'UTILITY_PAYMENT',
        status: 'PROCESSING',
        amount,
        description: `${merchant} ${type.toLowerCase()} ${phoneNumber || meterNumber || ''}`.trim(),
        debitWalletId: wallet.id,
        merchant: 'ALRAHUZ',
        balanceBefore: balance,
        balanceAfter: balance - amount,
      },
    });

    const payment = await tx.utilityPayment.create({
      data: {
        userId,
        type,
        merchant,
        amount,
        phoneNumber,
        meterNumber,
        plan,
        providerRequestId: reference,
        status: 'PROCESSING',
        transactionId: reference,
      },
    });

    return { payment, walletId: wallet.id };
  });
};

const getPlans = async ({ type, networkId, isActive = true }) => {
  const where = {
    type: type?.toUpperCase(),
    isActive,
    ...(networkId && { providerNetworkId: Number(networkId) }),
  };
  return prisma.vtuPlan.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { sellingPrice: 'asc' }],
  });
};

const buyAirtime = async (userId, { phone, networkId, amount }) => {
  const reference = `AIR-${uuidv4()}`;
  const plan = await prisma.vtuPlan.findFirst({
    where: { type: 'AIRTIME', providerNetworkId: Number(networkId), isActive: true },
  });
  if (!plan) throw AppError.notFound('Network not available');

  const { payment } = await deductAndCreate(userId, {
    type: 'AIRTIME',
    merchant: plan.networkName,
    amount,
    phoneNumber: phone,
    reference,
  });

  await addUtilityJob('PROCESS_AIRTIME', {
    paymentId: payment.id,
    userId,
    reference,
    networkId: Number(networkId),
    phone,
    amount,
  });

  logger.info('Airtime queued', { userId, networkId, amount, reference });
  return payment;
};

const buyData = async (userId, { phone, planId }) => {
  const reference = `DATA-${uuidv4()}`;
  const plan = await prisma.vtuPlan.findFirst({
    where: { id: planId, type: 'DATA', isActive: true },
  });
  if (!plan) throw AppError.notFound('Data plan not found or unavailable');

  const { payment } = await deductAndCreate(userId, {
    type: 'DATA',
    merchant: plan.networkName,
    amount: Number(plan.sellingPrice),
    phoneNumber: phone,
    plan: plan.name,
    reference,
  });

  await addUtilityJob('PROCESS_DATA', {
    paymentId: payment.id,
    userId,
    reference,
    networkId: plan.providerNetworkId,
    providerPlanId: plan.providerPlanId,
    phone,
    amount: Number(plan.sellingPrice),
  });

  logger.info('Data queued', { userId, planId, reference });
  return payment;
};

const buyCable = async (userId, { smartCardNumber, planId }) => {
  const reference = `CABLE-${uuidv4()}`;
  const plan = await prisma.vtuPlan.findFirst({
    where: { id: planId, type: 'CABLE', isActive: true },
  });
  if (!plan) throw AppError.notFound('Cable plan not found or unavailable');

  const { payment } = await deductAndCreate(userId, {
    type: 'CABLE',
    merchant: plan.networkName,
    amount: Number(plan.sellingPrice),
    meterNumber: smartCardNumber,  // reuse meterNumber field to store smart card
    plan: plan.name,
    reference,
  });

  await addUtilityJob('PROCESS_CABLE', {
    paymentId: payment.id,
    userId,
    reference,
    cableNameId: plan.providerNetworkId,
    cablePlanId: plan.providerPlanId,
    smartCardNumber,
    amount: Number(plan.sellingPrice),
  });

  logger.info('Cable queued', { userId, planId, reference });
  return payment;
};

const payElectricity = async (userId, { meterNumber, discoId, meterType, amount, phone }) => {
  const reference = `ELEC-${uuidv4()}`;
  const disco = await prisma.vtuPlan.findFirst({
    where: { type: 'ELECTRICITY', providerNetworkId: Number(discoId), isActive: true },
  });
  if (!disco) throw AppError.notFound('Electricity provider not available');

  const { payment } = await deductAndCreate(userId, {
    type: 'ELECTRICITY',
    merchant: disco.networkName,
    amount,
    meterNumber,
    phoneNumber: phone,
    plan: meterType,
    reference,
  });

  await addUtilityJob('PROCESS_ELECTRICITY', {
    paymentId: payment.id,
    userId,
    reference,
    discoId: Number(discoId),
    meterNumber,
    meterType,
    amount,
    phone,
  });

  logger.info('Electricity queued', { userId, discoId, meterNumber, reference });
  return payment;
};

const validateIuc = async ({ smartCardNumber, cableNameId }) => {
  return alrahuzService.validateIuc({ smartCardNumber, cableNameId: Number(cableNameId) });
};

const validateMeter = async ({ meterNumber, discoId, meterType }) => {
  return alrahuzService.validateMeter({ meterNumber, discoId: Number(discoId), meterType });
};

const getBillHistory = async (userId, { page, limit, type }) => {
  const where = { userId, ...(type && { type }) };
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
  getPlans,
  buyAirtime,
  buyData,
  buyCable,
  payElectricity,
  validateIuc,
  validateMeter,
  getBillHistory,
};

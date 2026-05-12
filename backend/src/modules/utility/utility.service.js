/**
 * Utility service — airtime, data, cable, electricity, education pins via AlRahuz Data API.
 *
 * FLOW: wallet deduction → BullMQ job → worker calls AlRahuz → update status.
 * On AlRahuz failure: mark FAILED, refund via worker.
 */

const { v4: uuidv4 } = require('uuid');
const { prisma } = require('../../config/database');
const { redis } = require('../../config/redis');
const { AppError } = require('../../utils/api-error');
const { logger } = require('../../utils/logger');
const {
  NETWORKS,
  REDIS_KEYS,
  REDIS_TTL,
  detectNetworkFromPhone,
} = require('../../utils/constants');
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

// ── Catalogue (cached) ────────────────────────────────────────────────────────

const _planCacheKey = (type, networkId) =>
  `${REDIS_KEYS.VTU_DATA_PLANS}${type || 'all'}:${networkId || 'all'}`;

const _readCache = async (key) => {
  try {
    const raw = await redis.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    logger.warn('VTU cache read failed', { key, error: err.message });
    return null;
  }
};

const _writeCache = async (key, value, ttl) => {
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttl);
  } catch (err) {
    logger.warn('VTU cache write failed', { key, error: err.message });
  }
};

const getPlans = async ({ type, networkId, isActive = true }) => {
  // Hot path: DATA plans get a 1h Redis cache (per Phase 7 spec).
  const cacheable = type === 'DATA' && isActive;
  if (cacheable) {
    const key = _planCacheKey(type, networkId);
    const hit = await _readCache(key);
    if (hit) return hit;
  }

  const where = {
    type: type?.toUpperCase(),
    isActive,
    ...(networkId && { providerNetworkId: Number(networkId) }),
  };
  const plans = await prisma.vtuPlan.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { sellingPrice: 'asc' }],
  });

  if (cacheable) {
    await _writeCache(_planCacheKey(type, networkId), plans, REDIS_TTL.VTU_DATA_PLANS);
  }
  return plans;
};

const getNetworks = () => NETWORKS;

const detectNetwork = ({ phone }) => {
  const result = detectNetworkFromPhone(phone);
  if (!result) throw AppError.badRequest('Could not detect network from phone number');
  return result;
};

const getDiscos = async () => {
  const hit = await _readCache(REDIS_KEYS.VTU_DISCOS);
  if (hit) return hit;
  const discos = await prisma.vtuPlan.findMany({
    where: { type: 'ELECTRICITY', isActive: true },
    distinct: ['providerNetworkId'],
    select: { providerNetworkId: true, networkName: true },
    orderBy: { networkName: 'asc' },
  });
  const list = discos
    .filter((d) => d.providerNetworkId != null)
    .map((d) => ({ id: d.providerNetworkId, name: d.networkName }));
  await _writeCache(REDIS_KEYS.VTU_DISCOS, list, REDIS_TTL.VTU_DISCOS);
  return list;
};

// ── Purchases ─────────────────────────────────────────────────────────────────

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

  // Best-effort: try to capture meter holder name pre-flight so the post-success
  // payload always carries beneficiaryName (Phase 7 AC: must be returned to client).
  let beneficiaryName = null;
  try {
    const meta = await alrahuzService.validateMeter({
      meterNumber,
      discoId: Number(discoId),
      meterType,
    });
    beneficiaryName = meta?.Customer_Name || meta?.name || null;
  } catch (err) {
    logger.warn('Pre-flight meter validation failed (continuing)', {
      meterNumber, discoId, error: err.message,
    });
  }

  const { payment } = await deductAndCreate(userId, {
    type: 'ELECTRICITY',
    merchant: disco.networkName,
    amount,
    meterNumber,
    phoneNumber: phone,
    plan: meterType,
    reference,
  });

  if (beneficiaryName) {
    await prisma.utilityPayment.update({
      where: { id: payment.id },
      data: { beneficiaryName },
    });
    payment.beneficiaryName = beneficiaryName;
  }

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

const getBillHistory = async (userId, { page, limit, type, status }) => {
  const where = {
    userId,
    ...(type && { type }),
    ...(status && { status }),
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

/**
 * Recent unique recipients for a given service — drives the
 * "Recent recipients" chip row above the phone/meter input.
 * Returns up to `limit` distinct recipients ordered by most-recent purchase.
 */
const getRecentRecipients = async (userId, { type, limit }) => {
  const recipientField = type === 'ELECTRICITY' || type === 'CABLE' ? 'meterNumber' : 'phoneNumber';
  // Pull a wider window of recent settled payments, then de-duplicate in JS.
  // `distinct` + `orderBy createdAt desc` doesn't work cross-driver, so we
  // fetch ~50 rows and reduce — cheap, indexed (userId, type, status).
  const rows = await prisma.utilityPayment.findMany({
    where: {
      userId,
      type,
      status: 'COMPLETED',
      [recipientField]: { not: null },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      [recipientField]: true,
      merchant: true,
      beneficiaryName: true,
      createdAt: true,
    },
  });

  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const recipient = row[recipientField];
    if (!recipient || seen.has(recipient)) continue;
    seen.add(recipient);
    out.push({
      recipient,
      merchant: row.merchant,
      beneficiaryName: row.beneficiaryName,
      lastUsed: row.createdAt,
    });
    if (out.length >= limit) break;
  }
  return out;
};

const getPayment = (userId, paymentId) =>
  prisma.utilityPayment.findFirst({
    where: { id: paymentId, userId },
  });

module.exports = {
  getPlans,
  getNetworks,
  detectNetwork,
  getDiscos,
  buyAirtime,
  buyData,
  buyCable,
  payElectricity,
  validateIuc,
  validateMeter,
  getBillHistory,
  getRecentRecipients,
  getPayment,
};

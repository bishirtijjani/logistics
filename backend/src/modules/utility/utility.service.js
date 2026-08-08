/**
 * Utility service - airtime, data, cable, electricity via interchangeable VTU
 * providers (BilalSada primary, AlRahuz secondary; see services/vtu/router).
 *
 * FLOW: wallet deduction → BullMQ job → worker calls the provider → update
 * status. On provider failure: when a secondary is configured the worker
 * re-attempts on it (so the sale isn't lost); otherwise mark FAILED + refund.
 *
 * Each job carries BOTH providers' numeric IDs (a `providers` map) so the worker
 * can fail over without re-reading the catalogue. The catalogue's primary
 * columns are always the BilalSada IDs; the `alt*` columns are the AlRahuz IDs.
 */

const { v4: uuidv4 } = require('uuid');
const { prisma } = require('../../config/database');
const { redis } = require('../../config/redis');
const { AppError } = require('../../utils/api-error');
const { logger } = require('../../utils/logger');
const {
  REDIS_KEYS,
  REDIS_TTL,
  detectNetworkFromPhone,
} = require('../../utils/constants');
const vtuRouter = require('../../services/vtu/router');
const settingsService = require('../../services/settings.service');
const { addUtilityJob } = require('../../queues');
const { UTILITY_JOBS } = require('../../queues/jobs');

/**
 * Build the per-provider numeric-ID map attached to every utility job. The
 * catalogue's primary columns hold the BilalSada IDs and the `alt*` columns
 * hold the AlRahuz IDs, so the mapping is provider-identity fixed regardless of
 * which one is currently primary. A provider's entry is null when its IDs
 * aren't mapped for this plan OR admin switched the plan off for it
 * (providerEnabled / altProviderEnabled) - either way that provider can't vend
 * this item, so it's skipped for both the initial vend and failover.
 */
const _buildProviderIds = (type, plan) => {
  const needsPlanId = type === 'DATA' || type === 'CABLE';
  // `!== false` keeps rows created before the toggle columns existed enabled.
  const bilal = plan.providerEnabled !== false
    ? {
        networkId: plan.providerNetworkId,
        ...(needsPlanId ? { planId: plan.providerPlanId } : {}),
      }
    : null;
  const hasAlt =
    plan.altProviderEnabled !== false &&
    plan.altProviderNetworkId != null && (!needsPlanId || plan.altProviderPlanId != null);
  const alrahuz = hasAlt
    ? {
        networkId: plan.altProviderNetworkId,
        ...(needsPlanId ? { planId: plan.altProviderPlanId } : {}),
      }
    : null;
  return { BILALSADASUB: bilal, ALRAHUZ: alrahuz };
};

/**
 * Resolve the active providers and assert at least one of them can vend this
 * plan, BEFORE the wallet is debited. Without this, an item admin switched off
 * on the only active provider would debit → enqueue → immediately fail →
 * refund; rejecting upfront gives the customer a clean error instead.
 * Returns the provider the vend should start on (the mode's primary, or the
 * secondary when the primary can't serve this specific item).
 */
const _resolveVendableProvider = async (providers) => {
  const { primary, secondary } = await vtuRouter.resolveProviders();
  if (providers[primary]) return { primary, secondary, provider: primary };
  if (secondary && providers[secondary]) return { primary, secondary, provider: secondary };
  throw AppError.badRequest('This item is temporarily unavailable. Please try again later.');
};

/**
 * Debit the payer's User wallet and create the PROCESSING UtilityPayment,
 * atomically. Every role (customer, rider, merchant) spends VTU from their
 * single User-level Wallet - merchants are funded the same way riders are
 * (order earnings + top-ups both land in this wallet). The worker later flips
 * the paired Transaction to COMPLETED/FAILED and refunds this wallet on failure.
 */
const deductAndCreate = async (userId, { type, biller, amount, phoneNumber, meterNumber, plan, reference, provider, providers, fee = 0 }) => {
  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw AppError.notFound('Wallet not found');
    if (wallet.isLocked) throw AppError.forbidden('Wallet is frozen');

    const balance = Number(wallet.balance);
    // Total actually leaving the wallet: the vend amount plus any platform
    // service fee (e.g. the flat electricity charge). `amount` on the
    // Transaction/UtilityPayment rows stays the face/vend value - it's what's
    // sent to the provider and shown as "what you bought" - the fee rides
    // alongside it in its own column so refunds and receipts can tell them apart.
    const total = Number(amount) + Number(fee);
    // Conditional debit so concurrent purchases can't overdraw: the WHERE runs
    // under the UPDATE's row lock, so a read-then-decrement can't slip a second
    // debit past a stale balance check under READ COMMITTED (which is how this
    // wallet reached a negative balance). Mirrors the withdrawal path.
    const debit = await tx.wallet.updateMany({
      where: { id: wallet.id, isLocked: false, balance: { gte: total } },
      data: { balance: { decrement: total } },
    });
    if (debit.count !== 1) throw AppError.insufficientBalance();

    await tx.transaction.create({
      data: {
        reference,
        type: 'UTILITY_PAYMENT',
        status: 'PROCESSING',
        amount,
        fee,
        description: `${biller} ${type.toLowerCase()} ${phoneNumber || meterNumber || ''}`.trim(),
        debitWalletId: wallet.id,
        provider: provider || 'BILALSADASUB',
        balanceBefore: balance,
        balanceAfter: balance - total,
      },
    });

    const payment = await tx.utilityPayment.create({
      data: {
        userId,
        type,
        biller,
        amount,
        phoneNumber,
        meterNumber,
        plan,
        provider: provider || 'BILALSADASUB',
        ...(providers ? { providerIds: providers } : {}),
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

// Default to AIRTIME for back-compat - the existing customer `GET /utility/networks`
// endpoint historically returned only mobile networks.
const getNetworks = async ({ type = 'AIRTIME' } = {}) => {
  const key = `${REDIS_KEYS.VTU_NETWORKS}${type}`;
  const hit = await _readCache(key);
  if (hit) return hit;
  const rows = await prisma.vtuNetwork.findMany({
    where: { type, isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { providerNetworkId: true, name: true },
  });
  const list = rows.map((n) => ({ id: n.providerNetworkId, name: n.name }));
  await _writeCache(key, list, REDIS_TTL.VTU_NETWORKS);
  return list;
};

const detectNetwork = async ({ phone }) => {
  const match = detectNetworkFromPhone(phone);
  if (!match) throw AppError.badRequest('Could not detect network from phone number');
  // Resolve the live providerNetworkId from the admin-managed catalogue so a
  // provider renumber (e.g. MTN 1 → 100) doesn't require a code change.
  const row = await prisma.vtuNetwork.findFirst({
    where: { type: 'AIRTIME', name: match.name, isActive: true },
    select: { providerNetworkId: true },
  });
  if (!row) throw AppError.badRequest(`Network "${match.name}" is not configured`);
  return { name: match.name, id: row.providerNetworkId, prefix: match.prefix };
};

const getDiscos = async () => {
  const hit = await _readCache(REDIS_KEYS.VTU_DISCOS);
  if (hit) return hit;
  const rows = await prisma.vtuNetwork.findMany({
    where: { type: 'ELECTRICITY', isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { providerNetworkId: true, name: true },
  });
  const list = rows.map((d) => ({ id: d.providerNetworkId, name: d.name }));
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

  const providers = _buildProviderIds('AIRTIME', plan);
  const { provider } = await _resolveVendableProvider(providers);

  const { payment } = await deductAndCreate(userId, {
    type: 'AIRTIME',
    biller: plan.networkName,
    amount,
    phoneNumber: phone,
    reference,
    provider,
    providers,
  });

  await addUtilityJob(UTILITY_JOBS.PROCESS_AIRTIME, {
    paymentId: payment.id,
    userId,
    reference,
    providers,
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

  const providers = _buildProviderIds('DATA', plan);
  const { provider } = await _resolveVendableProvider(providers);

  const { payment } = await deductAndCreate(userId, {
    type: 'DATA',
    biller: plan.networkName,
    amount: Number(plan.sellingPrice),
    phoneNumber: phone,
    plan: plan.name,
    reference,
    provider,
    providers,
  });

  await addUtilityJob(UTILITY_JOBS.PROCESS_DATA, {
    paymentId: payment.id,
    userId,
    reference,
    providers,
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

  const providers = _buildProviderIds('CABLE', plan);
  const { provider } = await _resolveVendableProvider(providers);

  const { payment } = await deductAndCreate(userId, {
    type: 'CABLE',
    biller: plan.networkName,
    amount: Number(plan.sellingPrice),
    meterNumber: smartCardNumber,  // reuse meterNumber field to store smart card
    plan: plan.name,
    reference,
    provider,
    providers,
  });

  await addUtilityJob(UTILITY_JOBS.PROCESS_CABLE, {
    paymentId: payment.id,
    userId,
    reference,
    providers,
    smartCardNumber,
    amount: Number(plan.sellingPrice),
  });

  logger.info('Cable queued', { userId, planId, reference });
  return payment;
};

const payElectricity = async (userId, { meterNumber, discoId, meterType, amount, phone }) => {
  // Minimum vend amount is platform-configurable (single source of truth); the
  // zod schema only guarantees a positive integer. The 500 fallback applies only
  // if the setting row is missing.
  const minAmount = Number(await settingsService.getSetting('utility.minElectricityAmount', 500));
  if (amount < minAmount) {
    throw AppError.badRequest(`Minimum electricity payment is ₦${minAmount.toLocaleString()}`);
  }

  // Percentage platform service charge, on top of the face value vended -
  // electricity has no per-unit markup like data/cable (the amount IS the token
  // value AEDC etc. generate, so we can't mark that up invisibly), so margin
  // here is this explicit, customer-visible fee instead. Admin-adjustable,
  // defaults to 1% (e.g. ₦10 on a ₦1,000 purchase).
  const feePercent = Number(await settingsService.getSetting('utility.electricityServiceFeePercent', 1));
  const fee = Math.round((amount * feePercent) / 100);

  const reference = `ELEC-${uuidv4()}`;
  const disco = await prisma.vtuPlan.findFirst({
    where: { type: 'ELECTRICITY', providerNetworkId: Number(discoId), isActive: true },
  });
  if (!disco) throw AppError.notFound('Electricity provider not available');

  const providers = _buildProviderIds('ELECTRICITY', disco);
  // Validate with the provider that will actually vend (the mode's primary, or
  // the secondary when the primary is disabled/unmapped for this disco).
  const { provider } = await _resolveVendableProvider(providers);
  const vendAdapter = vtuRouter.getAdapter(provider);
  const vendDiscoId = providers[provider]?.networkId ?? Number(discoId);

  // Best-effort: try to capture meter holder name pre-flight so the post-success
  // payload always carries beneficiaryName (Phase 7 AC: must be returned to client).
  let beneficiaryName = null;
  try {
    const meta = await vendAdapter.validateMeter({
      meterNumber,
      discoId: vendDiscoId,
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
    biller: disco.networkName,
    amount,
    fee,
    meterNumber,
    phoneNumber: phone,
    plan: meterType,
    reference,
    provider,
    providers,
  });

  if (beneficiaryName) {
    await prisma.utilityPayment.update({
      where: { id: payment.id },
      data: { beneficiaryName },
    });
    payment.beneficiaryName = beneficiaryName;
  }

  // Surface the fee breakdown so the client can show it (receipt/history), even
  // though UtilityPayment itself only stores the face `amount` (what was vended).
  payment.fee = fee;
  payment.totalCharged = Number(amount) + fee;

  await addUtilityJob(UTILITY_JOBS.PROCESS_ELECTRICITY, {
    paymentId: payment.id,
    userId,
    reference,
    providers,
    meterNumber,
    meterType,
    amount,
    phone,
  });

  logger.info('Electricity queued', { userId, discoId, meterNumber, reference });
  return payment;
};

/**
 * Resolve the network/cable/disco id the *primary* provider expects. The client
 * always sends the catalogue (BilalSada) id; when the primary is AlRahuz we map
 * it to the row's altProviderNetworkId so the provider sees its own id. Falls
 * back to the original id when no mapping exists.
 */
const _primaryNetworkId = async (type, clientNetworkId) => {
  const { primary } = await vtuRouter.resolveProviders();
  if (primary === 'BILALSADASUB') return { adapter: vtuRouter.getAdapter(primary), networkId: Number(clientNetworkId) };
  const net = await prisma.vtuNetwork.findFirst({
    where: { type, providerNetworkId: Number(clientNetworkId) },
    select: { altProviderNetworkId: true },
  });
  return {
    adapter: vtuRouter.getAdapter(primary),
    networkId: net?.altProviderNetworkId ?? Number(clientNetworkId),
  };
};

const validateIuc = async ({ smartCardNumber, cableNameId }) => {
  const { adapter, networkId } = await _primaryNetworkId('CABLE', cableNameId);
  return adapter.validateIuc({ smartCardNumber, cableNameId: networkId });
};

const validateMeter = async ({ meterNumber, discoId, meterType }) => {
  const { adapter, networkId } = await _primaryNetworkId('ELECTRICITY', discoId);
  return adapter.validateMeter({ meterNumber, discoId: networkId, meterType });
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
 * Recent unique recipients for a given service - drives the
 * "Recent recipients" chip row above the phone/meter input.
 * Returns up to `limit` distinct recipients ordered by most-recent purchase.
 */
const getRecentRecipients = async (userId, { type, limit }) => {
  const recipientField = type === 'ELECTRICITY' || type === 'CABLE' ? 'meterNumber' : 'phoneNumber';
  // Pull a wider window of recent settled payments, then de-duplicate in JS.
  // `distinct` + `orderBy createdAt desc` doesn't work cross-driver, so we
  // fetch ~50 rows and reduce - cheap, indexed (userId, type, status).
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
      biller: true,
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
      biller: row.biller,
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
  // Exported for tests
  _internal: {
    _buildProviderIds,
    _resolveVendableProvider,
  },
};

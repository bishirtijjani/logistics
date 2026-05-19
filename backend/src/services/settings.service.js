const { prisma } = require('../config/database');
const { redis } = require('../config/redis');
const { logger } = require('../utils/logger');

const CACHE_KEY = 'platform:settings';
const CACHE_TTL = 300; // 5 minutes

let memCache = null;
let memCachedAt = 0;
const MEM_TTL_MS = 60 * 1000; // 1 min in-process cache

/**
 * Load all settings into a key→value map.
 */
const loadAll = async () => {
  const rows = await prisma.platformSetting.findMany();
  const map = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return map;
};

/**
 * Get all settings, using memory cache → Redis → DB fallback chain.
 */
const getAllSettings = async () => {
  const now = Date.now();
  if (memCache && now - memCachedAt < MEM_TTL_MS) return memCache;

  try {
    const cached = await redis.get(CACHE_KEY);
    if (cached) {
      memCache = JSON.parse(cached);
      memCachedAt = now;
      return memCache;
    }
  } catch (_) {}

  const settings = await loadAll();
  memCache = settings;
  memCachedAt = now;

  try {
    await redis.set(CACHE_KEY, JSON.stringify(settings), 'EX', CACHE_TTL);
  } catch (_) {}

  return settings;
};

/**
 * Get a single setting value with a typed default.
 */
const getSetting = async (key, defaultValue = null) => {
  const all = await getAllSettings();
  return all[key] !== undefined ? all[key] : defaultValue;
};

/**
 * Get multiple settings at once.
 */
const getSettings = async (keys) => {
  const all = await getAllSettings();
  const result = {};
  for (const k of keys) result[k] = all[k] !== undefined ? all[k] : null;
  return result;
};

/**
 * Update a setting (admin only — controller enforces auth).
 * Invalidates cache.
 */
const setSetting = async (key, value, updatedBy) => {
  const setting = await prisma.platformSetting.upsert({
    where: { key },
    update: { value, updatedBy },
    create: { key, value, updatedBy },
  });

  // Bust caches
  memCache = null;
  memCachedAt = 0;
  try {
    await redis.del(CACHE_KEY);
    await redis.publish('settings:invalidated', key);
  } catch (_) {}

  logger.info('Platform setting updated', { key, updatedBy });
  return setting;
};

/**
 * Public subset exposed to the mobile app (no sensitive keys).
 */
const PUBLIC_KEYS = [
  'platform.currency',
  'platform.supportPhone',
  'platform.supportEmail',
  'wallet.minTopup',
  'wallet.minWithdraw',
  'wallet.maxWithdraw',
  'wallet.withdrawalFee',
  'wallet.minTransfer',
  'wallet.transferQuickAmounts',
  'wallet.withdrawQuickAmounts',
  'utility.minElectricityAmount',
  'utility.electricityQuickAmounts',
  'utility.minAirtimeAmount',
  'utility.airtimeQuickAmounts',
  // Airtime-to-cash — what % of airtime value the customer receives in wallet.
  // Stored as a decimal string ("0.75" = customer gets ₦750 per ₦1000 of airtime).
  // Provider (airtimetocash.com) pays us 80% baseline; the spread is platform margin.
  'airtimeToCash.payoutRate',
  'airtimeToCash.quickAmounts',
  'auth.pinMaxAttempts',
  'auth.pinLockoutMinutes',
  'delivery.baseFare',
  'delivery.perKmRate',
  'delivery.platformFeePercent',
  'delivery.cancellationFee',
  // Phase 5 — POD gates the rider client reads at "Complete delivery" time
  // so it knows which sheets to mount (photo / signature / OTP). Server is
  // still authoritative; client uses these to avoid mounting sheets the
  // server would never gate on.
  'delivery.requirePodPhoto',
  'delivery.requireSignature',
  'delivery.podOtpThresholdNgn',
  'merchant.platformFeePercent',
];

const getPublicSettings = async () => {
  return getSettings(PUBLIC_KEYS);
};

module.exports = { getSetting, getSettings, setSetting, getAllSettings, getPublicSettings };

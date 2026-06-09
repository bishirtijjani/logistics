/**
 * Category service - public-facing reads of merchant categories.
 *
 * Uses an in-process 60s cache because categories change rarely
 * (admin actions only) and are queried on every customer app cold start.
 */

const { prisma } = require('../../config/database');

let memCache = null;
let memCachedAt = 0;
const MEM_TTL_MS = 60 * 1000;

const invalidateCache = () => {
  memCache = null;
  memCachedAt = 0;
};

const listCategories = async ({ activeOnly = true } = {}) => {
  if (activeOnly && memCache && Date.now() - memCachedAt < MEM_TTL_MS) {
    return memCache;
  }

  const categories = await prisma.merchantCategory.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });

  if (activeOnly) {
    memCache = categories;
    memCachedAt = Date.now();
  }

  return categories;
};

const getCategoryById = (id) =>
  prisma.merchantCategory.findUnique({ where: { id } });

const getCategoryBySlug = (slug) =>
  prisma.merchantCategory.findUnique({ where: { slug } });

module.exports = {
  listCategories,
  getCategoryById,
  getCategoryBySlug,
  invalidateCache,
};

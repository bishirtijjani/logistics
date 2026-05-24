/**
 * Waitlist service — pre-launch sign-ups from the marketing website.
 */

const { prisma } = require('../../config/database');
const { logger } = require('../../utils/logger');

const ENTRY_SELECT = {
  id: true,
  name: true,
  phone: true,
  email: true,
  city: true,
  notes: true,
  role: true,
  platform: true,
  source: true,
  ipAddress: true,
  userAgent: true,
  createdAt: true,
};

const createEntry = async (input, requestMeta = {}) => {
  const entry = await prisma.waitlistEntry.create({
    data: {
      name: input.name,
      phone: input.phone,
      email: input.email || null,
      city: input.city || null,
      notes: input.notes || null,
      role: input.role || 'UNKNOWN',
      platform: input.platform || 'UNKNOWN',
      source: input.source || null,
      ipAddress: requestMeta.ipAddress || null,
      userAgent: requestMeta.userAgent || null,
    },
    select: ENTRY_SELECT,
  });

  logger.info({ entryId: entry.id, role: entry.role, platform: entry.platform }, 'Waitlist entry created');
  return entry;
};

const listEntries = async ({ role, platform, search, page = 1, limit = 50 } = {}) => {
  const where = {};
  if (role) where.role = role;
  if (platform) where.platform = platform;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
      { email: { contains: search, mode: 'insensitive' } },
      { city: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [entries, total] = await Promise.all([
    prisma.waitlistEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: ENTRY_SELECT,
    }),
    prisma.waitlistEntry.count({ where }),
  ]);

  return { entries, total, page, limit };
};

const deleteEntry = async (id) => {
  await prisma.waitlistEntry.delete({ where: { id } });
};

const summary = async () => {
  const [total, byRole, byPlatform] = await Promise.all([
    prisma.waitlistEntry.count(),
    prisma.waitlistEntry.groupBy({ by: ['role'], _count: { _all: true } }),
    prisma.waitlistEntry.groupBy({ by: ['platform'], _count: { _all: true } }),
  ]);

  const roleCounts = byRole.reduce((acc, row) => {
    acc[row.role] = row._count._all;
    return acc;
  }, {});
  const platformCounts = byPlatform.reduce((acc, row) => {
    acc[row.platform] = row._count._all;
    return acc;
  }, {});

  return { total, roleCounts, platformCounts };
};

module.exports = {
  createEntry,
  listEntries,
  deleteEntry,
  summary,
};

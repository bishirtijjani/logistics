/**
 * Custom places service - admin CRUD over the custom_places table.
 *
 * Custom places are curated locations Google doesn't know about (campus
 * buildings, estates, market stalls, villages). They are merged into the maps
 * autocomplete ranking ahead of Google and served to the customer/rider maps as
 * labelled markers, so they read exactly like native Google results.
 */

const { prisma } = require('../../config/database');
const { AppError } = require('../../utils/api-error');
const { createAuditLog } = require('../../utils/audit');

const ENTITY = 'CUSTOM_PLACE';

/**
 * List custom places with optional search / active filter. Search matches the
 * name and aliases (case-insensitive substring), so a campus place can be
 * found by its alias ("SBS" for Social & Management Sciences).
 */
const listCustomPlaces = async ({ page = 1, limit = 50, search, isActive }) => {
  const where = {};
  if (search) {
    const q = String(search).trim();
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { aliases: { has: q } },
        { aliases: { has: q.toLowerCase() } },
      ];
    }
  }
  if (isActive === 'true') where.isActive = true;
  if (isActive === 'false') where.isActive = false;

  const [items, total] = await Promise.all([
    prisma.customPlace.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.customPlace.count({ where }),
  ]);

  return { items, total, page, limit };
};

/**
 * Create a custom place (visual pin-drop + name in the admin dashboard).
 */
const createCustomPlace = async (data, adminUserId, ipAddress, userAgent) => {
  const { aliases, ...rest } = data;
  const place = await prisma.customPlace.create({
    data: {
      ...rest,
      aliases: (aliases || []).filter(Boolean),
    },
  });

  await createAuditLog(
    adminUserId,
    'CREATE_CUSTOM_PLACE',
    ENTITY,
    place.id,
    { name: place.name, lat: place.lat, lng: place.lng },
    ipAddress,
    userAgent,
  );

  return place;
};

/**
 * Update a custom place (any field, including isActive toggle).
 */
const updateCustomPlace = async (placeId, data, adminUserId, ipAddress, userAgent) => {
  const existing = await prisma.customPlace.findUnique({ where: { id: placeId } });
  if (!existing) throw AppError.notFound('Custom place not found');

  const { aliases, ...rest } = data;
  const update = { ...rest };
  if (aliases !== undefined) update.aliases = aliases.filter(Boolean);

  const place = await prisma.customPlace.update({ where: { id: placeId }, data: update });

  await createAuditLog(
    adminUserId,
    'UPDATE_CUSTOM_PLACE',
    ENTITY,
    placeId,
    { name: place.name, fields: Object.keys(update) },
    ipAddress,
    userAgent,
  );

  return place;
};

/**
 * Hard delete. Safe because requests store the resolved lat/lng + address at
 * creation time (they never reference a custom-place id), so history survives.
 */
const deleteCustomPlace = async (placeId, adminUserId, ipAddress, userAgent) => {
  const existing = await prisma.customPlace.findUnique({ where: { id: placeId } });
  if (!existing) throw AppError.notFound('Custom place not found');

  await prisma.customPlace.delete({ where: { id: placeId } });

  await createAuditLog(
    adminUserId,
    'DELETE_CUSTOM_PLACE',
    ENTITY,
    placeId,
    { name: existing.name },
    ipAddress,
    userAgent,
  );
};

module.exports = {
  listCustomPlaces,
  createCustomPlace,
  updateCustomPlace,
  deleteCustomPlace,
};

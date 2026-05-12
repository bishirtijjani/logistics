/**
 * SavedAddress service — Phase 6.
 *
 * `isDefault` invariant: at most one address per user is the default.
 * Enforced inside the create/update transactions by unsetting any previous
 * default in the same `prisma.$transaction` so we never have two defaults
 * even under concurrent writes (Prisma serialises transactions on a single
 * connection per request).
 *
 * Soft-delete is intentionally NOT modelled — saved addresses are cheap and
 * users want a hard delete. FK is `onDelete: Cascade` from User so an
 * account deletion drops the rows automatically.
 */

const { prisma } = require('../../config/database');
const { AppError } = require('../../utils/api-error');

// P2002 = unique constraint violation. Used by the partial unique index
// `saved_addresses(userId) WHERE isDefault=true` to enforce single-default
// under concurrent writes. When we see it, retry once with `isDefault: false`
// — the prior winner is already the default; the new row is added without
// claiming the default flag instead of failing the user-facing request.
const isP2002 = (err) => err?.code === 'P2002';

const list = async (userId) => {
  return prisma.savedAddress.findMany({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
  });
};

const create = async (userId, input) => {
  const wantsDefault = !!input.isDefault;
  const attempt = async (forceDefault) =>
    prisma.$transaction(async (tx) => {
      const claimDefault = forceDefault ?? wantsDefault;
      if (claimDefault) {
        await tx.savedAddress.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }
      // If the user has zero addresses, force the first one to be default —
      // saves them a tap later. When `forceDefault === false` we override
      // this in the retry path so two concurrent first-time creates can't
      // both claim default and trip P2002 forever.
      let asDefault = claimDefault;
      if (!asDefault && forceDefault === undefined) {
        const isFirst = (await tx.savedAddress.count({ where: { userId } })) === 0;
        asDefault = isFirst;
      }
      return tx.savedAddress.create({
        data: {
          userId,
          label: input.label,
          address: input.address,
          lat: input.lat,
          lng: input.lng,
          placeId: input.placeId || null,
          isDefault: asDefault,
        },
      });
    });

  try {
    return await attempt();
  } catch (err) {
    if (!isP2002(err)) throw err;
    // Lost the default-flip race. Retry once as a non-default row — the
    // other writer is already the user's default.
    return attempt(false);
  }
};

const update = async (userId, id, input) => {
  const existing = await prisma.savedAddress.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    throw AppError.notFound('Address not found');
  }
  const run = (asDefault) =>
    prisma.$transaction(async (tx) => {
      if (asDefault === true) {
        await tx.savedAddress.updateMany({
          where: { userId, isDefault: true, NOT: { id } },
          data: { isDefault: false },
        });
      }
      return tx.savedAddress.update({
        where: { id },
        data: {
          ...(input.label != null && { label: input.label }),
          ...(input.address != null && { address: input.address }),
          ...(input.lat != null && { lat: input.lat }),
          ...(input.lng != null && { lng: input.lng }),
          ...(input.placeId !== undefined && { placeId: input.placeId || null }),
          ...(asDefault != null && { isDefault: asDefault }),
        },
      });
    });

  try {
    return await run(input.isDefault);
  } catch (err) {
    if (!isP2002(err)) throw err;
    // Race with a concurrent default flip — retry as non-default.
    return run(false);
  }
};

const setDefault = async (userId, id) => {
  const existing = await prisma.savedAddress.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    throw AppError.notFound('Address not found');
  }
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.savedAddress.updateMany({
        where: { userId, isDefault: true, NOT: { id } },
        data: { isDefault: false },
      });
      return tx.savedAddress.update({
        where: { id },
        data: { isDefault: true },
      });
    });
  } catch (err) {
    if (!isP2002(err)) throw err;
    // The "other" default is being set concurrently. Re-fetch and return
    // whichever row is now the default — the caller's intent was "make this
    // one the active default" but losing the race means the user's last
    // action wins; surface a 409 so the UI can refetch.
    throw AppError.conflict('Default was changed by another request — please refresh.');
  }
};

const remove = async (userId, id) => {
  const existing = await prisma.savedAddress.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    throw AppError.notFound('Address not found');
  }
  const wasDefault = existing.isDefault;

  // Single transaction so the orphan-default promotion isn't racy: a
  // concurrent delete of the "next" address can't clobber the read of it.
  return prisma.$transaction(async (tx) => {
    await tx.savedAddress.delete({ where: { id } });

    if (wasDefault) {
      const next = await tx.savedAddress.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
      });
      if (next) {
        await tx.savedAddress.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    }
    return { id };
  });
};

module.exports = { list, create, update, setDefault, remove };

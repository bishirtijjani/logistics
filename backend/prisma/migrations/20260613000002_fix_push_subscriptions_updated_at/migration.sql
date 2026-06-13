-- DB drift repair: the 20260607190000_add_push_subscriptions migration created
-- push_subscriptions WITH an "updatedAt" column, but on at least one environment
-- the live table is missing it (the table pre-existed without the column, or it
-- was dropped). The schema has `updatedAt DateTime @updatedAt`, so every
-- subscribe/lookup fails with Prisma P2022 (column not found).
--
-- IF NOT EXISTS makes this a no-op on databases where the column already exists
-- (e.g. dev/CI that applied the original migration cleanly) and adds it where it
-- drifted away. The DEFAULT is required because the column is NOT NULL and the
-- table may already hold rows.

-- AlterTable
ALTER TABLE "push_subscriptions"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

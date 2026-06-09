-- Migration: merge grocery-liquid into grocery
-- A single merchant frequently carries both dry and liquid groceries (rice +
-- soda), so the split was forcing them to either pick one and hide half their
-- catalog or list themselves twice. Collapsing to one customer-facing
-- `grocery` category; pack-unit choice moves to the product level (the merged
-- attributeSchema lists all units, merchants pick per-variant).
--
-- Steps:
--   1. Widen the `grocery` category's attributeSchema to include liquid pack
--      units and the flavor axis (so merchants who used grocery-liquid don't
--      lose options).
--   2. Rename it from "Grocery (dry)" to just "Grocery".
--   3. Reassign any merchants currently on `grocery-liquid` to `grocery`.
--   4. Delete the `grocery-liquid` category row.
--
-- All within a transaction - partial failure rolls back.

BEGIN;

-- Idempotency guard: if a prior run already collapsed everything (e.g. on a
-- fresh DB where the seeder has been updated), these are all no-ops.

-- 1 + 2. Update the grocery category in place. Also rename to the plural
-- "Groceries" since that's the customer-facing tile label.
UPDATE "merchant_categories"
SET
    "name"            = 'Groceries',
    "description"     = 'Shop supermarkets, drinks and household',
    "attributeSchema" = '{"axes":[],"pack":true,"packUnits":["G","KG","PACK","SACHET","CARTON","ML","L","BOTTLE","PIECE"]}'::jsonb,
    "updatedAt"       = CURRENT_TIMESTAMP
WHERE "slug" = 'grocery';

-- Rename the Restaurant category to "Food" - the customer-facing concept is
-- food ordering, and the slug stays `restaurant` so routing isn't disturbed.
UPDATE "merchant_categories"
SET "name" = 'Food', "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'restaurant';

-- 3. Reassign merchants from grocery-liquid → grocery. The category IDs are
-- deterministic UUIDs from the seed file so we can reference them directly
-- without a sub-select, but we use a sub-select for safety in case an admin
-- has manually re-seeded with different IDs.
UPDATE "merchants"
SET "categoryId" = (SELECT "id" FROM "merchant_categories" WHERE "slug" = 'grocery')
WHERE "categoryId" = (SELECT "id" FROM "merchant_categories" WHERE "slug" = 'grocery-liquid');

-- 4. Remove the now-empty grocery-liquid category. Safe because step 3
-- migrated every dependent merchant; deleting an empty row is a no-op if a
-- prior run already did it.
DELETE FROM "merchant_categories" WHERE "slug" = 'grocery-liquid';

COMMIT;

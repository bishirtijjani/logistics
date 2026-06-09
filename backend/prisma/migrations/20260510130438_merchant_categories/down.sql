-- Rollback: data-driven merchant categories.
-- Restores the MerchantType enum and the original RequestType values.
-- Prisma does not auto-run this; apply manually if a forward deploy must be rolled back.
-- Pre-condition: backend code has been redeployed to the pre-categories tag (still expects MerchantType, FOOD/GROCERY/PHARMACY).
--
-- Step order matters: every UPDATE that joins through merchant_categories or merchants.categoryId
-- runs BEFORE the FK column / lookup table are dropped at the bottom.

BEGIN;

-- ============================================================
-- 1. Recreate the MerchantType enum + add back merchants.type column
-- ============================================================
CREATE TYPE "MerchantType" AS ENUM ('RESTAURANT', 'GROCERY', 'PHARMACY');
ALTER TABLE "merchants" ADD COLUMN "type" "MerchantType";

-- Backfill merchants.type from category slug (categoryId still exists at this point)
UPDATE "merchants" SET "type" = CASE c.slug
    WHEN 'restaurant' THEN 'RESTAURANT'::"MerchantType"
    WHEN 'grocery'    THEN 'GROCERY'::"MerchantType"
    WHEN 'pharmacy'   THEN 'PHARMACY'::"MerchantType"
    ELSE 'RESTAURANT'::"MerchantType"  -- categories created post-migration default to RESTAURANT
END
FROM "merchant_categories" c
WHERE "merchants"."categoryId" = c.id;

ALTER TABLE "merchants" ALTER COLUMN "type" SET NOT NULL;
CREATE INDEX "merchants_type_idx" ON "merchants" ("type");

-- ============================================================
-- 2. Restore RequestType. The temp column is filled while categoryId still exists.
-- ============================================================
ALTER TABLE "requests" ADD COLUMN "type_old" TEXT;

-- Map MERCHANT_ORDER rows back to FOOD/GROCERY/PHARMACY using the merchant category slug
UPDATE "requests" SET "type_old" = CASE
    WHEN slug.s = 'restaurant' THEN 'FOOD'
    WHEN slug.s = 'grocery'    THEN 'GROCERY'
    WHEN slug.s = 'pharmacy'   THEN 'PHARMACY'
    ELSE 'FOOD'  -- categories created post-migration default to FOOD on rollback
END
FROM (
    SELECT m.id AS merchant_id, c.slug AS s
    FROM "merchants" m
    JOIN "merchant_categories" c ON c.id = m."categoryId"
) slug
WHERE "requests"."merchantId" = slug.merchant_id
  AND "requests"."type" = 'MERCHANT_ORDER';

UPDATE "requests" SET "type_old" = 'PACKAGE' WHERE "type" = 'PACKAGE';

ALTER TABLE "requests" DROP COLUMN "type";
DROP TYPE "RequestType";
CREATE TYPE "RequestType" AS ENUM ('FOOD', 'GROCERY', 'PHARMACY', 'PACKAGE');

ALTER TABLE "requests" ADD COLUMN "type" "RequestType";
UPDATE "requests" SET "type" = "type_old"::"RequestType";
ALTER TABLE "requests" ALTER COLUMN "type" SET NOT NULL;
ALTER TABLE "requests" DROP COLUMN "type_old";

CREATE INDEX "requests_type_idx" ON "requests" ("type");

-- ============================================================
-- 3. Drop the categoryId FK, index, column - only after all data has been migrated above
-- ============================================================
ALTER TABLE "merchants" DROP CONSTRAINT IF EXISTS "merchants_categoryId_fkey";
DROP INDEX IF EXISTS "merchants_categoryId_idx";
ALTER TABLE "merchants" DROP COLUMN "categoryId";

-- ============================================================
-- 4. Drop the merchant_categories table
-- ============================================================
DROP INDEX IF EXISTS "merchant_categories_isActive_sortOrder_idx";
DROP INDEX IF EXISTS "merchant_categories_slug_key";
DROP INDEX IF EXISTS "merchant_categories_name_key";
DROP TABLE "merchant_categories";

COMMIT;

-- Migration: data-driven merchant categories
-- Replaces hardcoded MerchantType enum with admin-managed MerchantCategory table.
-- Reduces RequestType enum to MERCHANT_ORDER | PACKAGE.
-- Strategy: create new table -> seed defaults -> backfill merchants -> drop old type column
--           -> backfill request types via temp column -> drop old enum.
-- All steps wrapped in a transaction so partial failure rolls back automatically.

BEGIN;

-- ============================================================
-- 1. Create the merchant_categories table
-- ============================================================
CREATE TABLE "merchant_categories" (
    "id"             TEXT          NOT NULL,
    "name"           TEXT          NOT NULL,
    "slug"           TEXT          NOT NULL,
    "description"    TEXT,
    "icon"           TEXT,
    "color"          TEXT,
    "sortOrder"      INTEGER       NOT NULL DEFAULT 0,
    "hasPreparation" BOOLEAN       NOT NULL DEFAULT true,
    "isActive"       BOOLEAN       NOT NULL DEFAULT true,
    "createdAt"      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "merchant_categories_name_key" ON "merchant_categories" ("name");
CREATE UNIQUE INDEX "merchant_categories_slug_key" ON "merchant_categories" ("slug");
CREATE INDEX "merchant_categories_isActive_sortOrder_idx" ON "merchant_categories" ("isActive", "sortOrder");

-- ============================================================
-- 2. Seed the three default categories with deterministic UUIDs.
--    Mapping: RESTAURANT -> Restaurant, GROCERY -> Grocery, PHARMACY -> Pharmacy.
--    Colors/icons sourced from mobile/customer-app HomeScreen + theme.
-- ============================================================
INSERT INTO "merchant_categories"
    ("id", "name", "slug", "description", "icon", "color", "sortOrder", "hasPreparation", "isActive")
VALUES
    ('00000000-0000-4000-a000-000000000001', 'Restaurant', 'restaurant',
     'Order from restaurants', 'restaurant', '#EA580C', 10, true, true),
    ('00000000-0000-4000-a000-000000000002', 'Grocery', 'grocery',
     'Shop supermarkets', 'basket', '#7C3AED', 20, true, true),
    ('00000000-0000-4000-a000-000000000003', 'Pharmacy', 'pharmacy',
     'Order medicines', 'pill', '#059669', 30, false, true);

-- ============================================================
-- 3. Add categoryId column on merchants (nullable for backfill)
-- ============================================================
ALTER TABLE "merchants" ADD COLUMN "categoryId" TEXT;

-- ============================================================
-- 4. Backfill categoryId from the existing MerchantType enum
-- ============================================================
UPDATE "merchants" SET "categoryId" = '00000000-0000-4000-a000-000000000001' WHERE "type" = 'RESTAURANT';
UPDATE "merchants" SET "categoryId" = '00000000-0000-4000-a000-000000000002' WHERE "type" = 'GROCERY';
UPDATE "merchants" SET "categoryId" = '00000000-0000-4000-a000-000000000003' WHERE "type" = 'PHARMACY';

-- Safety check: every merchant must have a category before we enforce NOT NULL
DO $$
DECLARE
    unmapped_count INT;
BEGIN
    SELECT COUNT(*) INTO unmapped_count FROM "merchants" WHERE "categoryId" IS NULL;
    IF unmapped_count > 0 THEN
        RAISE EXCEPTION 'Migration aborted: % merchant(s) have no categoryId after backfill. Investigate before continuing.', unmapped_count;
    END IF;
END $$;

-- ============================================================
-- 5. Enforce NOT NULL + FK + index on merchants.categoryId
-- ============================================================
ALTER TABLE "merchants" ALTER COLUMN "categoryId" SET NOT NULL;
ALTER TABLE "merchants"
    ADD CONSTRAINT "merchants_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "merchant_categories" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "merchants_categoryId_idx" ON "merchants" ("categoryId");

-- ============================================================
-- 6. Drop the old merchants.type column and its index
-- ============================================================
DROP INDEX IF EXISTS "merchants_type_idx";
ALTER TABLE "merchants" DROP COLUMN "type";

-- ============================================================
-- 7. Backfill Request.type: FOOD/GROCERY/PHARMACY -> MERCHANT_ORDER, PACKAGE stays
-- ============================================================
ALTER TABLE "requests" ADD COLUMN "type_new" TEXT;
UPDATE "requests" SET "type_new" = CASE
    WHEN "type" IN ('FOOD', 'GROCERY', 'PHARMACY') THEN 'MERCHANT_ORDER'
    WHEN "type" = 'PACKAGE' THEN 'PACKAGE'
    ELSE 'PACKAGE'  -- defensive fallback (should not happen)
END;

ALTER TABLE "requests" DROP COLUMN "type";
DROP TYPE "RequestType";
CREATE TYPE "RequestType" AS ENUM ('MERCHANT_ORDER', 'PACKAGE');

ALTER TABLE "requests" ADD COLUMN "type" "RequestType";
UPDATE "requests" SET "type" = "type_new"::"RequestType";
ALTER TABLE "requests" ALTER COLUMN "type" SET NOT NULL;
ALTER TABLE "requests" DROP COLUMN "type_new";

-- Restore the request type index that was implicitly dropped with the column
CREATE INDEX "requests_type_idx" ON "requests" ("type");

-- ============================================================
-- 8. Drop the old MerchantType enum
-- ============================================================
DROP TYPE "MerchantType";

COMMIT;

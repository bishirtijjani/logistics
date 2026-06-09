-- Backfill ProductVariant rows for every existing Product, and link existing
-- RequestItem rows to those default variants.
--
-- Rationale:
--   Phase 2 introduced ProductVariant as the SKU-level price/stock authority.
--   Existing Product rows have basePrice + stock at the product level; we
--   materialize those into one synthetic default variant per product (empty
--   attributes, no pack info) so the new variant-driven code paths work for
--   pre-migration products without code-time fallbacks.
--
-- Idempotency:
--   - Skips products that already have at least one variant.
--   - Skips request_items whose variantId is already populated.
--   - Safe to re-run.

-- 1) Create a default ProductVariant for each Product that has no variants yet.
INSERT INTO "product_variants" (
  "id",
  "productId",
  "sku",
  "attributes",
  "price",
  "stock",
  "imageUrl",
  "isAvailable",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  p."id",
  NULL,
  '{}'::jsonb,
  p."basePrice",
  p."stock",
  p."imageUrl",
  p."isAvailable",
  NOW(),
  NOW()
FROM "products" p
LEFT JOIN "product_variants" v ON v."productId" = p."id"
WHERE v."id" IS NULL;

-- 2) Backfill RequestItem.variantId for every row that lacks one.
-- Each RequestItem points at exactly one Product; we resolve to that
-- Product's default variant (the one we just created - or, if a product
-- already had variants pre-migration, the lowest-priced available variant).
WITH default_variants AS (
  SELECT DISTINCT ON (v."productId")
    v."productId",
    v."id" AS "variantId"
  FROM "product_variants" v
  ORDER BY v."productId", v."isAvailable" DESC, v."price" ASC, v."createdAt" ASC
)
UPDATE "request_items" ri
SET "variantId" = dv."variantId"
FROM default_variants dv
WHERE ri."productId" = dv."productId"
  AND ri."variantId" IS NULL;

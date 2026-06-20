-- AlRahuz (secondary provider) cost price for VTU plans.
-- The existing `costPrice` holds the primary (BilalSada) cost; this column holds
-- what AlRahuz charges for the same plan. Nullable: a plan that isn't priced for
-- AlRahuz simply has no alt cost. Selling price is provider-agnostic.
ALTER TABLE "vtu_plans" ADD COLUMN "altCostPrice" DECIMAL(15,2);

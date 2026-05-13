-- Disambiguate "merchant" across the schema.
--
-- The word "merchant" was overloaded across 3 unrelated concepts:
--   1. Actual business merchants (restaurants, supermarkets) — the legitimate
--      `Merchant` model and its relations. Left untouched.
--   2. Payment service providers (KatPay, AlRahuz) — renamed to "provider".
--   3. VTU billers (MTN, AEDC, IKEDC) — renamed to "biller".
--
-- This is a column/enum rename only — no data changes. ALTER TYPE ... RENAME
-- and ALTER TABLE ... RENAME COLUMN are catalog-only operations and do not
-- rewrite the table, so this is safe under concurrent writes.

-- 1. PaymentMerchant enum → PaymentProvider
ALTER TYPE "PaymentMerchant" RENAME TO "PaymentProvider";

-- 2. transactions.merchant → provider, transactions.merchantRef → providerRef
ALTER TABLE "transactions" RENAME COLUMN "merchant" TO "provider";
ALTER TABLE "transactions" RENAME COLUMN "merchantRef" TO "providerRef";

-- 3. utility_payments.merchant → biller (these hold "MTN", "AEDC", etc.)
ALTER TABLE "utility_payments" RENAME COLUMN "merchant" TO "biller";

-- 4. webhook_events.merchant → provider, and its compound index
ALTER TABLE "webhook_events" RENAME COLUMN "merchant" TO "provider";
ALTER INDEX "webhook_events_merchant_eventType_idx" RENAME TO "webhook_events_provider_eventType_idx";

-- CreateEnum
CREATE TYPE "UtilityFundingSource" AS ENUM ('USER_WALLET', 'MERCHANT_WALLET');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "transactionPinSetByUser" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "utility_payments" ADD COLUMN     "fundingSource" "UtilityFundingSource" NOT NULL DEFAULT 'USER_WALLET';

-- Backfill: existing CUSTOMER/RIDER who already have a PIN chose it themselves,
-- so mark it as user-set. MERCHANTs are left false because they were seeded with
-- the default '000000' (and we can't tell if they changed it) - leaving false
-- forces a real PIN before VTU spending, which is the desired security outcome.
UPDATE "users"
SET "transactionPinSetByUser" = true
WHERE "transactionPin" IS NOT NULL AND "role" <> 'MERCHANT';

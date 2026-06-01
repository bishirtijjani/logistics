/*
  Warnings:

  - You are about to drop the column `fundingSource` on the `utility_payments` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "utility_payments" DROP COLUMN "fundingSource";

-- DropEnum
DROP TYPE "UtilityFundingSource";

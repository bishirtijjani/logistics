-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TransactionType" ADD VALUE 'ESCROW_HOLD';
ALTER TYPE "TransactionType" ADD VALUE 'ESCROW_RELEASE';
ALTER TYPE "TransactionType" ADD VALUE 'ESCROW_REFUND';
ALTER TYPE "TransactionType" ADD VALUE 'PLATFORM_EARNING';
ALTER TYPE "TransactionType" ADD VALUE 'RIDER_EARNING';
ALTER TYPE "TransactionType" ADD VALUE 'MERCHANT_EARNING';

-- DropForeignKey
ALTER TABLE "commission_history" DROP CONSTRAINT "commission_history_merchantId_fkey";

-- DropForeignKey
ALTER TABLE "merchant_tags" DROP CONSTRAINT "merchant_tags_merchantId_fkey";

-- DropForeignKey
ALTER TABLE "merchant_tags" DROP CONSTRAINT "merchant_tags_tagId_fkey";

-- AlterTable
ALTER TABLE "commission_history" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "merchant_tags" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "requests" ADD COLUMN     "cancellationFee" DECIMAL(15,2),
ADD COLUMN     "escrowTransactionId" TEXT,
ADD COLUMN     "lastBroadcastAt" TIMESTAMP(3),
ADD COLUMN     "refundTransactionId" TEXT,
ADD COLUMN     "searchAttempts" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "tags" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "platform_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "key" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "system_wallets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idempotency_keys_userId_idx" ON "idempotency_keys"("userId");

-- CreateIndex
CREATE INDEX "idempotency_keys_expiresAt_idx" ON "idempotency_keys"("expiresAt");

-- AddForeignKey
ALTER TABLE "commission_history" ADD CONSTRAINT "commission_history_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_tags" ADD CONSTRAINT "merchant_tags_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_tags" ADD CONSTRAINT "merchant_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

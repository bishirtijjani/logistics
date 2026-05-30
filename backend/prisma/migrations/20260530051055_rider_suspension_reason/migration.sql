-- CreateEnum
CREATE TYPE "AirtimeToCashStatus" AS ENUM ('AWAITING_OTP', 'OTP_VERIFIED', 'PROCESSING', 'COMPLETED', 'FAILED', 'NEEDS_RECONCILIATION');

-- CreateEnum
CREATE TYPE "AirtimeNetwork" AS ENUM ('MTN', 'AIRTEL', 'GLO', 'NINEMOBILE');

-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'AIRTIME_TO_CASH';

-- DropIndex
DROP INDEX "merchants_name_trgm_idx";

-- DropIndex
DROP INDEX "products_name_trgm_idx";

-- AlterTable
ALTER TABLE "riders" ADD COLUMN     "suspensionReason" TEXT;

-- CreateTable
CREATE TABLE "airtime_to_cash_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "AirtimeToCashStatus" NOT NULL DEFAULT 'AWAITING_OTP',
    "network" "AirtimeNetwork" NOT NULL,
    "senderPhone" TEXT NOT NULL,
    "airtimeAmount" DECIMAL(15,2) NOT NULL,
    "payoutAmount" DECIMAL(15,2) NOT NULL,
    "payoutRate" DECIMAL(5,4) NOT NULL,
    "reference" TEXT NOT NULL,
    "providerSessionId" TEXT,
    "providerCode" INTEGER,
    "providerMessage" TEXT,
    "automationCharges" TEXT,
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "airtime_to_cash_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "airtime_to_cash_transactions_reference_key" ON "airtime_to_cash_transactions"("reference");

-- CreateIndex
CREATE INDEX "airtime_to_cash_transactions_userId_idx" ON "airtime_to_cash_transactions"("userId");

-- CreateIndex
CREATE INDEX "airtime_to_cash_transactions_status_idx" ON "airtime_to_cash_transactions"("status");

-- CreateIndex
CREATE INDEX "airtime_to_cash_transactions_createdAt_idx" ON "airtime_to_cash_transactions"("createdAt");

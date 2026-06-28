-- Cash-on-delivery for PACKAGE requests.
--
-- 1. New PaymentMethod enum + paymentMethod column on requests (defaults to
--    WALLET so every existing row keeps today's escrow behaviour).
-- 2. New CASH_COMMISSION TransactionType for the rider-wallet debit that
--    collects the platform's cut on a cash delivery.

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('WALLET', 'CASH');

-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'CASH_COMMISSION';

-- AlterTable
ALTER TABLE "requests" ADD COLUMN "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'WALLET';

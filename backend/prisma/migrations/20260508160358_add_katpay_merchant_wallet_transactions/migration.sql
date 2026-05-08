-- AlterEnum
ALTER TYPE "PaymentMerchant" ADD VALUE 'KATPAY';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "stock" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "merchant_wallet_transactions" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "merchantWalletId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "bankCode" TEXT,
    "accountNumber" TEXT,
    "accountName" TEXT,
    "katpayReference" TEXT,
    "rejectionReason" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "merchant_wallet_transactions_reference_key" ON "merchant_wallet_transactions"("reference");

-- CreateIndex
CREATE INDEX "merchant_wallet_transactions_merchantWalletId_status_idx" ON "merchant_wallet_transactions"("merchantWalletId", "status");

-- CreateIndex
CREATE INDEX "merchant_wallet_transactions_reference_idx" ON "merchant_wallet_transactions"("reference");

-- AddForeignKey
ALTER TABLE "merchant_wallet_transactions" ADD CONSTRAINT "merchant_wallet_transactions_merchantWalletId_fkey" FOREIGN KEY ("merchantWalletId") REFERENCES "merchant_wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

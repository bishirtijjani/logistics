-- AlterEnum
-- Paystack joins ALRAHUZ + KATPAY as a payment provider. Safe to add in this
-- transaction because the new value is not USED (as a default/cast) here.
ALTER TYPE "PaymentProvider" ADD VALUE 'PAYSTACK';

-- AlterTable
-- Paystack Dedicated Virtual Account linkage + a slot to retain the old KatPay
-- NUBAN so straggler transfers to it still resolve a wallet post-cutover.
ALTER TABLE "wallets" ADD COLUMN     "paystackCustomerCode" TEXT,
ADD COLUMN     "dedicatedAccountId" TEXT,
ADD COLUMN     "legacyKatpayAccountNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "wallets_paystackCustomerCode_key" ON "wallets"("paystackCustomerCode");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_legacyKatpayAccountNumber_key" ON "wallets"("legacyKatpayAccountNumber");

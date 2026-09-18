-- AlterTable
-- Saved beneficiary gains the gateway it was saved for and a cached Paystack
-- transfer recipient (RCP_...) so PAYSTACK-mode payouts don't re-create the
-- recipient on every withdrawal. Existing rows default to KATPAY; a Paystack
-- payout creates + caches the recipient on first use.
ALTER TABLE "saved_beneficiaries" ADD COLUMN     "provider" "PaymentProvider" NOT NULL DEFAULT 'KATPAY',
ADD COLUMN     "paystackRecipientCode" TEXT;

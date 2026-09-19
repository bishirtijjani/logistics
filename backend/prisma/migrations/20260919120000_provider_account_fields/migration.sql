-- Per-provider funding account fields: every wallet keeps BOTH a KatPay NUBAN and
-- a Paystack DVA. The app displays whichever provider is active; both stay valid.
ALTER TABLE "wallets"
  ADD COLUMN "paystackAccountNumber" TEXT,
  ADD COLUMN "paystackAccountBank" TEXT,
  ADD COLUMN "paystackAccountName" TEXT,
  ADD COLUMN "katpayAccountBank" TEXT,
  ADD COLUMN "katpayAccountName" TEXT;

CREATE UNIQUE INDEX "wallets_paystackAccountNumber_key" ON "wallets"("paystackAccountNumber");

-- Preserve existing KatPay numbers: wallets that predate Paystack hold their
-- KatPay NUBAN in virtualAccountNumber. Copy it into the explicit KatPay fields
-- so switching the displayed provider never loses the old number.
UPDATE "wallets"
SET "katpayAccountNumber" = "virtualAccountNumber",
    "katpayAccountBank" = "virtualAccountBank",
    "katpayAccountName" = "virtualAccountName"
WHERE "katpayAccountNumber" IS NULL
  AND "paystackCustomerCode" IS NULL
  AND "virtualAccountNumber" IS NOT NULL;

-- Wallets already on Paystack hold the DVA in virtualAccountNumber; record it in
-- the explicit Paystack fields.
UPDATE "wallets"
SET "paystackAccountNumber" = "virtualAccountNumber",
    "paystackAccountBank" = "virtualAccountBank",
    "paystackAccountName" = "virtualAccountName"
WHERE "paystackAccountNumber" IS NULL
  AND "paystackCustomerCode" IS NOT NULL
  AND "virtualAccountNumber" IS NOT NULL;

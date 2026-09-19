-- Rename the retained KatPay NUBAN column to neutral terminology (the column
-- holds a user's KatPay minted number kept after a Paystack DVA replaces it, so
-- a straggler transfer to the number saved in their bank app still credits).
-- Rename the matching unique index too, for consistency.
ALTER TABLE "wallets" RENAME COLUMN "legacyKatpayAccountNumber" TO "katpayAccountNumber";
ALTER INDEX "wallets_legacyKatpayAccountNumber_key" RENAME TO "wallets_katpayAccountNumber_key";
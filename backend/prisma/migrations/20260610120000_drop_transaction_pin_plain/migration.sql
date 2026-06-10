-- Remove the temporary plaintext-PIN testing column. Admins no longer view or
-- set PINs; they reset (clear) a customer's PIN, after which the user sets a
-- fresh one in-app. Storing plaintext PINs was a security liability.
ALTER TABLE "users" DROP COLUMN IF EXISTS "transactionPinPlain";

-- Soft-hide a corrected/erroneous ledger row (and its notice) from user-facing
-- views while keeping it in the database for audit, dispute handling and ledger
-- parity. Constant-default boolean -> fast, non-rewriting migration.
ALTER TABLE "transactions"
  ADD COLUMN "hiddenFromUser" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "notifications"
  ADD COLUMN "hiddenFromUser" BOOLEAN NOT NULL DEFAULT false;

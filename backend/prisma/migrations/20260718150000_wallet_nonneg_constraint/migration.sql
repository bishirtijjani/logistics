-- Backstop: a wallet balance can never be negative. This sits UNDER the
-- application-level guarded debits (conditional `updateMany ... WHERE balance >=
-- amount`) as a last line of defence against the concurrent-overdraw class of
-- bug that caused the 2026-07-18 fraud.
--
-- Idempotent: this constraint was added directly to the production DB as a
-- hotfix during the incident, so only create it if it isn't already present.
-- On a fresh database this creates it; on the patched prod DB it's a no-op.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wallet_balance_nonneg'
  ) THEN
    ALTER TABLE "wallets" ADD CONSTRAINT "wallet_balance_nonneg" CHECK ("balance" >= 0);
  END IF;
END $$;

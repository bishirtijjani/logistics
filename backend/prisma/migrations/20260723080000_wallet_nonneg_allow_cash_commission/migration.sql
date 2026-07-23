-- The cash-on-delivery commission debit (settleRequest, CASH branch) is
-- SUPPOSED to be able to take a rider's wallet negative: the rider already
-- collected the full fare in cash, so debiting the platform's commission is
-- the rider paying the platform back, not a spend - going negative means
-- "rider owes the platform", which correctly blocks them from new jobs until
-- they top up. The blanket wallet_balance_nonneg constraint (added
-- 2026-07-18 as a fraud backstop) doesn't distinguish that path from a real
-- overdraw attempt, so it silently rejects every cash settlement where the
-- rider's balance is near zero - permanently dead-lettering the settlement
-- job (see request #f1253896, 2026-07-22).
--
-- Fix: widen the check to also pass when the current transaction has opted
-- in via a `SET LOCAL app.allow_negative_wallet = 'on'` flag. Only the
-- cash-commission debit in settleRequest sets that flag, and only for the
-- duration of that one transaction (SET LOCAL reverts at COMMIT/ROLLBACK) -
-- every other debit path (VTU spend, withdrawals, wallet-payment orders,
-- utility payments) stays hard-blocked at >= 0 exactly as before.
--
-- COALESCE matters here: current_setting(..., true) returns NULL when unset,
-- and Postgres CHECK constraints treat a NULL result as "satisfied" - without
-- the COALESCE, an unset flag would silently accept ANY negative balance,
-- which is the opposite of what we want.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wallet_balance_nonneg'
  ) THEN
    ALTER TABLE "wallets" DROP CONSTRAINT "wallet_balance_nonneg";
  END IF;

  ALTER TABLE "wallets" ADD CONSTRAINT "wallet_balance_nonneg"
    CHECK (
      "balance" >= 0
      OR COALESCE(current_setting('app.allow_negative_wallet', true), 'off') = 'on'
    );
END $$;

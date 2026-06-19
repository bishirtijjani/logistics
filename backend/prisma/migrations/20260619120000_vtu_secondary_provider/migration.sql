-- Secondary VTU provider (AlRahuz) support.
--
-- The platform can now run two interchangeable VTU adapters at once: BilalSada
-- (primary) and AlRahuz (secondary). When admin enables "both" mode, a purchase
-- that BilalSada would have refunded is re-attempted on AlRahuz first so the
-- sale isn't lost. Each provider uses its own numeric network/plan IDs, so the
-- catalogue gains nullable `alt*` columns holding the AlRahuz IDs alongside the
-- existing BilalSada IDs. `utility_payments.provider` records which adapter
-- currently holds a payment so the async poll/reconcile loop queries the right
-- API. All columns are nullable / additive — no backfill needed; existing rows
-- keep the legacy single-provider behaviour until admin opts into "both".

-- AlterTable: record which provider served / holds each payment, plus the
-- per-provider numeric IDs so reconcile/sweep can also fail over to AlRahuz.
ALTER TABLE "utility_payments" ADD COLUMN "provider" "PaymentProvider";
ALTER TABLE "utility_payments" ADD COLUMN "providerIds" JSONB;

-- AlterTable: AlRahuz IDs on the plan catalogue (data/cable plan + network id).
ALTER TABLE "vtu_plans" ADD COLUMN "altProviderNetworkId" INTEGER;
ALTER TABLE "vtu_plans" ADD COLUMN "altProviderPlanId" INTEGER;

-- AlterTable: AlRahuz id on the network/cable/disco catalogue.
ALTER TABLE "vtu_networks" ADD COLUMN "altProviderNetworkId" INTEGER;

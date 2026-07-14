-- Per-plan provider toggles.
--
-- The global `vtu.providerMode` setting picks which providers are in play
-- (BilalSada only / AlRahuz only / both). These columns add granular control on
-- top of that: admin can switch a single catalogue item off on one provider
-- (e.g. AlRahuz's MTN 2GB is misvending) while everything else stays on. A
-- disabled provider is treated exactly like an unmapped one - skipped for both
-- the initial vend and failover. Defaults keep every existing row fully
-- enabled, so behaviour is unchanged until admin flips a toggle.

ALTER TABLE "vtu_plans" ADD COLUMN "providerEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "vtu_plans" ADD COLUMN "altProviderEnabled" BOOLEAN NOT NULL DEFAULT true;

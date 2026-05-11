-- Rename PaymentMerchant enum value VTPASS → ALRAHUZ.
-- The VTU provider was switched to AlRahuz; VTPASS was a stale name carried over from initial scaffolding.
-- Postgres supports ALTER TYPE ... RENAME VALUE since 10.

ALTER TYPE "PaymentMerchant" RENAME VALUE 'VTPASS' TO 'ALRAHUZ';

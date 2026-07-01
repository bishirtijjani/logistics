-- Add an UNDER_REVIEW state for utility payments whose provider outcome is
-- indeterminate (vend timed out, or BilalSada replied "request-id already
-- taken"). These payments are HELD for manual reconciliation and must never be
-- auto-refunded, because the sale very likely completed on the provider's side.
ALTER TYPE "UtilityStatus" ADD VALUE IF NOT EXISTS 'UNDER_REVIEW';

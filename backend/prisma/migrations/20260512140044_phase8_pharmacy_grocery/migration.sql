-- Phase 8 — Pharmacy & Grocery.
-- Adds a per-line grocery substitution preference and a request-level
-- prescription URL captured at checkout for pharmacy orders. Both are nullable
-- so existing rows (food, package, retail) are unaffected.

-- CreateEnum
CREATE TYPE "SubstitutionPreference" AS ENUM ('NONE', 'MERCHANT_PICK', 'CONTACT_ME');

-- AlterTable: per-line substitution preference for grocery merchants.
ALTER TABLE "request_items" ADD COLUMN "substitution" "SubstitutionPreference";

-- AlterTable: request-level prescription document (Cloudinary URL) for
-- pharmacy orders. Required server-side when any line product is flagged
-- `requiresPrescription`. Persisted as the audit trail of which physical
-- prescription the order was fulfilled against.
ALTER TABLE "requests" ADD COLUMN "prescriptionUrl" TEXT;

-- Drift sweep: these columns are already declared in schema.prisma
-- (Phase 7 utility hardening) but were never carried into a migration.
-- Adding them here keeps prisma migrate status clean. All nullable / defaulted
-- so live rows are unaffected.
ALTER TABLE "utility_payments" ADD COLUMN IF NOT EXISTS "beneficiaryName" TEXT;
ALTER TABLE "utility_payments" ADD COLUMN IF NOT EXISTS "lastPolledAt" TIMESTAMP(3);
ALTER TABLE "utility_payments" ADD COLUMN IF NOT EXISTS "pollAttempts" INTEGER NOT NULL DEFAULT 0;

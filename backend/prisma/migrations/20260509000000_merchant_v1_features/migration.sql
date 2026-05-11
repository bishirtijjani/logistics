-- Migration: Merchant V1 Features
-- Adds: CommissionHistory, Tag, MerchantTag models
-- Adds: isLocked, withdrawalHeld, withdrawalHoldReason to MerchantWallet
-- Adds: adminActiveOverride, suspensionReason, rejectionReason, phoneVerified to Merchant

-- ============================================================
-- MerchantWallet additions
-- ============================================================

ALTER TABLE "merchant_wallets"
  ADD COLUMN IF NOT EXISTS "isLocked"            BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "withdrawalHeld"       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "withdrawalHoldReason" TEXT;

-- ============================================================
-- Merchant additions
-- ============================================================

ALTER TABLE "merchants"
  ADD COLUMN IF NOT EXISTS "adminActiveOverride" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "suspensionReason"    TEXT,
  ADD COLUMN IF NOT EXISTS "rejectionReason"     TEXT,
  ADD COLUMN IF NOT EXISTS "phoneVerified"       BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- CommissionHistory
-- ============================================================

CREATE TABLE IF NOT EXISTS "commission_history" (
  "id"           TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "merchantId"   TEXT NOT NULL,
  "previousRate" DOUBLE PRECISION NOT NULL,
  "newRate"      DOUBLE PRECISION NOT NULL,
  "changedBy"    TEXT NOT NULL,
  "reason"       TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "commission_history_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "commission_history_merchantId_idx" ON "commission_history"("merchantId");
CREATE INDEX IF NOT EXISTS "commission_history_createdAt_idx" ON "commission_history"("createdAt");

-- ============================================================
-- Tag
-- ============================================================

CREATE TABLE IF NOT EXISTS "tags" (
  "id"        TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name"      TEXT NOT NULL,
  "slug"      TEXT NOT NULL,
  "category"  TEXT,
  "color"     TEXT,
  "icon"      TEXT,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "tags_name_key" ON "tags"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "tags_slug_key" ON "tags"("slug");
CREATE INDEX IF NOT EXISTS "tags_category_idx"  ON "tags"("category");
CREATE INDEX IF NOT EXISTS "tags_isActive_idx"  ON "tags"("isActive");

-- ============================================================
-- MerchantTag (join table)
-- ============================================================

CREATE TABLE IF NOT EXISTS "merchant_tags" (
  "id"         TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "merchantId" TEXT NOT NULL,
  "tagId"      TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "merchant_tags_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE,
  CONSTRAINT "merchant_tags_tagId_fkey"
    FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE,
  CONSTRAINT "merchant_tags_merchantId_tagId_key"
    UNIQUE("merchantId", "tagId")
);

CREATE INDEX IF NOT EXISTS "merchant_tags_merchantId_idx" ON "merchant_tags"("merchantId");
CREATE INDEX IF NOT EXISTS "merchant_tags_tagId_idx"      ON "merchant_tags"("tagId");

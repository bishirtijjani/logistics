-- Phase 6: saved addresses, banners, and pg_trgm-backed search.

-- ============================================================
-- Phase 6 also tightens the active-request banner query.
-- The Phase 4 (customerId, status) index supports the WHERE clause, but
-- `ORDER BY createdAt DESC LIMIT 1` still required a sort. Replacing with a
-- (customerId, status, createdAt DESC) index makes it a pure index scan.
-- ============================================================
DROP INDEX IF EXISTS "requests_customerId_status_idx";
CREATE INDEX "requests_customerId_status_createdAt_idx"
  ON "requests"("customerId", "status", "createdAt" DESC);

-- ============================================================
-- pg_trgm extension + GIN indexes for fuzzy `name` search.
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "merchants_name_trgm_idx"
  ON "merchants" USING GIN ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "products_name_trgm_idx"
  ON "products" USING GIN ("name" gin_trgm_ops);

-- ============================================================
-- SavedAddress
-- ============================================================
CREATE TABLE "saved_addresses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "placeId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_addresses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "saved_addresses_userId_idx" ON "saved_addresses"("userId");
CREATE INDEX "saved_addresses_userId_label_idx" ON "saved_addresses"("userId", "label");

-- Partial unique index enforces "at most one default address per user"
-- at the DB layer. Two concurrent createAddress(isDefault=true) calls can
-- both read the previous default as not-yet-flipped under READ COMMITTED
-- isolation; without this index they'd both succeed and leave the user with
-- two defaults. The index makes the second insert fail with a P2002 that
-- the service catches and retries.
CREATE UNIQUE INDEX "saved_addresses_userId_default_unique"
  ON "saved_addresses"("userId")
  WHERE "isDefault" = true;

ALTER TABLE "saved_addresses" ADD CONSTRAINT "saved_addresses_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- Banner
-- ============================================================
CREATE TABLE "banners" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "imageUrl" TEXT NOT NULL,
    "deepLink" TEXT,
    "bgColor" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "audience" JSONB,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "banners_isActive_startsAt_endsAt_idx" ON "banners"("isActive", "startsAt", "endsAt");
CREATE INDEX "banners_priority_idx" ON "banners"("priority");

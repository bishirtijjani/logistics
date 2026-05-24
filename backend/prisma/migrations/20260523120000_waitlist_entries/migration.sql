-- Pre-launch waitlist captured from the marketing website's "Download" CTAs.
-- The mobile apps are not yet in the App Store / Play Store; tapping
-- Download opens a modal that POSTs to /waitlist and persists here so
-- admins can export the list closer to launch.

-- CreateEnum
CREATE TYPE "WaitlistRole" AS ENUM ('CUSTOMER', 'RIDER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "WaitlistPlatform" AS ENUM ('IOS', 'ANDROID', 'UNKNOWN');

-- CreateTable
CREATE TABLE "waitlist_entries" (
    "id"        TEXT NOT NULL,
    "name"      VARCHAR(120) NOT NULL,
    "phone"     VARCHAR(20)  NOT NULL,
    "email"     VARCHAR(160),
    "city"      VARCHAR(80),
    "notes"     VARCHAR(1000),
    "role"      "WaitlistRole"     NOT NULL DEFAULT 'UNKNOWN',
    "platform"  "WaitlistPlatform" NOT NULL DEFAULT 'UNKNOWN',
    "source"    VARCHAR(255),
    "ipAddress" VARCHAR(64),
    "userAgent" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "waitlist_entries_role_idx"      ON "waitlist_entries"("role");
CREATE INDEX "waitlist_entries_phone_idx"     ON "waitlist_entries"("phone");
CREATE INDEX "waitlist_entries_createdAt_idx" ON "waitlist_entries"("createdAt");

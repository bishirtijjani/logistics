-- Multi-account / funding-ring review flags (advisory, non-blocking).

ALTER TABLE "users" ADD COLUMN "emailCanonical" TEXT;
ALTER TABLE "users" ADD COLUMN "reviewFlag" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "reviewReason" TEXT;
ALTER TABLE "users" ADD COLUMN "reviewFlaggedAt" TIMESTAMP(3);

CREATE INDEX "users_emailCanonical_idx" ON "users"("emailCanonical");
CREATE INDEX "users_reviewFlag_idx" ON "users"("reviewFlag");

-- Backfill canonical email for all existing users. MUST match the JS
-- canonicalizeEmail() logic exactly (lowercase+trim, strip +tag, gmail dots,
-- googlemail→gmail). Deleted-user sentinel addresses (no real '@domain') fall
-- through to the ELSE and stay harmless.
UPDATE "users" SET "emailCanonical" =
  CASE
    WHEN split_part(lower(btrim("email")), '@', 2) IN ('gmail.com', 'googlemail.com')
      THEN replace(split_part(split_part(lower(btrim("email")), '@', 1), '+', 1), '.', '') || '@gmail.com'
    ELSE split_part(split_part(lower(btrim("email")), '@', 1), '+', 1) || '@' || split_part(lower(btrim("email")), '@', 2)
  END
WHERE btrim("email") LIKE '%@%';

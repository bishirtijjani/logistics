-- Phase 7: Rider document expiry tracking + offer log for performance metrics.
--
-- (1) Document expiry — the rider app's KYC Status screen surfaces which
-- documents are valid, expiring soon, or expired, and the rider re-uploads
-- the ones that lapse. We store the expiry per-document; null = no expiry
-- on file (treated as "valid" but flagged in the UI for the rider to
-- update). A nightly cron (riderDocExpiryCheck) reads these columns to
-- push DOC_EXPIRING_SOON 14 days before expiry.
ALTER TABLE "riders"
  ADD COLUMN "idDocExpiresAt"         TIMESTAMP(3),
  ADD COLUMN "driverLicenceUrl"       TEXT,
  ADD COLUMN "driverLicenceExpiresAt" TIMESTAMP(3),
  ADD COLUMN "vehicleRegUrl"          TEXT,
  ADD COLUMN "vehicleRegExpiresAt"    TIMESTAMP(3),
  ADD COLUMN "vehicleDocExpiresAt"    TIMESTAMP(3),
  ADD COLUMN "insuranceDocUrl"        TEXT,
  ADD COLUMN "insuranceExpiresAt"     TIMESTAMP(3),
  ADD COLUMN "lastDocExpiryNoticeAt"  TIMESTAMP(3);

CREATE INDEX "riders_idDocExpiresAt_idx"      ON "riders"("idDocExpiresAt");
CREATE INDEX "riders_vehicleDocExpiresAt_idx" ON "riders"("vehicleDocExpiresAt");

-- (2) Rider offer log — every NEW_JOB broadcast lands a row so we can
-- compute acceptance rate cleanly (vs trying to reconstruct from the
-- in-memory ring set, which is Redis-only and short-lived). Outcomes:
--   OFFERED   — initial state when the offer was emitted
--   ACCEPTED  — this rider claimed the job
--   DECLINED  — rider explicitly declined (UI tap)
--   EXPIRED   — ring timeout passed without claim
--   TAKEN     — another rider claimed the job before this one could
-- The dispatcher worker writes OFFERED + flips others to TAKEN when the
-- claim lands; acceptJob flips this rider's row to ACCEPTED.
CREATE TYPE "RiderOfferOutcome" AS ENUM ('OFFERED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'TAKEN');

CREATE TABLE "rider_offer_logs" (
  "id"           TEXT NOT NULL,
  "riderId"      TEXT NOT NULL,
  "requestId"    TEXT NOT NULL,
  "outcome"      "RiderOfferOutcome" NOT NULL DEFAULT 'OFFERED',
  "ringAttempt"  INTEGER NOT NULL DEFAULT 0,
  "distanceKm"   DOUBLE PRECISION,
  "offeredAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt"  TIMESTAMP(3),
  CONSTRAINT "rider_offer_logs_pkey" PRIMARY KEY ("id")
);

-- One row per rider per request.
CREATE UNIQUE INDEX "rider_offer_logs_riderId_requestId_key"
  ON "rider_offer_logs"("riderId", "requestId");
CREATE INDEX "rider_offer_logs_riderId_offeredAt_idx"
  ON "rider_offer_logs"("riderId", "offeredAt" DESC);
CREATE INDEX "rider_offer_logs_requestId_idx"
  ON "rider_offer_logs"("requestId");

ALTER TABLE "rider_offer_logs"
  ADD CONSTRAINT "rider_offer_logs_riderId_fkey"
    FOREIGN KEY ("riderId") REFERENCES "riders"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rider_offer_logs"
  ADD CONSTRAINT "rider_offer_logs_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "requests"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Phase 5: Proof of Delivery on Request.
--
-- Photo is the baseline evidence (always required by default settings).
-- Signature is opt-in via `delivery.requireSignature` (default false).
-- OTP is a high-value safeguard — kicks in when Request.total clears
-- `delivery.podOtpThresholdNgn`. We store the bcrypt hash so a leaked DB
-- snapshot doesn't surrender the plaintext OTP.
--
-- All four columns nullable so:
--   - existing rows backfill cleanly (no historical POD to inject)
--   - non-POD requests (cancellations, etc.) never set them.
ALTER TABLE "requests"
  ADD COLUMN "podPhotoUrl"     TEXT,
  ADD COLUMN "podSignatureUrl" TEXT,
  ADD COLUMN "podDeliveryOtp"  TEXT,
  ADD COLUMN "podCapturedAt"   TIMESTAMP(3);

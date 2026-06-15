-- AlterEnum
-- VTU/bills provider switched from AlRahuz to BilalSadaSub. We ADD the new
-- value rather than rename ALRAHUZ so historical utility transactions keep
-- their original (accurate) provider label. New utility payments are written
-- with provider = 'BILALSADASUB'. Safe to add in this transaction because the
-- new value is not USED (as a default/cast) here.
ALTER TYPE "PaymentProvider" ADD VALUE 'BILALSADASUB';

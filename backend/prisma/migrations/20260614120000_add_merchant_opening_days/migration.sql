-- AlterTable
ALTER TABLE "merchants" ADD COLUMN "openingDays" TEXT[] NOT NULL DEFAULT ARRAY['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']::TEXT[];

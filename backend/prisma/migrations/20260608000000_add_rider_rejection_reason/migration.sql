-- Set when an admin rejects a rider application (via /riders/:id/review), so the
-- rider can see why in-app. Cleared when they re-upload a document (which also
-- re-queues them for review) or when they're approved.

-- AlterTable
ALTER TABLE "riders" ADD COLUMN     "rejectionReason" TEXT;

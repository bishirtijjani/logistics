-- Split the order chat into private 1:1 threads: customer<->rider,
-- customer<->merchant, rider<->merchant. RequestMessage previously had no
-- concept of who a message was addressed to - it was one shared group thread
-- per request, visible to all three stakeholders.
--
-- Existing rows predate this redesign and are disposed of outright (agreed
-- with product owner - they were test data from before any real merchant
-- chat consumer existed), rather than guessed into one of the new channels.
-- This is intentionally destructive; do not copy this DELETE pattern for a
-- migration that needs to preserve real user data.
DELETE FROM "request_messages";

-- CreateEnum
CREATE TYPE "RequestMessageChannel" AS ENUM ('CUSTOMER_RIDER', 'CUSTOMER_MERCHANT', 'RIDER_MERCHANT');

-- DropIndex
DROP INDEX "request_messages_requestId_createdAt_idx";

-- AlterTable
ALTER TABLE "request_messages" ADD COLUMN "channel" "RequestMessageChannel" NOT NULL;

-- CreateIndex
CREATE INDEX "request_messages_requestId_channel_createdAt_idx" ON "request_messages"("requestId", "channel", "createdAt");

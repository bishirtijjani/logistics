-- Per-participant read receipts for the private order threads.
-- `readAt` is NULL until the message's recipient opens the thread
-- (listMessages stamps it on fetch = opening the thread marks it read).
-- Drives the unread-chat badges in the customer and rider apps.

-- AlterTable
ALTER TABLE "request_messages" ADD COLUMN "readAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "request_messages_requestId_channel_fromUserId_readAt_idx" ON "request_messages"("requestId", "channel", "fromUserId", "readAt");

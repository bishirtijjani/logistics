-- Phase 4: RequestMessage table + covering index on Request(customerId, status)
-- for the active-request banner query.

CREATE TABLE "request_messages" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "body" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "request_messages_requestId_createdAt_idx" ON "request_messages"("requestId", "createdAt");
CREATE INDEX "request_messages_fromUserId_idx" ON "request_messages"("fromUserId");

ALTER TABLE "request_messages" ADD CONSTRAINT "request_messages_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "request_messages" ADD CONSTRAINT "request_messages_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Covering index for Phase 4 active-request banner query: Request.customerId + status filter
CREATE INDEX "requests_customerId_status_idx" ON "requests"("customerId", "status");

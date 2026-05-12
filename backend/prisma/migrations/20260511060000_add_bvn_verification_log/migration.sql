-- CreateEnum
CREATE TYPE "BvnVerificationOutcome" AS ENUM ('SUCCESS', 'FAILED', 'RECOVERY');

-- CreateTable
CREATE TABLE "bvn_verification_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bvnHash" TEXT NOT NULL,
    "outcome" "BvnVerificationOutcome" NOT NULL,
    "reason" TEXT,
    "providerRef" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bvn_verification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bvn_verification_logs_userId_idx" ON "bvn_verification_logs"("userId");

-- CreateIndex
CREATE INDEX "bvn_verification_logs_outcome_idx" ON "bvn_verification_logs"("outcome");

-- CreateIndex
CREATE INDEX "bvn_verification_logs_createdAt_idx" ON "bvn_verification_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "bvn_verification_logs" ADD CONSTRAINT "bvn_verification_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

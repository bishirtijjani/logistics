-- CreateTable
CREATE TABLE "discount_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "merchantId" TEXT,
    "type" TEXT NOT NULL,
    "discountPercentage" INTEGER,
    "discountAmount" DECIMAL(15,2),
    "value" DECIMAL(15,2) NOT NULL,
    "minOrder" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "maxDiscount" DECIMAL(15,2),
    "usageLimit" INTEGER NOT NULL DEFAULT 100,
    "used" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discount_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "budget" DECIMAL(15,2) NOT NULL,
    "spent" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "targetAudience" TEXT NOT NULL DEFAULT 'all',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "discount_codes_code_key" ON "discount_codes"("code");
CREATE INDEX "discount_codes_merchantId_idx" ON "discount_codes"("merchantId");
CREATE INDEX "discount_codes_code_idx" ON "discount_codes"("code");
CREATE INDEX "discount_codes_status_idx" ON "discount_codes"("status");

-- AddForeignKey
ALTER TABLE "discount_codes" ADD CONSTRAINT "discount_codes_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add discount columns to requests
ALTER TABLE "requests" ADD COLUMN "discountCodeId" TEXT;
ALTER TABLE "requests" ADD COLUMN "discountAmount" DECIMAL(15,2) NOT NULL DEFAULT 0;

-- AddForeignKey for requests to discount_codes
ALTER TABLE "requests" ADD CONSTRAINT "requests_discountCodeId_fkey" FOREIGN KEY ("discountCodeId") REFERENCES "discount_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

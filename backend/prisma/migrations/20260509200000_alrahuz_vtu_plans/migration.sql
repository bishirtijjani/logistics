-- AlterEnum: Add CABLE, EDUCATION_PIN to UtilityType
ALTER TYPE "UtilityType" ADD VALUE 'CABLE';
ALTER TYPE "UtilityType" ADD VALUE 'EDUCATION_PIN';

-- CreateEnum
CREATE TYPE "VtuPlanType" AS ENUM ('AIRTIME', 'DATA', 'CABLE', 'ELECTRICITY');

-- AlterTable: rename vtpass columns to provider columns
ALTER TABLE "utility_payments" RENAME COLUMN "vtpassRequestId" TO "providerRequestId";
ALTER TABLE "utility_payments" RENAME COLUMN "vtpassRef" TO "providerRef";

-- CreateTable
CREATE TABLE "vtu_plans" (
    "id" TEXT NOT NULL,
    "type" "VtuPlanType" NOT NULL,
    "providerNetworkId" INTEGER,
    "networkName" TEXT,
    "providerPlanId" INTEGER,
    "name" TEXT NOT NULL,
    "dataSize" TEXT,
    "validity" TEXT,
    "planType" TEXT,
    "costPrice" DECIMAL(15,2) NOT NULL,
    "sellingPrice" DECIMAL(15,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vtu_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vtu_plans_type_isActive_idx" ON "vtu_plans"("type", "isActive");

-- CreateIndex
CREATE INDEX "vtu_plans_providerNetworkId_type_idx" ON "vtu_plans"("providerNetworkId", "type");

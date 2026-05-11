-- AlterTable
ALTER TABLE "merchant_categories" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "deviceModel" TEXT,
ADD COLUMN     "deviceName" TEXT,
ADD COLUMN     "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "userAgent" TEXT;

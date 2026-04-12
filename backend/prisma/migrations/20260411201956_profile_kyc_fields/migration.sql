-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('NONE', 'PENDING', 'VERIFIED', 'FAILED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "address" TEXT,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "kycStatus" "KycStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "profilePicture" TEXT;

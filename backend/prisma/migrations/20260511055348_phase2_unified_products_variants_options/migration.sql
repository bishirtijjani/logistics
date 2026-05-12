/*
  Warnings:

  - You are about to drop the column `options` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `variations` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `deliveryOrderId` on the `ratings` table. All the data in the column will be lost.
  - You are about to drop the column `totalPrice` on the `request_items` table. All the data in the column will be lost.
  - You are about to drop the column `variations` on the `request_items` table. All the data in the column will be lost.
  - You are about to drop the `delivery_orders` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `requestId` on table `ratings` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `lineTotal` to the `request_items` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PackUnit" AS ENUM ('ML', 'L', 'G', 'KG', 'TABLET', 'CAPSULE', 'PIECE', 'PAIR', 'PACK', 'BOTTLE', 'SACHET', 'CARTON');

-- CreateEnum
CREATE TYPE "SelectionRule" AS ENUM ('REQUIRED_ONE', 'OPTIONAL_ONE', 'REQUIRED_MULTIPLE', 'OPTIONAL_MULTIPLE');

-- DropForeignKey
ALTER TABLE "delivery_orders" DROP CONSTRAINT "delivery_orders_customerId_fkey";

-- DropForeignKey
ALTER TABLE "delivery_orders" DROP CONSTRAINT "delivery_orders_riderId_fkey";

-- DropForeignKey
ALTER TABLE "ratings" DROP CONSTRAINT "ratings_deliveryOrderId_fkey";

-- DropForeignKey
ALTER TABLE "ratings" DROP CONSTRAINT "ratings_requestId_fkey";

-- DropIndex
DROP INDEX "ratings_deliveryOrderId_key";

-- AlterTable
ALTER TABLE "merchant_categories" ADD COLUMN     "attributeSchema" JSONB;

-- AlterTable
ALTER TABLE "products" DROP COLUMN "options",
DROP COLUMN "variations",
ADD COLUMN     "dosage" TEXT,
ADD COLUMN     "requiresPrescription" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ratings" DROP COLUMN "deliveryOrderId",
ALTER COLUMN "requestId" SET NOT NULL;

-- AlterTable
ALTER TABLE "request_items" DROP COLUMN "totalPrice",
DROP COLUMN "variations",
ADD COLUMN     "lineTotal" DECIMAL(15,2) NOT NULL,
ADD COLUMN     "selectedOptions" JSONB,
ADD COLUMN     "specialInstructions" TEXT,
ADD COLUMN     "variantId" TEXT;

-- DropTable
DROP TABLE "delivery_orders";

-- DropEnum
DROP TYPE "DeliveryStatus";

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "packSize" DECIMAL(15,4),
    "packUnit" "PackUnit",
    "packLabel" TEXT,
    "price" DECIMAL(15,2) NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_option_groups" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "selectionRule" "SelectionRule" NOT NULL,
    "minSelect" INTEGER NOT NULL DEFAULT 0,
    "maxSelect" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_option_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_option_items" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceDelta" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_option_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_variants_productId_idx" ON "product_variants"("productId");

-- CreateIndex
CREATE INDEX "product_variants_productId_isAvailable_idx" ON "product_variants"("productId", "isAvailable");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_productId_sku_key" ON "product_variants"("productId", "sku");

-- CreateIndex
CREATE INDEX "product_option_groups_productId_sortOrder_idx" ON "product_option_groups"("productId", "sortOrder");

-- CreateIndex
CREATE INDEX "product_option_items_groupId_sortOrder_idx" ON "product_option_items"("groupId", "sortOrder");

-- CreateIndex
CREATE INDEX "request_items_variantId_idx" ON "request_items"("variantId");

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_option_groups" ADD CONSTRAINT "product_option_groups_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_option_items" ADD CONSTRAINT "product_option_items_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "product_option_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_items" ADD CONSTRAINT "request_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

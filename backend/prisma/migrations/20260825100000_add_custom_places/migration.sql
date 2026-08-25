-- CreateTable
-- Admin-curated places that appear seamlessly alongside Google's own places
-- in maps autocomplete and as labelled markers on the customer/rider maps.
CREATE TABLE "custom_places" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "type" TEXT,
    "lga" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "address" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_places_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "custom_places_isActive_idx" ON "custom_places"("isActive");

-- CreateIndex
CREATE INDEX "custom_places_lat_lng_idx" ON "custom_places"("lat", "lng");

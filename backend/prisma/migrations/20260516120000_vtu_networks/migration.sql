-- Provider-agnostic catalogue of VTU networks (mobile networks, cable names,
-- electricity discos). Admin manages these from the dashboard so a change in
-- provider IDs (e.g. AlRahuz renumbers MTN from 1 → 100) no longer needs a
-- code deploy.
--
-- VtuPlan keeps its denormalized `providerNetworkId` + `networkName` fields.
-- They are kept in sync via a server-side sweep when admin edits a network.
-- Rationale: avoids a destructive FK migration; existing purchase queries
-- (utility.service.js) keep working unchanged.

-- CreateTable
CREATE TABLE "vtu_networks" (
    "id" TEXT NOT NULL,
    "type" "VtuPlanType" NOT NULL,
    "providerNetworkId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vtu_networks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vtu_networks_type_providerNetworkId_key" ON "vtu_networks"("type", "providerNetworkId");

-- CreateIndex
CREATE INDEX "vtu_networks_type_isActive_idx" ON "vtu_networks"("type", "isActive");

-- Backfill from existing distinct (type, providerNetworkId, networkName) in
-- vtu_plans. gen_random_uuid() requires pgcrypto, which is enabled on modern
-- Postgres by default; if not, the seed.js will recreate these rows.
INSERT INTO "vtu_networks" ("id", "type", "providerNetworkId", "name", "isActive", "sortOrder", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    "type",
    "providerNetworkId",
    COALESCE(MAX("networkName"), 'Unnamed'),
    true,
    0,
    NOW(),
    NOW()
FROM "vtu_plans"
WHERE "providerNetworkId" IS NOT NULL
GROUP BY "type", "providerNetworkId"
ON CONFLICT ("type", "providerNetworkId") DO NOTHING;

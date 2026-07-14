-- PackageDetail.description is optional in both the request validator and the
-- customer app ("What's inside?" may be left blank), but the column was NOT
-- NULL. A blank description omitted the field entirely, so packageDetail.create
-- threw "Argument `description` is missing" and 500'd every such order. Relax
-- the column to nullable to match the actual contract.
ALTER TABLE "package_details" ALTER COLUMN "description" DROP NOT NULL;

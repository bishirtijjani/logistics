-- AlterTable
-- Nullable permissions array for ADMIN role. NULL = legacy super admin (full access);
-- an explicit empty array [] means "no permissions". See User.permissions in schema.prisma.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "permissions" JSONB;

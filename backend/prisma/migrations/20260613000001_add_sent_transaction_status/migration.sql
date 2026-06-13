-- The payment worker claims a withdrawal/transfer by flipping PROCESSING -> SENT
-- BEFORE calling the KatPay payout (an at-most-once dispatch lock). SENT was used
-- in code but never added to the enum, so the Prisma client rejected the value and
-- every payout job threw before reaching KatPay - leaving transfers stuck in
-- PROCESSING with the wallet debited and no payout ever dispatched.
--
-- IF NOT EXISTS keeps this safe to (re-)apply on a DB where SENT was already added
-- by hand to stop the bleeding. (PostgreSQL 12+ allows ADD VALUE inside the
-- transaction Prisma wraps each migration in.)

-- AlterEnum
ALTER TYPE "TransactionStatus" ADD VALUE IF NOT EXISTS 'SENT';

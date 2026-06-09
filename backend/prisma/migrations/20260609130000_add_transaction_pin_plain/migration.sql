-- TEMPORARY testing aid: stores the last-set plaintext transaction PIN so admins
-- can debug PIN complaints during testing. Drop this column once testing is done.
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "transactionPinPlain" TEXT;

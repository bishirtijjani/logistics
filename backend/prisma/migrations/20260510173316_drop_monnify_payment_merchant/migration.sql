-- Drop MONNIFY from the PaymentMerchant enum.
-- Postgres doesn't support ALTER TYPE DROP VALUE, so we rebuild the enum.
-- Pre-condition: no rows in transactions.merchant currently equal MONNIFY (verified empty).

BEGIN;

ALTER TYPE "PaymentMerchant" RENAME TO "PaymentMerchant_old";

CREATE TYPE "PaymentMerchant" AS ENUM ('VTPASS', 'KATPAY');

-- Re-cast the column. Defensive: any stray MONNIFY rows are mapped to NULL rather than crashing.
ALTER TABLE "transactions"
    ALTER COLUMN "merchant" DROP DEFAULT,
    ALTER COLUMN "merchant" TYPE "PaymentMerchant"
    USING (
        CASE "merchant"::text
            WHEN 'MONNIFY' THEN NULL
            ELSE "merchant"::text::"PaymentMerchant"
        END
    );

DROP TYPE "PaymentMerchant_old";

COMMIT;

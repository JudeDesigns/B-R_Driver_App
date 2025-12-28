-- Migration: Add payment terms and delivery instructions to customers table
-- This allows setting default payment terms and delivery instructions per customer

-- Add payment terms column with default value
ALTER TABLE "customers" ADD COLUMN "paymentTerms" TEXT DEFAULT 'COD';

-- Add delivery instructions column
ALTER TABLE "customers" ADD COLUMN "deliveryInstructions" TEXT;

-- Add index for payment terms filtering
CREATE INDEX "customers_paymentTerms_idx" ON "customers"("paymentTerms");

-- Add partial unique index on email (only for non-empty emails)
-- This allows multiple customers with empty/null emails but enforces uniqueness for actual emails
DO $$
BEGIN
    -- Drop the constraint if it exists (in case it was added before)
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'customers_email_key'
    ) THEN
        ALTER TABLE "customers" DROP CONSTRAINT "customers_email_key";
    END IF;

    -- Drop the index if it exists (in case it was created before)
    IF EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'customers_email_unique_idx'
    ) THEN
        DROP INDEX "customers_email_unique_idx";
    END IF;
END $$;

-- Create partial unique index that only applies to non-empty emails
-- This allows multiple customers with NULL or empty string emails
CREATE UNIQUE INDEX "customers_email_unique_idx"
ON "customers"("email")
WHERE "email" IS NOT NULL AND "email" != '';


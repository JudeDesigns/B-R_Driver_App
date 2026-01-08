-- Migration: Add Credit Memo fields to Stop model and PURCHASE_ORDER to DocumentType enum
-- This enables credit memo tracking similar to invoice tracking

-- Add PURCHASE_ORDER to DocumentType enum
ALTER TYPE "DocumentType" ADD VALUE 'PURCHASE_ORDER';

-- Add Credit Memo fields to stops table
ALTER TABLE "stops" ADD COLUMN "creditMemoNumber" TEXT;
ALTER TABLE "stops" ADD COLUMN "creditMemoAmount" DOUBLE PRECISION;

-- Add comments for documentation
COMMENT ON COLUMN "stops"."creditMemoNumber" IS 'Credit Memo # from document upload';
COMMENT ON COLUMN "stops"."creditMemoAmount" IS 'Credit Memo amount from document upload';


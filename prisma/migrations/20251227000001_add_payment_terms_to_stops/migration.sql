-- Migration: Add payment terms to stops table
-- This allows individual stops to have their own payment terms that override customer defaults

-- Add paymentTerms column to stops
ALTER TABLE "stops" ADD COLUMN "paymentTerms" TEXT;

-- Add paymentTermsOther column for custom payment terms
ALTER TABLE "stops" ADD COLUMN "paymentTermsOther" TEXT;


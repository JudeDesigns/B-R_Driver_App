-- Migration: Add new document type variants
-- This expands the DocumentType enum with additional document categories

-- Add new variants to DocumentType enum
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'CUSTOMER_INVOICE';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'VENDOR_BILL_WORK_ORDER';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'GASOLINE_DIESEL_EXPENSE';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'DRIVER_WAREHOUSE_HOURS';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'SAFETY_DECLARATION';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'STATEMENT';


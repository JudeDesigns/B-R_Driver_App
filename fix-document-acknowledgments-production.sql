-- Fix document_acknowledgments table - Add missing columns
-- Run this on production database

-- Add routeId column (nullable, references routes table)
ALTER TABLE document_acknowledgments 
ADD COLUMN IF NOT EXISTS "routeId" TEXT;

-- Add userAgent column (nullable, for audit trail)
ALTER TABLE document_acknowledgments 
ADD COLUMN IF NOT EXISTS "userAgent" TEXT;

-- Drop the old unique constraint (documentId, driverId)
ALTER TABLE document_acknowledgments 
DROP CONSTRAINT IF EXISTS document_acknowledgments_documentId_driverId_key;

-- Add new unique constraint (documentId, driverId, routeId)
-- This allows same driver to acknowledge same document for different routes
ALTER TABLE document_acknowledgments 
ADD CONSTRAINT document_acknowledgments_documentId_driverId_routeId_key 
UNIQUE ("documentId", "driverId", "routeId");

-- Add index on routeId for performance
CREATE INDEX IF NOT EXISTS document_acknowledgments_routeId_idx 
ON document_acknowledgments("routeId");

-- Add foreign key constraint to routes table
ALTER TABLE document_acknowledgments 
ADD CONSTRAINT document_acknowledgments_routeId_fkey 
FOREIGN KEY ("routeId") REFERENCES routes(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'document_acknowledgments' 
ORDER BY ordinal_position;


-- Migration: Fix schema drift on document_acknowledgments table
-- The schema.prisma added routeId and userAgent fields + updated the unique constraint,
-- but no migration was ever created to apply these changes to the production database.
-- This migration syncs production to match the current schema.

-- Step 1: Add the missing columns
ALTER TABLE "document_acknowledgments" ADD COLUMN IF NOT EXISTS "routeId" TEXT;
ALTER TABLE "document_acknowledgments" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;

-- Step 2: Drop the old 2-field unique constraint
DROP INDEX IF EXISTS "document_acknowledgments_documentId_driverId_key";

-- Step 3: Create the new 3-field unique constraint (matches @@unique([documentId, driverId, routeId]))
CREATE UNIQUE INDEX "document_acknowledgments_documentId_driverId_routeId_key" 
    ON "document_acknowledgments"("documentId", "driverId", "routeId");

-- Step 4: Add the routeId index (matches @@index([routeId]))
CREATE INDEX IF NOT EXISTS "document_acknowledgments_routeId_idx" 
    ON "document_acknowledgments"("routeId");

-- Step 5: Add the foreign key relationship to routes table
ALTER TABLE "document_acknowledgments" ADD CONSTRAINT "document_acknowledgments_routeId_fkey" 
    FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

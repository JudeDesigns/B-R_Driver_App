-- ============================================================================
-- SAFE Credit Memo Duplicate Cleanup Script
-- ============================================================================
-- This script will:
-- 1. Show you what will be deleted (DRY RUN first)
-- 2. Mark duplicate credit memos as deleted (soft delete, not permanent)
-- 3. Add a unique constraint to prevent future duplicates
--
-- SAFETY FEATURES:
-- - Uses soft delete (isDeleted = true) - data is NOT permanently removed
-- - Keeps the OLDEST record for each documentId (most likely the correct one)
-- - You can undo by setting isDeleted back to false if needed
-- ============================================================================

-- ============================================================================
-- STEP 1: DRY RUN - See what will be marked as deleted
-- ============================================================================
-- Run this first to see which records will be affected
-- This does NOT make any changes, just shows you what would happen

SELECT 
  cm.id,
  cm."stopId",
  cm."creditMemoNumber",
  cm."creditMemoAmount",
  cm."documentId",
  cm."createdAt",
  s."customerNameFromUpload" as customer_name,
  CASE 
    WHEN ROW_NUMBER() OVER (PARTITION BY cm."documentId" ORDER BY cm."createdAt" ASC) = 1 
    THEN 'KEEP' 
    ELSE 'WILL BE DELETED' 
  END as action
FROM credit_memos cm
JOIN stops s ON cm."stopId" = s.id
WHERE cm."isDeleted" = false 
  AND cm."documentId" IS NOT NULL
ORDER BY cm."documentId", cm."createdAt";

-- ============================================================================
-- STEP 2: Count how many duplicates will be removed
-- ============================================================================
-- This shows you the summary of what will happen

SELECT 
  COUNT(*) as total_duplicates_to_remove
FROM (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY "documentId" ORDER BY "createdAt" ASC) as rn
  FROM credit_memos
  WHERE "isDeleted" = false AND "documentId" IS NOT NULL
) ranked
WHERE rn > 1;

-- ============================================================================
-- STEP 3: ACTUAL CLEANUP - Mark duplicates as deleted
-- ============================================================================
-- Only run this after reviewing the dry run results above
-- This will soft-delete duplicate credit memos, keeping only the oldest one

-- UNCOMMENT THE LINES BELOW TO RUN THE ACTUAL CLEANUP:

/*
BEGIN;

-- Mark duplicates as deleted
WITH ranked_memos AS (
  SELECT 
    id,
    "documentId",
    ROW_NUMBER() OVER (PARTITION BY "documentId" ORDER BY "createdAt" ASC) as rn
  FROM credit_memos
  WHERE "isDeleted" = false AND "documentId" IS NOT NULL
)
UPDATE credit_memos
SET "isDeleted" = true, "updatedAt" = NOW()
WHERE id IN (
  SELECT id FROM ranked_memos WHERE rn > 1
);

-- Show what was deleted
SELECT 
  COUNT(*) as records_marked_as_deleted
FROM credit_memos
WHERE "isDeleted" = true 
  AND "updatedAt" > NOW() - INTERVAL '1 minute';

COMMIT;
*/

-- ============================================================================
-- STEP 4: Add unique constraint to prevent future duplicates
-- ============================================================================
-- This creates a partial unique index that allows only one active credit memo
-- per document. Multiple deleted records are allowed.

-- UNCOMMENT THE LINE BELOW TO ADD THE CONSTRAINT:

/*
CREATE UNIQUE INDEX IF NOT EXISTS "credit_memos_documentId_unique_active" 
ON "credit_memos"("documentId") 
WHERE "isDeleted" = false AND "documentId" IS NOT NULL;
*/

-- ============================================================================
-- STEP 5: Verification - Check that duplicates are gone
-- ============================================================================
-- Run this after the cleanup to verify no duplicates remain

SELECT 
  "stopId",
  "creditMemoNumber",
  COUNT(*) as count
FROM credit_memos
WHERE "isDeleted" = false
GROUP BY "stopId", "creditMemoNumber"
HAVING COUNT(*) > 1;

-- Should return 0 rows if cleanup was successful

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (if you need to undo)
-- ============================================================================
-- If you need to restore the deleted records, run this:

/*
-- Find recently deleted credit memos
SELECT 
  id,
  "creditMemoNumber",
  "creditMemoAmount",
  "createdAt",
  "updatedAt"
FROM credit_memos
WHERE "isDeleted" = true 
  AND "updatedAt" > NOW() - INTERVAL '1 hour'
ORDER BY "updatedAt" DESC;

-- To restore them (BE CAREFUL - this will bring back duplicates):
UPDATE credit_memos
SET "isDeleted" = false, "updatedAt" = NOW()
WHERE "isDeleted" = true 
  AND "updatedAt" > NOW() - INTERVAL '1 hour';
*/


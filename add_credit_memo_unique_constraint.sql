-- ============================================================================
-- Add Unique Constraint to Prevent Duplicate Credit Memos
-- ============================================================================
-- This prevents the same credit memo number from being added multiple times
-- to the same stop, even if there are multiple documents
-- ============================================================================

-- First, verify there are no duplicates (should return 0 rows after cleanup)
SELECT 
  "stopId",
  "creditMemoNumber",
  COUNT(*) as count
FROM credit_memos
WHERE "isDeleted" = false
GROUP BY "stopId", "creditMemoNumber"
HAVING COUNT(*) > 1;

-- If the above returns 0 rows, proceed with adding the constraint:

-- Create a partial unique index that prevents duplicate credit memos
-- for the same stop + credit memo number combination
-- Only applies to non-deleted records
CREATE UNIQUE INDEX IF NOT EXISTS "credit_memos_stop_number_unique_active" 
ON "credit_memos"("stopId", "creditMemoNumber") 
WHERE "isDeleted" = false;

-- Verify the index was created
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'credit_memos'
  AND indexname = 'credit_memos_stop_number_unique_active';

-- ============================================================================
-- Test the constraint (optional)
-- ============================================================================
-- Try to insert a duplicate - this should fail with a unique constraint error
-- DO NOT RUN THIS - it's just to show what would happen:

/*
INSERT INTO credit_memos (
  id,
  "stopId",
  "creditMemoNumber",
  "creditMemoAmount",
  "createdAt",
  "updatedAt",
  "isDeleted"
) VALUES (
  gen_random_uuid(),
  'd39cbda0-7491-4d06-8ccf-f729ed373805',  -- Existing stop
  '95909',  -- Existing credit memo number
  40.00,
  NOW(),
  NOW(),
  false
);
-- This should fail with: ERROR: duplicate key value violates unique constraint
*/


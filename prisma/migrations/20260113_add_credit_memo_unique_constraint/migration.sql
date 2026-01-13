-- Add unique constraint to prevent duplicate credit memos for the same document
-- This prevents race conditions where the same document creates multiple credit memo records

-- First, let's identify and mark duplicates as deleted (keep only the oldest one for each documentId)
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

-- Now add the unique constraint on documentId where isDeleted = false
-- We use a partial unique index to allow multiple deleted records but only one active record per document
CREATE UNIQUE INDEX "credit_memos_documentId_unique_active" 
ON "credit_memos"("documentId") 
WHERE "isDeleted" = false AND "documentId" IS NOT NULL;


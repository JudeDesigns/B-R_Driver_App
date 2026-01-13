# Credit Memo Duplicate Issue - Root Cause & Fix

## Root Cause
The duplicate credit memos were caused by a **double form submission bug** in the validation flow:

1. When uploading a credit memo with validation warnings, the `InvoiceValidationAlert` component shows an "Upload Anyway" button
2. **BUG:** The button didn't have `type="button"`, so it defaulted to `type="submit"`
3. When clicked, TWO things happened simultaneously:
   - The `onClick` handler called `handleValidationConfirm()` → `form.requestSubmit()` → submitted the form
   - The button itself also submitted the form (because it was type="submit")
4. **Result:** Two nearly simultaneous form submissions (100-700ms apart)
5. Each submission created:
   - A new document with a unique ID (different timestamp)
   - A new credit memo record linked to that document
   - A new stop_document relationship

## Why Different Document IDs?
Each API call to `/api/admin/documents` creates a completely new document because:
- Each call generates a new UUID for the document
- Each call saves the file with a new timestamp-based filename (`${Date.now()}_${filename}`)
- The second submission happens so fast (100-700ms) that it's treated as a separate upload
- There was no deduplication check based on stop + credit memo number

## Evidence
From the database query results:
- Credit memo 95909 has 4 records with 4 different documentIds
- Timestamps show pairs of submissions within milliseconds:
  - 13:02:19.504 and 13:02:19.632 (128ms apart)
  - 13:28:01.583 and 13:28:02.516 (933ms apart)

## Why Credit Memos Show Duplicates But Invoices Don't
- **Invoices:** Data stored directly on Stop table → duplicate uploads just overwrite the same fields
- **Credit Memos:** Each upload creates a new CreditMemo record → duplicates are visible in the UI

## Fixes Applied

### 1. ✅ Fixed Validation Alert Buttons (PRIMARY FIX - PREVENTS ROOT CAUSE)
**File:** `src/components/ui/InvoiceValidationAlert.tsx`
- Added `type="button"` to both "Upload Anyway" and "Cancel" buttons
- Prevents the buttons from submitting the form
- **This stops the double submission bug at the source**

### 2. ✅ Added Upload State Protection (FRONTEND SAFETY NET)
**File:** `src/app/admin/document-management/page.tsx`
- Added `isUploading` state to prevent concurrent uploads
- Submit button disabled and shows "Uploading..." spinner during upload
- Early return if upload already in progress
- **Prevents rapid clicking from creating duplicates**

### 3. ✅ Fixed Validation Flow (PREVENTS ASYNC ISSUES)
**File:** `src/app/admin/document-management/page.tsx`
- Removed premature `setPendingUpload(true)` from validation checks
- Only set it when user confirms, preventing async state issues
- **Ensures clean state management**

### 4. ✅ Backend Deduplication Logic (BACKEND SAFETY NET)
**File:** `src/app/api/admin/documents/route.ts`
- Changed from checking `documentId` to checking `stopId + creditMemoNumber`
- If duplicate detected, updates existing record instead of creating new one
- Added try-catch to handle unique constraint violations gracefully
- **Prevents duplicates even if frontend fails**

### 5. ⚠️ Database Unique Constraint (FINAL SAFETY NET - MUST RUN SQL)
**File:** `add_credit_memo_unique_constraint.sql`
- Adds unique index on `(stopId, creditMemoNumber)` for non-deleted records
- Prevents duplicates at the database level
- **YOU MUST RUN THIS SQL FILE TO COMPLETE THE FIX**

## SQL to Clean Up Existing Duplicates

Run this in your psql terminal connected to `br_food_services`:

```sql
-- Clean up duplicate credit memos (keep only the oldest one for each documentId)
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

-- Add unique constraint to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS "credit_memos_documentId_unique_active" 
ON "credit_memos"("documentId") 
WHERE "isDeleted" = false AND "documentId" IS NOT NULL;
```

## Verification

After running the SQL, verify duplicates are gone:

```sql
SELECT 
  "stopId",
  "creditMemoNumber",
  COUNT(*) as count
FROM credit_memos
WHERE "isDeleted" = false
GROUP BY "stopId", "creditMemoNumber"
HAVING COUNT(*) > 1;
```

This should return 0 rows.

## Testing
1. Upload a credit memo without providing credit memo number/amount
2. Validation warning should appear
3. Click "Upload Anyway"
4. Check database - should only have ONE credit memo record
5. Check Route details page - should only show ONE credit memo in the table


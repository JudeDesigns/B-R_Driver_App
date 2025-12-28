-- Force Fix Customer Email Constraint
-- This is a more aggressive version that handles all edge cases

-- ============================================
-- Step 1: Show current state
-- ============================================

\echo '========================================='
\echo 'Current email constraints:'
\echo '========================================='

SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'customers'::regclass 
  AND (conname LIKE '%email%' OR pg_get_constraintdef(oid) LIKE '%email%');

\echo ''
\echo 'Current email indexes:'

SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'customers' 
  AND (indexname LIKE '%email%' OR indexdef LIKE '%email%');

\echo ''
\echo '========================================='
\echo 'Applying fixes...'
\echo '========================================='

-- ============================================
-- Step 2: Drop ALL email-related constraints and indexes
-- ============================================

-- Drop any unique constraint on email
DROP INDEX IF EXISTS "customers_email_key" CASCADE;
ALTER TABLE "customers" DROP CONSTRAINT IF EXISTS "customers_email_key" CASCADE;

-- Drop any existing partial index (in case it was created incorrectly)
DROP INDEX IF EXISTS "customers_email_unique_idx" CASCADE;

-- Drop any other email indexes
DROP INDEX IF EXISTS "customers_email_idx" CASCADE;

\echo '✓ Dropped all existing email constraints and indexes'

-- ============================================
-- Step 3: Create the correct partial unique index
-- ============================================

CREATE UNIQUE INDEX "customers_email_unique_idx" 
ON "customers"("email") 
WHERE "email" IS NOT NULL AND "email" != '';

\echo '✓ Created partial unique index on email'
\echo '  - Allows multiple NULL or empty emails'
\echo '  - Enforces uniqueness for actual email addresses'

-- ============================================
-- Step 4: Verify the fix
-- ============================================

\echo ''
\echo '========================================='
\echo 'Verification:'
\echo '========================================='

SELECT 
    COUNT(*) as total_customers,
    COUNT(CASE WHEN email IS NULL OR email = '' THEN 1 END) as empty_emails,
    COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END) as with_emails
FROM customers;

\echo ''
\echo 'Email constraints after fix:'

SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'customers'::regclass 
  AND (conname LIKE '%email%' OR pg_get_constraintdef(oid) LIKE '%email%');

\echo ''
\echo 'Email indexes after fix:'

SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'customers' 
  AND (indexname LIKE '%email%' OR indexdef LIKE '%email%');

\echo ''
\echo '========================================='
\echo '✓ Done!'
\echo '========================================='


-- Fix Customer Email Constraint
-- This script removes the old unique constraint and adds a partial unique index
-- that allows multiple empty emails but enforces uniqueness for actual email addresses

-- ============================================
-- Step 1: Check current constraints
-- ============================================

DO $$
DECLARE
    constraint_exists BOOLEAN;
    index_exists BOOLEAN;
BEGIN
    RAISE NOTICE 'Checking current email constraints...';
    
    -- Check if old unique constraint exists
    SELECT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'customers_email_key' 
        AND conrelid = 'customers'::regclass
    ) INTO constraint_exists;
    
    -- Check if new partial index exists
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'customers_email_unique_idx'
    ) INTO index_exists;
    
    IF constraint_exists THEN
        RAISE NOTICE '✗ Old unique constraint exists (will be removed)';
    ELSE
        RAISE NOTICE '✓ Old unique constraint does not exist';
    END IF;
    
    IF index_exists THEN
        RAISE NOTICE '✓ New partial unique index already exists';
    ELSE
        RAISE NOTICE '✗ New partial unique index does not exist (will be created)';
    END IF;
END $$;

-- ============================================
-- Step 2: Remove old unique constraint
-- ============================================

DO $$
BEGIN
    -- Drop the old unique constraint if it exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'customers_email_key' 
        AND conrelid = 'customers'::regclass
    ) THEN
        ALTER TABLE "customers" DROP CONSTRAINT "customers_email_key";
        RAISE NOTICE '✓ Removed old unique constraint on email';
    ELSE
        RAISE NOTICE '✓ Old unique constraint already removed';
    END IF;
END $$;

-- ============================================
-- Step 3: Create partial unique index
-- ============================================

DO $$
BEGIN
    -- Create partial unique index if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'customers_email_unique_idx'
    ) THEN
        CREATE UNIQUE INDEX "customers_email_unique_idx" 
        ON "customers"("email") 
        WHERE "email" IS NOT NULL AND "email" != '';
        
        RAISE NOTICE '✓ Created partial unique index on email';
        RAISE NOTICE '  - Allows multiple NULL or empty emails';
        RAISE NOTICE '  - Enforces uniqueness for actual email addresses';
    ELSE
        RAISE NOTICE '✓ Partial unique index already exists';
    END IF;
END $$;

-- ============================================
-- Step 4: Verify the fix
-- ============================================

DO $$
DECLARE
    empty_email_count INTEGER;
    duplicate_emails INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE 'Verification:';
    
    -- Count customers with empty emails
    SELECT COUNT(*) INTO empty_email_count
    FROM customers 
    WHERE email IS NULL OR email = '';
    
    RAISE NOTICE '  - Customers with empty emails: %', empty_email_count;
    
    -- Check for duplicate non-empty emails
    SELECT COUNT(*) INTO duplicate_emails
    FROM (
        SELECT email, COUNT(*) as cnt
        FROM customers
        WHERE email IS NOT NULL AND email != ''
        GROUP BY email
        HAVING COUNT(*) > 1
    ) duplicates;
    
    IF duplicate_emails > 0 THEN
        RAISE WARNING '  ⚠️  Found % duplicate email addresses!', duplicate_emails;
        RAISE WARNING '  You need to fix these before the unique index will work properly';
    ELSE
        RAISE NOTICE '  ✓ No duplicate email addresses found';
    END IF;
END $$;

-- ============================================
-- Done!
-- ============================================

SELECT 'Customer email constraint fixed!' AS status;


-- Fix Customer isDeleted NULL values
-- This script fixes the root cause of the customer search issue

-- 1. Check current state
SELECT 
    COUNT(*) as total_customers,
    COUNT(CASE WHEN "isDeleted" = true THEN 1 END) as deleted_customers,
    COUNT(CASE WHEN "isDeleted" = false THEN 1 END) as active_customers,
    COUNT(CASE WHEN "isDeleted" IS NULL THEN 1 END) as null_customers
FROM customers;

-- 2. Show sample customers with NULL isDeleted
SELECT id, name, "isDeleted" 
FROM customers 
WHERE "isDeleted" IS NULL 
LIMIT 10;

-- 3. Fix NULL values by setting them to false (active)
UPDATE customers 
SET "isDeleted" = false 
WHERE "isDeleted" IS NULL;

-- 4. Verify the fix
SELECT 
    COUNT(*) as total_customers,
    COUNT(CASE WHEN "isDeleted" = true THEN 1 END) as deleted_customers,
    COUNT(CASE WHEN "isDeleted" = false THEN 1 END) as active_customers,
    COUNT(CASE WHEN "isDeleted" IS NULL THEN 1 END) as null_customers
FROM customers;

-- 5. Add NOT NULL constraint to prevent future NULL values
ALTER TABLE customers 
ALTER COLUMN "isDeleted" SET NOT NULL;

-- 6. Test a sample search query
SELECT id, name, email, "isDeleted"
FROM customers 
WHERE "isDeleted" = false 
AND name ILIKE '%caf%'
LIMIT 5;

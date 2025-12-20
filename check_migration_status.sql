-- Check if migration was applied
SELECT migration_name, finished_at, applied_steps_count 
FROM _prisma_migrations 
WHERE migration_name = '20251220060000_fix_missing_columns';

-- Check if vehicles table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'vehicles';

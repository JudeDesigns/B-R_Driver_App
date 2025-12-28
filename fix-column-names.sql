-- Fix Column Names in Production Database
-- This script renames columns to match schema.prisma

-- ============================================
-- Fix daily_kpis table
-- ============================================

-- Check if table exists first
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_kpis') THEN
        
        -- Rename columns if they exist with wrong names
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_kpis' AND column_name='amountDelivered') THEN
            ALTER TABLE daily_kpis RENAME COLUMN "amountDelivered" TO "totalDelivered";
            RAISE NOTICE 'Renamed amountDelivered to totalDelivered';
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_kpis' AND column_name='totalStops') THEN
            ALTER TABLE daily_kpis RENAME COLUMN "totalStops" TO "stopsTotal";
            RAISE NOTICE 'Renamed totalStops to stopsTotal';
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_kpis' AND column_name='startTime') THEN
            ALTER TABLE daily_kpis RENAME COLUMN "startTime" TO "timeStart";
            RAISE NOTICE 'Renamed startTime to timeStart';
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_kpis' AND column_name='endTime') THEN
            ALTER TABLE daily_kpis RENAME COLUMN "endTime" TO "timeEnd";
            RAISE NOTICE 'Renamed endTime to timeEnd';
        END IF;
        
        -- Add missing columns if they don't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_kpis' AND column_name='milesStart') THEN
            ALTER TABLE daily_kpis ADD COLUMN "milesStart" DOUBLE PRECISION;
            RAISE NOTICE 'Added milesStart column';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_kpis' AND column_name='milesEnd') THEN
            ALTER TABLE daily_kpis ADD COLUMN "milesEnd" DOUBLE PRECISION;
            RAISE NOTICE 'Added milesEnd column';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_kpis' AND column_name='milesDriven') THEN
            ALTER TABLE daily_kpis ADD COLUMN "milesDriven" DOUBLE PRECISION;
            RAISE NOTICE 'Added milesDriven column';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_kpis' AND column_name='totalTime') THEN
            ALTER TABLE daily_kpis ADD COLUMN "totalTime" INTEGER;
            RAISE NOTICE 'Added totalTime column';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_kpis' AND column_name='isDeleted') THEN
            ALTER TABLE daily_kpis ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;
            RAISE NOTICE 'Added isDeleted column';
        END IF;
        
        -- Drop extra columns if they exist
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_kpis' AND column_name='totalAmount') THEN
            ALTER TABLE daily_kpis DROP COLUMN "totalAmount";
            RAISE NOTICE 'Dropped totalAmount column';
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_kpis' AND column_name='returnsCount') THEN
            ALTER TABLE daily_kpis DROP COLUMN "returnsCount";
            RAISE NOTICE 'Dropped returnsCount column';
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_kpis' AND column_name='onTimeDeliveries') THEN
            ALTER TABLE daily_kpis DROP COLUMN "onTimeDeliveries";
            RAISE NOTICE 'Dropped onTimeDeliveries column';
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_kpis' AND column_name='lateDeliveries') THEN
            ALTER TABLE daily_kpis DROP COLUMN "lateDeliveries";
            RAISE NOTICE 'Dropped lateDeliveries column';
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_kpis' AND column_name='averageStopTime') THEN
            ALTER TABLE daily_kpis DROP COLUMN "averageStopTime";
            RAISE NOTICE 'Dropped averageStopTime column';
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_kpis' AND column_name='totalDistance') THEN
            ALTER TABLE daily_kpis DROP COLUMN "totalDistance";
            RAISE NOTICE 'Dropped totalDistance column';
        END IF;
        
        RAISE NOTICE 'daily_kpis table fixed successfully!';
    ELSE
        RAISE NOTICE 'daily_kpis table does not exist - skipping';
    END IF;
END $$;

-- ============================================
-- Fix system_documents table
-- ============================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_documents') THEN
        
        -- Rename type to documentType
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='system_documents' AND column_name='type') THEN
            ALTER TABLE system_documents RENAME COLUMN "type" TO "documentType";
            RAISE NOTICE 'Renamed type to documentType';
        END IF;
        
        -- Drop extra columns if they exist
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='system_documents' AND column_name='version') THEN
            ALTER TABLE system_documents DROP COLUMN "version";
            RAISE NOTICE 'Dropped version column';
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='system_documents' AND column_name='effectiveDate') THEN
            ALTER TABLE system_documents DROP COLUMN "effectiveDate";
            RAISE NOTICE 'Dropped effectiveDate column';
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='system_documents' AND column_name='expiryDate') THEN
            ALTER TABLE system_documents DROP COLUMN "expiryDate";
            RAISE NOTICE 'Dropped expiryDate column';
        END IF;
        
        RAISE NOTICE 'system_documents table fixed successfully!';
    ELSE
        RAISE NOTICE 'system_documents table does not exist - skipping';
    END IF;
END $$;

-- ============================================
-- Done!
-- ============================================
SELECT 'Column name fixes completed!' AS status;


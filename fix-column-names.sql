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
-- Create missing tables from migration #10
-- ============================================

DO $$
BEGIN
    -- Create document_acknowledgments table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'document_acknowledgments') THEN
        CREATE TABLE "document_acknowledgments" (
            "id" TEXT NOT NULL,
            "documentId" TEXT NOT NULL,
            "driverId" TEXT NOT NULL,
            "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "ipAddress" TEXT,
            "userAgent" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,

            CONSTRAINT "document_acknowledgments_pkey" PRIMARY KEY ("id")
        );

        CREATE INDEX "document_acknowledgments_documentId_idx" ON "document_acknowledgments"("documentId");
        CREATE INDEX "document_acknowledgments_driverId_idx" ON "document_acknowledgments"("driverId");
        CREATE INDEX "document_acknowledgments_acknowledgedAt_idx" ON "document_acknowledgments"("acknowledgedAt");
        CREATE UNIQUE INDEX "document_acknowledgments_documentId_driverId_key" ON "document_acknowledgments"("documentId", "driverId");

        ALTER TABLE "document_acknowledgments" ADD CONSTRAINT "document_acknowledgments_documentId_fkey"
            FOREIGN KEY ("documentId") REFERENCES "system_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

        ALTER TABLE "document_acknowledgments" ADD CONSTRAINT "document_acknowledgments_driverId_fkey"
            FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

        RAISE NOTICE 'Created document_acknowledgments table';
    ELSE
        RAISE NOTICE 'document_acknowledgments table already exists - skipping';
    END IF;

    -- Create safety_declarations table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'safety_declarations') THEN
        CREATE TABLE "safety_declarations" (
            "id" TEXT NOT NULL,
            "driverId" TEXT NOT NULL,
            "routeId" TEXT,
            "declarationType" TEXT NOT NULL,
            "declarationText" TEXT NOT NULL,
            "acknowledged" BOOLEAN NOT NULL DEFAULT false,
            "acknowledgedAt" TIMESTAMP(3),
            "signature" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            "isDeleted" BOOLEAN NOT NULL DEFAULT false,

            CONSTRAINT "safety_declarations_pkey" PRIMARY KEY ("id")
        );

        CREATE INDEX "safety_declarations_driverId_idx" ON "safety_declarations"("driverId");
        CREATE INDEX "safety_declarations_routeId_idx" ON "safety_declarations"("routeId");
        CREATE INDEX "safety_declarations_declarationType_idx" ON "safety_declarations"("declarationType");
        CREATE INDEX "safety_declarations_acknowledgedAt_idx" ON "safety_declarations"("acknowledgedAt");
        CREATE INDEX "safety_declarations_isDeleted_idx" ON "safety_declarations"("isDeleted");

        ALTER TABLE "safety_declarations" ADD CONSTRAINT "safety_declarations_driverId_fkey"
            FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

        ALTER TABLE "safety_declarations" ADD CONSTRAINT "safety_declarations_routeId_fkey"
            FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

        RAISE NOTICE 'Created safety_declarations table';
    ELSE
        RAISE NOTICE 'safety_declarations table already exists - skipping';
    END IF;
END $$;

-- ============================================
-- Done!
-- ============================================
SELECT 'Column name fixes and missing tables completed!' AS status;


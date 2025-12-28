-- Create Missing Tables for System Documents Feature
-- This script ONLY creates tables that don't exist - 100% safe to run

-- ============================================
-- Create document_acknowledgments table
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'document_acknowledgments') THEN
        
        RAISE NOTICE 'Creating document_acknowledgments table...';
        
        CREATE TABLE "document_acknowledgments" (
            "id" TEXT NOT NULL,
            "documentId" TEXT NOT NULL,
            "driverId" TEXT NOT NULL,
            "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "ipAddress" TEXT,
            "userAgent" TEXT,

            CONSTRAINT "document_acknowledgments_pkey" PRIMARY KEY ("id")
        );

        -- Create indexes
        CREATE INDEX "document_acknowledgments_documentId_idx" ON "document_acknowledgments"("documentId");
        CREATE INDEX "document_acknowledgments_driverId_idx" ON "document_acknowledgments"("driverId");
        CREATE INDEX "document_acknowledgments_acknowledgedAt_idx" ON "document_acknowledgments"("acknowledgedAt");
        CREATE UNIQUE INDEX "document_acknowledgments_documentId_driverId_key" ON "document_acknowledgments"("documentId", "driverId");

        -- Add foreign keys
        ALTER TABLE "document_acknowledgments" ADD CONSTRAINT "document_acknowledgments_documentId_fkey" 
            FOREIGN KEY ("documentId") REFERENCES "system_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

        ALTER TABLE "document_acknowledgments" ADD CONSTRAINT "document_acknowledgments_driverId_fkey" 
            FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

        RAISE NOTICE '✓ document_acknowledgments table created successfully!';
        
    ELSE
        RAISE NOTICE '✓ document_acknowledgments table already exists - skipping';
    END IF;
END $$;

-- ============================================
-- Create safety_declarations table
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'safety_declarations') THEN
        
        RAISE NOTICE 'Creating safety_declarations table...';
        
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

        -- Create indexes
        CREATE INDEX "safety_declarations_driverId_idx" ON "safety_declarations"("driverId");
        CREATE INDEX "safety_declarations_routeId_idx" ON "safety_declarations"("routeId");
        CREATE INDEX "safety_declarations_declarationType_idx" ON "safety_declarations"("declarationType");
        CREATE INDEX "safety_declarations_acknowledgedAt_idx" ON "safety_declarations"("acknowledgedAt");
        CREATE INDEX "safety_declarations_isDeleted_idx" ON "safety_declarations"("isDeleted");

        -- Add foreign keys
        ALTER TABLE "safety_declarations" ADD CONSTRAINT "safety_declarations_driverId_fkey" 
            FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

        ALTER TABLE "safety_declarations" ADD CONSTRAINT "safety_declarations_routeId_fkey" 
            FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

        RAISE NOTICE '✓ safety_declarations table created successfully!';
        
    ELSE
        RAISE NOTICE '✓ safety_declarations table already exists - skipping';
    END IF;
END $$;

-- ============================================
-- Done!
-- ============================================

SELECT 'Missing tables created successfully!' AS status;


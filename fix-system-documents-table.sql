-- Fix or Create system_documents Table Properly
-- This script will drop and recreate the table if it's broken

-- ============================================
-- Step 1: Create required enums if missing
-- ============================================

DO $$
BEGIN
    -- Create DocumentCategory enum if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DocumentCategory') THEN
        CREATE TYPE "DocumentCategory" AS ENUM ('SAFETY', 'COMPLIANCE', 'TRAINING', 'POLICY', 'PROCEDURE', 'OTHER');
        RAISE NOTICE 'Created DocumentCategory enum';
    ELSE
        RAISE NOTICE 'DocumentCategory enum already exists';
    END IF;

    -- Create SystemDocumentType enum if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SystemDocumentType') THEN
        CREATE TYPE "SystemDocumentType" AS ENUM ('SAFETY_POLICY', 'TRAINING_MATERIAL', 'COMPLIANCE_DOC', 'PROCEDURE', 'HANDBOOK', 'OTHER');
        RAISE NOTICE 'Created SystemDocumentType enum';
    ELSE
        RAISE NOTICE 'SystemDocumentType enum already exists';
    END IF;
END $$;

-- ============================================
-- Step 2: Drop and recreate system_documents table
-- ============================================

DO $$
BEGIN
    -- Check if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_documents') THEN
        
        RAISE NOTICE 'system_documents table exists - checking structure...';
        
        -- Check if it has the correct columns
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='system_documents' AND column_name='title') THEN
            RAISE NOTICE 'Table has wrong structure - will drop and recreate';
            
            -- Drop foreign key constraints first
            ALTER TABLE IF EXISTS document_acknowledgments DROP CONSTRAINT IF EXISTS document_acknowledgments_documentId_fkey;
            
            -- Drop the table
            DROP TABLE IF EXISTS system_documents CASCADE;
            RAISE NOTICE 'Dropped broken system_documents table';
        ELSE
            RAISE NOTICE 'Table structure looks correct - skipping recreation';
            RETURN;
        END IF;
    END IF;

    -- Create the table with correct structure
    RAISE NOTICE 'Creating system_documents table...';
    
    CREATE TABLE "system_documents" (
        "id" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "description" TEXT,
        "documentType" "SystemDocumentType" NOT NULL,
        "category" "DocumentCategory" NOT NULL,
        "filePath" TEXT NOT NULL,
        "fileName" TEXT NOT NULL,
        "fileSize" INTEGER NOT NULL,
        "mimeType" TEXT NOT NULL,
        "isRequired" BOOLEAN NOT NULL DEFAULT false,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "uploadedBy" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        "isDeleted" BOOLEAN NOT NULL DEFAULT false,

        CONSTRAINT "system_documents_pkey" PRIMARY KEY ("id")
    );

    -- Create indexes
    CREATE INDEX "system_documents_category_idx" ON "system_documents"("category");
    CREATE INDEX "system_documents_isActive_idx" ON "system_documents"("isActive");
    CREATE INDEX "system_documents_isRequired_idx" ON "system_documents"("isRequired");
    CREATE INDEX "system_documents_uploadedBy_idx" ON "system_documents"("uploadedBy");
    CREATE INDEX "system_documents_isDeleted_idx" ON "system_documents"("isDeleted");

    -- Add foreign key constraint
    ALTER TABLE "system_documents" ADD CONSTRAINT "system_documents_uploadedBy_fkey" 
        FOREIGN KEY ("uploadedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

    RAISE NOTICE '✓ system_documents table created successfully!';
END $$;

-- ============================================
-- Step 3: Recreate document_acknowledgments with proper foreign key
-- ============================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'document_acknowledgments') THEN
        -- Re-add the foreign key constraint
        ALTER TABLE "document_acknowledgments" DROP CONSTRAINT IF EXISTS "document_acknowledgments_documentId_fkey";
        ALTER TABLE "document_acknowledgments" ADD CONSTRAINT "document_acknowledgments_documentId_fkey" 
            FOREIGN KEY ("documentId") REFERENCES "system_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        RAISE NOTICE '✓ Re-added foreign key constraint to document_acknowledgments';
    END IF;
END $$;

-- ============================================
-- Done!
-- ============================================

SELECT 'system_documents table fixed successfully!' AS status;


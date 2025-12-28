-- Migration: Create system documents and safety declarations tables
-- This enables system-wide document management and safety declaration tracking

-- Create DocumentCategory enum
CREATE TYPE "DocumentCategory" AS ENUM ('SAFETY', 'COMPLIANCE', 'TRAINING', 'POLICY', 'PROCEDURE', 'OTHER');

-- Create SystemDocumentType enum
CREATE TYPE "SystemDocumentType" AS ENUM ('SAFETY_POLICY', 'TRAINING_MATERIAL', 'COMPLIANCE_DOC', 'PROCEDURE', 'HANDBOOK', 'OTHER');

-- Create system_documents table
CREATE TABLE "system_documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "DocumentCategory" NOT NULL,
    "type" "SystemDocumentType" NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "uploadedBy" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "system_documents_pkey" PRIMARY KEY ("id")
);

-- Create document_acknowledgments table
CREATE TABLE "document_acknowledgments" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_acknowledgments_pkey" PRIMARY KEY ("id")
);

-- Create safety_declarations table
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
CREATE INDEX "system_documents_category_idx" ON "system_documents"("category");
CREATE INDEX "system_documents_isActive_idx" ON "system_documents"("isActive");
CREATE INDEX "system_documents_isRequired_idx" ON "system_documents"("isRequired");
CREATE INDEX "system_documents_uploadedBy_idx" ON "system_documents"("uploadedBy");
CREATE INDEX "system_documents_isDeleted_idx" ON "system_documents"("isDeleted");

CREATE INDEX "document_acknowledgments_documentId_idx" ON "document_acknowledgments"("documentId");
CREATE INDEX "document_acknowledgments_driverId_idx" ON "document_acknowledgments"("driverId");
CREATE INDEX "document_acknowledgments_acknowledgedAt_idx" ON "document_acknowledgments"("acknowledgedAt");
CREATE UNIQUE INDEX "document_acknowledgments_documentId_driverId_key" ON "document_acknowledgments"("documentId", "driverId");

CREATE INDEX "safety_declarations_driverId_idx" ON "safety_declarations"("driverId");
CREATE INDEX "safety_declarations_routeId_idx" ON "safety_declarations"("routeId");
CREATE INDEX "safety_declarations_declarationType_idx" ON "safety_declarations"("declarationType");
CREATE INDEX "safety_declarations_acknowledgedAt_idx" ON "safety_declarations"("acknowledgedAt");
CREATE INDEX "safety_declarations_isDeleted_idx" ON "safety_declarations"("isDeleted");

-- Add foreign key constraints
ALTER TABLE "system_documents" ADD CONSTRAINT "system_documents_uploadedBy_fkey" 
    FOREIGN KEY ("uploadedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "document_acknowledgments" ADD CONSTRAINT "document_acknowledgments_documentId_fkey" 
    FOREIGN KEY ("documentId") REFERENCES "system_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "document_acknowledgments" ADD CONSTRAINT "document_acknowledgments_driverId_fkey" 
    FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "safety_declarations" ADD CONSTRAINT "safety_declarations_driverId_fkey" 
    FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "safety_declarations" ADD CONSTRAINT "safety_declarations_routeId_fkey" 
    FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;


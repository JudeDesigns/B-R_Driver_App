-- Migration: Add Document Intake Batch and Log tables
-- These tables support the batch document intake feature, tracking
-- upload sessions and per-file match outcomes.

-- Step 1: Create enums
CREATE TYPE "IntakeBatchStatus" AS ENUM ('PENDING', 'COMMITTED', 'CANCELLED');
CREATE TYPE "IntakeMatchStatus" AS ENUM ('MATCHED', 'UNMATCHED', 'MANUAL_RESOLVED');

-- Step 2: Create document_intake_batches table
CREATE TABLE "document_intake_batches" (
    "id"             TEXT NOT NULL,
    "status"         "IntakeBatchStatus" NOT NULL DEFAULT 'PENDING',
    "totalFiles"     INTEGER NOT NULL DEFAULT 0,
    "matchedCount"   INTEGER NOT NULL DEFAULT 0,
    "unmatchedCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy"      TEXT NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDeleted"      BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "document_intake_batches_pkey" PRIMARY KEY ("id")
);

-- Step 3: Create document_intake_logs table
CREATE TABLE "document_intake_logs" (
    "id"           TEXT NOT NULL,
    "batchId"      TEXT NOT NULL,
    "fileName"     TEXT NOT NULL,
    "fileSize"     INTEGER NOT NULL,
    "status"       "IntakeMatchStatus" NOT NULL,
    "flow"         TEXT,
    "anchorType"   TEXT,
    "anchorValue"  TEXT,
    "docType"      "DocumentType",
    "resolvedToId" TEXT,
    "errorMessage" TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDeleted"    BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "document_intake_logs_pkey" PRIMARY KEY ("id")
);

-- Step 4: Indexes
CREATE INDEX "document_intake_batches_status_idx"    ON "document_intake_batches"("status");
CREATE INDEX "document_intake_batches_createdBy_idx" ON "document_intake_batches"("createdBy");
CREATE INDEX "document_intake_batches_createdAt_idx" ON "document_intake_batches"("createdAt");
CREATE INDEX "document_intake_logs_batchId_idx"      ON "document_intake_logs"("batchId");
CREATE INDEX "document_intake_logs_status_idx"       ON "document_intake_logs"("status");

-- Step 5: Foreign keys
ALTER TABLE "document_intake_batches"
    ADD CONSTRAINT "document_intake_batches_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "document_intake_logs"
    ADD CONSTRAINT "document_intake_logs_batchId_fkey"
    FOREIGN KEY ("batchId") REFERENCES "document_intake_batches"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

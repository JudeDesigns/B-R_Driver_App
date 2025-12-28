-- Migration: Create file management system tables
-- This enables advanced file storage, versioning, and thumbnail generation

-- Create ThumbnailSize enum
CREATE TYPE "ThumbnailSize" AS ENUM ('SMALL', 'MEDIUM', 'LARGE');

-- Create file_categories table
CREATE TABLE "file_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "pathPrefix" TEXT NOT NULL,
    "maxFileSize" INTEGER NOT NULL DEFAULT 10485760,
    "allowedTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "retentionDays" INTEGER NOT NULL DEFAULT 365,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_categories_pkey" PRIMARY KEY ("id")
);

-- Create files table
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "categoryId" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "metadata" JSONB,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- Create file_versions table
CREATE TABLE "file_versions" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_versions_pkey" PRIMARY KEY ("id")
);

-- Create file_thumbnails table
CREATE TABLE "file_thumbnails" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "size" "ThumbnailSize" NOT NULL,
    "filePath" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_thumbnails_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE UNIQUE INDEX "file_categories_name_key" ON "file_categories"("name");

CREATE INDEX "files_categoryId_idx" ON "files"("categoryId");
CREATE INDEX "files_uploadedBy_idx" ON "files"("uploadedBy");
CREATE INDEX "files_checksum_idx" ON "files"("checksum");
CREATE INDEX "files_isArchived_idx" ON "files"("isArchived");
CREATE INDEX "files_isDeleted_idx" ON "files"("isDeleted");
CREATE INDEX "files_createdAt_idx" ON "files"("createdAt");

CREATE INDEX "file_versions_fileId_idx" ON "file_versions"("fileId");

CREATE INDEX "file_thumbnails_fileId_idx" ON "file_thumbnails"("fileId");
CREATE INDEX "file_thumbnails_size_idx" ON "file_thumbnails"("size");

-- Add foreign key constraints
ALTER TABLE "files" ADD CONSTRAINT "files_categoryId_fkey" 
    FOREIGN KEY ("categoryId") REFERENCES "file_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "files" ADD CONSTRAINT "files_uploadedBy_fkey" 
    FOREIGN KEY ("uploadedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_fileId_fkey" 
    FOREIGN KEY ("fileId") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "file_thumbnails" ADD CONSTRAINT "file_thumbnails_fileId_fkey" 
    FOREIGN KEY ("fileId") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


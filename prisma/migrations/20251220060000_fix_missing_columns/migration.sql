-- CreateEnum
CREATE TYPE "SystemDocumentType" AS ENUM ('DAILY_SAFETY_DECLARATION', 'SAFETY_INSTRUCTIONS', 'COMPANY_POLICY');
CREATE TYPE "ThumbnailSize" AS ENUM ('SMALL', 'MEDIUM', 'LARGE');
CREATE TYPE "VehicleStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'RETIRED');

-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE 'CUSTOMER_INVOICE';
ALTER TYPE "DocumentType" ADD VALUE 'VENDOR_BILL_WORK_ORDER';
ALTER TYPE "DocumentType" ADD VALUE 'GASOLINE_DIESEL_EXPENSE';
ALTER TYPE "DocumentType" ADD VALUE 'DRIVER_WAREHOUSE_HOURS';
ALTER TYPE "DocumentType" ADD VALUE 'SAFETY_DECLARATION';
ALTER TYPE "DocumentType" ADD VALUE 'STATEMENT';

-- AlterTable Users
ALTER TABLE "users" ADD COLUMN "attendanceAppUserId" TEXT;
ALTER TABLE "users" ADD COLUMN "lastClockInStatusCheck" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "cachedClockInStatus" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "cachedClockInStatusAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "lastKnownLatitude" DOUBLE PRECISION;
ALTER TABLE "users" ADD COLUMN "lastKnownLongitude" DOUBLE PRECISION;
ALTER TABLE "users" ADD COLUMN "lastLocationUpdate" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "locationAccuracy" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "users_attendanceAppUserId_idx" ON "users"("attendanceAppUserId");

-- AlterTable Customers
ALTER TABLE "customers" ADD COLUMN "deliveryInstructions" TEXT;
ALTER TABLE "customers" ADD COLUMN "paymentTerms" TEXT DEFAULT 'COD';
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");
CREATE INDEX "customers_paymentTerms_idx" ON "customers"("paymentTerms");

-- CreateTable Vehicles
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "vehicleNumber" TEXT NOT NULL,
    "make" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "licensePlate" TEXT,
    "vin" TEXT,
    "fuelType" TEXT NOT NULL DEFAULT 'DIESEL',
    "status" "VehicleStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "fuelInstructions" TEXT,
    "fuelCardNumber" TEXT,
    "fuelCapKeyNumber" TEXT,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_vehicleNumber_key" ON "vehicles"("vehicleNumber");
CREATE INDEX "vehicles_vehicleNumber_idx" ON "vehicles"("vehicleNumber");
CREATE INDEX "vehicles_status_idx" ON "vehicles"("status");
CREATE INDEX "vehicles_isDeleted_idx" ON "vehicles"("isDeleted");

-- CreateTable VehicleAssignments
CREATE TABLE "vehicle_assignments" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "routeId" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "vehicle_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehicle_assignments_vehicleId_idx" ON "vehicle_assignments"("vehicleId");
CREATE INDEX "vehicle_assignments_driverId_idx" ON "vehicle_assignments"("driverId");
CREATE INDEX "vehicle_assignments_routeId_idx" ON "vehicle_assignments"("routeId");
CREATE INDEX "vehicle_assignments_isActive_idx" ON "vehicle_assignments"("isActive");
CREATE INDEX "vehicle_assignments_isDeleted_idx" ON "vehicle_assignments"("isDeleted");

-- AddForeignKey
ALTER TABLE "vehicle_assignments" ADD CONSTRAINT "vehicle_assignments_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicle_assignments" ADD CONSTRAINT "vehicle_assignments_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicle_assignments" ADD CONSTRAINT "vehicle_assignments_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable DriverLocations
CREATE TABLE "driver_locations" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "routeId" TEXT,
    "stopId" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "driver_locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "driver_locations_driverId_idx" ON "driver_locations"("driverId");
CREATE INDEX "driver_locations_routeId_idx" ON "driver_locations"("routeId");
CREATE INDEX "driver_locations_stopId_idx" ON "driver_locations"("stopId");
CREATE INDEX "driver_locations_timestamp_idx" ON "driver_locations"("timestamp");
CREATE INDEX "driver_locations_createdAt_idx" ON "driver_locations"("createdAt");

-- AddForeignKey
ALTER TABLE "driver_locations" ADD CONSTRAINT "driver_locations_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "driver_locations" ADD CONSTRAINT "driver_locations_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "driver_locations" ADD CONSTRAINT "driver_locations_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "stops"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable SystemDocuments
CREATE TABLE "system_documents" (
    "id" TEXT NOT NULL,
    "documentType" "SystemDocumentType" NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "system_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable SafetyDeclarations
CREATE TABLE "safety_declarations" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "routeId" TEXT,
    "declarationType" TEXT NOT NULL DEFAULT 'DAILY',
    "vehicleInspected" BOOLEAN NOT NULL DEFAULT false,
    "safetyEquipment" BOOLEAN NOT NULL DEFAULT false,
    "routeUnderstood" BOOLEAN NOT NULL DEFAULT false,
    "emergencyProcedures" BOOLEAN NOT NULL DEFAULT false,
    "companyPolicies" BOOLEAN NOT NULL DEFAULT false,
    "signature" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "safety_declarations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "safety_declarations_driverId_idx" ON "safety_declarations"("driverId");
CREATE INDEX "safety_declarations_routeId_idx" ON "safety_declarations"("routeId");
CREATE INDEX "safety_declarations_declarationType_idx" ON "safety_declarations"("declarationType");
CREATE INDEX "safety_declarations_acknowledgedAt_idx" ON "safety_declarations"("acknowledgedAt");
CREATE INDEX "safety_declarations_isDeleted_idx" ON "safety_declarations"("isDeleted");

-- AddForeignKey
ALTER TABLE "safety_declarations" ADD CONSTRAINT "safety_declarations_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "safety_declarations" ADD CONSTRAINT "safety_declarations_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable FileCategories
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

-- CreateIndex
CREATE UNIQUE INDEX "file_categories_name_key" ON "file_categories"("name");

-- CreateTable Files
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

-- CreateIndex
CREATE INDEX "files_categoryId_idx" ON "files"("categoryId");
CREATE INDEX "files_uploadedBy_idx" ON "files"("uploadedBy");
CREATE INDEX "files_checksum_idx" ON "files"("checksum");
CREATE INDEX "files_isArchived_idx" ON "files"("isArchived");
CREATE INDEX "files_isDeleted_idx" ON "files"("isDeleted");
CREATE INDEX "files_createdAt_idx" ON "files"("createdAt");

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "file_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "files" ADD CONSTRAINT "files_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable FileVersions
CREATE TABLE "file_versions" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "file_versions_fileId_idx" ON "file_versions"("fileId");

-- AddForeignKey
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable FileThumbnails
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

-- CreateIndex
CREATE INDEX "file_thumbnails_fileId_idx" ON "file_thumbnails"("fileId");
CREATE INDEX "file_thumbnails_size_idx" ON "file_thumbnails"("size");

-- AddForeignKey
ALTER TABLE "file_thumbnails" ADD CONSTRAINT "file_thumbnails_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

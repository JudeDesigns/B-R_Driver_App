-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'DRIVER', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "RouteStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StopStatus" AS ENUM ('PENDING', 'ON_THE_WAY', 'ARRIVED', 'COMPLETED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "ChecklistType" AS ENUM ('START_OF_DAY', 'END_OF_DAY');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('INVOICE', 'CREDIT_MEMO', 'DELIVERY_RECEIPT', 'RETURN_FORM', 'OTHER', 'CUSTOMER_INVOICE', 'VENDOR_BILL_WORK_ORDER', 'GASOLINE_DIESEL_EXPENSE', 'DRIVER_WAREHOUSE_HOURS', 'SAFETY_DECLARATION', 'STATEMENT');

-- CreateEnum
CREATE TYPE "ThumbnailSize" AS ENUM ('SMALL', 'MEDIUM', 'LARGE');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'RETIRED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'DRIVER',
    "fullName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "attendanceAppUserId" TEXT,
    "lastClockInStatusCheck" TIMESTAMP(3),
    "cachedClockInStatus" BOOLEAN NOT NULL DEFAULT false,
    "cachedClockInStatusAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "contactInfo" TEXT,
    "email" TEXT,
    "preferences" TEXT,
    "groupCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "paymentTerms" TEXT DEFAULT 'COD',
    "deliveryInstructions" TEXT,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routes" (
    "id" TEXT NOT NULL,
    "routeNumber" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "RouteStatus" NOT NULL DEFAULT 'PENDING',
    "driverId" TEXT,
    "uploadedBy" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceFile" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "stops" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "customerNameFromUpload" TEXT,
    "driverNameFromUpload" TEXT,
    "orderNumberWeb" TEXT,
    "quickbooksInvoiceNum" TEXT,
    "initialDriverNotes" TEXT,
    "status" "StopStatus" NOT NULL DEFAULT 'PENDING',
    "onTheWayTime" TIMESTAMP(3),
    "arrivalTime" TIMESTAMP(3),
    "completionTime" TIMESTAMP(3),
    "signedInvoicePdfUrl" TEXT,
    "invoiceImageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "driverNotes" TEXT,
    "isCOD" BOOLEAN NOT NULL DEFAULT false,
    "paymentFlagCash" BOOLEAN NOT NULL DEFAULT false,
    "paymentFlagCheck" BOOLEAN NOT NULL DEFAULT false,
    "paymentFlagCC" BOOLEAN NOT NULL DEFAULT false,
    "paymentFlagNotPaid" BOOLEAN NOT NULL DEFAULT false,
    "returnFlagInitial" BOOLEAN NOT NULL DEFAULT false,
    "driverRemarkInitial" TEXT,
    "amount" DOUBLE PRECISION,
    "paymentAmountCash" DOUBLE PRECISION DEFAULT 0,
    "paymentAmountCheck" DOUBLE PRECISION DEFAULT 0,
    "paymentAmountCC" DOUBLE PRECISION DEFAULT 0,
    "totalPaymentAmount" DOUBLE PRECISION DEFAULT 0,
    "driverPaymentAmount" DOUBLE PRECISION,
    "driverPaymentMethods" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "stops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "returns" (
    "id" TEXT NOT NULL,
    "stopId" TEXT NOT NULL,
    "orderItemIdentifier" TEXT NOT NULL,
    "productDescription" TEXT,
    "productId" TEXT,
    "quantity" INTEGER NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "warehouseLocation" TEXT,
    "vendorCreditNum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_notes" (
    "id" TEXT NOT NULL,
    "stopId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "readByDriver" BOOLEAN NOT NULL DEFAULT false,
    "readByDriverAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "admin_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safety_checks" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "type" "ChecklistType" NOT NULL,
    "date" TIMESTAMP(3),
    "mileage1" TEXT,
    "mileage2" TEXT,
    "dieselLevel" TEXT,
    "palletsIn" INTEGER,
    "palletsOut" INTEGER,
    "dpfLevel" TEXT,
    "dieselReceipt" BOOLEAN,
    "dollNumber" TEXT,
    "truckJackNumber" TEXT,
    "strapLevel" TEXT,
    "palletJackNumber" TEXT,
    "truckNumber" TEXT,
    "dieselAmount" DOUBLE PRECISION,
    "creditCardNumber" TEXT,
    "fuelCapKeyNumber" TEXT,
    "creditCardCashAmount" DOUBLE PRECISION,
    "cashBackAmount" DOUBLE PRECISION,
    "frontLightsPhoto" BOOLEAN,
    "electricityBoxPhoto" BOOLEAN,
    "palletsPhoto" BOOLEAN,
    "vehicleConditionVideo" BOOLEAN,
    "calledWarehouse" BOOLEAN,
    "notes" TEXT,
    "lightsWorking" BOOLEAN,
    "tiresCondition" BOOLEAN,
    "braksWorking" BOOLEAN,
    "vehicleClean" BOOLEAN,
    "palletJackWorking" BOOLEAN,
    "dolliesSecured" BOOLEAN,
    "strapsAvailable" BOOLEAN,
    "routeReviewed" BOOLEAN,
    "responses" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "safety_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_uploads" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "status" "UploadStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "rowsProcessed" INTEGER NOT NULL DEFAULT 0,
    "rowsSucceeded" INTEGER NOT NULL DEFAULT 0,
    "rowsFailed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "route_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_emails" (
    "id" TEXT NOT NULL,
    "stopId" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "signedInvoiceUrl" TEXT,
    "originalInvoiceUrl" TEXT,
    "status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "customer_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "DocumentType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "customerId" TEXT,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stop_documents" (
    "id" TEXT NOT NULL,
    "stopId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "isPrinted" BOOLEAN NOT NULL DEFAULT false,
    "printedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "stop_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "file_versions" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "stopId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_isDeleted_idx" ON "users"("isDeleted");

-- CreateIndex
CREATE INDEX "users_attendanceAppUserId_idx" ON "users"("attendanceAppUserId");

-- CreateIndex
CREATE INDEX "customers_name_idx" ON "customers"("name");

-- CreateIndex
CREATE INDEX "customers_email_idx" ON "customers"("email");

-- CreateIndex
CREATE INDEX "customers_groupCode_idx" ON "customers"("groupCode");

-- CreateIndex
CREATE INDEX "customers_isDeleted_idx" ON "customers"("isDeleted");

-- CreateIndex
CREATE INDEX "customers_paymentTerms_idx" ON "customers"("paymentTerms");

-- CreateIndex
CREATE INDEX "routes_routeNumber_idx" ON "routes"("routeNumber");

-- CreateIndex
CREATE INDEX "routes_date_idx" ON "routes"("date");

-- CreateIndex
CREATE INDEX "routes_status_idx" ON "routes"("status");

-- CreateIndex
CREATE INDEX "routes_driverId_idx" ON "routes"("driverId");

-- CreateIndex
CREATE INDEX "routes_isDeleted_idx" ON "routes"("isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_vehicleNumber_key" ON "vehicles"("vehicleNumber");

-- CreateIndex
CREATE INDEX "vehicles_vehicleNumber_idx" ON "vehicles"("vehicleNumber");

-- CreateIndex
CREATE INDEX "vehicles_status_idx" ON "vehicles"("status");

-- CreateIndex
CREATE INDEX "vehicles_isDeleted_idx" ON "vehicles"("isDeleted");

-- CreateIndex
CREATE INDEX "vehicle_assignments_vehicleId_idx" ON "vehicle_assignments"("vehicleId");

-- CreateIndex
CREATE INDEX "vehicle_assignments_driverId_idx" ON "vehicle_assignments"("driverId");

-- CreateIndex
CREATE INDEX "vehicle_assignments_routeId_idx" ON "vehicle_assignments"("routeId");

-- CreateIndex
CREATE INDEX "vehicle_assignments_isActive_idx" ON "vehicle_assignments"("isActive");

-- CreateIndex
CREATE INDEX "vehicle_assignments_isDeleted_idx" ON "vehicle_assignments"("isDeleted");

-- CreateIndex
CREATE INDEX "stops_routeId_idx" ON "stops"("routeId");

-- CreateIndex
CREATE INDEX "stops_customerId_idx" ON "stops"("customerId");

-- CreateIndex
CREATE INDEX "stops_status_idx" ON "stops"("status");

-- CreateIndex
CREATE INDEX "stops_driverNameFromUpload_idx" ON "stops"("driverNameFromUpload");

-- CreateIndex
CREATE INDEX "stops_isDeleted_idx" ON "stops"("isDeleted");

-- CreateIndex
CREATE INDEX "stops_sequence_idx" ON "stops"("sequence");

-- CreateIndex
CREATE INDEX "admin_notes_stopId_idx" ON "admin_notes"("stopId");

-- CreateIndex
CREATE INDEX "admin_notes_adminId_idx" ON "admin_notes"("adminId");

-- CreateIndex
CREATE INDEX "admin_notes_readByDriver_idx" ON "admin_notes"("readByDriver");

-- CreateIndex
CREATE INDEX "admin_notes_isDeleted_idx" ON "admin_notes"("isDeleted");

-- CreateIndex
CREATE INDEX "safety_checks_routeId_idx" ON "safety_checks"("routeId");

-- CreateIndex
CREATE INDEX "safety_checks_driverId_idx" ON "safety_checks"("driverId");

-- CreateIndex
CREATE INDEX "safety_checks_type_idx" ON "safety_checks"("type");

-- CreateIndex
CREATE INDEX "safety_checks_isDeleted_idx" ON "safety_checks"("isDeleted");

-- CreateIndex
CREATE INDEX "route_uploads_uploadedBy_idx" ON "route_uploads"("uploadedBy");

-- CreateIndex
CREATE INDEX "route_uploads_status_idx" ON "route_uploads"("status");

-- CreateIndex
CREATE INDEX "route_uploads_uploadedAt_idx" ON "route_uploads"("uploadedAt");

-- CreateIndex
CREATE INDEX "route_uploads_isDeleted_idx" ON "route_uploads"("isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE INDEX "products_sku_idx" ON "products"("sku");

-- CreateIndex
CREATE INDEX "products_name_idx" ON "products"("name");

-- CreateIndex
CREATE INDEX "products_isDeleted_idx" ON "products"("isDeleted");

-- CreateIndex
CREATE INDEX "customer_emails_stopId_idx" ON "customer_emails"("stopId");

-- CreateIndex
CREATE INDEX "customer_emails_status_idx" ON "customer_emails"("status");

-- CreateIndex
CREATE INDEX "customer_emails_sentAt_idx" ON "customer_emails"("sentAt");

-- CreateIndex
CREATE INDEX "customer_emails_isDeleted_idx" ON "customer_emails"("isDeleted");

-- CreateIndex
CREATE INDEX "documents_type_idx" ON "documents"("type");

-- CreateIndex
CREATE INDEX "documents_uploadedBy_idx" ON "documents"("uploadedBy");

-- CreateIndex
CREATE INDEX "documents_isActive_idx" ON "documents"("isActive");

-- CreateIndex
CREATE INDEX "documents_isDeleted_idx" ON "documents"("isDeleted");

-- CreateIndex
CREATE INDEX "documents_customerId_idx" ON "documents"("customerId");

-- CreateIndex
CREATE INDEX "stop_documents_stopId_idx" ON "stop_documents"("stopId");

-- CreateIndex
CREATE INDEX "stop_documents_documentId_idx" ON "stop_documents"("documentId");

-- CreateIndex
CREATE INDEX "stop_documents_isPrinted_idx" ON "stop_documents"("isPrinted");

-- CreateIndex
CREATE INDEX "stop_documents_isDeleted_idx" ON "stop_documents"("isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "stop_documents_stopId_documentId_key" ON "stop_documents"("stopId", "documentId");

-- CreateIndex
CREATE UNIQUE INDEX "file_categories_name_key" ON "file_categories"("name");

-- CreateIndex
CREATE INDEX "files_categoryId_idx" ON "files"("categoryId");

-- CreateIndex
CREATE INDEX "files_uploadedBy_idx" ON "files"("uploadedBy");

-- CreateIndex
CREATE INDEX "files_checksum_idx" ON "files"("checksum");

-- CreateIndex
CREATE INDEX "files_isArchived_idx" ON "files"("isArchived");

-- CreateIndex
CREATE INDEX "files_isDeleted_idx" ON "files"("isDeleted");

-- CreateIndex
CREATE INDEX "files_createdAt_idx" ON "files"("createdAt");

-- CreateIndex
CREATE INDEX "file_versions_fileId_idx" ON "file_versions"("fileId");

-- CreateIndex
CREATE INDEX "file_thumbnails_fileId_idx" ON "file_thumbnails"("fileId");

-- CreateIndex
CREATE INDEX "file_thumbnails_size_idx" ON "file_thumbnails"("size");

-- CreateIndex
CREATE INDEX "payments_stopId_idx" ON "payments"("stopId");

-- CreateIndex
CREATE INDEX "payments_method_idx" ON "payments"("method");

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_assignments" ADD CONSTRAINT "vehicle_assignments_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_assignments" ADD CONSTRAINT "vehicle_assignments_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_assignments" ADD CONSTRAINT "vehicle_assignments_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stops" ADD CONSTRAINT "stops_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stops" ADD CONSTRAINT "stops_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "stops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_notes" ADD CONSTRAINT "admin_notes_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "stops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_notes" ADD CONSTRAINT "admin_notes_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_checks" ADD CONSTRAINT "safety_checks_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_checks" ADD CONSTRAINT "safety_checks_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stop_documents" ADD CONSTRAINT "stop_documents_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "stops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stop_documents" ADD CONSTRAINT "stop_documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "file_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_thumbnails" ADD CONSTRAINT "file_thumbnails_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "stops"("id") ON DELETE CASCADE ON UPDATE CASCADE;


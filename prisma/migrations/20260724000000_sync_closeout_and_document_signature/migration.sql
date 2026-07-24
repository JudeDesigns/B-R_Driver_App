-- CreateEnum
CREATE TYPE "CloseoutType" AS ENUM ('WAREHOUSE', 'JETRO');

-- DropIndex
DROP INDEX "document_acknowledgments_documentId_driverId_routeId_key";

-- DropIndex
DROP INDEX "document_acknowledgments_documentid_driverid_routeid_key";

-- AlterTable
ALTER TABLE "document_acknowledgments" ADD COLUMN     "documentVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "invalidatedAt" TIMESTAMP(3),
ADD COLUMN     "invalidatedBy" TEXT,
ADD COLUMN     "isValid" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "signatureImageUrl" TEXT,
ADD COLUMN     "signedPdfUrl" TEXT;

-- AlterTable
ALTER TABLE "document_intake_batches" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "document_intake_logs" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "system_documents" ADD COLUMN     "requiresSignature" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "route_closeout_assignments" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "type" "CloseoutType" NOT NULL,
    "assignedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "route_closeout_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "closeout_instructions" (
    "id" TEXT NOT NULL,
    "type" "CloseoutType" NOT NULL,
    "instructions" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "closeout_instructions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_closeout_checks" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "type" "CloseoutType" NOT NULL,
    "contactedPerson" TEXT NOT NULL,
    "pendingPickup" BOOLEAN NOT NULL,
    "note" TEXT,
    "photoUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_closeout_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "end_of_day_overdue_alerts" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "notifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "end_of_day_overdue_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "route_closeout_assignments_routeId_idx" ON "route_closeout_assignments"("routeId");

-- CreateIndex
CREATE INDEX "route_closeout_assignments_driverId_idx" ON "route_closeout_assignments"("driverId");

-- CreateIndex
CREATE UNIQUE INDEX "route_closeout_assignments_routeId_driverId_key" ON "route_closeout_assignments"("routeId", "driverId");

-- CreateIndex
CREATE UNIQUE INDEX "closeout_instructions_type_key" ON "closeout_instructions"("type");

-- CreateIndex
CREATE INDEX "route_closeout_checks_routeId_idx" ON "route_closeout_checks"("routeId");

-- CreateIndex
CREATE INDEX "route_closeout_checks_driverId_idx" ON "route_closeout_checks"("driverId");

-- CreateIndex
CREATE INDEX "route_closeout_checks_createdAt_idx" ON "route_closeout_checks"("createdAt");

-- CreateIndex
CREATE INDEX "end_of_day_overdue_alerts_routeId_idx" ON "end_of_day_overdue_alerts"("routeId");

-- CreateIndex
CREATE INDEX "end_of_day_overdue_alerts_driverId_idx" ON "end_of_day_overdue_alerts"("driverId");

-- CreateIndex
CREATE UNIQUE INDEX "end_of_day_overdue_alerts_routeId_driverId_key" ON "end_of_day_overdue_alerts"("routeId", "driverId");

-- CreateIndex
CREATE INDEX "document_acknowledgments_documentVersion_idx" ON "document_acknowledgments"("documentVersion");

-- CreateIndex
CREATE INDEX "document_acknowledgments_isValid_idx" ON "document_acknowledgments"("isValid");

-- CreateIndex
CREATE INDEX "document_acknowledgments_documentId_driverId_isValid_idx" ON "document_acknowledgments"("documentId", "driverId", "isValid");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- AddForeignKey
ALTER TABLE "route_closeout_assignments" ADD CONSTRAINT "route_closeout_assignments_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_closeout_assignments" ADD CONSTRAINT "route_closeout_assignments_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "closeout_instructions" ADD CONSTRAINT "closeout_instructions_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_closeout_checks" ADD CONSTRAINT "route_closeout_checks_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_closeout_checks" ADD CONSTRAINT "route_closeout_checks_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

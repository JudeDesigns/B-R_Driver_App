/*
  Warnings:

  - The values [SUPER_ADMIN] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'DRIVER');
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'DRIVER';
COMMIT;

-- AlterTable
ALTER TABLE "safety_checks" ADD COLUMN     "calledWarehouse" BOOLEAN,
ADD COLUMN     "cashBackAmount" DOUBLE PRECISION,
ADD COLUMN     "creditCardCashAmount" DOUBLE PRECISION,
ADD COLUMN     "creditCardNumber" TEXT,
ADD COLUMN     "date" TIMESTAMP(3),
ADD COLUMN     "dieselAmount" DOUBLE PRECISION,
ADD COLUMN     "dieselLevel" TEXT,
ADD COLUMN     "dieselReceipt" BOOLEAN,
ADD COLUMN     "dollNumber" TEXT,
ADD COLUMN     "dpfLevel" TEXT,
ADD COLUMN     "electricityBoxPhoto" BOOLEAN,
ADD COLUMN     "frontLightsPhoto" BOOLEAN,
ADD COLUMN     "fuelCapKeyNumber" TEXT,
ADD COLUMN     "mileage1" TEXT,
ADD COLUMN     "mileage2" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "palletJackNumber" TEXT,
ADD COLUMN     "palletsIn" INTEGER,
ADD COLUMN     "palletsOut" INTEGER,
ADD COLUMN     "palletsPhoto" BOOLEAN,
ADD COLUMN     "strapLevel" TEXT,
ADD COLUMN     "truckJackNumber" TEXT,
ADD COLUMN     "truckNumber" TEXT,
ADD COLUMN     "vehicleConditionVideo" BOOLEAN;

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

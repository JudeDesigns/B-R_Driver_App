-- AlterTable
ALTER TABLE "stops" ADD COLUMN     "invoiceImageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];

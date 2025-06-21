-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "customerId" TEXT;

-- CreateIndex
CREATE INDEX "documents_customerId_idx" ON "documents"("customerId");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

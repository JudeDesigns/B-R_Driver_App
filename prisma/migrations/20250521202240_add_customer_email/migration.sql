-- AlterTable
ALTER TABLE "customers" ADD COLUMN "email" TEXT;

-- CreateIndex
CREATE INDEX "customers_email_idx" ON "customers"("email");

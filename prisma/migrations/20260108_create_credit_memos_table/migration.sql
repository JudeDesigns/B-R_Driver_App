-- CreateTable: credit_memos
-- This table stores credit memo information for stops

CREATE TABLE "credit_memos" (
    "id" TEXT NOT NULL,
    "stopId" TEXT NOT NULL,
    "creditMemoNumber" TEXT NOT NULL,
    "creditMemoAmount" DOUBLE PRECISION NOT NULL,
    "documentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "credit_memos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "credit_memos_stopId_idx" ON "credit_memos"("stopId");

-- CreateIndex
CREATE INDEX "credit_memos_documentId_idx" ON "credit_memos"("documentId");

-- CreateIndex
CREATE INDEX "credit_memos_isDeleted_idx" ON "credit_memos"("isDeleted");

-- AddForeignKey
ALTER TABLE "credit_memos" ADD CONSTRAINT "credit_memos_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "stops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_memos" ADD CONSTRAINT "credit_memos_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;


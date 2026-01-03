-- AlterTable: Make scanId nullable and add batchId field
ALTER TABLE "reports" ALTER COLUMN "scanId" DROP NOT NULL;

-- Add batchId column
ALTER TABLE "reports" ADD COLUMN "batchId" UUID;

-- CreateIndex: Index on batchId for batch report queries
CREATE INDEX "reports_batchId_idx" ON "reports"("batchId");

-- Add unique constraint for batch reports (one report per format per batch)
CREATE UNIQUE INDEX "reports_batchId_format_key" ON "reports"("batchId", "format");

-- AddForeignKey: Relation to batch_scans
ALTER TABLE "reports" ADD CONSTRAINT "reports_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batch_scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

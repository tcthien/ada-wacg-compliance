-- AlterTable
ALTER TABLE "batch_scans" ADD COLUMN     "email" VARCHAR(255);

-- CreateIndex
CREATE INDEX "batch_scans_email_idx" ON "batch_scans"("email");

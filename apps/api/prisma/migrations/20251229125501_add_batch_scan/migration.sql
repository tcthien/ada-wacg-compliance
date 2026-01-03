-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'STALE');

-- AlterTable
ALTER TABLE "scans" ADD COLUMN     "batchId" UUID,
ADD COLUMN     "pageTitle" VARCHAR(500);

-- CreateTable
CREATE TABLE "batch_scans" (
    "id" UUID NOT NULL,
    "guestSessionId" UUID,
    "userId" UUID,
    "homepageUrl" VARCHAR(2048) NOT NULL,
    "wcagLevel" "WcagLevel" NOT NULL DEFAULT 'AA',
    "discoveryId" UUID,
    "status" "BatchStatus" NOT NULL DEFAULT 'PENDING',
    "totalUrls" INTEGER NOT NULL,
    "completedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "totalIssues" INTEGER,
    "criticalCount" INTEGER,
    "seriousCount" INTEGER,
    "moderateCount" INTEGER,
    "minorCount" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "completedAt" TIMESTAMPTZ,
    "cancelledAt" TIMESTAMPTZ,

    CONSTRAINT "batch_scans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "batch_scans_guestSessionId_idx" ON "batch_scans"("guestSessionId");

-- CreateIndex
CREATE INDEX "batch_scans_status_idx" ON "batch_scans"("status");

-- CreateIndex
CREATE INDEX "batch_scans_createdAt_idx" ON "batch_scans"("createdAt");

-- CreateIndex
CREATE INDEX "scans_batchId_idx" ON "scans"("batchId");

-- AddForeignKey
ALTER TABLE "scans" ADD CONSTRAINT "scans_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batch_scans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_scans" ADD CONSTRAINT "batch_scans_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "guest_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_scans" ADD CONSTRAINT "batch_scans_discoveryId_fkey" FOREIGN KEY ("discoveryId") REFERENCES "discoveries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

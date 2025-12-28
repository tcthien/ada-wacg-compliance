/*
  Warnings:

  - Added the required column `updatedAt` to the `scans` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ScanEventType" AS ENUM ('INIT', 'QUEUE', 'FETCH', 'ANALYSIS', 'RESULT', 'ERROR', 'DEBUG');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('DEBUG', 'INFO', 'SUCCESS', 'WARNING', 'ERROR');

-- AlterTable
ALTER TABLE "scans" ADD COLUMN     "eventSummary" JSONB;

-- Add updatedAt column with default value for existing rows
ALTER TABLE "scans" ADD COLUMN     "updatedAt" TIMESTAMPTZ;
UPDATE "scans" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
ALTER TABLE "scans" ALTER COLUMN "updatedAt" SET NOT NULL;

-- CreateTable
CREATE TABLE "scan_events" (
    "id" UUID NOT NULL,
    "scanId" UUID NOT NULL,
    "type" "ScanEventType" NOT NULL,
    "level" "LogLevel" NOT NULL DEFAULT 'INFO',
    "message" VARCHAR(500) NOT NULL,
    "metadata" JSONB,
    "adminOnly" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scan_events_scanId_createdAt_idx" ON "scan_events"("scanId", "createdAt");

-- CreateIndex
CREATE INDEX "scan_events_createdAt_idx" ON "scan_events"("createdAt");

-- CreateIndex
CREATE INDEX "scans_status_updatedAt_idx" ON "scans"("status", "updatedAt");

-- AddForeignKey
ALTER TABLE "scan_events" ADD CONSTRAINT "scan_events_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

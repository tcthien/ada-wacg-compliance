-- CreateEnum: ReportStatus for tracking async report generation
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'GENERATING', 'COMPLETED', 'FAILED');

-- AlterTable: Add status column to reports table
ALTER TABLE "reports" ADD COLUMN "status" "ReportStatus" NOT NULL DEFAULT 'COMPLETED';

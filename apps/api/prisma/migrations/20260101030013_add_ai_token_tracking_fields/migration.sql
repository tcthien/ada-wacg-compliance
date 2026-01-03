-- CreateEnum
CREATE TYPE "AiStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "scans" ADD COLUMN     "aiEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "aiInputTokens" INTEGER,
ADD COLUMN     "aiModel" VARCHAR(100),
ADD COLUMN     "aiOutputTokens" INTEGER,
ADD COLUMN     "aiProcessedAt" TIMESTAMPTZ,
ADD COLUMN     "aiProcessingTime" INTEGER,
ADD COLUMN     "aiRemediationPlan" TEXT,
ADD COLUMN     "aiStatus" "AiStatus",
ADD COLUMN     "aiSummary" TEXT,
ADD COLUMN     "aiTotalTokens" INTEGER;

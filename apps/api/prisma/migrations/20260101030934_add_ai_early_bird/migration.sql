-- CreateEnum
CREATE TYPE "AiCampaignStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DEPLETED', 'ENDED');

-- AlterEnum
ALTER TYPE "AiStatus" ADD VALUE 'DOWNLOADED';

-- AlterTable
ALTER TABLE "issues" ADD COLUMN     "aiExplanation" TEXT,
ADD COLUMN     "aiFixSuggestion" TEXT,
ADD COLUMN     "aiPriority" INTEGER;

-- CreateTable
CREATE TABLE "ai_campaigns" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "totalTokenBudget" INTEGER NOT NULL,
    "usedTokens" INTEGER NOT NULL DEFAULT 0,
    "reservedSlots" INTEGER NOT NULL DEFAULT 0,
    "avgTokensPerScan" INTEGER NOT NULL,
    "status" "AiCampaignStatus" NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMPTZ NOT NULL,
    "endsAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ai_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_campaign_audits" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "details" JSONB NOT NULL,
    "adminId" VARCHAR(255),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_campaign_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_campaigns_status_startsAt_idx" ON "ai_campaigns"("status", "startsAt");

-- CreateIndex
CREATE INDEX "ai_campaign_audits_campaignId_createdAt_idx" ON "ai_campaign_audits"("campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "scans_aiEnabled_aiStatus_idx" ON "scans"("aiEnabled", "aiStatus");

-- CreateIndex
CREATE INDEX "scans_aiEnabled_createdAt_idx" ON "scans"("aiEnabled", "createdAt");

-- AddForeignKey
ALTER TABLE "ai_campaign_audits" ADD CONSTRAINT "ai_campaign_audits_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ai_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

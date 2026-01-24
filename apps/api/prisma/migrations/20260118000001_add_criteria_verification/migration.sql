-- CreateEnum
CREATE TYPE "CriteriaVerificationStatus" AS ENUM ('PASS', 'FAIL', 'AI_VERIFIED_PASS', 'AI_VERIFIED_FAIL', 'NOT_TESTED');

-- CreateTable
CREATE TABLE "criteria_verifications" (
    "id" UUID NOT NULL,
    "scanResultId" UUID NOT NULL,
    "criterionId" VARCHAR(20) NOT NULL,
    "status" "CriteriaVerificationStatus" NOT NULL,
    "scanner" VARCHAR(100) NOT NULL,
    "confidence" INTEGER,
    "reasoning" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "criteria_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "criteria_verifications_scanResultId_idx" ON "criteria_verifications"("scanResultId");

-- CreateIndex
CREATE INDEX "criteria_verifications_status_idx" ON "criteria_verifications"("status");

-- CreateIndex
CREATE UNIQUE INDEX "criteria_verifications_scanResultId_criterionId_key" ON "criteria_verifications"("scanResultId", "criterionId");

-- AddForeignKey
ALTER TABLE "criteria_verifications" ADD CONSTRAINT "criteria_verifications_scanResultId_fkey" FOREIGN KEY ("scanResultId") REFERENCES "scan_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateJoin table for Issue <-> CriteriaVerification many-to-many relation
CREATE TABLE "_CriteriaIssues" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_CriteriaIssues_AB_unique" ON "_CriteriaIssues"("A", "B");

-- CreateIndex
CREATE INDEX "_CriteriaIssues_B_index" ON "_CriteriaIssues"("B");

-- AddForeignKey
ALTER TABLE "_CriteriaIssues" ADD CONSTRAINT "_CriteriaIssues_A_fkey" FOREIGN KEY ("A") REFERENCES "criteria_verifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CriteriaIssues" ADD CONSTRAINT "_CriteriaIssues_B_fkey" FOREIGN KEY ("B") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

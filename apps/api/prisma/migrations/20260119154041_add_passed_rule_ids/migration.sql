-- AlterTable
ALTER TABLE "_CriteriaIssues" ADD CONSTRAINT "_CriteriaIssues_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_CriteriaIssues_AB_unique";

-- AlterTable
ALTER TABLE "scan_results" ADD COLUMN     "passedRuleIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

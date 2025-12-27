-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "WcagLevel" AS ENUM ('A', 'AA', 'AAA');

-- CreateEnum
CREATE TYPE "IssueImpact" AS ENUM ('CRITICAL', 'SERIOUS', 'MODERATE', 'MINOR');

-- CreateEnum
CREATE TYPE "ReportFormat" AS ENUM ('PDF', 'JSON');

-- CreateTable
CREATE TABLE "guest_sessions" (
    "id" UUID NOT NULL,
    "fingerprint" VARCHAR(255) NOT NULL,
    "sessionToken" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "anonymizedAt" TIMESTAMPTZ,

    CONSTRAINT "guest_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scans" (
    "id" UUID NOT NULL,
    "guestSessionId" UUID,
    "userId" UUID,
    "url" VARCHAR(2048) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "status" "ScanStatus" NOT NULL DEFAULT 'PENDING',
    "wcagLevel" "WcagLevel" NOT NULL DEFAULT 'AA',
    "durationMs" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ,

    CONSTRAINT "scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_results" (
    "id" UUID NOT NULL,
    "scanId" UUID NOT NULL,
    "totalIssues" INTEGER NOT NULL DEFAULT 0,
    "criticalCount" INTEGER NOT NULL DEFAULT 0,
    "seriousCount" INTEGER NOT NULL DEFAULT 0,
    "moderateCount" INTEGER NOT NULL DEFAULT 0,
    "minorCount" INTEGER NOT NULL DEFAULT 0,
    "passedChecks" INTEGER NOT NULL DEFAULT 0,
    "inapplicableChecks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issues" (
    "id" UUID NOT NULL,
    "scanResultId" UUID NOT NULL,
    "ruleId" VARCHAR(100) NOT NULL,
    "wcagCriteria" VARCHAR(20)[],
    "impact" "IssueImpact" NOT NULL,
    "description" TEXT NOT NULL,
    "helpText" TEXT NOT NULL,
    "helpUrl" VARCHAR(2048) NOT NULL,
    "htmlSnippet" TEXT NOT NULL,
    "cssSelector" VARCHAR(1024) NOT NULL,
    "nodes" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "scanId" UUID NOT NULL,
    "format" "ReportFormat" NOT NULL,
    "storageKey" VARCHAR(512) NOT NULL,
    "storageUrl" VARCHAR(2048) NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guest_sessions_sessionToken_key" ON "guest_sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "guest_sessions_fingerprint_idx" ON "guest_sessions"("fingerprint");

-- CreateIndex
CREATE INDEX "guest_sessions_expiresAt_idx" ON "guest_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "guest_sessions_sessionToken_idx" ON "guest_sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "scans_guestSessionId_idx" ON "scans"("guestSessionId");

-- CreateIndex
CREATE INDEX "scans_status_idx" ON "scans"("status");

-- CreateIndex
CREATE INDEX "scans_createdAt_idx" ON "scans"("createdAt");

-- CreateIndex
CREATE INDEX "scans_email_idx" ON "scans"("email");

-- CreateIndex
CREATE UNIQUE INDEX "scan_results_scanId_key" ON "scan_results"("scanId");

-- CreateIndex
CREATE INDEX "scan_results_scanId_idx" ON "scan_results"("scanId");

-- CreateIndex
CREATE INDEX "issues_scanResultId_idx" ON "issues"("scanResultId");

-- CreateIndex
CREATE INDEX "issues_ruleId_idx" ON "issues"("ruleId");

-- CreateIndex
CREATE INDEX "issues_impact_idx" ON "issues"("impact");

-- CreateIndex
CREATE INDEX "reports_scanId_idx" ON "reports"("scanId");

-- CreateIndex
CREATE INDEX "reports_expiresAt_idx" ON "reports"("expiresAt");

-- AddForeignKey
ALTER TABLE "scans" ADD CONSTRAINT "scans_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "guest_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_results" ADD CONSTRAINT "scan_results_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_scanResultId_fkey" FOREIGN KEY ("scanResultId") REFERENCES "scan_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

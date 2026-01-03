-- CreateEnum
CREATE TYPE "DiscoveryStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DiscoveryMode" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "DiscoveryPhase" AS ENUM ('SITEMAP', 'NAVIGATION', 'CRAWLING');

-- CreateEnum
CREATE TYPE "PageSource" AS ENUM ('SITEMAP', 'NAVIGATION', 'CRAWLED', 'MANUAL');

-- CreateTable
CREATE TABLE "discoveries" (
    "id" UUID NOT NULL,
    "sessionId" UUID,
    "homepageUrl" VARCHAR(2048) NOT NULL,
    "mode" "DiscoveryMode" NOT NULL DEFAULT 'AUTO',
    "status" "DiscoveryStatus" NOT NULL DEFAULT 'PENDING',
    "phase" "DiscoveryPhase",
    "maxPages" INTEGER NOT NULL DEFAULT 10,
    "maxDepth" INTEGER NOT NULL DEFAULT 1,
    "partialResults" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "completedAt" TIMESTAMPTZ,
    "errorMessage" TEXT,
    "errorCode" VARCHAR(100),

    CONSTRAINT "discoveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discovered_pages" (
    "id" UUID NOT NULL,
    "discoveryId" UUID NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "title" VARCHAR(500),
    "source" "PageSource" NOT NULL,
    "depth" INTEGER NOT NULL,
    "httpStatus" INTEGER,
    "contentType" VARCHAR(100),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discovered_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discovery_usage" (
    "id" UUID NOT NULL,
    "sessionId" UUID,
    "guestSessionId" UUID,
    "customerId" UUID,
    "month" DATE NOT NULL,
    "discoveryCount" INTEGER NOT NULL DEFAULT 0,
    "pagesDiscovered" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "discovery_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "discoveries_sessionId_createdAt_idx" ON "discoveries"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "discoveries_status_idx" ON "discoveries"("status");

-- CreateIndex
CREATE INDEX "discovered_pages_discoveryId_idx" ON "discovered_pages"("discoveryId");

-- CreateIndex
CREATE INDEX "discovered_pages_source_idx" ON "discovered_pages"("source");

-- CreateIndex
CREATE UNIQUE INDEX "discovered_pages_discoveryId_url_key" ON "discovered_pages"("discoveryId", "url");

-- CreateIndex
CREATE INDEX "discovery_usage_month_idx" ON "discovery_usage"("month");

-- CreateIndex
CREATE UNIQUE INDEX "discovery_usage_customerId_month_key" ON "discovery_usage"("customerId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "discovery_usage_guestSessionId_month_key" ON "discovery_usage"("guestSessionId", "month");

-- AddForeignKey
ALTER TABLE "discovered_pages" ADD CONSTRAINT "discovered_pages_discoveryId_fkey" FOREIGN KEY ("discoveryId") REFERENCES "discoveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

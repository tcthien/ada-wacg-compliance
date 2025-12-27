import { Job } from 'bullmq';
import { getPrismaClient } from '../config/prisma.js';
import { getRedisClient } from '../config/redis.js';

/**
 * Scan Job Data interface
 * Matches the ScanJobData type from shared queue types
 */
interface ScanJobData {
  scanId: string;
  url: string;
  wcagLevel: 'A' | 'AA' | 'AAA';
  userId?: string;
  sessionId?: string;
}

/**
 * Redis key builders matching API's redis-keys.ts
 */
const RedisKeys = {
  SCAN_STATUS: {
    build: (scanId: string) => `scan:${scanId}:status`,
    ttl: 86400, // 24 hours
  },
  SCAN_PROGRESS: {
    build: (scanId: string) => `scan:${scanId}:progress`,
    ttl: 86400, // 24 hours
  },
};

/**
 * Update scan status in Redis cache
 * Matches the format expected by the API's getScanStatus
 */
async function updateRedisStatus(
  scanId: string,
  status: string,
  url: string,
  createdAt: Date,
  completedAt: Date | null = null,
  errorMessage: string | null = null
): Promise<void> {
  const redis = getRedisClient();
  const statusKey = RedisKeys.SCAN_STATUS.build(scanId);

  const statusData = {
    scanId,
    status,
    url,
    createdAt: createdAt.toISOString(),
    completedAt: completedAt?.toISOString() ?? null,
    errorMessage,
  };

  await redis.setex(statusKey, RedisKeys.SCAN_STATUS.ttl, JSON.stringify(statusData));
}

/**
 * Update scan progress in Redis cache
 */
async function updateRedisProgress(scanId: string, progress: number): Promise<void> {
  const redis = getRedisClient();
  const progressKey = RedisKeys.SCAN_PROGRESS.build(scanId);
  await redis.setex(progressKey, RedisKeys.SCAN_PROGRESS.ttl, String(progress));
}

/**
 * Issue impact type matching Prisma enum
 */
type IssueImpact = 'CRITICAL' | 'SERIOUS' | 'MODERATE' | 'MINOR';

/**
 * Mock accessibility issue
 */
interface MockIssue {
  ruleId: string;
  impact: IssueImpact;
  description: string;
  helpText: string;
  helpUrl: string;
  wcagCriteria: string[];
  htmlSnippet: string;
  cssSelector: string;
  nodes: Array<{
    html: string;
    target: string[];
    failureSummary: string;
  }>;
}

/**
 * Generate mock accessibility scan issues
 * TODO: Replace with actual axe-core scan results
 */
function generateMockIssues(): MockIssue[] {
  return [
    {
      ruleId: 'color-contrast',
      impact: 'SERIOUS',
      description: 'Elements must have sufficient color contrast',
      helpText: 'Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/color-contrast',
      wcagCriteria: ['1.4.3'],
      htmlSnippet: '<p class="low-contrast">Sample text with low contrast</p>',
      cssSelector: 'p.low-contrast',
      nodes: [
        {
          html: '<p class="low-contrast">Sample text with low contrast</p>',
          target: ['p.low-contrast'],
          failureSummary: 'Fix any of the following: Element has insufficient color contrast of 3.5:1 (expected 4.5:1)',
        },
      ],
    },
    {
      ruleId: 'image-alt',
      impact: 'MODERATE',
      description: 'Images must have alternate text',
      helpText: 'Ensure <img> elements have alternate text or a role of none or presentation',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/image-alt',
      wcagCriteria: ['1.1.1'],
      htmlSnippet: '<img src="logo.png">',
      cssSelector: 'img[src="logo.png"]',
      nodes: [
        {
          html: '<img src="logo.png">',
          target: ['img[src="logo.png"]'],
          failureSummary: 'Fix any of the following: Element does not have an alt attribute',
        },
      ],
    },
    {
      ruleId: 'link-name',
      impact: 'MINOR',
      description: 'Links must have discernible text',
      helpText: 'Ensure links have discernible text',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/link-name',
      wcagCriteria: ['4.1.2'],
      htmlSnippet: '<a href="/page"><i class="icon"></i></a>',
      cssSelector: 'a[href="/page"]',
      nodes: [
        {
          html: '<a href="/page"><i class="icon"></i></a>',
          target: ['a[href="/page"]'],
          failureSummary: 'Fix all of the following: Element is in tab order and does not have accessible text',
        },
      ],
    },
  ];
}

/**
 * Scan Page Processor
 *
 * Processes accessibility scans on web pages using Playwright and axe-core.
 * Currently uses mock data - actual axe-core integration is planned for future task.
 *
 * @param job - BullMQ job containing scan parameters
 * @returns Scan result data
 */
export async function processScanPage(job: Job<ScanJobData>): Promise<void> {
  const { scanId, url, wcagLevel, userId, sessionId } = job.data;
  const prisma = getPrismaClient();
  const startTime = Date.now();

  console.log(`📊 Processing scan job: ${job.id}`);
  console.log(`   Scan ID: ${scanId}`);
  console.log(`   URL: ${url}`);
  console.log(`   WCAG Level: ${wcagLevel}`);
  console.log(`   User ID: ${userId ?? 'guest'}`);
  console.log(`   Session ID: ${sessionId ?? 'N/A'}`);

  try {
    // Get scan to retrieve createdAt
    const scan = await prisma.scan.findUnique({
      where: { id: scanId },
      select: { createdAt: true },
    });

    if (!scan) {
      throw new Error(`Scan not found: ${scanId}`);
    }

    // Update scan status to RUNNING
    await prisma.scan.update({
      where: { id: scanId },
      data: { status: 'RUNNING' },
    });

    // Update Redis cache with new status
    await updateRedisStatus(scanId, 'RUNNING', url, scan.createdAt);
    await updateRedisProgress(scanId, 10);
    console.log(`   Status: RUNNING`);

    // Update job progress
    await job.updateProgress(10);

    // TODO: Implement actual scanning logic
    // 1. Launch Playwright browser
    // 2. Navigate to URL
    // 3. Inject axe-core
    // 4. Run accessibility scan

    // Simulate processing time
    await job.updateProgress(30);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await job.updateProgress(60);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Generate mock scan issues
    const mockIssues = generateMockIssues();

    // Count issues by impact
    const criticalCount = mockIssues.filter((i) => i.impact === 'CRITICAL').length;
    const seriousCount = mockIssues.filter((i) => i.impact === 'SERIOUS').length;
    const moderateCount = mockIssues.filter((i) => i.impact === 'MODERATE').length;
    const minorCount = mockIssues.filter((i) => i.impact === 'MINOR').length;

    await job.updateProgress(80);

    // Create ScanResult and Issues in a transaction
    await prisma.$transaction(async (tx) => {
      // Create ScanResult
      const scanResult = await tx.scanResult.create({
        data: {
          scanId,
          totalIssues: mockIssues.length,
          criticalCount,
          seriousCount,
          moderateCount,
          minorCount,
          passedChecks: 45, // Mock value
          inapplicableChecks: 12, // Mock value
        },
      });

      // Create Issues
      for (const issue of mockIssues) {
        await tx.issue.create({
          data: {
            scanResultId: scanResult.id,
            ruleId: issue.ruleId,
            wcagCriteria: issue.wcagCriteria,
            impact: issue.impact,
            description: issue.description,
            helpText: issue.helpText,
            helpUrl: issue.helpUrl,
            htmlSnippet: issue.htmlSnippet,
            cssSelector: issue.cssSelector,
            nodes: issue.nodes,
          },
        });
      }

      // Update scan status to COMPLETED
      const durationMs = Date.now() - startTime;
      const completedAt = new Date();
      await tx.scan.update({
        where: { id: scanId },
        data: {
          status: 'COMPLETED',
          completedAt,
          durationMs,
        },
      });

      // Update Redis cache with completed status
      await updateRedisStatus(scanId, 'COMPLETED', url, scan.createdAt, completedAt);
      await updateRedisProgress(scanId, 100);
    });

    await job.updateProgress(100);
    console.log(`✅ Completed scan job: ${job.id} (${Date.now() - startTime}ms)`);
  } catch (error) {
    console.error(`❌ Failed scan job: ${job.id}`, error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    // Get scan createdAt for Redis update
    const failedScan = await prisma.scan.findUnique({
      where: { id: scanId },
      select: { createdAt: true },
    });

    // Update scan status to FAILED
    await prisma.scan.update({
      where: { id: scanId },
      data: {
        status: 'FAILED',
        errorMessage,
      },
    });

    // Update Redis cache with failed status
    if (failedScan) {
      await updateRedisStatus(scanId, 'FAILED', url, failedScan.createdAt, null, errorMessage);
      await updateRedisProgress(scanId, 0);
    }

    throw error;
  }
}

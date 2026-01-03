import { Job, Queue } from 'bullmq';
import { getPrismaClient } from '../config/prisma.js';
import { getRedisClient, getBullMQConnection } from '../config/redis.js';
import { logEvent } from '../services/scan-event.service.js';
import { notifyScanComplete } from '../services/batch-status.service.js';
import { addEmailJob } from '../jobs/email-queue.js';

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
  email?: string;
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
 * Categorize issues by WCAG principle (POUR)
 *
 * Groups issues based on their WCAG criteria into the four main principles:
 * - Perceivable (1.x.x): Information must be presentable to users
 * - Operable (2.x.x): UI components must be operable
 * - Understandable (3.x.x): Information and UI must be understandable
 * - Robust (4.x.x): Content must be robust enough for assistive technologies
 *
 * @param issues - Array of accessibility issues
 * @returns Object mapping category names to their issues
 */
function categorizeIssues(issues: MockIssue[]): Record<string, MockIssue[]> {
  const categories: Record<string, MockIssue[]> = {
    Perceivable: [],
    Operable: [],
    Understandable: [],
    Robust: [],
  };

  for (const issue of issues) {
    // Categorize based on first WCAG criterion (principle digit)
    const firstCriterion = issue.wcagCriteria[0];
    if (!firstCriterion) {
      continue;
    }

    const principle = firstCriterion[0]; // First digit: 1=Perceivable, 2=Operable, 3=Understandable, 4=Robust

    switch (principle) {
      case '1':
        categories['Perceivable']!.push(issue);
        break;
      case '2':
        categories['Operable']!.push(issue);
        break;
      case '3':
        categories['Understandable']!.push(issue);
        break;
      case '4':
        categories['Robust']!.push(issue);
        break;
    }
  }

  return categories;
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
/**
 * Format wait time in human-readable format
 */
function formatWaitTime(seconds: number): string {
  if (seconds < 60) {
    return `~${Math.ceil(seconds)} seconds`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  if (remainingSeconds === 0) {
    return `~${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
  return `~${minutes} minute${minutes > 1 ? 's' : ''} ${remainingSeconds} seconds`;
}

/**
 * Queue name constant - must match the queue name used in the worker
 */
const SCAN_PAGE_QUEUE_NAME = 'scan-page';

/**
 * Lazy-loaded queue instance for accessing queue metrics
 */
let queueInstance: Queue<ScanJobData> | null = null;

/**
 * Get or create queue instance for metrics access
 */
function getQueueInstance(): Queue<ScanJobData> {
  if (!queueInstance) {
    queueInstance = new Queue<ScanJobData>(SCAN_PAGE_QUEUE_NAME, {
      connection: getBullMQConnection(),
    });
  }
  return queueInstance;
}

/**
 * Calculate estimated wait time based on queue metrics
 */
async function calculateEstimatedWaitTime(job: Job<ScanJobData>): Promise<{
  position: number;
  estimatedWaitSeconds: number;
}> {
  try {
    // Get queue instance for metrics
    const queue = getQueueInstance();

    // Get queue counts - waiting jobs ahead of this one
    const waitingCount = await queue.getWaitingCount();

    // Position in queue is approximately the number of waiting jobs
    // (since this job is now active/processing, it's not in waiting anymore)
    const position = waitingCount;

    // Average processing time per scan (estimated from typical scans)
    // This is a conservative estimate - actual time varies by page complexity
    const avgProcessingTimeSeconds = 45; // ~45 seconds average

    // Estimate wait time: position * average time / concurrency
    // Assuming concurrency of 1-2 workers processing in parallel
    const workerConcurrency = 2; // Conservative estimate
    const estimatedWaitSeconds = (position * avgProcessingTimeSeconds) / workerConcurrency;

    return {
      position,
      estimatedWaitSeconds,
    };
  } catch (error) {
    // If queue metrics fail, return conservative estimates
    console.error('Failed to calculate queue wait time:', error);
    return {
      position: 0,
      estimatedWaitSeconds: 0,
    };
  }
}

export async function processScanPage(job: Job<ScanJobData>): Promise<void> {
  const { scanId, url, wcagLevel, userId, sessionId, email } = job.data;
  const prisma = getPrismaClient();
  const startTime = Date.now();

  console.log(`📊 Processing scan job: ${job.id}`);
  console.log(`   Scan ID: ${scanId}`);
  console.log(`   URL: ${url}`);
  console.log(`   WCAG Level: ${wcagLevel}`);
  console.log(`   User ID: ${userId ?? 'guest'}`);
  console.log(`   Session ID: ${sessionId ?? 'N/A'}`);
  console.log(`   Email: ${email ?? 'N/A'}`);

  // Calculate queue position and wait time
  const { position, estimatedWaitSeconds } = await calculateEstimatedWaitTime(job);

  // Log QUEUE wait time event (public - users can see their position)
  if (position > 0) {
    await logEvent({
      scanId,
      type: 'QUEUE',
      level: 'INFO',
      message: `Position in queue: ${position}. Estimated wait: ${formatWaitTime(estimatedWaitSeconds)}`,
      metadata: {
        queuePosition: position,
        estimatedWaitSeconds,
        estimatedWaitFormatted: formatWaitTime(estimatedWaitSeconds),
      },
      adminOnly: false, // Public event - users should see their queue position
    });
  }

  // Log QUEUE event (admin-only internal queue info)
  await logEvent({
    scanId,
    type: 'QUEUE',
    level: 'INFO',
    message: `Scan job dequeued for processing`,
    metadata: {
      jobId: job.id,
      queuePosition: position,
      wcagLevel,
      attemptsMade: job.attemptsMade,
    },
    adminOnly: true,
  });

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

    // Log INIT event
    await logEvent({
      scanId,
      type: 'INIT',
      level: 'INFO',
      message: `Initializing scan for ${url}`,
      metadata: {
        url,
        wcagLevel,
        userId: userId ?? null,
      },
      adminOnly: false,
    });

    // Update job progress
    await job.updateProgress(10);

    // TODO: Implement actual scanning logic
    // 1. Launch Playwright browser
    // 2. Navigate to URL
    // 3. Inject axe-core
    // 4. Run accessibility scan

    // Log FETCH start event
    await logEvent({
      scanId,
      type: 'FETCH',
      level: 'INFO',
      message: `Fetching page: ${url}`,
      metadata: {
        url,
      },
      adminOnly: false,
    });

    // Simulate page fetching (TODO: Replace with actual Playwright navigation)
    const fetchStartTime = Date.now();

    try {
      // Simulate processing time (TODO: Replace with actual page.goto())
      await job.updateProgress(30);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const loadTime = Date.now() - fetchStartTime;

      // Log FETCH success event
      await logEvent({
        scanId,
        type: 'FETCH',
        level: 'INFO',
        message: `Page loaded successfully (${loadTime}ms)`,
        metadata: {
          url,
          loadTime,
        },
        adminOnly: false,
      });
    } catch (fetchError) {
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown fetch error';
      const stackTrace = fetchError instanceof Error ? fetchError.stack : undefined;

      // Log FETCH error event with user-friendly message
      await logEvent({
        scanId,
        type: 'FETCH',
        level: 'ERROR',
        message: `Failed to load page: ${errorMessage}. Page might be blocking automated access`,
        metadata: {
          url,
          error: errorMessage,
          stackTrace,
          suggestion: 'Page might be blocking automated access, check robots.txt or CAPTCHA',
        },
        adminOnly: false, // User-friendly message is public
      });

      // Log detailed error info for admins only
      await logEvent({
        scanId,
        type: 'FETCH',
        level: 'ERROR',
        message: `FETCH error stack trace`,
        metadata: {
          url,
          error: errorMessage,
          stackTrace,
        },
        adminOnly: true, // Stack trace is admin-only
      });

      throw fetchError; // Re-throw to trigger overall error handling
    }

    await job.updateProgress(60);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Log ANALYSIS start event
    await logEvent({
      scanId,
      type: 'ANALYSIS',
      level: 'INFO',
      message: `Running accessibility checks...`,
      metadata: {
        wcagLevel,
      },
      adminOnly: false,
    });

    // Generate mock scan issues
    // TODO: Replace with actual axe-core accessibility analysis
    const mockIssues = generateMockIssues();

    // Group issues by WCAG principle (Perceivable, Operable, Understandable, Robust)
    const issuesByCategory = categorizeIssues(mockIssues);

    // Log per-category analysis progress
    for (const [categoryName, categoryIssues] of Object.entries(issuesByCategory)) {
      // Log category check start
      await logEvent({
        scanId,
        type: 'ANALYSIS',
        level: 'INFO',
        message: `Checking: ${categoryName}`,
        metadata: {
          category: categoryName,
        },
        adminOnly: false,
      });

      // Determine log level based on issue severity in this category
      const hasCritical = categoryIssues.some((i) => i.impact === 'CRITICAL');
      const hasSerious = categoryIssues.some((i) => i.impact === 'SERIOUS');
      const logLevel = hasCritical || hasSerious ? 'ERROR' : categoryIssues.length > 0 ? 'WARNING' : 'SUCCESS';

      // Log category check results
      await logEvent({
        scanId,
        type: 'ANALYSIS',
        level: logLevel,
        message: `Found ${categoryIssues.length} issues in ${categoryName}`,
        metadata: {
          category: categoryName,
          issueCount: categoryIssues.length,
          criticalCount: categoryIssues.filter((i) => i.impact === 'CRITICAL').length,
          seriousCount: categoryIssues.filter((i) => i.impact === 'SERIOUS').length,
          moderateCount: categoryIssues.filter((i) => i.impact === 'MODERATE').length,
          minorCount: categoryIssues.filter((i) => i.impact === 'MINOR').length,
        },
        adminOnly: false,
      });
    }

    // Log ANALYSIS completion event
    await logEvent({
      scanId,
      type: 'ANALYSIS',
      level: 'INFO',
      message: `Accessibility analysis complete`,
      metadata: {
        totalIssues: mockIssues.length,
        wcagLevel,
      },
      adminOnly: false,
    });

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

    // Calculate total scan time
    const totalTime = Date.now() - startTime;

    // Log RESULT event with total issues count
    await logEvent({
      scanId,
      type: 'RESULT',
      level: mockIssues.length === 0 ? 'SUCCESS' : 'WARNING',
      message: `Scan completed! Found ${mockIssues.length} accessibility issues`,
      metadata: {
        totalIssues: mockIssues.length,
        criticalCount,
        seriousCount,
        moderateCount,
        minorCount,
      },
      adminOnly: false,
    });

    // Log DEBUG event with performance metrics (admin-only)
    const memoryUsage = process.memoryUsage();
    await logEvent({
      scanId,
      type: 'DEBUG',
      level: 'DEBUG',
      message: `Scan performance metrics`,
      metadata: {
        totalTime,
        memoryUsage: {
          rss: memoryUsage.rss,
          heapTotal: memoryUsage.heapTotal,
          heapUsed: memoryUsage.heapUsed,
          external: memoryUsage.external,
        },
        issuesBreakdown: {
          critical: criticalCount,
          serious: seriousCount,
          moderate: moderateCount,
          minor: minorCount,
          total: mockIssues.length,
        },
      },
      adminOnly: true,
    });

    console.log(`✅ Completed scan job: ${job.id} (${totalTime}ms)`);

    // Notify batch status service that scan completed
    try {
      const batchResult = await notifyScanComplete(scanId, 'COMPLETED');
      if (batchResult?.isComplete) {
        console.log(
          `🎯 Batch ${batchResult.batchId} completed with status ${batchResult.status} (${batchResult.completedCount}/${batchResult.totalUrls} scans)`
        );
      }
    } catch (batchError) {
      // Log error but don't fail the scan - batch status is secondary
      console.error('⚠️ Failed to update batch status:', batchError);
    }

    // Queue email notification if email provided
    if (email) {
      try {
        const emailJob = await addEmailJob({
          scanId,
          email,
          type: 'scan_complete',
        });
        console.log(`📧 Queued scan_complete email for scan ${scanId} to ${email} (job: ${emailJob.id})`);
      } catch (emailError) {
        // Log error but don't fail the scan - email notification is non-critical
        const errorMessage = emailError instanceof Error ? emailError.message : 'Unknown error';
        console.error(`⚠️ Failed to queue scan_complete email for scan ${scanId}:`, errorMessage);
      }
    }
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

    // Notify batch status service that scan failed
    try {
      const batchResult = await notifyScanComplete(scanId, 'FAILED');
      if (batchResult?.isComplete) {
        console.log(
          `🎯 Batch ${batchResult.batchId} completed with status ${batchResult.status} (${batchResult.completedCount}/${batchResult.totalUrls} scans, ${batchResult.failedCount} failed)`
        );
      }
    } catch (batchError) {
      // Log error but don't fail the scan - batch status is secondary
      console.error('⚠️ Failed to update batch status:', batchError);
    }

    // Queue failure notification email if email provided
    if (email) {
      try {
        const emailJob = await addEmailJob({
          scanId,
          email,
          type: 'scan_failed',
        });
        console.log(`📧 Queued scan_failed email for scan ${scanId} to ${email} (job: ${emailJob.id})`);
      } catch (emailError) {
        // Log error but don't fail the scan - email notification is non-critical
        const errMsg = emailError instanceof Error ? emailError.message : 'Unknown error';
        console.error(`⚠️ Failed to queue scan_failed email for scan ${scanId}:`, errMsg);
      }
    }

    throw error;
  }
}

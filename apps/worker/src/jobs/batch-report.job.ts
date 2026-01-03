import type { Job } from 'bullmq';
import { getPrismaClient } from '../config/prisma.js';
import {
  exportBatchJson,
  uploadBatchJsonToS3,
  type BatchJsonInput,
} from '../processors/reporter/batch-json-exporter.js';
import {
  exportBatchPdf,
  uploadBatchPdfToS3,
  type BatchPdfInput,
  type BatchMetadata,
  type BatchAggregate,
  type UrlBreakdown,
} from '../processors/reporter/batch-pdf-generator.js';
import type { EnrichedIssue } from '../utils/result-formatter.js';

/**
 * Batch Report Job Processor
 *
 * Generates PDF or JSON reports for batch scans asynchronously.
 * Works with the report queue to handle large batch exports without
 * blocking the API response.
 *
 * Workflow:
 * 1. Fetch batch results from database (scans + issues)
 * 2. Transform data to exporter input format
 * 3. Generate report (PDF or JSON)
 * 4. Upload to S3
 * 5. Update report record with storage key and status
 *
 * Retry strategy:
 * - 3 attempts with exponential backoff
 * - Handles transient S3 failures gracefully
 */

/**
 * Queue name for batch report generation jobs
 */
export const BATCH_REPORT_QUEUE_NAME = 'batch-report';

/**
 * Job name for batch report generation
 */
export const BATCH_REPORT_JOB_NAME = 'generate-batch-report';

/**
 * Supported report formats
 */
export type BatchReportFormat = 'pdf' | 'json';

/**
 * Job data structure for batch-report jobs
 */
export interface BatchReportJobData {
  /** Batch scan ID */
  batchId: string;

  /** Report format to generate */
  format: BatchReportFormat;

  /** Report record ID (for status updates) */
  reportId: string;

  /** Optional: Admin ID if this is an admin-initiated export */
  adminId?: string;

  /** Optional: Guest session ID if this is a user-initiated export */
  guestSessionId?: string;
}

/**
 * Job result structure
 */
export interface BatchReportJobResult {
  /** Report record ID */
  reportId: string;

  /** Batch scan ID */
  batchId: string;

  /** Report format that was generated */
  format: BatchReportFormat;

  /** S3 storage key */
  storageKey: string;

  /** S3 storage URL */
  storageUrl: string;

  /** File size in bytes */
  fileSizeBytes: number;

  /** Final status */
  status: 'COMPLETED' | 'FAILED';

  /** Error message if failed */
  errorMessage?: string;
}

/**
 * Job options for batch report generation
 * Configured for reliability with exponential backoff
 */
export const BATCH_REPORT_JOB_OPTIONS = {
  /** Number of retry attempts */
  attempts: 3,

  /** Backoff strategy */
  backoff: {
    type: 'exponential' as const,
    delay: 5000, // Start with 5 second delay
  },

  /** Remove completed jobs after 24 hours */
  removeOnComplete: {
    age: 24 * 60 * 60, // 24 hours in seconds
  },

  /** Keep failed jobs for debugging */
  removeOnFail: false,
};

/**
 * Fetch batch data with all scans and issues from database
 *
 * @param batchId - Batch scan ID
 * @returns Batch data with scans and issues
 */
async function fetchBatchData(batchId: string) {
  const prisma = getPrismaClient();

  const batch = await prisma.batchScan.findUnique({
    where: { id: batchId },
    include: {
      scans: {
        include: {
          scanResult: {
            include: {
              issues: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!batch) {
    throw new Error(`Batch not found: ${batchId}`);
  }

  return batch;
}

/**
 * Transform database batch data to JSON exporter input format
 *
 * @param batch - Batch data from database
 * @returns BatchJsonInput for JSON export
 */
function transformToBatchJsonInput(batch: Awaited<ReturnType<typeof fetchBatchData>>): BatchJsonInput {
  return {
    batchId: batch.id,
    homepageUrl: batch.homepageUrl,
    wcagLevel: batch.wcagLevel,
    totalUrls: batch.totalUrls,
    completedCount: batch.completedCount,
    failedCount: batch.failedCount,
    createdAt: batch.createdAt,
    completedAt: batch.completedAt,
    aggregateStats: batch.totalIssues !== null
      ? {
          totalIssues: batch.totalIssues,
          criticalCount: batch.criticalCount ?? 0,
          seriousCount: batch.seriousCount ?? 0,
          moderateCount: batch.moderateCount ?? 0,
          minorCount: batch.minorCount ?? 0,
        }
      : undefined,
    urlResults: batch.scans.map((scan) => ({
      scanId: scan.id,
      url: scan.url,
      pageTitle: scan.pageTitle,
      status: scan.status,
      completedAt: scan.completedAt,
      durationMs: scan.durationMs,
      result: scan.scanResult
        ? {
            totalIssues: scan.scanResult.totalIssues,
            criticalCount: scan.scanResult.criticalCount,
            seriousCount: scan.scanResult.seriousCount,
            moderateCount: scan.scanResult.moderateCount,
            minorCount: scan.scanResult.minorCount,
            passedChecks: scan.scanResult.passedChecks,
            issues: scan.scanResult.issues.map((issue) => ({
              id: issue.id,
              ruleId: issue.ruleId,
              impact: issue.impact,
              description: issue.description,
              helpText: issue.helpText,
              helpUrl: issue.helpUrl,
              wcagCriteria: issue.wcagCriteria,
              htmlSnippet: issue.htmlSnippet,
              cssSelector: issue.cssSelector,
            })),
          }
        : undefined,
    })),
  };
}

/**
 * Transform database batch data to PDF generator input format
 *
 * @param batch - Batch data from database
 * @returns BatchPdfInput for PDF generation
 */
function transformToBatchPdfInput(batch: Awaited<ReturnType<typeof fetchBatchData>>): BatchPdfInput {
  // Calculate aggregate statistics
  let totalIssues = 0;
  let criticalCount = 0;
  let seriousCount = 0;
  let moderateCount = 0;
  let minorCount = 0;
  let passedChecks = 0;

  for (const scan of batch.scans) {
    if (scan.scanResult) {
      totalIssues += scan.scanResult.totalIssues;
      criticalCount += scan.scanResult.criticalCount;
      seriousCount += scan.scanResult.seriousCount;
      moderateCount += scan.scanResult.moderateCount;
      minorCount += scan.scanResult.minorCount;
      passedChecks += scan.scanResult.passedChecks;
    }
  }

  const metadata: BatchMetadata = {
    batchId: batch.id,
    homepageUrl: batch.homepageUrl,
    totalUrls: batch.totalUrls,
    completedCount: batch.completedCount,
    failedCount: batch.failedCount,
    wcagLevel: batch.wcagLevel,
    createdAt: batch.createdAt,
    completedAt: batch.completedAt,
    status: batch.status,
  };

  const aggregate: BatchAggregate = {
    totalIssues,
    criticalCount,
    seriousCount,
    moderateCount,
    minorCount,
    passedChecks,
    urlsScanned: batch.completedCount,
  };

  // Identify top 5 URLs with highest critical issues
  const topCriticalUrls = batch.scans
    .filter((scan) => scan.scanResult && scan.scanResult.criticalCount > 0)
    .sort((a, b) => (b.scanResult?.criticalCount ?? 0) - (a.scanResult?.criticalCount ?? 0))
    .slice(0, 5)
    .map((scan) => ({
      url: scan.url,
      pageTitle: scan.pageTitle,
      criticalCount: scan.scanResult?.criticalCount ?? 0,
    }));

  // Transform URL breakdowns
  const urlBreakdowns: UrlBreakdown[] = batch.scans
    .filter((scan) => scan.scanResult)
    .map((scan) => {
      const result = scan.scanResult!;

      // Group issues by impact
      const issuesByImpact = {
        critical: [] as EnrichedIssue[],
        serious: [] as EnrichedIssue[],
        moderate: [] as EnrichedIssue[],
        minor: [] as EnrichedIssue[],
      };

      for (const issue of result.issues) {
        // Normalize impact to uppercase IssueImpact type
        const normalizedImpact = issue.impact.toUpperCase() as 'CRITICAL' | 'SERIOUS' | 'MODERATE' | 'MINOR';

        const enrichedIssue: EnrichedIssue = {
          id: issue.id,
          ruleId: issue.ruleId,
          impact: normalizedImpact,
          description: issue.description,
          helpText: issue.helpText,
          helpUrl: issue.helpUrl,
          wcagCriteria: issue.wcagCriteria,
          htmlSnippet: issue.htmlSnippet,
          cssSelector: issue.cssSelector,
          nodes: (issue.nodes ?? []) as unknown as EnrichedIssue['nodes'],
        };

        const impactKey = issue.impact.toLowerCase() as keyof typeof issuesByImpact;
        if (impactKey in issuesByImpact) {
          issuesByImpact[impactKey].push(enrichedIssue);
        }
      }

      return {
        url: scan.url,
        pageTitle: scan.pageTitle,
        summary: {
          totalIssues: result.totalIssues,
          critical: result.criticalCount,
          serious: result.seriousCount,
          moderate: result.moderateCount,
          minor: result.minorCount,
          passed: result.passedChecks,
        },
        issuesByImpact,
      };
    });

  return {
    metadata,
    aggregate,
    topCriticalUrls,
    urlBreakdowns,
  };
}

/**
 * Update report record with result
 *
 * @param reportId - Report record ID
 * @param result - Generation result (success or failure)
 */
async function updateReportRecord(
  reportId: string,
  result: {
    status: 'COMPLETED' | 'FAILED';
    storageKey?: string;
    storageUrl?: string;
    fileSizeBytes?: number;
    errorMessage?: string;
  }
): Promise<void> {
  const prisma = getPrismaClient();

  await prisma.report.update({
    where: { id: reportId },
    data: {
      status: result.status,
      storageKey: result.storageKey ?? '',
      storageUrl: result.storageUrl ?? '',
      fileSizeBytes: result.fileSizeBytes ?? 0,
    },
  });
}

/**
 * Process batch report generation job
 *
 * @param job - BullMQ job with BatchReportJobData
 * @returns Job result with report details
 *
 * @example
 * ```typescript
 * // Register with worker
 * worker.process(BATCH_REPORT_JOB_NAME, processBatchReportJob);
 * ```
 */
export async function processBatchReportJob(
  job: Job<BatchReportJobData>
): Promise<BatchReportJobResult> {
  const { batchId, format, reportId } = job.data;

  console.log(`[Batch-Report-Job] Starting ${format.toUpperCase()} generation for batch ${batchId}`);

  try {
    // Step 1: Fetch batch data with all scans and issues
    const batch = await fetchBatchData(batchId);
    console.log(`[Batch-Report-Job] Fetched batch with ${batch.scans.length} scans`);

    let storageKey: string;
    let storageUrl: string;
    let fileSizeBytes: number;

    // Step 2: Generate and upload report based on format
    if (format === 'json') {
      // Generate JSON report
      const jsonInput = transformToBatchJsonInput(batch);
      const { buffer, key } = await exportBatchJson(jsonInput);
      storageKey = key;
      fileSizeBytes = buffer.length;

      // Upload to S3
      storageUrl = await uploadBatchJsonToS3(buffer, key);
    } else {
      // Generate PDF report
      const pdfInput = transformToBatchPdfInput(batch);
      const { buffer, key } = await exportBatchPdf(pdfInput);
      storageKey = key;
      fileSizeBytes = buffer.length;

      // Upload to S3
      storageUrl = await uploadBatchPdfToS3(buffer, key);
    }

    // Step 3: Update report record with success
    await updateReportRecord(reportId, {
      status: 'COMPLETED',
      storageKey,
      storageUrl,
      fileSizeBytes,
    });

    console.log(`[Batch-Report-Job] Successfully generated ${format.toUpperCase()} report: ${storageKey}`);

    return {
      reportId,
      batchId,
      format,
      storageKey,
      storageUrl,
      fileSizeBytes,
      status: 'COMPLETED',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Batch-Report-Job] Failed to generate report: ${errorMessage}`);

    // Update report record with failure
    await updateReportRecord(reportId, {
      status: 'FAILED',
      errorMessage,
    });

    return {
      reportId,
      batchId,
      format,
      storageKey: '',
      storageUrl: '',
      fileSizeBytes: 0,
      status: 'FAILED',
      errorMessage,
    };
  }
}

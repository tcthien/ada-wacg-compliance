/**
 * Batch Export Service
 *
 * Handles PDF and JSON export generation for batch scans.
 * Supports both synchronous (direct) and asynchronous (job-based) generation.
 * Uses dynamic imports to avoid TypeScript cross-package compilation issues.
 */

import type { WcagLevel, ReportFormat } from '@prisma/client';
import { Queue } from 'bullmq';
import { getBullMQConnection } from '../../config/redis.js';
import { getPresignedUrl } from '@adashield/core/storage';
import {
  getReportByBatchAndFormat,
  createPendingBatchReport,
  getReportById,
  resetReportToPending,
} from '../reports/report.repository.js';

/**
 * Batch export service error
 */
export class BatchExportError extends Error {
  public readonly code: string;
  public readonly cause?: Error | undefined;

  constructor(message: string, code: string, cause?: Error | undefined) {
    super(message);
    this.name = 'BatchExportError';
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Batch metadata for PDF generation
 */
interface BatchMetadata {
  batchId: string;
  homepageUrl: string;
  totalUrls: number;
  completedCount: number;
  failedCount: number;
  wcagLevel: WcagLevel;
  createdAt: Date;
  completedAt: Date | null;
  status: string;
}

/**
 * Aggregate statistics for PDF generation
 */
interface BatchAggregate {
  totalIssues: number;
  criticalCount: number;
  seriousCount: number;
  moderateCount: number;
  minorCount: number;
  passedChecks: number;
  urlsScanned: number;
}

/**
 * Top critical URL for PDF generation
 */
interface TopCriticalUrl {
  scanId: string;
  url: string;
  pageTitle: string | null;
  criticalCount: number;
}

/**
 * Input for batch PDF generation
 */
export interface BatchPdfInput {
  metadata: BatchMetadata;
  aggregate: BatchAggregate;
  topCriticalUrls: TopCriticalUrl[];
}

/**
 * Generate batch PDF report
 *
 * Uses dynamic import to load batch-pdf-generator from worker package.
 * This avoids TypeScript rootDir compilation issues.
 *
 * Requirements:
 * - 4.1: User can export batch results in PDF format
 * - 4.5: PDF shall include executive summary with aggregate statistics
 *
 * @param input - Batch data for PDF generation
 * @returns Promise resolving to PDF buffer
 * @throws {BatchExportError} If PDF generation fails
 *
 * @example
 * ```typescript
 * const input = {
 *   metadata: { batchId, homepageUrl, totalUrls, ... },
 *   aggregate: { totalIssues, criticalCount, ... },
 *   topCriticalUrls: [...]
 * };
 * const pdfBuffer = await generateBatchPdf(input);
 * ```
 */
export async function generateBatchPdf(input: BatchPdfInput): Promise<Buffer> {
  try {
    // Dynamic import to avoid TypeScript cross-package issues
    const batchPdfModule = await import(
      '../../../../worker/dist/processors/reporter/batch-pdf-generator.js'
    );

    // Call the generateBatchPdfReport function
    const pdfBuffer = await batchPdfModule.generateBatchPdfReport(input);

    return pdfBuffer;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Batch Export Service: Failed to generate PDF:', err.message);
    throw new BatchExportError(
      'Failed to generate batch PDF report',
      'PDF_GENERATION_FAILED',
      err
    );
  }
}

// ============================================================================
// ASYNC BATCH EXPORT (Job-based generation with caching)
// ============================================================================

/**
 * Queue name for batch report generation - must match worker
 */
const BATCH_REPORT_QUEUE_NAME = 'batch-report';

/**
 * Queue instance for batch report jobs
 */
let batchReportQueue: Queue | null = null;

/**
 * Get or create the batch report queue
 */
function getBatchReportQueue(): Queue {
  if (!batchReportQueue) {
    batchReportQueue = new Queue(BATCH_REPORT_QUEUE_NAME, {
      connection: getBullMQConnection(),
    });
  }
  return batchReportQueue;
}

/**
 * Batch export request input
 */
export interface BatchExportRequest {
  batchId: string;
  format: 'pdf' | 'json';
  guestSessionId?: string;
  adminId?: string;
}

/**
 * Batch export response
 */
export interface BatchExportResponse {
  status: 'ready' | 'generating' | 'failed';
  url?: string;
  expiresAt?: string;
  reportId?: string;
  errorMessage?: string;
}

/**
 * Request batch export with async job support
 *
 * Checks if a report already exists in the database.
 * If exists and completed, returns presigned URL.
 * If not exists, creates pending record and queues generation job.
 *
 * Requirements:
 * - 1.1: User can export batch scan results in PDF format
 * - 2.1: User can export batch scan results in JSON format
 * - 1.5, 2.5: Async generation with job queue
 *
 * @param request - Export request parameters
 * @returns Export response with status and URL (if ready)
 * @throws {BatchExportError} If export request fails
 *
 * @example
 * ```typescript
 * const response = await requestBatchExport({
 *   batchId: '123',
 *   format: 'pdf',
 *   guestSessionId: 'session-456'
 * });
 *
 * if (response.status === 'ready') {
 *   // Download from response.url
 * } else {
 *   // Poll getBatchExportStatus() until ready
 * }
 * ```
 */
export async function requestBatchExport(
  request: BatchExportRequest
): Promise<BatchExportResponse> {
  const { batchId, format, guestSessionId, adminId } = request;

  try {
    // Step 1: Check if report already exists
    const existingReport = await getReportByBatchAndFormat(
      batchId,
      format.toUpperCase() as ReportFormat
    );

    if (existingReport) {
      // Check report status
      if (existingReport.status === 'COMPLETED' && existingReport.storageKey) {
        // Report ready - generate presigned URL
        const presignedUrl = await getPresignedUrl(existingReport.storageKey);
        return {
          status: 'ready',
          url: presignedUrl,
          expiresAt: existingReport.expiresAt.toISOString(),
          reportId: existingReport.id,
        };
      }

      if (existingReport.status === 'GENERATING' || existingReport.status === 'PENDING') {
        // Already generating
        return {
          status: 'generating',
          reportId: existingReport.id,
        };
      }

      if (existingReport.status === 'FAILED') {
        // Previous attempt failed - reset and retry
        console.log(`[BatchExport] Previous report ${existingReport.id} failed, resetting for retry`);
        const resetReport = await resetReportToPending(existingReport.id);

        // Step 3: Queue generation job for reset report
        const queue = getBatchReportQueue();
        await queue.add(
          'generate-batch-report',
          {
            batchId,
            format,
            reportId: resetReport.id,
            guestSessionId,
            adminId,
          },
          {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 5000,
            },
          }
        );

        console.log(`[BatchExport] Queued ${format.toUpperCase()} retry for batch ${batchId}`);

        return {
          status: 'generating',
          reportId: resetReport.id,
        };
      }
    }

    // Step 2: Create pending report record (no existing report)
    const pendingReport = await createPendingBatchReport(
      batchId,
      format.toUpperCase() as ReportFormat
    );

    // Step 3: Queue generation job
    const queue = getBatchReportQueue();
    await queue.add(
      'generate-batch-report',
      {
        batchId,
        format,
        reportId: pendingReport.id,
        guestSessionId,
        adminId,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      }
    );

    console.log(`[BatchExport] Queued ${format.toUpperCase()} generation for batch ${batchId}`);

    return {
      status: 'generating',
      reportId: pendingReport.id,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Batch Export Service: Request failed:', err.message);
    throw new BatchExportError(
      'Failed to request batch export',
      'EXPORT_REQUEST_FAILED',
      err
    );
  }
}

/**
 * Get batch export status
 *
 * Checks the status of a batch report generation.
 * Returns the presigned URL if generation is complete.
 *
 * Requirements:
 * - 4.1, 4.2: Status polling for async generation
 *
 * @param batchId - Batch scan ID
 * @param format - Report format (pdf or json)
 * @returns Export status with URL if ready
 * @throws {BatchExportError} If status check fails
 *
 * @example
 * ```typescript
 * const status = await getBatchExportStatus('batch-123', 'pdf');
 * if (status.status === 'ready') {
 *   window.location.href = status.url;
 * }
 * ```
 */
export async function getBatchExportStatus(
  batchId: string,
  format: 'pdf' | 'json'
): Promise<BatchExportResponse> {
  try {
    const report = await getReportByBatchAndFormat(
      batchId,
      format.toUpperCase() as ReportFormat
    );

    if (!report) {
      return {
        status: 'failed',
        errorMessage: 'Report not found',
      };
    }

    switch (report.status) {
      case 'COMPLETED':
        if (report.storageKey) {
          const presignedUrl = await getPresignedUrl(report.storageKey);
          return {
            status: 'ready',
            url: presignedUrl,
            expiresAt: report.expiresAt.toISOString(),
            reportId: report.id,
          };
        }
        // Completed but no storage key - treat as failed
        return {
          status: 'failed',
          errorMessage: 'Report completed but file not found',
          reportId: report.id,
        };

      case 'GENERATING':
      case 'PENDING':
        return {
          status: 'generating',
          reportId: report.id,
        };

      case 'FAILED':
        return {
          status: 'failed',
          errorMessage: 'Report generation failed',
          reportId: report.id,
        };

      default:
        return {
          status: 'generating',
          reportId: report.id,
        };
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Batch Export Service: Status check failed:', err.message);
    throw new BatchExportError(
      'Failed to get batch export status',
      'STATUS_CHECK_FAILED',
      err
    );
  }
}

/**
 * Get batch export status by report ID
 *
 * Checks the status of a specific report by its ID.
 *
 * @param reportId - Report record ID
 * @returns Export status with URL if ready
 * @throws {BatchExportError} If status check fails
 */
export async function getBatchExportStatusById(
  reportId: string
): Promise<BatchExportResponse> {
  try {
    const report = await getReportById(reportId);

    if (!report) {
      return {
        status: 'failed',
        errorMessage: 'Report not found',
      };
    }

    switch (report.status) {
      case 'COMPLETED':
        if (report.storageKey) {
          const presignedUrl = await getPresignedUrl(report.storageKey);
          return {
            status: 'ready',
            url: presignedUrl,
            expiresAt: report.expiresAt.toISOString(),
            reportId: report.id,
          };
        }
        return {
          status: 'failed',
          errorMessage: 'Report completed but file not found',
          reportId: report.id,
        };

      case 'GENERATING':
      case 'PENDING':
        return {
          status: 'generating',
          reportId: report.id,
        };

      case 'FAILED':
        return {
          status: 'failed',
          errorMessage: 'Report generation failed',
          reportId: report.id,
        };

      default:
        return {
          status: 'generating',
          reportId: report.id,
        };
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    throw new BatchExportError(
      'Failed to get batch export status by ID',
      'STATUS_CHECK_FAILED',
      err
    );
  }
}

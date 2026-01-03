/**
 * Batch Status Service for Worker
 *
 * Provides batch status notification functionality for the worker process.
 * This service is called after each scan completes to check if the batch is complete
 * and update the batch status and aggregate statistics accordingly.
 *
 * Requirements:
 * - 2.5: System shall auto-update batch status when all scans complete
 * - 2.6: If ANY scan fails, batch status is FAILED with partial results
 * - 3.7: Aggregate stats include passed checks count and URLs scanned count
 */

import type { BatchStatus, Scan, ScanStatus } from '@prisma/client';
import { getPrismaClient } from '../config/prisma.js';
import { addEmailJob } from '../jobs/email-queue.js';

/**
 * Aggregate statistics calculated from completed scans
 */
export interface BatchAggregateStats {
  totalIssues: number;
  criticalCount: number;
  seriousCount: number;
  moderateCount: number;
  minorCount: number;
  passedChecks: number;
  urlsScanned: number;
}

/**
 * Result of batch status check
 *
 * Requirements:
 * - 4.2: Make batch email available for notification
 */
export interface BatchStatusResult {
  batchId: string;
  status: BatchStatus;
  isComplete: boolean;
  completedCount: number;
  failedCount: number;
  totalUrls: number;
  aggregateStats?: BatchAggregateStats;
  /** Email address for batch completion notification (Requirement 4.2) */
  email?: string;
}

/**
 * Batch Status Service Error
 */
export class BatchStatusServiceError extends Error {
  public readonly code: string;
  public override readonly cause?: Error | undefined;

  constructor(message: string, code: string, cause?: Error | undefined) {
    super(message);
    this.name = 'BatchStatusServiceError';
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Notify that a scan has completed and check if batch is complete
 *
 * This function should be called after each scan completes (COMPLETED or FAILED).
 * It checks if all scans in the batch are complete, and if so:
 * 1. Calculates aggregate statistics from all completed scans
 * 2. Updates batch status (COMPLETED if all succeeded, FAILED if any failed)
 * 3. Updates batch aggregate statistics
 *
 * @param scanId - ID of the scan that just completed
 * @param status - Final status of the scan (COMPLETED or FAILED)
 * @returns Batch status result if scan belongs to a batch, null otherwise
 *
 * @example
 * ```typescript
 * // After scan completes successfully
 * await notifyScanComplete('scan-123', 'COMPLETED');
 *
 * // After scan fails
 * await notifyScanComplete('scan-456', 'FAILED');
 * ```
 */
export async function notifyScanComplete(
  scanId: string,
  status: ScanStatus
): Promise<BatchStatusResult | null> {
  const prisma = getPrismaClient();

  try {
    // Validate input
    if (!scanId || typeof scanId !== 'string') {
      throw new BatchStatusServiceError(
        'Scan ID is required and must be a string',
        'INVALID_INPUT'
      );
    }

    if (status !== 'COMPLETED' && status !== 'FAILED') {
      throw new BatchStatusServiceError(
        'Status must be COMPLETED or FAILED',
        'INVALID_STATUS'
      );
    }

    // Look up scan to get batchId
    const scan = await prisma.scan.findUnique({
      where: { id: scanId },
      select: { id: true, batchId: true, status: true },
    });

    if (!scan) {
      throw new BatchStatusServiceError(
        `Scan not found: ${scanId}`,
        'SCAN_NOT_FOUND'
      );
    }

    // If scan doesn't belong to a batch, return null
    if (!scan.batchId) {
      console.log(`ℹ️ BatchStatusService: Scan ${scanId} does not belong to a batch`);
      return null;
    }

    const batchId = scan.batchId;

    // Get batch to check current status, total URLs, and email (Requirement 4.2)
    const batch = await prisma.batchScan.findUnique({
      where: { id: batchId },
      select: { id: true, status: true, totalUrls: true, email: true },
    });

    if (!batch) {
      throw new BatchStatusServiceError(
        `Batch not found: ${batchId}`,
        'BATCH_NOT_FOUND'
      );
    }

    // If batch is already in final state, skip update
    if (batch.status === 'COMPLETED' || batch.status === 'FAILED' || batch.status === 'CANCELLED') {
      console.log(`ℹ️ BatchStatusService: Batch ${batchId} already in final state: ${batch.status}`);
      return null;
    }

    // Query all scans in the batch to check completion status
    const batchScans = await prisma.scan.findMany({
      where: { batchId },
      select: {
        id: true,
        status: true,
        scanResult: {
          select: {
            totalIssues: true,
            criticalCount: true,
            seriousCount: true,
            moderateCount: true,
            minorCount: true,
            passedChecks: true,
          },
        },
      },
    });

    // Count completed and failed scans
    const completedCount = batchScans.filter((s) => s.status === 'COMPLETED').length;
    const failedCount = batchScans.filter((s) => s.status === 'FAILED').length;
    const pendingCount = batchScans.filter(
      (s) => s.status === 'PENDING' || s.status === 'RUNNING'
    ).length;

    // Check if all scans are complete (no PENDING or RUNNING scans)
    const isComplete = pendingCount === 0;

    console.log(
      `📊 BatchStatusService: Batch ${batchId} progress: ${completedCount} completed, ${failedCount} failed, ${pendingCount} pending (${batchScans.length} total)`
    );

    // If not all scans are complete, just update counts and return
    if (!isComplete) {
      await prisma.batchScan.update({
        where: { id: batchId },
        data: {
          completedCount,
          failedCount,
          status: 'RUNNING', // Ensure batch is marked as running
        },
      });

      console.log(`🔄 BatchStatusService: Batch ${batchId} still in progress`);

      return {
        batchId,
        status: 'RUNNING',
        isComplete: false,
        completedCount,
        failedCount,
        totalUrls: batch.totalUrls,
        email: batch.email ?? undefined,
      };
    }

    // All scans are complete - calculate aggregate statistics
    const aggregateStats = calculateAggregateStats(batchScans);

    // Determine final batch status
    // Requirement 2.6: If ANY scan fails, batch status is FAILED
    const finalStatus: BatchStatus = failedCount > 0 ? 'FAILED' : 'COMPLETED';

    // Update batch with final status and aggregate statistics
    await prisma.batchScan.update({
      where: { id: batchId },
      data: {
        status: finalStatus,
        completedCount,
        failedCount,
        totalIssues: aggregateStats.totalIssues,
        criticalCount: aggregateStats.criticalCount,
        seriousCount: aggregateStats.seriousCount,
        moderateCount: aggregateStats.moderateCount,
        minorCount: aggregateStats.minorCount,
        completedAt: new Date(),
      },
    });

    console.log(
      `✅ BatchStatusService: Batch ${batchId} complete! Status: ${finalStatus}, Total Issues: ${aggregateStats.totalIssues}`
    );

    // Queue batch completion email if email exists (Requirement 4.2)
    if (batch.email) {
      await queueBatchEmailNotification(batchId, batch.email);
    }

    return {
      batchId,
      status: finalStatus,
      isComplete: true,
      completedCount,
      failedCount,
      totalUrls: batch.totalUrls,
      aggregateStats,
      email: batch.email ?? undefined,
    };
  } catch (error) {
    // Re-throw BatchStatusServiceError as-is
    if (error instanceof BatchStatusServiceError) {
      throw error;
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ BatchStatusService: Failed to notify scan complete:', err.message);
    throw new BatchStatusServiceError(
      'Failed to notify scan complete',
      'NOTIFY_FAILED',
      err
    );
  }
}

/**
 * Calculate aggregate statistics from batch scans
 *
 * Sums up statistics from all completed scans in the batch.
 * Only includes scans with scanResult data.
 *
 * Requirements:
 * - 3.7: Aggregate stats include passed checks count and URLs scanned count
 *
 * @param scans - Array of scans with their results
 * @returns Aggregate statistics
 */
function calculateAggregateStats(
  scans: Array<{
    id: string;
    status: ScanStatus;
    scanResult: {
      totalIssues: number;
      criticalCount: number;
      seriousCount: number;
      moderateCount: number;
      minorCount: number;
      passedChecks: number;
    } | null;
  }>
): BatchAggregateStats {
  let totalIssues = 0;
  let criticalCount = 0;
  let seriousCount = 0;
  let moderateCount = 0;
  let minorCount = 0;
  let passedChecks = 0;
  let urlsScanned = 0;

  for (const scan of scans) {
    // Only include completed scans with results
    if (scan.status === 'COMPLETED' && scan.scanResult) {
      totalIssues += scan.scanResult.totalIssues;
      criticalCount += scan.scanResult.criticalCount;
      seriousCount += scan.scanResult.seriousCount;
      moderateCount += scan.scanResult.moderateCount;
      minorCount += scan.scanResult.minorCount;
      passedChecks += scan.scanResult.passedChecks;
      urlsScanned += 1;
    }
  }

  return {
    totalIssues,
    criticalCount,
    seriousCount,
    moderateCount,
    minorCount,
    passedChecks,
    urlsScanned,
  };
}

/**
 * Queue a batch completion email notification
 *
 * Adds a job to the email queue to send batch completion notification.
 * This function handles errors gracefully since email is non-critical.
 *
 * @param batchId - ID of the completed batch
 * @param email - Email address to send notification to
 *
 * Requirements:
 * - 4.2: Queue email on batch completion
 *
 * @example
 * ```typescript
 * await queueBatchEmailNotification('batch-123', 'user@example.com');
 * ```
 */
export async function queueBatchEmailNotification(
  batchId: string,
  email: string
): Promise<void> {
  try {
    const job = await addEmailJob({
      batchId,
      email,
      type: 'batch_complete',
    });

    console.log(
      `📧 BatchStatusService: Queued batch completion email (Job ID: ${job.id}, Batch: ${batchId}, Email: ${email})`
    );
  } catch (error) {
    // Log error but don't throw - email is non-critical
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(
      `⚠️ BatchStatusService: Failed to queue batch completion email for batch ${batchId}:`,
      err.message
    );
    // Don't throw - email notification failure should not break the batch completion flow
  }
}

/**
 * Export a convenient singleton-style interface
 */
export const batchStatusService = {
  notifyScanComplete,
  queueBatchEmailNotification,
};

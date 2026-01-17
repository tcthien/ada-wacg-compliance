import type { Job } from 'bullmq';
import type { WCAGLevel } from '@adashield/core';
import getPrismaClient from '../config/prisma.js';
import { scanPage } from '../processors/scanner/index.js';
import {
  updateScanProgress,
  ScanStage,
  calculateEstimatedTimeRemaining,
} from '../utils/progress-tracker.js';
import { getIssueSummary } from '../processors/scanner/index.js';
import { batchStatusService } from '../services/batch-status.service.js';
import { addEmailJob } from './email-queue.js';

/**
 * Scan Page Job Processor
 *
 * Orchestrates the complete scanning workflow:
 * 1. Acquire browser from pool
 * 2. Run page scanner with progress updates
 * 3. Save ScanResult and Issues to database
 * 4. Update scan status to completed/failed
 * 5. Queue email job if email provided
 *
 * Implements retry strategy:
 * - 3 attempts with exponential backoff
 * - Handled by BullMQ job configuration
 */

/**
 * Job data structure for scan-page jobs
 */
export interface ScanPageJobData {
  /** Scan ID from database */
  scanId: string;

  /** URL to scan */
  url: string;

  /** WCAG conformance level */
  wcagLevel: WCAGLevel;

  /** Optional email for notification */
  email?: string;

  /** Guest session ID for tracking */
  sessionId: string;
}

/**
 * Job result structure
 */
export interface ScanPageJobResult {
  /** Scan ID */
  scanId: string;

  /** Number of issues found */
  issueCount: number;

  /** Scan duration in milliseconds */
  duration: number;

  /** Final status */
  status: 'COMPLETED' | 'FAILED';
}

/**
 * Queue email notification job
 *
 * Adds an email notification job to the send-email queue.
 * The job will be processed by the send-email worker which handles
 * template rendering and email delivery via configured provider.
 *
 * @param scanId - Scan ID for email context
 * @param email - Recipient email address
 * @param type - Email type (scan_complete or scan_failed)
 */
async function queueEmailNotification(
  scanId: string,
  email: string,
  type: 'scan_complete' | 'scan_failed' = 'scan_complete'
): Promise<void> {
  try {
    const job = await addEmailJob({
      scanId,
      email,
      type,
    });

    console.log(
      `📧 Queued ${type} email for scan ${scanId} to ${email} (job: ${job.id})`
    );
  } catch (error) {
    // Log error but don't throw - email notification is non-critical
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error(
      `⚠️ Failed to queue ${type} email for scan ${scanId}:`,
      errorMessage
    );
  }
}

/**
 * Process a scan-page job
 *
 * Main entry point for the scan workflow.
 * Handles all stages of scanning with progress tracking.
 *
 * @param job - BullMQ job instance
 * @returns Job result with scan statistics
 * @throws Error if scan fails (will be retried by BullMQ)
 */
export async function processScanPageJob(
  job: Job<ScanPageJobData>
): Promise<ScanPageJobResult> {
  const { scanId, url, wcagLevel, email } = job.data;
  const startTime = Date.now();
  const prisma = getPrismaClient();

  try {
    // ========================================================================
    // Stage 1: STARTING
    // ========================================================================
    await updateScanProgress(scanId, ScanStage.STARTING, {
      message: 'Initializing scan...',
    });

    await prisma.scan.update({
      where: { id: scanId },
      data: { status: 'RUNNING' },
    });

    // ========================================================================
    // Stage 2: NAVIGATING
    // ========================================================================
    await updateScanProgress(scanId, ScanStage.NAVIGATING, {
      message: 'Navigating to page...',
      estimatedTimeRemaining: calculateEstimatedTimeRemaining(
        ScanStage.NAVIGATING
      ),
    });

    // ========================================================================
    // Stage 3: ANALYZING
    // ========================================================================
    await updateScanProgress(scanId, ScanStage.ANALYZING, {
      message: 'Running accessibility analysis...',
      estimatedTimeRemaining: calculateEstimatedTimeRemaining(
        ScanStage.ANALYZING
      ),
    });

    // Run the scan (page-scanner handles browser acquisition internally)
    const scanResult = await scanPage({ url, wcagLevel });

    // ========================================================================
    // Stage 4: PROCESSING
    // ========================================================================
    await updateScanProgress(scanId, ScanStage.PROCESSING, {
      message: 'Processing results...',
      estimatedTimeRemaining: calculateEstimatedTimeRemaining(
        ScanStage.PROCESSING
      ),
    });

    // Calculate summary statistics
    const summary = getIssueSummary(scanResult.issues);

    // Save scan result and issues to database in transaction
    await prisma.scanResult.create({
      data: {
        scanId,
        totalIssues: summary.total,
        criticalCount: summary.critical,
        seriousCount: summary.serious,
        moderateCount: summary.moderate,
        minorCount: summary.minor,
        passedChecks: scanResult.passes,
        inapplicableChecks: scanResult.inapplicable,
        issues: {
          create: scanResult.issues.map((issue) => ({
            id: issue.id,
            ruleId: issue.ruleId,
            impact: issue.impact,
            description: issue.description,
            helpText: issue.helpText,
            helpUrl: issue.helpUrl,
            wcagCriteria: issue.wcagCriteria,
            cssSelector: issue.cssSelector,
            htmlSnippet: issue.htmlSnippet,
            // Cast nodes to JSON-compatible format for Prisma
            nodes: issue.nodes as unknown as object[],
          })),
        },
      },
    });

    // ========================================================================
    // Stage 5: COMPLETED
    // ========================================================================
    const duration = Date.now() - startTime;

    await prisma.scan.update({
      where: { id: scanId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        durationMs: duration,
      },
    });

    await updateScanProgress(scanId, ScanStage.COMPLETED, {
      message: `Scan completed. Found ${summary.total} issues.`,
    });

    // Notify batch status service if scan belongs to a batch
    // Requirement 2.5: System shall auto-update batch status when all scans complete
    try {
      const batchResult = await batchStatusService.notifyScanComplete(
        scanId,
        'COMPLETED'
      );
      if (batchResult && batchResult.isComplete) {
        console.log(
          `✅ Batch ${batchResult.batchId} completed with status: ${batchResult.status}`
        );
      }
    } catch (error) {
      // Don't fail the scan if batch notification fails
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error(
        `⚠️ Failed to notify batch status for scan ${scanId}:`,
        errorMessage
      );
    }

    // Queue email notification if email provided
    // Skip email for AI-enabled scans - they will receive email when AI processing completes
    // This prevents GDPR nullification of email before AI results can be sent
    if (email) {
      const scanRecord = await prisma.scan.findUnique({
        where: { id: scanId },
        select: { aiEnabled: true },
      });

      if (!scanRecord?.aiEnabled) {
        await queueEmailNotification(scanId, email, 'scan_complete');
      } else {
        console.log(
          `📧 Skipping scan_complete email for AI-enabled scan ${scanId} - will send when AI processing completes`
        );
      }
    }

    return {
      scanId,
      issueCount: summary.total,
      duration,
      status: 'COMPLETED',
    };
  } catch (error) {
    // ========================================================================
    // Error Handling
    // ========================================================================
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    // Update progress to FAILED
    await updateScanProgress(scanId, ScanStage.FAILED, {
      message: 'Scan failed',
      error: errorMessage,
    });

    // Update scan status in database
    await prisma.scan.update({
      where: { id: scanId },
      data: {
        status: 'FAILED',
        errorMessage,
        completedAt: new Date(),
        durationMs: Date.now() - startTime,
      },
    });

    // Notify batch status service if scan belongs to a batch
    // Requirement 2.6: If ANY scan fails, batch status is FAILED with partial results
    try {
      const batchResult = await batchStatusService.notifyScanComplete(
        scanId,
        'FAILED'
      );
      if (batchResult && batchResult.isComplete) {
        console.log(
          `✅ Batch ${batchResult.batchId} completed with status: ${batchResult.status}`
        );
      }
    } catch (batchError) {
      // Don't fail the scan if batch notification fails
      const batchErrorMessage =
        batchError instanceof Error ? batchError.message : 'Unknown error';
      console.error(
        `⚠️ Failed to notify batch status for scan ${scanId}:`,
        batchErrorMessage
      );
    }

    // Queue failure notification email if provided
    // For failed scans, always send email (AI processing won't happen anyway)
    if (email) {
      await queueEmailNotification(scanId, email, 'scan_failed');
    }

    // Re-throw error for BullMQ retry handling
    throw error;
  }
}

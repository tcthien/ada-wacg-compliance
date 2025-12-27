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

/**
 * Scan Page Job Processor
 *
 * Orchestrates the complete scanning workflow:
 * 1. Acquire browser from pool
 * 2. Run page scanner with progress updates
 * 3. Save ScanResult and Issues to database
 * 4. Update scan status to completed/failed
 * 5. Queue email job if email provided and duration > 30s
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
 * TODO: Implement when email queue is created
 * For now, just logs the intent
 *
 * @param scanId - Scan ID
 * @param email - Email address
 * @param type - Email type (scan_complete or scan_failed)
 */
async function queueEmailNotification(
  scanId: string,
  email: string,
  type: 'scan_complete' | 'scan_failed' = 'scan_complete'
): Promise<void> {
  // TODO: Import email queue and add job
  // Example:
  // const emailQueue = getEmailQueue();
  // await emailQueue.add('send-email', {
  //   scanId,
  //   email,
  //   type,
  // });

  console.log(
    `📧 Would queue ${type} email for scan ${scanId} to ${email}`
  );
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

    // Queue email notification if email provided and scan took > 30s
    if (email && duration > 30000) {
      await queueEmailNotification(scanId, email, 'scan_complete');
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

    // Queue failure notification email if provided
    if (email) {
      await queueEmailNotification(scanId, email, 'scan_failed');
    }

    // Re-throw error for BullMQ retry handling
    throw error;
  }
}

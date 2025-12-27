/**
 * Report Service
 *
 * Business logic layer for report operations.
 * Orchestrates report retrieval, generation queuing, and presigned URL generation.
 */

import { getPrismaClient } from '../../config/database.js';
import { addReportJob } from '../../shared/queue/queue.service.js';
import {
  getReportByScanAndFormat,
  createPendingReport,
  ReportRepositoryError,
} from './report.repository.js';
import type { ReportFormat } from '@prisma/client';

/**
 * Report Service Error
 */
export class ReportServiceError extends Error {
  public readonly code: string;
  public readonly cause?: Error | undefined;

  constructor(message: string, code: string, cause?: Error | undefined) {
    super(message);
    this.name = 'ReportServiceError';
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Result type for report retrieval
 */
export interface GetReportResult {
  status: 'ready' | 'generating' | 'not_found';
  url?: string;
  expiresAt?: Date;
  jobId?: string;
}

/**
 * Get or generate a report for a scan
 *
 * Flow:
 * 1. Verify scan exists and belongs to session
 * 2. Check if report already exists
 * 3. If exists and has storage key, return presigned URL
 * 4. If not exists, queue report generation job
 *
 * @param scanId - Scan identifier
 * @param format - Report format ('pdf' or 'json')
 * @param sessionId - Guest session identifier
 * @returns Report status and URL or job ID
 * @throws {ReportServiceError} If scan not found or doesn't belong to session
 */
export async function getOrGenerateReport(
  scanId: string,
  format: 'pdf' | 'json',
  sessionId: string
): Promise<GetReportResult> {
  try {
    const prisma = getPrismaClient();

    // 1. Verify scan exists and belongs to session
    const scan = await prisma.scan.findUnique({
      where: { id: scanId },
      select: {
        id: true,
        guestSessionId: true,
        status: true,
      },
    });

    if (!scan) {
      return { status: 'not_found' };
    }

    if (scan.guestSessionId !== sessionId) {
      throw new ReportServiceError(
        'Scan does not belong to session',
        'FORBIDDEN'
      );
    }

    // Check if scan is completed
    if (scan.status !== 'COMPLETED') {
      throw new ReportServiceError(
        'Scan must be completed before generating report',
        'SCAN_NOT_COMPLETED'
      );
    }

    // 2. Check if report exists
    const dbFormat = format.toUpperCase() as ReportFormat;
    const existingReport = await getReportByScanAndFormat(scanId, dbFormat);

    // 3. If report exists and has storage key, return presigned URL
    if (existingReport && existingReport.storageKey) {
      const url = await generatePresignedUrl(existingReport.storageKey);
      return {
        status: 'ready',
        url,
        expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour
      };
    }

    // 4. Queue report generation
    const jobId = await addReportJob(scanId, dbFormat);

    return {
      status: 'generating',
      jobId,
    };
  } catch (error) {
    // Re-throw known errors
    if (error instanceof ReportServiceError) {
      throw error;
    }

    // Handle repository errors
    if (error instanceof ReportRepositoryError) {
      throw new ReportServiceError(
        error.message,
        error.code,
        error
      );
    }

    // Handle unexpected errors
    const err = error instanceof Error ? error : new Error(String(error));
    throw new ReportServiceError(
      'Failed to get or generate report',
      'GET_REPORT_FAILED',
      err
    );
  }
}

/**
 * Generate presigned URL for S3 object
 *
 * Uses the shared S3 client from @adashield/core to generate
 * a time-limited presigned URL for downloading reports.
 *
 * @param storageKey - S3 object key
 * @returns Presigned URL valid for 1 hour
 */
async function generatePresignedUrl(storageKey: string): Promise<string> {
  const { getPresignedUrl } = await import('@adashield/core/storage');

  // Generate presigned URL with 1 hour expiration
  const url = await getPresignedUrl(storageKey, 3600);

  return url;
}

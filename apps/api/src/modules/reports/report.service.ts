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
import type { ReportFormat, ScanStatus } from '@prisma/client';

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
 * Report information with presigned URL
 */
export interface ReportInfo {
  exists: true;
  url: string;           // Presigned URL
  createdAt: string;     // ISO 8601
  fileSizeBytes: number;
  expiresAt: string;     // URL expiration
}

/**
 * Report status result for both PDF and JSON formats
 */
export interface ReportStatusResult {
  scanId: string;
  scanStatus: ScanStatus;
  reports: {
    pdf: ReportInfo | null;
    json: ReportInfo | null;
  };
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

/**
 * Get or generate a report for a scan (admin version)
 *
 * Admin version of getOrGenerateReport that bypasses session validation.
 * This allows admins to generate reports for any scan in the system.
 *
 * Flow:
 * 1. Verify scan exists
 * 2. Check if report already exists
 * 3. If exists and has storage key, return presigned URL
 * 4. If not exists, queue report generation job
 *
 * @param scanId - Scan identifier
 * @param format - Report format ('pdf' or 'json')
 * @returns Report status and URL or job ID
 * @throws {ReportServiceError} If scan not found
 */
export async function getOrGenerateReportAdmin(
  scanId: string,
  format: 'pdf' | 'json'
): Promise<GetReportResult> {
  try {
    const prisma = getPrismaClient();

    // 1. Verify scan exists (no session check)
    const scan = await prisma.scan.findUnique({
      where: { id: scanId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!scan) {
      return { status: 'not_found' };
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
 * Get report status for a scan
 *
 * Checks if reports exist for both PDF and JSON formats and returns their status.
 * If reports exist, includes presigned URLs for downloading.
 *
 * Flow:
 * 1. Verify scan exists
 * 2. Validate session ownership if sessionId provided
 * 3. Check for existing PDF and JSON reports
 * 4. Generate presigned URLs for existing reports
 * 5. Return status for both formats
 *
 * @param scanId - Scan identifier
 * @param sessionId - Optional guest session identifier (omit for admin access)
 * @returns Report status with presigned URLs for existing reports
 * @throws {ReportServiceError} If scan not found or doesn't belong to session
 */
export async function getReportStatus(
  scanId: string,
  sessionId?: string
): Promise<ReportStatusResult> {
  try {
    const prisma = getPrismaClient();

    // 1. Verify scan exists and get status
    const scan = await prisma.scan.findUnique({
      where: { id: scanId },
      select: {
        id: true,
        status: true,
        guestSessionId: true,
        reports: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!scan) {
      throw new ReportServiceError(
        'Scan not found',
        'SCAN_NOT_FOUND'
      );
    }

    // 2. Validate session ownership if sessionId provided (guest access)
    if (sessionId && scan.guestSessionId !== sessionId) {
      throw new ReportServiceError(
        'Scan does not belong to session',
        'FORBIDDEN'
      );
    }

    // 3. Check for existing reports by format
    const pdfReport = scan.reports.find(r => r.format === 'PDF' && r.storageKey);
    const jsonReport = scan.reports.find(r => r.format === 'JSON' && r.storageKey);

    // 4. Build report info with presigned URLs
    let pdfInfo: ReportInfo | null = null;
    let jsonInfo: ReportInfo | null = null;

    if (pdfReport && pdfReport.storageKey) {
      const url = await generatePresignedUrl(pdfReport.storageKey);
      const urlExpiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour from now

      pdfInfo = {
        exists: true,
        url,
        createdAt: pdfReport.createdAt.toISOString(),
        fileSizeBytes: pdfReport.fileSizeBytes,
        expiresAt: urlExpiresAt.toISOString(),
      };
    }

    if (jsonReport && jsonReport.storageKey) {
      const url = await generatePresignedUrl(jsonReport.storageKey);
      const urlExpiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour from now

      jsonInfo = {
        exists: true,
        url,
        createdAt: jsonReport.createdAt.toISOString(),
        fileSizeBytes: jsonReport.fileSizeBytes,
        expiresAt: urlExpiresAt.toISOString(),
      };
    }

    // 5. Return status for both formats
    return {
      scanId: scan.id,
      scanStatus: scan.status,
      reports: {
        pdf: pdfInfo,
        json: jsonInfo,
      },
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
      'Failed to get report status',
      'GET_REPORT_STATUS_FAILED',
      err
    );
  }
}

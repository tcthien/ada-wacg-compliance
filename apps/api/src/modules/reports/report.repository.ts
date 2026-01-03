/**
 * Report Repository
 *
 * Data access layer for report operations.
 * Handles database queries for report retrieval and creation.
 */

import { getPrismaClient } from '../../config/database.js';
import type { Report, ReportFormat, ReportStatus } from '@prisma/client';

/**
 * Report Repository Error
 */
export class ReportRepositoryError extends Error {
  public readonly code: string;
  public readonly cause?: Error | undefined;

  constructor(message: string, code: string, cause?: Error | undefined) {
    super(message);
    this.name = 'ReportRepositoryError';
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Get most recent report by scan ID and format
 *
 * Returns the most recently created report for a given scan and format.
 * Used to check if a report already exists before queuing generation.
 *
 * @param scanId - Scan identifier
 * @param format - Report format (PDF or JSON)
 * @returns Report or null if not found
 * @throws {ReportRepositoryError} If database query fails
 */
export async function getReportByScanAndFormat(
  scanId: string,
  format: ReportFormat
): Promise<Report | null> {
  try {
    const prisma = getPrismaClient();
    const report = await prisma.report.findFirst({
      where: {
        scanId,
        format,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return report;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    throw new ReportRepositoryError('Failed to get report', 'GET_REPORT_FAILED', err);
  }
}

/**
 * Create a pending report record
 *
 * Creates a placeholder report record that will be updated
 * by the worker once generation is complete.
 *
 * Note: storageKey and storageUrl are set to empty strings initially.
 * The worker will update these fields once the report is generated.
 *
 * @param scanId - Scan identifier
 * @param format - Report format (PDF or JSON)
 * @returns Created report
 * @throws {ReportRepositoryError} If database insert fails
 */
export async function createPendingReport(
  scanId: string,
  format: ReportFormat
): Promise<Report> {
  try {
    const prisma = getPrismaClient();

    // Set expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const report = await prisma.report.create({
      data: {
        scanId,
        format,
        storageKey: '', // Will be set by worker
        storageUrl: '', // Will be set by worker
        fileSizeBytes: 0, // Will be set by worker
        expiresAt,
      },
    });

    return report;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    throw new ReportRepositoryError('Failed to create pending report', 'CREATE_FAILED', err);
  }
}

// ============================================================================
// BATCH REPORT FUNCTIONS
// ============================================================================

/**
 * Get report by batch ID and format
 *
 * Returns the report for a given batch and format.
 * Used to check if a batch report already exists.
 *
 * @param batchId - Batch scan identifier
 * @param format - Report format (PDF or JSON)
 * @returns Report or null if not found
 * @throws {ReportRepositoryError} If database query fails
 */
export async function getReportByBatchAndFormat(
  batchId: string,
  format: ReportFormat
): Promise<Report | null> {
  try {
    const prisma = getPrismaClient();
    const report = await prisma.report.findFirst({
      where: {
        batchId,
        format,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return report;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    throw new ReportRepositoryError('Failed to get batch report', 'GET_BATCH_REPORT_FAILED', err);
  }
}

/**
 * Reset a failed report to pending status for retry
 *
 * @param reportId - Report record ID
 * @returns Updated report
 * @throws {ReportRepositoryError} If database update fails
 */
export async function resetReportToPending(reportId: string): Promise<Report> {
  try {
    const prisma = getPrismaClient();

    // Set new expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const report = await prisma.report.update({
      where: { id: reportId },
      data: {
        status: 'PENDING',
        storageKey: '',
        storageUrl: '',
        fileSizeBytes: 0,
        expiresAt,
      },
    });

    return report;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    throw new ReportRepositoryError('Failed to reset report to pending', 'RESET_FAILED', err);
  }
}

/**
 * Create a pending batch report record
 *
 * Creates a placeholder report record that will be updated
 * by the worker once generation is complete.
 *
 * @param batchId - Batch scan identifier
 * @param format - Report format (PDF or JSON)
 * @returns Created report
 * @throws {ReportRepositoryError} If database insert fails
 */
export async function createPendingBatchReport(
  batchId: string,
  format: ReportFormat
): Promise<Report> {
  try {
    const prisma = getPrismaClient();

    // Set expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const report = await prisma.report.create({
      data: {
        batchId,
        format,
        status: 'PENDING',
        storageKey: '', // Will be set by worker
        storageUrl: '', // Will be set by worker
        fileSizeBytes: 0, // Will be set by worker
        expiresAt,
      },
    });

    return report;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    throw new ReportRepositoryError('Failed to create pending batch report', 'CREATE_BATCH_FAILED', err);
  }
}

/**
 * Update batch report status and storage details
 *
 * Updates the report status and optionally the storage key/URL
 * after the worker has completed generation.
 *
 * @param reportId - Report record ID
 * @param status - New report status
 * @param storageDetails - Optional storage details (key, URL, size)
 * @returns Updated report
 * @throws {ReportRepositoryError} If database update fails
 */
export async function updateReportStatus(
  reportId: string,
  status: ReportStatus,
  storageDetails?: {
    storageKey: string;
    storageUrl: string;
    fileSizeBytes: number;
  }
): Promise<Report> {
  try {
    const prisma = getPrismaClient();

    const report = await prisma.report.update({
      where: { id: reportId },
      data: {
        status,
        ...(storageDetails && {
          storageKey: storageDetails.storageKey,
          storageUrl: storageDetails.storageUrl,
          fileSizeBytes: storageDetails.fileSizeBytes,
        }),
      },
    });

    return report;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    throw new ReportRepositoryError('Failed to update report status', 'UPDATE_STATUS_FAILED', err);
  }
}

/**
 * Get report by ID
 *
 * Returns the report by its unique identifier.
 *
 * @param reportId - Report identifier
 * @returns Report or null if not found
 * @throws {ReportRepositoryError} If database query fails
 */
export async function getReportById(reportId: string): Promise<Report | null> {
  try {
    const prisma = getPrismaClient();
    const report = await prisma.report.findUnique({
      where: { id: reportId },
    });

    return report;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    throw new ReportRepositoryError('Failed to get report by ID', 'GET_BY_ID_FAILED', err);
  }
}

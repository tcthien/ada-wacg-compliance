/**
 * Report Repository
 *
 * Data access layer for report operations.
 * Handles database queries for report retrieval and creation.
 */

import { getPrismaClient } from '../../config/database.js';
import type { Report, ReportFormat } from '@prisma/client';

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

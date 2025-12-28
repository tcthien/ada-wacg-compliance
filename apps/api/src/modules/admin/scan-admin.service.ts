/**
 * Scan Admin Service
 *
 * Service layer for admin scan management operations.
 * Provides methods to list all scans across sessions with filtering capabilities.
 */

import { getPrismaClient } from '../../config/database.js';
import type { Scan, ScanResult, Issue, ScanStatus } from '@prisma/client';
import type { AdminErrorCode } from './admin.types.js';

/**
 * Custom error class for scan admin service operations
 *
 * Provides consistent error handling across all scan admin methods.
 * Extends the base Error class with additional properties for error codes
 * and error chaining through the cause property.
 *
 * @property code - Standardized error code from AdminErrorCode type
 * @property cause - Optional underlying error that caused this error
 *
 * @example
 * ```ts
 * throw new ScanAdminServiceError(
 *   'Invalid filter parameters',
 *   'INVALID_CREDENTIALS'
 * );
 * ```
 */
export class ScanAdminServiceError extends Error {
  public readonly code: AdminErrorCode;
  public override readonly cause?: Error | undefined;

  constructor(
    message: string,
    code: AdminErrorCode,
    cause?: Error | undefined
  ) {
    super(message);
    this.name = 'ScanAdminServiceError';
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Scan with full related data for admin view
 */
export interface ScanWithDetails extends Scan {
  scanResult: (ScanResult & { issues: Issue[] }) | null;
  guestSession: {
    id: string;
    fingerprint: string;
    createdAt: Date;
  } | null;
}

/**
 * Filter options for listing scans
 */
export interface ScanListFilters {
  /** Filter by scan status */
  status?: ScanStatus;
  /** Filter by date range - start date (inclusive) */
  startDate?: Date;
  /** Filter by date range - end date (inclusive) */
  endDate?: Date;
  /** Filter by customer email */
  email?: string;
  /** Filter by URL (partial match) */
  url?: string;
}

/**
 * Pagination options for scan list
 */
export interface ScanListPagination {
  /** Page number (1-indexed) */
  page: number;
  /** Number of items per page (default: 20) */
  limit: number;
}

/**
 * Paginated scan list result
 */
export interface PaginatedScanList {
  /** Array of scans */
  items: Scan[];
  /** Pagination metadata */
  pagination: {
    /** Current page number */
    page: number;
    /** Items per page */
    limit: number;
    /** Total number of items matching filters */
    total: number;
    /** Total number of pages */
    totalPages: number;
  };
}

/**
 * List all scans with optional filters and pagination
 *
 * Returns all scans across all sessions with pagination (default 20 per page).
 * Supports filtering by status, date range, email, and URL.
 *
 * @param filters - Optional filter criteria
 * @param pagination - Pagination options (defaults: page=1, limit=20)
 * @returns Paginated list of scans
 * @throws ScanAdminServiceError if query fails
 *
 * @example
 * ```typescript
 * // Get first page with default pagination
 * const result = await listAllScans();
 *
 * // Filter by status
 * const completedScans = await listAllScans({ status: 'COMPLETED' });
 *
 * // Filter by date range
 * const recentScans = await listAllScans({
 *   startDate: new Date('2025-01-01'),
 *   endDate: new Date('2025-12-31')
 * });
 *
 * // Filter by email
 * const userScans = await listAllScans({ email: 'user@example.com' });
 *
 * // Combine filters with pagination
 * const result = await listAllScans(
 *   { status: 'COMPLETED', email: 'user@example.com' },
 *   { page: 2, limit: 50 }
 * );
 * ```
 */
export async function listAllScans(
  filters?: ScanListFilters,
  pagination: ScanListPagination = { page: 1, limit: 20 }
): Promise<PaginatedScanList> {
  const prisma = getPrismaClient();

  try {
    // Validate pagination parameters
    const page = Math.max(1, pagination.page);
    const limit = Math.min(100, Math.max(1, pagination.limit)); // Max 100 items per page
    const skip = (page - 1) * limit;

    // Build where clause based on filters
    const where: {
      status?: ScanStatus;
      createdAt?: { gte?: Date; lte?: Date };
      email?: { contains: string; mode: 'insensitive' };
      url?: { contains: string; mode: 'insensitive' };
    } = {};

    // Apply status filter
    if (filters?.status) {
      where.status = filters.status;
    }

    // Apply date range filter
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        // Include the entire end date by setting to end of day
        const endOfDay = new Date(filters.endDate);
        endOfDay.setHours(23, 59, 59, 999);
        where.createdAt.lte = endOfDay;
      }
    }

    // Apply email filter (case-insensitive partial match)
    if (filters?.email) {
      where.email = {
        contains: filters.email,
        mode: 'insensitive',
      };
    }

    // Apply URL filter (case-insensitive partial match)
    if (filters?.url) {
      where.url = {
        contains: filters.url,
        mode: 'insensitive',
      };
    }

    // Execute queries in parallel for better performance
    const [items, total] = await Promise.all([
      prisma.scan.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }, // Most recent first
      }),
      prisma.scan.count({ where }),
    ]);

    // Calculate total pages
    const totalPages = Math.ceil(total / limit);

    console.log(
      `✅ Scan Admin Service: Listed ${items.length} scans (page ${page}/${totalPages}, total: ${total})`
    );

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Scan Admin Service: Failed to list scans:', err.message);
    throw new ScanAdminServiceError(
      'Failed to list scans',
      'UNAUTHORIZED',
      err
    );
  }
}

/**
 * Get scan details by ID with full related data
 *
 * Returns complete scan information including results, issues,
 * and associated session/email information.
 *
 * @param scanId - Scan ID
 * @returns Scan with full related data
 * @throws ScanAdminServiceError if scan not found or query fails
 *
 * @example
 * ```typescript
 * const scan = await getScanDetails('550e8400-e29b-41d4-a716-446655440000');
 * console.log(`URL: ${scan.url}`);
 * console.log(`Status: ${scan.status}`);
 * console.log(`Total Issues: ${scan.scanResult?.totalIssues ?? 0}`);
 * if (scan.guestSession) {
 *   console.log(`Session: ${scan.guestSession.id}`);
 * }
 * if (scan.scanResult) {
 *   console.log(`Critical: ${scan.scanResult.criticalCount}`);
 *   console.log(`Serious: ${scan.scanResult.seriousCount}`);
 * }
 * ```
 */
export async function getScanDetails(
  scanId: string
): Promise<ScanWithDetails> {
  const prisma = getPrismaClient();

  try {
    // Validate scan ID
    if (!scanId || typeof scanId !== 'string') {
      throw new ScanAdminServiceError(
        'Invalid scan ID',
        'UNAUTHORIZED'
      );
    }

    // Fetch scan with all related data
    const scan = await prisma.scan.findUnique({
      where: { id: scanId },
      include: {
        scanResult: {
          include: {
            issues: {
              orderBy: {
                impact: 'asc', // CRITICAL first (enum order)
              },
            },
          },
        },
        guestSession: {
          select: {
            id: true,
            fingerprint: true,
            createdAt: true,
          },
        },
      },
    });

    // Check if scan exists
    if (!scan) {
      throw new ScanAdminServiceError(
        `Scan not found: ${scanId}`,
        'UNAUTHORIZED'
      );
    }

    console.log(
      `✅ Scan Admin Service: Retrieved scan details for ${scanId}`
    );

    return scan as ScanWithDetails;
  } catch (error) {
    // Re-throw ScanAdminServiceError as-is
    if (error instanceof ScanAdminServiceError) {
      throw error;
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(
      `❌ Scan Admin Service: Failed to get scan details:`,
      err.message
    );
    throw new ScanAdminServiceError(
      `Failed to get scan details for ${scanId}`,
      'UNAUTHORIZED',
      err
    );
  }
}

/**
 * Delete scan options
 */
export interface DeleteScanOptions {
  /** Use soft delete (set deletedAt timestamp) instead of hard delete */
  soft?: boolean;
}

/**
 * Delete a scan and all associated data
 *
 * Removes scan and all related data (results, issues, reports).
 * Supports both soft delete (sets deletedAt timestamp) and hard delete (removes from database).
 *
 * @param scanId - Scan ID to delete
 * @param options - Delete options (soft/hard delete)
 * @returns true if deleted successfully
 * @throws ScanAdminServiceError if scan not found or deletion fails
 *
 * @example
 * ```typescript
 * // Soft delete (preserves data with deletedAt timestamp)
 * await deleteScan('550e8400-e29b-41d4-a716-446655440000', { soft: true });
 *
 * // Hard delete (permanently removes data)
 * await deleteScan('550e8400-e29b-41d4-a716-446655440000', { soft: false });
 *
 * // Default is hard delete
 * await deleteScan('550e8400-e29b-41d4-a716-446655440000');
 * ```
 */
export async function deleteScan(
  scanId: string,
  options: DeleteScanOptions = { soft: false }
): Promise<boolean> {
  const prisma = getPrismaClient();

  try {
    // Validate scan ID
    if (!scanId || typeof scanId !== 'string') {
      throw new ScanAdminServiceError(
        'Invalid scan ID',
        'UNAUTHORIZED'
      );
    }

    // Check if scan exists
    const scan = await prisma.scan.findUnique({
      where: { id: scanId },
      include: {
        scanResult: {
          include: {
            issues: true,
          },
        },
        reports: true,
      },
    });

    if (!scan) {
      throw new ScanAdminServiceError(
        `Scan not found: ${scanId}`,
        'UNAUTHORIZED'
      );
    }

    // TODO: Implement soft delete when deletedAt field is added to schema
    // For now, only hard delete is supported
    if (options.soft) {
      console.warn(
        '⚠️ Scan Admin Service: Soft delete not yet implemented, using hard delete'
      );
    }

    // Hard delete: Remove all associated data in transaction
    await prisma.$transaction(async (tx) => {
      // Delete reports first
      if (scan.reports.length > 0) {
        await tx.report.deleteMany({
          where: { scanId },
        });
      }

      // Delete issues if scan result exists
      if (scan.scanResult) {
        await tx.issue.deleteMany({
          where: { scanResultId: scan.scanResult.id },
        });

        // Delete scan result
        await tx.scanResult.delete({
          where: { id: scan.scanResult.id },
        });
      }

      // Finally, delete the scan itself
      await tx.scan.delete({
        where: { id: scanId },
      });
    });

    console.log(
      `✅ Scan Admin Service: Deleted scan ${scanId} and all associated data`
    );

    return true;
  } catch (error) {
    // Re-throw ScanAdminServiceError as-is
    if (error instanceof ScanAdminServiceError) {
      throw error;
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(
      `❌ Scan Admin Service: Failed to delete scan:`,
      err.message
    );
    throw new ScanAdminServiceError(
      `Failed to delete scan ${scanId}`,
      'UNAUTHORIZED',
      err
    );
  }
}

/**
 * Retry a failed scan
 *
 * Queues a new scan job with the same parameters as the original scan.
 * Typically used for failed scans to retry with the same URL and options.
 *
 * @param scanId - Scan ID to retry
 * @returns New job ID
 * @throws ScanAdminServiceError if scan not found or queueing fails
 *
 * @example
 * ```typescript
 * // Retry a failed scan
 * const jobId = await retryScan('550e8400-e29b-41d4-a716-446655440000');
 * console.log(`Retry job queued: ${jobId}`);
 * ```
 */
export async function retryScan(scanId: string): Promise<string> {
  const prisma = getPrismaClient();

  try {
    // Validate scan ID
    if (!scanId || typeof scanId !== 'string') {
      throw new ScanAdminServiceError(
        'Invalid scan ID',
        'UNAUTHORIZED'
      );
    }

    // Fetch scan to get original parameters
    const scan = await prisma.scan.findUnique({
      where: { id: scanId },
      select: {
        id: true,
        url: true,
        wcagLevel: true,
        status: true,
        guestSessionId: true,
        userId: true,
      },
    });

    if (!scan) {
      throw new ScanAdminServiceError(
        `Scan not found: ${scanId}`,
        'UNAUTHORIZED'
      );
    }

    // Import queue service dynamically to avoid circular dependencies
    const { addScanJob } = await import('../../shared/queue/queue.service.js');

    // Queue new scan job with same parameters
    const jobId = await addScanJob(
      scan.id,
      scan.url,
      scan.wcagLevel as 'A' | 'AA' | 'AAA',
      {
        ...(scan.userId && { userId: scan.userId }),
        ...(scan.guestSessionId && { sessionId: scan.guestSessionId }),
        metadata: {
          createdAt: Date.now(),
          source: 'admin-retry',
          correlationId: scanId,
        },
      }
    );

    // Update scan status back to PENDING
    await prisma.scan.update({
      where: { id: scanId },
      data: {
        status: 'PENDING',
        errorMessage: null,
        completedAt: null,
      },
    });

    console.log(
      `✅ Scan Admin Service: Queued retry job ${jobId} for scan ${scanId}`
    );

    return jobId;
  } catch (error) {
    // Re-throw ScanAdminServiceError as-is
    if (error instanceof ScanAdminServiceError) {
      throw error;
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(
      `❌ Scan Admin Service: Failed to retry scan:`,
      err.message
    );
    throw new ScanAdminServiceError(
      `Failed to retry scan ${scanId}`,
      'UNAUTHORIZED',
      err
    );
  }
}

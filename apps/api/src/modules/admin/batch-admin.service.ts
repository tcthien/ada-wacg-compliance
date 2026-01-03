/**
 * Batch Admin Service
 *
 * Service layer for admin batch scan management operations.
 * Provides methods to list all batch scans across sessions with filtering capabilities
 * and detailed batch information including aggregate statistics.
 */

import { getPrismaClient } from '../../config/database.js';
import type { BatchScan, BatchStatus, GuestSession, Scan, ScanResult } from '@prisma/client';
import type { AdminErrorCode } from './admin.types.js';

/**
 * Custom error class for batch admin service operations
 *
 * Provides consistent error handling across all batch admin methods.
 * Extends the base Error class with additional properties for error codes
 * and error chaining through the cause property.
 *
 * @property code - Standardized error code from AdminErrorCode type
 * @property cause - Optional underlying error that caused this error
 *
 * @example
 * ```ts
 * throw new BatchAdminServiceError(
 *   'Invalid filter parameters',
 *   'INVALID_CREDENTIALS'
 * );
 * ```
 */
export class BatchAdminServiceError extends Error {
  public readonly code: AdminErrorCode;
  public override readonly cause?: Error | undefined;

  constructor(
    message: string,
    code: AdminErrorCode,
    cause?: Error | undefined
  ) {
    super(message);
    this.name = 'BatchAdminServiceError';
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Filter options for listing batch scans
 */
export interface BatchListFilters {
  /** Filter by batch status */
  status?: BatchStatus;
  /** Filter by date range - start date (inclusive) */
  startDate?: Date;
  /** Filter by date range - end date (inclusive) */
  endDate?: Date;
  /** Filter by homepage URL (partial match) */
  homepageUrl?: string;
  /** Filter by session ID */
  sessionId?: string;
}

/**
 * Pagination options for batch list
 */
export interface BatchListPagination {
  /** Page number (1-indexed) */
  page: number;
  /** Number of items per page (default: 20) */
  limit: number;
}

/**
 * Batch scan with issue count summary for list view
 */
export interface BatchWithCounts {
  id: string;
  homepageUrl: string;
  totalUrls: number;
  completedCount: number;
  failedCount: number;
  status: BatchStatus;
  totalIssues: number | null;
  criticalCount: number | null;
  seriousCount: number | null;
  moderateCount: number | null;
  minorCount: number | null;
  createdAt: Date;
  completedAt: Date | null;
  guestSession: {
    id: string;
    fingerprint: string;
  } | null;
}

/**
 * Paginated batch list result
 */
export interface PaginatedBatchList {
  /** Array of batch scans with counts */
  items: BatchWithCounts[];
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
 * Individual scan with issue counts for batch details
 */
export interface ScanWithIssueCount {
  id: string;
  url: string;
  pageTitle: string | null;
  status: string;
  criticalCount: number;
  seriousCount: number;
  moderateCount: number;
  minorCount: number;
  totalIssues: number;
  errorMessage: string | null;
  completedAt: Date | null;
  createdAt: Date;
}

/**
 * Aggregate statistics for batch scan
 */
export interface AggregateStats {
  totalUrls: number;
  completedCount: number;
  failedCount: number;
  pendingCount: number;
  totalIssues: number;
  criticalCount: number;
  seriousCount: number;
  moderateCount: number;
  minorCount: number;
  passedChecks: number;
}

/**
 * Top critical URL for batch overview
 */
export interface TopCriticalUrl {
  scanId: string;
  url: string;
  pageTitle: string | null;
  criticalCount: number;
  totalIssues: number;
}

/**
 * Session information for batch
 */
export interface SessionInfo {
  id: string;
  fingerprint: string;
  createdAt: Date;
}

/**
 * Complete batch details for admin view
 */
export interface BatchAdminDetails {
  batch: BatchScan;
  scans: ScanWithIssueCount[];
  aggregate: AggregateStats;
  topCriticalUrls: TopCriticalUrl[];
  sessionInfo: SessionInfo | null;
}

/**
 * List all batch scans with optional filters and pagination
 *
 * Returns all batch scans across all sessions with pagination (default 20 per page).
 * Supports filtering by status, date range, homepage URL, and session ID.
 *
 * @param filters - Optional filter criteria
 * @param pagination - Pagination options (defaults: page=1, limit=20)
 * @returns Paginated list of batch scans with counts
 * @throws BatchAdminServiceError if query fails
 *
 * @example
 * ```typescript
 * // Get first page with default pagination
 * const result = await listAllBatches();
 *
 * // Filter by status
 * const completed = await listAllBatches({ status: 'COMPLETED' });
 *
 * // Filter by date range
 * const recent = await listAllBatches({
 *   startDate: new Date('2025-01-01'),
 *   endDate: new Date('2025-12-31')
 * });
 *
 * // Filter by homepage URL
 * const batches = await listAllBatches({ homepageUrl: 'example.com' });
 *
 * // Combine filters with pagination
 * const result = await listAllBatches(
 *   { status: 'COMPLETED', homepageUrl: 'example.com' },
 *   { page: 2, limit: 50 }
 * );
 * ```
 */
export async function listAllBatches(
  filters?: BatchListFilters,
  pagination: BatchListPagination = { page: 1, limit: 20 }
): Promise<PaginatedBatchList> {
  const prisma = getPrismaClient();

  try {
    // Validate pagination parameters
    const page = Math.max(1, pagination.page);
    const limit = Math.min(100, Math.max(1, pagination.limit)); // Max 100 items per page
    const skip = (page - 1) * limit;

    // Build where clause based on filters
    const where: {
      status?: BatchStatus;
      createdAt?: { gte?: Date; lte?: Date };
      homepageUrl?: { contains: string; mode: 'insensitive' };
      guestSessionId?: string;
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

    // Apply homepage URL filter (case-insensitive partial match)
    if (filters?.homepageUrl) {
      where.homepageUrl = {
        contains: filters.homepageUrl,
        mode: 'insensitive',
      };
    }

    // Apply session ID filter
    if (filters?.sessionId) {
      where.guestSessionId = filters.sessionId;
    }

    // Execute queries in parallel for better performance
    const [items, total] = await Promise.all([
      prisma.batchScan.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }, // Most recent first
        include: {
          guestSession: {
            select: {
              id: true,
              fingerprint: true,
            },
          },
        },
      }),
      prisma.batchScan.count({ where }),
    ]);

    // Calculate total pages
    const totalPages = Math.ceil(total / limit);

    // Transform items to include required fields
    const batchesWithCounts: BatchWithCounts[] = items.map(item => ({
      id: item.id,
      homepageUrl: item.homepageUrl,
      totalUrls: item.totalUrls,
      completedCount: item.completedCount,
      failedCount: item.failedCount,
      status: item.status,
      totalIssues: item.totalIssues,
      criticalCount: item.criticalCount,
      seriousCount: item.seriousCount,
      moderateCount: item.moderateCount,
      minorCount: item.minorCount,
      createdAt: item.createdAt,
      completedAt: item.completedAt,
      guestSession: item.guestSession,
    }));

    console.log(
      `✅ Batch Admin Service: Listed ${items.length} batch scans (page ${page}/${totalPages}, total: ${total})`
    );

    return {
      items: batchesWithCounts,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Batch Admin Service: Failed to list batches:', err.message);
    throw new BatchAdminServiceError(
      'Failed to list batch scans',
      'UNAUTHORIZED',
      err
    );
  }
}

/**
 * Get batch details by ID with full related data
 *
 * Returns complete batch information including all scans, aggregate statistics,
 * top critical URLs, and session information.
 *
 * @param batchId - Batch ID
 * @returns Batch with full related data
 * @throws BatchAdminServiceError if batch not found or query fails
 *
 * @example
 * ```typescript
 * const details = await getBatchDetails('550e8400-e29b-41d4-a716-446655440000');
 * console.log(`Homepage: ${details.batch.homepageUrl}`);
 * console.log(`Status: ${details.batch.status}`);
 * console.log(`Total Issues: ${details.aggregate.totalIssues}`);
 * console.log(`Top Critical URLs: ${details.topCriticalUrls.length}`);
 * if (details.sessionInfo) {
 *   console.log(`Session: ${details.sessionInfo.id}`);
 * }
 * ```
 */
export async function getBatchDetails(
  batchId: string
): Promise<BatchAdminDetails> {
  const prisma = getPrismaClient();

  try {
    // Validate batch ID
    if (!batchId || typeof batchId !== 'string') {
      throw new BatchAdminServiceError(
        'Invalid batch ID',
        'UNAUTHORIZED'
      );
    }

    // Fetch batch with all related data
    const batch = await prisma.batchScan.findUnique({
      where: { id: batchId },
      include: {
        guestSession: {
          select: {
            id: true,
            fingerprint: true,
            createdAt: true,
          },
        },
        scans: {
          include: {
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
          orderBy: {
            createdAt: 'asc', // Order by creation time
          },
        },
      },
    });

    // Check if batch exists
    if (!batch) {
      throw new BatchAdminServiceError(
        `Batch not found: ${batchId}`,
        'UNAUTHORIZED'
      );
    }

    // Transform scans to include issue counts
    const scansWithCounts: ScanWithIssueCount[] = batch.scans.map(scan => ({
      id: scan.id,
      url: scan.url,
      pageTitle: scan.pageTitle,
      status: scan.status,
      criticalCount: scan.scanResult?.criticalCount ?? 0,
      seriousCount: scan.scanResult?.seriousCount ?? 0,
      moderateCount: scan.scanResult?.moderateCount ?? 0,
      minorCount: scan.scanResult?.minorCount ?? 0,
      totalIssues: scan.scanResult?.totalIssues ?? 0,
      errorMessage: scan.errorMessage,
      completedAt: scan.completedAt,
      createdAt: scan.createdAt,
    }));

    // Calculate aggregate statistics
    // Sum passedChecks from all scan results
    const totalPassedChecks = batch.scans.reduce(
      (sum, scan) => sum + (scan.scanResult?.passedChecks ?? 0),
      0
    );

    const aggregate: AggregateStats = {
      totalUrls: batch.totalUrls,
      completedCount: batch.completedCount,
      failedCount: batch.failedCount,
      pendingCount: batch.totalUrls - batch.completedCount - batch.failedCount,
      totalIssues: batch.totalIssues ?? 0,
      criticalCount: batch.criticalCount ?? 0,
      seriousCount: batch.seriousCount ?? 0,
      moderateCount: batch.moderateCount ?? 0,
      minorCount: batch.minorCount ?? 0,
      passedChecks: totalPassedChecks,
    };

    // Get top 5 URLs with most critical issues
    const topCriticalUrls: TopCriticalUrl[] = scansWithCounts
      .filter(scan => scan.status === 'COMPLETED' && scan.criticalCount > 0)
      .sort((a, b) => {
        // Sort by critical count first, then total issues
        if (b.criticalCount !== a.criticalCount) {
          return b.criticalCount - a.criticalCount;
        }
        return b.totalIssues - a.totalIssues;
      })
      .slice(0, 5)
      .map(scan => ({
        scanId: scan.id,
        url: scan.url,
        pageTitle: scan.pageTitle,
        criticalCount: scan.criticalCount,
        totalIssues: scan.totalIssues,
      }));

    // Build session info
    const sessionInfo: SessionInfo | null = batch.guestSession
      ? {
          id: batch.guestSession.id,
          fingerprint: batch.guestSession.fingerprint,
          createdAt: batch.guestSession.createdAt,
        }
      : null;

    console.log(
      `✅ Batch Admin Service: Retrieved batch details for ${batchId} with ${scansWithCounts.length} scans`
    );

    return {
      batch,
      scans: scansWithCounts,
      aggregate,
      topCriticalUrls,
      sessionInfo,
    };
  } catch (error) {
    // Re-throw BatchAdminServiceError as-is
    if (error instanceof BatchAdminServiceError) {
      throw error;
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(
      `❌ Batch Admin Service: Failed to get batch details:`,
      err.message
    );
    throw new BatchAdminServiceError(
      `Failed to get batch details for ${batchId}`,
      'UNAUTHORIZED',
      err
    );
  }
}

/**
 * Cancel batch response
 */
export interface CancelBatchResponse {
  batchId: string;
  status: 'CANCELLED';
  cancelledCount: number;
  preservedCount: number;
  message: string;
}

/**
 * Cancel a batch scan and all its pending/running scans
 *
 * Admin-specific version of cancelBatch that bypasses authorization checks.
 * Cancels all pending/running scans, preserves completed scans, and logs audit trail.
 *
 * @param batchId - Batch scan ID to cancel
 * @param adminId - Admin user ID performing the action
 * @returns Cancellation summary with counts
 * @throws BatchAdminServiceError if batch not found or operation fails
 *
 * @example
 * ```typescript
 * const result = await cancelBatch('batch-123', 'admin-456');
 * console.log(`Cancelled ${result.cancelledCount} scans`);
 * console.log(`Preserved ${result.preservedCount} completed scans`);
 * ```
 */
export async function cancelBatch(
  batchId: string,
  adminId: string
): Promise<CancelBatchResponse> {
  const prisma = getPrismaClient();

  try {
    // Validate input
    if (!batchId || typeof batchId !== 'string') {
      throw new BatchAdminServiceError(
        'Invalid batch ID',
        'UNAUTHORIZED'
      );
    }

    if (!adminId || typeof adminId !== 'string') {
      throw new BatchAdminServiceError(
        'Invalid admin ID',
        'UNAUTHORIZED'
      );
    }

    // Use Prisma transaction for atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Step 1: Retrieve batch to verify it exists
      const batch = await tx.batchScan.findUnique({
        where: { id: batchId },
        select: {
          id: true,
          status: true,
          homepageUrl: true,
        },
      });

      if (!batch) {
        throw new BatchAdminServiceError(
          `Batch not found: ${batchId}`,
          'UNAUTHORIZED'
        );
      }

      // Step 2: Verify batch is in a cancellable state (PENDING or RUNNING)
      const cancellableStates: BatchStatus[] = ['PENDING', 'RUNNING'];
      if (!cancellableStates.includes(batch.status)) {
        throw new BatchAdminServiceError(
          `Batch cannot be cancelled in ${batch.status} state`,
          'UNAUTHORIZED'
        );
      }

      console.log(`🔄 Batch Admin Service: Cancelling batch ${batchId} by admin ${adminId}`);

      // Step 3: Get all scans in the batch
      const scans = await tx.scan.findMany({
        where: { batchId },
        select: {
          id: true,
          status: true,
        },
      });

      // Step 4: Count scans by status
      let cancelledCount = 0;
      let preservedCount = 0;
      const scansToCancel: string[] = [];

      for (const scan of scans) {
        // Preserve completed/failed scans (Requirement 3.2)
        if (scan.status === 'COMPLETED' || scan.status === 'FAILED') {
          preservedCount++;
          continue;
        }

        // Already cancelled
        if (scan.status === 'CANCELLED') {
          preservedCount++;
          continue;
        }

        // Mark pending/running scans for cancellation
        if (scan.status === 'PENDING' || scan.status === 'RUNNING') {
          scansToCancel.push(scan.id);
        }
      }

      // Step 5: Update pending/running scans to CANCELLED
      if (scansToCancel.length > 0) {
        const updateResult = await tx.scan.updateMany({
          where: {
            id: { in: scansToCancel },
            status: { in: ['PENDING', 'RUNNING'] },
          },
          data: {
            status: 'CANCELLED',
            completedAt: new Date(),
          },
        });

        cancelledCount = updateResult.count;

        console.log(`✅ Batch Admin Service: Cancelled ${cancelledCount} scans`);
      }

      // Step 6: Update batch status to CANCELLED with timestamp
      await tx.batchScan.update({
        where: { id: batchId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
        },
      });

      console.log(`✅ Batch Admin Service: Updated batch ${batchId} status to CANCELLED`);

      return {
        cancelledCount,
        preservedCount,
        homepageUrl: batch.homepageUrl,
      };
    });

    // Step 7: Log audit trail (fire-and-forget)
    const { log } = await import('./audit.service.js');
    log({
      adminId,
      action: 'CANCEL_BATCH',
      targetId: batchId,
      targetType: 'BatchScan',
      details: {
        metadata: {
          cancelledCount: result.cancelledCount,
          preservedCount: result.preservedCount,
          homepageUrl: result.homepageUrl,
        },
      },
      ipAddress: '0.0.0.0', // Will be set by controller
      userAgent: 'Admin Service',
    }).catch((err) => {
      console.error('❌ Batch Admin Service: Failed to log audit:', err);
    });

    return {
      batchId,
      status: 'CANCELLED',
      cancelledCount: result.cancelledCount,
      preservedCount: result.preservedCount,
      message: `Cancelled ${result.cancelledCount} scans, preserved ${result.preservedCount} completed scans`,
    };
  } catch (error) {
    // Re-throw BatchAdminServiceError as-is
    if (error instanceof BatchAdminServiceError) {
      throw error;
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Batch Admin Service: Failed to cancel batch:', err.message);
    throw new BatchAdminServiceError(
      'Failed to cancel batch',
      'UNAUTHORIZED',
      err
    );
  }
}

/**
 * Delete batch response
 */
export interface DeleteBatchResponse {
  batchId: string;
  deletedScans: number;
  deletedIssues: number;
  message: string;
}

/**
 * Delete a batch scan and all its associated data
 *
 * Permanently deletes batch, all scans, scan results, issues, and related data.
 * This operation is irreversible and cascades through all related tables.
 * Logs audit trail for accountability.
 *
 * @param batchId - Batch scan ID to delete
 * @param adminId - Admin user ID performing the action
 * @returns Deletion summary with counts
 * @throws BatchAdminServiceError if batch not found or operation fails
 *
 * @example
 * ```typescript
 * const result = await deleteBatch('batch-123', 'admin-456');
 * console.log(`Deleted batch with ${result.deletedScans} scans and ${result.deletedIssues} issues`);
 * ```
 */
export async function deleteBatch(
  batchId: string,
  adminId: string
): Promise<DeleteBatchResponse> {
  const prisma = getPrismaClient();

  try {
    // Validate input
    if (!batchId || typeof batchId !== 'string') {
      throw new BatchAdminServiceError(
        'Invalid batch ID',
        'UNAUTHORIZED'
      );
    }

    if (!adminId || typeof adminId !== 'string') {
      throw new BatchAdminServiceError(
        'Invalid admin ID',
        'UNAUTHORIZED'
      );
    }

    // Use Prisma transaction for atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Step 1: Verify batch exists and get metadata
      const batch = await tx.batchScan.findUnique({
        where: { id: batchId },
        select: {
          id: true,
          homepageUrl: true,
          totalUrls: true,
          status: true,
        },
      });

      if (!batch) {
        throw new BatchAdminServiceError(
          `Batch not found: ${batchId}`,
          'UNAUTHORIZED'
        );
      }

      console.log(`🗑️ Batch Admin Service: Deleting batch ${batchId} by admin ${adminId}`);

      // Step 2: Get all scans in the batch
      const scans = await tx.scan.findMany({
        where: { batchId },
        select: {
          id: true,
        },
      });

      const scanIds = scans.map((s) => s.id);
      const deletedScans = scanIds.length;

      // Step 3: Count issues before deletion
      const scanResultIds = await tx.scanResult
        .findMany({
          where: { scanId: { in: scanIds } },
          select: { id: true },
        })
        .then((results) => results.map((r) => r.id));

      const issuesCount = await tx.issue.count({
        where: {
          scanResultId: {
            in: scanResultIds,
          },
        },
      });

      // Step 4: Delete related data in order (due to foreign key constraints)
      // Delete issues first
      await tx.issue.deleteMany({
        where: {
          scanResultId: {
            in: scanResultIds,
          },
        },
      });

      // Delete scan events
      await tx.scanEvent.deleteMany({
        where: { scanId: { in: scanIds } },
      });

      // Delete reports
      await tx.report.deleteMany({
        where: { scanId: { in: scanIds } },
      });

      // Delete scan results
      await tx.scanResult.deleteMany({
        where: { scanId: { in: scanIds } },
      });

      // Delete scans
      await tx.scan.deleteMany({
        where: { id: { in: scanIds } },
      });

      // Step 5: Delete the batch itself
      await tx.batchScan.delete({
        where: { id: batchId },
      });

      console.log(
        `✅ Batch Admin Service: Deleted batch ${batchId} with ${deletedScans} scans and ${issuesCount} issues`
      );

      return {
        deletedScans,
        deletedIssues: issuesCount,
        homepageUrl: batch.homepageUrl,
        totalUrls: batch.totalUrls,
        status: batch.status,
      };
    });

    // Step 6: Log audit trail (fire-and-forget)
    const { log } = await import('./audit.service.js');
    log({
      adminId,
      action: 'DELETE_BATCH',
      targetId: batchId,
      targetType: 'BatchScan',
      details: {
        metadata: {
          deletedScans: result.deletedScans,
          deletedIssues: result.deletedIssues,
          homepageUrl: result.homepageUrl,
          totalUrls: result.totalUrls,
          status: result.status,
        },
      },
      ipAddress: '0.0.0.0', // Will be set by controller
      userAgent: 'Admin Service',
    }).catch((err) => {
      console.error('❌ Batch Admin Service: Failed to log audit:', err);
    });

    return {
      batchId,
      deletedScans: result.deletedScans,
      deletedIssues: result.deletedIssues,
      message: `Deleted batch with ${result.deletedScans} scans and ${result.deletedIssues} issues`,
    };
  } catch (error) {
    // Re-throw BatchAdminServiceError as-is
    if (error instanceof BatchAdminServiceError) {
      throw error;
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Batch Admin Service: Failed to delete batch:', err.message);
    throw new BatchAdminServiceError(
      'Failed to delete batch',
      'UNAUTHORIZED',
      err
    );
  }
}

/**
 * Retry failed scans response
 */
export interface RetryFailedResponse {
  batchId: string;
  retriedCount: number;
  jobIds: string[];
  message: string;
}

/**
 * Retry failed scans in a batch
 *
 * Re-queues all FAILED scans in the batch for another attempt.
 * Updates scan status to PENDING and adds new jobs to the queue.
 * Logs audit trail for accountability.
 *
 * Note: Retried scans count toward user's rate limits (Requirement 3.6).
 *
 * @param batchId - Batch scan ID to retry
 * @param adminId - Admin user ID performing the action
 * @returns Retry summary with counts and job IDs
 * @throws BatchAdminServiceError if batch not found or operation fails
 *
 * @example
 * ```typescript
 * const result = await retryFailedScans('batch-123', 'admin-456');
 * console.log(`Retried ${result.retriedCount} failed scans`);
 * console.log(`Job IDs: ${result.jobIds.join(', ')}`);
 * ```
 */
export async function retryFailedScans(
  batchId: string,
  adminId: string
): Promise<RetryFailedResponse> {
  const prisma = getPrismaClient();

  try {
    // Validate input
    if (!batchId || typeof batchId !== 'string') {
      throw new BatchAdminServiceError(
        'Invalid batch ID',
        'UNAUTHORIZED'
      );
    }

    if (!adminId || typeof adminId !== 'string') {
      throw new BatchAdminServiceError(
        'Invalid admin ID',
        'UNAUTHORIZED'
      );
    }

    // Use Prisma transaction for atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Step 1: Verify batch exists
      const batch = await tx.batchScan.findUnique({
        where: { id: batchId },
        select: {
          id: true,
          homepageUrl: true,
          wcagLevel: true,
          guestSessionId: true,
          userId: true,
        },
      });

      if (!batch) {
        throw new BatchAdminServiceError(
          `Batch not found: ${batchId}`,
          'UNAUTHORIZED'
        );
      }

      console.log(`🔄 Batch Admin Service: Retrying failed scans for batch ${batchId} by admin ${adminId}`);

      // Step 2: Find all FAILED scans
      const failedScans = await tx.scan.findMany({
        where: {
          batchId,
          status: 'FAILED',
        },
        select: {
          id: true,
          url: true,
        },
      });

      if (failedScans.length === 0) {
        console.log(`ℹ️ Batch Admin Service: No failed scans found in batch ${batchId}`);
        return {
          retriedCount: 0,
          jobIds: [],
          homepageUrl: batch.homepageUrl,
        };
      }

      // Step 3: Update failed scans to PENDING status
      await tx.scan.updateMany({
        where: {
          id: { in: failedScans.map((s) => s.id) },
          status: 'FAILED',
        },
        data: {
          status: 'PENDING',
          errorMessage: null,
          completedAt: null,
        },
      });

      // Step 4: Decrement batch failedCount
      await tx.batchScan.update({
        where: { id: batchId },
        data: {
          failedCount: {
            decrement: failedScans.length,
          },
        },
      });

      console.log(`✅ Batch Admin Service: Updated ${failedScans.length} scans to PENDING status`);

      return {
        retriedCount: failedScans.length,
        failedScans,
        homepageUrl: batch.homepageUrl,
        wcagLevel: batch.wcagLevel,
        guestSessionId: batch.guestSessionId,
        userId: batch.userId,
      };
    });

    // Step 5: Queue scan jobs for retry (outside transaction)
    const { addScanJob } = await import('../../shared/queue/queue.service.js');
    const jobIds: string[] = [];

    for (const scan of result.failedScans ?? []) {
      try {
        const jobId = await addScanJob(scan.id, scan.url, result.wcagLevel, {
          sessionId: result.guestSessionId ?? undefined,
          userId: result.userId ?? undefined,
        });
        jobIds.push(jobId);
      } catch (error) {
        console.error(
          `❌ Batch Admin Service: Failed to queue retry job for scan ${scan.id}:`,
          error
        );
        // Continue with other scans even if one fails
      }
    }

    console.log(`✅ Batch Admin Service: Queued ${jobIds.length} retry jobs for batch ${batchId}`);

    // Step 6: Log audit trail (fire-and-forget)
    const { log } = await import('./audit.service.js');
    log({
      adminId,
      action: 'RETRY_BATCH',
      targetId: batchId,
      targetType: 'BatchScan',
      details: {
        metadata: {
          retriedCount: result.retriedCount,
          jobIds,
          homepageUrl: result.homepageUrl,
        },
      },
      ipAddress: '0.0.0.0', // Will be set by controller
      userAgent: 'Admin Service',
    }).catch((err) => {
      console.error('❌ Batch Admin Service: Failed to log audit:', err);
    });

    return {
      batchId,
      retriedCount: result.retriedCount,
      jobIds,
      message: `Retried ${result.retriedCount} failed scans, queued ${jobIds.length} jobs`,
    };
  } catch (error) {
    // Re-throw BatchAdminServiceError as-is
    if (error instanceof BatchAdminServiceError) {
      throw error;
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Batch Admin Service: Failed to retry failed scans:', err.message);
    throw new BatchAdminServiceError(
      'Failed to retry failed scans',
      'UNAUTHORIZED',
      err
    );
  }
}

/**
 * Export batch scan in specified format
 *
 * Generates batch export in PDF, JSON, or CSV format.
 * - PDF: Executive summary with aggregate statistics and top critical URLs
 * - JSON: Full batch data including all scans and issue details
 * - CSV: Issue summary by URL with counts per severity level
 *
 * @param batchId - Batch scan ID to export
 * @param format - Export format ('pdf' | 'json' | 'csv')
 * @returns Buffer containing the exported data
 * @throws BatchAdminServiceError if batch not found or export fails
 *
 * @example
 * ```typescript
 * // Export as PDF
 * const pdfBuffer = await exportBatch('batch-123', 'pdf');
 *
 * // Export as JSON
 * const jsonBuffer = await exportBatch('batch-123', 'json');
 *
 * // Export as CSV
 * const csvBuffer = await exportBatch('batch-123', 'csv');
 * ```
 */
export async function exportBatch(
  batchId: string,
  format: 'pdf' | 'json' | 'csv'
): Promise<Buffer> {
  const prisma = getPrismaClient();

  try {
    // Validate batch ID
    if (!batchId || typeof batchId !== 'string') {
      throw new BatchAdminServiceError(
        'Invalid batch ID',
        'UNAUTHORIZED'
      );
    }

    // Validate format
    if (!['pdf', 'json', 'csv'].includes(format)) {
      throw new BatchAdminServiceError(
        'Invalid export format',
        'UNAUTHORIZED'
      );
    }

    console.log(`📦 Batch Admin Service: Exporting batch ${batchId} as ${format.toUpperCase()}`);

    // Fetch batch with all related data
    const batch = await prisma.batchScan.findUnique({
      where: { id: batchId },
      include: {
        scans: {
          include: {
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
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    // Check if batch exists
    if (!batch) {
      throw new BatchAdminServiceError(
        `Batch not found: ${batchId}`,
        'UNAUTHORIZED'
      );
    }

    // Generate export based on format
    switch (format) {
      case 'pdf':
        return await generatePdfExport(batch);
      case 'json':
        return generateJsonExport(batch);
      case 'csv':
        return generateCsvExport(batch);
      default:
        throw new BatchAdminServiceError(
          `Unsupported export format: ${format}`,
          'UNAUTHORIZED'
        );
    }
  } catch (error) {
    // Re-throw BatchAdminServiceError as-is
    if (error instanceof BatchAdminServiceError) {
      throw error;
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`❌ Batch Admin Service: Failed to export batch:`, err.message);
    throw new BatchAdminServiceError(
      `Failed to export batch as ${format}`,
      'UNAUTHORIZED',
      err
    );
  }
}

/**
 * Generate PDF export for batch scan
 *
 * Uses the batch-export.service to generate a PDF with executive summary.
 *
 * @param batch - Batch data with scans and results
 * @returns PDF buffer
 */
async function generatePdfExport(batch: any): Promise<Buffer> {
  const { generateBatchPdf } = await import('../batches/batch-export.service.js');

  // Transform scans to include issue counts
  const scansWithCounts = batch.scans.map((scan: any) => ({
    url: scan.url,
    pageTitle: scan.pageTitle,
    status: scan.status,
    criticalCount: scan.scanResult?.criticalCount ?? 0,
    seriousCount: scan.scanResult?.seriousCount ?? 0,
    moderateCount: scan.scanResult?.moderateCount ?? 0,
    minorCount: scan.scanResult?.minorCount ?? 0,
    totalIssues: scan.scanResult?.totalIssues ?? 0,
  }));

  // Get top 5 URLs with most critical issues
  const topCriticalUrls = scansWithCounts
    .filter((scan: any) => scan.status === 'COMPLETED' && scan.criticalCount > 0)
    .sort((a: any, b: any) => {
      if (b.criticalCount !== a.criticalCount) {
        return b.criticalCount - a.criticalCount;
      }
      return b.totalIssues - a.totalIssues;
    })
    .slice(0, 5)
    .map((scan: any) => ({
      url: scan.url,
      pageTitle: scan.pageTitle,
      criticalCount: scan.criticalCount,
    }));

  // Calculate aggregate statistics
  const aggregate = {
    totalIssues: batch.totalIssues ?? 0,
    criticalCount: batch.criticalCount ?? 0,
    seriousCount: batch.seriousCount ?? 0,
    moderateCount: batch.moderateCount ?? 0,
    minorCount: batch.minorCount ?? 0,
    passedChecks: scansWithCounts.reduce(
      (sum: number, scan: any) => sum + (scan.scanResult?.passedChecks ?? 0),
      0
    ),
    urlsScanned: batch.completedCount,
  };

  // Prepare input for PDF generation
  const input = {
    metadata: {
      batchId: batch.id,
      homepageUrl: batch.homepageUrl,
      totalUrls: batch.totalUrls,
      completedCount: batch.completedCount,
      failedCount: batch.failedCount,
      wcagLevel: batch.wcagLevel,
      createdAt: batch.createdAt,
      completedAt: batch.completedAt,
      status: batch.status,
    },
    aggregate,
    topCriticalUrls,
  };

  // Generate PDF
  const pdfBuffer = await generateBatchPdf(input);

  console.log(`✅ Batch Admin Service: Generated PDF export for batch ${batch.id}`);
  return pdfBuffer;
}

/**
 * Generate JSON export for batch scan
 *
 * Returns full batch data including all scans and results.
 *
 * @param batch - Batch data with scans and results
 * @returns JSON buffer
 */
function generateJsonExport(batch: any): Buffer {
  // Convert to plain object and remove circular references
  const exportData = {
    id: batch.id,
    homepageUrl: batch.homepageUrl,
    wcagLevel: batch.wcagLevel,
    status: batch.status,
    totalUrls: batch.totalUrls,
    completedCount: batch.completedCount,
    failedCount: batch.failedCount,
    totalIssues: batch.totalIssues,
    criticalCount: batch.criticalCount,
    seriousCount: batch.seriousCount,
    moderateCount: batch.moderateCount,
    minorCount: batch.minorCount,
    createdAt: batch.createdAt.toISOString(),
    completedAt: batch.completedAt?.toISOString() ?? null,
    scans: batch.scans.map((scan: any) => ({
      id: scan.id,
      url: scan.url,
      pageTitle: scan.pageTitle,
      status: scan.status,
      errorMessage: scan.errorMessage,
      durationMs: scan.durationMs,
      createdAt: scan.createdAt.toISOString(),
      completedAt: scan.completedAt?.toISOString() ?? null,
      results: scan.scanResult
        ? {
            totalIssues: scan.scanResult.totalIssues,
            criticalCount: scan.scanResult.criticalCount,
            seriousCount: scan.scanResult.seriousCount,
            moderateCount: scan.scanResult.moderateCount,
            minorCount: scan.scanResult.minorCount,
            passedChecks: scan.scanResult.passedChecks,
          }
        : null,
    })),
  };

  const jsonString = JSON.stringify(exportData, null, 2);
  console.log(`✅ Batch Admin Service: Generated JSON export for batch ${batch.id}`);
  return Buffer.from(jsonString, 'utf-8');
}

/**
 * Generate CSV export for batch scan
 *
 * Returns CSV with URL, status, and issue counts per row.
 *
 * @param batch - Batch data with scans and results
 * @returns CSV buffer
 */
function generateCsvExport(batch: any): Buffer {
  // CSV header
  const header = 'URL,Page Title,Status,Critical,Serious,Moderate,Minor,Total Issues,Error Message\n';

  // CSV rows
  const rows = batch.scans.map((scan: any) => {
    const url = `"${(scan.url || '').replace(/"/g, '""')}"`;
    const pageTitle = `"${(scan.pageTitle || '').replace(/"/g, '""')}"`;
    const status = scan.status;
    const critical = scan.scanResult?.criticalCount ?? 0;
    const serious = scan.scanResult?.seriousCount ?? 0;
    const moderate = scan.scanResult?.moderateCount ?? 0;
    const minor = scan.scanResult?.minorCount ?? 0;
    const total = scan.scanResult?.totalIssues ?? 0;
    const errorMessage = `"${(scan.errorMessage || '').replace(/"/g, '""')}"`;

    return `${url},${pageTitle},${status},${critical},${serious},${moderate},${minor},${total},${errorMessage}`;
  });

  const csv = header + rows.join('\n');
  console.log(`✅ Batch Admin Service: Generated CSV export for batch ${batch.id}`);
  return Buffer.from(csv, 'utf-8');
}

/**
 * Batch metrics for dashboard
 */
export interface BatchMetricsResponse {
  /** Total batch counts */
  totals: {
    /** Batches created today */
    today: number;
    /** Batches created this week */
    thisWeek: number;
    /** Batches created this month */
    thisMonth: number;
  };
  /** Average metrics */
  averages: {
    /** Average URLs per batch */
    urlsPerBatch: number;
    /** Average processing time in milliseconds */
    processingTimeMs: number;
    /** Completion rate as percentage */
    completionRate: number;
  };
  /** Recent batches (last 5) */
  recentBatches: Array<{
    /** Batch ID */
    id: string;
    /** Homepage URL */
    homepageUrl: string;
    /** Batch status */
    status: BatchStatus;
    /** Progress string (e.g., "5/10") */
    progress: string;
    /** Created timestamp */
    createdAt: string;
  }>;
  /** Trend data for dashboard chart */
  trends: Array<{
    /** Date string (YYYY-MM-DD) */
    date: string;
    /** Number of batches created on this date */
    batchCount: number;
    /** Average URLs per batch on this date */
    avgUrls: number;
    /** Completion rate as percentage on this date */
    completionRate: number;
  }>;
}

/**
 * Get batch metrics for dashboard
 *
 * Retrieves comprehensive metrics for the batch scanning dashboard including:
 * - Total batches by time period (today/week/month)
 * - Average batch size, processing time, and completion rate
 * - Recent batches (last 5) with status and progress
 * - Trend data for visualization (last 30 days by default)
 *
 * Requirements:
 * - 5.1: Dashboard metrics (totals, averages, completion rate)
 * - 5.2: Recent batches widget (last 5 with homepage, status, progress)
 * - 5.3: Dashboard trends (daily batch count, avg URLs, completion rate)
 *
 * @param trendDays - Number of days for trend data (default: 30)
 * @returns Batch metrics object
 * @throws BatchAdminServiceError if metrics calculation fails
 *
 * @example
 * ```typescript
 * const metrics = await getBatchMetrics();
 * console.log(`Batches today: ${metrics.totals.today}`);
 * console.log(`Average URLs per batch: ${metrics.averages.urlsPerBatch}`);
 * console.log(`Completion rate: ${metrics.averages.completionRate}%`);
 * console.log(`Recent batches: ${metrics.recentBatches.length}`);
 * console.log(`Trend data points: ${metrics.trends.length}`);
 * ```
 */
export async function getBatchMetrics(trendDays = 30): Promise<BatchMetricsResponse> {
  const prisma = getPrismaClient();

  try {
    console.log('📊 Batch Admin Service: Calculating batch metrics');

    const now = new Date();

    // Calculate time boundaries
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);

    const startOfTrends = new Date(now);
    startOfTrends.setDate(now.getDate() - trendDays);
    startOfTrends.setHours(0, 0, 0, 0);

    // Execute all queries in parallel for performance
    const [
      todayCount,
      weekCount,
      monthCount,
      avgStats,
      completedBatches,
      totalNonPendingBatches,
      recentBatches,
      trendData,
    ] = await Promise.all([
      // Total counts by time period
      prisma.batchScan.count({
        where: { createdAt: { gte: startOfToday } },
      }),
      prisma.batchScan.count({
        where: { createdAt: { gte: startOfWeek } },
      }),
      prisma.batchScan.count({
        where: { createdAt: { gte: startOfMonth } },
      }),

      // Average statistics (URLs per batch and processing time)
      prisma.batchScan.aggregate({
        _avg: {
          totalUrls: true,
        },
        where: {
          status: 'COMPLETED',
        },
      }),

      // Completion rate calculation
      prisma.batchScan.count({
        where: { status: 'COMPLETED' },
      }),
      prisma.batchScan.count({
        where: { status: { not: 'PENDING' } },
      }),

      // Recent batches (last 5)
      prisma.batchScan.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          homepageUrl: true,
          status: true,
          totalUrls: true,
          completedCount: true,
          failedCount: true,
          createdAt: true,
        },
      }),

      // Trend data (raw query for performance)
      prisma.$queryRaw<
        Array<{
          date: Date;
          batch_count: bigint;
          avg_urls: number;
          completed_count: bigint;
          total_count: bigint;
        }>
      >`
        SELECT
          DATE_TRUNC('day', "createdAt")::date as date,
          COUNT(*)::bigint as batch_count,
          AVG("totalUrls")::numeric as avg_urls,
          COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END)::bigint as completed_count,
          COUNT(CASE WHEN status != 'PENDING' THEN 1 END)::bigint as total_count
        FROM "batch_scans"
        WHERE "createdAt" >= ${startOfTrends}::timestamptz
        GROUP BY DATE_TRUNC('day', "createdAt")::date
        ORDER BY date ASC
      `,
    ]);

    // Calculate averages
    const avgUrlsPerBatch = Math.round(avgStats._avg.totalUrls ?? 0);
    const completionRate =
      totalNonPendingBatches > 0
        ? Math.round((completedBatches / totalNonPendingBatches) * 100 * 10) / 10
        : 0;

    // Calculate processing time from raw data
    const batchesWithTime = await prisma.batchScan.findMany({
      where: {
        status: 'COMPLETED',
        completedAt: { not: null },
      },
      select: {
        createdAt: true,
        completedAt: true,
      },
      take: 100, // Sample last 100 completed batches
      orderBy: { completedAt: 'desc' },
    });

    const avgProcessingTimeMs =
      batchesWithTime.length > 0
        ? Math.round(
            batchesWithTime.reduce((sum, batch) => {
              const duration =
                batch.completedAt!.getTime() - batch.createdAt.getTime();
              return sum + duration;
            }, 0) / batchesWithTime.length
          )
        : 0;

    // Transform recent batches
    const recentBatchesFormatted = recentBatches.map((batch) => ({
      id: batch.id,
      homepageUrl: batch.homepageUrl,
      status: batch.status,
      progress: `${batch.completedCount + batch.failedCount}/${batch.totalUrls}`,
      createdAt: batch.createdAt.toISOString(),
    }));

    // Transform trend data
    const trendMap = new Map<string, any>();
    for (const row of trendData) {
      const dateStr = row.date.toISOString().split('T')[0] as string;
      const batchCount = Number(row.batch_count);
      const avgUrls = Math.round(Number(row.avg_urls) || 0);
      const completedCount = Number(row.completed_count);
      const totalCount = Number(row.total_count);
      const completionRate =
        totalCount > 0
          ? Math.round((completedCount / totalCount) * 100 * 10) / 10
          : 0;

      trendMap.set(dateStr, {
        date: dateStr,
        batchCount,
        avgUrls,
        completionRate,
      });
    }

    // Fill in missing dates with zero counts
    const trends: Array<{
      date: string;
      batchCount: number;
      avgUrls: number;
      completionRate: number;
    }> = [];

    for (let i = trendDays - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split('T')[0] as string;

      trends.push(
        trendMap.get(dateStr) ?? {
          date: dateStr,
          batchCount: 0,
          avgUrls: 0,
          completionRate: 0,
        }
      );
    }

    console.log(`✅ Batch Admin Service: Calculated batch metrics (${trends.length} trend data points)`);

    return {
      totals: {
        today: todayCount,
        thisWeek: weekCount,
        thisMonth: monthCount,
      },
      averages: {
        urlsPerBatch: avgUrlsPerBatch,
        processingTimeMs: avgProcessingTimeMs,
        completionRate,
      },
      recentBatches: recentBatchesFormatted,
      trends,
    };
  } catch (error) {
    // Wrap errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`❌ Batch Admin Service: Failed to get batch metrics:`, err.message);
    throw new BatchAdminServiceError(
      'Failed to get batch metrics',
      'UNAUTHORIZED',
      err
    );
  }
}

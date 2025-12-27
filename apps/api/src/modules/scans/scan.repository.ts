/**
 * Scan Repository
 *
 * Data access layer for scan operations using Prisma ORM.
 * Implements clean architecture - repository handles only database operations.
 */

import { getPrismaClient } from '../../config/database.js';
import type { Scan, ScanResult, Issue, ScanStatus, WcagLevel } from '@prisma/client';

/**
 * Scan Repository Error
 */
export class ScanRepositoryError extends Error {
  public readonly code: string;
  public override readonly cause?: Error | undefined;

  constructor(message: string, code: string, cause?: Error | undefined) {
    super(message);
    this.name = 'ScanRepositoryError';
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Scan with related result data
 */
export interface ScanWithResult extends Scan {
  scanResult: (ScanResult & { issues: Issue[] }) | null;
}

/**
 * Input data for creating a new scan
 */
export interface CreateScanData {
  url: string;
  email?: string | null;
  wcagLevel: WcagLevel;
  guestSessionId?: string | null;
  userId?: string | null;
}

/**
 * Pagination options for listing scans
 */
export interface PaginationOptions {
  /** Number of items to return */
  limit?: number;
  /** Cursor for pagination (scan ID) */
  cursor?: string;
}

/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
  /** Array of items */
  items: T[];
  /** Cursor for next page (null if no more items) */
  nextCursor: string | null;
  /** Total count of items */
  totalCount: number;
}

/**
 * Create a new scan in the database
 *
 * @param data - Scan creation data
 * @returns The created scan
 * @throws ScanRepositoryError if validation fails or database error occurs
 *
 * @example
 * ```typescript
 * const scan = await createScan({
 *   url: 'https://example.com',
 *   email: 'user@example.com',
 *   wcagLevel: 'AA',
 *   guestSessionId: 'session-123'
 * });
 * ```
 */
export async function createScan(data: CreateScanData): Promise<Scan> {
  const prisma = getPrismaClient();

  try {
    // Validate required fields
    if (!data.url || typeof data.url !== 'string') {
      throw new ScanRepositoryError(
        'URL is required and must be a string',
        'INVALID_INPUT'
      );
    }

    if (!data.wcagLevel) {
      throw new ScanRepositoryError(
        'WCAG level is required',
        'INVALID_INPUT'
      );
    }

    // Ensure at least one session/user ID is provided
    if (!data.guestSessionId && !data.userId) {
      throw new ScanRepositoryError(
        'Either guestSessionId or userId must be provided',
        'INVALID_INPUT'
      );
    }

    // Create scan with PENDING status
    const scan = await prisma.scan.create({
      data: {
        url: data.url,
        email: data.email ?? null,
        wcagLevel: data.wcagLevel,
        guestSessionId: data.guestSessionId ?? null,
        userId: data.userId ?? null,
        status: 'PENDING',
      },
    });

    console.log(`✅ Scan Repository: Created scan ${scan.id} for URL ${scan.url}`);
    return scan;
  } catch (error) {
    // Re-throw ScanRepositoryError as-is
    if (error instanceof ScanRepositoryError) {
      throw error;
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Scan Repository: Failed to create scan:', err.message);
    throw new ScanRepositoryError(
      'Failed to create scan',
      'CREATE_FAILED',
      err
    );
  }
}

/**
 * Get scan by ID with related result and issues
 *
 * @param id - Scan ID
 * @returns The scan with result and issues, or null if not found
 *
 * @example
 * ```typescript
 * const scan = await getScanById('scan-123');
 * if (scan) {
 *   console.log(`Scan status: ${scan.status}`);
 *   console.log(`Total issues: ${scan.scanResult?.totalIssues ?? 0}`);
 * }
 * ```
 */
export async function getScanById(id: string): Promise<ScanWithResult | null> {
  const prisma = getPrismaClient();

  try {
    if (!id || typeof id !== 'string') {
      return null;
    }

    const scan = await prisma.scan.findUnique({
      where: { id },
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
      },
    });

    return scan as ScanWithResult | null;
  } catch (error) {
    console.error('❌ Scan Repository: Failed to get scan:', error);
    throw new ScanRepositoryError(
      `Failed to get scan ${id}`,
      'GET_FAILED',
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * List scans by session ID with cursor-based pagination
 *
 * @param sessionId - Guest session ID
 * @param options - Pagination options
 * @returns Paginated list of scans
 *
 * @example
 * ```typescript
 * const result = await listScansBySession('session-123', { limit: 10 });
 * console.log(`Found ${result.items.length} scans`);
 * if (result.nextCursor) {
 *   // Fetch next page
 *   const nextPage = await listScansBySession('session-123', {
 *     limit: 10,
 *     cursor: result.nextCursor
 *   });
 * }
 * ```
 */
export async function listScansBySession(
  sessionId: string,
  options: PaginationOptions = {}
): Promise<PaginatedResult<Scan>> {
  const prisma = getPrismaClient();

  try {
    if (!sessionId || typeof sessionId !== 'string') {
      throw new ScanRepositoryError(
        'Session ID is required and must be a string',
        'INVALID_INPUT'
      );
    }

    const limit = options.limit ?? 20; // Default limit
    const cursor = options.cursor;

    // Build query options
    const queryOptions: {
      where: { guestSessionId: string };
      take: number;
      skip?: number;
      cursor?: { id: string };
      orderBy: { createdAt: 'desc' };
    } = {
      where: { guestSessionId: sessionId },
      take: limit + 1, // Fetch one extra to determine if there's a next page
      orderBy: { createdAt: 'desc' },
    };

    // Add cursor if provided
    if (cursor) {
      queryOptions.cursor = { id: cursor };
      queryOptions.skip = 1; // Skip the cursor itself
    }

    // Execute query
    const scans = await prisma.scan.findMany(queryOptions);

    // Get total count
    const totalCount = await prisma.scan.count({
      where: { guestSessionId: sessionId },
    });

    // Determine if there's a next page
    const hasMore = scans.length > limit;
    const items = hasMore ? scans.slice(0, limit) : scans;
    const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

    return {
      items,
      nextCursor,
      totalCount,
    };
  } catch (error) {
    // Re-throw ScanRepositoryError as-is
    if (error instanceof ScanRepositoryError) {
      throw error;
    }

    console.error('❌ Scan Repository: Failed to list scans:', error);
    throw new ScanRepositoryError(
      `Failed to list scans for session ${sessionId}`,
      'LIST_FAILED',
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Update scan status
 *
 * @param id - Scan ID
 * @param status - New status
 * @param errorMessage - Optional error message for FAILED status
 * @returns Updated scan
 * @throws ScanRepositoryError if scan not found or update fails
 *
 * @example
 * ```typescript
 * // Mark scan as running
 * await updateScanStatus('scan-123', 'RUNNING');
 *
 * // Mark scan as failed
 * await updateScanStatus('scan-123', 'FAILED', 'Connection timeout');
 *
 * // Mark scan as completed
 * await updateScanStatus('scan-123', 'COMPLETED');
 * ```
 */
export async function updateScanStatus(
  id: string,
  status: ScanStatus,
  errorMessage?: string
): Promise<Scan> {
  const prisma = getPrismaClient();

  try {
    if (!id || typeof id !== 'string') {
      throw new ScanRepositoryError(
        'Scan ID is required and must be a string',
        'INVALID_INPUT'
      );
    }

    if (!status) {
      throw new ScanRepositoryError(
        'Status is required',
        'INVALID_INPUT'
      );
    }

    // Check if scan exists
    const existingScan = await prisma.scan.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!existingScan) {
      throw new ScanRepositoryError(
        `Scan not found: ${id}`,
        'NOT_FOUND'
      );
    }

    // Build update data
    const updateData: {
      status: ScanStatus;
      errorMessage?: string | null;
      completedAt?: Date;
    } = {
      status,
    };

    // Set completedAt for terminal states
    if (status === 'COMPLETED' || status === 'FAILED') {
      updateData.completedAt = new Date();
    }

    // Set error message for FAILED status
    if (status === 'FAILED' && errorMessage) {
      updateData.errorMessage = errorMessage;
    }

    // Update scan
    const scan = await prisma.scan.update({
      where: { id },
      data: updateData,
    });

    console.log(`✅ Scan Repository: Updated scan ${id} status to ${status}`);
    return scan;
  } catch (error) {
    // Re-throw ScanRepositoryError as-is
    if (error instanceof ScanRepositoryError) {
      throw error;
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Scan Repository: Failed to update scan status:', err.message);
    throw new ScanRepositoryError(
      `Failed to update scan ${id}`,
      'UPDATE_FAILED',
      err
    );
  }
}

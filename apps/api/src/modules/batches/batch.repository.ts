/**
 * Batch Repository
 *
 * Data access layer for batch scan operations using Prisma ORM.
 * Implements clean architecture - repository handles only database operations.
 */

import { getPrismaClient } from '../../config/database.js';
import type { BatchScan, BatchStatus, WcagLevel } from '@prisma/client';

/**
 * Batch Repository Error
 */
export class BatchRepositoryError extends Error {
  public readonly code: string;
  public override readonly cause?: Error | undefined;

  constructor(message: string, code: string, cause?: Error | undefined) {
    super(message);
    this.name = 'BatchRepositoryError';
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Input data for creating a new batch scan
 */
export interface CreateBatchData {
  homepageUrl: string;
  wcagLevel: WcagLevel;
  totalUrls: number;
  guestSessionId?: string | null;
  userId?: string | null;
  discoveryId?: string | null;
}

/**
 * Aggregate statistics for updating batch results
 */
export interface AggregateStats {
  totalIssues: number;
  criticalCount: number;
  seriousCount: number;
  moderateCount: number;
  minorCount: number;
}

/**
 * Create a new batch scan in the database
 *
 * @param data - Batch creation data
 * @returns The created batch scan
 * @throws BatchRepositoryError if validation fails or database error occurs
 *
 * @example
 * ```typescript
 * const batch = await create({
 *   homepageUrl: 'https://example.com',
 *   wcagLevel: 'AA',
 *   totalUrls: 5,
 *   guestSessionId: 'session-123'
 * });
 * ```
 */
export async function create(data: CreateBatchData): Promise<BatchScan> {
  const prisma = getPrismaClient();

  try {
    // Validate required fields
    if (!data.homepageUrl || typeof data.homepageUrl !== 'string') {
      throw new BatchRepositoryError(
        'Homepage URL is required and must be a string',
        'INVALID_INPUT'
      );
    }

    if (!data.wcagLevel) {
      throw new BatchRepositoryError(
        'WCAG level is required',
        'INVALID_INPUT'
      );
    }

    if (!data.totalUrls || typeof data.totalUrls !== 'number' || data.totalUrls < 1) {
      throw new BatchRepositoryError(
        'Total URLs must be a positive number',
        'INVALID_INPUT'
      );
    }

    // Ensure at least one session/user ID is provided
    if (!data.guestSessionId && !data.userId) {
      throw new BatchRepositoryError(
        'Either guestSessionId or userId must be provided',
        'INVALID_INPUT'
      );
    }

    // Create batch scan with PENDING status
    const batch = await prisma.batchScan.create({
      data: {
        homepageUrl: data.homepageUrl,
        wcagLevel: data.wcagLevel,
        totalUrls: data.totalUrls,
        guestSessionId: data.guestSessionId ?? null,
        userId: data.userId ?? null,
        discoveryId: data.discoveryId ?? null,
        status: 'PENDING',
      },
    });

    console.log(`✅ Batch Repository: Created batch ${batch.id} for ${batch.homepageUrl} (${batch.totalUrls} URLs)`);
    return batch;
  } catch (error) {
    // Re-throw BatchRepositoryError as-is
    if (error instanceof BatchRepositoryError) {
      throw error;
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Batch Repository: Failed to create batch:', err.message);
    throw new BatchRepositoryError(
      'Failed to create batch scan',
      'CREATE_FAILED',
      err
    );
  }
}

/**
 * Get batch scan by ID
 *
 * @param id - Batch scan ID
 * @returns The batch scan, or null if not found
 *
 * @example
 * ```typescript
 * const batch = await findById('batch-123');
 * if (batch) {
 *   console.log(`Batch status: ${batch.status}`);
 *   console.log(`Progress: ${batch.completedCount}/${batch.totalUrls}`);
 * }
 * ```
 */
export async function findById(id: string): Promise<BatchScan | null> {
  const prisma = getPrismaClient();

  try {
    if (!id || typeof id !== 'string') {
      return null;
    }

    const batch = await prisma.batchScan.findUnique({
      where: { id },
    });

    return batch;
  } catch (error) {
    console.error('❌ Batch Repository: Failed to get batch:', error);
    throw new BatchRepositoryError(
      `Failed to get batch ${id}`,
      'GET_FAILED',
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Find batch scans by session ID
 *
 * @param sessionId - Guest session ID
 * @returns Array of batch scans for the session
 *
 * @example
 * ```typescript
 * const batches = await findBySessionId('session-123');
 * console.log(`Found ${batches.length} batch scans`);
 * ```
 */
export async function findBySessionId(sessionId: string): Promise<BatchScan[]> {
  const prisma = getPrismaClient();

  try {
    if (!sessionId || typeof sessionId !== 'string') {
      throw new BatchRepositoryError(
        'Session ID is required and must be a string',
        'INVALID_INPUT'
      );
    }

    const batches = await prisma.batchScan.findMany({
      where: { guestSessionId: sessionId },
      orderBy: { createdAt: 'desc' },
    });

    return batches;
  } catch (error) {
    // Re-throw BatchRepositoryError as-is
    if (error instanceof BatchRepositoryError) {
      throw error;
    }

    console.error('❌ Batch Repository: Failed to list batches:', error);
    throw new BatchRepositoryError(
      `Failed to list batches for session ${sessionId}`,
      'LIST_FAILED',
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Update batch scan status
 *
 * @param id - Batch scan ID
 * @param status - New status
 * @returns Updated batch scan
 * @throws BatchRepositoryError if batch not found or update fails
 *
 * @example
 * ```typescript
 * // Mark batch as running
 * await updateStatus('batch-123', 'RUNNING');
 *
 * // Mark batch as completed
 * await updateStatus('batch-123', 'COMPLETED');
 *
 * // Mark batch as cancelled
 * await updateStatus('batch-123', 'CANCELLED');
 * ```
 */
export async function updateStatus(
  id: string,
  status: BatchStatus
): Promise<BatchScan> {
  const prisma = getPrismaClient();

  try {
    if (!id || typeof id !== 'string') {
      throw new BatchRepositoryError(
        'Batch ID is required and must be a string',
        'INVALID_INPUT'
      );
    }

    if (!status) {
      throw new BatchRepositoryError(
        'Status is required',
        'INVALID_INPUT'
      );
    }

    // Check if batch exists
    const existingBatch = await prisma.batchScan.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!existingBatch) {
      throw new BatchRepositoryError(
        `Batch scan not found: ${id}`,
        'NOT_FOUND'
      );
    }

    // Build update data
    const updateData: {
      status: BatchStatus;
      completedAt?: Date;
      cancelledAt?: Date;
    } = {
      status,
    };

    // Set completedAt for COMPLETED status
    if (status === 'COMPLETED' || status === 'FAILED' || status === 'STALE') {
      updateData.completedAt = new Date();
    }

    // Set cancelledAt for CANCELLED status
    if (status === 'CANCELLED') {
      updateData.cancelledAt = new Date();
    }

    // Update batch scan
    const batch = await prisma.batchScan.update({
      where: { id },
      data: updateData,
    });

    console.log(`✅ Batch Repository: Updated batch ${id} status to ${status}`);
    return batch;
  } catch (error) {
    // Re-throw BatchRepositoryError as-is
    if (error instanceof BatchRepositoryError) {
      throw error;
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Batch Repository: Failed to update batch status:', err.message);
    throw new BatchRepositoryError(
      `Failed to update batch ${id}`,
      'UPDATE_FAILED',
      err
    );
  }
}

/**
 * Update batch scan aggregate statistics
 *
 * @param id - Batch scan ID
 * @param stats - Aggregate statistics from completed scans
 * @returns Updated batch scan
 * @throws BatchRepositoryError if batch not found or update fails
 *
 * @example
 * ```typescript
 * await updateAggregateStats('batch-123', {
 *   totalIssues: 42,
 *   criticalCount: 5,
 *   seriousCount: 12,
 *   moderateCount: 20,
 *   minorCount: 5
 * });
 * ```
 */
export async function updateAggregateStats(
  id: string,
  stats: AggregateStats
): Promise<BatchScan> {
  const prisma = getPrismaClient();

  try {
    if (!id || typeof id !== 'string') {
      throw new BatchRepositoryError(
        'Batch ID is required and must be a string',
        'INVALID_INPUT'
      );
    }

    if (!stats || typeof stats !== 'object') {
      throw new BatchRepositoryError(
        'Stats object is required',
        'INVALID_INPUT'
      );
    }

    // Validate stats fields
    const requiredFields: (keyof AggregateStats)[] = [
      'totalIssues',
      'criticalCount',
      'seriousCount',
      'moderateCount',
      'minorCount',
    ];

    for (const field of requiredFields) {
      if (typeof stats[field] !== 'number' || stats[field] < 0) {
        throw new BatchRepositoryError(
          `Invalid ${field}: must be a non-negative number`,
          'INVALID_INPUT'
        );
      }
    }

    // Check if batch exists
    const existingBatch = await prisma.batchScan.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingBatch) {
      throw new BatchRepositoryError(
        `Batch scan not found: ${id}`,
        'NOT_FOUND'
      );
    }

    // Update batch scan with aggregate statistics
    const batch = await prisma.batchScan.update({
      where: { id },
      data: {
        totalIssues: stats.totalIssues,
        criticalCount: stats.criticalCount,
        seriousCount: stats.seriousCount,
        moderateCount: stats.moderateCount,
        minorCount: stats.minorCount,
      },
    });

    console.log(`✅ Batch Repository: Updated batch ${id} aggregate stats (${stats.totalIssues} total issues)`);
    return batch;
  } catch (error) {
    // Re-throw BatchRepositoryError as-is
    if (error instanceof BatchRepositoryError) {
      throw error;
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Batch Repository: Failed to update batch stats:', err.message);
    throw new BatchRepositoryError(
      `Failed to update batch stats ${id}`,
      'UPDATE_FAILED',
      err
    );
  }
}

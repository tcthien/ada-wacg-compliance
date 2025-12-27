/**
 * Scan Service
 *
 * Business logic layer for scan operations.
 * Orchestrates URL validation, database operations, job queuing, and caching.
 */

import { getRedisClient } from '../../config/redis.js';
import { validateUrl } from '../../shared/utils/url-validator.js';
import { addScanJob } from '../../shared/queue/queue.service.js';
import { RedisKeys } from '../../shared/constants/redis-keys.js';
import {
  createScan as createScanInRepo,
  getScanById,
  listScansBySession,
  type CreateScanData,
  type PaginationOptions,
  type PaginatedResult,
  type ScanWithResult,
  ScanRepositoryError,
} from './scan.repository.js';
import type { Scan, WcagLevel, ScanStatus } from '@prisma/client';

/**
 * Scan Service Error
 */
export class ScanServiceError extends Error {
  public readonly code: string;
  public override readonly cause?: Error | undefined;

  constructor(message: string, code: string, cause?: Error | undefined) {
    super(message);
    this.name = 'ScanServiceError';
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Input data for creating a scan
 */
export interface CreateScanInput {
  url: string;
  email?: string;
  wcagLevel?: WcagLevel;
}

/**
 * Scan status response
 */
export interface ScanStatusResponse {
  scanId: string;
  status: ScanStatus;
  progress: number;
  url: string;
  createdAt: Date;
  completedAt?: Date | null;
  errorMessage?: string | null;
}

/**
 * Scan result response with issues
 */
export interface ScanResultResponse {
  scanId: string;
  url: string;
  status: ScanStatus;
  wcagLevel: WcagLevel;
  createdAt: Date;
  completedAt: Date | null;
  result: {
    totalIssues: number;
    criticalCount: number;
    seriousCount: number;
    moderateCount: number;
    minorCount: number;
    passedChecks: number;
    inapplicableChecks: number;
    scanDurationMs: number | null;
    issues: Array<{
      id: string;
      impact: string;
      wcagCriteria: string[];
      description: string;
      helpUrl: string;
      cssSelector: string;
      htmlSnippet: string;
    }>;
  } | null;
}

/**
 * Create a new scan
 *
 * 1. Validates URL using url-validator (SSRF protection)
 * 2. Creates scan record via repository with status 'PENDING'
 * 3. Queues 'scan-page' job via queue service
 * 4. Caches initial status in Redis
 * 5. Returns scan ID and status
 *
 * @param sessionId - Guest session ID
 * @param data - Scan creation input
 * @returns Created scan
 * @throws ScanServiceError with codes: INVALID_URL, CREATE_FAILED
 *
 * @example
 * ```typescript
 * const scan = await createScan('session-123', {
 *   url: 'https://example.com',
 *   email: 'user@example.com',
 *   wcagLevel: 'AA'
 * });
 * ```
 */
export async function createScan(
  sessionId: string,
  data: CreateScanInput
): Promise<Scan> {
  try {
    // Validate session ID
    if (!sessionId || typeof sessionId !== 'string') {
      throw new ScanServiceError(
        'Session ID is required and must be a string',
        'INVALID_INPUT'
      );
    }

    // Validate and normalize URL with SSRF protection
    const validationResult = await validateUrl(data.url);

    if (!validationResult.isValid) {
      throw new ScanServiceError(
        validationResult.error ?? 'Invalid URL',
        'INVALID_URL'
      );
    }

    const normalizedUrl = validationResult.normalizedUrl!;

    // Create scan record in database
    const scanData: CreateScanData = {
      url: normalizedUrl,
      email: data.email ?? null,
      wcagLevel: data.wcagLevel ?? 'AA',
      guestSessionId: sessionId,
      userId: null, // Guest sessions don't have user IDs
    };

    const scan = await createScanInRepo(scanData);

    // Queue scan job
    try {
      await addScanJob(scan.id, normalizedUrl, scan.wcagLevel, {
        sessionId,
      });
    } catch (error) {
      // Log queue error but don't fail the request
      // The scan record is created and can be retried later
      console.error('❌ Scan Service: Failed to queue scan job:', error);
    }

    // Cache initial status in Redis
    const redis = getRedisClient();
    const statusKey = RedisKeys.SCAN_STATUS.build(scan.id);
    const progressKey = RedisKeys.SCAN_PROGRESS.build(scan.id);

    try {
      await Promise.all([
        redis.setex(
          statusKey,
          RedisKeys.SCAN_STATUS.ttl,
          JSON.stringify({
            scanId: scan.id,
            status: scan.status,
            url: scan.url,
            createdAt: scan.createdAt.toISOString(),
          })
        ),
        redis.setex(progressKey, RedisKeys.SCAN_PROGRESS.ttl, '0'),
      ]);
    } catch (error) {
      // Log cache error but don't fail the request
      console.error('❌ Scan Service: Failed to cache scan status:', error);
    }

    console.log(`✅ Scan Service: Created scan ${scan.id} for ${normalizedUrl}`);
    return scan;
  } catch (error) {
    // Re-throw ScanServiceError as-is
    if (error instanceof ScanServiceError) {
      throw error;
    }

    // Re-throw repository errors as service errors
    if (error instanceof ScanRepositoryError) {
      throw new ScanServiceError(error.message, error.code, error);
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Scan Service: Failed to create scan:', err.message);
    throw new ScanServiceError('Failed to create scan', 'CREATE_FAILED', err);
  }
}

/**
 * Get scan status
 *
 * 1. Checks Redis cache first
 * 2. Falls back to database query if cache miss
 * 3. Returns status with progress percentage
 *
 * @param scanId - Scan ID
 * @returns Scan status or null if not found
 *
 * @example
 * ```typescript
 * const status = await getScanStatus('scan-123');
 * if (status) {
 *   console.log(`Status: ${status.status}, Progress: ${status.progress}%`);
 * }
 * ```
 */
export async function getScanStatus(
  scanId: string
): Promise<ScanStatusResponse | null> {
  try {
    if (!scanId || typeof scanId !== 'string') {
      return null;
    }

    const redis = getRedisClient();
    const statusKey = RedisKeys.SCAN_STATUS.build(scanId);
    const progressKey = RedisKeys.SCAN_PROGRESS.build(scanId);

    // Try Redis cache first
    try {
      const [cachedStatus, cachedProgress] = await Promise.all([
        redis.get(statusKey),
        redis.get(progressKey),
      ]);

      if (cachedStatus) {
        const status = JSON.parse(cachedStatus) as {
          scanId: string;
          status: ScanStatus;
          url: string;
          createdAt: string;
          completedAt?: string | null;
          errorMessage?: string | null;
        };

        return {
          scanId: status.scanId,
          status: status.status,
          progress: parseInt(cachedProgress ?? '0', 10),
          url: status.url,
          createdAt: new Date(status.createdAt),
          completedAt: status.completedAt ? new Date(status.completedAt) : null,
          errorMessage: status.errorMessage ?? null,
        };
      }
    } catch (error) {
      // Log cache error but continue to database query
      console.error('❌ Scan Service: Redis cache error:', error);
    }

    // Cache miss - query database
    const scan = await getScanById(scanId);

    if (!scan) {
      return null;
    }

    // Calculate progress based on status
    let progress = 0;
    switch (scan.status) {
      case 'PENDING':
        progress = 0;
        break;
      case 'RUNNING':
        progress = 50;
        break;
      case 'COMPLETED':
        progress = 100;
        break;
      case 'FAILED':
        progress = 0;
        break;
    }

    // Cache the result for future requests
    try {
      await Promise.all([
        redis.setex(
          statusKey,
          RedisKeys.SCAN_STATUS.ttl,
          JSON.stringify({
            scanId: scan.id,
            status: scan.status,
            url: scan.url,
            createdAt: scan.createdAt.toISOString(),
            completedAt: scan.completedAt?.toISOString() ?? null,
            errorMessage: scan.errorMessage ?? null,
          })
        ),
        redis.setex(
          progressKey,
          RedisKeys.SCAN_PROGRESS.ttl,
          progress.toString()
        ),
      ]);
    } catch (error) {
      // Log cache error but don't fail the request
      console.error('❌ Scan Service: Failed to cache scan status:', error);
    }

    return {
      scanId: scan.id,
      status: scan.status,
      progress,
      url: scan.url,
      createdAt: scan.createdAt,
      completedAt: scan.completedAt,
      errorMessage: scan.errorMessage,
    };
  } catch (error) {
    console.error('❌ Scan Service: Failed to get scan status:', error);
    return null;
  }
}

/**
 * Get full scan result with issues
 *
 * 1. Verifies scan exists
 * 2. Fetches full result via repository (includes issues)
 * 3. Returns formatted result
 *
 * @param scanId - Scan ID
 * @returns Scan result or null if not found
 * @throws ScanServiceError with codes: SCAN_NOT_FOUND, SCAN_NOT_COMPLETE
 *
 * @example
 * ```typescript
 * const result = await getScanResult('scan-123');
 * if (result?.result) {
 *   console.log(`Total issues: ${result.result.totalIssues}`);
 *   console.log(`Critical: ${result.result.criticalCount}`);
 * }
 * ```
 */
export async function getScanResult(
  scanId: string
): Promise<ScanResultResponse | null> {
  try {
    if (!scanId || typeof scanId !== 'string') {
      throw new ScanServiceError('Scan ID is required', 'INVALID_INPUT');
    }

    // Fetch scan with results and issues
    const scan = await getScanById(scanId);

    if (!scan) {
      throw new ScanServiceError(
        `Scan not found: ${scanId}`,
        'SCAN_NOT_FOUND'
      );
    }

    // Check if scan is completed
    if (scan.status !== 'COMPLETED') {
      throw new ScanServiceError(
        `Scan is not completed. Current status: ${scan.status}`,
        'SCAN_NOT_COMPLETE'
      );
    }

    // Format result
    const result: ScanResultResponse = {
      scanId: scan.id,
      url: scan.url,
      status: scan.status,
      wcagLevel: scan.wcagLevel,
      createdAt: scan.createdAt,
      completedAt: scan.completedAt,
      result: scan.scanResult
        ? {
            totalIssues: scan.scanResult.totalIssues,
            criticalCount: scan.scanResult.criticalCount,
            seriousCount: scan.scanResult.seriousCount,
            moderateCount: scan.scanResult.moderateCount,
            minorCount: scan.scanResult.minorCount,
            passedChecks: scan.scanResult.passedChecks,
            inapplicableChecks: scan.scanResult.inapplicableChecks,
            scanDurationMs: scan.durationMs,
            issues: scan.scanResult.issues.map((issue) => ({
              id: issue.id,
              impact: issue.impact,
              wcagCriteria: issue.wcagCriteria,
              description: issue.description,
              helpUrl: issue.helpUrl,
              cssSelector: issue.cssSelector,
              htmlSnippet: issue.htmlSnippet,
            })),
          }
        : null,
    };

    return result;
  } catch (error) {
    // Re-throw ScanServiceError as-is
    if (error instanceof ScanServiceError) {
      throw error;
    }

    // Re-throw repository errors as service errors
    if (error instanceof ScanRepositoryError) {
      throw new ScanServiceError(error.message, error.code, error);
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Scan Service: Failed to get scan result:', err.message);
    throw new ScanServiceError('Failed to get scan result', 'GET_FAILED', err);
  }
}

/**
 * List scans for a session with pagination
 *
 * @param sessionId - Guest session ID
 * @param options - Pagination options
 * @returns Paginated list of scans
 *
 * @example
 * ```typescript
 * const result = await listScans('session-123', { limit: 10 });
 * console.log(`Found ${result.items.length} scans`);
 * if (result.nextCursor) {
 *   const nextPage = await listScans('session-123', {
 *     limit: 10,
 *     cursor: result.nextCursor
 *   });
 * }
 * ```
 */
export async function listScans(
  sessionId: string,
  options?: PaginationOptions
): Promise<PaginatedResult<Scan>> {
  try {
    if (!sessionId || typeof sessionId !== 'string') {
      throw new ScanServiceError(
        'Session ID is required and must be a string',
        'INVALID_INPUT'
      );
    }

    return await listScansBySession(sessionId, options);
  } catch (error) {
    // Re-throw ScanServiceError as-is
    if (error instanceof ScanServiceError) {
      throw error;
    }

    // Re-throw repository errors as service errors
    if (error instanceof ScanRepositoryError) {
      throw new ScanServiceError(error.message, error.code, error);
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Scan Service: Failed to list scans:', err.message);
    throw new ScanServiceError('Failed to list scans', 'LIST_FAILED', err);
  }
}

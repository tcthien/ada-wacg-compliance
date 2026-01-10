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
import type { Scan, WcagLevel, ScanStatus, AiStatus } from '@prisma/client';
import {
  checkAndReserveSlotAtomic,
  AiCampaignServiceError,
} from '../ai-campaign/ai-campaign.service.js';
import { getPrismaClient } from '../../config/database.js';

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
  aiEnabled?: boolean;
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
  aiEnabled?: boolean;
  email?: string | null;
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

    // Handle AI opt-in: check slot availability and reserve atomically
    let aiEnabled = false;
    let aiStatus: AiStatus | undefined = undefined;

    if (data.aiEnabled) {
      try {
        // Create a temporary scan ID for slot reservation
        // We'll use this to track the reservation before the scan is created
        const tempScanId = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        const reservation = await checkAndReserveSlotAtomic(tempScanId);

        if (reservation.reserved) {
          aiEnabled = true;
          aiStatus = 'PENDING';
          console.log(
            `✅ Scan Service: AI slot reserved for scan - ` +
            `remaining=${reservation.slotsRemaining}`
          );
        } else {
          // Slot reservation failed - disable AI for this scan
          aiEnabled = false;
          aiStatus = undefined;
          console.warn(
            `⚠️  Scan Service: AI slot reservation failed - ` +
            `reason=${reservation.reason}, falling back to non-AI scan`
          );
        }
      } catch (error) {
        // If slot reservation fails due to service error, log and continue without AI
        if (error instanceof AiCampaignServiceError) {
          console.error(
            `❌ Scan Service: AI campaign service error during slot reservation: ${error.message}`
          );
        } else {
          console.error('❌ Scan Service: Unexpected error during slot reservation:', error);
        }
        // Fallback to non-AI scan on error
        aiEnabled = false;
        aiStatus = undefined;
      }
    }

    // Create scan record in database with AI status
    const scanData: CreateScanData = {
      url: normalizedUrl,
      email: data.email ?? null,
      wcagLevel: data.wcagLevel ?? 'AA',
      guestSessionId: sessionId,
      userId: null, // Guest sessions don't have user IDs
      aiEnabled,
      aiStatus,
    };

    const scan = await createScanInRepo(scanData);

    // Queue scan job
    try {
      await addScanJob(scan.id, normalizedUrl, scan.wcagLevel, {
        sessionId,
        email: scan.email ?? undefined,
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
            aiEnabled: scan.aiEnabled,
            email: scan.email ?? null,
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
          aiEnabled?: boolean;
          email?: string | null;
        };

        return {
          scanId: status.scanId,
          status: status.status,
          progress: parseInt(cachedProgress ?? '0', 10),
          url: status.url,
          createdAt: new Date(status.createdAt),
          completedAt: status.completedAt ? new Date(status.completedAt) : null,
          errorMessage: status.errorMessage ?? null,
          aiEnabled: status.aiEnabled ?? false,
          email: status.email ?? null,
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
            aiEnabled: scan.aiEnabled ?? false,
            email: scan.email ?? null,
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
      aiEnabled: scan.aiEnabled ?? false,
      email: scan.email ?? null,
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
 * Get AI status for a scan
 *
 * Returns the current AI processing status for a scan with AI enabled.
 * Used by frontend for polling AI processing progress.
 *
 * @param scanId - Scan ID
 * @returns AI status or null if scan not found or AI not enabled
 *
 * @example
 * ```typescript
 * const aiStatus = await getAiStatus('scan-123');
 * if (aiStatus) {
 *   console.log(`AI Status: ${aiStatus.status}`);
 *   if (aiStatus.status === 'COMPLETED') {
 *     console.log('Summary:', aiStatus.summary);
 *     console.log('Remediation Plan:', aiStatus.remediationPlan);
 *   }
 * }
 * ```
 */
export async function getAiStatus(scanId: string): Promise<{
  scanId: string;
  aiEnabled: boolean;
  status: AiStatus | null;
  summary?: string | null;
  remediationPlan?: string | null;
  processedAt?: Date | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  model?: string | null;
  processingTime?: number | null;
} | null> {
  try {
    if (!scanId || typeof scanId !== 'string') {
      return null;
    }

    // Fetch scan from database
    const scan = await getScanById(scanId);

    if (!scan) {
      return null;
    }

    // Return AI status information
    return {
      scanId: scan.id,
      aiEnabled: scan.aiEnabled,
      status: scan.aiStatus,
      summary: scan.aiSummary,
      remediationPlan: scan.aiRemediationPlan,
      processedAt: scan.aiProcessedAt,
      inputTokens: scan.aiInputTokens,
      outputTokens: scan.aiOutputTokens,
      totalTokens: scan.aiTotalTokens,
      model: scan.aiModel,
      processingTime: scan.aiProcessingTime,
    };
  } catch (error) {
    console.error('❌ Scan Service: Failed to get AI status:', error);
    return null;
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

/**
 * Bulk delete result
 */
export interface BulkDeleteResult {
  deleted: number;
  failed: Array<{ scanId: string; reason: string }>;
}

/**
 * Bulk delete scans for a session
 *
 * 1. Validates all scan IDs
 * 2. Verifies session ownership for all scans
 * 3. Deletes scans in a transaction
 * 4. Returns deletion summary with failed items
 *
 * @param scanIds - Array of scan IDs to delete
 * @param sessionId - Guest session ID for authorization
 * @returns Deletion summary
 * @throws ScanServiceError with codes: INVALID_INPUT, DELETE_FAILED
 *
 * @example
 * ```typescript
 * const result = await bulkDeleteScans(
 *   ['scan-123', 'scan-456'],
 *   'session-789'
 * );
 * console.log(`Deleted ${result.deleted} scans`);
 * if (result.failed.length > 0) {
 *   console.log(`Failed to delete ${result.failed.length} scans`);
 * }
 * ```
 */
export async function bulkDeleteScans(
  scanIds: string[],
  sessionId: string
): Promise<BulkDeleteResult> {
  try {
    // Validate input
    if (!scanIds || !Array.isArray(scanIds)) {
      throw new ScanServiceError(
        'Scan IDs array is required',
        'INVALID_INPUT'
      );
    }

    if (scanIds.length === 0) {
      throw new ScanServiceError(
        'At least one scan ID is required',
        'INVALID_INPUT'
      );
    }

    if (!sessionId || typeof sessionId !== 'string') {
      throw new ScanServiceError(
        'Session ID is required and must be a string',
        'INVALID_INPUT'
      );
    }

    const prisma = getPrismaClient();
    const failed: Array<{ scanId: string; reason: string }> = [];
    let deleted = 0;

    // Process deletions in transaction
    try {
      await prisma.$transaction(async (tx) => {
        for (const scanId of scanIds) {
          try {
            // Verify scan exists and belongs to session
            const scan = await tx.scan.findUnique({
              where: { id: scanId },
              select: { id: true, guestSessionId: true, userId: true },
            });

            if (!scan) {
              failed.push({
                scanId,
                reason: 'Scan not found',
              });
              continue;
            }

            // Verify ownership
            if (scan.guestSessionId !== sessionId && scan.userId !== sessionId) {
              failed.push({
                scanId,
                reason: 'Unauthorized - scan belongs to different session',
              });
              continue;
            }

            // Delete scan and related data (cascade will handle issues, results)
            await tx.scan.delete({
              where: { id: scanId },
            });

            deleted++;
          } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            failed.push({
              scanId,
              reason: err.message,
            });
          }
        }
      });

      console.log(
        `✅ Scan Service: Bulk delete completed - deleted=${deleted}, failed=${failed.length}`
      );

      return { deleted, failed };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('❌ Scan Service: Transaction failed during bulk delete:', err.message);
      throw new ScanServiceError(
        'Failed to delete scans in transaction',
        'DELETE_FAILED',
        err
      );
    }
  } catch (error) {
    // Re-throw ScanServiceError as-is
    if (error instanceof ScanServiceError) {
      throw error;
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Scan Service: Failed to bulk delete scans:', err.message);
    throw new ScanServiceError('Failed to bulk delete scans', 'DELETE_FAILED', err);
  }
}

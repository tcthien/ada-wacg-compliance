/**
 * Batch Service
 *
 * Business logic layer for batch scan operations.
 * Orchestrates batch creation, URL validation, scan creation, job queuing, and status updates.
 */

import { getRedisClient } from '../../config/redis.js';
import { validateUrl } from '../../shared/utils/url-validator.js';
import { addScanJob } from '../../shared/queue/queue.service.js';
import { RedisKeys } from '../../shared/constants/redis-keys.js';
import {
  create as createBatchInRepo,
  findById as findBatchById,
  findBySessionId as findBatchesBySessionId,
  updateStatus as updateBatchStatus,
  type CreateBatchData,
  BatchRepositoryError,
} from './batch.repository.js';
import {
  createScan as createScanInRepo,
  type CreateScanData,
  ScanRepositoryError,
} from '../scans/scan.repository.js';
import type { BatchScan, WcagLevel, Scan, ScanResult, AiStatus } from '@prisma/client';
import { getPrismaClient } from '../../config/database.js';
import {
  checkAndReserveSlotAtomic,
  AiCampaignServiceError,
} from '../ai-campaign/ai-campaign.service.js';
import { FREE_TIER_QUOTAS } from '../../shared/constants/quotas.js';

/**
 * Batch Service Error
 */
export class BatchServiceError extends Error {
  public readonly code: string;
  public override readonly cause?: Error | undefined;

  constructor(message: string, code: string, cause?: Error | undefined) {
    super(message);
    this.name = 'BatchServiceError';
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Input data for creating a batch scan
 */
export interface CreateBatchInput {
  urls: string[];
  wcagLevel?: WcagLevel;
  homepageUrl?: string;
  guestSessionId?: string;
  userId?: string;
  discoveryId?: string;
  email?: string;
  aiEnabled?: boolean;
}

/**
 * Batch creation result
 */
export interface CreateBatchResult {
  batch: BatchScan;
  scans: Array<{
    id: string;
    url: string;
    status: string;
  }>;
}

/**
 * Create a new batch scan
 *
 * Workflow:
 * 1. Validates all URLs (SSRF protection, format validation)
 * 2. Creates BatchScan record with PENDING status
 * 3. Creates individual Scan records for each URL with batchId
 * 4. Queues scan jobs for parallel processing
 * 5. Updates batch status to RUNNING
 * 6. Returns batchId and scan IDs immediately (async processing)
 *
 * Requirements:
 * - 1.1: Batch scan shall be a collection of 1-50 individual scans
 * - 1.2: Accept 1-50 URLs in single batch request
 * - 1.4: Create all individual Scan records before queueing any jobs
 * - 1.5: Queue all scan jobs in sequence after Scan records are created
 * - 1.6: Return batchId immediately after queueing (async processing)
 *
 * @param input - Batch creation input
 * @returns Created batch and scan details
 * @throws BatchServiceError with codes:
 *   - INVALID_INPUT: Missing or invalid input parameters
 *   - INVALID_URL: One or more URLs failed validation
 *   - BATCH_SIZE_EXCEEDED: More than 50 URLs provided
 *   - CREATE_FAILED: Database operation failed
 *   - QUEUE_FAILED: Failed to queue scan jobs
 *
 * @example
 * ```typescript
 * const result = await createBatch({
 *   urls: ['https://example.com', 'https://example.com/about'],
 *   wcagLevel: 'AA',
 *   homepageUrl: 'https://example.com',
 *   guestSessionId: 'session-123'
 * });
 * console.log(`Created batch ${result.batch.id} with ${result.scans.length} scans`);
 * ```
 */
export async function createBatch(
  input: CreateBatchInput
): Promise<CreateBatchResult> {
  try {
    // Validate input
    if (!input.urls || !Array.isArray(input.urls)) {
      throw new BatchServiceError(
        'URLs array is required',
        'INVALID_INPUT'
      );
    }

    if (input.urls.length < 1) {
      throw new BatchServiceError(
        'At least one URL is required',
        'INVALID_INPUT'
      );
    }

    if (input.urls.length > FREE_TIER_QUOTAS.MAX_URLS_PER_BATCH) {
      throw new BatchServiceError(
        `Batch size limit exceeded (maximum ${FREE_TIER_QUOTAS.MAX_URLS_PER_BATCH} URLs for free tier)`,
        'BATCH_SIZE_EXCEEDED'
      );
    }

    // Validate session or user ID
    if (!input.guestSessionId && !input.userId) {
      throw new BatchServiceError(
        'Either guestSessionId or userId must be provided',
        'INVALID_INPUT'
      );
    }

    // Step 1: Validate all URLs before creating any records (Requirement 1.2, 1.3)
    const validatedUrls: string[] = [];
    const invalidUrls: Array<{ url: string; error: string }> = [];

    for (const url of input.urls) {
      const validationResult = await validateUrl(url);

      if (!validationResult.isValid) {
        invalidUrls.push({
          url,
          error: validationResult.error ?? 'Invalid URL',
        });
      } else {
        validatedUrls.push(validationResult.normalizedUrl!);
      }
    }

    // Reject entire batch if any URL is invalid (Requirement 1.3)
    if (invalidUrls.length > 0) {
      const errorMessages = invalidUrls
        .map((item) => `${item.url}: ${item.error}`)
        .join(', ');
      throw new BatchServiceError(
        `Invalid URLs detected: ${errorMessages}`,
        'INVALID_URL'
      );
    }

    // Validate AI quotas if AI is enabled
    if (input.aiEnabled) {
      // Check AI batch limit (max AI URLs per batch)
      if (validatedUrls.length > FREE_TIER_QUOTAS.MAX_AI_URLS_PER_BATCH) {
        throw new BatchServiceError(
          `AI batch limit exceeded (maximum ${FREE_TIER_QUOTAS.MAX_AI_URLS_PER_BATCH} AI URLs per batch for free tier)`,
          'AI_BATCH_LIMIT_EXCEEDED'
        );
      }

      // Check daily AI limit
      const sessionId = input.guestSessionId || input.userId || '';
      if (sessionId) {
        const dailyUsage = await checkDailyAiQuota(sessionId);
        const remainingDaily = FREE_TIER_QUOTAS.MAX_AI_URLS_PER_DAY - dailyUsage;

        if (remainingDaily < validatedUrls.length) {
          throw new BatchServiceError(
            `Daily AI limit exceeded (${dailyUsage}/${FREE_TIER_QUOTAS.MAX_AI_URLS_PER_DAY} used today). ` +
            `${Math.max(0, remainingDaily)} AI scans remaining. Resets at midnight UTC.`,
            'DAILY_AI_LIMIT_EXCEEDED'
          );
        }

        console.log(
          `✅ Batch Service: AI quota check passed - daily usage: ${dailyUsage}/${FREE_TIER_QUOTAS.MAX_AI_URLS_PER_DAY}, ` +
          `requesting: ${validatedUrls.length}`
        );
      }
    }

    // Determine homepage URL (use first URL if not provided)
    const homepageUrl = input.homepageUrl ?? validatedUrls[0]!;

    // Step 2: Create BatchScan record with PENDING status (Requirement 1.1)
    const batchData: CreateBatchData = {
      homepageUrl,
      wcagLevel: input.wcagLevel ?? 'AA',
      totalUrls: validatedUrls.length,
      guestSessionId: input.guestSessionId ?? null,
      userId: input.userId ?? null,
      discoveryId: input.discoveryId ?? null,
    };

    const batch = await createBatchInRepo(batchData);

    console.log(
      `✅ Batch Service: Created batch ${batch.id} with ${validatedUrls.length} URLs`
    );

    // Step 3: Create individual Scan records for each URL (Requirement 1.4)
    const scans: Array<{ id: string; url: string; status: string }> = [];
    let aiEnabledCount = 0; // Track AI-enabled scans for daily quota

    for (const url of validatedUrls) {
      try {
        // Handle AI opt-in: check slot availability and reserve atomically
        let aiEnabled = false;
        let aiStatus: AiStatus | undefined = undefined;

        if (input.aiEnabled) {
          try {
            // Create a temporary scan ID for slot reservation
            const tempScanId = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            const reservation = await checkAndReserveSlotAtomic(tempScanId);

            if (reservation.reserved) {
              aiEnabled = true;
              aiStatus = 'PENDING';
              aiEnabledCount++; // Track for daily quota
              console.log(
                `✅ Batch Service: AI slot reserved for URL ${url} - remaining=${reservation.slotsRemaining}`
              );
            } else {
              // Slot reservation failed - disable AI for this scan
              aiEnabled = false;
              aiStatus = undefined;
              console.warn(
                `⚠️  Batch Service: AI slot reservation failed for ${url} - reason=${reservation.reason}`
              );
            }
          } catch (error) {
            // If slot reservation fails due to service error, log and continue without AI
            if (error instanceof AiCampaignServiceError) {
              console.error(
                `❌ Batch Service: AI campaign service error for ${url}: ${error.message}`
              );
            } else {
              console.error(`❌ Batch Service: Unexpected error during AI slot reservation for ${url}:`, error);
            }
            // Fallback to non-AI scan on error
            aiEnabled = false;
            aiStatus = undefined;
          }
        }

        const scanData: CreateScanData = {
          url,
          wcagLevel: input.wcagLevel ?? 'AA',
          guestSessionId: input.guestSessionId ?? null,
          userId: input.userId ?? null,
          email: input.email ?? null, // Use batch email for all scans
          batchId: batch.id, // Link scan to batch
          pageTitle: null, // Will be extracted during scanning
          aiEnabled,
          aiStatus,
        };

        // Create scan record in database with batchId
        const scan = await createScanInRepo(scanData);

        scans.push({
          id: scan.id,
          url: scan.url,
          status: scan.status,
        });
      } catch (error) {
        console.error(`❌ Batch Service: Failed to create scan for ${url}:`, error);
        // If scan creation fails, we need to handle this gracefully
        // For now, we'll continue with other scans but log the error
        // In production, you might want to mark the batch as FAILED
        throw new BatchServiceError(
          `Failed to create scan for URL: ${url}`,
          'CREATE_FAILED',
          error instanceof Error ? error : new Error(String(error))
        );
      }
    }

    console.log(
      `✅ Batch Service: Created ${scans.length} individual scans for batch ${batch.id}`
    );

    // Increment daily AI quota if any AI-enabled scans were created
    if (aiEnabledCount > 0) {
      const sessionId = input.guestSessionId || input.userId || '';
      if (sessionId) {
        await incrementDailyAiQuota(sessionId, aiEnabledCount);
      }
    }

    // Step 4: Queue all scan jobs (Requirement 1.5)
    const queuedJobs: string[] = [];

    for (const scan of scans) {
      try {
        const jobId = await addScanJob(scan.id, scan.url, input.wcagLevel ?? 'AA', {
          sessionId: input.guestSessionId,
          userId: input.userId,
        });
        queuedJobs.push(jobId);
      } catch (error) {
        console.error(
          `❌ Batch Service: Failed to queue scan job for ${scan.url}:`,
          error
        );
        // Log queue error but don't fail the entire batch
        // The scan records are created and can be retried later
      }
    }

    console.log(
      `✅ Batch Service: Queued ${queuedJobs.length} scan jobs for batch ${batch.id}`
    );

    // Step 5: Update batch status to RUNNING
    const runningBatch = await updateBatchStatus(batch.id, 'RUNNING');

    console.log(`✅ Batch Service: Updated batch ${batch.id} status to RUNNING`);

    // Step 6: Cache initial batch status in Redis
    try {
      const redis = getRedisClient();
      const statusKey = RedisKeys.BATCH_STATUS.build(batch.id);

      await redis.setex(
        statusKey,
        RedisKeys.BATCH_STATUS.ttl,
        JSON.stringify({
          batchId: batch.id,
          status: runningBatch.status,
          totalUrls: runningBatch.totalUrls,
          completedCount: 0,
          createdAt: runningBatch.createdAt.toISOString(),
        })
      );
    } catch (error) {
      // Log cache error but don't fail the request
      console.error('❌ Batch Service: Failed to cache batch status:', error);
    }

    // Return batch and scan details immediately (Requirement 1.6)
    return {
      batch: runningBatch,
      scans,
    };
  } catch (error) {
    // Re-throw BatchServiceError as-is
    if (error instanceof BatchServiceError) {
      throw error;
    }

    // Re-throw repository errors as service errors
    if (error instanceof BatchRepositoryError || error instanceof ScanRepositoryError) {
      throw new BatchServiceError(error.message, error.code, error);
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Batch Service: Failed to create batch:', err.message);
    throw new BatchServiceError('Failed to create batch', 'CREATE_FAILED', err);
  }
}

/**
 * Batch scan status response with individual URL statuses
 */
export interface BatchStatusResponse {
  batchId: string;
  status: string;
  totalUrls: number;
  completedCount: number;
  failedCount: number;
  homepageUrl: string;
  wcagLevel: WcagLevel;
  createdAt: Date;
  completedAt: Date | null;
  urls: Array<{
    id: string;
    url: string;
    status: string;
    pageTitle: string | null;
    completedAt: Date | null;
    errorMessage: string | null;
  }>;
}

/**
 * Get batch scan status with authorization check
 *
 * Workflow:
 * 1. Retrieve batch from database by ID
 * 2. Verify session ownership (authorization)
 * 3. Query all scans associated with batch
 * 4. Return batch status with individual URL statuses
 *
 * Requirements:
 * - 2.1: Returns batch status, completedCount, failedCount, totalUrls
 * - 2.2: Includes individual URL statuses in response
 *
 * @param batchId - Batch scan ID
 * @param sessionId - Guest session ID for authorization
 * @returns Batch status with scan details
 * @throws BatchServiceError with codes:
 *   - INVALID_INPUT: Missing batch ID or session ID
 *   - NOT_FOUND: Batch not found
 *   - UNAUTHORIZED: Session does not own this batch
 *   - GET_FAILED: Database operation failed
 *
 * @example
 * ```typescript
 * const status = await getBatchStatus('batch-123', 'session-456');
 * console.log(`Batch status: ${status.status}`);
 * console.log(`Progress: ${status.completedCount}/${status.totalUrls}`);
 * console.log(`Failed: ${status.failedCount}`);
 * ```
 */
export async function getBatchStatus(
  batchId: string,
  sessionId: string
): Promise<BatchStatusResponse> {
  try {
    // Validate input
    if (!batchId || typeof batchId !== 'string') {
      throw new BatchServiceError('Batch ID is required', 'INVALID_INPUT');
    }

    if (!sessionId || typeof sessionId !== 'string') {
      throw new BatchServiceError('Session ID is required', 'INVALID_INPUT');
    }

    // Step 1: Retrieve batch from database
    const batch = await findBatchById(batchId);

    if (!batch) {
      throw new BatchServiceError(
        `Batch not found: ${batchId}`,
        'NOT_FOUND'
      );
    }

    // Step 2: Verify session ownership (authorization)
    if (batch.guestSessionId !== sessionId && batch.userId !== sessionId) {
      throw new BatchServiceError(
        'Unauthorized: This batch belongs to a different session',
        'UNAUTHORIZED'
      );
    }

    // Step 3: Query all scans associated with batch
    const prisma = getPrismaClient();
    const scans = await prisma.scan.findMany({
      where: { batchId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        url: true,
        status: true,
        pageTitle: true,
        completedAt: true,
        errorMessage: true,
      },
    });

    // Step 4: Return batch status with individual URL statuses
    return {
      batchId: batch.id,
      status: batch.status,
      totalUrls: batch.totalUrls,
      completedCount: batch.completedCount,
      failedCount: batch.failedCount,
      homepageUrl: batch.homepageUrl,
      wcagLevel: batch.wcagLevel,
      createdAt: batch.createdAt,
      completedAt: batch.completedAt,
      urls: scans.map((scan) => ({
        id: scan.id,
        url: scan.url,
        status: scan.status,
        pageTitle: scan.pageTitle,
        completedAt: scan.completedAt,
        errorMessage: scan.errorMessage,
      })),
    };
  } catch (error) {
    // Re-throw BatchServiceError as-is
    if (error instanceof BatchServiceError) {
      throw error;
    }

    // Re-throw repository errors as service errors
    if (error instanceof BatchRepositoryError) {
      throw new BatchServiceError(error.message, error.code, error);
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Batch Service: Failed to get batch status:', err.message);
    throw new BatchServiceError('Failed to get batch status', 'GET_FAILED', err);
  }
}

/**
 * Batch scan results with aggregate statistics and per-URL breakdown
 */
export interface BatchResultsResponse {
  batchId: string;
  status: string;
  totalUrls: number;
  completedCount: number;
  failedCount: number;
  homepageUrl: string;
  wcagLevel: WcagLevel;
  createdAt: Date;
  completedAt: Date | null;
  // Aggregate statistics (Requirement 3.1, 3.2, 3.7)
  aggregate: {
    totalIssues: number;
    criticalCount: number;
    seriousCount: number;
    moderateCount: number;
    minorCount: number;
    passedChecks: number;
    urlsScanned: number;
  };
  // Per-URL breakdown (Requirement 3.5)
  urls: Array<{
    id: string;
    url: string;
    status: string;
    pageTitle: string | null;
    totalIssues: number;
    criticalCount: number;
    seriousCount: number;
    moderateCount: number;
    minorCount: number;
    errorMessage: string | null;
  }>;
  // Top 5 URLs with highest critical issues (Requirement 3.4)
  topCriticalUrls: Array<{
    url: string;
    pageTitle: string | null;
    criticalCount: number;
  }>;
}

/**
 * Get batch scan results with aggregate statistics
 *
 * Workflow:
 * 1. Retrieve batch from database by ID
 * 2. Verify session ownership (authorization)
 * 3. Query all scans with their results (ScanResult table)
 * 4. Calculate aggregate statistics across all scans
 * 5. Build per-URL breakdown
 * 6. Identify top 5 URLs with highest critical issues
 * 7. Return comprehensive results
 *
 * Requirements:
 * - 3.1: Returns aggregate issue counts grouped by severity
 * - 3.2: Issues grouped by axe-core impact level
 * - 3.4: Top 5 URLs with highest critical issue count
 * - 3.5: Per-URL breakdown with issue counts
 * - 3.7: Aggregate statistics include passed checks and URLs scanned
 *
 * @param batchId - Batch scan ID
 * @param sessionId - Guest session ID for authorization
 * @returns Batch results with aggregate and per-URL statistics
 * @throws BatchServiceError with codes:
 *   - INVALID_INPUT: Missing batch ID or session ID
 *   - NOT_FOUND: Batch not found
 *   - UNAUTHORIZED: Session does not own this batch
 *   - GET_FAILED: Database operation failed
 *
 * @example
 * ```typescript
 * const results = await getBatchResults('batch-123', 'session-456');
 * console.log(`Total issues: ${results.aggregate.totalIssues}`);
 * console.log(`Critical: ${results.aggregate.criticalCount}`);
 * console.log(`Top critical URL: ${results.topCriticalUrls[0]?.url}`);
 * ```
 */
export async function getBatchResults(
  batchId: string,
  sessionId: string
): Promise<BatchResultsResponse> {
  try {
    // Validate input
    if (!batchId || typeof batchId !== 'string') {
      throw new BatchServiceError('Batch ID is required', 'INVALID_INPUT');
    }

    if (!sessionId || typeof sessionId !== 'string') {
      throw new BatchServiceError('Session ID is required', 'INVALID_INPUT');
    }

    // Step 1: Retrieve batch from database
    const batch = await findBatchById(batchId);

    if (!batch) {
      throw new BatchServiceError(
        `Batch not found: ${batchId}`,
        'NOT_FOUND'
      );
    }

    // Step 2: Verify session ownership (authorization)
    if (batch.guestSessionId !== sessionId && batch.userId !== sessionId) {
      throw new BatchServiceError(
        'Unauthorized: This batch belongs to a different session',
        'UNAUTHORIZED'
      );
    }

    // Step 3: Query all scans with their results
    const prisma = getPrismaClient();
    const scans = await prisma.scan.findMany({
      where: { batchId },
      include: {
        scanResult: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Step 4: Calculate aggregate statistics across all scans
    let totalIssues = 0;
    let criticalCount = 0;
    let seriousCount = 0;
    let moderateCount = 0;
    let minorCount = 0;
    let passedChecks = 0;
    let completedScansCount = 0;

    // Step 5: Build per-URL breakdown
    const urls = scans.map((scan) => {
      const result = scan.scanResult;

      // Count completed scans for aggregate
      if (result) {
        totalIssues += result.totalIssues;
        criticalCount += result.criticalCount;
        seriousCount += result.seriousCount;
        moderateCount += result.moderateCount;
        minorCount += result.minorCount;
        passedChecks += result.passedChecks;
        completedScansCount++;
      }

      return {
        id: scan.id,
        url: scan.url,
        status: scan.status,
        pageTitle: scan.pageTitle,
        totalIssues: result?.totalIssues ?? 0,
        criticalCount: result?.criticalCount ?? 0,
        seriousCount: result?.seriousCount ?? 0,
        moderateCount: result?.moderateCount ?? 0,
        minorCount: result?.minorCount ?? 0,
        errorMessage: scan.errorMessage,
      };
    });

    // Step 6: Identify top 5 URLs with highest critical issues
    const topCriticalUrls = [...urls]
      .filter((url) => url.criticalCount > 0)
      .sort((a, b) => b.criticalCount - a.criticalCount)
      .slice(0, 5)
      .map((url) => ({
        url: url.url,
        pageTitle: url.pageTitle,
        criticalCount: url.criticalCount,
      }));

    // Step 7: Return comprehensive results
    return {
      batchId: batch.id,
      status: batch.status,
      totalUrls: batch.totalUrls,
      completedCount: batch.completedCount,
      failedCount: batch.failedCount,
      homepageUrl: batch.homepageUrl,
      wcagLevel: batch.wcagLevel,
      createdAt: batch.createdAt,
      completedAt: batch.completedAt,
      aggregate: {
        totalIssues,
        criticalCount,
        seriousCount,
        moderateCount,
        minorCount,
        passedChecks,
        urlsScanned: completedScansCount,
      },
      urls,
      topCriticalUrls,
    };
  } catch (error) {
    // Re-throw BatchServiceError as-is
    if (error instanceof BatchServiceError) {
      throw error;
    }

    // Re-throw repository errors as service errors
    if (error instanceof BatchRepositoryError) {
      throw new BatchServiceError(error.message, error.code, error);
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Batch Service: Failed to get batch results:', err.message);
    throw new BatchServiceError('Failed to get batch results', 'GET_FAILED', err);
  }
}

/**
 * Pagination options for batch listing
 */
export interface BatchListPagination {
  page?: number;
  limit?: number;
}

/**
 * Batch list response with pagination metadata
 */
export interface BatchListResponse {
  batches: Array<{
    id: string;
    homepageUrl: string;
    wcagLevel: WcagLevel;
    totalUrls: number;
    status: string;
    completedCount: number;
    failedCount: number;
    // Aggregate statistics (Requirement 5.2)
    totalIssues: number | null;
    criticalCount: number | null;
    seriousCount: number | null;
    moderateCount: number | null;
    minorCount: number | null;
    createdAt: Date;
    completedAt: Date | null;
    discoveryId: string | null;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * List batch scans for a session with pagination
 *
 * Workflow:
 * 1. Validate input and pagination parameters
 * 2. Query batches from database with pagination
 * 3. Count total batches for pagination metadata
 * 4. Return batch list with pagination
 *
 * Requirements:
 * - 5.1: Display list of batch scans for current session
 * - 5.2: Show homepage URL, total URLs scanned, aggregate issues
 *
 * @param sessionId - Guest session ID
 * @param pagination - Pagination options (page, limit)
 * @returns List of batches with pagination metadata
 * @throws BatchServiceError with codes:
 *   - INVALID_INPUT: Missing or invalid session ID
 *   - LIST_FAILED: Database operation failed
 *
 * @example
 * ```typescript
 * const response = await listBatches('session-456', { page: 1, limit: 20 });
 * console.log(`Found ${response.batches.length} batches`);
 * console.log(`Total pages: ${response.pagination.totalPages}`);
 * ```
 */
export async function listBatches(
  sessionId: string,
  pagination?: BatchListPagination
): Promise<BatchListResponse> {
  try {
    // Validate input
    if (!sessionId || typeof sessionId !== 'string') {
      throw new BatchServiceError('Session ID is required', 'INVALID_INPUT');
    }

    // Validate and set pagination defaults
    const page = pagination?.page && pagination.page > 0 ? pagination.page : 1;
    const limit = pagination?.limit && pagination.limit > 0 && pagination.limit <= 100
      ? pagination.limit
      : 20;

    // Calculate offset
    const offset = (page - 1) * limit;

    // Step 2: Query batches from database with pagination
    const batches = await findBatchesBySessionId(sessionId);

    // Sort by createdAt descending (newest first)
    batches.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Step 3: Count total batches for pagination metadata
    const total = batches.length;
    const totalPages = Math.ceil(total / limit);

    // Apply pagination
    const paginatedBatches = batches.slice(offset, offset + limit);

    // Step 4: Return batch list with pagination
    return {
      batches: paginatedBatches.map((batch) => ({
        id: batch.id,
        homepageUrl: batch.homepageUrl,
        wcagLevel: batch.wcagLevel,
        totalUrls: batch.totalUrls,
        status: batch.status,
        completedCount: batch.completedCount,
        failedCount: batch.failedCount,
        totalIssues: batch.totalIssues,
        criticalCount: batch.criticalCount,
        seriousCount: batch.seriousCount,
        moderateCount: batch.moderateCount,
        minorCount: batch.minorCount,
        createdAt: batch.createdAt,
        completedAt: batch.completedAt,
        discoveryId: batch.discoveryId,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  } catch (error) {
    // Re-throw BatchServiceError as-is
    if (error instanceof BatchServiceError) {
      throw error;
    }

    // Re-throw repository errors as service errors
    if (error instanceof BatchRepositoryError) {
      throw new BatchServiceError(error.message, error.code, error);
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Batch Service: Failed to list batches:', err.message);
    throw new BatchServiceError('Failed to list batches', 'LIST_FAILED', err);
  }
}

/**
 * Batch cancellation summary
 */
export interface CancelBatchResult {
  batchId: string;
  status: string;
  completedCount: number;
  cancelledCount: number;
  failedToCancel: number;
  message: string;
  cancelledAt: Date;
}

/**
 * Cancel a batch scan and all its pending/running scans
 *
 * Workflow:
 * 1. Retrieve batch from database by ID
 * 2. Verify session ownership (authorization)
 * 3. Verify batch is in a cancellable state (PENDING or RUNNING)
 * 4. Query all scans in the batch
 * 5. Update pending/running scans to CANCELLED status
 * 6. Attempt to remove pending jobs from queue
 * 7. Update batch status to CANCELLED with timestamp
 * 8. Return cancellation summary (completed vs cancelled counts)
 *
 * Requirements:
 * - 7.2: Cancel all pending/running scans in the batch
 * - 7.3: Preserve results of already-completed scans
 * - 7.4: Update batch status to CANCELLED with timestamp
 * - 7.5: Provide cancellation summary (completed vs cancelled counts)
 *
 * @param batchId - Batch scan ID
 * @param sessionId - Guest session ID for authorization
 * @returns Cancellation summary with counts
 * @throws BatchServiceError with codes:
 *   - INVALID_INPUT: Missing batch ID or session ID
 *   - NOT_FOUND: Batch not found
 *   - UNAUTHORIZED: Session does not own this batch
 *   - INVALID_STATE: Batch cannot be cancelled (already completed, failed, or cancelled)
 *   - CANCEL_FAILED: Database operation failed
 *
 * @example
 * ```typescript
 * const result = await cancelBatch('batch-123', 'session-456');
 * console.log(`Cancelled ${result.cancelledCount} scans`);
 * console.log(`Preserved ${result.completedCount} completed scans`);
 * ```
 */
export async function cancelBatch(
  batchId: string,
  sessionId: string
): Promise<CancelBatchResult> {
  try {
    // Step 1: Validate input
    if (!batchId || typeof batchId !== 'string') {
      throw new BatchServiceError('Batch ID is required', 'INVALID_INPUT');
    }

    if (!sessionId || typeof sessionId !== 'string') {
      throw new BatchServiceError('Session ID is required', 'INVALID_INPUT');
    }

    // Step 2: Retrieve batch from database
    const batch = await findBatchById(batchId);

    if (!batch) {
      throw new BatchServiceError(
        `Batch not found: ${batchId}`,
        'NOT_FOUND'
      );
    }

    // Step 3: Verify session ownership (authorization)
    if (batch.guestSessionId !== sessionId && batch.userId !== sessionId) {
      throw new BatchServiceError(
        'Unauthorized: This batch belongs to a different session',
        'UNAUTHORIZED'
      );
    }

    // Step 4: Verify batch is in a cancellable state
    const cancellableStates: string[] = ['PENDING', 'RUNNING'];
    if (!cancellableStates.includes(batch.status)) {
      throw new BatchServiceError(
        `Batch cannot be cancelled in ${batch.status} state`,
        'INVALID_STATE'
      );
    }

    console.log(`🔄 Batch Service: Cancelling batch ${batchId} with status ${batch.status}`);

    // Step 5: Query all scans in the batch
    const prisma = getPrismaClient();
    const scans = await prisma.scan.findMany({
      where: { batchId },
      select: {
        id: true,
        url: true,
        status: true,
      },
    });

    console.log(`📊 Batch Service: Found ${scans.length} scans in batch ${batchId}`);

    // Step 6: Count scans by status
    let completedCount = 0;
    let cancelledCount = 0;
    let failedToCancel = 0;

    const scansToCancel: string[] = [];

    for (const scan of scans) {
      // Requirement 7.3: Preserve completed/failed scans
      if (scan.status === 'COMPLETED' || scan.status === 'FAILED') {
        completedCount++;
        continue;
      }

      // Already cancelled
      if (scan.status === 'CANCELLED') {
        cancelledCount++;
        continue;
      }

      // Mark pending/running scans for cancellation
      if (scan.status === 'PENDING' || scan.status === 'RUNNING') {
        scansToCancel.push(scan.id);
      }
    }

    console.log(`📊 Batch Service: Completed: ${completedCount}, To cancel: ${scansToCancel.length}`);

    // Step 7: Update pending/running scans to CANCELLED (Requirement 7.2)
    if (scansToCancel.length > 0) {
      try {
        const updateResult = await prisma.scan.updateMany({
          where: {
            id: { in: scansToCancel },
            status: { in: ['PENDING', 'RUNNING'] },
          },
          data: {
            status: 'CANCELLED',
            completedAt: new Date(),
          },
        });

        cancelledCount += updateResult.count;

        console.log(`✅ Batch Service: Cancelled ${updateResult.count} scans`);
      } catch (error) {
        console.error('❌ Batch Service: Failed to cancel scans:', error);
        failedToCancel = scansToCancel.length;
      }
    }

    // Step 8: Attempt to remove pending jobs from queue (best effort)
    // Note: We use the scan-{scanId} naming convention from addScanJob
    for (const scanId of scansToCancel) {
      try {
        const jobId = `scan-${scanId}`;
        // Import removeJob from queue service
        const { removeJob } = await import('../../shared/queue/queue.service.js');
        await removeJob(jobId, 'scan-page');
      } catch (error) {
        // Queue removal is best-effort, log but don't fail the cancellation
        console.warn(`⚠️ Batch Service: Failed to remove job for scan ${scanId}:`, error);
      }
    }

    // Step 9: Update batch status to CANCELLED (Requirement 7.4)
    const cancelledBatch = await updateBatchStatus(batchId, 'CANCELLED');

    console.log(`✅ Batch Service: Updated batch ${batchId} status to CANCELLED`);

    // Step 10: Update Redis cache
    try {
      const redis = getRedisClient();
      const statusKey = RedisKeys.BATCH_STATUS.build(batchId);

      await redis.setex(
        statusKey,
        RedisKeys.BATCH_STATUS.ttl,
        JSON.stringify({
          batchId: cancelledBatch.id,
          status: cancelledBatch.status,
          totalUrls: cancelledBatch.totalUrls,
          completedCount: cancelledBatch.completedCount,
          cancelledAt: cancelledBatch.cancelledAt?.toISOString(),
        })
      );
    } catch (error) {
      // Log cache error but don't fail the request
      console.error('❌ Batch Service: Failed to update batch status cache:', error);
    }

    // Step 11: Return cancellation summary (Requirement 7.5)
    return {
      batchId: cancelledBatch.id,
      status: cancelledBatch.status,
      completedCount,
      cancelledCount,
      failedToCancel,
      message: `Cancelled ${cancelledCount} scans, preserved ${completedCount} completed scans`,
      cancelledAt: cancelledBatch.cancelledAt ?? new Date(),
    };
  } catch (error) {
    // Re-throw BatchServiceError as-is
    if (error instanceof BatchServiceError) {
      throw error;
    }

    // Re-throw repository errors as service errors
    if (error instanceof BatchRepositoryError) {
      throw new BatchServiceError(error.message, error.code, error);
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Batch Service: Failed to cancel batch:', err.message);
    throw new BatchServiceError('Failed to cancel batch', 'CANCEL_FAILED', err);
  }
}

/**
 * Check daily AI quota usage for a session
 *
 * @param sessionId - Guest session ID or user ID
 * @returns Number of AI URLs used today
 */
async function checkDailyAiQuota(sessionId: string): Promise<number> {
  try {
    const redis = getRedisClient();
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const key = RedisKeys.AI_QUOTA_DAILY.build(sessionId, today);
    const count = await redis.get(key);
    return count ? parseInt(count, 10) : 0;
  } catch (error) {
    console.error('❌ Batch Service: Failed to check daily AI quota:', error);
    return 0; // Fail open
  }
}

/**
 * Increment daily AI quota usage for a session
 *
 * @param sessionId - Guest session ID or user ID
 * @param count - Number of AI URLs to add
 */
async function incrementDailyAiQuota(sessionId: string, count: number): Promise<void> {
  try {
    const redis = getRedisClient();
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const key = RedisKeys.AI_QUOTA_DAILY.build(sessionId, today);

    const pipeline = redis.pipeline();
    pipeline.incrby(key, count);
    pipeline.expire(key, RedisKeys.AI_QUOTA_DAILY.ttl);
    await pipeline.exec();

    console.log(`✅ Batch Service: Incremented daily AI quota for ${sessionId} by ${count}`);
  } catch (error) {
    console.error('❌ Batch Service: Failed to increment daily AI quota:', error);
  }
}

/**
 * Get remaining daily AI quota for a session
 *
 * @param sessionId - Guest session ID or user ID
 * @returns Remaining AI URLs available today
 */
export async function getRemainingDailyAiQuota(sessionId: string): Promise<{
  used: number;
  remaining: number;
  limit: number;
}> {
  const used = await checkDailyAiQuota(sessionId);
  return {
    used,
    remaining: Math.max(0, FREE_TIER_QUOTAS.MAX_AI_URLS_PER_DAY - used),
    limit: FREE_TIER_QUOTAS.MAX_AI_URLS_PER_DAY,
  };
}

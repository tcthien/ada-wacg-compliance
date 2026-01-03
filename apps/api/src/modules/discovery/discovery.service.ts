/**
 * Discovery Service
 *
 * Business logic layer for website skeleton discovery operations.
 * Orchestrates usage limit checks, database operations, job queuing, and caching.
 */

import { getRedisClient } from '../../config/redis.js';
import { validateUrl } from '../../shared/utils/url-validator.js';
import {
  create as createDiscoveryInRepo,
  findById,
  findByIdWithPages,
  updateStatus,
  getMonthlyUsage,
  getOrCreateUsage,
  incrementUsage,
  getMonthKey,
  addPage,
  removePage as removePageFromRepo,
  findPageByUrl,
} from './discovery.repository.js';
import {
  DiscoveryServiceError,
  DiscoveryErrorCode,
  DiscoveryRepositoryError,
} from './discovery.errors.js';
import { addDiscoveryJob } from './discovery.worker.js';
import type {
  Discovery,
  DiscoveryWithPages,
  CreateDiscoveryInput,
  UsageLimitResult,
  AddUrlResult,
  DiscoveredPage,
} from './discovery.types.js';
import type { DiscoveryStatus } from '@prisma/client';
import { getPrismaClient } from '../../config/database.js';

/**
 * MVP tier limits for free users
 *
 * Defines the constraints for the free tier:
 * - discoveriesPerMonth: Maximum number of discoveries per calendar month
 * - maxPages: Maximum pages per discovery
 * - maxDepth: Maximum crawl depth (1 = homepage + direct links only)
 * - aiDiscoveryEnabled: AI-powered discovery disabled for MVP
 */
export const MVP_LIMITS = {
  discoveriesPerMonth: 100, // Increased for testing (was 3)
  maxPages: 10,
  maxDepth: 1,
  aiDiscoveryEnabled: false
} as const;

/**
 * Discovery usage limit per month (free tier)
 * @deprecated Use MVP_LIMITS.discoveriesPerMonth instead
 */
const DISCOVERY_LIMIT_PER_MONTH = MVP_LIMITS.discoveriesPerMonth;

/**
 * Redis cache key patterns and TTL constants
 *
 * Status cache: Stores current discovery status (PENDING, RUNNING, COMPLETED, etc.)
 * Result cache: Stores complete discovery with all pages (for completed discoveries)
 */
const CACHE_KEYS = {
  status: (id: string) => `discovery:${id}:status`,
  result: (id: string) => `discovery:${id}:result`,
} as const;

const CACHE_TTL = {
  status: 60 * 60,        // 1 hour for status
  result: 60 * 60 * 24,   // 24 hours for results
} as const;

/**
 * Legacy Redis key patterns - maintained for backward compatibility
 * @deprecated Use CACHE_KEYS and CACHE_TTL instead
 */
const DiscoveryRedisKeys = {
  DISCOVERY_STATUS: {
    build: (discoveryId: string) => CACHE_KEYS.status(discoveryId),
    ttl: CACHE_TTL.status,
  },
  DISCOVERY_RESULT: {
    build: (discoveryId: string) => CACHE_KEYS.result(discoveryId),
    ttl: CACHE_TTL.result,
  },
} as const;

/**
 * Check if user can create a new discovery (usage limit check)
 *
 * Enforces the 3 discoveries per month limit for free tier users.
 *
 * @param sessionId - Guest session ID
 * @returns Usage limit check result
 *
 * @example
 * ```typescript
 * const limit = await checkUsageLimit('session-123');
 * if (!limit.allowed) {
 *   throw new Error(limit.message);
 * }
 * ```
 */
export async function checkUsageLimit(
  sessionId: string
): Promise<UsageLimitResult> {
  try {
    if (!sessionId || typeof sessionId !== 'string') {
      throw new DiscoveryServiceError(
        'Session ID is required and must be a string',
        DiscoveryErrorCode.INVALID_INPUT
      );
    }

    // Get current month's usage
    const currentMonth = new Date();
    const monthKey = getMonthKey(currentMonth);

    const usage = await getMonthlyUsage({ guestSessionId: sessionId }, monthKey);

    const currentCount = usage?.discoveryCount ?? 0;
    const remaining = Math.max(0, DISCOVERY_LIMIT_PER_MONTH - currentCount);
    const allowed = currentCount < DISCOVERY_LIMIT_PER_MONTH;

    // Calculate reset date (first day of next month)
    const resetDate = new Date(monthKey);
    resetDate.setMonth(resetDate.getMonth() + 1);

    return {
      allowed,
      remaining,
      limit: DISCOVERY_LIMIT_PER_MONTH,
      resetDate,
      message: allowed
        ? `You have ${remaining} discoveries remaining this month`
        : `Discovery limit reached. Limit resets on ${resetDate.toISOString().split('T')[0]}`,
    };
  } catch (error) {
    // Re-throw DiscoveryServiceError as-is
    if (error instanceof DiscoveryServiceError) {
      throw error;
    }

    // Re-throw repository errors as service errors
    if (error instanceof DiscoveryRepositoryError) {
      throw new DiscoveryServiceError(error.message, error.code, {
        cause: error,
      });
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Discovery Service: Failed to check usage limit:', err.message);
    throw new DiscoveryServiceError(
      'Failed to check usage limit',
      DiscoveryErrorCode.GET_FAILED,
      { cause: err }
    );
  }
}

/**
 * Create a new discovery
 *
 * 1. Validates homepage URL using url-validator (SSRF protection)
 * 2. Checks usage limit (3 discoveries per month for free tier)
 * 3. Creates discovery record via repository with status 'PENDING'
 * 4. Queues 'website-discovery' job via BullMQ (to be implemented in 4.3)
 * 5. Increments usage counter atomically
 * 6. Caches initial status in Redis
 * 7. Returns created discovery
 *
 * @param sessionId - Guest session ID
 * @param input - Discovery creation input
 * @returns Created discovery
 * @throws DiscoveryServiceError with codes: INVALID_URL, USAGE_LIMIT_EXCEEDED, CREATE_FAILED
 *
 * @example
 * ```typescript
 * const discovery = await createDiscovery('session-123', {
 *   homepageUrl: 'https://example.com',
 *   mode: 'AUTO',
 *   maxPages: 10,
 *   maxDepth: 1
 * });
 * ```
 */
export async function createDiscovery(
  sessionId: string,
  input: CreateDiscoveryInput
): Promise<Discovery> {
  try {
    // Validate session ID
    if (!sessionId || typeof sessionId !== 'string') {
      throw new DiscoveryServiceError(
        'Session ID is required and must be a string',
        DiscoveryErrorCode.INVALID_INPUT
      );
    }

    // Check usage limit first
    const usageLimit = await checkUsageLimit(sessionId);
    if (!usageLimit.allowed) {
      throw new DiscoveryServiceError(
        usageLimit.message,
        DiscoveryErrorCode.USAGE_LIMIT_EXCEEDED,
        {
          details: {
            remaining: usageLimit.remaining,
            limit: usageLimit.limit,
            resetDate: usageLimit.resetDate.toISOString(),
          },
        }
      );
    }

    // Validate and normalize URL with SSRF protection
    const validationResult = await validateUrl(input.homepageUrl);

    if (!validationResult.isValid) {
      throw new DiscoveryServiceError(
        validationResult.error ?? 'Invalid homepage URL',
        DiscoveryErrorCode.INVALID_URL
      );
    }

    const normalizedUrl = validationResult.normalizedUrl!;

    // Create discovery record in database
    const discoveryData: CreateDiscoveryInput = {
      homepageUrl: normalizedUrl,
      sessionId,
      mode: input.mode,
      maxPages: input.maxPages,
      maxDepth: input.maxDepth,
    };

    const discovery = await createDiscoveryInRepo(discoveryData);

    // Queue discovery job for worker processing
    try {
      await addDiscoveryJob({
        discoveryId: discovery.id,
        homepageUrl: normalizedUrl,
        mode: discovery.mode,
        maxPages: discovery.maxPages,
        maxDepth: discovery.maxDepth,
      });
    } catch (error) {
      // Log queue error but don't fail the request
      // The discovery record is created and can be retried later
      console.error('❌ Discovery Service: Failed to queue discovery job:', error);
    }

    // Increment usage counter atomically
    try {
      await incrementUsage({ guestSessionId: sessionId }, new Date());
    } catch (error) {
      // Log error but don't fail the request - usage tracking is non-critical
      console.error('❌ Discovery Service: Failed to increment usage:', error);
    }

    // Cache initial status in Redis
    const redis = getRedisClient();
    const statusKey = DiscoveryRedisKeys.DISCOVERY_STATUS.build(discovery.id);

    try {
      await redis.setex(
        statusKey,
        DiscoveryRedisKeys.DISCOVERY_STATUS.ttl,
        JSON.stringify({
          discoveryId: discovery.id,
          status: discovery.status,
          homepageUrl: discovery.homepageUrl,
          createdAt: discovery.createdAt.toISOString(),
          mode: discovery.mode,
          maxPages: discovery.maxPages,
          maxDepth: discovery.maxDepth,
        })
      );
    } catch (error) {
      // Log cache error but don't fail the request
      console.error('❌ Discovery Service: Failed to cache discovery status:', error);
    }

    console.log(
      `✅ Discovery Service: Created discovery ${discovery.id} for ${normalizedUrl}`
    );
    return discovery;
  } catch (error) {
    // Re-throw DiscoveryServiceError as-is
    if (error instanceof DiscoveryServiceError) {
      throw error;
    }

    // Re-throw repository errors as service errors
    if (error instanceof DiscoveryRepositoryError) {
      throw new DiscoveryServiceError(error.message, error.code, {
        cause: error,
      });
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Discovery Service: Failed to create discovery:', err.message);
    throw new DiscoveryServiceError(
      'Failed to create discovery',
      DiscoveryErrorCode.CREATE_FAILED,
      { cause: err }
    );
  }
}

/**
 * Get discovery by ID
 *
 * 1. Checks Redis cache first using getCachedDiscovery()
 * 2. Falls back to database query if cache miss
 * 3. Fetches discovery with related pages
 * 4. Caches result for future requests using cacheDiscoveryResult()
 * 5. Returns discovery with pages
 *
 * @param discoveryId - Discovery ID
 * @returns Discovery with pages or null if not found
 *
 * @example
 * ```typescript
 * const discovery = await getDiscovery('discovery-123');
 * if (discovery) {
 *   console.log(`Found ${discovery.pages.length} pages`);
 * }
 * ```
 */
export async function getDiscovery(
  discoveryId: string
): Promise<DiscoveryWithPages | null> {
  try {
    if (!discoveryId || typeof discoveryId !== 'string') {
      return null;
    }

    // Try Redis cache first (using dedicated caching method)
    const cached = await getCachedDiscovery(discoveryId);
    if (cached) {
      return cached;
    }

    // Cache miss - query database with pages
    const discovery = await findByIdWithPages(discoveryId);

    if (!discovery) {
      return null;
    }

    // Cache the result for completed discoveries (using dedicated caching method)
    if (discovery.status === 'COMPLETED' || discovery.status === 'FAILED') {
      await cacheDiscoveryResult(discovery);
    }

    return discovery;
  } catch (error) {
    console.error('❌ Discovery Service: Failed to get discovery:', error);
    return null;
  }
}

/**
 * Cancel a discovery
 *
 * 1. Verifies discovery exists and is in a cancellable state
 * 2. Updates discovery status to CANCELLED via repository
 * 3. Removes job from queue if still pending (to be implemented in 4.3)
 * 4. Invalidates cache
 * 5. Returns updated discovery
 *
 * @param discoveryId - Discovery ID to cancel
 * @returns Updated discovery with CANCELLED status
 * @throws DiscoveryServiceError with codes: DISCOVERY_NOT_FOUND, INVALID_INPUT
 *
 * @example
 * ```typescript
 * const discovery = await cancelDiscovery('discovery-123');
 * console.log(`Discovery cancelled: ${discovery.status}`);
 * ```
 */
export async function cancelDiscovery(discoveryId: string): Promise<Discovery> {
  try {
    if (!discoveryId || typeof discoveryId !== 'string') {
      throw new DiscoveryServiceError(
        'Discovery ID is required and must be a string',
        DiscoveryErrorCode.INVALID_INPUT
      );
    }

    // Verify discovery exists
    const existingDiscovery = await findById(discoveryId);

    if (!existingDiscovery) {
      throw new DiscoveryServiceError(
        `Discovery not found: ${discoveryId}`,
        DiscoveryErrorCode.DISCOVERY_NOT_FOUND
      );
    }

    // Only allow cancellation of PENDING or RUNNING discoveries
    if (
      existingDiscovery.status !== 'PENDING' &&
      existingDiscovery.status !== 'RUNNING'
    ) {
      throw new DiscoveryServiceError(
        `Cannot cancel discovery with status ${existingDiscovery.status}`,
        DiscoveryErrorCode.DISCOVERY_CANCELLED,
        {
          details: {
            currentStatus: existingDiscovery.status,
          },
        }
      );
    }

    // Update status to CANCELLED
    const cancelledDiscovery = await updateStatus(discoveryId, 'CANCELLED');

    // TODO: Remove job from queue if still pending (to be implemented in 4.3)
    // try {
    //   await removeDiscoveryJob(discoveryId);
    // } catch (error) {
    //   // Log error but don't fail the request
    //   console.error('❌ Discovery Service: Failed to remove discovery job:', error);
    // }

    // Invalidate cache (using dedicated caching method)
    await invalidateCache(discoveryId);

    console.log(`✅ Discovery Service: Cancelled discovery ${discoveryId}`);
    return cancelledDiscovery;
  } catch (error) {
    // Re-throw DiscoveryServiceError as-is
    if (error instanceof DiscoveryServiceError) {
      throw error;
    }

    // Re-throw repository errors as service errors
    if (error instanceof DiscoveryRepositoryError) {
      throw new DiscoveryServiceError(error.message, error.code, {
        cause: error,
      });
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Discovery Service: Failed to cancel discovery:', err.message);
    throw new DiscoveryServiceError(
      'Failed to cancel discovery',
      DiscoveryErrorCode.UPDATE_FAILED,
      { cause: err }
    );
  }
}

// ============================================================================
// CACHING OPERATIONS
// ============================================================================

/**
 * Get cached discovery result from Redis
 *
 * Checks Redis cache for a completed discovery result.
 * Cache key pattern: `discovery:{id}:result`
 *
 * @param discoveryId - Discovery ID to retrieve from cache
 * @returns Cached discovery with pages or null if not found/not cached
 *
 * @example
 * ```typescript
 * const cached = await getCachedDiscovery('discovery-123');
 * if (cached) {
 *   console.log(`Found ${cached.pages.length} pages in cache`);
 * }
 * ```
 */
export async function getCachedDiscovery(
  discoveryId: string
): Promise<DiscoveryWithPages | null> {
  try {
    if (!discoveryId || typeof discoveryId !== 'string') {
      return null;
    }

    const redis = getRedisClient();
    const cacheKey = CACHE_KEYS.result(discoveryId);

    const cached = await redis.get(cacheKey);
    if (!cached) {
      return null;
    }

    // Parse cached data
    const parsedData = JSON.parse(cached) as {
      discovery: any;
      pages: any[];
      cachedAt: string;
    };

    // Reconstruct dates from ISO strings
    const discovery: DiscoveryWithPages = {
      ...parsedData.discovery,
      createdAt: new Date(parsedData.discovery.createdAt),
      updatedAt: new Date(parsedData.discovery.updatedAt),
      completedAt: parsedData.discovery.completedAt
        ? new Date(parsedData.discovery.completedAt)
        : null,
      pages: parsedData.pages.map((page: any) => ({
        ...page,
        createdAt: new Date(page.createdAt),
      })),
    };

    return discovery;
  } catch (error) {
    // Log cache error but return null to allow fallback to database
    console.error('❌ Discovery Service: Failed to get cached discovery:', error);
    return null;
  }
}

/**
 * Cache discovery result in Redis with 24h TTL
 *
 * Stores completed discovery with all pages in Redis cache.
 * Only caches discoveries with status COMPLETED or FAILED.
 * Includes cachedAt timestamp for tracking.
 *
 * Cache key pattern: `discovery:{id}:result`
 * TTL: 24 hours
 *
 * @param discovery - Discovery with pages to cache
 * @returns True if cached successfully, false on error
 *
 * @example
 * ```typescript
 * const discovery = await findByIdWithPages('discovery-123');
 * if (discovery && discovery.status === 'COMPLETED') {
 *   await cacheDiscoveryResult(discovery);
 * }
 * ```
 */
export async function cacheDiscoveryResult(
  discovery: DiscoveryWithPages
): Promise<boolean> {
  try {
    // Only cache completed or failed discoveries
    if (discovery.status !== 'COMPLETED' && discovery.status !== 'FAILED') {
      console.warn(
        `⚠️ Discovery Service: Skipping cache for discovery ${discovery.id} with status ${discovery.status}`
      );
      return false;
    }

    const redis = getRedisClient();
    const cacheKey = CACHE_KEYS.result(discovery.id);

    // Prepare data for caching (convert dates to ISO strings)
    const cacheData = {
      discovery: {
        ...discovery,
        createdAt: discovery.createdAt.toISOString(),
        updatedAt: discovery.updatedAt.toISOString(),
        completedAt: discovery.completedAt?.toISOString() ?? null,
      },
      pages: discovery.pages.map((page) => ({
        ...page,
        createdAt: page.createdAt.toISOString(),
      })),
      cachedAt: new Date().toISOString(),
    };

    // Store in Redis with 24h TTL
    await redis.setex(
      cacheKey,
      CACHE_TTL.result,
      JSON.stringify(cacheData)
    );

    console.log(
      `✅ Discovery Service: Cached discovery ${discovery.id} with ${discovery.pages.length} pages`
    );
    return true;
  } catch (error) {
    // Log cache error but don't fail the operation
    console.error('❌ Discovery Service: Failed to cache discovery result:', error);
    return false;
  }
}

/**
 * Invalidate all caches for a discovery
 *
 * Removes both status cache and result cache from Redis.
 * Used when discovery is modified (status change, pages added/removed, cancelled).
 *
 * Cache keys cleared:
 * - `discovery:{id}:status` - Current discovery status
 * - `discovery:{id}:result` - Complete discovery with pages
 *
 * @param discoveryId - Discovery ID to invalidate
 * @returns True if cache was invalidated successfully
 *
 * @example
 * ```typescript
 * // After updating discovery status
 * await updateStatus(discoveryId, 'COMPLETED');
 * await invalidateCache(discoveryId);
 * ```
 */
export async function invalidateCache(discoveryId: string): Promise<boolean> {
  try {
    if (!discoveryId || typeof discoveryId !== 'string') {
      return false;
    }

    const redis = getRedisClient();
    const statusKey = CACHE_KEYS.status(discoveryId);
    const resultKey = CACHE_KEYS.result(discoveryId);

    // Delete both status and result caches
    await Promise.all([
      redis.del(statusKey),
      redis.del(resultKey)
    ]);

    console.log(`✅ Discovery Service: Invalidated cache for discovery ${discoveryId}`);
    return true;
  } catch (error) {
    // Log cache error but don't fail the operation
    console.error('❌ Discovery Service: Failed to invalidate cache:', error);
    return false;
  }
}

/**
 * Verify cache integrity and validate cached data structure
 *
 * Validates that cached data has all required fields and correct ID.
 * If cache is corrupted, deletes the corrupted entry automatically.
 *
 * Required fields:
 * - id (must match discoveryId)
 * - homepageUrl
 * - status
 * - pages (array)
 *
 * @param cached - Unknown cached data to validate
 * @param discoveryId - Expected discovery ID
 * @returns Typed DiscoveryWithPages if valid, null if invalid
 *
 * @example
 * ```typescript
 * const cached = await redis.get(cacheKey);
 * const parsed = JSON.parse(cached);
 * const valid = await verifyCacheIntegrity(parsed, 'discovery-123');
 * if (valid) {
 *   console.log(`Cache valid with ${valid.pages.length} pages`);
 * } else {
 *   console.log('Cache corrupted, was deleted');
 * }
 * ```
 */
export async function verifyCacheIntegrity(
  cached: unknown,
  discoveryId: string
): Promise<DiscoveryWithPages | null> {
  try {
    // Type guard: Check if cached is an object
    if (!cached || typeof cached !== 'object' || cached === null) {
      console.warn(`⚠️ Discovery Service: Cache integrity check failed - invalid type`);
      await invalidateCache(discoveryId);
      return null;
    }

    // Parse cached data structure
    const parsedData = cached as {
      discovery?: any;
      pages?: any[];
      cachedAt?: string;
    };

    // Validate required fields exist
    if (!parsedData.discovery || !Array.isArray(parsedData.pages)) {
      console.warn(`⚠️ Discovery Service: Cache integrity check failed - missing required fields`);
      await invalidateCache(discoveryId);
      return null;
    }

    const { discovery, pages } = parsedData;

    // Validate discovery object has required fields
    if (
      !discovery.id ||
      !discovery.homepageUrl ||
      !discovery.status ||
      typeof discovery.id !== 'string' ||
      typeof discovery.homepageUrl !== 'string' ||
      typeof discovery.status !== 'string'
    ) {
      console.warn(`⚠️ Discovery Service: Cache integrity check failed - invalid discovery fields`);
      await invalidateCache(discoveryId);
      return null;
    }

    // Validate ID matches
    if (discovery.id !== discoveryId) {
      console.warn(
        `⚠️ Discovery Service: Cache integrity check failed - ID mismatch (expected: ${discoveryId}, got: ${discovery.id})`
      );
      await invalidateCache(discoveryId);
      return null;
    }

    // Reconstruct typed DiscoveryWithPages
    const validatedDiscovery: DiscoveryWithPages = {
      ...discovery,
      createdAt: new Date(discovery.createdAt),
      updatedAt: new Date(discovery.updatedAt),
      completedAt: discovery.completedAt
        ? new Date(discovery.completedAt)
        : null,
      pages: pages.map((page: any) => ({
        ...page,
        createdAt: new Date(page.createdAt),
      })),
    };

    return validatedDiscovery;
  } catch (error) {
    // Any error during validation means corrupted cache
    console.error('❌ Discovery Service: Cache integrity verification failed:', error);
    await invalidateCache(discoveryId);
    return null;
  }
}

/**
 * Get cache metadata for a discovery
 *
 * Returns metadata about cached discovery including timestamps and page count.
 * Useful for cache management and debugging.
 *
 * @param discoveryId - Discovery ID to get metadata for
 * @returns Cache metadata or null if not cached
 *
 * @example
 * ```typescript
 * const metadata = await getCacheMetadata('discovery-123');
 * if (metadata) {
 *   console.log(`Cached at: ${metadata.cachedAt}`);
 *   console.log(`Expires at: ${metadata.expiresAt}`);
 *   console.log(`Pages: ${metadata.pageCount}`);
 * }
 * ```
 */
export async function getCacheMetadata(
  discoveryId: string
): Promise<{ cachedAt: Date; expiresAt: Date; pageCount: number } | null> {
  try {
    if (!discoveryId || typeof discoveryId !== 'string') {
      return null;
    }

    const redis = getRedisClient();
    const cacheKey = CACHE_KEYS.result(discoveryId);

    // Get cached data and TTL
    const [cached, ttl] = await Promise.all([
      redis.get(cacheKey),
      redis.ttl(cacheKey)
    ]);

    if (!cached || ttl <= 0) {
      return null;
    }

    // Parse cached data
    const parsedData = JSON.parse(cached) as {
      discovery: any;
      pages: any[];
      cachedAt: string;
    };

    if (!parsedData.cachedAt || !Array.isArray(parsedData.pages)) {
      return null;
    }

    const cachedAt = new Date(parsedData.cachedAt);
    const expiresAt = new Date(cachedAt.getTime() + CACHE_TTL.result * 1000);

    return {
      cachedAt,
      expiresAt,
      pageCount: parsedData.pages.length,
    };
  } catch (error) {
    // Log error but return null to allow graceful degradation
    console.error('❌ Discovery Service: Failed to get cache metadata:', error);
    return null;
  }
}

/**
 * Check if cache should be refreshed based on age
 *
 * Determines if cache is approaching expiration and should be refreshed.
 * Uses 20-hour threshold for 24-hour TTL (83% of TTL).
 *
 * @param cachedAt - Timestamp when data was cached
 * @returns True if cache should be refreshed, false otherwise
 *
 * @example
 * ```typescript
 * const metadata = await getCacheMetadata('discovery-123');
 * if (metadata && shouldRefreshCache(metadata.cachedAt)) {
 *   console.log('Cache is stale, consider refreshing');
 *   // Optionally trigger background refresh
 * }
 * ```
 */
export function shouldRefreshCache(cachedAt: Date): boolean {
  try {
    const now = new Date();
    const ageInSeconds = (now.getTime() - cachedAt.getTime()) / 1000;

    // Refresh if cache is >20 hours old (for 24h TTL)
    // 20 hours = 72000 seconds
    const REFRESH_THRESHOLD = 20 * 60 * 60; // 20 hours in seconds

    return ageInSeconds > REFRESH_THRESHOLD;
  } catch (error) {
    // If error during calculation, assume refresh is needed
    console.error('❌ Discovery Service: Failed to check cache age:', error);
    return true;
  }
}

// ============================================================================
// MANUAL URL OPERATIONS
// ============================================================================

/**
 * Check if a target URL is from the same domain as homepage URL
 *
 * Normalizes both URLs by removing www prefix for comparison.
 * Ensures manual URLs stay within the same domain as the discovered website.
 *
 * @param homepageUrl - Homepage URL to compare against
 * @param targetUrl - Target URL to validate
 * @returns True if both URLs are from the same domain
 *
 * @example
 * ```typescript
 * isSameDomain('https://example.com', 'https://www.example.com/page') // true
 * isSameDomain('https://www.example.com', 'https://example.com/page') // true
 * isSameDomain('https://example.com', 'https://other.com/page') // false
 * ```
 */
export function isSameDomain(homepageUrl: string, targetUrl: string): boolean {
  try {
    const homepageUrlObj = new URL(homepageUrl);
    const targetUrlObj = new URL(targetUrl);

    // Normalize hostnames by removing www prefix
    const normalizeHostname = (hostname: string): string => {
      return hostname.replace(/^www\./, '');
    };

    const homepageHostname = normalizeHostname(homepageUrlObj.hostname);
    const targetHostname = normalizeHostname(targetUrlObj.hostname);

    return homepageHostname === targetHostname;
  } catch (error) {
    // Invalid URL format
    return false;
  }
}

/**
 * Add a manual URL to a discovery
 *
 * 1. Validates discovery exists and is not in terminal state
 * 2. Validates URL using url-validator (SSRF protection)
 * 3. Validates URL matches homepage domain using isSameDomain()
 * 4. Checks if URL already exists in discovery
 * 5. Adds page via repository with source=MANUAL, depth=0
 * 6. Invalidates cache
 * 7. Returns AddUrlResult with success/failure and page data
 *
 * @param discoveryId - Discovery ID to add URL to
 * @param url - URL to add
 * @returns Result indicating success/failure with page data
 * @throws DiscoveryServiceError with codes: INVALID_INPUT, DISCOVERY_NOT_FOUND, INVALID_URL, DOMAIN_MISMATCH, DISCOVERY_CANCELLED
 *
 * @example
 * ```typescript
 * const result = await addManualUrl('discovery-123', 'https://example.com/contact');
 * if (result.success) {
 *   console.log(`Added page: ${result.page?.url}`);
 * } else {
 *   console.log(`Failed: ${result.message}`);
 * }
 * ```
 */
export async function addManualUrl(
  discoveryId: string,
  url: string
): Promise<AddUrlResult> {
  try {
    // Validate inputs
    if (!discoveryId || typeof discoveryId !== 'string') {
      throw new DiscoveryServiceError(
        'Discovery ID is required and must be a string',
        DiscoveryErrorCode.INVALID_INPUT
      );
    }

    if (!url || typeof url !== 'string') {
      throw new DiscoveryServiceError(
        'URL is required and must be a string',
        DiscoveryErrorCode.INVALID_INPUT
      );
    }

    // Verify discovery exists
    const discovery = await findById(discoveryId);

    if (!discovery) {
      throw new DiscoveryServiceError(
        `Discovery not found: ${discoveryId}`,
        DiscoveryErrorCode.DISCOVERY_NOT_FOUND
      );
    }

    // Only allow adding URLs to non-terminal discoveries
    if (
      discovery.status === 'COMPLETED' ||
      discovery.status === 'FAILED' ||
      discovery.status === 'CANCELLED'
    ) {
      throw new DiscoveryServiceError(
        `Cannot add URL to discovery with status ${discovery.status}`,
        DiscoveryErrorCode.DISCOVERY_CANCELLED,
        {
          details: {
            currentStatus: discovery.status,
          },
        }
      );
    }

    // Validate and normalize URL with SSRF protection
    const validationResult = await validateUrl(url);

    if (!validationResult.isValid) {
      return {
        success: false,
        message: validationResult.error ?? 'Invalid URL',
      };
    }

    const normalizedUrl = validationResult.normalizedUrl!;

    // Validate URL matches homepage domain
    if (!isSameDomain(discovery.homepageUrl, normalizedUrl)) {
      return {
        success: false,
        message: 'URL must be from the same domain as homepage',
      };
    }

    // Check if URL already exists
    const existingPage = await findPageByUrl(discoveryId, normalizedUrl);
    if (existingPage) {
      return {
        success: false,
        page: existingPage,
        message: 'URL already exists in discovery',
      };
    }

    // Add page via repository with source=MANUAL, depth=0
    const page = await addPage(discoveryId, {
      url: normalizedUrl,
      source: 'MANUAL',
      depth: 0,
    });

    if (!page) {
      return {
        success: false,
        message: 'Failed to add page',
      };
    }

    // Invalidate cache (using dedicated caching method)
    await invalidateCache(discoveryId);

    console.log(
      `✅ Discovery Service: Added manual URL ${normalizedUrl} to discovery ${discoveryId}`
    );

    return {
      success: true,
      page,
      message: 'URL added successfully',
    };
  } catch (error) {
    // Re-throw DiscoveryServiceError as-is
    if (error instanceof DiscoveryServiceError) {
      throw error;
    }

    // Re-throw repository errors as service errors
    if (error instanceof DiscoveryRepositoryError) {
      throw new DiscoveryServiceError(error.message, error.code, {
        cause: error,
      });
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Discovery Service: Failed to add manual URL:', err.message);
    throw new DiscoveryServiceError(
      'Failed to add manual URL',
      DiscoveryErrorCode.UPDATE_FAILED,
      { cause: err }
    );
  }
}

/**
 * Add multiple manual URLs to a discovery
 *
 * Processes each URL independently, allowing partial success.
 * Returns array of AddUrlResult for each URL.
 *
 * @param discoveryId - Discovery ID to add URLs to
 * @param urls - Array of URLs to add
 * @returns Array of results for each URL
 * @throws DiscoveryServiceError with codes: INVALID_INPUT, DISCOVERY_NOT_FOUND
 *
 * @example
 * ```typescript
 * const results = await addManualUrls('discovery-123', [
 *   'https://example.com/contact',
 *   'https://example.com/about'
 * ]);
 * const successful = results.filter(r => r.success);
 * console.log(`Added ${successful.length} of ${results.length} URLs`);
 * ```
 */
export async function addManualUrls(
  discoveryId: string,
  urls: string[]
): Promise<AddUrlResult[]> {
  try {
    // Validate inputs
    if (!discoveryId || typeof discoveryId !== 'string') {
      throw new DiscoveryServiceError(
        'Discovery ID is required and must be a string',
        DiscoveryErrorCode.INVALID_INPUT
      );
    }

    if (!Array.isArray(urls) || urls.length === 0) {
      throw new DiscoveryServiceError(
        'URLs array is required and must not be empty',
        DiscoveryErrorCode.INVALID_INPUT
      );
    }

    // Verify discovery exists (single check for all URLs)
    const discovery = await findById(discoveryId);

    if (!discovery) {
      throw new DiscoveryServiceError(
        `Discovery not found: ${discoveryId}`,
        DiscoveryErrorCode.DISCOVERY_NOT_FOUND
      );
    }

    // Process each URL independently
    const results: AddUrlResult[] = [];

    for (const url of urls) {
      try {
        const result = await addManualUrl(discoveryId, url);
        results.push(result);
      } catch (error) {
        // Catch errors for individual URLs to allow partial success
        const err = error instanceof Error ? error : new Error(String(error));
        results.push({
          success: false,
          message: err.message,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    console.log(
      `✅ Discovery Service: Added ${successCount} of ${urls.length} manual URLs to discovery ${discoveryId}`
    );

    return results;
  } catch (error) {
    // Re-throw DiscoveryServiceError as-is
    if (error instanceof DiscoveryServiceError) {
      throw error;
    }

    // Re-throw repository errors as service errors
    if (error instanceof DiscoveryRepositoryError) {
      throw new DiscoveryServiceError(error.message, error.code, {
        cause: error,
      });
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Discovery Service: Failed to add manual URLs:', err.message);
    throw new DiscoveryServiceError(
      'Failed to add manual URLs',
      DiscoveryErrorCode.UPDATE_FAILED,
      { cause: err }
    );
  }
}

/**
 * Remove a manual URL from a discovery
 *
 * 1. Validates page exists and belongs to discovery
 * 2. Only allows removing MANUAL source pages
 * 3. Removes via repository
 * 4. Invalidates cache
 * 5. Returns boolean success
 *
 * @param discoveryId - Discovery ID
 * @param pageId - Page ID to remove
 * @returns True if page was removed, false otherwise
 * @throws DiscoveryServiceError with codes: INVALID_INPUT, PAGE_NOT_FOUND, INVALID_INPUT (if not MANUAL source)
 *
 * @example
 * ```typescript
 * const removed = await removeManualUrl('discovery-123', 'page-456');
 * if (removed) {
 *   console.log('Manual URL removed successfully');
 * } else {
 *   console.log('Failed to remove URL');
 * }
 * ```
 */
export async function removeManualUrl(
  discoveryId: string,
  pageId: string
): Promise<boolean> {
  const prisma = getPrismaClient();

  try {
    // Validate inputs
    if (!discoveryId || typeof discoveryId !== 'string') {
      throw new DiscoveryServiceError(
        'Discovery ID is required and must be a string',
        DiscoveryErrorCode.INVALID_INPUT
      );
    }

    if (!pageId || typeof pageId !== 'string') {
      throw new DiscoveryServiceError(
        'Page ID is required and must be a string',
        DiscoveryErrorCode.INVALID_INPUT
      );
    }

    // Verify page exists and belongs to this discovery
    const page = await prisma.discoveredPage.findFirst({
      where: {
        id: pageId,
        discoveryId,
      },
    });

    if (!page) {
      throw new DiscoveryServiceError(
        `Page not found or doesn't belong to discovery ${discoveryId}`,
        DiscoveryErrorCode.PAGE_NOT_FOUND
      );
    }

    // Only allow removing MANUAL source pages
    if (page.source !== 'MANUAL') {
      throw new DiscoveryServiceError(
        'Can only remove manually added pages',
        DiscoveryErrorCode.INVALID_INPUT,
        {
          details: {
            pageSource: page.source,
          },
        }
      );
    }

    // Remove page via repository
    const removed = await removePageFromRepo(discoveryId, pageId);

    if (!removed) {
      return false;
    }

    // Invalidate cache (using dedicated caching method)
    await invalidateCache(discoveryId);

    console.log(
      `✅ Discovery Service: Removed manual URL from discovery ${discoveryId}`
    );

    return true;
  } catch (error) {
    // Re-throw DiscoveryServiceError as-is
    if (error instanceof DiscoveryServiceError) {
      throw error;
    }

    // Re-throw repository errors as service errors
    if (error instanceof DiscoveryRepositoryError) {
      throw new DiscoveryServiceError(error.message, error.code, {
        cause: error,
      });
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Discovery Service: Failed to remove manual URL:', err.message);
    throw new DiscoveryServiceError(
      'Failed to remove manual URL',
      DiscoveryErrorCode.UPDATE_FAILED,
      { cause: err }
    );
  }
}

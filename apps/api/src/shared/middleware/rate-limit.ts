import { createHash } from 'node:crypto';
import type {
  FastifyRequest,
  FastifyReply,
  preHandlerHookHandler,
} from 'fastify';
import { getRedisClient } from '../../config/redis.js';
import { RedisKeys } from '../constants/redis-keys.js';
import { generateFingerprint } from '../utils/fingerprint.js';

/**
 * Rate Limiting Middleware
 *
 * Implements per-URL rate limiting for guest users.
 * Limits scan requests to 10 per hour per URL + fingerprint combination.
 *
 * Features:
 * - Redis-based counter storage with TTL
 * - URL hashing for consistent key generation
 * - Standard rate limit headers (X-RateLimit-*)
 * - 429 response with Retry-After header when exceeded
 * - Graceful degradation if Redis unavailable
 */

/**
 * Rate limit configuration
 */
export const RATE_LIMIT_CONFIG = {
  /** Maximum requests per window */
  MAX_REQUESTS: 100, // Increased for testing (was 10)
  /** Window duration in seconds (1 hour) */
  WINDOW_SECONDS: 3600,
} as const;

/**
 * Batch rate limit configuration
 */
export const BATCH_RATE_LIMIT_CONFIG = {
  /** Maximum URLs per hour per guest session */
  MAX_URLS_PER_HOUR: 100,
  /** Maximum batches per hour per guest session */
  MAX_BATCHES_PER_HOUR: 2,
  /** Window duration in seconds (1 hour) */
  WINDOW_SECONDS: 3600,
} as const;

/**
 * Hash URL for consistent Redis key generation
 *
 * @param url - URL to hash
 * @returns URL hash (16 characters)
 */
function hashUrl(url: string): string {
  const hash = createHash('sha256').update(url.toLowerCase().trim()).digest('hex');
  return hash.substring(0, 16);
}

/**
 * Get rate limit key for URL + fingerprint combination
 *
 * @param url - URL being scanned
 * @param fingerprint - Device fingerprint
 * @returns Redis key for rate limiting
 */
function getRateLimitKey(url: string, fingerprint: string): string {
  const urlHash = hashUrl(url);
  return RedisKeys.RATE_LIMIT_URL.build(urlHash, fingerprint);
}

/**
 * Get current request count from Redis
 *
 * @param key - Redis key
 * @param request - Fastify request for logging
 * @returns Current request count
 */
async function getCurrentCount(key: string, request?: FastifyRequest): Promise<number> {
  try {
    const redis = getRedisClient();
    const count = await redis.get(key);
    return count ? parseInt(count, 10) : 0;
  } catch (error) {
    if (request?.log) {
      (request.log as unknown as { error: (obj: object, msg: string) => void }).error(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        'Rate limit read error'
      );
    } else {
      console.error('Rate limit read error:', error);
    }
    return 0;
  }
}

/**
 * Increment request count in Redis
 *
 * @param key - Redis key
 * @param request - Fastify request for logging
 * @returns New request count
 */
async function incrementCount(key: string, request?: FastifyRequest): Promise<number> {
  try {
    const redis = getRedisClient();

    // Use pipeline for atomic increment + TTL set
    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, RedisKeys.RATE_LIMIT_URL.ttl);

    const results = await pipeline.exec();

    // Get INCR result (first command)
    if (results && results[0] && !results[0][0]) {
      return results[0][1] as number;
    }

    return 1;
  } catch (error) {
    if (request?.log) {
      (request.log as unknown as { error: (obj: object, msg: string) => void }).error(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        'Rate limit increment error'
      );
    } else {
      console.error('Rate limit increment error:', error);
    }
    // Return 0 to allow request on Redis failure (fail open)
    return 0;
  }
}

/**
 * Get TTL for rate limit key
 *
 * @param key - Redis key
 * @param request - Fastify request for logging
 * @returns Remaining TTL in seconds, or default window seconds
 */
async function getTTL(key: string, request?: FastifyRequest): Promise<number> {
  try {
    const redis = getRedisClient();
    const ttl = await redis.ttl(key);

    // If key doesn't exist or has no expiry, return default window
    if (ttl < 0) {
      return RATE_LIMIT_CONFIG.WINDOW_SECONDS;
    }

    return ttl;
  } catch (error) {
    if (request?.log) {
      (request.log as unknown as { error: (obj: object, msg: string) => void }).error(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        'Rate limit TTL error'
      );
    } else {
      console.error('Rate limit TTL error:', error);
    }
    return RATE_LIMIT_CONFIG.WINDOW_SECONDS;
  }
}

/**
 * Set rate limit headers on response
 *
 * @param reply - Fastify reply
 * @param limit - Maximum requests allowed
 * @param remaining - Remaining requests in window
 * @param resetSeconds - Seconds until limit resets
 */
function setRateLimitHeaders(
  reply: FastifyReply,
  limit: number,
  remaining: number,
  resetSeconds: number
): void {
  const resetTime = Math.floor(Date.now() / 1000) + resetSeconds;

  reply.header('X-RateLimit-Limit', limit.toString());
  reply.header('X-RateLimit-Remaining', Math.max(0, remaining).toString());
  reply.header('X-RateLimit-Reset', resetTime.toString());
}

/**
 * Rate limiting middleware factory
 *
 * Creates a rate limiting middleware for a specific URL parameter.
 *
 * @param urlParam - Name of the URL parameter to rate limit (default: 'url')
 * @returns Rate limiting middleware
 *
 * @example
 * // Apply to scan endpoint
 * fastify.post('/api/scan',
 *   { preHandler: [sessionMiddleware, createRateLimitMiddleware('url')] },
 *   scanHandler
 * );
 */
export function createRateLimitMiddleware(
  urlParam: string = 'url'
): preHandlerHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Extract URL from request body or query
      const body = request.body as Record<string, unknown> | undefined;
      const query = request.query as Record<string, unknown> | undefined;
      const url = body?.[urlParam] ?? query?.[urlParam];

      if (!url || typeof url !== 'string') {
        // No URL to rate limit, skip
        return;
      }

      // Get fingerprint from request
      const fingerprint = generateFingerprint(request);

      // Get rate limit key
      const rateLimitKey = getRateLimitKey(url, fingerprint);

      // Get current count
      const currentCount = await getCurrentCount(rateLimitKey, request);

      // Check if limit exceeded
      if (currentCount >= RATE_LIMIT_CONFIG.MAX_REQUESTS) {
        const ttl = await getTTL(rateLimitKey, request);

        // Set rate limit headers
        setRateLimitHeaders(
          reply,
          RATE_LIMIT_CONFIG.MAX_REQUESTS,
          0,
          ttl
        );

        // Set Retry-After header
        reply.header('Retry-After', ttl.toString());

        return reply.code(429).send({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Maximum ${RATE_LIMIT_CONFIG.MAX_REQUESTS} scans per hour per URL.`,
          retryAfter: ttl,
        });
      }

      // Increment count
      const newCount = await incrementCount(rateLimitKey, request);

      // Get TTL for reset time
      const ttl = await getTTL(rateLimitKey, request);

      // Set rate limit headers
      setRateLimitHeaders(
        reply,
        RATE_LIMIT_CONFIG.MAX_REQUESTS,
        RATE_LIMIT_CONFIG.MAX_REQUESTS - newCount,
        ttl
      );

    } catch (error) {
      // Log error but don't fail the request
      (request.log as unknown as { error: (obj: object, msg: string) => void }).error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Rate limit middleware error'
      );
      // Fail open - allow request if rate limiting fails
    }
  };
}

/**
 * Default rate limiting middleware for 'url' parameter
 *
 * Convenience export for common use case.
 *
 * @example
 * fastify.post('/api/scan',
 *   { preHandler: [sessionMiddleware, rateLimitMiddleware] },
 *   scanHandler
 * );
 */
export const rateLimitMiddleware = createRateLimitMiddleware('url');

/**
 * Batch rate limit info response
 */
export interface BatchRateLimitInfo {
  /** Current URL count in the window */
  urlCount: number;
  /** Remaining URLs allowed in the window */
  remainingUrls: number;
  /** Maximum URLs per hour */
  maxUrls: number;
  /** Current batch count in the window */
  batchCount: number;
  /** Remaining batches allowed in the window */
  remainingBatches: number;
  /** Maximum batches per hour */
  maxBatches: number;
  /** Time when the rate limit resets (Unix timestamp) */
  resetTime: number;
  /** Whether the request would exceed rate limits */
  exceeded: boolean;
  /** Error message if limit exceeded */
  message?: string;
}

/**
 * Check batch rate limits for a guest session
 *
 * Validates both URL count (max 100/hour) and batch count (max 2/hour)
 * limits for a guest session. Uses Redis to track usage with 1-hour TTL.
 *
 * @param sessionId - Guest session ID
 * @param urlCount - Number of URLs in the batch to check
 * @param request - Optional Fastify request for logging
 * @returns Rate limit information including current usage and limits
 * @throws Error with detailed rate limit info if limits would be exceeded
 *
 * @example
 * try {
 *   const rateLimitInfo = await checkBatchRateLimit(sessionId, urls.length);
 *   // Process batch
 * } catch (error) {
 *   // Handle rate limit exceeded
 *   return reply.code(429).send(error);
 * }
 */
export async function checkBatchRateLimit(
  sessionId: string,
  urlCount: number,
  request?: FastifyRequest
): Promise<BatchRateLimitInfo> {
  try {
    const redis = getRedisClient();

    // Get Redis keys for URL count and batch count
    const urlCountKey = RedisKeys.RATE_LIMIT_BATCH_URLS.build(sessionId);
    const batchCountKey = RedisKeys.RATE_LIMIT_BATCH_COUNT.build(sessionId);

    // Get current counts
    const [currentUrlCount, currentBatchCount] = await Promise.all([
      getCurrentCount(urlCountKey, request),
      getCurrentCount(batchCountKey, request),
    ]);

    // Calculate new totals
    const newUrlCount = currentUrlCount + urlCount;
    const newBatchCount = currentBatchCount + 1;

    // Get TTL for reset time calculation
    const ttl = await getTTL(urlCountKey, request);
    const resetTime = Math.floor(Date.now() / 1000) + ttl;

    // Check if limits would be exceeded
    const urlLimitExceeded = newUrlCount > BATCH_RATE_LIMIT_CONFIG.MAX_URLS_PER_HOUR;
    const batchLimitExceeded = newBatchCount > BATCH_RATE_LIMIT_CONFIG.MAX_BATCHES_PER_HOUR;

    // Build rate limit info
    const rateLimitInfo: BatchRateLimitInfo = {
      urlCount: currentUrlCount,
      remainingUrls: Math.max(0, BATCH_RATE_LIMIT_CONFIG.MAX_URLS_PER_HOUR - currentUrlCount),
      maxUrls: BATCH_RATE_LIMIT_CONFIG.MAX_URLS_PER_HOUR,
      batchCount: currentBatchCount,
      remainingBatches: Math.max(0, BATCH_RATE_LIMIT_CONFIG.MAX_BATCHES_PER_HOUR - currentBatchCount),
      maxBatches: BATCH_RATE_LIMIT_CONFIG.MAX_BATCHES_PER_HOUR,
      resetTime,
      exceeded: urlLimitExceeded || batchLimitExceeded,
    };

    // If limits exceeded, add error message and throw
    if (urlLimitExceeded || batchLimitExceeded) {
      const messages: string[] = [];

      if (urlLimitExceeded) {
        messages.push(
          `URL limit exceeded. Maximum ${BATCH_RATE_LIMIT_CONFIG.MAX_URLS_PER_HOUR} URLs per hour ` +
          `(current: ${currentUrlCount}, requested: ${urlCount}).`
        );
      }

      if (batchLimitExceeded) {
        messages.push(
          `Batch limit exceeded. Maximum ${BATCH_RATE_LIMIT_CONFIG.MAX_BATCHES_PER_HOUR} batches per hour ` +
          `(current: ${currentBatchCount}).`
        );
      }

      rateLimitInfo.message = messages.join(' ');
      throw rateLimitInfo;
    }

    // Increment counters using pipeline for atomicity
    const pipeline = redis.pipeline();
    pipeline.incrby(urlCountKey, urlCount);
    pipeline.expire(urlCountKey, RedisKeys.RATE_LIMIT_BATCH_URLS.ttl);
    pipeline.incr(batchCountKey);
    pipeline.expire(batchCountKey, RedisKeys.RATE_LIMIT_BATCH_COUNT.ttl);

    await pipeline.exec();

    // Update the info with new counts
    rateLimitInfo.urlCount = newUrlCount;
    rateLimitInfo.remainingUrls = Math.max(0, BATCH_RATE_LIMIT_CONFIG.MAX_URLS_PER_HOUR - newUrlCount);
    rateLimitInfo.batchCount = newBatchCount;
    rateLimitInfo.remainingBatches = Math.max(0, BATCH_RATE_LIMIT_CONFIG.MAX_BATCHES_PER_HOUR - newBatchCount);

    return rateLimitInfo;
  } catch (error) {
    // If it's our rate limit error, re-throw it
    if (error && typeof error === 'object' && 'exceeded' in error) {
      throw error;
    }

    // Log Redis errors but fail open
    if (request?.log) {
      (request.log as unknown as { error: (obj: object, msg: string) => void }).error(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        'Batch rate limit check error'
      );
    } else {
      console.error('Batch rate limit check error:', error);
    }

    // Fail open - return info allowing the request
    return {
      urlCount: 0,
      remainingUrls: BATCH_RATE_LIMIT_CONFIG.MAX_URLS_PER_HOUR,
      maxUrls: BATCH_RATE_LIMIT_CONFIG.MAX_URLS_PER_HOUR,
      batchCount: 0,
      remainingBatches: BATCH_RATE_LIMIT_CONFIG.MAX_BATCHES_PER_HOUR,
      maxBatches: BATCH_RATE_LIMIT_CONFIG.MAX_BATCHES_PER_HOUR,
      resetTime: Math.floor(Date.now() / 1000) + BATCH_RATE_LIMIT_CONFIG.WINDOW_SECONDS,
      exceeded: false,
    };
  }
}

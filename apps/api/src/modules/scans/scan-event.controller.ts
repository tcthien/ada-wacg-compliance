/**
 * Scan Event Controller
 *
 * Fastify route handlers for scan event operations.
 * Provides real-time event streaming for scan progress monitoring.
 */

import type {
  FastifyInstance,
  FastifyRequest,
  FastifyReply,
  preHandlerHookHandler,
} from 'fastify';
import { z } from 'zod';
import { getEvents, ScanEventServiceError } from './scan-event.service.js';
import { getEventsQuerySchema } from './scan-event.schema.js';
import { getScanById } from './scan.repository.js';
import { sessionMiddleware } from '../../shared/middleware/session.js';
import { getRedisClient } from '../../config/redis.js';

/**
 * Events rate limit configuration
 * Limits polling requests to prevent abuse
 */
const EVENTS_RATE_LIMIT = {
  /** Maximum requests per minute */
  MAX_REQUESTS: 100,
  /** Window duration in seconds (1 minute) */
  WINDOW_SECONDS: 60,
} as const;

/**
 * Get client IP address from request
 */
function getClientIP(request: FastifyRequest): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = typeof forwarded === 'string' ? forwarded.split(',') : forwarded;
    return ips[0]?.trim() || request.ip;
  }
  return request.ip;
}

/**
 * Events rate limiting middleware
 *
 * Limits requests to 100 per minute per IP address.
 * Designed for polling endpoints that may be called frequently.
 *
 * Features:
 * - Redis-based counter with 1-minute TTL
 * - Standard rate limit headers
 * - 429 response when exceeded
 * - Graceful degradation if Redis unavailable
 */
export const eventsRateLimitMiddleware: preHandlerHookHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const redis = getRedisClient();
    const ip = getClientIP(request);
    const key = `events_rate_limit:${ip}`;

    // Get current count
    const countStr = await redis.get(key);
    const currentCount = countStr ? parseInt(countStr, 10) : 0;

    if (currentCount >= EVENTS_RATE_LIMIT.MAX_REQUESTS) {
      // Get TTL for Retry-After
      const ttl = await redis.ttl(key);
      const retryAfter = ttl > 0 ? ttl : EVENTS_RATE_LIMIT.WINDOW_SECONDS;

      // Set headers
      reply.header('X-RateLimit-Limit', EVENTS_RATE_LIMIT.MAX_REQUESTS.toString());
      reply.header('X-RateLimit-Remaining', '0');
      reply.header('Retry-After', retryAfter.toString());

      return reply.code(429).send({
        success: false,
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Maximum ${EVENTS_RATE_LIMIT.MAX_REQUESTS} requests per minute.`,
        code: 'RATE_LIMITED',
        retryAfter,
      });
    }

    // Increment count atomically
    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, EVENTS_RATE_LIMIT.WINDOW_SECONDS);
    await pipeline.exec();

    // Set headers for remaining requests
    const remaining = EVENTS_RATE_LIMIT.MAX_REQUESTS - currentCount - 1;
    reply.header('X-RateLimit-Limit', EVENTS_RATE_LIMIT.MAX_REQUESTS.toString());
    reply.header('X-RateLimit-Remaining', Math.max(0, remaining).toString());
  } catch (error) {
    // Fail open - allow request if Redis unavailable
    console.error('Events rate limit error:', error);
  }
};

/**
 * Route parameter schema for scan ID
 */
const scanIdParamSchema = z.object({
  scanId: z.string().uuid('Invalid scan ID format'),
});

/**
 * Type for scan ID params
 */
type ScanIdParams = z.infer<typeof scanIdParamSchema>;

/**
 * Type for events query
 */
type EventsQuery = z.infer<typeof getEventsQuerySchema>;

/**
 * GET /api/v1/scans/:scanId/events
 *
 * Get scan events for console display.
 *
 * Middleware chain:
 * 1. session - Creates/retrieves guest session
 * 2. handler - Returns events with polling support
 *
 * Authorization:
 * - Guest users can only see events for their own scans (non-adminOnly)
 * - Admin users can see all events including adminOnly
 *
 * @param request - Fastify request with scanId param and query options
 * @param reply - Fastify reply
 * @returns Events with lastTimestamp for polling
 *
 * @example
 * GET /api/v1/scans/abc-123/events?limit=50
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "events": [
 *       {
 *         "id": "event-123",
 *         "type": "FETCH",
 *         "level": "INFO",
 *         "message": "Fetching page...",
 *         "createdAt": "2024-01-01T00:00:00.000Z"
 *       }
 *     ],
 *     "lastTimestamp": "2024-01-01T00:00:00.000Z",
 *     "hasMore": false
 *   }
 * }
 *
 * @example
 * GET /api/v1/scans/abc-123/events?since=2024-01-01T00:00:00.000Z
 * (Polling for new events)
 */
async function getEventsHandler(
  request: FastifyRequest<{ Params: ScanIdParams; Querystring: EventsQuery }>,
  reply: FastifyReply
) {
  try {
    // 1. Validate params
    const params = scanIdParamSchema.parse(request.params);

    // 2. Validate query params
    const query = getEventsQuerySchema.parse(request.query);

    // 3. Check if user is admin
    const isAdmin = !!request.adminUser;

    // 4. If not admin, verify scan ownership
    if (!isAdmin) {
      // Check session exists
      if (!request.guestSession) {
        return reply.code(401).send({
          success: false,
          error: 'Unauthorized',
          message: 'Valid session required',
          code: 'SESSION_REQUIRED',
        });
      }

      // Get scan to verify ownership
      const scan = await getScanById(params.scanId);

      if (!scan) {
        return reply.code(404).send({
          success: false,
          error: 'Scan not found',
          code: 'SCAN_NOT_FOUND',
        });
      }

      // Verify ownership
      if (scan.guestSessionId !== request.guestSession.id) {
        return reply.code(403).send({
          success: false,
          error: 'Forbidden',
          message: 'You do not have access to this scan',
          code: 'FORBIDDEN',
        });
      }
    }

    // 5. Get events from service
    const result = await getEvents(params.scanId, {
      limit: query.limit,
      since: query.since,
      isAdmin,
    });

    // 6. Format response
    return reply.code(200).send({
      success: true,
      data: {
        events: result.events.map((event) => ({
          id: event.id,
          type: event.type,
          level: event.level,
          message: event.message,
          metadata: event.metadata,
          createdAt: event.createdAt.toISOString(),
        })),
        lastTimestamp: result.lastTimestamp,
        hasMore: result.hasMore,
      },
    });
  } catch (error) {
    // Handle service errors
    if (error instanceof ScanEventServiceError) {
      const statusCode = getStatusCodeForEventError(error.code);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid request parameters',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in getEventsHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * Map scan event service error codes to HTTP status codes
 */
function getStatusCodeForEventError(code: string): number {
  switch (code) {
    case 'GET_EVENTS_FAILED':
      return 500;
    case 'ARCHIVE_FAILED':
      return 500;
    default:
      return 500;
  }
}

/**
 * Register scan event routes
 *
 * @param fastify - Fastify instance
 * @param prefix - API prefix (e.g., '/api/v1')
 */
export async function registerScanEventRoutes(
  fastify: FastifyInstance,
  prefix: string
): Promise<void> {
  // GET /api/v1/scans/:scanId/events - Get scan events
  // Middleware: session → rateLimit → handler
  fastify.get(
    `${prefix}/scans/:scanId/events`,
    {
      preHandler: [sessionMiddleware, eventsRateLimitMiddleware],
    },
    getEventsHandler as any
  );

  fastify.log.info('✅ Scan event routes registered');
}

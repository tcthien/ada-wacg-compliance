/**
 * Scan Event Service
 *
 * Business logic layer for scan event operations.
 * Handles event logging, retrieval, caching, and archival.
 */

import { getPrismaClient } from '../../config/database.js';
import { getRedisClient } from '../../config/redis.js';
import { RedisKeys } from '../../shared/constants/redis-keys.js';
import { Prisma } from '@prisma/client';
import type {
  CreateScanEventInput,
  GetEventsOptions,
  GetEventsResponse,
  ScanEventType,
  LogLevel,
  EventSummary,
} from './scan-event.types.js';
import type { ScanEvent } from '@prisma/client';

/**
 * Scan Event Service Error
 */
export class ScanEventServiceError extends Error {
  public readonly code: string;
  public override readonly cause?: Error | undefined;

  constructor(message: string, code: string, cause?: Error | undefined) {
    super(message);
    this.name = 'ScanEventServiceError';
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Log a new scan event
 *
 * 1. Writes event to database (primary storage)
 * 2. Appends event to Redis cache (for real-time retrieval)
 * 3. Handles errors gracefully (logs but doesn't throw)
 *
 * @param input - Event data to log
 * @returns Created event or null if failed
 *
 * @example
 * ```typescript
 * await logEvent({
 *   scanId: 'abc-123',
 *   type: 'FETCH',
 *   level: 'INFO',
 *   message: 'Fetching page: https://example.com',
 *   metadata: { url: 'https://example.com' },
 *   adminOnly: false
 * });
 * ```
 */
export async function logEvent(
  input: CreateScanEventInput
): Promise<ScanEvent | null> {
  try {
    const prisma = getPrismaClient();
    const redis = getRedisClient();

    // Create event in database
    const event = await prisma.scanEvent.create({
      data: {
        scanId: input.scanId,
        type: input.type,
        level: input.level ?? 'INFO',
        message: input.message,
        metadata: input.metadata
          ? (input.metadata as Prisma.InputJsonValue)
          : Prisma.DbNull,
        adminOnly: input.adminOnly ?? false,
      },
    });

    // Cache event in Redis for real-time retrieval
    try {
      const cacheKey = RedisKeys.SCAN_EVENTS.build(input.scanId);
      const eventJson = JSON.stringify({
        id: event.id,
        scanId: event.scanId,
        type: event.type,
        level: event.level,
        message: event.message,
        metadata: event.metadata,
        adminOnly: event.adminOnly,
        createdAt: event.createdAt.toISOString(),
      });

      // Use RPUSH to append to list, then set TTL if new list
      await redis.rpush(cacheKey, eventJson);
      await redis.expire(cacheKey, RedisKeys.SCAN_EVENTS.ttl);
    } catch (cacheError) {
      // Log cache error but don't fail - database is primary storage
      console.error(
        '⚠️ ScanEventService: Failed to cache event:',
        cacheError
      );
    }

    return event;
  } catch (error) {
    // Log error but don't throw - event logging should not break scans
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ ScanEventService: Failed to log event:', err.message);
    return null;
  }
}

/**
 * Get events for a scan
 *
 * 1. Tries Redis cache first for performance
 * 2. Falls back to database on cache miss
 * 3. Filters adminOnly events based on isAdmin flag
 *
 * @param scanId - Scan ID to get events for
 * @param options - Query options (limit, since, isAdmin)
 * @returns Events response with pagination info
 *
 * @example
 * ```typescript
 * const events = await getEvents('abc-123', {
 *   limit: 50,
 *   isAdmin: false
 * });
 * ```
 */
export async function getEvents(
  scanId: string,
  options: GetEventsOptions = {}
): Promise<GetEventsResponse> {
  const { limit = 100, since, isAdmin = false } = options;

  try {
    const prisma = getPrismaClient();
    const redis = getRedisClient();
    const cacheKey = RedisKeys.SCAN_EVENTS.build(scanId);

    let events: ScanEvent[] = [];
    let cacheHit = false;

    // Try Redis cache first
    try {
      const cachedEvents = await redis.lrange(cacheKey, 0, -1);

      if (cachedEvents && cachedEvents.length > 0) {
        cacheHit = true;
        events = cachedEvents.map((eventJson) => {
          const parsed = JSON.parse(eventJson) as {
            id: string;
            scanId: string;
            type: ScanEventType;
            level: LogLevel;
            message: string;
            metadata: Record<string, unknown> | null;
            adminOnly: boolean;
            createdAt: string;
          };
          return {
            id: parsed.id,
            scanId: parsed.scanId,
            type: parsed.type,
            level: parsed.level,
            message: parsed.message,
            metadata: parsed.metadata,
            adminOnly: parsed.adminOnly,
            createdAt: new Date(parsed.createdAt),
          } as ScanEvent;
        });

        // Log cache hit for admin visibility (Task 9 will enhance this)
        if (isAdmin) {
          console.debug(`🔵 ScanEventService: Cache HIT for ${cacheKey}`);
        }
      }
    } catch (cacheError) {
      console.error('⚠️ ScanEventService: Redis cache error:', cacheError);
    }

    // Cache miss - query database
    if (!cacheHit) {
      if (isAdmin) {
        console.debug(`🟡 ScanEventService: Cache MISS for ${cacheKey}`);
      }

      events = await prisma.scanEvent.findMany({
        where: {
          scanId,
          ...(since ? { createdAt: { gt: since } } : {}),
        },
        orderBy: { createdAt: 'asc' },
      });

      // Repopulate cache with fresh data
      if (events.length > 0) {
        try {
          const pipeline = redis.pipeline();
          pipeline.del(cacheKey);

          for (const event of events) {
            const eventJson = JSON.stringify({
              id: event.id,
              scanId: event.scanId,
              type: event.type,
              level: event.level,
              message: event.message,
              metadata: event.metadata,
              adminOnly: event.adminOnly,
              createdAt: event.createdAt.toISOString(),
            });
            pipeline.rpush(cacheKey, eventJson);
          }

          pipeline.expire(cacheKey, RedisKeys.SCAN_EVENTS.ttl);
          await pipeline.exec();
        } catch (cacheError) {
          console.error(
            '⚠️ ScanEventService: Failed to repopulate cache:',
            cacheError
          );
        }
      }
    }

    // Filter by timestamp if since is provided (for cached results)
    if (since && cacheHit) {
      events = events.filter((e) => e.createdAt > since);
    }

    // Filter adminOnly events for non-admin users
    if (!isAdmin) {
      events = events.filter((e) => !e.adminOnly);
    }

    // Apply limit and check for more
    const hasMore = events.length > limit;
    const limitedEvents = events.slice(0, limit);

    // Get last timestamp for polling
    const lastEvent = limitedEvents[limitedEvents.length - 1];
    const lastTimestamp = lastEvent
      ? lastEvent.createdAt.toISOString()
      : null;

    return {
      events: limitedEvents,
      lastTimestamp,
      hasMore,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ ScanEventService: Failed to get events:', err.message);
    throw new ScanEventServiceError(
      'Failed to get scan events',
      'GET_EVENTS_FAILED',
      err
    );
  }
}

/**
 * Get events since a specific timestamp (for polling)
 *
 * Optimized for polling - only returns new events since last poll.
 *
 * @param scanId - Scan ID to get events for
 * @param since - Only return events after this timestamp
 * @param isAdmin - Include admin-only events
 * @returns Array of new events
 *
 * @example
 * ```typescript
 * const newEvents = await getEventsSince(
 *   'abc-123',
 *   new Date('2024-01-01T00:00:00Z'),
 *   false
 * );
 * ```
 */
export async function getEventsSince(
  scanId: string,
  since: Date,
  isAdmin: boolean = false
): Promise<ScanEvent[]> {
  const result = await getEvents(scanId, { since, isAdmin });
  return result.events;
}

/**
 * Archive old events for a scan
 *
 * 1. Aggregates event summary into Scan.eventSummary
 * 2. Deletes events older than specified date
 * 3. Returns count of deleted events
 *
 * @param olderThan - Delete events older than this date
 * @returns Number of deleted events
 *
 * @example
 * ```typescript
 * const thirtyDaysAgo = new Date();
 * thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
 * const deleted = await archiveOldEvents(thirtyDaysAgo);
 * console.log(`Archived ${deleted} events`);
 * ```
 */
export async function archiveOldEvents(olderThan: Date): Promise<number> {
  try {
    const prisma = getPrismaClient();

    // Find all scans with events older than the threshold
    const scansWithOldEvents = await prisma.scan.findMany({
      where: {
        events: {
          some: {
            createdAt: { lt: olderThan },
          },
        },
      },
      select: {
        id: true,
        events: {
          where: {
            createdAt: { lt: olderThan },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    let totalDeleted = 0;

    for (const scan of scansWithOldEvents) {
      if (scan.events.length === 0) continue;

      // Build event summary
      const summary: EventSummary = {
        totalEvents: scan.events.length,
        eventsByType: {} as Record<ScanEventType, number>,
        eventsByLevel: {} as Record<LogLevel, number>,
        firstEventAt: scan.events[0]!.createdAt.toISOString(),
        lastEventAt: scan.events[scan.events.length - 1]!.createdAt.toISOString(),
        milestones: [],
      };

      // Count by type and level
      for (const event of scan.events) {
        const eventType = event.type as ScanEventType;
        const logLevel = event.level as LogLevel;

        summary.eventsByType[eventType] =
          (summary.eventsByType[eventType] ?? 0) + 1;
        summary.eventsByLevel[logLevel] =
          (summary.eventsByLevel[logLevel] ?? 0) + 1;

        // Capture key milestones
        if (
          event.type === 'INIT' ||
          event.type === 'RESULT' ||
          event.type === 'ERROR'
        ) {
          summary.milestones.push({
            type: eventType,
            message: event.message,
            timestamp: event.createdAt.toISOString(),
          });
        }
      }

      // Update scan with summary and delete old events
      await prisma.$transaction([
        prisma.scan.update({
          where: { id: scan.id },
          data: { eventSummary: summary as unknown as Prisma.InputJsonValue },
        }),
        prisma.scanEvent.deleteMany({
          where: {
            scanId: scan.id,
            createdAt: { lt: olderThan },
          },
        }),
      ]);

      totalDeleted += scan.events.length;
    }

    console.log(
      `✅ ScanEventService: Archived ${totalDeleted} events from ${scansWithOldEvents.length} scans`
    );

    return totalDeleted;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(
      '❌ ScanEventService: Failed to archive events:',
      err.message
    );
    throw new ScanEventServiceError(
      'Failed to archive old events',
      'ARCHIVE_FAILED',
      err
    );
  }
}

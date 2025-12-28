/**
 * Scan Event Service for Worker
 *
 * Provides event logging functionality for the worker process.
 * This is a worker-side implementation that uses the worker's Prisma and Redis clients.
 *
 * Note: This duplicates the API service implementation to avoid cross-app imports
 * which cause TypeScript rootDir issues. Both implementations should be kept in sync.
 */

import { Prisma } from '@prisma/client';
import type { ScanEvent } from '@prisma/client';
import { getPrismaClient } from '../config/prisma.js';
import { getRedisClient } from '../config/redis.js';

/**
 * Scan Event Types
 */
export type ScanEventType = 'INIT' | 'QUEUE' | 'FETCH' | 'ANALYSIS' | 'RESULT' | 'ERROR' | 'DEBUG';

/**
 * Log Levels
 */
export type LogLevel = 'DEBUG' | 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

/**
 * Create Scan Event Input
 */
export interface CreateScanEventInput {
  scanId: string;
  type: ScanEventType;
  level?: LogLevel;
  message: string;
  metadata?: Record<string, unknown>;
  adminOnly?: boolean;
}

/**
 * Redis key pattern for scan events
 * TTL: 24 hours (events are persisted in DB)
 */
const SCAN_EVENTS_KEY = {
  build: (scanId: string) => `scan:${scanId}:events`,
  ttl: 86400, // 24 hours
};

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
      const cacheKey = SCAN_EVENTS_KEY.build(input.scanId);
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
      await redis.expire(cacheKey, SCAN_EVENTS_KEY.ttl);
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
 * Export a convenient singleton-style interface
 */
export const scanEventService = {
  logEvent,
};

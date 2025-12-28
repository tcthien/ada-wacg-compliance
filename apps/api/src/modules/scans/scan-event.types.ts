import type { ScanEvent as PrismaScanEvent } from '@prisma/client';

/**
 * Scan event types for categorizing log entries
 * Matches the ScanEventType enum in Prisma schema
 */
export type ScanEventType =
  | 'INIT'
  | 'QUEUE'
  | 'FETCH'
  | 'ANALYSIS'
  | 'RESULT'
  | 'ERROR'
  | 'DEBUG';

/**
 * Log levels for scan events
 * Matches the LogLevel enum in Prisma schema
 */
export type LogLevel = 'DEBUG' | 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

/**
 * Scan event entity type from Prisma
 */
export type ScanEvent = PrismaScanEvent;

/**
 * Input for creating a new scan event
 *
 * @property scanId - UUID of the scan this event belongs to
 * @property type - Category of the event (INIT, QUEUE, FETCH, etc.)
 * @property level - Severity level (DEBUG, INFO, SUCCESS, WARNING, ERROR)
 * @property message - Human-readable event message
 * @property metadata - Optional JSON metadata for additional context
 * @property adminOnly - If true, event is only visible to admin users
 *
 * @example
 * ```ts
 * const input: CreateScanEventInput = {
 *   scanId: 'abc-123-def-456',
 *   type: 'FETCH',
 *   level: 'INFO',
 *   message: 'Fetching page: https://example.com',
 *   metadata: { url: 'https://example.com' },
 *   adminOnly: false
 * };
 * ```
 */
export interface CreateScanEventInput {
  /** UUID of the scan this event belongs to */
  scanId: string;
  /** Category of the event */
  type: ScanEventType;
  /** Severity level of the event */
  level?: LogLevel;
  /** Human-readable event message (max 500 chars) */
  message: string;
  /** Optional JSON metadata for additional context */
  metadata?: Record<string, unknown>;
  /** If true, event is only visible to admin users */
  adminOnly?: boolean;
}

/**
 * Options for retrieving scan events
 *
 * @property limit - Maximum number of events to return
 * @property since - Only return events created after this timestamp
 * @property isAdmin - If true, include admin-only events
 *
 * @example
 * ```ts
 * const options: GetEventsOptions = {
 *   limit: 50,
 *   since: new Date('2024-01-01'),
 *   isAdmin: false
 * };
 * ```
 */
export interface GetEventsOptions {
  /** Maximum number of events to return (default: 100) */
  limit?: number;
  /** Only return events created after this timestamp */
  since?: Date;
  /** If true, include admin-only events (default: false) */
  isAdmin?: boolean;
}

/**
 * Response type for get events API endpoint
 *
 * @property events - Array of scan events
 * @property lastTimestamp - Timestamp of the most recent event (for polling)
 * @property hasMore - True if there are more events available
 */
export interface GetEventsResponse {
  /** Array of scan events */
  events: ScanEvent[];
  /** ISO timestamp of the most recent event (for polling) */
  lastTimestamp: string | null;
  /** True if there are more events beyond the limit */
  hasMore: boolean;
}

/**
 * Type guard to check if a value is a valid ScanEventType
 *
 * @param value - Value to check
 * @returns True if value is a valid ScanEventType
 */
export function isScanEventType(value: unknown): value is ScanEventType {
  return (
    typeof value === 'string' &&
    ['INIT', 'QUEUE', 'FETCH', 'ANALYSIS', 'RESULT', 'ERROR', 'DEBUG'].includes(
      value
    )
  );
}

/**
 * Type guard to check if a value is a valid LogLevel
 *
 * @param value - Value to check
 * @returns True if value is a valid LogLevel
 */
export function isLogLevel(value: unknown): value is LogLevel {
  return (
    typeof value === 'string' &&
    ['DEBUG', 'INFO', 'SUCCESS', 'WARNING', 'ERROR'].includes(value)
  );
}

/**
 * Event summary type for archived event data
 * Stored in Scan.eventSummary after cleanup
 */
export interface EventSummary {
  /** Total number of events that were archived */
  totalEvents: number;
  /** Count of events by type */
  eventsByType: Record<ScanEventType, number>;
  /** Count of events by level */
  eventsByLevel: Record<LogLevel, number>;
  /** Timestamp of first event */
  firstEventAt: string;
  /** Timestamp of last event */
  lastEventAt: string;
  /** Key milestones from the scan */
  milestones: Array<{
    type: ScanEventType;
    message: string;
    timestamp: string;
  }>;
}

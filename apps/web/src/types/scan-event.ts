/**
 * Frontend types for scan events and real-time logging
 *
 * These types match the API response structure from the backend
 * scan event endpoints and are used for type-safe event handling
 * in frontend components.
 */

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
 * Scan event entity
 * Represents a single event/log entry from a scan
 */
export interface ScanEvent {
  /** Unique identifier for the event */
  id: string;
  /** UUID of the parent scan */
  scanId: string;
  /** Event type/category */
  type: ScanEventType;
  /** Severity level */
  level: LogLevel;
  /** Human-readable message */
  message: string;
  /** Additional metadata */
  metadata: Record<string, unknown> | null;
  /** Whether this event is admin-only */
  adminOnly: boolean;
  /** Timestamp when event was created */
  createdAt: string;
}

/**
 * Response type for get events API endpoint
 * Used for polling and fetching scan events
 *
 * @property events - Array of scan events ordered by creation time
 * @property lastTimestamp - ISO timestamp of the most recent event (for polling)
 * @property hasMore - True if there are more events beyond the limit
 */
export interface GetEventsResponse {
  /** Array of scan events ordered by creation time (oldest first) */
  events: ScanEvent[];
  /** ISO timestamp of the most recent event (for polling) */
  lastTimestamp: string | null;
  /** True if there are more events beyond the limit */
  hasMore: boolean;
}

/**
 * Options for retrieving scan events
 * Used as query parameters for the events API
 *
 * @property limit - Maximum number of events to return
 * @property since - Only return events created after this timestamp
 */
export interface GetEventsOptions {
  /** Maximum number of events to return (default: 100, max: 200) */
  limit?: number;
  /** ISO timestamp - only return events created after this time */
  since?: string;
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
  /** ISO timestamp of first event */
  firstEventAt: string;
  /** ISO timestamp of last event */
  lastEventAt: string;
  /** Key milestones from the scan */
  milestones: Array<{
    type: ScanEventType;
    message: string;
    timestamp: string;
  }>;
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

import { z } from 'zod';

/**
 * Zod schema for scan event types
 * Categorizes different phases of the scan process
 */
export const scanEventTypeSchema = z.enum(
  ['INIT', 'QUEUE', 'FETCH', 'ANALYSIS', 'RESULT', 'ERROR', 'DEBUG'],
  {
    errorMap: () => ({
      message:
        'Event type must be INIT, QUEUE, FETCH, ANALYSIS, RESULT, ERROR, or DEBUG',
    }),
  }
);

/**
 * Zod schema for log levels
 * Indicates severity/importance of scan events
 */
export const logLevelSchema = z.enum(
  ['DEBUG', 'INFO', 'SUCCESS', 'WARNING', 'ERROR'],
  {
    errorMap: () => ({
      message: 'Log level must be DEBUG, INFO, SUCCESS, WARNING, or ERROR',
    }),
  }
);

/**
 * Schema for creating a new scan event
 *
 * Validates:
 * - scanId format (UUID)
 * - Event type and log level enums
 * - Message length constraints
 * - Optional metadata as JSON object
 * - adminOnly flag for restricted visibility
 *
 * @example
 * ```ts
 * const event = {
 *   scanId: 'abc-123-def-456',
 *   type: 'FETCH',
 *   level: 'INFO',
 *   message: 'Fetching page: https://example.com',
 *   metadata: { url: 'https://example.com' },
 *   adminOnly: false
 * };
 * createScanEventSchema.parse(event);
 * ```
 */
export const createScanEventSchema = z.object({
  /**
   * UUID of the scan this event belongs to
   */
  scanId: z.string().uuid('Invalid scan ID format'),

  /**
   * Category of the event
   */
  type: scanEventTypeSchema,

  /**
   * Severity level of the event
   * Defaults to INFO if not specified
   */
  level: logLevelSchema.default('INFO'),

  /**
   * Human-readable event message
   * Maximum 500 characters
   */
  message: z
    .string({
      required_error: 'Message is required',
      invalid_type_error: 'Message must be a string',
    })
    .min(1, 'Message cannot be empty')
    .max(500, 'Message must be 500 characters or less'),

  /**
   * Optional JSON metadata for additional context
   * Can contain any structured data relevant to the event
   */
  metadata: z.record(z.unknown()).optional(),

  /**
   * If true, event is only visible to admin users
   * Defaults to false
   */
  adminOnly: z.boolean().default(false),
});

/**
 * Schema for query parameters when fetching scan events
 *
 * Validates:
 * - limit (optional, 1-200)
 * - since (optional, ISO timestamp for polling)
 *
 * @example
 * ```ts
 * const query = {
 *   limit: '50',
 *   since: '2024-01-01T00:00:00.000Z'
 * };
 * getEventsQuerySchema.parse(query);
 * ```
 */
export const getEventsQuerySchema = z.object({
  /**
   * Maximum number of events to return
   * Defaults to 100, max 200
   */
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 100))
    .pipe(
      z
        .number()
        .min(1, 'Limit must be at least 1')
        .max(200, 'Limit must be 200 or less')
    ),

  /**
   * ISO timestamp - only return events created after this time
   * Used for polling to get new events
   */
  since: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined))
    .pipe(z.date().optional()),
});

/**
 * Schema for scan event response
 * Used to validate event data returned from the API
 */
export const scanEventResponseSchema = z.object({
  /**
   * Unique identifier for the event
   */
  id: z.string().uuid(),

  /**
   * UUID of the parent scan
   */
  scanId: z.string().uuid(),

  /**
   * Event type/category
   */
  type: scanEventTypeSchema,

  /**
   * Severity level
   */
  level: logLevelSchema,

  /**
   * Human-readable message
   */
  message: z.string(),

  /**
   * Additional metadata
   */
  metadata: z.record(z.unknown()).nullable(),

  /**
   * Whether this event is admin-only
   */
  adminOnly: z.boolean(),

  /**
   * Timestamp when event was created
   */
  createdAt: z.date(),
});

/**
 * Schema for get events response
 * Includes pagination info for polling
 */
export const getEventsResponseSchema = z.object({
  /**
   * Array of scan events
   */
  events: z.array(scanEventResponseSchema),

  /**
   * ISO timestamp of the most recent event
   * Used for subsequent polling requests
   */
  lastTimestamp: z.string().nullable(),

  /**
   * True if there are more events beyond the limit
   */
  hasMore: z.boolean(),
});

/**
 * Type inference from Zod schemas
 */
export type CreateScanEventInput = z.infer<typeof createScanEventSchema>;
export type GetEventsQuery = z.infer<typeof getEventsQuerySchema>;
export type ScanEventResponse = z.infer<typeof scanEventResponseSchema>;
export type GetEventsResponse = z.infer<typeof getEventsResponseSchema>;

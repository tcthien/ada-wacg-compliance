import { z } from 'zod';
import { WcagLevelSchema } from '../scans/scan.schema.js';

/**
 * Zod schema for batch scan status values
 * Tracks the lifecycle of a batch scan from creation to completion, failure, or cancellation
 */
export const BatchStatusSchema = z.enum(
  ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'STALE'],
  {
    errorMap: () => ({
      message:
        'Status must be PENDING, RUNNING, COMPLETED, FAILED, CANCELLED, or STALE',
    }),
  },
);

/**
 * Schema for creating a new batch scan request
 *
 * Validates:
 * - Array of 1-50 URLs (RFC 3986 compliant, HTTP/HTTPS only)
 * - WCAG conformance level
 * - reCAPTCHA token for spam prevention
 *
 * Requirements:
 * - 1.2: System SHALL accept 1-50 URLs in a single batch request
 * - 1.3: System SHALL validate all URLs before creating scan jobs
 * - 1.7: System SHALL validate URLs are well-formed (RFC 3986 compliant)
 * - 1.8: System SHALL reject batches containing 0 or >50 URLs
 *
 * @example
 * ```ts
 * const request = {
 *   urls: [
 *     'https://example.com',
 *     'https://example.com/about',
 *     'https://example.com/contact'
 *   ],
 *   wcagLevel: 'AA',
 *   recaptchaToken: 'abc123...'
 * };
 * CreateBatchRequestSchema.parse(request);
 * ```
 */
export const CreateBatchRequestSchema = z.object({
  /**
   * Array of URLs to scan for accessibility issues
   * Must contain 1-50 valid HTTP/HTTPS URLs
   */
  urls: z
    .array(
      z
        .string({
          required_error: 'URL is required',
          invalid_type_error: 'URL must be a string',
        })
        .url('Invalid URL format')
        .refine(
          (url) => {
            try {
              const parsed = new URL(url);
              return parsed.protocol === 'http:' || parsed.protocol === 'https:';
            } catch {
              return false;
            }
          },
          { message: 'URL must use HTTP or HTTPS protocol' },
        )
        .transform((url) => {
          // Normalize URL by trimming whitespace
          return url.trim();
        }),
      {
        required_error: 'URLs array is required',
        invalid_type_error: 'URLs must be an array',
      },
    )
    .min(1, 'At least 1 URL is required')
    .max(50, 'Maximum 50 URLs allowed per batch')
    .refine(
      (urls) => {
        // Check for duplicate URLs (case-insensitive)
        const normalized = urls.map((url) => url.toLowerCase());
        const uniqueUrls = new Set(normalized);
        return uniqueUrls.size === urls.length;
      },
      { message: 'Duplicate URLs are not allowed' },
    ),

  /**
   * Target WCAG conformance level for all scans in the batch
   * Defaults to AA (most common requirement)
   */
  wcagLevel: WcagLevelSchema.default('AA'),

  /**
   * reCAPTCHA v3 token for spam prevention
   * Required for all guest batch scan requests
   */
  recaptchaToken: z.string({
    required_error: 'reCAPTCHA token is required',
    invalid_type_error: 'reCAPTCHA token must be a string',
  }),

  /**
   * Email address for AI scan report delivery
   * Required when aiEnabled is true
   */
  email: z
    .string()
    .transform((email) => email.trim().toLowerCase())
    .pipe(z.string().email('Invalid email format'))
    .optional(),

  /**
   * Enable AI-powered validation for scan results
   * When enabled, email is required for report delivery
   */
  aiEnabled: z.boolean().optional(),
}).refine(
  (data) => {
    // Email is required when AI validation is enabled
    if (data.aiEnabled === true && !data.email) {
      return false;
    }
    return true;
  },
  {
    message: 'Email is required when AI validation is enabled',
    path: ['email'],
  },
);

/**
 * Schema for batch scan status response
 *
 * Returns current batch status, progress, and metadata
 * Used for polling batch progress and completion
 *
 * @example
 * ```ts
 * const status = {
 *   id: 'batch_abc123',
 *   status: 'RUNNING',
 *   homepageUrl: 'https://example.com',
 *   totalUrls: 10,
 *   completedCount: 7,
 *   failedCount: 1,
 *   progress: 80,
 *   wcagLevel: 'AA',
 *   createdAt: new Date(),
 *   completedAt: null
 * };
 * ```
 */
export const BatchStatusResponseSchema = z.object({
  /**
   * Unique identifier for the batch scan
   * Format: UUID
   */
  id: z.string().uuid(),

  /**
   * Current status of the batch scan
   */
  status: BatchStatusSchema,

  /**
   * Homepage URL that was used to discover/batch these scans
   */
  homepageUrl: z.string().url(),

  /**
   * Total number of URLs in the batch
   */
  totalUrls: z.number().int().min(1),

  /**
   * Number of scans completed successfully
   */
  completedCount: z.number().int().min(0),

  /**
   * Number of scans that failed
   */
  failedCount: z.number().int().min(0),

  /**
   * Progress percentage (0-100)
   * Calculated as (completedCount + failedCount) / totalUrls * 100
   */
  progress: z.number().min(0).max(100),

  /**
   * Target WCAG conformance level
   */
  wcagLevel: WcagLevelSchema,

  /**
   * Timestamp when batch was created
   */
  createdAt: z.date(),

  /**
   * Timestamp when batch completed (all scans finished)
   * Null for pending/running batches
   */
  completedAt: z.date().nullable(),

  /**
   * Timestamp when batch was cancelled
   * Null for non-cancelled batches
   */
  cancelledAt: z.date().nullable(),
});

/**
 * Schema for batch scan results response
 *
 * Returns complete batch results including aggregate statistics
 * Only available for COMPLETED batches
 *
 * @example
 * ```ts
 * const results = {
 *   id: 'batch_abc123',
 *   status: 'COMPLETED',
 *   homepageUrl: 'https://example.com',
 *   totalUrls: 10,
 *   completedCount: 9,
 *   failedCount: 1,
 *   wcagLevel: 'AA',
 *   totalIssues: 42,
 *   criticalCount: 5,
 *   seriousCount: 12,
 *   moderateCount: 20,
 *   minorCount: 5,
 *   createdAt: new Date(),
 *   completedAt: new Date()
 * };
 * ```
 */
export const BatchResultsResponseSchema = z.object({
  /**
   * Unique identifier for the batch scan
   */
  id: z.string().uuid(),

  /**
   * Current status of the batch scan
   * Must be COMPLETED to have aggregate results
   */
  status: BatchStatusSchema,

  /**
   * Homepage URL that was used to discover/batch these scans
   */
  homepageUrl: z.string().url(),

  /**
   * Target WCAG conformance level
   */
  wcagLevel: WcagLevelSchema,

  /**
   * Total number of URLs in the batch
   */
  totalUrls: z.number().int().min(1),

  /**
   * Number of scans completed successfully
   */
  completedCount: z.number().int().min(0),

  /**
   * Number of scans that failed
   */
  failedCount: z.number().int().min(0),

  /**
   * Aggregate total issues found across all completed scans
   * Null for incomplete batches
   */
  totalIssues: z.number().int().min(0).nullable(),

  /**
   * Aggregate critical issues found across all completed scans
   * Null for incomplete batches
   */
  criticalCount: z.number().int().min(0).nullable(),

  /**
   * Aggregate serious issues found across all completed scans
   * Null for incomplete batches
   */
  seriousCount: z.number().int().min(0).nullable(),

  /**
   * Aggregate moderate issues found across all completed scans
   * Null for incomplete batches
   */
  moderateCount: z.number().int().min(0).nullable(),

  /**
   * Aggregate minor issues found across all completed scans
   * Null for incomplete batches
   */
  minorCount: z.number().int().min(0).nullable(),

  /**
   * Timestamp when batch was created
   */
  createdAt: z.date(),

  /**
   * Timestamp when batch completed
   * Null for incomplete batches
   */
  completedAt: z.date().nullable(),

  /**
   * Link to individual scan results
   * Array of scan IDs that can be used to fetch detailed results
   */
  scanIds: z.array(z.string().uuid()).optional(),
});

/**
 * Schema for pagination parameters
 *
 * Used for paginated batch listing endpoints
 *
 * @example
 * ```ts
 * const params = {
 *   page: 1,
 *   limit: 20
 * };
 * PaginationSchema.parse(params);
 * ```
 */
export const PaginationSchema = z.object({
  /**
   * Page number (1-indexed)
   * Defaults to 1
   */
  page: z
    .number()
    .int()
    .min(1, 'Page must be at least 1')
    .default(1)
    .or(
      z
        .string()
        .regex(/^\d+$/, 'Page must be a positive integer')
        .transform((val) => parseInt(val, 10))
        .pipe(z.number().int().min(1)),
    ),

  /**
   * Number of items per page
   * Defaults to 20, max 100
   */
  limit: z
    .number()
    .int()
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .default(20)
    .or(
      z
        .string()
        .regex(/^\d+$/, 'Limit must be a positive integer')
        .transform((val) => parseInt(val, 10))
        .pipe(z.number().int().min(1).max(100)),
    ),
});

/**
 * Schema for batch listing response
 *
 * Returns paginated list of batch scans with metadata
 *
 * @example
 * ```ts
 * const response = {
 *   batches: [
 *     { id: 'batch_1', status: 'COMPLETED', ... },
 *     { id: 'batch_2', status: 'RUNNING', ... }
 *   ],
 *   pagination: {
 *     page: 1,
 *     limit: 20,
 *     totalItems: 42,
 *     totalPages: 3
 *   }
 * };
 * ```
 */
export const BatchListResponseSchema = z.object({
  /**
   * Array of batch scan status objects
   */
  batches: z.array(BatchStatusResponseSchema),

  /**
   * Pagination metadata
   */
  pagination: z.object({
    /**
     * Current page number
     */
    page: z.number().int().min(1),

    /**
     * Items per page
     */
    limit: z.number().int().min(1).max(100),

    /**
     * Total number of items across all pages
     */
    totalItems: z.number().int().min(0),

    /**
     * Total number of pages
     */
    totalPages: z.number().int().min(0),
  }),
});

/**
 * Schema for validating batch ID parameters
 * Used in route parameter validation
 */
export const BatchIdParamSchema = z.object({
  /**
   * Batch ID from route parameter
   * Must be a valid UUID
   */
  id: z.string().uuid('Invalid batch ID format'),
});

/**
 * Type exports for use in controllers and services
 */
export type CreateBatchRequest = z.infer<typeof CreateBatchRequestSchema>;
export type BatchStatusResponse = z.infer<typeof BatchStatusResponseSchema>;
export type BatchResultsResponse = z.infer<typeof BatchResultsResponseSchema>;
export type Pagination = z.infer<typeof PaginationSchema>;
export type BatchListResponse = z.infer<typeof BatchListResponseSchema>;
export type BatchIdParam = z.infer<typeof BatchIdParamSchema>;

import { z } from 'zod';

/**
 * Zod schema for WCAG conformance levels
 * Validates that the level is one of the three standard WCAG conformance levels
 */
export const WcagLevelSchema = z.enum(['A', 'AA', 'AAA'], {
  errorMap: () => ({ message: 'WCAG level must be A, AA, or AAA' }),
});

/**
 * Zod schema for scan status values
 * Tracks the lifecycle of a scan from creation to completion or failure
 */
export const ScanStatusSchema = z.enum(
  ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED'],
  {
    errorMap: () => ({
      message: 'Status must be PENDING, RUNNING, COMPLETED, or FAILED',
    }),
  },
);

/**
 * Zod schema for issue impact/severity levels
 * Maps to axe-core impact levels for consistency
 */
export const IssueImpactSchema = z.enum(
  ['CRITICAL', 'SERIOUS', 'MODERATE', 'MINOR'],
  {
    errorMap: () => ({
      message: 'Impact must be CRITICAL, SERIOUS, MODERATE, or MINOR',
    }),
  },
);

/**
 * Schema for creating a new scan request
 *
 * Validates:
 * - URL format and protocol (HTTP/HTTPS only)
 * - Email format (optional, but required when AI validation is enabled)
 * - WCAG conformance level
 * - reCAPTCHA token for spam prevention
 * - AI validation flag (optional)
 *
 * @example
 * ```ts
 * const request = {
 *   url: 'https://example.com',
 *   email: 'user@example.com',
 *   wcagLevel: 'AA',
 *   recaptchaToken: 'abc123...',
 *   aiEnabled: true
 * };
 * CreateScanRequestSchema.parse(request);
 * ```
 */
export const CreateScanRequestSchema = z
  .object({
    /**
     * Target URL to scan for accessibility issues
     * Must be a valid HTTP or HTTPS URL
     */
    url: z
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

    /**
     * Email address for scan report delivery
     * Optional - if not provided, user must check status manually
     * Required when aiEnabled is true
     */
    email: z
      .string()
      .transform((email) => {
        // Normalize email by trimming and lowercasing
        return email.trim().toLowerCase();
      })
      .pipe(z.string().email('Invalid email format'))
      .optional(),

    /**
     * Target WCAG conformance level for the scan
     * Defaults to AA (most common requirement)
     */
    wcagLevel: WcagLevelSchema.default('AA'),

    /**
     * reCAPTCHA v3 token for spam prevention
     * Required when APP_ENV=prod, optional when APP_ENV=local
     */
    recaptchaToken: z
      .string({
        invalid_type_error: 'reCAPTCHA token must be a string',
      })
      .optional(),

    /**
     * Enable AI-powered validation for scan results
     * When enabled, email is required for report delivery
     */
    aiEnabled: z.boolean().optional(),
  })
  .refine(
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
 * Schema for scan response data
 *
 * Returns the created scan entity with all metadata
 * Status will be PENDING immediately after creation
 *
 * @example
 * ```ts
 * const response = {
 *   id: 'scan_abc123',
 *   url: 'https://example.com',
 *   status: 'PENDING',
 *   wcagLevel: 'AA',
 *   createdAt: new Date()
 * };
 * ```
 */
export const ScanResponseSchema = z.object({
  /**
   * Unique identifier for the scan
   * Format: scan_[nanoid]
   */
  id: z.string(),

  /**
   * Guest session ID if created by a guest user
   * Null for authenticated user scans
   */
  guestSessionId: z.string().nullable(),

  /**
   * User ID if created by an authenticated user
   * Null for guest scans
   */
  userId: z.string().nullable(),

  /**
   * URL being scanned (normalized)
   */
  url: z.string().url(),

  /**
   * Email for report delivery
   */
  email: z.string().email(),

  /**
   * Current status of the scan
   */
  status: ScanStatusSchema,

  /**
   * Target WCAG conformance level
   */
  wcagLevel: WcagLevelSchema,

  /**
   * Scan duration in milliseconds
   * Null until scan completes
   */
  durationMs: z.number().nullable(),

  /**
   * Error message if scan failed
   * Null for successful scans
   */
  errorMessage: z.string().nullable(),

  /**
   * Timestamp when scan was created
   */
  createdAt: z.date(),

  /**
   * Timestamp when scan completed
   * Null for pending/running scans
   */
  completedAt: z.date().nullable(),
});

/**
 * Schema for scan status check response
 *
 * Returns current scan status and basic metadata
 * Used for polling scan progress
 *
 * @example
 * ```ts
 * const status = {
 *   id: 'scan_abc123',
 *   status: 'RUNNING',
 *   progress: 45,
 *   createdAt: new Date()
 * };
 * ```
 */
export const ScanStatusResponseSchema = z.object({
  /**
   * Scan identifier
   */
  id: z.string(),

  /**
   * Current scan status
   */
  status: ScanStatusSchema,

  /**
   * Optional progress percentage (0-100)
   * Only available for RUNNING scans with progress tracking
   */
  progress: z.number().min(0).max(100).optional(),

  /**
   * Error message if scan failed
   */
  errorMessage: z.string().nullable(),

  /**
   * Timestamp when scan was created
   */
  createdAt: z.date(),

  /**
   * Timestamp when scan completed
   */
  completedAt: z.date().nullable(),

  /**
   * Link to full scan results
   * Only available for COMPLETED scans
   */
  resultsUrl: z.string().url().optional(),
});

/**
 * Schema for validating scan ID parameters
 * Used in route parameter validation
 */
export const ScanIdParamSchema = z.object({
  /**
   * Scan ID from route parameter
   * Must be a valid UUID
   */
  id: z
    .string()
    .uuid('Invalid scan ID format'),
});

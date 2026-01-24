import { z } from 'zod';

/**
 * Zod schema for AI campaign status enum values
 * Matches the AiCampaignStatus enum from Prisma schema
 */
export const AiCampaignStatusSchema = z.enum(
  ['ACTIVE', 'PAUSED', 'DEPLETED', 'ENDED'],
  {
    errorMap: () => ({
      message: 'Status must be ACTIVE, PAUSED, DEPLETED, or ENDED',
    }),
  },
);

/**
 * Zod schema for AI scan status enum values
 * Tracks the lifecycle of AI processing for individual scans
 */
export const AiStatusSchema = z.enum(
  ['PENDING', 'DOWNLOADED', 'PROCESSING', 'COMPLETED', 'FAILED'],
  {
    errorMap: () => ({
      message:
        'Status must be PENDING, DOWNLOADED, PROCESSING, COMPLETED, or FAILED',
    }),
  },
);

/**
 * Schema for updating an AI campaign
 *
 * Validates campaign updates by administrators including budget adjustments
 * and status changes. All fields are optional for partial updates.
 *
 * Requirements:
 * - REQ-3: Campaign Quota Management
 * - REQ-8: Admin Dashboard - AI Campaign Monitoring
 *
 * @example
 * ```ts
 * const updates = {
 *   totalTokenBudget: 100000,
 *   avgTokensPerScan: 5500,
 *   status: 'PAUSED'
 * };
 * updateCampaignSchema.parse(updates);
 * ```
 */
export const updateCampaignSchema = z.object({
  /**
   * Update total token budget for the campaign
   * Optional - must be positive integer
   * Used for adding tokens to extend campaign capacity
   */
  totalTokenBudget: z
    .number({
      invalid_type_error: 'Total token budget must be a number',
    })
    .int('Total token budget must be an integer')
    .positive('Total token budget must be positive')
    .optional(),

  /**
   * Update average tokens per scan estimate
   * Optional - used to calculate remaining slots
   * Must be positive integer between 1000 and 50000
   */
  avgTokensPerScan: z
    .number({
      invalid_type_error: 'Average tokens per scan must be a number',
    })
    .int('Average tokens per scan must be an integer')
    .min(1000, 'Average tokens per scan must be at least 1000')
    .max(50000, 'Average tokens per scan cannot exceed 50000')
    .optional(),

  /**
   * Update campaign status
   * Optional - requires admin permission to change
   * Cannot transition directly from DEPLETED to ACTIVE
   */
  status: AiCampaignStatusSchema.optional(),
});

/**
 * Schema for AI scan list filters
 *
 * Used for filtering AI scan queue in the admin panel
 * Supports status filtering, date range filtering, and cursor-based pagination
 *
 * Requirements:
 * - REQ-4: AI Scan Queue Management
 * - REQ-8: Admin Dashboard - AI Campaign Monitoring
 *
 * @example
 * ```ts
 * const filters = {
 *   status: ['PENDING', 'DOWNLOADED'],
 *   dateFrom: new Date('2025-01-01'),
 *   dateTo: new Date('2025-01-31'),
 *   cursor: 'scan_uuid',
 *   limit: 50
 * };
 * aiScanFiltersSchema.parse(filters);
 * ```
 */
export const aiScanFiltersSchema = z.object({
  /**
   * Filter by AI processing status
   * Optional - array of status values to include
   * Multiple statuses can be specified for OR filtering
   */
  status: z
    .array(AiStatusSchema, {
      invalid_type_error: 'Status must be an array of valid AI status values',
    })
    .min(1, 'At least one status must be specified')
    .optional(),

  /**
   * Filter by date range - start date (inclusive)
   * Optional - coerced from ISO date string to Date object
   */
  dateFrom: z
    .coerce
    .date({
      invalid_type_error: 'Date from must be a valid date',
    })
    .optional(),

  /**
   * Filter by date range - end date (inclusive)
   * Optional - coerced from ISO date string to Date object
   */
  dateTo: z
    .coerce
    .date({
      invalid_type_error: 'Date to must be a valid date',
    })
    .optional(),

  /**
   * Cursor for pagination
   * Optional - scan ID to start from (for cursor-based pagination)
   * Must be a valid UUID if provided
   */
  cursor: z
    .string()
    .uuid('Cursor must be a valid UUID')
    .optional(),

  /**
   * Number of items to return
   * Optional - defaults to 20, max 100
   */
  limit: z
    .coerce
    .number({
      invalid_type_error: 'Limit must be a number',
    })
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .default(20),
});

/**
 * Schema for CSV import row validation
 *
 * Validates each row in the AI results CSV import file
 * Used by operator to upload locally-processed AI enhancements
 *
 * Requirements:
 * - REQ-4: AI Scan Queue Management
 * - REQ-5: AI Enhancement Storage
 *
 * @example
 * ```ts
 * const row = {
 *   scan_id: '550e8400-e29b-41d4-a716-446655440000',
 *   ai_summary: 'Executive summary of accessibility issues...',
 *   ai_remediation_plan: '1. Fix critical contrast issues...',
 *   ai_issues_json: '{"issue-1": {...}}',
 *   tokens_used: 4500,
 *   ai_model: 'claude-3-opus-20240229',
 *   processing_time: 45
 * };
 * csvImportRowSchema.parse(row);
 * ```
 */
export const csvImportRowSchema = z.object({
  /**
   * Scan ID from the exported CSV
   * Must be a valid UUID matching an existing scan with aiEnabled=true
   */
  scan_id: z
    .string({
      required_error: 'Scan ID is required',
      invalid_type_error: 'Scan ID must be a string',
    })
    .uuid('Scan ID must be a valid UUID'),

  /**
   * AI-generated executive summary
   * Required - 10-10000 characters
   * Plain text summary for stakeholders
   */
  ai_summary: z
    .string({
      required_error: 'AI summary is required',
      invalid_type_error: 'AI summary must be a string',
    })
    .min(10, 'AI summary must be at least 10 characters')
    .max(10000, 'AI summary cannot exceed 10000 characters'),

  /**
   * AI-generated remediation roadmap
   * Required - 10-50000 characters
   * Prioritized fix plan with time estimates
   */
  ai_remediation_plan: z
    .string({
      required_error: 'AI remediation plan is required',
      invalid_type_error: 'AI remediation plan must be a string',
    })
    .min(10, 'AI remediation plan must be at least 10 characters')
    .max(50000, 'AI remediation plan cannot exceed 50000 characters'),

  /**
   * AI-enhanced issues in JSON format
   * Required - valid JSON object mapping issue IDs to AI enhancements
   * Must match the issue IDs from the original scan
   */
  ai_issues_json: z
    .string({
      required_error: 'AI issues JSON is required',
      invalid_type_error: 'AI issues JSON must be a string',
    })
    .refine(
      (val) => {
        try {
          const parsed = JSON.parse(val);
          return typeof parsed === 'object' && parsed !== null;
        } catch {
          return false;
        }
      },
      { message: 'AI issues JSON must be valid JSON object' },
    ),

  /**
   * Total tokens consumed for this AI processing
   * Required - non-negative integer less than 100000 (0 allowed for cached results)
   * Sum of input tokens + output tokens
   */
  tokens_used: z
    .number({
      required_error: 'Tokens used is required',
      invalid_type_error: 'Tokens used must be a number',
    })
    .int('Tokens used must be an integer')
    .nonnegative('Tokens used must be zero or positive')
    .max(100000, 'Tokens used cannot exceed 100000'),

  /**
   * AI model identifier used for processing
   * Required - non-empty string, max 50 characters
   * Example: 'claude-3-opus-20240229'
   */
  ai_model: z
    .string({
      required_error: 'AI model is required',
      invalid_type_error: 'AI model must be a string',
    })
    .min(1, 'AI model cannot be empty')
    .max(50, 'AI model cannot exceed 50 characters'),

  /**
   * Processing time in seconds
   * Required - non-negative integer, max 3600 (1 hour)
   * Time taken to complete AI analysis
   */
  processing_time: z
    .number({
      required_error: 'Processing time is required',
      invalid_type_error: 'Processing time must be a number',
    })
    .int('Processing time must be an integer')
    .min(0, 'Processing time must be non-negative')
    .max(3600, 'Processing time cannot exceed 3600 seconds'),

  /**
   * AI-verified WCAG criteria in JSON format
   * Optional - valid JSON array of criteria verifications
   * Contains AI assessments of WCAG criteria that cannot be fully automated
   */
  ai_criteria_verifications_json: z
    .string({
      invalid_type_error: 'AI criteria verifications JSON must be a string',
    })
    .refine(
      (val) => {
        if (!val) return true; // Optional field
        try {
          const parsed = JSON.parse(val);
          return Array.isArray(parsed);
        } catch {
          return false;
        }
      },
      { message: 'AI criteria verifications JSON must be a valid JSON array' },
    )
    .optional(),
});

/**
 * Type exports for use in controllers and services
 */
export type AiCampaignStatus = z.infer<typeof AiCampaignStatusSchema>;
export type AiStatus = z.infer<typeof AiStatusSchema>;
export type UpdateCampaignRequest = z.infer<typeof updateCampaignSchema>;
export type AiScanFilters = z.infer<typeof aiScanFiltersSchema>;
export type CsvImportRow = z.infer<typeof csvImportRowSchema>;

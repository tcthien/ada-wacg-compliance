import type { AiStatus, AiCampaignStatus } from '@prisma/client';

/**
 * AI Campaign Module Type Definitions
 *
 * This module provides type definitions for the AI early bird scan campaign system.
 * All types follow the project's type-safety patterns and integrate with Prisma schema.
 */

/**
 * Campaign status response with real-time availability information
 *
 * Provides campaign status, slot availability, and urgency indicators.
 * Used for displaying campaign status to users and making reservation decisions.
 *
 * @property active - Whether the campaign is currently active and accepting scans
 * @property slotsRemaining - Number of slots still available for reservation
 * @property totalSlots - Total slots allocated for the campaign
 * @property percentRemaining - Percentage of slots remaining (0-100)
 * @property urgencyLevel - Visual urgency indicator for UI display
 * @property message - Human-readable status message
 *
 * @example
 * ```ts
 * const status: CampaignStatusResponse = {
 *   active: true,
 *   slotsRemaining: 50,
 *   totalSlots: 1000,
 *   percentRemaining: 5,
 *   urgencyLevel: 'final',
 *   message: 'Only 50 free AI scans remaining!'
 * };
 * ```
 */
export interface CampaignStatusResponse {
  /** Whether the campaign is currently active */
  active: boolean;
  /** Number of slots still available */
  slotsRemaining: number;
  /** Total slots allocated for campaign */
  totalSlots: number;
  /** Percentage of slots remaining (0-100) */
  percentRemaining: number;
  /** Visual urgency indicator for UI */
  urgencyLevel: 'normal' | 'limited' | 'almost_gone' | 'final' | 'depleted';
  /** Human-readable status message */
  message: string;
}

/**
 * Result of attempting to reserve a campaign slot
 *
 * Indicates whether slot reservation succeeded and provides context.
 * Used for quota management and user feedback during scan creation.
 *
 * @property reserved - Whether the slot was successfully reserved
 * @property slotsRemaining - Number of slots remaining after reservation
 * @property reason - Reason code for reservation result
 *
 * @example
 * ```ts
 * const result: SlotReservationResult = {
 *   reserved: true,
 *   slotsRemaining: 499,
 *   reason: 'success'
 * };
 * ```
 */
export interface SlotReservationResult {
  /** Whether the slot was successfully reserved */
  reserved: boolean;
  /** Number of slots remaining after reservation */
  slotsRemaining: number;
  /** Reason code for reservation result */
  reason?: 'success' | 'quota_depleted' | 'campaign_inactive';
}

/**
 * Campaign metrics and statistics
 *
 * Comprehensive metrics for campaign monitoring and reporting.
 * Used by admin dashboard and campaign analytics endpoints.
 *
 * @property totalTokenBudget - Total tokens allocated for campaign
 * @property usedTokens - Tokens consumed so far
 * @property remainingTokens - Tokens still available
 * @property percentUsed - Percentage of token budget consumed (0-100)
 * @property reservedSlots - Number of slots reserved
 * @property completedScans - Number of successfully completed AI scans
 * @property failedScans - Number of failed AI scans
 * @property pendingScans - Number of scans awaiting processing
 * @property avgTokensPerScan - Average tokens consumed per scan
 * @property projectedSlotsRemaining - Estimated slots remaining based on current usage
 * @property campaignStatus - Current campaign status
 * @property startsAt - Campaign start time
 * @property endsAt - Campaign end time
 *
 * @example
 * ```ts
 * const metrics: CampaignMetrics = {
 *   totalTokenBudget: 100000,
 *   usedTokens: 45000,
 *   remainingTokens: 55000,
 *   percentUsed: 45,
 *   reservedSlots: 500,
 *   completedScans: 450,
 *   failedScans: 10,
 *   pendingScans: 40,
 *   avgTokensPerScan: 100,
 *   projectedSlotsRemaining: 550,
 *   campaignStatus: 'ACTIVE',
 *   startsAt: new Date('2025-01-01'),
 *   endsAt: new Date('2025-02-01')
 * };
 * ```
 */
export interface CampaignMetrics {
  /** Total tokens allocated for campaign */
  totalTokenBudget: number;
  /** Tokens consumed so far */
  usedTokens: number;
  /** Tokens still available */
  remainingTokens: number;
  /** Percentage of token budget consumed (0-100) */
  percentUsed: number;
  /** Number of slots reserved */
  reservedSlots: number;
  /** Number of successfully completed AI scans */
  completedScans: number;
  /** Number of failed AI scans */
  failedScans: number;
  /** Number of scans awaiting processing */
  pendingScans: number;
  /** Average tokens consumed per scan */
  avgTokensPerScan: number;
  /** Estimated slots remaining based on current usage */
  projectedSlotsRemaining: number;
  /** Current campaign status */
  campaignStatus: AiCampaignStatus;
  /** Campaign start time */
  startsAt: Date;
  /** Campaign end time */
  endsAt: Date;
}

/**
 * Input for updating campaign configuration
 *
 * All fields are optional for partial updates.
 * Used by admin endpoints to modify campaign parameters.
 *
 * @property name - Campaign name/title
 * @property totalTokenBudget - Total token budget allocation
 * @property avgTokensPerScan - Average tokens expected per scan
 * @property status - Campaign status
 * @property startsAt - Campaign start time
 * @property endsAt - Campaign end time
 *
 * @example
 * ```ts
 * const update: UpdateCampaignData = {
 *   status: 'PAUSED',
 *   totalTokenBudget: 150000,
 *   endsAt: new Date('2025-03-01')
 * };
 * ```
 */
export interface UpdateCampaignData {
  /** Campaign name/title */
  name?: string;
  /** Total token budget allocation */
  totalTokenBudget?: number;
  /** Average tokens expected per scan */
  avgTokensPerScan?: number;
  /** Campaign status */
  status?: AiCampaignStatus;
  /** Campaign start time */
  startsAt?: Date;
  /** Campaign end time */
  endsAt?: Date;
}

/**
 * Filters for querying AI scans
 *
 * Supports filtering by status, date range, and pagination.
 * Used for admin scan listing and analytics queries.
 *
 * @property status - Filter by one or more AI scan statuses
 * @property dateFrom - Filter scans created on or after this date
 * @property dateTo - Filter scans created on or before this date
 * @property cursor - Pagination cursor (scan ID)
 * @property limit - Maximum number of results (default: 50)
 *
 * @example
 * ```ts
 * const filters: AiScanFilters = {
 *   status: ['COMPLETED', 'FAILED'],
 *   dateFrom: new Date('2025-01-01'),
 *   dateTo: new Date('2025-01-31'),
 *   limit: 100
 * };
 * ```
 */
export interface AiScanFilters {
  /** Filter by one or more AI scan statuses */
  status?: AiStatus[];
  /** Filter scans created on or after this date */
  dateFrom?: Date;
  /** Filter scans created on or before this date */
  dateTo?: Date;
  /** Pagination cursor (scan ID) */
  cursor?: string;
  /** Maximum number of results (default: 50) */
  limit?: number;
}

/**
 * Result of importing AI scan results
 *
 * Provides detailed feedback on import operation success and failures.
 * Used for bulk import operations and admin reporting.
 *
 * @property success - Whether the import operation succeeded overall
 * @property processed - Number of scans successfully processed
 * @property failed - Number of scans that failed to import
 * @property errors - Array of error details for failed scans
 * @property tokensDeducted - Total tokens deducted from campaign budget
 *
 * @example
 * ```ts
 * const result: ImportResult = {
 *   success: true,
 *   processed: 95,
 *   failed: 5,
 *   errors: [
 *     { scanId: 'scan_123', error: 'Invalid format' },
 *     { scanId: 'scan_456', error: 'Missing required field' }
 *   ],
 *   tokensDeducted: 9500
 * };
 * ```
 */
export interface ImportResult {
  /** Whether the import operation succeeded overall */
  success: boolean;
  /** Number of scans successfully processed */
  processed: number;
  /** Number of scans that failed to import */
  failed: number;
  /** Array of error details for failed scans */
  errors: Array<{ scanId: string; error: string }>;
  /** Total tokens deducted from campaign budget */
  tokensDeducted: number;
}

/**
 * Type guard to check if a value is a valid AiStatus
 *
 * @param value - Value to check
 * @returns True if value is a valid AiStatus
 *
 * @example
 * ```ts
 * if (isAiStatus(input)) {
 *   // TypeScript knows input is a valid AiStatus
 *   console.log(`Valid AI status: ${input}`);
 * }
 * ```
 */
export function isAiStatus(value: unknown): value is AiStatus {
  return (
    typeof value === 'string' &&
    (value === 'PENDING' ||
      value === 'DOWNLOADED' ||
      value === 'PROCESSING' ||
      value === 'COMPLETED' ||
      value === 'FAILED')
  );
}

/**
 * Type guard to check if a value is a valid AiCampaignStatus
 *
 * @param value - Value to check
 * @returns True if value is a valid AiCampaignStatus
 *
 * @example
 * ```ts
 * if (isAiCampaignStatus(input)) {
 *   // TypeScript knows input is a valid AiCampaignStatus
 *   console.log(`Valid campaign status: ${input}`);
 * }
 * ```
 */
export function isAiCampaignStatus(value: unknown): value is AiCampaignStatus {
  return (
    typeof value === 'string' &&
    (value === 'ACTIVE' ||
      value === 'PAUSED' ||
      value === 'DEPLETED' ||
      value === 'ENDED')
  );
}

/**
 * Type guard to check if a value is a valid urgency level
 *
 * @param value - Value to check
 * @returns True if value is a valid urgency level
 *
 * @example
 * ```ts
 * if (isUrgencyLevel(input)) {
 *   // TypeScript knows input is a valid urgency level
 *   console.log(`Valid urgency level: ${input}`);
 * }
 * ```
 */
export function isUrgencyLevel(
  value: unknown
): value is 'normal' | 'limited' | 'almost_gone' | 'final' | 'depleted' {
  return (
    typeof value === 'string' &&
    (value === 'normal' ||
      value === 'limited' ||
      value === 'almost_gone' ||
      value === 'final' ||
      value === 'depleted')
  );
}

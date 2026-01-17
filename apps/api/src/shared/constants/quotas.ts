/**
 * Quota Constants
 *
 * Defines usage limits for different user tiers.
 * Currently implements free tier limits only.
 * Future subscription tiers will have higher limits.
 */

/**
 * Free tier quota limits
 *
 * These limits are designed to:
 * 1. Control AI costs ($0.10-0.20 per page)
 * 2. Prevent abuse
 * 3. Encourage upgrades to paid plans
 *
 * @see docs/quota-limits-specification.md for full documentation
 */
export const FREE_TIER_QUOTAS = {
  /** Maximum URLs per batch request */
  MAX_URLS_PER_BATCH: 5,

  /** Maximum AI-enabled URLs per batch */
  MAX_AI_URLS_PER_BATCH: 5,

  /** Maximum AI-enabled URLs per day per session */
  MAX_AI_URLS_PER_DAY: 10,
} as const;

/**
 * Type for quota limits
 */
export type QuotaLimits = typeof FREE_TIER_QUOTAS;

/**
 * Error codes for quota violations
 */
export const QUOTA_ERROR_CODES = {
  /** Batch URL limit exceeded */
  BATCH_SIZE_EXCEEDED: 'BATCH_SIZE_EXCEEDED',

  /** AI URLs per batch limit exceeded */
  AI_BATCH_LIMIT_EXCEEDED: 'AI_BATCH_LIMIT_EXCEEDED',

  /** Daily AI URL limit exceeded */
  DAILY_AI_LIMIT_EXCEEDED: 'DAILY_AI_LIMIT_EXCEEDED',
} as const;

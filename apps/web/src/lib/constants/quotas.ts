/**
 * Quota Constants (Frontend)
 *
 * Defines usage limits for different user tiers.
 * These values must match the backend constants in apps/api/src/shared/constants/quotas.ts
 *
 * @see docs/quota-limits-specification.md for full documentation
 */

/**
 * Free tier quota limits
 *
 * These limits are designed to:
 * 1. Control AI costs ($0.10-0.20 per page)
 * 2. Prevent abuse
 * 3. Encourage upgrades to paid plans
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
 * Quota error messages for user display
 */
export const QUOTA_ERROR_MESSAGES = {
  BATCH_SIZE_EXCEEDED: (current: number, max: number) =>
    `Maximum ${max} URLs allowed per batch. Please remove ${current - max} URL${current - max > 1 ? 's' : ''}.`,

  AI_BATCH_LIMIT_EXCEEDED: (current: number, max: number) =>
    `Maximum ${max} URLs allowed with AI enabled. Please disable AI or remove ${current - max} URL${current - max > 1 ? 's' : ''}.`,

  DAILY_AI_LIMIT_EXCEEDED: (used: number, max: number, remaining: number) =>
    `Daily AI limit reached (${used}/${max}). ${remaining > 0 ? `${remaining} AI scan${remaining > 1 ? 's' : ''} remaining today.` : 'Resets at midnight UTC.'}`,
} as const;

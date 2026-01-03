/**
 * AI Campaign Service
 *
 * Business logic layer for AI Campaign operations.
 * Handles quota management, slot calculations, and Redis caching.
 */

import { getRedisClient } from '../../config/redis.js';
import { RedisKeys } from '../../shared/constants/redis-keys.js';
import { getPrismaClient } from '../../config/database.js';
import {
  getActiveCampaign,
  updateCampaignTokens,
  getCampaignById,
  createAuditLog,
  AiCampaignRepositoryError,
} from './ai-campaign.repository.js';
import type {
  CampaignStatusResponse,
  SlotReservationResult,
  CampaignMetrics,
  UpdateCampaignData,
} from './ai-campaign.types.js';
import type { AiCampaign } from '@prisma/client';

/**
 * AI Campaign Service Error
 */
export class AiCampaignServiceError extends Error {
  public readonly code: string;
  public override readonly cause?: Error | undefined;

  constructor(message: string, code: string, cause?: Error | undefined) {
    super(message);
    this.name = 'AiCampaignServiceError';
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Redis cache key for campaign status
 */
const CAMPAIGN_STATUS_KEY = 'ai_campaign:status';

/**
 * Redis cache TTL: 5 minutes (300 seconds)
 */
const CAMPAIGN_STATUS_TTL = 300;

/**
 * Redis key for atomic slot reservation
 */
const AI_CAMPAIGN_SLOTS_KEY = 'ai:campaign:slots:available';

/**
 * Redis key for tracking reserved slots by scan ID
 * Pattern: ai:campaign:slot:{scanId}
 */
const AI_CAMPAIGN_SLOT_RESERVE_KEY = (scanId: string) => `ai:campaign:slot:${scanId}`;

/**
 * Reserved slot TTL: 30 minutes (1800 seconds)
 * Slots are automatically released if scan doesn't complete within this time
 */
const SLOT_RESERVATION_TTL = 1800;

/**
 * Lua script for atomic slot reservation
 * Returns: { reserved: 0|1, remaining: number }
 */
const RESERVE_SLOT_LUA = `
-- Key: ai:campaign:slots:available
-- Returns: { reserved: 0|1, remaining: number }
local available = tonumber(redis.call('GET', KEYS[1]) or '0')
if available > 0 then
  local remaining = redis.call('DECR', KEYS[1])
  return {1, remaining}
else
  return {0, 0}
end
`;

/**
 * Calculate remaining slots based on token budget and usage
 *
 * @param campaign - Campaign data
 * @returns Number of slots remaining
 *
 * @example
 * ```typescript
 * const campaign = { totalTokenBudget: 100000, usedTokens: 45000, avgTokensPerScan: 100 };
 * const remaining = calculateSlotsRemaining(campaign);
 * // Returns: 550 slots
 * ```
 */
function calculateSlotsRemaining(campaign: AiCampaign): number {
  const remainingTokens = campaign.totalTokenBudget - campaign.usedTokens;

  // Prevent division by zero
  if (campaign.avgTokensPerScan <= 0) {
    console.warn('⚠️  AI Campaign Service: avgTokensPerScan is zero or negative, returning 0 slots');
    return 0;
  }

  const slots = Math.floor(remainingTokens / campaign.avgTokensPerScan);
  return Math.max(0, slots); // Never return negative slots
}

/**
 * Initialize Redis slot counter from database
 *
 * Loads the current slot availability from the database and sets it in Redis.
 * This is called when the Redis key doesn't exist (cache miss).
 *
 * @returns Number of slots initialized, or null if no active campaign
 * @throws AiCampaignServiceError if initialization fails
 *
 * @example
 * ```typescript
 * const slots = await initializeRedisSlots();
 * console.log(`Initialized ${slots} slots in Redis`);
 * ```
 */
async function initializeRedisSlots(): Promise<number | null> {
  try {
    const redis = getRedisClient();

    // Get active campaign from database
    const campaign = await getActiveCampaign();

    if (!campaign) {
      console.log('ℹ️  AI Campaign Service: No active campaign found, cannot initialize Redis slots');
      return null;
    }

    // Calculate slots remaining
    const slotsRemaining = calculateSlotsRemaining(campaign);

    // Set in Redis with no expiration (persists until manually cleared)
    await redis.set(AI_CAMPAIGN_SLOTS_KEY, slotsRemaining.toString());

    console.log(
      `✅ AI Campaign Service: Initialized Redis slots - ` +
      `campaign=${campaign.name}, slots=${slotsRemaining}`
    );

    return slotsRemaining;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ AI Campaign Service: Failed to initialize Redis slots:', err.message);
    throw new AiCampaignServiceError(
      'Failed to initialize Redis slot counter',
      'REDIS_INIT_FAILED',
      err
    );
  }
}

/**
 * Calculate urgency level based on remaining quota percentage
 *
 * @param percentRemaining - Percentage of slots remaining (0-100)
 * @returns Urgency level indicator
 *
 * @example
 * ```typescript
 * calculateUrgencyLevel(25) // Returns: 'normal'
 * calculateUrgencyLevel(15) // Returns: 'limited'
 * calculateUrgencyLevel(7)  // Returns: 'almost_gone'
 * calculateUrgencyLevel(3)  // Returns: 'final'
 * calculateUrgencyLevel(0)  // Returns: 'depleted'
 * ```
 */
function calculateUrgencyLevel(
  percentRemaining: number
): 'normal' | 'limited' | 'almost_gone' | 'final' | 'depleted' {
  if (percentRemaining <= 0) {
    return 'depleted';
  } else if (percentRemaining < 5) {
    return 'final';
  } else if (percentRemaining < 10) {
    return 'almost_gone';
  } else if (percentRemaining < 20) {
    return 'limited';
  } else {
    return 'normal';
  }
}

/**
 * Generate human-readable status message based on urgency level
 *
 * @param urgencyLevel - Urgency level
 * @param slotsRemaining - Number of slots remaining
 * @returns Human-readable message
 */
function generateStatusMessage(
  urgencyLevel: 'normal' | 'limited' | 'almost_gone' | 'final' | 'depleted',
  slotsRemaining: number
): string {
  switch (urgencyLevel) {
    case 'depleted':
      return 'Campaign ended';
    case 'final':
      return 'Final slots available!';
    case 'almost_gone':
      return `Almost gone! Only ${slotsRemaining} left`;
    case 'limited':
      return `Limited slots! ${slotsRemaining} remaining`;
    case 'normal':
      return `${slotsRemaining} slots remaining`;
    default:
      return `${slotsRemaining} slots remaining`;
  }
}

/**
 * Get campaign status with availability information
 *
 * 1. Checks Redis cache first (5 min TTL)
 * 2. Falls back to database query if cache miss
 * 3. Calculates slots remaining based on token budget
 * 4. Determines urgency level based on quota percentage
 * 5. Caches the result for future requests
 *
 * @returns Campaign status or null if no active campaign
 * @throws AiCampaignServiceError if service error occurs
 *
 * @example
 * ```typescript
 * const status = await getCampaignStatus();
 * if (status) {
 *   console.log(`Campaign active: ${status.active}`);
 *   console.log(`Slots remaining: ${status.slotsRemaining}`);
 *   console.log(`Urgency: ${status.urgencyLevel}`);
 * }
 * ```
 */
export async function getCampaignStatus(): Promise<CampaignStatusResponse | null> {
  try {
    const redis = getRedisClient();

    // Try Redis cache first
    try {
      const cachedStatus = await redis.get(CAMPAIGN_STATUS_KEY);

      if (cachedStatus) {
        const status = JSON.parse(cachedStatus) as CampaignStatusResponse;
        console.log('✅ AI Campaign Service: Returning cached campaign status');
        return status;
      }
    } catch (error) {
      // Log cache error but continue to database query
      console.error('❌ AI Campaign Service: Redis cache error:', error);
    }

    // Cache miss - query database
    const campaign = await getActiveCampaign();

    if (!campaign) {
      console.log('ℹ️  AI Campaign Service: No active campaign found');
      return null;
    }

    // Calculate slots remaining
    const slotsRemaining = calculateSlotsRemaining(campaign);
    const totalSlots = Math.floor(campaign.totalTokenBudget / campaign.avgTokensPerScan);
    const percentRemaining = totalSlots > 0 ? Math.round((slotsRemaining / totalSlots) * 100) : 0;

    // Determine urgency level
    const urgencyLevel = calculateUrgencyLevel(percentRemaining);

    // Generate status message
    const message = generateStatusMessage(urgencyLevel, slotsRemaining);

    // Build response
    const status: CampaignStatusResponse = {
      active: campaign.status === 'ACTIVE' && slotsRemaining > 0,
      slotsRemaining,
      totalSlots,
      percentRemaining,
      urgencyLevel,
      message,
    };

    // Cache the result for future requests
    try {
      await redis.setex(
        CAMPAIGN_STATUS_KEY,
        CAMPAIGN_STATUS_TTL,
        JSON.stringify(status)
      );
      console.log('✅ AI Campaign Service: Cached campaign status for 5 minutes');
    } catch (error) {
      // Log cache error but don't fail the request
      console.error('❌ AI Campaign Service: Failed to cache campaign status:', error);
    }

    console.log(
      `✅ AI Campaign Service: Campaign status - ` +
      `active=${status.active}, slots=${slotsRemaining}, urgency=${urgencyLevel}`
    );

    return status;
  } catch (error) {
    // Re-throw AiCampaignServiceError as-is
    if (error instanceof AiCampaignServiceError) {
      throw error;
    }

    // Re-throw repository errors as service errors
    if (error instanceof AiCampaignRepositoryError) {
      throw new AiCampaignServiceError(error.message, error.code, error);
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ AI Campaign Service: Failed to get campaign status:', err.message);
    throw new AiCampaignServiceError(
      'Failed to get campaign status',
      'GET_STATUS_FAILED',
      err
    );
  }
}

/**
 * Reserve a campaign slot for a scan
 *
 * Checks if a slot is available and reserves it by incrementing token usage.
 * This is called when a scan starts AI processing.
 *
 * @param tokensToReserve - Number of tokens to reserve for this scan
 * @returns Reservation result with success status
 * @throws AiCampaignServiceError if service error occurs
 *
 * @example
 * ```typescript
 * const result = await reserveSlot(100);
 * if (result.reserved) {
 *   console.log(`Slot reserved! ${result.slotsRemaining} slots left`);
 * } else {
 *   console.log(`Reservation failed: ${result.reason}`);
 * }
 * ```
 */
export async function reserveSlot(tokensToReserve: number): Promise<SlotReservationResult> {
  try {
    if (!tokensToReserve || typeof tokensToReserve !== 'number' || tokensToReserve <= 0) {
      throw new AiCampaignServiceError(
        'Tokens to reserve must be a positive number',
        'INVALID_INPUT'
      );
    }

    // Get active campaign
    const campaign = await getActiveCampaign();

    if (!campaign) {
      return {
        reserved: false,
        slotsRemaining: 0,
        reason: 'campaign_inactive',
      };
    }

    // Check if quota is depleted
    const remainingTokens = campaign.totalTokenBudget - campaign.usedTokens;

    if (remainingTokens < tokensToReserve) {
      const slotsRemaining = calculateSlotsRemaining(campaign);
      console.warn(
        `⚠️  AI Campaign Service: Quota depleted - ` +
        `remaining=${remainingTokens}, required=${tokensToReserve}`
      );

      return {
        reserved: false,
        slotsRemaining,
        reason: 'quota_depleted',
      };
    }

    // Reserve slot by incrementing token usage
    const updatedCampaign = await updateCampaignTokens(campaign.id, tokensToReserve);
    const slotsRemaining = calculateSlotsRemaining(updatedCampaign);

    // Invalidate cache since campaign state changed
    try {
      const redis = getRedisClient();
      await redis.del(CAMPAIGN_STATUS_KEY);
      console.log('✅ AI Campaign Service: Invalidated campaign status cache');
    } catch (error) {
      console.error('❌ AI Campaign Service: Failed to invalidate cache:', error);
    }

    console.log(
      `✅ AI Campaign Service: Reserved slot - ` +
      `tokens=${tokensToReserve}, remaining=${slotsRemaining}`
    );

    return {
      reserved: true,
      slotsRemaining,
      reason: 'success',
    };
  } catch (error) {
    // Re-throw AiCampaignServiceError as-is
    if (error instanceof AiCampaignServiceError) {
      throw error;
    }

    // Re-throw repository errors as service errors
    if (error instanceof AiCampaignRepositoryError) {
      throw new AiCampaignServiceError(error.message, error.code, error);
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ AI Campaign Service: Failed to reserve slot:', err.message);
    throw new AiCampaignServiceError(
      'Failed to reserve campaign slot',
      'RESERVE_SLOT_FAILED',
      err
    );
  }
}

/**
 * Check and reserve a slot atomically using Redis Lua script
 *
 * Uses a Lua script to atomically check slot availability and reserve a slot
 * if available. This prevents race conditions when multiple users request
 * AI scans simultaneously.
 *
 * The reservation is tracked by scan ID with automatic expiration after 30 minutes.
 * If a scan fails or times out, the slot is automatically released.
 *
 * @param scanId - Unique scan identifier
 * @returns Reservation result with success status and remaining slots
 * @throws AiCampaignServiceError if Redis operation fails
 *
 * @example
 * ```typescript
 * const result = await checkAndReserveSlotAtomic('scan-123');
 * if (result.reserved) {
 *   console.log(`Slot reserved! ${result.slotsRemaining} slots left`);
 *   // Proceed with AI scan
 * } else {
 *   console.log('No slots available');
 *   // Show error to user
 * }
 * ```
 */
export async function checkAndReserveSlotAtomic(scanId: string): Promise<SlotReservationResult> {
  try {
    if (!scanId || typeof scanId !== 'string') {
      throw new AiCampaignServiceError(
        'Scan ID is required and must be a string',
        'INVALID_INPUT'
      );
    }

    const redis = getRedisClient();

    // Check if slot counter exists in Redis
    const exists = await redis.exists(AI_CAMPAIGN_SLOTS_KEY);

    if (!exists) {
      console.log('ℹ️  AI Campaign Service: Redis slot counter not found, initializing from database');
      const initialized = await initializeRedisSlots();

      if (initialized === null || initialized <= 0) {
        return {
          reserved: false,
          slotsRemaining: 0,
          reason: 'campaign_inactive',
        };
      }
    }

    // Execute Lua script atomically
    const result = await redis.eval(
      RESERVE_SLOT_LUA,
      1, // Number of keys
      AI_CAMPAIGN_SLOTS_KEY
    ) as [number, number];

    const [reserved, remaining] = result;

    if (reserved === 1) {
      // Mark this scan ID as having a reserved slot with TTL
      await redis.setex(
        AI_CAMPAIGN_SLOT_RESERVE_KEY(scanId),
        SLOT_RESERVATION_TTL,
        '1'
      );

      console.log(
        `✅ AI Campaign Service: Reserved slot atomically - ` +
        `scanId=${scanId}, remaining=${remaining}`
      );

      return {
        reserved: true,
        slotsRemaining: remaining,
        reason: 'success',
      };
    } else {
      console.warn(
        `⚠️  AI Campaign Service: Slot reservation failed - ` +
        `scanId=${scanId}, quota depleted`
      );

      return {
        reserved: false,
        slotsRemaining: 0,
        reason: 'quota_depleted',
      };
    }
  } catch (error) {
    // Re-throw AiCampaignServiceError as-is
    if (error instanceof AiCampaignServiceError) {
      throw error;
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ AI Campaign Service: Failed to reserve slot atomically:', err.message);
    throw new AiCampaignServiceError(
      'Failed to reserve campaign slot atomically',
      'ATOMIC_RESERVE_FAILED',
      err
    );
  }
}

/**
 * Release a reserved slot when a scan fails or is cancelled
 *
 * Increments the Redis slot counter to release a previously reserved slot.
 * This ensures slots are returned to the pool when scans don't complete successfully.
 *
 * @param scanId - Unique scan identifier
 * @returns True if slot was released, false if no reservation found
 * @throws AiCampaignServiceError if Redis operation fails
 *
 * @example
 * ```typescript
 * // When AI scan fails
 * try {
 *   await processAiScan(scanId);
 * } catch (error) {
 *   await releaseSlot(scanId);
 *   console.log('Slot released due to scan failure');
 * }
 * ```
 */
export async function releaseSlot(scanId: string): Promise<boolean> {
  try {
    if (!scanId || typeof scanId !== 'string') {
      throw new AiCampaignServiceError(
        'Scan ID is required and must be a string',
        'INVALID_INPUT'
      );
    }

    const redis = getRedisClient();

    // Check if this scan has a reservation
    const reservationKey = AI_CAMPAIGN_SLOT_RESERVE_KEY(scanId);
    const hasReservation = await redis.exists(reservationKey);

    if (!hasReservation) {
      console.log(`ℹ️  AI Campaign Service: No reservation found for scanId=${scanId}`);
      return false;
    }

    // Delete the reservation marker
    await redis.del(reservationKey);

    // Increment the available slots counter
    const newCount = await redis.incr(AI_CAMPAIGN_SLOTS_KEY);

    console.log(
      `✅ AI Campaign Service: Released slot - ` +
      `scanId=${scanId}, newCount=${newCount}`
    );

    // Invalidate campaign status cache since availability changed
    try {
      await redis.del(CAMPAIGN_STATUS_KEY);
      console.log('✅ AI Campaign Service: Invalidated campaign status cache after slot release');
    } catch (error) {
      console.error('❌ AI Campaign Service: Failed to invalidate cache:', error);
    }

    return true;
  } catch (error) {
    // Re-throw AiCampaignServiceError as-is
    if (error instanceof AiCampaignServiceError) {
      throw error;
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ AI Campaign Service: Failed to release slot:', err.message);
    throw new AiCampaignServiceError(
      'Failed to release campaign slot',
      'RELEASE_SLOT_FAILED',
      err
    );
  }
}

/**
 * Deduct tokens from campaign budget after scan completion
 *
 * Updates the campaign token usage and invalidates Redis cache to ensure
 * accurate slot calculations. This is called after an AI scan completes
 * successfully and actual token usage is known.
 *
 * @param scanId - Scan ID for audit trail
 * @param tokensUsed - Number of tokens consumed by the scan
 * @returns Updated campaign with new token totals
 * @throws AiCampaignServiceError if deduction fails
 *
 * @example
 * ```typescript
 * // After AI scan completes
 * const scan = await completeScan(scanId);
 * const tokensUsed = scan.aiInputTokens + scan.aiOutputTokens;
 * await deductTokens(scanId, tokensUsed);
 * console.log('Tokens deducted from campaign budget');
 * ```
 */
export async function deductTokens(scanId: string, tokensUsed: number): Promise<AiCampaign> {
  try {
    if (!scanId || typeof scanId !== 'string') {
      throw new AiCampaignServiceError(
        'Scan ID is required and must be a string',
        'INVALID_INPUT'
      );
    }

    if (!tokensUsed || typeof tokensUsed !== 'number' || tokensUsed <= 0) {
      throw new AiCampaignServiceError(
        'Tokens used must be a positive number',
        'INVALID_INPUT'
      );
    }

    // Get active campaign
    const campaign = await getActiveCampaign();

    if (!campaign) {
      throw new AiCampaignServiceError(
        'No active campaign found to deduct tokens from',
        'CAMPAIGN_NOT_FOUND'
      );
    }

    // Update campaign token usage
    const updatedCampaign = await updateCampaignTokens(campaign.id, tokensUsed);

    // Invalidate Redis cache to ensure accurate slot calculations
    try {
      const redis = getRedisClient();
      await redis.del(CAMPAIGN_STATUS_KEY);

      // Also update the atomic slot counter if it exists
      const exists = await redis.exists(AI_CAMPAIGN_SLOTS_KEY);
      if (exists) {
        const slotsRemaining = calculateSlotsRemaining(updatedCampaign);
        await redis.set(AI_CAMPAIGN_SLOTS_KEY, slotsRemaining.toString());
        console.log(
          `✅ AI Campaign Service: Updated Redis slot counter to ${slotsRemaining} slots`
        );
      }

      console.log('✅ AI Campaign Service: Invalidated campaign status cache after token deduction');
    } catch (error) {
      console.error('❌ AI Campaign Service: Failed to invalidate cache:', error);
      // Don't fail the deduction if cache invalidation fails
    }

    console.log(
      `✅ AI Campaign Service: Deducted tokens - ` +
      `scanId=${scanId}, tokens=${tokensUsed}, remaining=${updatedCampaign.totalTokenBudget - updatedCampaign.usedTokens}`
    );

    return updatedCampaign;
  } catch (error) {
    // Re-throw AiCampaignServiceError as-is
    if (error instanceof AiCampaignServiceError) {
      throw error;
    }

    // Re-throw repository errors as service errors
    if (error instanceof AiCampaignRepositoryError) {
      throw new AiCampaignServiceError(error.message, error.code, error);
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ AI Campaign Service: Failed to deduct tokens:', err.message);
    throw new AiCampaignServiceError(
      'Failed to deduct tokens from campaign',
      'DEDUCT_TOKENS_FAILED',
      err
    );
  }
}

/**
 * Get comprehensive campaign metrics for admin dashboard
 *
 * Aggregates campaign statistics, token usage, scan metrics, and projections.
 * Provides complete view of campaign performance and utilization.
 *
 * @returns Campaign metrics or null if no active campaign
 * @throws AiCampaignServiceError if metrics calculation fails
 *
 * @example
 * ```typescript
 * const metrics = await getCampaignMetrics();
 * if (metrics) {
 *   console.log(`Campaign: ${metrics.campaignStatus}`);
 *   console.log(`Token usage: ${metrics.percentUsed}%`);
 *   console.log(`Completed scans: ${metrics.completedScans}`);
 *   console.log(`Projected slots: ${metrics.projectedSlotsRemaining}`);
 * }
 * ```
 */
export async function getCampaignMetrics(): Promise<CampaignMetrics | null> {
  try {
    const prisma = getPrismaClient();

    // Get active campaign
    const campaign = await getActiveCampaign();

    if (!campaign) {
      console.log('ℹ️  AI Campaign Service: No active campaign found for metrics');
      return null;
    }

    // Calculate token metrics
    const remainingTokens = campaign.totalTokenBudget - campaign.usedTokens;
    const percentUsed = campaign.totalTokenBudget > 0
      ? Math.round((campaign.usedTokens / campaign.totalTokenBudget) * 100)
      : 0;

    // Get scan statistics
    const [completedCount, failedCount, pendingCount] = await Promise.all([
      prisma.scan.count({
        where: {
          aiEnabled: true,
          aiStatus: 'COMPLETED',
          createdAt: {
            gte: campaign.startsAt,
            ...(campaign.endsAt ? { lte: campaign.endsAt } : {}),
          },
        },
      }),
      prisma.scan.count({
        where: {
          aiEnabled: true,
          aiStatus: 'FAILED',
          createdAt: {
            gte: campaign.startsAt,
            ...(campaign.endsAt ? { lte: campaign.endsAt } : {}),
          },
        },
      }),
      prisma.scan.count({
        where: {
          aiEnabled: true,
          aiStatus: {
            in: ['PENDING', 'DOWNLOADED', 'PROCESSING'],
          },
          createdAt: {
            gte: campaign.startsAt,
            ...(campaign.endsAt ? { lte: campaign.endsAt } : {}),
          },
        },
      }),
    ]);

    // Calculate projected slots remaining
    const projectedSlotsRemaining = calculateSlotsRemaining(campaign);

    // Get reserved slots from Redis
    let reservedSlots = 0;
    try {
      const redis = getRedisClient();
      const exists = await redis.exists(AI_CAMPAIGN_SLOTS_KEY);
      if (exists) {
        const totalSlots = Math.floor(campaign.totalTokenBudget / campaign.avgTokensPerScan);
        const available = parseInt(await redis.get(AI_CAMPAIGN_SLOTS_KEY) || '0', 10);
        reservedSlots = totalSlots - available - (completedCount + failedCount);
      }
    } catch (error) {
      console.error('❌ AI Campaign Service: Failed to get reserved slots from Redis:', error);
      // Continue with reservedSlots = 0
    }

    const metrics: CampaignMetrics = {
      totalTokenBudget: campaign.totalTokenBudget,
      usedTokens: campaign.usedTokens,
      remainingTokens,
      percentUsed,
      reservedSlots: Math.max(0, reservedSlots),
      completedScans: completedCount,
      failedScans: failedCount,
      pendingScans: pendingCount,
      avgTokensPerScan: campaign.avgTokensPerScan,
      projectedSlotsRemaining,
      campaignStatus: campaign.status,
      startsAt: campaign.startsAt,
      endsAt: campaign.endsAt,
    };

    console.log(
      `✅ AI Campaign Service: Generated metrics - ` +
      `completed=${completedCount}, failed=${failedCount}, pending=${pendingCount}, ` +
      `percentUsed=${percentUsed}%`
    );

    return metrics;
  } catch (error) {
    // Re-throw AiCampaignServiceError as-is
    if (error instanceof AiCampaignServiceError) {
      throw error;
    }

    // Re-throw repository errors as service errors
    if (error instanceof AiCampaignRepositoryError) {
      throw new AiCampaignServiceError(error.message, error.code, error);
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ AI Campaign Service: Failed to get campaign metrics:', err.message);
    throw new AiCampaignServiceError(
      'Failed to get campaign metrics',
      'GET_METRICS_FAILED',
      err
    );
  }
}

/**
 * Update campaign configuration with audit logging
 *
 * Updates campaign settings and creates audit trail for all changes.
 * Invalidates Redis cache to ensure consistency across the system.
 *
 * @param campaignId - Campaign ID to update
 * @param data - Update data with changed fields
 * @param adminId - Admin user ID for audit trail
 * @returns Updated campaign
 * @throws AiCampaignServiceError if update fails or validation errors
 *
 * @example
 * ```typescript
 * // Pause campaign
 * const updated = await updateCampaign('campaign-123', {
 *   status: 'PAUSED'
 * }, 'admin-456');
 *
 * // Increase budget
 * const updated = await updateCampaign('campaign-123', {
 *   totalTokenBudget: 150000
 * }, 'admin-456');
 *
 * // Update multiple fields
 * const updated = await updateCampaign('campaign-123', {
 *   status: 'ACTIVE',
 *   totalTokenBudget: 200000,
 *   endsAt: new Date('2025-03-01')
 * }, 'admin-456');
 * ```
 */
export async function updateCampaign(
  campaignId: string,
  data: UpdateCampaignData,
  adminId: string
): Promise<AiCampaign> {
  try {
    if (!campaignId || typeof campaignId !== 'string') {
      throw new AiCampaignServiceError(
        'Campaign ID is required and must be a string',
        'INVALID_INPUT'
      );
    }

    if (!adminId || typeof adminId !== 'string') {
      throw new AiCampaignServiceError(
        'Admin ID is required and must be a string',
        'INVALID_INPUT'
      );
    }

    if (!data || typeof data !== 'object') {
      throw new AiCampaignServiceError(
        'Update data is required and must be an object',
        'INVALID_INPUT'
      );
    }

    // Verify campaign exists
    const existingCampaign = await getCampaignById(campaignId);

    if (!existingCampaign) {
      throw new AiCampaignServiceError(
        `Campaign not found: ${campaignId}`,
        'NOT_FOUND'
      );
    }

    const prisma = getPrismaClient();

    // Prepare update data
    const updateData: Record<string, unknown> = {};
    const changes: Record<string, unknown> = {};

    if (data.name !== undefined) {
      updateData['name'] = data.name;
      changes['name'] = { from: existingCampaign.name, to: data.name };
    }

    if (data.totalTokenBudget !== undefined) {
      if (data.totalTokenBudget < 0) {
        throw new AiCampaignServiceError(
          'Total token budget must be non-negative',
          'INVALID_INPUT'
        );
      }
      updateData['totalTokenBudget'] = data.totalTokenBudget;
      changes['totalTokenBudget'] = {
        from: existingCampaign.totalTokenBudget,
        to: data.totalTokenBudget
      };
    }

    if (data.avgTokensPerScan !== undefined) {
      if (data.avgTokensPerScan <= 0) {
        throw new AiCampaignServiceError(
          'Average tokens per scan must be positive',
          'INVALID_INPUT'
        );
      }
      updateData['avgTokensPerScan'] = data.avgTokensPerScan;
      changes['avgTokensPerScan'] = {
        from: existingCampaign.avgTokensPerScan,
        to: data.avgTokensPerScan
      };
    }

    if (data.status !== undefined) {
      updateData['status'] = data.status;
      changes['status'] = { from: existingCampaign.status, to: data.status };
    }

    if (data.startsAt !== undefined) {
      updateData['startsAt'] = data.startsAt;
      changes['startsAt'] = {
        from: existingCampaign.startsAt.toISOString(),
        to: data.startsAt.toISOString()
      };
    }

    if (data.endsAt !== undefined) {
      updateData['endsAt'] = data.endsAt;
      changes['endsAt'] = {
        from: existingCampaign.endsAt?.toISOString() || null,
        to: data.endsAt?.toISOString() || null
      };
    }

    // If no changes, return existing campaign
    if (Object.keys(updateData).length === 0) {
      console.log(`ℹ️  AI Campaign Service: No changes to update for campaign ${campaignId}`);
      return existingCampaign;
    }

    // Update campaign
    const updatedCampaign = await prisma.aiCampaign.update({
      where: { id: campaignId },
      data: updateData,
    });

    // Create audit log
    await createAuditLog({
      campaignId,
      action: 'CAMPAIGN_UPDATED',
      details: {
        changes,
        updatedFields: Object.keys(updateData),
      },
      adminId,
    });

    // Invalidate Redis cache
    try {
      const redis = getRedisClient();
      await redis.del(CAMPAIGN_STATUS_KEY);

      // Reinitialize slot counter if budget or avg tokens changed
      if (data.totalTokenBudget !== undefined || data.avgTokensPerScan !== undefined) {
        const slotsRemaining = calculateSlotsRemaining(updatedCampaign);
        await redis.set(AI_CAMPAIGN_SLOTS_KEY, slotsRemaining.toString());
        console.log(
          `✅ AI Campaign Service: Updated Redis slot counter to ${slotsRemaining} slots`
        );
      }

      console.log('✅ AI Campaign Service: Invalidated campaign cache after update');
    } catch (error) {
      console.error('❌ AI Campaign Service: Failed to invalidate cache:', error);
      // Don't fail the update if cache invalidation fails
    }

    console.log(
      `✅ AI Campaign Service: Updated campaign ${updatedCampaign.name} - ` +
      `fields: ${Object.keys(updateData).join(', ')}`
    );

    return updatedCampaign;
  } catch (error) {
    // Re-throw AiCampaignServiceError as-is
    if (error instanceof AiCampaignServiceError) {
      throw error;
    }

    // Re-throw repository errors as service errors
    if (error instanceof AiCampaignRepositoryError) {
      throw new AiCampaignServiceError(error.message, error.code, error);
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ AI Campaign Service: Failed to update campaign:', err.message);
    throw new AiCampaignServiceError(
      'Failed to update campaign',
      'UPDATE_CAMPAIGN_FAILED',
      err
    );
  }
}

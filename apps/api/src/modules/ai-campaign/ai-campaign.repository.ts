/**
 * AI Campaign Repository
 *
 * Data access layer for AI Campaign operations using Prisma ORM.
 * Implements clean architecture - repository handles only database operations.
 */

import { getPrismaClient } from '../../config/database.js';
import type { AiCampaign, AiCampaignAudit, AiCampaignStatus } from '@prisma/client';

/**
 * AI Campaign Repository Error
 */
export class AiCampaignRepositoryError extends Error {
  public readonly code: string;
  public override readonly cause?: Error | undefined;

  constructor(message: string, code: string, cause?: Error | undefined) {
    super(message);
    this.name = 'AiCampaignRepositoryError';
    this.code = code;
    this.cause = cause;
  }
}

/**
 * AI Campaign with audit logs
 */
export interface AiCampaignWithAudit extends AiCampaign {
  auditLogs: AiCampaignAudit[];
}

/**
 * Input data for creating audit log
 */
export interface CreateAuditLogData {
  campaignId: string;
  action: string;
  details?: Record<string, unknown> | null;
  adminId: string;
}

/**
 * Get active campaign
 *
 * Fetches the campaign where status=ACTIVE and startsAt <= now.
 * Used to determine if AI features are available to users.
 *
 * @returns The active campaign or null if no active campaign exists
 * @throws AiCampaignRepositoryError if database error occurs
 *
 * @example
 * ```typescript
 * const campaign = await getActiveCampaign();
 * if (campaign) {
 *   const remainingBudget = campaign.totalTokenBudget - campaign.usedTokens;
 *   console.log(`Active campaign: ${campaign.name}, budget: ${remainingBudget} tokens`);
 * }
 * ```
 */
export async function getActiveCampaign(): Promise<AiCampaign | null> {
  const prisma = getPrismaClient();

  try {
    const now = new Date();

    const campaign = await prisma.aiCampaign.findFirst({
      where: {
        status: 'ACTIVE',
        startsAt: {
          lte: now,
        },
        endsAt: {
          gte: now,
        },
      },
      orderBy: {
        startsAt: 'desc',
      },
    });

    if (campaign) {
      console.log(`✅ AI Campaign Repository: Found active campaign ${campaign.name} (${campaign.id})`);
    }

    return campaign;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ AI Campaign Repository: Failed to get active campaign:', err.message);
    throw new AiCampaignRepositoryError(
      'Failed to get active campaign',
      'GET_ACTIVE_FAILED',
      err
    );
  }
}

/**
 * Update campaign tokens atomically
 *
 * Atomically increments the usedTokens counter for a campaign.
 * This prevents race conditions when multiple scans complete simultaneously.
 *
 * @param campaignId - Campaign ID
 * @param tokensUsed - Number of tokens to add to usedTokens
 * @returns Updated campaign
 * @throws AiCampaignRepositoryError if campaign not found or update fails
 *
 * @example
 * ```typescript
 * // After AI processing completes
 * const updated = await updateCampaignTokens('campaign-123', 1500);
 * console.log(`Campaign now used: ${updated.usedTokens} tokens`);
 * ```
 */
export async function updateCampaignTokens(
  campaignId: string,
  tokensUsed: number
): Promise<AiCampaign> {
  const prisma = getPrismaClient();

  try {
    if (!campaignId || typeof campaignId !== 'string') {
      throw new AiCampaignRepositoryError(
        'Campaign ID is required and must be a string',
        'INVALID_INPUT'
      );
    }

    if (!tokensUsed || typeof tokensUsed !== 'number' || tokensUsed <= 0) {
      throw new AiCampaignRepositoryError(
        'Tokens used must be a positive number',
        'INVALID_INPUT'
      );
    }

    // Check if campaign exists
    const existingCampaign = await prisma.aiCampaign.findUnique({
      where: { id: campaignId },
      select: { id: true, name: true, usedTokens: true, totalTokenBudget: true },
    });

    if (!existingCampaign) {
      throw new AiCampaignRepositoryError(
        `Campaign not found: ${campaignId}`,
        'NOT_FOUND'
      );
    }

    // Atomic update using increment
    const campaign = await prisma.aiCampaign.update({
      where: { id: campaignId },
      data: {
        usedTokens: {
          increment: tokensUsed,
        },
      },
    });

    console.log(
      `✅ AI Campaign Repository: Updated campaign ${campaign.name} ` +
      `tokens: ${existingCampaign.usedTokens} → ${campaign.usedTokens} (+${tokensUsed})`
    );

    // Check if campaign should be marked as depleted
    if (campaign.usedTokens >= campaign.totalTokenBudget && campaign.status === 'ACTIVE') {
      console.log(`⚠️  AI Campaign Repository: Campaign ${campaign.name} has depleted its token budget`);
    }

    return campaign;
  } catch (error) {
    // Re-throw AiCampaignRepositoryError as-is
    if (error instanceof AiCampaignRepositoryError) {
      throw error;
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ AI Campaign Repository: Failed to update campaign tokens:', err.message);
    throw new AiCampaignRepositoryError(
      `Failed to update campaign tokens for ${campaignId}`,
      'UPDATE_FAILED',
      err
    );
  }
}

/**
 * Create audit log entry
 *
 * Creates an audit trail entry for campaign actions.
 * Used for tracking campaign modifications, status changes, and administrative actions.
 *
 * @param data - Audit log data
 * @returns Created audit log entry
 * @throws AiCampaignRepositoryError if validation fails or database error occurs
 *
 * @example
 * ```typescript
 * // Log campaign pause action
 * await createAuditLog({
 *   campaignId: 'campaign-123',
 *   action: 'PAUSED',
 *   details: { reason: 'Budget review', pausedBy: 'admin@example.com' },
 *   adminId: 'admin-456'
 * });
 *
 * // Log token budget increase
 * await createAuditLog({
 *   campaignId: 'campaign-123',
 *   action: 'BUDGET_ADDED',
 *   details: { previousBudget: 100000, newBudget: 150000, addedTokens: 50000 },
 *   adminId: 'admin-456'
 * });
 * ```
 */
export async function createAuditLog(data: CreateAuditLogData): Promise<AiCampaignAudit> {
  const prisma = getPrismaClient();

  try {
    // Validate required fields
    if (!data.campaignId || typeof data.campaignId !== 'string') {
      throw new AiCampaignRepositoryError(
        'Campaign ID is required and must be a string',
        'INVALID_INPUT'
      );
    }

    if (!data.action || typeof data.action !== 'string') {
      throw new AiCampaignRepositoryError(
        'Action is required and must be a string',
        'INVALID_INPUT'
      );
    }

    if (!data.adminId || typeof data.adminId !== 'string') {
      throw new AiCampaignRepositoryError(
        'Admin ID is required and must be a string',
        'INVALID_INPUT'
      );
    }

    // Verify campaign exists
    const campaign = await prisma.aiCampaign.findUnique({
      where: { id: data.campaignId },
      select: { id: true, name: true },
    });

    if (!campaign) {
      throw new AiCampaignRepositoryError(
        `Campaign not found: ${data.campaignId}`,
        'NOT_FOUND'
      );
    }

    // Create audit log entry
    const auditLog = await prisma.aiCampaignAudit.create({
      data: {
        campaignId: data.campaignId,
        action: data.action,
        details: data.details as Parameters<typeof prisma.aiCampaignAudit.create>[0]['data']['details'],
        adminId: data.adminId,
      },
    });

    console.log(
      `✅ AI Campaign Repository: Created audit log for campaign ${campaign.name} ` +
      `(action: ${data.action}, admin: ${data.adminId})`
    );

    return auditLog;
  } catch (error) {
    // Re-throw AiCampaignRepositoryError as-is
    if (error instanceof AiCampaignRepositoryError) {
      throw error;
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ AI Campaign Repository: Failed to create audit log:', err.message);
    throw new AiCampaignRepositoryError(
      'Failed to create audit log',
      'AUDIT_LOG_FAILED',
      err
    );
  }
}

/**
 * Get campaign by ID
 *
 * Fetches a single campaign by its ID with optional audit logs.
 *
 * @param id - Campaign ID
 * @param includeAuditLogs - Whether to include audit logs (default: false)
 * @returns The campaign or null if not found
 * @throws AiCampaignRepositoryError if database error occurs
 *
 * @example
 * ```typescript
 * // Get campaign without audit logs
 * const campaign = await getCampaignById('campaign-123');
 *
 * // Get campaign with audit trail
 * const campaignWithAudit = await getCampaignById('campaign-123', true);
 * console.log(`Audit entries: ${campaignWithAudit?.auditLogs.length}`);
 * ```
 */
export async function getCampaignById(
  id: string,
  includeAuditLogs = false
): Promise<AiCampaign | AiCampaignWithAudit | null> {
  const prisma = getPrismaClient();

  try {
    if (!id || typeof id !== 'string') {
      return null;
    }

    const campaign = await prisma.aiCampaign.findUnique({
      where: { id },
      include: includeAuditLogs
        ? {
            audits: {
              orderBy: {
                createdAt: 'desc',
              },
            },
          }
        : undefined,
    });

    if (campaign && includeAuditLogs) {
      return campaign as AiCampaignWithAudit;
    }

    return campaign;
  } catch (error) {
    console.error('❌ AI Campaign Repository: Failed to get campaign:', error);
    throw new AiCampaignRepositoryError(
      `Failed to get campaign ${id}`,
      'GET_FAILED',
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

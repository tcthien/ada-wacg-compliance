/**
 * AI Campaign Controller
 *
 * Fastify route handlers for AI campaign operations.
 * Implements public status endpoint and admin management endpoints.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  getCampaignStatus,
  getCampaignMetrics,
  updateCampaign,
  AiCampaignServiceError,
} from './ai-campaign.service.js';
import type {
  CampaignStatusResponse,
  CampaignMetrics,
  UpdateCampaignData,
} from './ai-campaign.types.js';
import { createAuditLog, AiCampaignRepositoryError } from './ai-campaign.repository.js';
import { rateLimitMiddleware } from '../../shared/middleware/rate-limit.js';
import { adminAuthMiddleware } from '../admin/admin.middleware.js';

/**
 * Zod schema for campaign update request
 */
const UpdateCampaignSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  totalTokenBudget: z.number().int().min(0).optional(),
  avgTokensPerScan: z.number().int().min(1).optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'DEPLETED', 'ENDED']).optional(),
  startsAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  endsAt: z.string().datetime().transform((str) => new Date(str)).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
);

/**
 * Type for update campaign body
 */
type UpdateCampaignBody = z.infer<typeof UpdateCampaignSchema>;

/**
 * GET /api/v1/ai-campaign/status
 *
 * Get current campaign status with availability information.
 *
 * Public endpoint with rate limiting.
 * Returns campaign status, slot availability, and urgency indicators.
 *
 * Middleware chain:
 * 1. rateLimit - Rate limiting protection
 * 2. handler - Returns campaign status
 *
 * @param request - Fastify request
 * @param reply - Fastify reply
 * @returns Campaign status or null if no active campaign
 *
 * @example
 * GET /api/v1/ai-campaign/status
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "active": true,
 *     "slotsRemaining": 50,
 *     "totalSlots": 1000,
 *     "percentRemaining": 5,
 *     "urgencyLevel": "final",
 *     "message": "Final slots available!"
 *   }
 * }
 *
 * Response 200 (No active campaign):
 * {
 *   "success": true,
 *   "data": null
 * }
 */
async function getCampaignStatusHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const status = await getCampaignStatus();

    return reply.code(200).send({
      success: true,
      data: status,
    });
  } catch (error) {
    // Handle service errors
    if (error instanceof AiCampaignServiceError) {
      const statusCode = getStatusCodeForError(error.code);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in getCampaignStatusHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * GET /api/v1/admin/ai-campaign
 *
 * Get comprehensive campaign metrics for admin dashboard.
 *
 * Admin-only endpoint with authentication.
 * Returns detailed campaign statistics and token usage.
 *
 * Middleware chain:
 * 1. adminAuth - Admin authentication
 * 2. handler - Returns campaign metrics
 *
 * @param request - Fastify request
 * @param reply - Fastify reply
 * @returns Campaign metrics or null if no active campaign
 *
 * @example
 * GET /api/v1/admin/ai-campaign
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "totalTokenBudget": 100000,
 *     "usedTokens": 45000,
 *     "remainingTokens": 55000,
 *     "percentUsed": 45,
 *     "reservedSlots": 500,
 *     "completedScans": 450,
 *     "failedScans": 10,
 *     "pendingScans": 40,
 *     "avgTokensPerScan": 100,
 *     "projectedSlotsRemaining": 550,
 *     "campaignStatus": "ACTIVE",
 *     "startsAt": "2025-01-01T00:00:00.000Z",
 *     "endsAt": "2025-02-01T00:00:00.000Z"
 *   }
 * }
 */
async function getCampaignMetricsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const metrics = await getCampaignMetrics();

    return reply.code(200).send({
      success: true,
      data: metrics,
    });
  } catch (error) {
    // Handle service errors
    if (error instanceof AiCampaignServiceError) {
      const statusCode = getStatusCodeForError(error.code);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in getCampaignMetricsHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * PATCH /api/v1/admin/ai-campaign
 *
 * Update campaign configuration.
 *
 * Admin-only endpoint with authentication.
 * Updates campaign settings and creates audit log.
 *
 * Middleware chain:
 * 1. adminAuth - Admin authentication
 * 2. handler - Updates campaign and returns updated data
 *
 * @param request - Fastify request with update body
 * @param reply - Fastify reply
 * @returns Updated campaign data
 *
 * @example
 * PATCH /api/v1/admin/ai-campaign
 * Body: {
 *   "status": "PAUSED"
 * }
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "campaign-123",
 *     "name": "Early Bird 2025",
 *     "status": "PAUSED",
 *     "totalTokenBudget": 100000,
 *     "usedTokens": 45000,
 *     "avgTokensPerScan": 100,
 *     "startsAt": "2025-01-01T00:00:00.000Z",
 *     "endsAt": "2025-02-01T00:00:00.000Z",
 *     "createdAt": "2024-12-15T00:00:00.000Z",
 *     "updatedAt": "2025-01-01T12:00:00.000Z"
 *   }
 * }
 */
async function updateCampaignHandler(
  request: FastifyRequest<{ Body: UpdateCampaignBody }>,
  reply: FastifyReply
): Promise<void> {
  try {
    // Validate request body
    const body = UpdateCampaignSchema.parse(request.body);

    // Get admin ID from authenticated request
    const adminId = request.adminUser?.id;
    if (!adminId) {
      return reply.code(401).send({
        success: false,
        error: 'Unauthorized',
        message: 'Admin authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    // Get the active campaign ID (we'll use getActiveCampaign from service)
    // For now, we'll need to import getActiveCampaign or fetch it differently
    // Let's fetch metrics which internally gets the active campaign
    const metrics = await getCampaignMetrics();

    if (!metrics) {
      return reply.code(404).send({
        success: false,
        error: 'No active campaign found',
        code: 'NOT_FOUND',
      });
    }

    // We need to get the campaign ID. Let's use getActiveCampaign from repository
    const { getActiveCampaign } = await import('./ai-campaign.repository.js');
    const campaign = await getActiveCampaign();

    if (!campaign) {
      return reply.code(404).send({
        success: false,
        error: 'Campaign not found',
        code: 'NOT_FOUND',
      });
    }

    // Update campaign
    const updatedCampaign = await updateCampaign(
      campaign.id,
      body as UpdateCampaignData,
      adminId
    );

    return reply.code(200).send({
      success: true,
      data: {
        id: updatedCampaign.id,
        name: updatedCampaign.name,
        status: updatedCampaign.status,
        totalTokenBudget: updatedCampaign.totalTokenBudget,
        usedTokens: updatedCampaign.usedTokens,
        avgTokensPerScan: updatedCampaign.avgTokensPerScan,
        startsAt: updatedCampaign.startsAt.toISOString(),
        endsAt: updatedCampaign.endsAt?.toISOString() ?? null,
        createdAt: updatedCampaign.createdAt.toISOString(),
        updatedAt: updatedCampaign.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid request body',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle service errors
    if (error instanceof AiCampaignServiceError) {
      const statusCode = getStatusCodeForError(error.code);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle repository errors
    if (error instanceof AiCampaignRepositoryError) {
      const statusCode = getStatusCodeForError(error.code);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in updateCampaignHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * POST /api/v1/admin/ai-campaign/pause
 *
 * Pause the active campaign.
 *
 * Admin-only endpoint with authentication.
 * Sets campaign status to PAUSED and creates audit log.
 *
 * Middleware chain:
 * 1. adminAuth - Admin authentication
 * 2. handler - Pauses campaign
 *
 * @param request - Fastify request
 * @param reply - Fastify reply
 * @returns Updated campaign data
 *
 * @example
 * POST /api/v1/admin/ai-campaign/pause
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "campaign-123",
 *     "status": "PAUSED",
 *     "message": "Campaign paused successfully"
 *   }
 * }
 */
async function pauseCampaignHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Get admin ID from authenticated request
    const adminId = request.adminUser?.id;
    if (!adminId) {
      return reply.code(401).send({
        success: false,
        error: 'Unauthorized',
        message: 'Admin authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    // Get the active campaign
    const { getActiveCampaign } = await import('./ai-campaign.repository.js');
    const campaign = await getActiveCampaign();

    if (!campaign) {
      return reply.code(404).send({
        success: false,
        error: 'No active campaign found',
        code: 'NOT_FOUND',
      });
    }

    // Check if already paused
    if (campaign.status === 'PAUSED') {
      return reply.code(400).send({
        success: false,
        error: 'Campaign is already paused',
        code: 'INVALID_STATE',
      });
    }

    // Pause campaign
    const updatedCampaign = await updateCampaign(
      campaign.id,
      { status: 'PAUSED' },
      adminId
    );

    return reply.code(200).send({
      success: true,
      data: {
        id: updatedCampaign.id,
        status: updatedCampaign.status,
        message: 'Campaign paused successfully',
      },
    });
  } catch (error) {
    // Handle service errors
    if (error instanceof AiCampaignServiceError) {
      const statusCode = getStatusCodeForError(error.code);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle repository errors
    if (error instanceof AiCampaignRepositoryError) {
      const statusCode = getStatusCodeForError(error.code);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in pauseCampaignHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * POST /api/v1/admin/ai-campaign/resume
 *
 * Resume a paused campaign.
 *
 * Admin-only endpoint with authentication.
 * Sets campaign status to ACTIVE and creates audit log.
 *
 * Middleware chain:
 * 1. adminAuth - Admin authentication
 * 2. handler - Resumes campaign
 *
 * @param request - Fastify request
 * @param reply - Fastify reply
 * @returns Updated campaign data
 *
 * @example
 * POST /api/v1/admin/ai-campaign/resume
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "campaign-123",
 *     "status": "ACTIVE",
 *     "message": "Campaign resumed successfully"
 *   }
 * }
 */
async function resumeCampaignHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Get admin ID from authenticated request
    const adminId = request.adminUser?.id;
    if (!adminId) {
      return reply.code(401).send({
        success: false,
        error: 'Unauthorized',
        message: 'Admin authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    // Get the active campaign
    const { getActiveCampaign } = await import('./ai-campaign.repository.js');
    const campaign = await getActiveCampaign();

    if (!campaign) {
      return reply.code(404).send({
        success: false,
        error: 'No campaign found',
        code: 'NOT_FOUND',
      });
    }

    // Check if already active
    if (campaign.status === 'ACTIVE') {
      return reply.code(400).send({
        success: false,
        error: 'Campaign is already active',
        code: 'INVALID_STATE',
      });
    }

    // Check if campaign can be resumed (not DEPLETED or ENDED)
    if (campaign.status === 'DEPLETED' || campaign.status === 'ENDED') {
      return reply.code(400).send({
        success: false,
        error: `Cannot resume ${campaign.status.toLowerCase()} campaign`,
        code: 'INVALID_STATE',
      });
    }

    // Resume campaign
    const updatedCampaign = await updateCampaign(
      campaign.id,
      { status: 'ACTIVE' },
      adminId
    );

    return reply.code(200).send({
      success: true,
      data: {
        id: updatedCampaign.id,
        status: updatedCampaign.status,
        message: 'Campaign resumed successfully',
      },
    });
  } catch (error) {
    // Handle service errors
    if (error instanceof AiCampaignServiceError) {
      const statusCode = getStatusCodeForError(error.code);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle repository errors
    if (error instanceof AiCampaignRepositoryError) {
      const statusCode = getStatusCodeForError(error.code);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in resumeCampaignHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * Map service/repository error codes to HTTP status codes
 */
function getStatusCodeForError(code: string): number {
  switch (code) {
    case 'INVALID_INPUT':
    case 'VALIDATION_ERROR':
    case 'INVALID_STATE':
      return 400;
    case 'UNAUTHORIZED':
      return 401;
    case 'NOT_FOUND':
    case 'CAMPAIGN_NOT_FOUND':
      return 404;
    case 'REDIS_INIT_FAILED':
    case 'GET_STATUS_FAILED':
    case 'RESERVE_SLOT_FAILED':
    case 'ATOMIC_RESERVE_FAILED':
    case 'RELEASE_SLOT_FAILED':
    case 'DEDUCT_TOKENS_FAILED':
    case 'GET_METRICS_FAILED':
    case 'UPDATE_CAMPAIGN_FAILED':
    case 'UPDATE_FAILED':
    case 'CREATE_AUDIT_FAILED':
      return 500;
    default:
      return 500;
  }
}

/**
 * Register AI campaign routes
 *
 * @param fastify - Fastify instance
 * @param prefix - API prefix (e.g., '/api/v1')
 */
export async function registerAiCampaignRoutes(
  fastify: FastifyInstance,
  prefix: string
): Promise<void> {
  // GET /api/v1/ai-campaign/status - Public endpoint with rate limiting
  fastify.get(
    `${prefix}/ai-campaign/status`,
    {
      preHandler: [rateLimitMiddleware],
    },
    getCampaignStatusHandler as any
  );

  // GET /api/v1/admin/ai-campaign - Admin metrics endpoint
  fastify.get(
    `${prefix}/admin/ai-campaign`,
    {
      preHandler: [adminAuthMiddleware],
    },
    getCampaignMetricsHandler as any
  );

  // PATCH /api/v1/admin/ai-campaign - Update campaign
  fastify.patch(
    `${prefix}/admin/ai-campaign`,
    {
      preHandler: [adminAuthMiddleware],
    },
    updateCampaignHandler as any
  );

  // POST /api/v1/admin/ai-campaign/pause - Pause campaign
  fastify.post(
    `${prefix}/admin/ai-campaign/pause`,
    {
      preHandler: [adminAuthMiddleware],
    },
    pauseCampaignHandler as any
  );

  // POST /api/v1/admin/ai-campaign/resume - Resume campaign
  fastify.post(
    `${prefix}/admin/ai-campaign/resume`,
    {
      preHandler: [adminAuthMiddleware],
    },
    resumeCampaignHandler as any
  );

  fastify.log.info('✅ AI Campaign routes registered');
}

/**
 * Scan Controller
 *
 * Fastify route handlers for scan operations.
 * Implements middleware chain: session → reCAPTCHA → rate limit → handler
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  createScan,
  getScanStatus,
  getScanResult,
  listScans,
  getAiStatus,
  bulkDeleteScans,
  ScanServiceError,
  type CreateScanInput,
} from './scan.service.js';
import { getFormattedResult, ResultServiceError } from '../results/result.service.js';
import { CreateScanRequestSchema } from './scan.schema.js';
import { sessionMiddleware } from '../../shared/middleware/session.js';
import { recaptchaMiddleware } from '../../shared/middleware/recaptcha.js';
import { rateLimitMiddleware } from '../../shared/middleware/rate-limit.js';

/**
 * Request body type for creating a scan
 */
type CreateScanBody = z.infer<typeof CreateScanRequestSchema>;

/**
 * Route parameter schema for scan ID
 */
const scanIdParamSchema = z.object({
  id: z
    .string()
    .uuid('Invalid scan ID format'),
});

/**
 * Request body schema for bulk delete
 */
const bulkDeleteBodySchema = z.object({
  scanIds: z
    .array(z.string().uuid('Invalid scan ID format'))
    .min(1, 'At least one scan ID is required')
    .max(50, 'Maximum 50 scans can be deleted at once'),
});

/**
 * Query parameter schema for listing scans
 */
const listScansQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Type for scan ID params
 */
type ScanIdParams = z.infer<typeof scanIdParamSchema>;

/**
 * Type for list scans query
 */
type ListScansQuery = z.infer<typeof listScansQuerySchema>;

/**
 * Type for bulk delete body
 */
type BulkDeleteBody = z.infer<typeof bulkDeleteBodySchema>;

/**
 * POST /api/v1/scans
 *
 * Create a new accessibility scan.
 *
 * Middleware chain:
 * 1. session - Creates/retrieves guest session
 * 2. recaptcha - Validates reCAPTCHA token
 * 3. rateLimit - Checks per-URL rate limit (10/hour)
 * 4. handler - Creates scan and queues job
 *
 * @param request - Fastify request with CreateScanBody
 * @param reply - Fastify reply
 * @returns Scan ID and initial status
 *
 * @example
 * POST /api/v1/scans
 * Body: {
 *   "url": "https://example.com",
 *   "email": "user@example.com",
 *   "wcagLevel": "AA",
 *   "recaptchaToken": "abc123...",
 *   "aiEnabled": true
 * }
 *
 * Response 201:
 * {
 *   "success": true,
 *   "data": {
 *     "scanId": "scan_abc123",
 *     "status": "PENDING",
 *     "url": "https://example.com",
 *     "aiEnabled": true
 *   }
 * }
 */
async function createScanHandler(
  request: FastifyRequest<{ Body: CreateScanBody }>,
  reply: FastifyReply
) {
  try {
    // Validate request body
    const body = CreateScanRequestSchema.parse(request.body);

    // Check session exists (set by session middleware)
    if (!request.guestSession) {
      return reply.code(401).send({
        success: false,
        error: 'Unauthorized',
        message: 'Valid session required',
        code: 'SESSION_REQUIRED',
      });
    }

    // Create scan input
    const scanInput: CreateScanInput = {
      url: body.url,
      email: body.email,
      wcagLevel: body.wcagLevel,
      aiEnabled: body.aiEnabled,
    };

    // Create scan via service
    const scan = await createScan(request.guestSession.id, scanInput);

    return reply.code(201).send({
      success: true,
      data: {
        scanId: scan.id,
        status: scan.status,
        url: scan.url,
        aiEnabled: scan.aiEnabled,
      },
    });
  } catch (error) {
    // Handle service errors (check by name property for better test compatibility)
    if (error instanceof Error && error.name === 'ScanServiceError' && 'code' in error) {
      const statusCode = getStatusCodeForScanError(error.code as string);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid request body',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in createScanHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * GET /api/v1/scans/:id
 *
 * Get scan status and progress.
 *
 * Middleware chain:
 * 1. session - Validates session
 * 2. handler - Returns scan status
 *
 * @param request - Fastify request with scan ID param
 * @param reply - Fastify reply
 * @returns Scan status and progress
 *
 * @example
 * GET /api/v1/scans/scan_abc123
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "scanId": "scan_abc123",
 *     "status": "RUNNING",
 *     "progress": 50,
 *     "url": "https://example.com",
 *     "createdAt": "2025-12-26T12:00:00.000Z"
 *   }
 * }
 */
async function getScanStatusHandler(
  request: FastifyRequest<{ Params: ScanIdParams }>,
  reply: FastifyReply
) {
  try {
    // Validate params
    const params = scanIdParamSchema.parse(request.params);

    // Get scan status
    const status = await getScanStatus(params.id);

    if (!status) {
      return reply.code(404).send({
        success: false,
        error: 'Scan not found',
        code: 'SCAN_NOT_FOUND',
      });
    }

    return reply.code(200).send({
      success: true,
      data: {
        scanId: status.scanId,
        status: status.status,
        progress: status.progress,
        url: status.url,
        createdAt: status.createdAt.toISOString(),
        completedAt: status.completedAt?.toISOString() ?? null,
        errorMessage: status.errorMessage,
        aiEnabled: status.aiEnabled,
        email: status.email ?? undefined,
      },
    });
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid scan ID',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in getScanStatusHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * GET /api/v1/scans/:id/result
 *
 * Get full scan results with issues and fix recommendations.
 *
 * Middleware chain:
 * 1. session - Validates session
 * 2. handler - Returns formatted results
 *
 * @param request - Fastify request with scan ID param
 * @param reply - Fastify reply
 * @returns Formatted scan results
 *
 * @example
 * GET /api/v1/scans/scan_abc123/result
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "scanId": "scan_abc123",
 *     "url": "https://example.com",
 *     "wcagLevel": "AA",
 *     "summary": { ... },
 *     "issuesByImpact": { ... },
 *     "metadata": { ... }
 *   }
 * }
 */
async function getScanResultHandler(
  request: FastifyRequest<{ Params: ScanIdParams }>,
  reply: FastifyReply
) {
  try {
    // Validate params
    const params = scanIdParamSchema.parse(request.params);

    // Get formatted result
    const result = await getFormattedResult(params.id);

    if (!result) {
      return reply.code(404).send({
        success: false,
        error: 'Scan not found',
        code: 'SCAN_NOT_FOUND',
      });
    }

    return reply.code(200).send({
      success: true,
      data: result,
    });
  } catch (error) {
    // Handle result service errors (check by name property for better test compatibility)
    if (error instanceof Error && error.name === 'ResultServiceError' && 'code' in error) {
      const statusCode = getStatusCodeForResultError(error.code as string);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid scan ID',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in getScanResultHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * GET /api/v1/scans/:id/ai-status
 *
 * Get AI analysis status and results for a scan.
 *
 * Middleware chain:
 * 1. session - Validates session
 * 2. handler - Returns AI status
 *
 * @param request - Fastify request with scan ID param
 * @param reply - Fastify reply
 * @returns AI status and summary (if completed)
 *
 * @example
 * GET /api/v1/scans/scan_abc123/ai-status
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "scanId": "scan_abc123",
 *     "aiEnabled": true,
 *     "status": "COMPLETED",
 *     "summary": "...",
 *     "remediationPlan": "...",
 *     "processedAt": "2025-01-01T12:00:00.000Z",
 *     "metrics": {
 *       "inputTokens": 1500,
 *       "outputTokens": 2000,
 *       "totalTokens": 3500,
 *       "model": "claude-3-5-sonnet-20241022",
 *       "processingTime": 3500
 *     }
 *   }
 * }
 */
async function getAiStatusHandler(
  request: FastifyRequest<{ Params: ScanIdParams }>,
  reply: FastifyReply
) {
  try {
    // Validate params
    const params = scanIdParamSchema.parse(request.params);

    // Get AI status
    const aiStatus = await getAiStatus(params.id);

    if (!aiStatus) {
      return reply.code(404).send({
        success: false,
        error: 'Scan not found',
        code: 'SCAN_NOT_FOUND',
      });
    }

    // Add caching headers for polling optimization
    // - Cache for 5 seconds if AI is still processing
    // - Cache for 1 hour if AI is completed or failed
    const cacheMaxAge =
      aiStatus.status === 'COMPLETED' || aiStatus.status === 'FAILED' ? 3600 : 5;

    reply.header('Cache-Control', `public, max-age=${cacheMaxAge}`);

    // Build response with metrics grouped
    const responseData: any = {
      scanId: aiStatus.scanId,
      aiEnabled: aiStatus.aiEnabled,
      status: aiStatus.status,
    };

    // Only include summary/plan if completed
    if (aiStatus.status === 'COMPLETED') {
      responseData.summary = aiStatus.summary;
      responseData.remediationPlan = aiStatus.remediationPlan;
      responseData.processedAt = aiStatus.processedAt?.toISOString() ?? null;

      // Include metrics if available
      if (aiStatus.inputTokens !== null && aiStatus.outputTokens !== null) {
        responseData.metrics = {
          inputTokens: aiStatus.inputTokens,
          outputTokens: aiStatus.outputTokens,
          totalTokens: aiStatus.totalTokens,
          model: aiStatus.model,
          processingTime: aiStatus.processingTime,
        };
      }
    }

    return reply.code(200).send({
      success: true,
      data: responseData,
    });
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid scan ID',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in getAiStatusHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * GET /api/v1/scans
 *
 * List scans for current session with pagination.
 *
 * Middleware chain:
 * 1. session - Validates session
 * 2. handler - Returns scan history
 *
 * @param request - Fastify request with pagination query
 * @param reply - Fastify reply
 * @returns Paginated list of scans
 *
 * @example
 * GET /api/v1/scans?limit=10&cursor=scan_xyz789
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "scans": [...],
 *     "nextCursor": "scan_abc123",
 *     "total": 42
 *   }
 * }
 */
async function listScansHandler(
  request: FastifyRequest<{ Querystring: ListScansQuery }>,
  reply: FastifyReply
) {
  try {
    // Validate query params
    const query = listScansQuerySchema.parse(request.query);

    // Check session exists
    if (!request.guestSession) {
      return reply.code(401).send({
        success: false,
        error: 'Unauthorized',
        message: 'Valid session required',
        code: 'SESSION_REQUIRED',
      });
    }

    // List scans for session
    const result = await listScans(request.guestSession.id, {
      cursor: query.cursor,
      limit: query.limit,
    });

    return reply.code(200).send({
      success: true,
      data: {
        scans: result.items.map((scan) => ({
          id: scan.id,
          url: scan.url,
          status: scan.status,
          wcagLevel: scan.wcagLevel,
          createdAt: scan.createdAt.toISOString(),
          completedAt: scan.completedAt?.toISOString() ?? null,
        })),
        nextCursor: result.nextCursor ?? null,
        total: result.totalCount,
      },
    });
  } catch (error) {
    // Handle service errors (check by name property for better test compatibility)
    if (error instanceof Error && error.name === 'ScanServiceError' && 'code' in error) {
      const statusCode = getStatusCodeForScanError(error.code as string);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid query parameters',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in listScansHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * DELETE /api/v1/scans/bulk
 *
 * Bulk delete scans for current session.
 *
 * Middleware chain:
 * 1. session - Validates session
 * 2. handler - Deletes scans in transaction
 *
 * @param request - Fastify request with scan IDs array
 * @param reply - Fastify reply
 * @returns Deletion summary
 *
 * @example
 * DELETE /api/v1/scans/bulk
 * Body: {
 *   "scanIds": ["scan_abc123", "scan_xyz789"]
 * }
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "deleted": 2,
 *     "failed": []
 *   }
 * }
 */
async function bulkDeleteScansHandler(
  request: FastifyRequest<{ Body: BulkDeleteBody }>,
  reply: FastifyReply
) {
  try {
    // Validate request body
    const body = bulkDeleteBodySchema.parse(request.body);

    // Check session exists
    if (!request.guestSession) {
      return reply.code(401).send({
        success: false,
        error: 'Unauthorized',
        message: 'Valid session required',
        code: 'SESSION_REQUIRED',
      });
    }

    // Bulk delete scans
    const result = await bulkDeleteScans(
      body.scanIds,
      request.guestSession.id
    );

    return reply.code(200).send({
      success: true,
      data: {
        deleted: result.deleted,
        failed: result.failed,
      },
    });
  } catch (error) {
    // Handle service errors (check by name property for better test compatibility)
    if (error instanceof Error && error.name === 'ScanServiceError' && 'code' in error) {
      const statusCode = getStatusCodeForScanError(error.code as string);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid request body',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in bulkDeleteScansHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * Map scan service error codes to HTTP status codes
 */
function getStatusCodeForScanError(code: string): number {
  switch (code) {
    case 'INVALID_URL':
    case 'INVALID_INPUT':
      return 400;
    case 'SCAN_NOT_FOUND':
      return 404;
    case 'SCAN_NOT_COMPLETE':
      return 409; // Conflict - scan not ready yet
    case 'CREATE_FAILED':
    case 'GET_FAILED':
    case 'LIST_FAILED':
      return 500;
    default:
      return 500;
  }
}

/**
 * Map result service error codes to HTTP status codes
 */
function getStatusCodeForResultError(code: string): number {
  switch (code) {
    case 'SCAN_NOT_COMPLETED':
    case 'RESULT_DATA_MISSING':
    case 'COMPLETED_AT_MISSING':
      return 409; // Conflict - scan not ready
    case 'GET_RESULT_FAILED':
      return 500;
    default:
      return 500;
  }
}

/**
 * Register scan routes
 *
 * @param fastify - Fastify instance
 * @param prefix - API prefix (e.g., '/api/v1')
 */
export async function registerScanRoutes(
  fastify: FastifyInstance,
  prefix: string
): Promise<void> {
  // POST /api/v1/scans - Create new scan
  // Middleware: session → recaptcha → rateLimit → handler
  fastify.post(
    `${prefix}/scans`,
    {
      preHandler: [sessionMiddleware, recaptchaMiddleware, rateLimitMiddleware],
    },
    createScanHandler as any
  );

  // GET /api/v1/scans/:id - Get scan status
  // Middleware: session → handler
  fastify.get(
    `${prefix}/scans/:id`,
    {
      preHandler: [sessionMiddleware],
    },
    getScanStatusHandler as any
  );

  // GET /api/v1/scans/:id/result - Get scan results
  // Middleware: session → handler
  fastify.get(
    `${prefix}/scans/:id/result`,
    {
      preHandler: [sessionMiddleware],
    },
    getScanResultHandler as any
  );

  // GET /api/v1/scans/:id/ai-status - Get AI analysis status
  // Middleware: session → handler
  fastify.get(
    `${prefix}/scans/:id/ai-status`,
    {
      preHandler: [sessionMiddleware],
    },
    getAiStatusHandler as any
  );

  // GET /api/v1/scans - List scans for session
  // Middleware: session → handler
  fastify.get(
    `${prefix}/scans`,
    {
      preHandler: [sessionMiddleware],
    },
    listScansHandler as any
  );

  // DELETE /api/v1/scans/bulk - Bulk delete scans
  // Middleware: session → handler
  fastify.delete(
    `${prefix}/scans/bulk`,
    {
      preHandler: [sessionMiddleware],
    },
    bulkDeleteScansHandler as any
  );

  fastify.log.info('✅ Scan routes registered');
}

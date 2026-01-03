/**
 * AI Queue Controller
 *
 * Fastify route handlers for AI queue management operations.
 * Implements admin-only endpoints for queue monitoring, export, import, and retry.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import { z } from 'zod';
import {
  exportPendingScans,
  importAiResults,
  getQueueStats,
  listAiScans,
  retryFailedScan,
  AiQueueServiceError,
  type ExportPendingScansResult,
  type QueueStats,
  type PaginatedAiScans,
  type RetryResult,
} from './ai-queue.service.js';
import { adminAuthMiddleware } from '../admin/admin.middleware.js';
import { aiScanFiltersSchema } from './ai-campaign.schema.js';
import type { AiScanFilters } from './ai-campaign.types.js';

/**
 * Map error codes to HTTP status codes
 */
function getStatusCodeForError(errorCode: string): number {
  switch (errorCode) {
    case 'NO_PENDING_SCANS':
      return 404;
    case 'SCAN_NOT_FOUND':
      return 404;
    case 'INVALID_INPUT':
    case 'VALIDATION_FAILED':
    case 'EMPTY_CSV':
    case 'PARSE_FAILED':
      return 400;
    case 'AI_NOT_ENABLED':
    case 'INVALID_AI_STATUS':
      return 422;
    default:
      return 500;
  }
}

/**
 * GET /api/v1/admin/ai-queue
 *
 * List AI scans with filters.
 *
 * Admin-only endpoint with filters for status and date range.
 * Uses cursor-based pagination for efficient querying.
 *
 * Middleware chain:
 * 1. adminAuth - Admin authentication required
 * 2. handler - Returns paginated AI scans
 *
 * @param request - Fastify request with query parameters
 * @param reply - Fastify reply
 * @returns Paginated list of AI scans
 *
 * @example
 * GET /api/v1/admin/ai-queue?status=PENDING,DOWNLOADED&limit=50
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "items": [
 *       {
 *         "id": "scan-uuid",
 *         "url": "https://example.com",
 *         "email": "user@example.com",
 *         "wcagLevel": "AA",
 *         "aiStatus": "PENDING",
 *         "aiSummary": null,
 *         "aiTotalTokens": null,
 *         "aiModel": null,
 *         "aiProcessedAt": null,
 *         "createdAt": "2025-01-15T10:30:00Z"
 *       }
 *     ],
 *     "nextCursor": "next-scan-uuid",
 *     "totalCount": 150
 *   }
 * }
 */
async function listAiScansHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Validate query parameters with schema
    const filters = aiScanFiltersSchema.parse(request.query);

    // Get paginated scans
    const result: PaginatedAiScans = await listAiScans(filters);

    return reply.code(200).send({
      success: true,
      data: result,
    });
  } catch (error) {
    // Handle Zod validation errors
    if (error && typeof error === 'object' && 'errors' in error) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid query parameters',
        details: error,
      });
    }

    // Handle service errors
    if (error instanceof AiQueueServiceError) {
      const statusCode = getStatusCodeForError(error.code);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle unexpected errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ AI Queue Controller: Failed to list AI scans:', err.message);
    return reply.code(500).send({
      success: false,
      error: 'Failed to list AI scans',
    });
  }
}

/**
 * GET /api/v1/admin/ai-queue/export
 *
 * Export pending AI scans to CSV.
 *
 * Admin-only endpoint that generates CSV of pending scans and updates
 * their status to DOWNLOADED atomically.
 *
 * Middleware chain:
 * 1. adminAuth - Admin authentication required
 * 2. handler - Exports pending scans as CSV
 *
 * @param request - Fastify request
 * @param reply - Fastify reply
 * @returns CSV file download
 *
 * @example
 * GET /api/v1/admin/ai-queue/export
 *
 * Response 200:
 * Content-Type: text/csv
 * Content-Disposition: attachment; filename="ai-scans-pending-2025-01-15.csv"
 * scan_id,url,email,wcag_level,issues_json,created_at,page_title
 * "uuid","https://example.com","user@example.com",...
 */
async function exportPendingScansHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Export pending scans and update status to DOWNLOADED
    const result: ExportPendingScansResult = await exportPendingScans();

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `ai-scans-pending-${timestamp}.csv`;

    // Set headers for CSV download
    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .code(200)
      .send(result.csv);
  } catch (error) {
    // Handle service errors
    if (error instanceof AiQueueServiceError) {
      const statusCode = getStatusCodeForError(error.code);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle unexpected errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ AI Queue Controller: Failed to export pending scans:', err.message);
    return reply.code(500).send({
      success: false,
      error: 'Failed to export pending scans',
    });
  }
}

/**
 * POST /api/v1/admin/ai-queue/import
 *
 * Upload AI results CSV.
 *
 * Admin-only endpoint that accepts CSV file upload with AI-processed results.
 * Validates CSV format and imports results into the database atomically.
 *
 * Middleware chain:
 * 1. adminAuth - Admin authentication required
 * 2. handler - Processes multipart upload and imports results
 *
 * @param request - Fastify request with multipart file
 * @param reply - Fastify reply
 * @returns Import result summary
 *
 * @example
 * POST /api/v1/admin/ai-queue/import
 * Content-Type: multipart/form-data
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "totalRows": 50,
 *     "successCount": 48,
 *     "failureCount": 2,
 *     "errors": [
 *       {
 *         "scanId": "invalid-uuid",
 *         "error": "Scan not found"
 *       }
 *     ]
 *   }
 * }
 */
async function importAiResultsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Get the uploaded file from multipart request
    const data = await request.file();

    if (!data) {
      return reply.code(400).send({
        success: false,
        error: 'No file uploaded. Please upload a CSV file.',
      });
    }

    // Validate file type
    const file = data as MultipartFile;
    const mimeType = file.mimetype;

    if (mimeType !== 'text/csv' && !mimeType.includes('csv')) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid file type. Please upload a CSV file.',
      });
    }

    // Read file buffer
    const buffer = await file.toBuffer();
    const csv = buffer.toString('utf-8');

    // Import AI results
    const result = await importAiResults(csv);

    return reply.code(200).send({
      success: true,
      data: result,
    });
  } catch (error) {
    // Handle service errors
    if (error instanceof AiQueueServiceError) {
      const statusCode = getStatusCodeForError(error.code);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle unexpected errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ AI Queue Controller: Failed to import AI results:', err.message);
    return reply.code(500).send({
      success: false,
      error: 'Failed to import AI results',
    });
  }
}

/**
 * GET /api/v1/admin/ai-queue/stats
 *
 * Get queue statistics.
 *
 * Admin-only endpoint that returns comprehensive queue statistics including
 * counts by status and total token usage.
 *
 * Middleware chain:
 * 1. adminAuth - Admin authentication required
 * 2. handler - Returns queue statistics
 *
 * @param request - Fastify request
 * @param reply - Fastify reply
 * @returns Queue statistics
 *
 * @example
 * GET /api/v1/admin/ai-queue/stats
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "totalScans": 250,
 *     "byStatus": {
 *       "PENDING": 50,
 *       "DOWNLOADED": 20,
 *       "PROCESSING": 10,
 *       "COMPLETED": 150,
 *       "FAILED": 20
 *     },
 *     "totalTokensUsed": 675000,
 *     "avgTokensPerScan": 4500
 *   }
 * }
 */
async function getQueueStatsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const stats: QueueStats = await getQueueStats();

    return reply.code(200).send({
      success: true,
      data: stats,
    });
  } catch (error) {
    // Handle service errors
    if (error instanceof AiQueueServiceError) {
      const statusCode = getStatusCodeForError(error.code);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle unexpected errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ AI Queue Controller: Failed to get queue stats:', err.message);
    return reply.code(500).send({
      success: false,
      error: 'Failed to get queue statistics',
    });
  }
}

/**
 * POST /api/v1/admin/ai-queue/:scanId/retry
 *
 * Retry failed AI scan.
 *
 * Admin-only endpoint that resets a failed scan's status to PENDING
 * so it can be re-exported and processed again.
 *
 * Middleware chain:
 * 1. adminAuth - Admin authentication required
 * 2. handler - Retries failed scan
 *
 * @param request - Fastify request with scanId parameter
 * @param reply - Fastify reply
 * @returns Retry result
 *
 * @example
 * POST /api/v1/admin/ai-queue/550e8400-e29b-41d4-a716-446655440000/retry
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "success": true,
 *     "aiStatus": "PENDING",
 *     "message": "Scan reset to PENDING and ready for retry"
 *   }
 * }
 */
async function retryFailedScanHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const params = request.params as { scanId: string };
    const { scanId } = params;

    // Validate scanId format (basic UUID check)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(scanId)) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid scan ID format. Must be a valid UUID.',
      });
    }

    // Retry the scan
    const result: RetryResult = await retryFailedScan(scanId);

    // If retry was not successful (e.g., scan not in FAILED status)
    if (!result.success) {
      return reply.code(422).send({
        success: false,
        error: result.message,
        aiStatus: result.aiStatus,
      });
    }

    return reply.code(200).send({
      success: true,
      data: result,
    });
  } catch (error) {
    // Handle service errors
    if (error instanceof AiQueueServiceError) {
      const statusCode = getStatusCodeForError(error.code);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle unexpected errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ AI Queue Controller: Failed to retry scan:', err.message);
    return reply.code(500).send({
      success: false,
      error: 'Failed to retry scan',
    });
  }
}

/**
 * Register AI Queue routes
 *
 * Registers all AI queue management routes with the Fastify instance.
 * All routes are protected with admin authentication middleware.
 *
 * @param fastify - Fastify instance
 *
 * @example
 * ```typescript
 * import { registerAiQueueRoutes } from './ai-queue.controller.js';
 *
 * async function setupRoutes(fastify: FastifyInstance) {
 *   await registerAiQueueRoutes(fastify);
 * }
 * ```
 */
export async function registerAiQueueRoutes(
  fastify: FastifyInstance
): Promise<void> {
  // GET /api/v1/admin/ai-queue - List AI scans with filters
  fastify.get(
    '/api/v1/admin/ai-queue',
    {
      preHandler: adminAuthMiddleware,
    },
    listAiScansHandler
  );

  // GET /api/v1/admin/ai-queue/export - Export pending scans CSV
  fastify.get(
    '/api/v1/admin/ai-queue/export',
    {
      preHandler: adminAuthMiddleware,
    },
    exportPendingScansHandler
  );

  // POST /api/v1/admin/ai-queue/import - Upload AI results CSV
  fastify.post(
    '/api/v1/admin/ai-queue/import',
    {
      preHandler: adminAuthMiddleware,
    },
    importAiResultsHandler
  );

  // GET /api/v1/admin/ai-queue/stats - Queue statistics
  fastify.get(
    '/api/v1/admin/ai-queue/stats',
    {
      preHandler: adminAuthMiddleware,
    },
    getQueueStatsHandler
  );

  // POST /api/v1/admin/ai-queue/:scanId/retry - Retry failed scan
  fastify.post(
    '/api/v1/admin/ai-queue/:scanId/retry',
    {
      preHandler: adminAuthMiddleware,
    },
    retryFailedScanHandler
  );

  console.log('✅ AI Queue Controller: Routes registered');
}

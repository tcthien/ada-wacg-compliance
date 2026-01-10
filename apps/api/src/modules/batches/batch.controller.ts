/**
 * Batch Controller
 *
 * Fastify route handlers for batch scan operations.
 * Implements middleware chain: session → reCAPTCHA → rate limit → handler
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  createBatch,
  getBatchStatus,
  getBatchResults,
  cancelBatch,
  listBatches,
  BatchServiceError,
  type CreateBatchInput,
} from './batch.service.js';
import { CreateBatchRequestSchema, BatchIdParamSchema, PaginationSchema } from './batch.schema.js';
import {
  generateBatchPdf,
  BatchExportError,
  requestBatchExport,
  getBatchExportStatus,
} from './batch-export.service.js';
import { sessionMiddleware } from '../../shared/middleware/session.js';
import { recaptchaMiddleware } from '../../shared/middleware/recaptcha.js';
import { rateLimitMiddleware } from '../../shared/middleware/rate-limit.js';

/**
 * Request body type for creating a batch scan
 */
type CreateBatchBody = z.infer<typeof CreateBatchRequestSchema>;

/**
 * Type for batch ID params
 */
type BatchIdParams = z.infer<typeof BatchIdParamSchema>;

/**
 * Type for pagination query params
 */
type PaginationQuery = z.infer<typeof PaginationSchema>;

/**
 * POST /api/v1/batches
 *
 * Create a new batch accessibility scan for multiple URLs.
 *
 * Middleware chain:
 * 1. session - Creates/retrieves guest session
 * 2. recaptcha - Validates reCAPTCHA token
 * 3. rateLimit - Checks rate limit
 * 4. handler - Creates batch and queues jobs
 *
 * @param request - Fastify request with CreateBatchBody
 * @param reply - Fastify reply
 * @returns Batch ID and initial status
 *
 * @example
 * POST /api/v1/batches
 * Body: {
 *   "urls": [
 *     "https://example.com",
 *     "https://example.com/about",
 *     "https://example.com/contact"
 *   ],
 *   "wcagLevel": "AA",
 *   "recaptchaToken": "abc123..."
 * }
 *
 * Response 201:
 * {
 *   "success": true,
 *   "data": {
 *     "batchId": "batch_abc123",
 *     "status": "RUNNING",
 *     "totalUrls": 3,
 *     "homepageUrl": "https://example.com",
 *     "scanIds": ["scan_1", "scan_2", "scan_3"]
 *   }
 * }
 */
async function createBatchHandler(
  request: FastifyRequest<{ Body: CreateBatchBody }>,
  reply: FastifyReply
) {
  try {
    // Validate request body
    const body = CreateBatchRequestSchema.parse(request.body);

    // Check session exists (set by session middleware)
    if (!request.guestSession) {
      return reply.code(401).send({
        success: false,
        error: 'Unauthorized',
        message: 'Valid session required',
        code: 'SESSION_REQUIRED',
      });
    }

    // Create batch input
    const batchInput: CreateBatchInput = {
      urls: body.urls,
      wcagLevel: body.wcagLevel,
      guestSessionId: request.guestSession.id,
      email: body.email,
      aiEnabled: body.aiEnabled,
    };

    // Create batch via service
    const result = await createBatch(batchInput);

    return reply.code(201).send({
      success: true,
      data: {
        batchId: result.batch.id,
        status: result.batch.status,
        totalUrls: result.batch.totalUrls,
        homepageUrl: result.batch.homepageUrl,
        scanIds: result.scans.map((scan) => scan.id),
      },
    });
  } catch (error) {
    // Handle service errors (check by name property for better test compatibility)
    if (error instanceof Error && error.name === 'BatchServiceError' && 'code' in error) {
      const statusCode = getStatusCodeForBatchError(error.code as string);
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
    request.log.error(error, 'Unexpected error in createBatchHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * GET /api/v1/batches/:id
 *
 * Get batch scan status and progress.
 *
 * Middleware chain:
 * 1. session - Validates session
 * 2. handler - Returns batch status
 *
 * @param request - Fastify request with batch ID param
 * @param reply - Fastify reply
 * @returns Batch status and progress
 *
 * @example
 * GET /api/v1/batches/batch_abc123
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "batchId": "batch_abc123",
 *     "status": "RUNNING",
 *     "totalUrls": 10,
 *     "completedCount": 7,
 *     "failedCount": 1,
 *     "homepageUrl": "https://example.com",
 *     "wcagLevel": "AA",
 *     "createdAt": "2025-12-29T12:00:00.000Z",
 *     "completedAt": null,
 *     "urls": [
 *       {
 *         "id": "scan_1",
 *         "url": "https://example.com",
 *         "status": "COMPLETED",
 *         "pageTitle": "Example Domain",
 *         "completedAt": "2025-12-29T12:05:00.000Z",
 *         "errorMessage": null
 *       },
 *       ...
 *     ]
 *   }
 * }
 */
async function getBatchStatusHandler(
  request: FastifyRequest<{ Params: BatchIdParams }>,
  reply: FastifyReply
) {
  try {
    // Validate params
    const params = BatchIdParamSchema.parse(request.params);

    // Check session exists
    if (!request.guestSession) {
      return reply.code(401).send({
        success: false,
        error: 'Unauthorized',
        message: 'Valid session required',
        code: 'SESSION_REQUIRED',
      });
    }

    // Get batch status
    const status = await getBatchStatus(params.id, request.guestSession.id);

    return reply.code(200).send({
      success: true,
      data: {
        batchId: status.batchId,
        status: status.status,
        totalUrls: status.totalUrls,
        completedCount: status.completedCount,
        failedCount: status.failedCount,
        homepageUrl: status.homepageUrl,
        wcagLevel: status.wcagLevel,
        createdAt: status.createdAt.toISOString(),
        completedAt: status.completedAt?.toISOString() ?? null,
        urls: status.urls.map((url) => ({
          id: url.id,
          url: url.url,
          status: url.status,
          pageTitle: url.pageTitle,
          completedAt: url.completedAt?.toISOString() ?? null,
          errorMessage: url.errorMessage,
        })),
      },
    });
  } catch (error) {
    // Handle service errors (check by name property for better test compatibility)
    if (error instanceof Error && error.name === 'BatchServiceError' && 'code' in error) {
      const statusCode = getStatusCodeForBatchError(error.code as string);
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
        error: 'Invalid batch ID',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in getBatchStatusHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * Query string schema for status filter
 */
const StatusFilterQuerySchema = z.object({
  status: z.enum(['COMPLETED', 'FAILED', 'RUNNING', 'PENDING', 'CANCELLED']).optional(),
});

/**
 * Type for status filter query params
 */
type StatusFilterQuery = z.infer<typeof StatusFilterQuerySchema>;

/**
 * GET /api/v1/batches/:id/results?status=COMPLETED
 *
 * Get batch scan results with aggregate statistics and optional status filtering.
 *
 * Middleware chain:
 * 1. session - Validates session
 * 2. handler - Returns batch results with aggregate stats
 *
 * Query Parameters:
 * - status (optional): Filter results by scan status (COMPLETED, FAILED, RUNNING, PENDING, CANCELLED)
 *
 * @param request - Fastify request with batch ID param and optional status query
 * @param reply - Fastify reply
 * @returns Batch results with aggregate and per-URL statistics
 *
 * @example
 * GET /api/v1/batches/batch_abc123/results
 * GET /api/v1/batches/batch_abc123/results?status=COMPLETED
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "batchId": "batch_abc123",
 *     "status": "COMPLETED",
 *     "totalUrls": 10,
 *     "completedCount": 9,
 *     "failedCount": 1,
 *     "homepageUrl": "https://example.com",
 *     "wcagLevel": "AA",
 *     "createdAt": "2025-12-29T12:00:00.000Z",
 *     "completedAt": "2025-12-29T12:30:00.000Z",
 *     "aggregate": {
 *       "totalIssues": 125,
 *       "criticalCount": 15,
 *       "seriousCount": 35,
 *       "moderateCount": 50,
 *       "minorCount": 25,
 *       "passedChecks": 450,
 *       "urlsScanned": 9
 *     },
 *     "urls": [...],
 *     "topCriticalUrls": [...]
 *   }
 * }
 */
async function getBatchResultsHandler(
  request: FastifyRequest<{ Params: BatchIdParams; Querystring: StatusFilterQuery }>,
  reply: FastifyReply
) {
  try {
    // Validate params and query
    const params = BatchIdParamSchema.parse(request.params);
    const query = StatusFilterQuerySchema.parse(request.query);

    // Check session exists
    if (!request.guestSession) {
      return reply.code(401).send({
        success: false,
        error: 'Unauthorized',
        message: 'Valid session required',
        code: 'SESSION_REQUIRED',
      });
    }

    // Get batch results
    const results = await getBatchResults(params.id, request.guestSession.id);

    // Filter URLs by status if query parameter provided
    let filteredUrls = results.urls;
    if (query.status) {
      filteredUrls = results.urls.filter((url) => url.status === query.status);
    }

    // Recalculate aggregate statistics if filtering was applied
    let aggregate = results.aggregate;
    if (query.status && query.status === 'COMPLETED') {
      // Recalculate aggregate based on filtered URLs
      const recalculatedAggregate = {
        totalIssues: 0,
        criticalCount: 0,
        seriousCount: 0,
        moderateCount: 0,
        minorCount: 0,
        passedChecks: 0,
        urlsScanned: 0,
      };

      filteredUrls.forEach((url) => {
        if (url.status === 'COMPLETED') {
          recalculatedAggregate.totalIssues += url.totalIssues;
          recalculatedAggregate.criticalCount += url.criticalCount;
          recalculatedAggregate.seriousCount += url.seriousCount;
          recalculatedAggregate.moderateCount += url.moderateCount;
          recalculatedAggregate.minorCount += url.minorCount;
          recalculatedAggregate.urlsScanned++;
        }
      });

      aggregate = recalculatedAggregate;
    }

    return reply.code(200).send({
      success: true,
      data: {
        batchId: results.batchId,
        status: results.status,
        totalUrls: results.totalUrls,
        completedCount: results.completedCount,
        failedCount: results.failedCount,
        homepageUrl: results.homepageUrl,
        wcagLevel: results.wcagLevel,
        createdAt: results.createdAt.toISOString(),
        completedAt: results.completedAt?.toISOString() ?? null,
        aggregate,
        urls: filteredUrls,
        topCriticalUrls: results.topCriticalUrls,
        filtered: query.status ? true : false,
        filterStatus: query.status ?? null,
      },
    });
  } catch (error) {
    // Handle service errors (check by name property for better test compatibility)
    if (error instanceof Error && error.name === 'BatchServiceError' && 'code' in error) {
      const statusCode = getStatusCodeForBatchError(error.code as string);
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
        error: 'Invalid batch ID',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in getBatchResultsHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * POST /api/v1/batches/:id/cancel
 *
 * Cancel a batch scan and all its pending/running scans.
 *
 * Middleware chain:
 * 1. session - Validates session
 * 2. handler - Cancels batch and returns summary
 *
 * @param request - Fastify request with batch ID param
 * @param reply - Fastify reply
 * @returns Cancellation summary with counts
 *
 * @example
 * POST /api/v1/batches/batch_abc123/cancel
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "batchId": "batch_abc123",
 *     "status": "CANCELLED",
 *     "completedCount": 5,
 *     "cancelledCount": 3,
 *     "failedToCancel": 0,
 *     "message": "Cancelled 3 scans, preserved 5 completed scans",
 *     "cancelledAt": "2025-12-29T12:15:00.000Z"
 *   }
 * }
 */
async function cancelBatchHandler(
  request: FastifyRequest<{ Params: BatchIdParams }>,
  reply: FastifyReply
) {
  try {
    // Validate params
    const params = BatchIdParamSchema.parse(request.params);

    // Check session exists
    if (!request.guestSession) {
      return reply.code(401).send({
        success: false,
        error: 'Unauthorized',
        message: 'Valid session required',
        code: 'SESSION_REQUIRED',
      });
    }

    // Cancel batch
    const result = await cancelBatch(params.id, request.guestSession.id);

    return reply.code(200).send({
      success: true,
      data: {
        batchId: result.batchId,
        status: result.status,
        completedCount: result.completedCount,
        cancelledCount: result.cancelledCount,
        failedToCancel: result.failedToCancel,
        message: result.message,
        cancelledAt: result.cancelledAt.toISOString(),
      },
    });
  } catch (error) {
    // Handle service errors (check by name property for better test compatibility)
    if (error instanceof Error && error.name === 'BatchServiceError' && 'code' in error) {
      const statusCode = getStatusCodeForBatchError(error.code as string);
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
        error: 'Invalid batch ID',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in cancelBatchHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * GET /api/v1/batches
 *
 * List batch scans for current session with pagination.
 *
 * Middleware chain:
 * 1. session - Validates session
 * 2. handler - Returns paginated batch list
 *
 * @param request - Fastify request with optional pagination query params
 * @param reply - Fastify reply
 * @returns Paginated list of batches
 *
 * @example
 * GET /api/v1/batches?page=1&limit=20
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "batches": [
 *       {
 *         "id": "batch_abc123",
 *         "homepageUrl": "https://example.com",
 *         "totalUrls": 10,
 *         "status": "COMPLETED",
 *         "completedCount": 9,
 *         "failedCount": 1,
 *         "totalIssues": 125,
 *         "criticalCount": 15,
 *         "seriousCount": 35,
 *         "moderateCount": 50,
 *         "minorCount": 25,
 *         "createdAt": "2025-12-29T12:00:00.000Z",
 *         "completedAt": "2025-12-29T12:30:00.000Z",
 *         "discoveryId": null
 *       },
 *       ...
 *     ],
 *     "pagination": {
 *       "page": 1,
 *       "limit": 20,
 *       "total": 42,
 *       "totalPages": 3
 *     }
 *   }
 * }
 */
async function listBatchesHandler(
  request: FastifyRequest<{ Querystring: PaginationQuery }>,
  reply: FastifyReply
) {
  try {
    // Check session exists
    if (!request.guestSession) {
      return reply.code(401).send({
        success: false,
        error: 'Unauthorized',
        message: 'Valid session required',
        code: 'SESSION_REQUIRED',
      });
    }

    // Parse and validate pagination params (with defaults)
    const pagination = PaginationSchema.parse(request.query);

    // List batches
    const result = await listBatches(request.guestSession.id, pagination);

    return reply.code(200).send({
      success: true,
      data: {
        batches: result.batches.map((batch) => ({
          batchId: batch.id,
          homepageUrl: batch.homepageUrl,
          wcagLevel: batch.wcagLevel,
          totalUrls: batch.totalUrls,
          status: batch.status,
          completedCount: batch.completedCount,
          failedCount: batch.failedCount,
          totalIssues: batch.totalIssues,
          criticalCount: batch.criticalCount,
          seriousCount: batch.seriousCount,
          moderateCount: batch.moderateCount,
          minorCount: batch.minorCount,
          createdAt: batch.createdAt.toISOString(),
          completedAt: batch.completedAt?.toISOString() ?? null,
          discoveryId: batch.discoveryId,
        })),
        pagination: result.pagination,
      },
    });
  } catch (error) {
    // Handle service errors (check by name property for better test compatibility)
    if (error instanceof Error && error.name === 'BatchServiceError' && 'code' in error) {
      const statusCode = getStatusCodeForBatchError(error.code as string);
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
        error: 'Invalid pagination parameters',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in listBatchesHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * Map batch service error codes to HTTP status codes
 */
function getStatusCodeForBatchError(code: string): number {
  switch (code) {
    case 'INVALID_URL':
    case 'INVALID_INPUT':
      return 400;
    case 'UNAUTHORIZED':
      return 403;
    case 'NOT_FOUND':
      return 404;
    case 'BATCH_SIZE_EXCEEDED':
      return 400;
    case 'INVALID_STATE':
      return 400;
    case 'CREATE_FAILED':
    case 'GET_FAILED':
    case 'QUEUE_FAILED':
    case 'CANCEL_FAILED':
    case 'LIST_FAILED':
      return 500;
    default:
      return 500;
  }
}

/**
 * Query string schema for export format
 */
const ExportFormatQuerySchema = z.object({
  format: z.enum(['pdf', 'json'], {
    errorMap: () => ({ message: 'Format must be pdf or json' }),
  }).default('pdf'),
});

/**
 * Type for export format query params
 */
type ExportFormatQuery = z.infer<typeof ExportFormatQuerySchema>;

/**
 * GET /api/v1/batches/:id/export?format=pdf|json
 *
 * Export batch results in PDF or JSON format.
 *
 * Uses async job-based generation with caching for efficiency.
 * If report already exists, returns presigned URL immediately (200).
 * If report needs to be generated, queues job and returns 202.
 *
 * Middleware chain:
 * 1. session - Validates session
 * 2. handler - Initiates export and returns status/URL
 *
 * @param request - Fastify request with batch ID param and format query
 * @param reply - Fastify reply with export status
 * @returns Export status with URL if ready, or 202 if generating
 *
 * Requirements:
 * - 1.1: User can export batch scan results in PDF format
 * - 1.4: Exports cached for 7 days
 * - 2.1: User can export batch scan results in JSON format
 * - 2.5: Async generation with job queue
 *
 * @example
 * GET /api/v1/batches/batch_abc123/export?format=pdf
 *
 * Response 200 (Ready):
 * {
 *   "success": true,
 *   "data": {
 *     "status": "ready",
 *     "url": "https://s3.../report.pdf?signed=...",
 *     "expiresAt": "2025-01-05T12:00:00.000Z",
 *     "reportId": "report_xyz789"
 *   }
 * }
 *
 * Response 202 (Generating):
 * {
 *   "success": true,
 *   "data": {
 *     "status": "generating",
 *     "reportId": "report_xyz789",
 *     "message": "Report is being generated. Poll the status endpoint for updates."
 *   }
 * }
 */
async function exportBatchHandler(
  request: FastifyRequest<{ Params: BatchIdParams; Querystring: ExportFormatQuery }>,
  reply: FastifyReply
) {
  try {
    // Validate params and query
    const params = BatchIdParamSchema.parse(request.params);
    const query = ExportFormatQuerySchema.parse(request.query);

    // Check session exists
    if (!request.guestSession) {
      return reply.code(401).send({
        success: false,
        error: 'Unauthorized',
        message: 'Valid session required',
        code: 'SESSION_REQUIRED',
      });
    }

    // Get batch status to verify ownership (not full results for efficiency)
    const batchStatus = await getBatchStatus(params.id, request.guestSession.id);

    // Check if batch is completed
    if (batchStatus.status !== 'COMPLETED') {
      return reply.code(409).send({
        success: false,
        error: 'Batch not completed',
        message: 'Export is only available for completed batches',
        code: 'BATCH_NOT_COMPLETED',
      });
    }

    // Request export using async service with caching
    const exportResponse = await requestBatchExport({
      batchId: params.id,
      format: query.format,
      guestSessionId: request.guestSession.id,
    });

    // Return based on export status
    switch (exportResponse.status) {
      case 'ready':
        // Report is ready - return 200 with presigned URL
        return reply.code(200).send({
          success: true,
          data: {
            status: 'ready',
            url: exportResponse.url,
            expiresAt: exportResponse.expiresAt,
            reportId: exportResponse.reportId,
          },
        });

      case 'generating':
        // Report is being generated - return 202 Accepted
        return reply.code(202).send({
          success: true,
          data: {
            status: 'generating',
            reportId: exportResponse.reportId,
            message: 'Report is being generated. Poll the status endpoint for updates.',
          },
        });

      case 'failed':
        // Previous generation failed - return 500
        return reply.code(500).send({
          success: false,
          error: 'Export generation failed',
          message: exportResponse.errorMessage ?? 'Failed to generate report',
          code: 'EXPORT_FAILED',
          reportId: exportResponse.reportId,
        });

      default:
        // Unknown status
        return reply.code(500).send({
          success: false,
          error: 'Unknown export status',
          code: 'UNKNOWN_STATUS',
        });
    }
  } catch (error) {
    // Handle service errors (check by name property for better test compatibility)
    if (error instanceof Error && error.name === 'BatchServiceError' && 'code' in error) {
      const statusCode = getStatusCodeForBatchError(error.code as string);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle export errors
    if (error instanceof Error && error.name === 'BatchExportError' && 'code' in error) {
      return reply.code(500).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid request parameters',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in exportBatchHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * GET /api/v1/batches/:id/export/status?format=pdf|json
 *
 * Get the status of a batch export generation.
 *
 * Use this endpoint to poll for async export completion.
 * Returns the presigned URL when the report is ready.
 *
 * Middleware chain:
 * 1. session - Validates session
 * 2. handler - Returns export status
 *
 * @param request - Fastify request with batch ID param and format query
 * @param reply - Fastify reply with export status
 * @returns Export status with URL if ready
 *
 * Requirements:
 * - 4.1, 4.2: Status polling for async generation
 *
 * @example
 * GET /api/v1/batches/batch_abc123/export/status?format=pdf
 *
 * Response 200 (Ready):
 * {
 *   "success": true,
 *   "data": {
 *     "status": "ready",
 *     "url": "https://s3.../report.pdf?signed=...",
 *     "expiresAt": "2025-01-05T12:00:00.000Z",
 *     "reportId": "report_xyz789"
 *   }
 * }
 *
 * Response 200 (Generating):
 * {
 *   "success": true,
 *   "data": {
 *     "status": "generating",
 *     "reportId": "report_xyz789"
 *   }
 * }
 *
 * Response 200 (Failed):
 * {
 *   "success": false,
 *   "data": {
 *     "status": "failed",
 *     "errorMessage": "...",
 *     "reportId": "report_xyz789"
 *   }
 * }
 */
async function getExportStatusHandler(
  request: FastifyRequest<{ Params: BatchIdParams; Querystring: ExportFormatQuery }>,
  reply: FastifyReply
) {
  try {
    // Validate params and query
    const params = BatchIdParamSchema.parse(request.params);
    const query = ExportFormatQuerySchema.parse(request.query);

    // Check session exists
    if (!request.guestSession) {
      return reply.code(401).send({
        success: false,
        error: 'Unauthorized',
        message: 'Valid session required',
        code: 'SESSION_REQUIRED',
      });
    }

    // Verify batch ownership by getting status (this will throw if not authorized)
    await getBatchStatus(params.id, request.guestSession.id);

    // Get export status
    const statusResponse = await getBatchExportStatus(params.id, query.format);

    // Return based on status
    switch (statusResponse.status) {
      case 'ready':
        return reply.code(200).send({
          success: true,
          data: {
            status: 'ready',
            url: statusResponse.url,
            expiresAt: statusResponse.expiresAt,
            reportId: statusResponse.reportId,
          },
        });

      case 'generating':
        return reply.code(200).send({
          success: true,
          data: {
            status: 'generating',
            reportId: statusResponse.reportId,
          },
        });

      case 'failed':
        return reply.code(200).send({
          success: false,
          data: {
            status: 'failed',
            errorMessage: statusResponse.errorMessage,
            reportId: statusResponse.reportId,
          },
        });

      default:
        return reply.code(200).send({
          success: false,
          data: {
            status: 'unknown',
          },
        });
    }
  } catch (error) {
    // Handle service errors (check by name property for better test compatibility)
    if (error instanceof Error && error.name === 'BatchServiceError' && 'code' in error) {
      const statusCode = getStatusCodeForBatchError(error.code as string);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle export errors
    if (error instanceof Error && error.name === 'BatchExportError' && 'code' in error) {
      return reply.code(500).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid request parameters',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in getExportStatusHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * Register batch routes
 *
 * @param fastify - Fastify instance
 * @param prefix - API prefix (e.g., '/api/v1')
 */
export async function registerBatchRoutes(
  fastify: FastifyInstance,
  prefix: string
): Promise<void> {
  // POST /api/v1/batches - Create new batch
  // Middleware: session → recaptcha → rateLimit → handler
  fastify.post(
    `${prefix}/batches`,
    {
      preHandler: [sessionMiddleware, recaptchaMiddleware, rateLimitMiddleware],
    },
    createBatchHandler as any
  );

  // GET /api/v1/batches - List batches for session
  // Middleware: session → handler
  fastify.get(
    `${prefix}/batches`,
    {
      preHandler: [sessionMiddleware],
    },
    listBatchesHandler as any
  );

  // GET /api/v1/batches/:id - Get batch status
  // Middleware: session → handler
  fastify.get(
    `${prefix}/batches/:id`,
    {
      preHandler: [sessionMiddleware],
    },
    getBatchStatusHandler as any
  );

  // GET /api/v1/batches/:id/results - Get batch results
  // Middleware: session → handler
  fastify.get(
    `${prefix}/batches/:id/results`,
    {
      preHandler: [sessionMiddleware],
    },
    getBatchResultsHandler as any
  );

  // GET /api/v1/batches/:id/export - Export batch results
  // Middleware: session → handler
  fastify.get(
    `${prefix}/batches/:id/export`,
    {
      preHandler: [sessionMiddleware],
    },
    exportBatchHandler as any
  );

  // GET /api/v1/batches/:id/export/status - Get export status
  // Middleware: session → handler
  fastify.get(
    `${prefix}/batches/:id/export/status`,
    {
      preHandler: [sessionMiddleware],
    },
    getExportStatusHandler as any
  );

  // POST /api/v1/batches/:id/cancel - Cancel batch
  // Middleware: session → handler
  fastify.post(
    `${prefix}/batches/:id/cancel`,
    {
      preHandler: [sessionMiddleware],
    },
    cancelBatchHandler as any
  );

  fastify.log.info('✅ Batch routes registered');
}

/**
 * Report Controller
 *
 * Fastify route handlers for report operations.
 * Implements middleware chain: session → handler
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  getOrGenerateReport,
  getReportStatus,
  ReportServiceError,
} from './report.service.js';
import { sessionMiddleware } from '../../shared/middleware/session.js';

/**
 * Route parameter schema for report download
 */
const reportParamsSchema = z.object({
  scanId: z.string().uuid('Invalid scan ID format'),
  format: z.enum(['pdf', 'json'], {
    errorMap: () => ({ message: 'Format must be pdf or json' }),
  }),
});

/**
 * Type for report params
 */
type ReportParams = z.infer<typeof reportParamsSchema>;

/**
 * Route parameter schema for report status
 */
const scanIdParamSchema = z.object({
  scanId: z.string().uuid('Invalid scan ID format'),
});

/**
 * Type for scan ID params
 */
type ScanIdParams = z.infer<typeof scanIdParamSchema>;

/**
 * GET /api/v1/reports/:scanId/:format
 *
 * Download or queue generation of a report.
 *
 * Middleware chain:
 * 1. session - Validates session
 * 2. handler - Returns report URL or queues generation
 *
 * @param request - Fastify request with scanId and format params
 * @param reply - Fastify reply
 * @returns Report URL (200), generation status (202), or error
 *
 * @example
 * GET /api/v1/reports/550e8400-e29b-41d4-a716-446655440000/pdf
 *
 * Response 200 (report exists):
 * {
 *   "success": true,
 *   "data": {
 *     "url": "https://s3.example.com/...",
 *     "expiresAt": "2025-12-26T13:00:00.000Z"
 *   }
 * }
 *
 * Response 202 (generating):
 * {
 *   "success": true,
 *   "data": {
 *     "status": "generating",
 *     "jobId": "12345"
 *   }
 * }
 */
async function getReportHandler(
  request: FastifyRequest<{ Params: ReportParams }>,
  reply: FastifyReply
) {
  try {
    // Validate params
    const params = reportParamsSchema.parse(request.params);

    // Check session exists
    if (!request.guestSession) {
      return reply.code(401).send({
        success: false,
        error: 'Unauthorized',
        message: 'Valid session required',
        code: 'SESSION_REQUIRED',
      });
    }

    // Get or generate report
    const result = await getOrGenerateReport(
      params.scanId,
      params.format,
      request.guestSession.id
    );

    // Handle result based on status
    switch (result.status) {
      case 'ready':
        return reply.code(200).send({
          success: true,
          data: {
            url: result.url,
            expiresAt: result.expiresAt?.toISOString(),
          },
        });

      case 'generating':
        return reply.code(202).send({
          success: true,
          data: {
            status: 'generating',
            jobId: result.jobId,
          },
        });

      case 'not_found':
        return reply.code(404).send({
          success: false,
          error: 'Scan not found',
          code: 'SCAN_NOT_FOUND',
        });

      default:
        // This should never happen due to TypeScript's exhaustive checking
        return reply.code(500).send({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR',
        });
    }
  } catch (error) {
    // Handle service errors (check by name property for better test compatibility)
    if (error instanceof Error && error.name === 'ReportServiceError' && 'code' in error) {
      const statusCode = getStatusCodeForReportError(error.code as string);
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
        error: 'Invalid request parameters',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in getReportHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * GET /api/v1/scans/:scanId/reports
 *
 * Get report status for both PDF and JSON formats.
 *
 * Middleware chain:
 * 1. session - Validates session
 * 2. handler - Returns report status for both formats
 *
 * @param request - Fastify request with scanId param
 * @param reply - Fastify reply
 * @returns Report status with download URLs for existing reports
 *
 * @example
 * GET /api/v1/scans/550e8400-e29b-41d4-a716-446655440000/reports
 *
 * Response 200 (scan completed with reports):
 * {
 *   "success": true,
 *   "data": {
 *     "scanId": "550e8400-e29b-41d4-a716-446655440000",
 *     "scanStatus": "COMPLETED",
 *     "reports": {
 *       "pdf": {
 *         "exists": true,
 *         "url": "https://s3.example.com/...",
 *         "createdAt": "2025-12-28T10:00:00.000Z",
 *         "fileSizeBytes": 204800,
 *         "expiresAt": "2025-12-28T11:00:00.000Z"
 *       },
 *       "json": {
 *         "exists": true,
 *         "url": "https://s3.example.com/...",
 *         "createdAt": "2025-12-28T10:00:00.000Z",
 *         "fileSizeBytes": 51200,
 *         "expiresAt": "2025-12-28T11:00:00.000Z"
 *       }
 *     }
 *   }
 * }
 *
 * Response 200 (scan completed, no reports yet):
 * {
 *   "success": true,
 *   "data": {
 *     "scanId": "550e8400-e29b-41d4-a716-446655440000",
 *     "scanStatus": "COMPLETED",
 *     "reports": {
 *       "pdf": null,
 *       "json": null
 *     }
 *   }
 * }
 */
async function getReportStatusHandler(
  request: FastifyRequest<{ Params: ScanIdParams }>,
  reply: FastifyReply
) {
  try {
    // Validate params
    const params = scanIdParamSchema.parse(request.params);

    // Check session exists
    if (!request.guestSession) {
      return reply.code(401).send({
        success: false,
        error: 'Unauthorized',
        message: 'Valid session required',
        code: 'SESSION_REQUIRED',
      });
    }

    // Get report status
    const status = await getReportStatus(
      params.scanId,
      request.guestSession.id
    );

    return reply.code(200).send({
      success: true,
      data: status,
    });
  } catch (error) {
    // Handle service errors (check by name property for better test compatibility)
    if (error instanceof Error && error.name === 'ReportServiceError' && 'code' in error) {
      const statusCode = getStatusCodeForReportError(error.code as string);
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
        error: 'Invalid request parameters',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in getReportStatusHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * Map report service error codes to HTTP status codes
 */
function getStatusCodeForReportError(code: string): number {
  switch (code) {
    case 'SCAN_NOT_FOUND':
      return 404;
    case 'FORBIDDEN':
      return 403;
    case 'SCAN_NOT_COMPLETED':
      return 409; // Conflict - scan not ready yet
    case 'GET_REPORT_FAILED':
    case 'CREATE_FAILED':
    case 'GET_REPORT_STATUS_FAILED':
      return 500;
    default:
      return 500;
  }
}

/**
 * Register report routes
 *
 * @param fastify - Fastify instance
 * @param prefix - API prefix (e.g., '/api/v1')
 */
export async function registerReportRoutes(
  fastify: FastifyInstance,
  prefix: string
): Promise<void> {
  // GET /api/v1/scans/:scanId/reports - Get report status for both formats
  // Middleware: session → handler
  fastify.get<{ Params: ScanIdParams }>(
    `${prefix}/scans/:scanId/reports`,
    {
      preHandler: [sessionMiddleware],
    },
    getReportStatusHandler
  );

  // GET /api/v1/reports/:scanId/:format - Get or generate report
  // Middleware: session → handler
  fastify.get<{ Params: ReportParams }>(
    `${prefix}/reports/:scanId/:format`,
    {
      preHandler: [sessionMiddleware],
    },
    getReportHandler
  );

  fastify.log.info('✅ Report routes registered');
}

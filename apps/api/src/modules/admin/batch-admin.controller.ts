/**
 * Batch Admin Controller
 *
 * Fastify route handlers for admin batch scan management operations.
 * Implements middleware chain: adminAuth → handler
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { AdminTokenPayload } from './admin.types.js';
import { z } from 'zod';
import { adminAuthMiddleware, requireSuperAdmin } from './admin.middleware.js';
import {
  batchListQuerySchema,
  batchIdParamSchema,
  batchExportQuerySchema,
  type BatchListQuery,
  type BatchIdParam,
  type BatchExportQuery,
} from './admin.schema.js';
import {
  listAllBatches,
  getBatchDetails,
  cancelBatch,
  deleteBatch,
  retryFailedScans,
  exportBatch,
  getBatchMetrics,
  BatchAdminServiceError,
  type BatchListFilters,
  type BatchListPagination,
} from './batch-admin.service.js';
import {
  requestBatchExport,
  getBatchExportStatus,
  BatchExportError,
} from '../batches/batch-export.service.js';
import {
  log as logAuditEvent,
} from './audit.service.js';

/**
 * GET /api/v1/admin/batches
 *
 * List all batch scans with optional filters and pagination.
 *
 * Middleware chain:
 * 1. adminAuthMiddleware - Requires admin authentication
 * 2. handler - Validates query parameters and returns paginated list
 *
 * @param request - Fastify request with BatchListQuery
 * @param reply - Fastify reply
 * @returns Paginated list of batch scans with counts
 *
 * @example
 * GET /api/v1/admin/batches?page=1&limit=20&status=COMPLETED
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "items": [
 *       {
 *         "id": "batch-uuid",
 *         "homepageUrl": "https://example.com",
 *         "totalUrls": 10,
 *         "completedCount": 8,
 *         "failedCount": 2,
 *         "status": "COMPLETED",
 *         "totalIssues": 45,
 *         "criticalCount": 5,
 *         "seriousCount": 10,
 *         "moderateCount": 20,
 *         "minorCount": 10,
 *         "createdAt": "2025-12-29T10:00:00.000Z",
 *         "completedAt": "2025-12-29T10:15:00.000Z",
 *         "guestSession": {
 *           "id": "session-uuid",
 *           "fingerprint": "fp123"
 *         }
 *       }
 *     ],
 *     "pagination": {
 *       "page": 1,
 *       "limit": 20,
 *       "total": 100,
 *       "totalPages": 5
 *     }
 *   }
 * }
 */
async function listBatchesHandler(
  request: FastifyRequest<{ Querystring: BatchListQuery }>,
  reply: FastifyReply
) {
  try {
    // Parse and validate query parameters
    const query = batchListQuerySchema.parse(request.query);

    // Build filters object
    const filters: BatchListFilters = {
      ...(query.status && { status: query.status }),
      ...(query.startDate && { startDate: new Date(query.startDate) }),
      ...(query.endDate && { endDate: new Date(query.endDate) }),
      ...(query.homepageUrl && { homepageUrl: query.homepageUrl }),
      ...(query.sessionId && { sessionId: query.sessionId }),
    };

    // Build pagination object
    const pagination: BatchListPagination = {
      page: query.page,
      limit: query.limit,
    };

    // Get paginated batch list
    const result = await listAllBatches(filters, pagination);

    // Transform response (serialize dates)
    const items = result.items.map((batch) => ({
      id: batch.id,
      homepageUrl: batch.homepageUrl,
      totalUrls: batch.totalUrls,
      completedCount: batch.completedCount,
      failedCount: batch.failedCount,
      status: batch.status,
      totalIssues: batch.totalIssues,
      criticalCount: batch.criticalCount,
      seriousCount: batch.seriousCount,
      moderateCount: batch.moderateCount,
      minorCount: batch.minorCount,
      createdAt: batch.createdAt.toISOString(),
      completedAt: batch.completedAt?.toISOString() ?? null,
      guestSession: batch.guestSession,
    }));

    // Log audit event (fire-and-forget)
    const admin = request.adminTokenPayload as AdminTokenPayload;
    logAuditEvent({
      adminId: admin.sub,
      action: 'BATCH_LIST_VIEW',
      targetType: 'BatchScan',
      details: {
        metadata: {
          filters,
          pagination: result.pagination,
        },
      },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? 'Unknown',
    }).catch((err) => {
      request.log.error(err, 'Failed to log BATCH_LIST_VIEW audit event');
    });

    return reply.code(200).send({
      success: true,
      data: {
        batches: items,
        pagination: result.pagination,
      },
    });
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid query parameters',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle batch admin service errors
    if (error instanceof BatchAdminServiceError) {
      const statusCode = getStatusCodeForBatchError(error.code);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in listBatchesHandler');
    return reply.code(500).send({
      success: false,
      error: 'Failed to list batch scans',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * GET /api/v1/admin/batches/:id
 *
 * Get detailed information about a specific batch scan.
 *
 * Middleware chain:
 * 1. adminAuthMiddleware - Requires admin authentication
 * 2. handler - Validates batch ID and returns full batch details
 *
 * @param request - Fastify request with BatchIdParam
 * @param reply - Fastify reply
 * @returns Batch details with scans, aggregate stats, and top critical URLs
 *
 * @example
 * GET /api/v1/admin/batches/550e8400-e29b-41d4-a716-446655440000
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "batch": {
 *       "id": "batch-uuid",
 *       "homepageUrl": "https://example.com",
 *       "wcagLevel": "AA",
 *       "status": "COMPLETED",
 *       "totalUrls": 10,
 *       "completedCount": 8,
 *       "failedCount": 2,
 *       "totalIssues": 45,
 *       "criticalCount": 5,
 *       "seriousCount": 10,
 *       "moderateCount": 20,
 *       "minorCount": 10,
 *       "createdAt": "2025-12-29T10:00:00.000Z",
 *       "completedAt": "2025-12-29T10:15:00.000Z"
 *     },
 *     "scans": [
 *       {
 *         "id": "scan-uuid",
 *         "url": "https://example.com/page1",
 *         "pageTitle": "Page 1",
 *         "status": "COMPLETED",
 *         "criticalCount": 2,
 *         "seriousCount": 4,
 *         "moderateCount": 8,
 *         "minorCount": 6,
 *         "totalIssues": 20,
 *         "errorMessage": null,
 *         "completedAt": "2025-12-29T10:05:00.000Z",
 *         "createdAt": "2025-12-29T10:00:00.000Z"
 *       }
 *     ],
 *     "aggregate": {
 *       "totalUrls": 10,
 *       "completedCount": 8,
 *       "failedCount": 2,
 *       "pendingCount": 0,
 *       "totalIssues": 45,
 *       "criticalCount": 5,
 *       "seriousCount": 10,
 *       "moderateCount": 20,
 *       "minorCount": 10
 *     },
 *     "topCriticalUrls": [
 *       {
 *         "url": "https://example.com/page1",
 *         "pageTitle": "Page 1",
 *         "criticalCount": 2,
 *         "totalIssues": 20
 *       }
 *     ],
 *     "sessionInfo": {
 *       "id": "session-uuid",
 *       "fingerprint": "fp123",
 *       "createdAt": "2025-12-29T09:00:00.000Z"
 *     }
 *   }
 * }
 */
async function getBatchDetailsHandler(
  request: FastifyRequest<{ Params: BatchIdParam }>,
  reply: FastifyReply
) {
  try {
    // Parse and validate route parameters
    const params = batchIdParamSchema.parse(request.params);

    // Get batch details
    const details = await getBatchDetails(params.id);

    // Transform response (serialize dates)
    const responseData = {
      batch: {
        id: details.batch.id,
        homepageUrl: details.batch.homepageUrl,
        wcagLevel: details.batch.wcagLevel,
        status: details.batch.status,
        totalUrls: details.batch.totalUrls,
        completedCount: details.batch.completedCount,
        failedCount: details.batch.failedCount,
        totalIssues: details.batch.totalIssues,
        criticalCount: details.batch.criticalCount,
        seriousCount: details.batch.seriousCount,
        moderateCount: details.batch.moderateCount,
        minorCount: details.batch.minorCount,
        createdAt: details.batch.createdAt.toISOString(),
        completedAt: details.batch.completedAt?.toISOString() ?? null,
        cancelledAt: details.batch.cancelledAt?.toISOString() ?? null,
        guestSessionId: details.batch.guestSessionId,
        userId: details.batch.userId,
      },
      scans: details.scans.map((scan) => ({
        id: scan.id,
        url: scan.url,
        pageTitle: scan.pageTitle,
        status: scan.status,
        criticalCount: scan.criticalCount,
        seriousCount: scan.seriousCount,
        moderateCount: scan.moderateCount,
        minorCount: scan.minorCount,
        totalIssues: scan.totalIssues,
        errorMessage: scan.errorMessage,
        completedAt: scan.completedAt?.toISOString() ?? null,
        createdAt: scan.createdAt.toISOString(),
      })),
      aggregate: details.aggregate,
      topCriticalUrls: details.topCriticalUrls,
      sessionInfo: details.sessionInfo
        ? {
            id: details.sessionInfo.id,
            fingerprint: details.sessionInfo.fingerprint,
            createdAt: details.sessionInfo.createdAt.toISOString(),
          }
        : null,
    };

    // Log audit event (fire-and-forget)
    const admin = request.adminTokenPayload as AdminTokenPayload;
    logAuditEvent({
      adminId: admin.sub,
      action: 'BATCH_DETAIL_VIEW',
      targetId: params.id,
      targetType: 'BatchScan',
      details: {
        metadata: {
          batchId: params.id,
          homepageUrl: details.batch.homepageUrl,
          status: details.batch.status,
        },
      },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? 'Unknown',
    }).catch((err) => {
      request.log.error(err, 'Failed to log BATCH_DETAIL_VIEW audit event');
    });

    return reply.code(200).send({
      success: true,
      data: responseData,
    });
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid batch ID',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle batch admin service errors
    if (error instanceof BatchAdminServiceError) {
      const statusCode = getStatusCodeForBatchError(error.code);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in getBatchDetailsHandler');
    return reply.code(500).send({
      success: false,
      error: 'Failed to get batch details',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * POST /api/v1/admin/batches/:id/cancel
 *
 * Cancel a batch scan and all its pending/running scans.
 *
 * Middleware chain:
 * 1. adminAuthMiddleware - Requires admin authentication
 * 2. handler - Validates batch ID and cancels batch
 *
 * @param request - Fastify request with BatchIdParam
 * @param reply - Fastify reply
 * @returns Cancellation summary with counts
 *
 * @example
 * POST /api/v1/admin/batches/550e8400-e29b-41d4-a716-446655440000/cancel
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "batchId": "batch-uuid",
 *     "status": "CANCELLED",
 *     "cancelledCount": 5,
 *     "preservedCount": 3,
 *     "message": "Cancelled 5 scans, preserved 3 completed scans"
 *   }
 * }
 */
async function cancelBatchHandler(
  request: FastifyRequest<{ Params: BatchIdParam }>,
  reply: FastifyReply
) {
  try {
    // Parse and validate route parameters
    const params = batchIdParamSchema.parse(request.params);
    const admin = request.adminTokenPayload as AdminTokenPayload;

    // Cancel batch
    const result = await cancelBatch(params.id, admin.sub);

    // Log audit event (fire-and-forget)
    logAuditEvent({
      adminId: admin.sub,
      action: 'CANCEL_BATCH',
      targetId: params.id,
      targetType: 'BatchScan',
      details: {
        metadata: {
          cancelledCount: result.cancelledCount,
          preservedCount: result.preservedCount,
        },
      },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? 'Unknown',
    }).catch((err) => {
      request.log.error(err, 'Failed to log CANCEL_BATCH audit event');
    });

    return reply.code(200).send({
      success: true,
      data: result,
    });
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid batch ID',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle batch admin service errors
    if (error instanceof BatchAdminServiceError) {
      const statusCode = getStatusCodeForBatchError(error.code);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in cancelBatchHandler');
    return reply.code(500).send({
      success: false,
      error: 'Failed to cancel batch',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * DELETE /api/v1/admin/batches/:id
 *
 * Delete a batch scan and all its associated data.
 *
 * Middleware chain:
 * 1. adminAuthMiddleware - Requires admin authentication
 * 2. requireSuperAdmin - Requires SUPER_ADMIN role
 * 3. handler - Validates batch ID and deletes batch
 *
 * @param request - Fastify request with BatchIdParam
 * @param reply - Fastify reply
 * @returns Deletion summary with counts
 *
 * @example
 * DELETE /api/v1/admin/batches/550e8400-e29b-41d4-a716-446655440000
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "batchId": "batch-uuid",
 *     "deletedScans": 10,
 *     "deletedIssues": 45,
 *     "message": "Deleted batch with 10 scans and 45 issues"
 *   }
 * }
 */
async function deleteBatchHandler(
  request: FastifyRequest<{ Params: BatchIdParam }>,
  reply: FastifyReply
) {
  try {
    // Parse and validate route parameters
    const params = batchIdParamSchema.parse(request.params);
    const admin = request.adminTokenPayload as AdminTokenPayload;

    // Delete batch
    const result = await deleteBatch(params.id, admin.sub);

    // Log audit event (fire-and-forget)
    logAuditEvent({
      adminId: admin.sub,
      action: 'DELETE_BATCH',
      targetId: params.id,
      targetType: 'BatchScan',
      details: {
        metadata: {
          deletedScans: result.deletedScans,
          deletedIssues: result.deletedIssues,
        },
      },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? 'Unknown',
    }).catch((err) => {
      request.log.error(err, 'Failed to log DELETE_BATCH audit event');
    });

    return reply.code(200).send({
      success: true,
      data: result,
    });
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid batch ID',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle batch admin service errors
    if (error instanceof BatchAdminServiceError) {
      const statusCode = getStatusCodeForBatchError(error.code);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in deleteBatchHandler');
    return reply.code(500).send({
      success: false,
      error: 'Failed to delete batch',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * POST /api/v1/admin/batches/:id/retry
 *
 * Retry failed scans in a batch.
 *
 * Middleware chain:
 * 1. adminAuthMiddleware - Requires admin authentication
 * 2. handler - Validates batch ID and retries failed scans
 *
 * @param request - Fastify request with BatchIdParam
 * @param reply - Fastify reply
 * @returns Retry summary with counts and job IDs
 *
 * @example
 * POST /api/v1/admin/batches/550e8400-e29b-41d4-a716-446655440000/retry
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "batchId": "batch-uuid",
 *     "retriedCount": 2,
 *     "jobIds": ["job-1", "job-2"],
 *     "message": "Retried 2 failed scans, queued 2 jobs"
 *   }
 * }
 */
async function retryFailedHandler(
  request: FastifyRequest<{ Params: BatchIdParam }>,
  reply: FastifyReply
) {
  try {
    // Parse and validate route parameters
    const params = batchIdParamSchema.parse(request.params);
    const admin = request.adminTokenPayload as AdminTokenPayload;

    // Retry failed scans
    const result = await retryFailedScans(params.id, admin.sub);

    // Log audit event (fire-and-forget)
    logAuditEvent({
      adminId: admin.sub,
      action: 'RETRY_BATCH',
      targetId: params.id,
      targetType: 'BatchScan',
      details: {
        metadata: {
          retriedCount: result.retriedCount,
          jobIds: result.jobIds,
        },
      },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? 'Unknown',
    }).catch((err) => {
      request.log.error(err, 'Failed to log RETRY_BATCH audit event');
    });

    return reply.code(200).send({
      success: true,
      data: result,
    });
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid batch ID',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle batch admin service errors
    if (error instanceof BatchAdminServiceError) {
      const statusCode = getStatusCodeForBatchError(error.code);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in retryFailedHandler');
    return reply.code(500).send({
      success: false,
      error: 'Failed to retry failed scans',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * GET /api/v1/admin/batches/:id/export
 *
 * Export batch scan results in specified format.
 *
 * Uses async job-based generation with caching for PDF and JSON.
 * Falls back to synchronous generation for CSV.
 *
 * Middleware chain:
 * 1. adminAuthMiddleware - Requires admin authentication
 * 2. handler - Validates batch ID and format, returns export status/URL
 *
 * Requirements:
 * - 5.1: Admin can export any batch without session restrictions
 * - 5.2: Admin exports use same presigned URL approach
 * - 5.3: Export action logged for audit
 *
 * @param request - Fastify request with BatchIdParam and BatchExportQuery
 * @param reply - Fastify reply
 * @returns Export status with URL if ready, or 202 if generating
 *
 * @example
 * GET /api/v1/admin/batches/550e8400-e29b-41d4-a716-446655440000/export?format=pdf
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
 *
 * Response 200 (CSV - direct download):
 * Content-Type: text/csv
 * Content-Disposition: attachment; filename="batch-550e8400.csv"
 * URL,Page Title,Status,Critical,Serious,Moderate,Minor,Total Issues,Error Message
 */
async function exportBatchHandler(
  request: FastifyRequest<{ Params: BatchIdParam; Querystring: BatchExportQuery }>,
  reply: FastifyReply
) {
  try {
    // Parse and validate route parameters and query
    const params = batchIdParamSchema.parse(request.params);
    const query = batchExportQuerySchema.parse(request.query);
    const admin = request.adminTokenPayload as AdminTokenPayload;

    // For CSV, use synchronous export (no async support)
    if (query.format === 'csv') {
      const buffer = await exportBatch(params.id, query.format);

      const filename = `batch-${params.id}.csv`;

      // Log audit event (fire-and-forget)
      logAuditEvent({
        adminId: admin.sub,
        action: 'BATCH_EXPORTED',
        targetId: params.id,
        targetType: 'BatchScan',
        details: {
          metadata: {
            format: query.format,
            fileSize: buffer.length,
          },
        },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? 'Unknown',
      }).catch((err) => {
        request.log.error(err, 'Failed to log BATCH_EXPORTED audit event');
      });

      return reply
        .code(200)
        .header('Content-Type', 'text/csv')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(buffer);
    }

    // For PDF and JSON, use async export with caching
    const exportResponse = await requestBatchExport({
      batchId: params.id,
      format: query.format as 'pdf' | 'json',
      adminId: admin.sub,
    });

    // Log audit event (fire-and-forget)
    logAuditEvent({
      adminId: admin.sub,
      action: 'BATCH_EXPORT_REQUESTED',
      targetId: params.id,
      targetType: 'BatchScan',
      details: {
        metadata: {
          format: query.format,
          status: exportResponse.status,
          reportId: exportResponse.reportId,
        },
      },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? 'Unknown',
    }).catch((err) => {
      request.log.error(err, 'Failed to log BATCH_EXPORT_REQUESTED audit event');
    });

    // Return based on export status
    switch (exportResponse.status) {
      case 'ready':
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
        return reply.code(202).send({
          success: true,
          data: {
            status: 'generating',
            reportId: exportResponse.reportId,
            message: 'Report is being generated. Poll the status endpoint for updates.',
          },
        });

      case 'failed':
        return reply.code(500).send({
          success: false,
          error: 'Export generation failed',
          message: exportResponse.errorMessage ?? 'Failed to generate report',
          code: 'EXPORT_FAILED',
          reportId: exportResponse.reportId,
        });

      default:
        return reply.code(500).send({
          success: false,
          error: 'Unknown export status',
          code: 'UNKNOWN_STATUS',
        });
    }
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid parameters',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle batch admin service errors
    if (error instanceof BatchAdminServiceError) {
      const statusCode = getStatusCodeForBatchError(error.code);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle batch export service errors
    if (error instanceof BatchExportError) {
      return reply.code(500).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in exportBatchHandler');
    return reply.code(500).send({
      success: false,
      error: 'Failed to export batch',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * GET /api/v1/admin/batches/:id/export/status?format=pdf|json
 *
 * Get the status of a batch export generation for admin.
 *
 * Use this endpoint to poll for async export completion.
 * Returns the presigned URL when the report is ready.
 *
 * Middleware chain:
 * 1. adminAuthMiddleware - Requires admin authentication
 * 2. handler - Returns export status
 *
 * Requirements:
 * - 5.1, 5.2: Admin can check export status without session restrictions
 *
 * @param request - Fastify request with BatchIdParam and format query
 * @param reply - Fastify reply with export status
 * @returns Export status with URL if ready
 *
 * @example
 * GET /api/v1/admin/batches/batch_abc123/export/status?format=pdf
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
 */
async function getAdminExportStatusHandler(
  request: FastifyRequest<{ Params: BatchIdParam; Querystring: BatchExportQuery }>,
  reply: FastifyReply
) {
  try {
    // Parse and validate route parameters and query
    const params = batchIdParamSchema.parse(request.params);
    const query = batchExportQuerySchema.parse(request.query);

    // CSV doesn't have async status (it's always synchronous)
    if (query.format === 'csv') {
      return reply.code(400).send({
        success: false,
        error: 'CSV export is synchronous and does not have status',
        code: 'CSV_NO_STATUS',
      });
    }

    // Get export status
    const statusResponse = await getBatchExportStatus(
      params.id,
      query.format as 'pdf' | 'json'
    );

    // Log audit event (fire-and-forget)
    const admin = request.adminTokenPayload as AdminTokenPayload;
    logAuditEvent({
      adminId: admin.sub,
      action: 'BATCH_EXPORT_STATUS_CHECK',
      targetId: params.id,
      targetType: 'BatchScan',
      details: {
        metadata: {
          format: query.format,
          status: statusResponse.status,
          reportId: statusResponse.reportId,
        },
      },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? 'Unknown',
    }).catch((err) => {
      request.log.error(err, 'Failed to log BATCH_EXPORT_STATUS_CHECK audit event');
    });

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
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid parameters',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle batch export service errors
    if (error instanceof BatchExportError) {
      return reply.code(500).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in getAdminExportStatusHandler');
    return reply.code(500).send({
      success: false,
      error: 'Failed to get export status',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * GET /api/v1/admin/dashboard/batches
 *
 * Get batch metrics for dashboard display.
 *
 * Middleware chain:
 * 1. adminAuthMiddleware - Requires admin authentication
 * 2. handler - Returns batch metrics including totals, averages, and trends
 *
 * @param request - Fastify request
 * @param reply - Fastify reply
 * @returns Batch metrics object
 *
 * @example
 * GET /api/v1/admin/dashboard/batches
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "totals": {
 *       "today": 5,
 *       "thisWeek": 23,
 *       "thisMonth": 87
 *     },
 *     "averages": {
 *       "urlsPerBatch": 12,
 *       "processingTimeMs": 45000,
 *       "completionRate": 92.5
 *     },
 *     "recentBatches": [
 *       {
 *         "id": "batch-uuid",
 *         "homepageUrl": "https://example.com",
 *         "status": "COMPLETED",
 *         "progress": "10/10",
 *         "createdAt": "2025-12-29T10:00:00.000Z"
 *       }
 *     ],
 *     "trends": [
 *       {
 *         "date": "2025-12-01",
 *         "batchCount": 3,
 *         "avgUrls": 10,
 *         "completionRate": 85.5
 *       }
 *     ]
 *   }
 * }
 */
async function getBatchMetricsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    // Get batch metrics
    const metrics = await getBatchMetrics();

    // Log audit event (fire-and-forget)
    const admin = request.adminTokenPayload as AdminTokenPayload;
    logAuditEvent({
      adminId: admin.sub,
      action: 'BATCH_LIST_VIEW',
      targetType: 'BatchScan',
      details: {
        metadata: {
          context: 'dashboard_metrics',
        },
      },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? 'Unknown',
    }).catch((err) => {
      request.log.error(err, 'Failed to log BATCH_LIST_VIEW audit event');
    });

    return reply.code(200).send({
      success: true,
      data: metrics,
    });
  } catch (error) {
    // Handle batch admin service errors
    if (error instanceof BatchAdminServiceError) {
      const statusCode = getStatusCodeForBatchError(error.code);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in getBatchMetricsHandler');
    return reply.code(500).send({
      success: false,
      error: 'Failed to get batch metrics',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * Map BatchAdminServiceError codes to HTTP status codes
 *
 * @param code - Error code from BatchAdminServiceError
 * @returns HTTP status code
 */
function getStatusCodeForBatchError(code: string): number {
  switch (code) {
    case 'UNAUTHORIZED':
      return 404; // Treat as not found for security
    case 'VALIDATION_ERROR':
      return 400;
    case 'INVALID_CREDENTIALS':
      return 401;
    default:
      return 500;
  }
}

/**
 * Register batch admin routes on Fastify instance
 *
 * Registers all batch-related admin endpoints with proper middleware chain.
 * All routes require admin authentication via adminAuthMiddleware.
 *
 * @param fastify - Fastify instance
 * @param prefix - API prefix (e.g., '/api/v1')
 *
 * @example
 * ```typescript
 * import { registerBatchAdminRoutes } from './batch-admin.controller.js';
 * await registerBatchAdminRoutes(fastify, '/api/v1');
 * ```
 */
export async function registerBatchAdminRoutes(
  fastify: FastifyInstance,
  prefix: string
): Promise<void> {
  // ==================== BATCH ROUTES ====================

  // GET /api/v1/admin/batches - List all batches (requires admin auth)
  fastify.get(
    `${prefix}/admin/batches`,
    {
      preHandler: [adminAuthMiddleware],
    },
    listBatchesHandler as any
  );

  // GET /api/v1/admin/batches/:id - Get batch details (requires admin auth)
  fastify.get(
    `${prefix}/admin/batches/:id`,
    {
      preHandler: [adminAuthMiddleware],
    },
    getBatchDetailsHandler as any
  );

  // POST /api/v1/admin/batches/:id/cancel - Cancel batch (requires admin auth)
  fastify.post(
    `${prefix}/admin/batches/:id/cancel`,
    {
      preHandler: [adminAuthMiddleware],
    },
    cancelBatchHandler as any
  );

  // DELETE /api/v1/admin/batches/:id - Delete batch (requires super admin)
  fastify.delete(
    `${prefix}/admin/batches/:id`,
    {
      preHandler: [adminAuthMiddleware, requireSuperAdmin],
    },
    deleteBatchHandler as any
  );

  // POST /api/v1/admin/batches/:id/retry - Retry failed scans (requires admin auth)
  fastify.post(
    `${prefix}/admin/batches/:id/retry`,
    {
      preHandler: [adminAuthMiddleware],
    },
    retryFailedHandler as any
  );

  // GET /api/v1/admin/batches/:id/export - Export batch results (requires admin auth)
  fastify.get(
    `${prefix}/admin/batches/:id/export`,
    {
      preHandler: [adminAuthMiddleware],
    },
    exportBatchHandler as any
  );

  // GET /api/v1/admin/batches/:id/export/status - Get export status (requires admin auth)
  fastify.get(
    `${prefix}/admin/batches/:id/export/status`,
    {
      preHandler: [adminAuthMiddleware],
    },
    getAdminExportStatusHandler as any
  );

  // GET /api/v1/admin/dashboard/batches - Get batch metrics (requires admin auth)
  fastify.get(
    `${prefix}/admin/dashboard/batches`,
    {
      preHandler: [adminAuthMiddleware],
    },
    getBatchMetricsHandler as any
  );

  fastify.log.info('✅ Batch admin routes registered (list, details, cancel, delete, retry, export, export-status, metrics)');
}

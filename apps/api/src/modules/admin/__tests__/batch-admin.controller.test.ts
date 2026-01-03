/**
 * Batch Admin Controller Integration Tests
 *
 * Integration tests for admin batch management API endpoints covering:
 * - GET /admin/batches - List all batches with filters
 * - GET /admin/batches/:id - Get batch details
 * - POST /admin/batches/:id/cancel - Cancel batch
 * - DELETE /admin/batches/:id - Delete batch (requires SUPER_ADMIN)
 * - POST /admin/batches/:id/retry - Retry failed scans
 * - GET /admin/batches/:id/export - Export batch results
 * - GET /admin/dashboard/batches - Get batch metrics
 *
 * Covers Requirements 2.1, 2.6 from admin-batch-management specification.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import type { AdminRole } from '@prisma/client';

// Define mock admin token payload
interface MockAdminTokenPayload {
  sub: string;
  email: string;
  role: AdminRole;
  jti: string;
  iat: number;
  exp: number;
}

// Mock current admin - will be set per test
let mockAdminPayload: MockAdminTokenPayload | null = null;

// Mock middleware - this is more reliable than mocking all underlying deps
vi.mock('../admin.middleware.js', () => ({
  adminAuthMiddleware: async (request: any, reply: any) => {
    if (!mockAdminPayload) {
      return reply.code(401).send({
        success: false,
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
      });
    }
    request.adminTokenPayload = mockAdminPayload;
  },
  requireSuperAdmin: async (request: any, reply: any) => {
    const payload = request.adminTokenPayload as MockAdminTokenPayload | undefined;
    if (!payload || payload.role !== 'SUPER_ADMIN') {
      return reply.code(403).send({
        success: false,
        error: 'Forbidden - Super Admin required',
        code: 'FORBIDDEN',
      });
    }
  },
}));

// Mock batch admin service
vi.mock('../batch-admin.service.js', () => ({
  listAllBatches: vi.fn(),
  getBatchDetails: vi.fn(),
  cancelBatch: vi.fn(),
  deleteBatch: vi.fn(),
  retryFailedScans: vi.fn(),
  exportBatch: vi.fn(),
  getBatchMetrics: vi.fn(),
  BatchAdminServiceError: class BatchAdminServiceError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
      this.name = 'BatchAdminServiceError';
    }
  },
}));

// Mock audit service
vi.mock('../audit.service.js', () => ({
  log: vi.fn().mockResolvedValue(undefined),
}));

// Import controller after mocking
import { registerBatchAdminRoutes } from '../batch-admin.controller.js';

describe('Batch Admin Controller Integration Tests', () => {
  let fastify: FastifyInstance;
  let batchAdminService: any;
  let auditService: any;

  // Test data - admin payload
  const adminPayload: MockAdminTokenPayload = {
    sub: 'admin-123',
    email: 'admin@example.com',
    role: 'ADMIN' as AdminRole,
    jti: 'test-uuid-123',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400,
  };

  const superAdminPayload: MockAdminTokenPayload = {
    sub: 'super-admin-123',
    email: 'super@example.com',
    role: 'SUPER_ADMIN' as AdminRole,
    jti: 'super-admin-token',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400,
  };

  // Use valid UUID format for batch IDs
  const BATCH_ID = '550e8400-e29b-41d4-a716-446655440000';
  const SESSION_ID = '660e8400-e29b-41d4-a716-446655440001';
  const SCAN_ID = '770e8400-e29b-41d4-a716-446655440002';

  const mockBatchListItem = {
    id: BATCH_ID,
    homepageUrl: 'https://example.com',
    totalUrls: 10,
    completedCount: 8,
    failedCount: 2,
    status: 'COMPLETED',
    totalIssues: 45,
    criticalCount: 5,
    seriousCount: 10,
    moderateCount: 20,
    minorCount: 10,
    createdAt: new Date('2025-12-29T10:00:00.000Z'),
    completedAt: new Date('2025-12-29T10:15:00.000Z'),
    guestSession: { id: SESSION_ID, fingerprint: 'fp123' },
  };

  const mockBatchDetails = {
    batch: {
      id: BATCH_ID,
      homepageUrl: 'https://example.com',
      wcagLevel: 'AA',
      status: 'COMPLETED',
      totalUrls: 10,
      completedCount: 8,
      failedCount: 2,
      totalIssues: 45,
      criticalCount: 5,
      seriousCount: 10,
      moderateCount: 20,
      minorCount: 10,
      createdAt: new Date('2025-12-29T10:00:00.000Z'),
      completedAt: new Date('2025-12-29T10:15:00.000Z'),
      cancelledAt: null,
      guestSessionId: SESSION_ID,
      userId: null,
    },
    scans: [
      {
        id: SCAN_ID,
        url: 'https://example.com/page1',
        pageTitle: 'Page 1',
        status: 'COMPLETED',
        criticalCount: 2,
        seriousCount: 4,
        moderateCount: 8,
        minorCount: 6,
        totalIssues: 20,
        errorMessage: null,
        completedAt: new Date('2025-12-29T10:05:00.000Z'),
        createdAt: new Date('2025-12-29T10:00:00.000Z'),
      },
    ],
    aggregate: {
      totalUrls: 10,
      completedCount: 8,
      failedCount: 2,
      pendingCount: 0,
      totalIssues: 45,
      criticalCount: 5,
      seriousCount: 10,
      moderateCount: 20,
      minorCount: 10,
    },
    topCriticalUrls: [
      {
        url: 'https://example.com/page1',
        pageTitle: 'Page 1',
        criticalCount: 2,
        totalIssues: 20,
      },
    ],
    sessionInfo: {
      id: SESSION_ID,
      fingerprint: 'fp123',
      createdAt: new Date('2025-12-29T09:00:00.000Z'),
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Default to regular admin authentication
    mockAdminPayload = adminPayload;

    // Get mocked module references
    batchAdminService = await import('../batch-admin.service.js');
    auditService = await import('../audit.service.js');

    // Create fresh Fastify instance
    fastify = Fastify({
      logger: false, // Disable logging in tests
    });

    // Register cookie plugin
    await fastify.register(fastifyCookie);

    // Register batch admin routes
    await registerBatchAdminRoutes(fastify, '/api/v1');

    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
    mockAdminPayload = null;
    vi.restoreAllMocks();
  });

  describe('GET /api/v1/admin/batches', () => {
    it('should list batches with admin authentication', async () => {
      vi.mocked(batchAdminService.listAllBatches).mockResolvedValue({
        items: [mockBatchListItem],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v1/admin/batches?page=1&limit=20',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.batches).toHaveLength(1);
      expect(body.data.batches[0].id).toBe(BATCH_ID);
      expect(body.data.pagination.total).toBe(1);
    });

    it('should filter batches by status', async () => {
      vi.mocked(batchAdminService.listAllBatches).mockResolvedValue({
        items: [mockBatchListItem],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v1/admin/batches?status=COMPLETED',
      });

      expect(response.statusCode).toBe(200);
      expect(batchAdminService.listAllBatches).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'COMPLETED' }),
        expect.any(Object)
      );
    });

    it('should filter batches by date range', async () => {
      vi.mocked(batchAdminService.listAllBatches).mockResolvedValue({
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v1/admin/batches?startDate=2025-12-01T00:00:00Z&endDate=2025-12-31T23:59:59Z',
      });

      expect(response.statusCode).toBe(200);
      expect(batchAdminService.listAllBatches).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        }),
        expect.any(Object)
      );
    });

    it('should return 401 without authentication', async () => {
      mockAdminPayload = null;

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v1/admin/batches',
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe('UNAUTHORIZED');
    });

    it('should log audit event for batch list view', async () => {
      vi.mocked(batchAdminService.listAllBatches).mockResolvedValue({
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      await fastify.inject({
        method: 'GET',
        url: '/api/v1/admin/batches',
      });

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: adminPayload.sub,
          action: 'BATCH_LIST_VIEW',
          targetType: 'BatchScan',
        })
      );
    });
  });

  describe('GET /api/v1/admin/batches/:id', () => {
    it('should return batch details with admin authentication (Requirement 2.1)', async () => {
      vi.mocked(batchAdminService.getBatchDetails).mockResolvedValue(mockBatchDetails);

      const response = await fastify.inject({
        method: 'GET',
        url: `/api/v1/admin/batches/${BATCH_ID}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.batch.id).toBe(BATCH_ID);
      expect(body.data.batch.homepageUrl).toBe('https://example.com');
      expect(body.data.batch.wcagLevel).toBe('AA');
      expect(body.data.scans).toHaveLength(1);
      expect(body.data.aggregate).toBeDefined();
      expect(body.data.topCriticalUrls).toBeDefined();
    });

    it('should return 404 for non-existent batch (Requirement 2.6)', async () => {
      const NON_EXISTENT_ID = '00000000-0000-0000-0000-000000000000';
      const { BatchAdminServiceError } = await import('../batch-admin.service.js');
      vi.mocked(batchAdminService.getBatchDetails).mockRejectedValue(
        new BatchAdminServiceError('Batch not found', 'UNAUTHORIZED')
      );

      const response = await fastify.inject({
        method: 'GET',
        url: `/api/v1/admin/batches/${NON_EXISTENT_ID}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('should return 401 without authentication', async () => {
      mockAdminPayload = null;

      const response = await fastify.inject({
        method: 'GET',
        url: `/api/v1/admin/batches/${BATCH_ID}`,
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe('UNAUTHORIZED');
    });

    it('should log audit event for batch detail view', async () => {
      vi.mocked(batchAdminService.getBatchDetails).mockResolvedValue(mockBatchDetails);

      await fastify.inject({
        method: 'GET',
        url: `/api/v1/admin/batches/${BATCH_ID}`,
      });

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: adminPayload.sub,
          action: 'BATCH_DETAIL_VIEW',
          targetId: BATCH_ID,
          targetType: 'BatchScan',
        })
      );
    });
  });

  describe('POST /api/v1/admin/batches/:id/cancel', () => {
    it('should cancel batch with admin authentication', async () => {
      vi.mocked(batchAdminService.cancelBatch).mockResolvedValue({
        batchId: BATCH_ID,
        status: 'CANCELLED',
        cancelledCount: 5,
        preservedCount: 3,
        message: 'Cancelled 5 scans, preserved 3 completed scans',
      });

      const response = await fastify.inject({
        method: 'POST',
        url: `/api/v1/admin/batches/${BATCH_ID}/cancel`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('CANCELLED');
      expect(body.data.cancelledCount).toBe(5);
    });

    it('should return 401 without authentication', async () => {
      mockAdminPayload = null;

      const response = await fastify.inject({
        method: 'POST',
        url: `/api/v1/admin/batches/${BATCH_ID}/cancel`,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should log CANCEL_BATCH audit event', async () => {
      vi.mocked(batchAdminService.cancelBatch).mockResolvedValue({
        batchId: BATCH_ID,
        status: 'CANCELLED',
        cancelledCount: 5,
        preservedCount: 3,
        message: 'Cancelled 5 scans, preserved 3 completed scans',
      });

      await fastify.inject({
        method: 'POST',
        url: `/api/v1/admin/batches/${BATCH_ID}/cancel`,
      });

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: adminPayload.sub,
          action: 'CANCEL_BATCH',
          targetId: BATCH_ID,
          targetType: 'BatchScan',
        })
      );
    });
  });

  describe('DELETE /api/v1/admin/batches/:id', () => {
    it('should delete batch with SUPER_ADMIN authentication', async () => {
      mockAdminPayload = superAdminPayload;
      vi.mocked(batchAdminService.deleteBatch).mockResolvedValue({
        batchId: BATCH_ID,
        deletedScans: 10,
        deletedIssues: 45,
        message: 'Deleted batch with 10 scans and 45 issues',
      });

      const response = await fastify.inject({
        method: 'DELETE',
        url: `/api/v1/admin/batches/${BATCH_ID}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.deletedScans).toBe(10);
      expect(body.data.deletedIssues).toBe(45);
    });

    it('should return 403 when non-SUPER_ADMIN tries to delete (Requirement 2.1)', async () => {
      // Regular admin (not super admin) - default setup
      const response = await fastify.inject({
        method: 'DELETE',
        url: `/api/v1/admin/batches/${BATCH_ID}`,
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe('FORBIDDEN');
    });

    it('should return 401 without authentication', async () => {
      mockAdminPayload = null;

      const response = await fastify.inject({
        method: 'DELETE',
        url: `/api/v1/admin/batches/${BATCH_ID}`,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should log DELETE_BATCH audit event', async () => {
      mockAdminPayload = superAdminPayload;
      vi.mocked(batchAdminService.deleteBatch).mockResolvedValue({
        batchId: BATCH_ID,
        deletedScans: 10,
        deletedIssues: 45,
        message: 'Deleted batch with 10 scans and 45 issues',
      });

      await fastify.inject({
        method: 'DELETE',
        url: `/api/v1/admin/batches/${BATCH_ID}`,
      });

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: superAdminPayload.sub,
          action: 'DELETE_BATCH',
          targetId: BATCH_ID,
          targetType: 'BatchScan',
        })
      );
    });
  });

  describe('POST /api/v1/admin/batches/:id/retry', () => {
    it('should retry failed scans with admin authentication', async () => {
      vi.mocked(batchAdminService.retryFailedScans).mockResolvedValue({
        batchId: BATCH_ID,
        retriedCount: 2,
        jobIds: ['job-1', 'job-2'],
        message: 'Retried 2 failed scans, queued 2 jobs',
      });

      const response = await fastify.inject({
        method: 'POST',
        url: `/api/v1/admin/batches/${BATCH_ID}/retry`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.retriedCount).toBe(2);
      expect(body.data.jobIds).toHaveLength(2);
    });

    it('should return 401 without authentication', async () => {
      mockAdminPayload = null;

      const response = await fastify.inject({
        method: 'POST',
        url: `/api/v1/admin/batches/${BATCH_ID}/retry`,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should log RETRY_BATCH audit event', async () => {
      vi.mocked(batchAdminService.retryFailedScans).mockResolvedValue({
        batchId: BATCH_ID,
        retriedCount: 2,
        jobIds: ['job-1', 'job-2'],
        message: 'Retried 2 failed scans, queued 2 jobs',
      });

      await fastify.inject({
        method: 'POST',
        url: `/api/v1/admin/batches/${BATCH_ID}/retry`,
      });

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: adminPayload.sub,
          action: 'RETRY_BATCH',
          targetId: BATCH_ID,
          targetType: 'BatchScan',
        })
      );
    });
  });

  describe('GET /api/v1/admin/batches/:id/export', () => {
    it('should export batch as PDF with admin authentication', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4 test content');
      vi.mocked(batchAdminService.exportBatch).mockResolvedValue(pdfBuffer);

      const response = await fastify.inject({
        method: 'GET',
        url: `/api/v1/admin/batches/${BATCH_ID}/export?format=pdf`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toBe(
        `attachment; filename="batch-${BATCH_ID}.pdf"`
      );
    });

    it('should export batch as JSON with admin authentication', async () => {
      const jsonBuffer = Buffer.from(JSON.stringify({ test: 'data' }));
      vi.mocked(batchAdminService.exportBatch).mockResolvedValue(jsonBuffer);

      const response = await fastify.inject({
        method: 'GET',
        url: `/api/v1/admin/batches/${BATCH_ID}/export?format=json`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('application/json');
      expect(response.headers['content-disposition']).toBe(
        `attachment; filename="batch-${BATCH_ID}.json"`
      );
    });

    it('should export batch as CSV with admin authentication', async () => {
      const csvBuffer = Buffer.from('URL,Status\nhttps://example.com,COMPLETED');
      vi.mocked(batchAdminService.exportBatch).mockResolvedValue(csvBuffer);

      const response = await fastify.inject({
        method: 'GET',
        url: `/api/v1/admin/batches/${BATCH_ID}/export?format=csv`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('text/csv');
      expect(response.headers['content-disposition']).toBe(
        `attachment; filename="batch-${BATCH_ID}.csv"`
      );
    });

    it('should return 401 without authentication', async () => {
      mockAdminPayload = null;

      const response = await fastify.inject({
        method: 'GET',
        url: `/api/v1/admin/batches/${BATCH_ID}/export?format=pdf`,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should log BATCH_EXPORTED audit event', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4 test content');
      vi.mocked(batchAdminService.exportBatch).mockResolvedValue(pdfBuffer);

      await fastify.inject({
        method: 'GET',
        url: `/api/v1/admin/batches/${BATCH_ID}/export?format=pdf`,
      });

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: adminPayload.sub,
          action: 'BATCH_EXPORTED',
          targetId: BATCH_ID,
          targetType: 'BatchScan',
          details: expect.objectContaining({
            metadata: expect.objectContaining({
              format: 'pdf',
            }),
          }),
        })
      );
    });
  });

  describe('GET /api/v1/admin/dashboard/batches', () => {
    it('should return batch metrics with admin authentication', async () => {
      const mockMetrics = {
        totals: {
          today: 5,
          thisWeek: 23,
          thisMonth: 87,
        },
        averages: {
          urlsPerBatch: 12,
          processingTimeMs: 45000,
          completionRate: 92.5,
        },
        recentBatches: [
          {
            id: BATCH_ID,
            homepageUrl: 'https://example.com',
            status: 'COMPLETED',
            progress: '10/10',
            createdAt: '2025-12-29T10:00:00.000Z',
          },
        ],
        trends: [
          {
            date: '2025-12-01',
            batchCount: 3,
            avgUrls: 10,
            completionRate: 85.5,
          },
        ],
      };
      vi.mocked(batchAdminService.getBatchMetrics).mockResolvedValue(mockMetrics);

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v1/admin/dashboard/batches',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.totals.today).toBe(5);
      expect(body.data.averages.completionRate).toBe(92.5);
      expect(body.data.recentBatches).toHaveLength(1);
      expect(body.data.trends).toHaveLength(1);
    });

    it('should return 401 without authentication', async () => {
      mockAdminPayload = null;

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v1/admin/dashboard/batches',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should log audit event for metrics view', async () => {
      const mockMetrics = {
        totals: { today: 0, thisWeek: 0, thisMonth: 0 },
        averages: { urlsPerBatch: 0, processingTimeMs: 0, completionRate: 0 },
        recentBatches: [],
        trends: [],
      };
      vi.mocked(batchAdminService.getBatchMetrics).mockResolvedValue(mockMetrics);

      await fastify.inject({
        method: 'GET',
        url: '/api/v1/admin/dashboard/batches',
      });

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: adminPayload.sub,
          action: 'BATCH_LIST_VIEW',
          targetType: 'BatchScan',
          details: expect.objectContaining({
            metadata: expect.objectContaining({
              context: 'dashboard_metrics',
            }),
          }),
        })
      );
    });
  });

  describe('Error handling', () => {
    it('should handle service errors gracefully', async () => {
      const { BatchAdminServiceError } = await import('../batch-admin.service.js');
      vi.mocked(batchAdminService.getBatchDetails).mockRejectedValue(
        new BatchAdminServiceError('Database error', 'INTERNAL_ERROR')
      );

      const response = await fastify.inject({
        method: 'GET',
        url: `/api/v1/admin/batches/${BATCH_ID}`,
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('should handle unexpected errors', async () => {
      vi.mocked(batchAdminService.getBatchDetails).mockRejectedValue(
        new Error('Unexpected error')
      );

      const response = await fastify.inject({
        method: 'GET',
        url: `/api/v1/admin/batches/${BATCH_ID}`,
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('Authentication flow integration', () => {
    it('should complete full batch management flow with valid token', async () => {
      // Setup mocks for full flow
      vi.mocked(batchAdminService.listAllBatches).mockResolvedValue({
        items: [mockBatchListItem],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
      vi.mocked(batchAdminService.getBatchDetails).mockResolvedValue(mockBatchDetails);
      vi.mocked(batchAdminService.cancelBatch).mockResolvedValue({
        batchId: BATCH_ID,
        status: 'CANCELLED',
        cancelledCount: 2,
        preservedCount: 8,
        message: 'Cancelled 2 scans',
      });

      // Step 1: List batches
      const listResponse = await fastify.inject({
        method: 'GET',
        url: '/api/v1/admin/batches',
      });
      expect(listResponse.statusCode).toBe(200);

      // Step 2: Get batch details
      const detailResponse = await fastify.inject({
        method: 'GET',
        url: `/api/v1/admin/batches/${BATCH_ID}`,
      });
      expect(detailResponse.statusCode).toBe(200);

      // Step 3: Cancel batch
      const cancelResponse = await fastify.inject({
        method: 'POST',
        url: `/api/v1/admin/batches/${BATCH_ID}/cancel`,
      });
      expect(cancelResponse.statusCode).toBe(200);
    });
  });
});

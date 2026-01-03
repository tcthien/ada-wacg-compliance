/**
 * Batch Admin Service Unit Tests
 *
 * Tests for batch scan management operations including listing, details,
 * cancellation, deletion, and retry functionality.
 * Covers Requirements 1.1, 2.1, 3.2, 3.4, 3.6 from admin-batch-management specification.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { BatchStatus } from '@prisma/client';

// Mock modules with factory functions - must be at top level
vi.mock('../../config/database.js', () => ({
  getPrismaClient: vi.fn(),
}));

vi.mock('../audit.service.js', () => ({
  log: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../shared/queue/queue.service.js', () => ({
  addScanJob: vi.fn().mockResolvedValue('job-123'),
}));

vi.mock('../../batches/batch-export.service.js', () => ({
  generateBatchPdf: vi.fn().mockResolvedValue(Buffer.from('pdf-content')),
}));

// Import service after mocking
import {
  listAllBatches,
  getBatchDetails,
  cancelBatch,
  deleteBatch,
  retryFailedScans,
  getBatchMetrics,
  BatchAdminServiceError,
} from '../batch-admin.service.js';

describe('Batch Admin Service', () => {
  let mockPrisma: any;
  let getPrismaClient: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Get mocked module references
    const dbModule = await import('../../config/database.js');
    getPrismaClient = dbModule.getPrismaClient;

    // Setup Prisma mock
    mockPrisma = {
      batchScan: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        aggregate: vi.fn(),
      },
      scan: {
        findMany: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      scanResult: {
        findMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      issue: {
        count: vi.fn(),
        deleteMany: vi.fn(),
      },
      scanEvent: {
        deleteMany: vi.fn(),
      },
      report: {
        deleteMany: vi.fn(),
      },
      $transaction: vi.fn((callback) => callback(mockPrisma)),
      $queryRaw: vi.fn(),
    };
    vi.mocked(getPrismaClient).mockReturnValue(mockPrisma);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('listAllBatches', () => {
    const mockBatch = {
      id: 'batch-123',
      homepageUrl: 'https://example.com',
      totalUrls: 10,
      completedCount: 5,
      failedCount: 2,
      status: 'RUNNING' as BatchStatus,
      totalIssues: 25,
      criticalCount: 5,
      seriousCount: 10,
      moderateCount: 5,
      minorCount: 5,
      createdAt: new Date('2025-01-01'),
      completedAt: null,
      guestSession: { id: 'session-123', fingerprint: 'fp-abc' },
    };

    it('should return paginated batches (Requirement 1.1)', async () => {
      mockPrisma.batchScan.findMany.mockResolvedValue([mockBatch]);
      mockPrisma.batchScan.count.mockResolvedValue(1);

      const result = await listAllBatches();

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.id).toBe('batch-123');
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('should filter by status', async () => {
      mockPrisma.batchScan.findMany.mockResolvedValue([mockBatch]);
      mockPrisma.batchScan.count.mockResolvedValue(1);

      await listAllBatches({ status: 'COMPLETED' });

      expect(mockPrisma.batchScan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'COMPLETED' },
        })
      );
    });

    it('should filter by date range', async () => {
      mockPrisma.batchScan.findMany.mockResolvedValue([]);
      mockPrisma.batchScan.count.mockResolvedValue(0);

      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');
      await listAllBatches({ startDate, endDate });

      expect(mockPrisma.batchScan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: startDate,
              lte: expect.any(Date),
            }),
          }),
        })
      );
    });

    it('should filter by homepage URL (partial match)', async () => {
      mockPrisma.batchScan.findMany.mockResolvedValue([mockBatch]);
      mockPrisma.batchScan.count.mockResolvedValue(1);

      await listAllBatches({ homepageUrl: 'example.com' });

      expect(mockPrisma.batchScan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            homepageUrl: { contains: 'example.com', mode: 'insensitive' },
          }),
        })
      );
    });

    it('should filter by session ID', async () => {
      mockPrisma.batchScan.findMany.mockResolvedValue([mockBatch]);
      mockPrisma.batchScan.count.mockResolvedValue(1);

      await listAllBatches({ sessionId: 'session-123' });

      expect(mockPrisma.batchScan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            guestSessionId: 'session-123',
          }),
        })
      );
    });

    it('should handle pagination parameters', async () => {
      mockPrisma.batchScan.findMany.mockResolvedValue([]);
      mockPrisma.batchScan.count.mockResolvedValue(100);

      const result = await listAllBatches({}, { page: 3, limit: 25 });

      expect(mockPrisma.batchScan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 50, // (3-1) * 25
          take: 25,
        })
      );
      expect(result.pagination.page).toBe(3);
      expect(result.pagination.limit).toBe(25);
      expect(result.pagination.totalPages).toBe(4);
    });

    it('should throw BatchAdminServiceError on database error', async () => {
      mockPrisma.batchScan.findMany.mockRejectedValue(new Error('DB error'));

      await expect(listAllBatches()).rejects.toThrow(BatchAdminServiceError);
      await expect(listAllBatches()).rejects.toThrow('Failed to list batch scans');
    });
  });

  describe('getBatchDetails', () => {
    const mockBatch = {
      id: 'batch-123',
      homepageUrl: 'https://example.com',
      wcagLevel: 'AA',
      status: 'COMPLETED' as BatchStatus,
      totalUrls: 10,
      completedCount: 8,
      failedCount: 2,
      totalIssues: 50,
      criticalCount: 10,
      seriousCount: 15,
      moderateCount: 15,
      minorCount: 10,
      createdAt: new Date(),
      completedAt: new Date(),
      cancelledAt: null,
      guestSession: { id: 'session-123', fingerprint: 'fp-abc', createdAt: new Date() },
      scans: [
        {
          id: 'scan-1',
          url: 'https://example.com/page1',
          pageTitle: 'Page 1',
          status: 'COMPLETED',
          errorMessage: null,
          completedAt: new Date(),
          createdAt: new Date(),
          scanResult: {
            totalIssues: 25,
            criticalCount: 5,
            seriousCount: 10,
            moderateCount: 5,
            minorCount: 5,
          },
        },
        {
          id: 'scan-2',
          url: 'https://example.com/page2',
          pageTitle: 'Page 2',
          status: 'COMPLETED',
          errorMessage: null,
          completedAt: new Date(),
          createdAt: new Date(),
          scanResult: {
            totalIssues: 25,
            criticalCount: 5,
            seriousCount: 5,
            moderateCount: 10,
            minorCount: 5,
          },
        },
      ],
    };

    it('should return complete batch data (Requirement 2.1)', async () => {
      mockPrisma.batchScan.findUnique.mockResolvedValue(mockBatch);

      const result = await getBatchDetails('batch-123');

      expect(result.batch).toBeDefined();
      expect(result.batch.id).toBe('batch-123');
      expect(result.scans).toHaveLength(2);
      expect(result.aggregate).toBeDefined();
      expect(result.aggregate.totalUrls).toBe(10);
      expect(result.topCriticalUrls).toBeDefined();
      expect(result.sessionInfo).toBeDefined();
      expect(result.sessionInfo?.id).toBe('session-123');
    });

    it('should calculate aggregate statistics correctly', async () => {
      mockPrisma.batchScan.findUnique.mockResolvedValue(mockBatch);

      const result = await getBatchDetails('batch-123');

      expect(result.aggregate.totalIssues).toBe(50);
      expect(result.aggregate.criticalCount).toBe(10);
      expect(result.aggregate.completedCount).toBe(8);
      expect(result.aggregate.failedCount).toBe(2);
      expect(result.aggregate.pendingCount).toBe(0); // 10 - 8 - 2
    });

    it('should return top critical URLs sorted correctly', async () => {
      mockPrisma.batchScan.findUnique.mockResolvedValue(mockBatch);

      const result = await getBatchDetails('batch-123');

      expect(result.topCriticalUrls.length).toBeLessThanOrEqual(5);
      // Both scans have 5 critical issues, should be included
      expect(result.topCriticalUrls[0]?.criticalCount).toBe(5);
    });

    it('should throw error for invalid batch ID', async () => {
      await expect(getBatchDetails('')).rejects.toThrow(BatchAdminServiceError);
      await expect(getBatchDetails('')).rejects.toThrow('Invalid batch ID');
    });

    it('should throw error when batch not found', async () => {
      mockPrisma.batchScan.findUnique.mockResolvedValue(null);

      await expect(getBatchDetails('nonexistent')).rejects.toThrow(BatchAdminServiceError);
      await expect(getBatchDetails('nonexistent')).rejects.toThrow('Batch not found');
    });
  });

  describe('cancelBatch', () => {
    it('should cancel batch and pending scans (Requirement 3.2)', async () => {
      const mockBatch = {
        id: 'batch-123',
        status: 'RUNNING' as BatchStatus,
        homepageUrl: 'https://example.com',
      };

      const mockScans = [
        { id: 'scan-1', status: 'PENDING' },
        { id: 'scan-2', status: 'RUNNING' },
        { id: 'scan-3', status: 'COMPLETED' },
      ];

      mockPrisma.batchScan.findUnique.mockResolvedValue(mockBatch);
      mockPrisma.scan.findMany.mockResolvedValue(mockScans);
      mockPrisma.scan.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.batchScan.update.mockResolvedValue({
        ...mockBatch,
        status: 'CANCELLED',
      });

      const result = await cancelBatch('batch-123', 'admin-456');

      expect(result.status).toBe('CANCELLED');
      expect(result.cancelledCount).toBe(2);
      expect(result.preservedCount).toBe(1); // 1 completed scan preserved
    });

    it('should preserve completed scans during cancellation', async () => {
      const mockBatch = {
        id: 'batch-123',
        status: 'RUNNING' as BatchStatus,
        homepageUrl: 'https://example.com',
      };

      const mockScans = [
        { id: 'scan-1', status: 'COMPLETED' },
        { id: 'scan-2', status: 'FAILED' },
      ];

      mockPrisma.batchScan.findUnique.mockResolvedValue(mockBatch);
      mockPrisma.scan.findMany.mockResolvedValue(mockScans);
      mockPrisma.scan.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.batchScan.update.mockResolvedValue({
        ...mockBatch,
        status: 'CANCELLED',
      });

      const result = await cancelBatch('batch-123', 'admin-456');

      expect(result.cancelledCount).toBe(0);
      expect(result.preservedCount).toBe(2);
    });

    it('should log audit trail on cancellation', async () => {
      const { log: auditLog } = await import('../audit.service.js');

      const mockBatch = {
        id: 'batch-123',
        status: 'RUNNING' as BatchStatus,
        homepageUrl: 'https://example.com',
      };

      mockPrisma.batchScan.findUnique.mockResolvedValue(mockBatch);
      mockPrisma.scan.findMany.mockResolvedValue([]);
      mockPrisma.scan.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.batchScan.update.mockResolvedValue({
        ...mockBatch,
        status: 'CANCELLED',
      });

      await cancelBatch('batch-123', 'admin-456');

      // Wait for audit log to be called (fire-and-forget)
      await new Promise((r) => setTimeout(r, 10));

      expect(auditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: 'admin-456',
          action: 'CANCEL_BATCH',
          targetId: 'batch-123',
          targetType: 'BatchScan',
        })
      );
    });

    it('should throw error for completed batch', async () => {
      mockPrisma.batchScan.findUnique.mockResolvedValue({
        id: 'batch-123',
        status: 'COMPLETED' as BatchStatus,
      });

      await expect(cancelBatch('batch-123', 'admin-456')).rejects.toThrow(
        'Batch cannot be cancelled in COMPLETED state'
      );
    });

    it('should throw error for non-existent batch', async () => {
      mockPrisma.batchScan.findUnique.mockResolvedValue(null);

      await expect(cancelBatch('nonexistent', 'admin-456')).rejects.toThrow(
        'Batch not found'
      );
    });
  });

  describe('deleteBatch', () => {
    it('should delete batch and all related data (Requirement 3.4)', async () => {
      const mockBatch = {
        id: 'batch-123',
        homepageUrl: 'https://example.com',
        totalUrls: 5,
        status: 'COMPLETED' as BatchStatus,
      };

      const mockScans = [{ id: 'scan-1' }, { id: 'scan-2' }];

      mockPrisma.batchScan.findUnique.mockResolvedValue(mockBatch);
      mockPrisma.scan.findMany.mockResolvedValue(mockScans);
      mockPrisma.scanResult.findMany.mockResolvedValue([{ id: 'result-1' }]);
      mockPrisma.issue.count.mockResolvedValue(25);
      mockPrisma.issue.deleteMany.mockResolvedValue({ count: 25 });
      mockPrisma.scanEvent.deleteMany.mockResolvedValue({ count: 10 });
      mockPrisma.report.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.scanResult.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.scan.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.batchScan.delete.mockResolvedValue(mockBatch);

      const result = await deleteBatch('batch-123', 'admin-456');

      expect(result.deletedScans).toBe(2);
      expect(result.deletedIssues).toBe(25);
      expect(mockPrisma.issue.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.batchScan.delete).toHaveBeenCalledWith({
        where: { id: 'batch-123' },
      });
    });

    it('should log audit trail on deletion', async () => {
      const { log: auditLog } = await import('../audit.service.js');

      const mockBatch = {
        id: 'batch-123',
        homepageUrl: 'https://example.com',
        totalUrls: 5,
        status: 'COMPLETED' as BatchStatus,
      };

      mockPrisma.batchScan.findUnique.mockResolvedValue(mockBatch);
      mockPrisma.scan.findMany.mockResolvedValue([]);
      mockPrisma.scanResult.findMany.mockResolvedValue([]);
      mockPrisma.issue.count.mockResolvedValue(0);
      mockPrisma.issue.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.scanEvent.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.report.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.scanResult.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.scan.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.batchScan.delete.mockResolvedValue(mockBatch);

      await deleteBatch('batch-123', 'admin-456');

      // Wait for audit log to be called
      await new Promise((r) => setTimeout(r, 10));

      expect(auditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: 'admin-456',
          action: 'DELETE_BATCH',
          targetId: 'batch-123',
          targetType: 'BatchScan',
        })
      );
    });

    it('should throw error for non-existent batch', async () => {
      mockPrisma.batchScan.findUnique.mockResolvedValue(null);

      await expect(deleteBatch('nonexistent', 'admin-456')).rejects.toThrow(
        'Batch not found'
      );
    });
  });

  describe('retryFailedScans', () => {
    it('should retry failed scans and re-queue jobs (Requirement 3.6)', async () => {
      const mockBatch = {
        id: 'batch-123',
        homepageUrl: 'https://example.com',
        wcagLevel: 'AA',
        guestSessionId: 'session-123',
        userId: null,
      };

      const mockFailedScans = [
        { id: 'scan-1', url: 'https://example.com/page1' },
        { id: 'scan-2', url: 'https://example.com/page2' },
      ];

      mockPrisma.batchScan.findUnique.mockResolvedValue(mockBatch);
      mockPrisma.scan.findMany.mockResolvedValue(mockFailedScans);
      mockPrisma.scan.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.batchScan.update.mockResolvedValue(mockBatch);

      const result = await retryFailedScans('batch-123', 'admin-456');

      expect(result.retriedCount).toBe(2);
      expect(result.jobIds).toHaveLength(2);
      expect(mockPrisma.scan.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PENDING',
            errorMessage: null,
          }),
        })
      );
    });

    it('should return empty when no failed scans', async () => {
      const mockBatch = {
        id: 'batch-123',
        homepageUrl: 'https://example.com',
        wcagLevel: 'AA',
        guestSessionId: null,
        userId: null,
      };

      mockPrisma.batchScan.findUnique.mockResolvedValue(mockBatch);
      mockPrisma.scan.findMany.mockResolvedValue([]);

      const result = await retryFailedScans('batch-123', 'admin-456');

      expect(result.retriedCount).toBe(0);
      expect(result.jobIds).toHaveLength(0);
    });

    it('should log audit trail on retry', async () => {
      const { log: auditLog } = await import('../audit.service.js');

      const mockBatch = {
        id: 'batch-123',
        homepageUrl: 'https://example.com',
        wcagLevel: 'AA',
        guestSessionId: null,
        userId: null,
      };

      mockPrisma.batchScan.findUnique.mockResolvedValue(mockBatch);
      mockPrisma.scan.findMany.mockResolvedValue([
        { id: 'scan-1', url: 'https://example.com/page1' },
      ]);
      mockPrisma.scan.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.batchScan.update.mockResolvedValue(mockBatch);

      await retryFailedScans('batch-123', 'admin-456');

      // Wait for audit log to be called
      await new Promise((r) => setTimeout(r, 10));

      expect(auditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: 'admin-456',
          action: 'RETRY_BATCH',
          targetId: 'batch-123',
        })
      );
    });

    it('should throw error for non-existent batch', async () => {
      mockPrisma.batchScan.findUnique.mockResolvedValue(null);

      await expect(retryFailedScans('nonexistent', 'admin-456')).rejects.toThrow(
        'Batch not found'
      );
    });
  });

  describe('getBatchMetrics', () => {
    it('should return comprehensive batch metrics', async () => {
      mockPrisma.batchScan.count.mockResolvedValue(10);
      mockPrisma.batchScan.aggregate.mockResolvedValue({
        _avg: { totalUrls: 15.5 },
      });
      mockPrisma.batchScan.findMany.mockResolvedValue([
        {
          id: 'batch-1',
          homepageUrl: 'https://example.com',
          status: 'COMPLETED',
          totalUrls: 10,
          completedCount: 8,
          failedCount: 2,
          createdAt: new Date(),
          completedAt: new Date(),
        },
      ]);
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await getBatchMetrics();

      expect(result.totals).toBeDefined();
      expect(result.totals.today).toBe(10);
      expect(result.averages).toBeDefined();
      expect(result.recentBatches).toBeDefined();
      expect(result.trends).toBeDefined();
    });
  });

  describe('BatchAdminServiceError', () => {
    it('should create error with code and message', () => {
      const error = new BatchAdminServiceError('Test error', 'UNAUTHORIZED');

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.name).toBe('BatchAdminServiceError');
      expect(error.cause).toBeUndefined();
    });

    it('should create error with cause', () => {
      const cause = new Error('Original error');
      const error = new BatchAdminServiceError('Test error', 'UNAUTHORIZED', cause);

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.cause).toBe(cause);
    });

    it('should be instanceof Error', () => {
      const error = new BatchAdminServiceError('Test', 'UNAUTHORIZED');

      expect(error instanceof Error).toBe(true);
      expect(error instanceof BatchAdminServiceError).toBe(true);
    });
  });
});

/**
 * Batch Status Service Tests
 *
 * Tests for batch status notification and aggregate statistics calculation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { BatchScan, PrismaClient, Scan, ScanResult } from '@prisma/client';
import {
  notifyScanComplete,
  BatchStatusServiceError,
  type BatchStatusResult,
} from '../batch-status.service.js';
import * as prismaModule from '../../config/prisma.js';

// Mock Prisma client
const mockPrismaClient = {
  scan: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  batchScan: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
} as unknown as PrismaClient;

// Mock getPrismaClient
vi.mock('../../config/prisma.js', () => ({
  getPrismaClient: vi.fn(),
}));

describe('BatchStatusService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(prismaModule, 'getPrismaClient').mockReturnValue(mockPrismaClient);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('notifyScanComplete - Input Validation', () => {
    it('should throw error if scanId is empty', async () => {
      await expect(notifyScanComplete('', 'COMPLETED')).rejects.toThrow(
        BatchStatusServiceError
      );
      await expect(notifyScanComplete('', 'COMPLETED')).rejects.toThrow(
        'Scan ID is required and must be a string'
      );
    });

    it('should throw error if status is invalid', async () => {
      await expect(
        notifyScanComplete('scan-123', 'PENDING' as any)
      ).rejects.toThrow(BatchStatusServiceError);
      await expect(
        notifyScanComplete('scan-123', 'RUNNING' as any)
      ).rejects.toThrow('Status must be COMPLETED or FAILED');
    });

    it('should throw error if scan is not found', async () => {
      mockPrismaClient.scan.findUnique = vi.fn().mockResolvedValue(null);

      await expect(notifyScanComplete('scan-123', 'COMPLETED')).rejects.toThrow(
        BatchStatusServiceError
      );
      await expect(notifyScanComplete('scan-123', 'COMPLETED')).rejects.toThrow(
        'Scan not found: scan-123'
      );
    });
  });

  describe('notifyScanComplete - Non-Batch Scans', () => {
    it('should return null if scan does not belong to a batch', async () => {
      const mockScan: Partial<Scan> = {
        id: 'scan-123',
        batchId: null,
        status: 'COMPLETED',
      };

      mockPrismaClient.scan.findUnique = vi.fn().mockResolvedValue(mockScan);

      const result = await notifyScanComplete('scan-123', 'COMPLETED');

      expect(result).toBeNull();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('does not belong to a batch')
      );
    });
  });

  describe('notifyScanComplete - Batch Already Complete', () => {
    it('should return null if batch is already COMPLETED', async () => {
      const mockScan: Partial<Scan> = {
        id: 'scan-123',
        batchId: 'batch-456',
        status: 'COMPLETED',
      };

      const mockBatch: Partial<BatchScan> = {
        id: 'batch-456',
        status: 'COMPLETED',
        totalUrls: 3,
      };

      mockPrismaClient.scan.findUnique = vi.fn().mockResolvedValue(mockScan);
      mockPrismaClient.batchScan.findUnique = vi
        .fn()
        .mockResolvedValue(mockBatch);

      const result = await notifyScanComplete('scan-123', 'COMPLETED');

      expect(result).toBeNull();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('already in final state: COMPLETED')
      );
    });

    it('should return null if batch is already FAILED', async () => {
      const mockScan: Partial<Scan> = {
        id: 'scan-123',
        batchId: 'batch-456',
        status: 'FAILED',
      };

      const mockBatch: Partial<BatchScan> = {
        id: 'batch-456',
        status: 'FAILED',
        totalUrls: 3,
      };

      mockPrismaClient.scan.findUnique = vi.fn().mockResolvedValue(mockScan);
      mockPrismaClient.batchScan.findUnique = vi
        .fn()
        .mockResolvedValue(mockBatch);

      const result = await notifyScanComplete('scan-123', 'FAILED');

      expect(result).toBeNull();
    });

    it('should return null if batch is CANCELLED', async () => {
      const mockScan: Partial<Scan> = {
        id: 'scan-123',
        batchId: 'batch-456',
        status: 'COMPLETED',
      };

      const mockBatch: Partial<BatchScan> = {
        id: 'batch-456',
        status: 'CANCELLED',
        totalUrls: 3,
      };

      mockPrismaClient.scan.findUnique = vi.fn().mockResolvedValue(mockScan);
      mockPrismaClient.batchScan.findUnique = vi
        .fn()
        .mockResolvedValue(mockBatch);

      const result = await notifyScanComplete('scan-123', 'COMPLETED');

      expect(result).toBeNull();
    });
  });

  describe('notifyScanComplete - Batch In Progress', () => {
    it('should update counts but not complete batch if scans are still pending', async () => {
      const mockScan: Partial<Scan> = {
        id: 'scan-1',
        batchId: 'batch-456',
        status: 'COMPLETED',
      };

      const mockBatch: Partial<BatchScan> = {
        id: 'batch-456',
        status: 'RUNNING',
        totalUrls: 3,
      };

      const mockBatchScans = [
        { id: 'scan-1', status: 'COMPLETED', scanResult: { totalIssues: 5, criticalCount: 1, seriousCount: 2, moderateCount: 1, minorCount: 1, passedChecks: 10 } },
        { id: 'scan-2', status: 'COMPLETED', scanResult: { totalIssues: 3, criticalCount: 0, seriousCount: 1, moderateCount: 1, minorCount: 1, passedChecks: 12 } },
        { id: 'scan-3', status: 'PENDING', scanResult: null },
      ];

      mockPrismaClient.scan.findUnique = vi.fn().mockResolvedValue(mockScan);
      mockPrismaClient.batchScan.findUnique = vi
        .fn()
        .mockResolvedValue(mockBatch);
      mockPrismaClient.scan.findMany = vi.fn().mockResolvedValue(mockBatchScans);
      mockPrismaClient.batchScan.update = vi.fn().mockResolvedValue({
        ...mockBatch,
        completedCount: 2,
        failedCount: 0,
      });

      const result = await notifyScanComplete('scan-1', 'COMPLETED');

      expect(result).not.toBeNull();
      expect(result?.isComplete).toBe(false);
      expect(result?.status).toBe('RUNNING');
      expect(result?.completedCount).toBe(2);
      expect(result?.failedCount).toBe(0);
      expect(result?.aggregateStats).toBeUndefined();

      expect(mockPrismaClient.batchScan.update).toHaveBeenCalledWith({
        where: { id: 'batch-456' },
        data: {
          completedCount: 2,
          failedCount: 0,
          status: 'RUNNING',
        },
      });
    });
  });

  describe('notifyScanComplete - Batch Complete (All Success)', () => {
    it('should mark batch as COMPLETED when all scans succeed', async () => {
      const mockScan: Partial<Scan> = {
        id: 'scan-3',
        batchId: 'batch-456',
        status: 'COMPLETED',
      };

      const mockBatch: Partial<BatchScan> = {
        id: 'batch-456',
        status: 'RUNNING',
        totalUrls: 3,
      };

      const mockBatchScans = [
        {
          id: 'scan-1',
          status: 'COMPLETED',
          scanResult: {
            totalIssues: 5,
            criticalCount: 1,
            seriousCount: 2,
            moderateCount: 1,
            minorCount: 1,
            passedChecks: 10,
          },
        },
        {
          id: 'scan-2',
          status: 'COMPLETED',
          scanResult: {
            totalIssues: 3,
            criticalCount: 0,
            seriousCount: 1,
            moderateCount: 1,
            minorCount: 1,
            passedChecks: 12,
          },
        },
        {
          id: 'scan-3',
          status: 'COMPLETED',
          scanResult: {
            totalIssues: 7,
            criticalCount: 2,
            seriousCount: 2,
            moderateCount: 2,
            minorCount: 1,
            passedChecks: 8,
          },
        },
      ];

      mockPrismaClient.scan.findUnique = vi.fn().mockResolvedValue(mockScan);
      mockPrismaClient.batchScan.findUnique = vi
        .fn()
        .mockResolvedValue(mockBatch);
      mockPrismaClient.scan.findMany = vi.fn().mockResolvedValue(mockBatchScans);
      mockPrismaClient.batchScan.update = vi.fn().mockResolvedValue({
        ...mockBatch,
        status: 'COMPLETED',
        completedCount: 3,
        failedCount: 0,
      });

      const result = await notifyScanComplete('scan-3', 'COMPLETED');

      expect(result).not.toBeNull();
      expect(result?.isComplete).toBe(true);
      expect(result?.status).toBe('COMPLETED');
      expect(result?.completedCount).toBe(3);
      expect(result?.failedCount).toBe(0);
      expect(result?.aggregateStats).toEqual({
        totalIssues: 15, // 5 + 3 + 7
        criticalCount: 3, // 1 + 0 + 2
        seriousCount: 5, // 2 + 1 + 2
        moderateCount: 4, // 1 + 1 + 2
        minorCount: 3, // 1 + 1 + 1
        passedChecks: 30, // 10 + 12 + 8
        urlsScanned: 3,
      });

      expect(mockPrismaClient.batchScan.update).toHaveBeenCalledWith({
        where: { id: 'batch-456' },
        data: expect.objectContaining({
          status: 'COMPLETED',
          completedCount: 3,
          failedCount: 0,
          totalIssues: 15,
          criticalCount: 3,
          seriousCount: 5,
          moderateCount: 4,
          minorCount: 3,
          completedAt: expect.any(Date),
        }),
      });
    });
  });

  describe('notifyScanComplete - Batch Complete (With Failures)', () => {
    it('should mark batch as FAILED when any scan fails (Requirement 2.6)', async () => {
      const mockScan: Partial<Scan> = {
        id: 'scan-3',
        batchId: 'batch-456',
        status: 'FAILED',
      };

      const mockBatch: Partial<BatchScan> = {
        id: 'batch-456',
        status: 'RUNNING',
        totalUrls: 3,
      };

      const mockBatchScans = [
        {
          id: 'scan-1',
          status: 'COMPLETED',
          scanResult: {
            totalIssues: 5,
            criticalCount: 1,
            seriousCount: 2,
            moderateCount: 1,
            minorCount: 1,
            passedChecks: 10,
          },
        },
        {
          id: 'scan-2',
          status: 'COMPLETED',
          scanResult: {
            totalIssues: 3,
            criticalCount: 0,
            seriousCount: 1,
            moderateCount: 1,
            minorCount: 1,
            passedChecks: 12,
          },
        },
        {
          id: 'scan-3',
          status: 'FAILED',
          scanResult: null,
        },
      ];

      mockPrismaClient.scan.findUnique = vi.fn().mockResolvedValue(mockScan);
      mockPrismaClient.batchScan.findUnique = vi
        .fn()
        .mockResolvedValue(mockBatch);
      mockPrismaClient.scan.findMany = vi.fn().mockResolvedValue(mockBatchScans);
      mockPrismaClient.batchScan.update = vi.fn().mockResolvedValue({
        ...mockBatch,
        status: 'FAILED',
        completedCount: 2,
        failedCount: 1,
      });

      const result = await notifyScanComplete('scan-3', 'FAILED');

      expect(result).not.toBeNull();
      expect(result?.isComplete).toBe(true);
      expect(result?.status).toBe('FAILED');
      expect(result?.completedCount).toBe(2);
      expect(result?.failedCount).toBe(1);
      expect(result?.aggregateStats).toEqual({
        totalIssues: 8, // 5 + 3, excluding failed scan
        criticalCount: 1, // 1 + 0
        seriousCount: 3, // 2 + 1
        moderateCount: 2, // 1 + 1
        minorCount: 2, // 1 + 1
        passedChecks: 22, // 10 + 12
        urlsScanned: 2, // Only successful scans
      });

      expect(mockPrismaClient.batchScan.update).toHaveBeenCalledWith({
        where: { id: 'batch-456' },
        data: expect.objectContaining({
          status: 'FAILED',
          completedCount: 2,
          failedCount: 1,
          totalIssues: 8,
          criticalCount: 1,
          seriousCount: 3,
          moderateCount: 2,
          minorCount: 2,
          completedAt: expect.any(Date),
        }),
      });
    });

    it('should include partial results even when all scans fail', async () => {
      const mockScan: Partial<Scan> = {
        id: 'scan-3',
        batchId: 'batch-456',
        status: 'FAILED',
      };

      const mockBatch: Partial<BatchScan> = {
        id: 'batch-456',
        status: 'RUNNING',
        totalUrls: 3,
      };

      const mockBatchScans = [
        { id: 'scan-1', status: 'FAILED', scanResult: null },
        { id: 'scan-2', status: 'FAILED', scanResult: null },
        { id: 'scan-3', status: 'FAILED', scanResult: null },
      ];

      mockPrismaClient.scan.findUnique = vi.fn().mockResolvedValue(mockScan);
      mockPrismaClient.batchScan.findUnique = vi
        .fn()
        .mockResolvedValue(mockBatch);
      mockPrismaClient.scan.findMany = vi.fn().mockResolvedValue(mockBatchScans);
      mockPrismaClient.batchScan.update = vi.fn().mockResolvedValue({
        ...mockBatch,
        status: 'FAILED',
        completedCount: 0,
        failedCount: 3,
      });

      const result = await notifyScanComplete('scan-3', 'FAILED');

      expect(result).not.toBeNull();
      expect(result?.status).toBe('FAILED');
      expect(result?.completedCount).toBe(0);
      expect(result?.failedCount).toBe(3);
      expect(result?.aggregateStats).toEqual({
        totalIssues: 0,
        criticalCount: 0,
        seriousCount: 0,
        moderateCount: 0,
        minorCount: 0,
        passedChecks: 0,
        urlsScanned: 0,
      });
    });
  });

  describe('notifyScanComplete - Aggregate Statistics (Requirement 3.7)', () => {
    it('should calculate aggregate stats including passed checks and URLs scanned', async () => {
      const mockScan: Partial<Scan> = {
        id: 'scan-2',
        batchId: 'batch-456',
        status: 'COMPLETED',
      };

      const mockBatch: Partial<BatchScan> = {
        id: 'batch-456',
        status: 'RUNNING',
        totalUrls: 2,
      };

      const mockBatchScans = [
        {
          id: 'scan-1',
          status: 'COMPLETED',
          scanResult: {
            totalIssues: 10,
            criticalCount: 2,
            seriousCount: 3,
            moderateCount: 3,
            minorCount: 2,
            passedChecks: 25,
          },
        },
        {
          id: 'scan-2',
          status: 'COMPLETED',
          scanResult: {
            totalIssues: 5,
            criticalCount: 1,
            seriousCount: 1,
            moderateCount: 2,
            minorCount: 1,
            passedChecks: 30,
          },
        },
      ];

      mockPrismaClient.scan.findUnique = vi.fn().mockResolvedValue(mockScan);
      mockPrismaClient.batchScan.findUnique = vi
        .fn()
        .mockResolvedValue(mockBatch);
      mockPrismaClient.scan.findMany = vi.fn().mockResolvedValue(mockBatchScans);
      mockPrismaClient.batchScan.update = vi.fn().mockResolvedValue(mockBatch);

      const result = await notifyScanComplete('scan-2', 'COMPLETED');

      expect(result?.aggregateStats).toEqual({
        totalIssues: 15, // 10 + 5
        criticalCount: 3, // 2 + 1
        seriousCount: 4, // 3 + 1
        moderateCount: 5, // 3 + 2
        minorCount: 3, // 2 + 1
        passedChecks: 55, // 25 + 30 (Requirement 3.7)
        urlsScanned: 2, // 2 successful scans (Requirement 3.7)
      });
    });
  });

  describe('notifyScanComplete - Error Handling', () => {
    it('should throw BatchStatusServiceError if batch is not found', async () => {
      const mockScan: Partial<Scan> = {
        id: 'scan-123',
        batchId: 'batch-456',
        status: 'COMPLETED',
      };

      mockPrismaClient.scan.findUnique = vi.fn().mockResolvedValue(mockScan);
      mockPrismaClient.batchScan.findUnique = vi.fn().mockResolvedValue(null);

      await expect(notifyScanComplete('scan-123', 'COMPLETED')).rejects.toThrow(
        BatchStatusServiceError
      );
      await expect(notifyScanComplete('scan-123', 'COMPLETED')).rejects.toThrow(
        'Batch not found: batch-456'
      );
    });

    it('should wrap database errors in BatchStatusServiceError', async () => {
      mockPrismaClient.scan.findUnique = vi
        .fn()
        .mockRejectedValue(new Error('Database connection failed'));

      await expect(notifyScanComplete('scan-123', 'COMPLETED')).rejects.toThrow(
        BatchStatusServiceError
      );
      await expect(notifyScanComplete('scan-123', 'COMPLETED')).rejects.toThrow(
        'Failed to notify scan complete'
      );
    });
  });
});

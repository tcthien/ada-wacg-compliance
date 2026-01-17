/**
 * Batch Service Tests
 *
 * Unit tests for batch scan business logic layer
 * Tests: createBatch, getBatchStatus, cancelBatch, listBatches
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { BatchScan, Scan, ScanResult, ScanStatus, WcagLevel } from '@prisma/client';

// Create mock Redis client
const mockRedisClient = vi.hoisted(() => ({
  setex: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
  options: {
    host: 'localhost',
    port: 6379,
    db: 0,
  },
}));

// Mock dependencies before imports
vi.mock('../../config/redis.js', () => ({
  getRedisClient: vi.fn(() => mockRedisClient),
}));

vi.mock('./batch.repository.js');
vi.mock('../scans/scan.repository.js');
vi.mock('../../shared/utils/url-validator.js');
vi.mock('../../shared/queue/queue.service.js');
vi.mock('../../config/database.js');

// Now safe to import
import {
  createBatch,
  getBatchStatus,
  getBatchResults,
  listBatches,
  cancelBatch,
  BatchServiceError,
  type CreateBatchInput,
} from './batch.service.js';
import * as batchRepository from './batch.repository.js';
import * as scanRepository from '../scans/scan.repository.js';
import * as urlValidator from '../../shared/utils/url-validator.js';
import * as queueService from '../../shared/queue/queue.service.js';
import { getPrismaClient } from '../../config/database.js';

describe('Batch Service', () => {
  let mockPrismaClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup Prisma mock
    mockPrismaClient = {
      scan: {
        findMany: vi.fn(),
        updateMany: vi.fn(),
      },
    };
    vi.mocked(getPrismaClient).mockReturnValue(mockPrismaClient);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createBatch', () => {
    const validInput: CreateBatchInput = {
      urls: ['https://example.com', 'https://example.com/about'],
      wcagLevel: 'AA' as WcagLevel,
      homepageUrl: 'https://example.com',
      guestSessionId: 'session-123',
    };

    const mockBatch: BatchScan = {
      id: 'batch-123',
      homepageUrl: 'https://example.com',
      wcagLevel: 'AA' as WcagLevel,
      totalUrls: 2,
      completedCount: 0,
      failedCount: 0,
      status: 'PENDING',
      guestSessionId: 'session-123',
      userId: null,
      discoveryId: null,
      totalIssues: null,
      criticalCount: null,
      seriousCount: null,
      moderateCount: null,
      minorCount: null,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      completedAt: null,
      cancelledAt: null,
    };

    const mockRunningBatch: BatchScan = {
      ...mockBatch,
      status: 'RUNNING',
    };

    const mockScan = (id: string, url: string): Scan => ({
      id,
      url,
      wcagLevel: 'AA' as WcagLevel,
      status: 'PENDING' as ScanStatus,
      guestSessionId: 'session-123',
      userId: null,
      email: null,
      pageTitle: null,
      batchId: 'batch-123',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      completedAt: null,
      errorMessage: null,
    });

    it('should create batch with valid URLs successfully', async () => {
      // Arrange
      vi.mocked(urlValidator.validateUrl)
        .mockResolvedValueOnce({
          isValid: true,
          normalizedUrl: 'https://example.com',
          hostname: 'example.com',
          resolvedIp: '93.184.216.34',
        })
        .mockResolvedValueOnce({
          isValid: true,
          normalizedUrl: 'https://example.com/about',
          hostname: 'example.com',
          resolvedIp: '93.184.216.34',
        });

      vi.mocked(batchRepository.create).mockResolvedValue(mockBatch);
      vi.mocked(scanRepository.createScan)
        .mockResolvedValueOnce(mockScan('scan-1', 'https://example.com'))
        .mockResolvedValueOnce(mockScan('scan-2', 'https://example.com/about'));
      vi.mocked(queueService.addScanJob)
        .mockResolvedValueOnce('job-1')
        .mockResolvedValueOnce('job-2');
      vi.mocked(batchRepository.updateStatus).mockResolvedValue(mockRunningBatch);
      vi.mocked(mockRedisClient.setex).mockResolvedValue('OK' as never);

      // Act
      const result = await createBatch(validInput);

      // Assert
      expect(result.batch).toEqual(mockRunningBatch);
      expect(result.scans).toHaveLength(2);
      expect(result.scans[0]).toMatchObject({
        id: 'scan-1',
        url: 'https://example.com',
        status: 'PENDING',
      });
      expect(result.scans[1]).toMatchObject({
        id: 'scan-2',
        url: 'https://example.com/about',
        status: 'PENDING',
      });

      // Verify URL validation
      expect(urlValidator.validateUrl).toHaveBeenCalledTimes(2);

      // Verify batch creation
      expect(batchRepository.create).toHaveBeenCalledWith({
        homepageUrl: 'https://example.com',
        wcagLevel: 'AA',
        totalUrls: 2,
        guestSessionId: 'session-123',
        userId: null,
        discoveryId: null,
      });

      // Verify scan creation
      expect(scanRepository.createScan).toHaveBeenCalledTimes(2);

      // Verify job queuing
      expect(queueService.addScanJob).toHaveBeenCalledTimes(2);

      // Verify status update
      expect(batchRepository.updateStatus).toHaveBeenCalledWith('batch-123', 'RUNNING');
    });

    it('should reject batch with 0 URLs (Requirement 1.8)', async () => {
      // Arrange
      const invalidInput: CreateBatchInput = {
        urls: [],
        guestSessionId: 'session-123',
      };

      // Act & Assert
      await expect(createBatch(invalidInput)).rejects.toThrow(BatchServiceError);
      await expect(createBatch(invalidInput)).rejects.toMatchObject({
        code: 'INVALID_INPUT',
        message: 'At least one URL is required',
      });
    });

    it('should reject batch with more than 5 URLs (free tier quota)', async () => {
      // Arrange - 6 URLs exceeds the free tier limit of 5
      const tooManyUrls = Array.from({ length: 6 }, (_, i) => `https://example.com/page${i}`);
      const invalidInput: CreateBatchInput = {
        urls: tooManyUrls,
        guestSessionId: 'session-123',
      };

      // Act & Assert
      await expect(createBatch(invalidInput)).rejects.toThrow(BatchServiceError);
      await expect(createBatch(invalidInput)).rejects.toMatchObject({
        code: 'BATCH_SIZE_EXCEEDED',
        message: 'Batch size limit exceeded (maximum 5 URLs for free tier)',
      });
    });

    it('should reject batch if any URL is invalid (Requirement 1.7)', async () => {
      // Arrange - use mockImplementation to handle multiple calls
      let callCount = 0;
      vi.mocked(urlValidator.validateUrl).mockImplementation(async () => {
        callCount++;
        if (callCount % 2 === 1) {
          return {
            isValid: true,
            normalizedUrl: 'https://example.com',
            hostname: 'example.com',
            resolvedIp: '93.184.216.34',
          };
        } else {
          return {
            isValid: false,
            error: 'Invalid URL format',
          };
        }
      });

      const input: CreateBatchInput = {
        urls: ['https://example.com', 'not-a-valid-url'],
        guestSessionId: 'session-123',
      };

      // Act & Assert
      try {
        await createBatch(input);
        expect.fail('Should have thrown BatchServiceError');
      } catch (error) {
        expect(error).toBeInstanceOf(BatchServiceError);
        expect((error as BatchServiceError).code).toBe('INVALID_URL');
        expect((error as BatchServiceError).message).toContain('Invalid URLs detected');
      }

      // Should not create batch or scans
      expect(batchRepository.create).not.toHaveBeenCalled();
      expect(scanRepository.createScan).not.toHaveBeenCalled();
    });

    it('should reject URLs resolving to private IPs (SSRF protection)', async () => {
      // Arrange
      vi.mocked(urlValidator.validateUrl).mockResolvedValue({
        isValid: false,
        error: 'Resolved to private IP address: 192.168.1.1',
        hostname: 'internal.local',
        resolvedIp: '192.168.1.1',
      });

      const input: CreateBatchInput = {
        urls: ['http://internal.local'],
        guestSessionId: 'session-123',
      };

      // Act & Assert
      try {
        await createBatch(input);
        expect.fail('Should have thrown BatchServiceError');
      } catch (error) {
        expect(error).toBeInstanceOf(BatchServiceError);
        expect((error as BatchServiceError).code).toBe('INVALID_URL');
        expect((error as BatchServiceError).message).toContain('Invalid URLs detected');
      }
    });

    it('should require either guestSessionId or userId', async () => {
      // Arrange
      const input: CreateBatchInput = {
        urls: ['https://example.com'],
        // No session or user ID
      };

      // Act & Assert
      await expect(createBatch(input)).rejects.toThrow(BatchServiceError);
      await expect(createBatch(input)).rejects.toMatchObject({
        code: 'INVALID_INPUT',
        message: expect.stringContaining('guestSessionId or userId'),
      });
    });

    it('should use first URL as homepage if not provided', async () => {
      // Arrange
      vi.mocked(urlValidator.validateUrl).mockResolvedValue({
        isValid: true,
        normalizedUrl: 'https://example.com',
        hostname: 'example.com',
        resolvedIp: '93.184.216.34',
      });

      vi.mocked(batchRepository.create).mockResolvedValue(mockBatch);
      vi.mocked(scanRepository.createScan).mockResolvedValue(mockScan('scan-1', 'https://example.com'));
      vi.mocked(queueService.addScanJob).mockResolvedValue('job-1');
      vi.mocked(batchRepository.updateStatus).mockResolvedValue(mockRunningBatch);

      const input: CreateBatchInput = {
        urls: ['https://example.com'],
        guestSessionId: 'session-123',
        // No homepageUrl
      };

      // Act
      await createBatch(input);

      // Assert
      expect(batchRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          homepageUrl: 'https://example.com',
        })
      );
    });

    it('should use default WCAG level AA if not provided', async () => {
      // Arrange
      vi.mocked(urlValidator.validateUrl).mockResolvedValue({
        isValid: true,
        normalizedUrl: 'https://example.com',
        hostname: 'example.com',
        resolvedIp: '93.184.216.34',
      });

      vi.mocked(batchRepository.create).mockResolvedValue(mockBatch);
      vi.mocked(scanRepository.createScan).mockResolvedValue(mockScan('scan-1', 'https://example.com'));
      vi.mocked(queueService.addScanJob).mockResolvedValue('job-1');
      vi.mocked(batchRepository.updateStatus).mockResolvedValue(mockRunningBatch);

      const input: CreateBatchInput = {
        urls: ['https://example.com'],
        guestSessionId: 'session-123',
        // No wcagLevel
      };

      // Act
      await createBatch(input);

      // Assert
      expect(batchRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          wcagLevel: 'AA',
        })
      );
    });

    it('should cache initial batch status in Redis', async () => {
      // Arrange
      vi.mocked(urlValidator.validateUrl).mockResolvedValue({
        isValid: true,
        normalizedUrl: 'https://example.com',
        hostname: 'example.com',
        resolvedIp: '93.184.216.34',
      });

      vi.mocked(batchRepository.create).mockResolvedValue(mockBatch);
      vi.mocked(scanRepository.createScan).mockResolvedValue(mockScan('scan-1', 'https://example.com'));
      vi.mocked(queueService.addScanJob).mockResolvedValue('job-1');
      vi.mocked(batchRepository.updateStatus).mockResolvedValue(mockRunningBatch);
      vi.mocked(mockRedisClient.setex).mockResolvedValue('OK' as never);

      // Act
      await createBatch(validInput);

      // Assert
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'batch:batch-123:status',
        86400,
        expect.stringContaining('"batchId":"batch-123"')
      );
    });

    it('should handle scan creation failure gracefully', async () => {
      // Arrange
      vi.mocked(urlValidator.validateUrl).mockResolvedValue({
        isValid: true,
        normalizedUrl: 'https://example.com',
        hostname: 'example.com',
        resolvedIp: '93.184.216.34',
      });

      vi.mocked(batchRepository.create).mockResolvedValue(mockBatch);
      vi.mocked(scanRepository.createScan).mockRejectedValue(new Error('Database error'));

      const input: CreateBatchInput = {
        urls: ['https://example.com'],
        guestSessionId: 'session-123',
      };

      // Act & Assert
      await expect(createBatch(input)).rejects.toThrow(BatchServiceError);
      await expect(createBatch(input)).rejects.toMatchObject({
        code: 'CREATE_FAILED',
      });
    });
  });

  describe('getBatchStatus', () => {
    const mockBatch: BatchScan = {
      id: 'batch-123',
      homepageUrl: 'https://example.com',
      wcagLevel: 'AA' as WcagLevel,
      totalUrls: 2,
      completedCount: 1,
      failedCount: 0,
      status: 'RUNNING',
      guestSessionId: 'session-123',
      userId: null,
      discoveryId: null,
      totalIssues: null,
      criticalCount: null,
      seriousCount: null,
      moderateCount: null,
      minorCount: null,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      completedAt: null,
      cancelledAt: null,
    };

    const mockScans = [
      {
        id: 'scan-1',
        url: 'https://example.com',
        status: 'COMPLETED',
        pageTitle: 'Home Page',
        completedAt: new Date('2024-01-01T00:01:00Z'),
        errorMessage: null,
      },
      {
        id: 'scan-2',
        url: 'https://example.com/about',
        status: 'RUNNING',
        pageTitle: null,
        completedAt: null,
        errorMessage: null,
      },
    ];

    it('should return batch status with scan details', async () => {
      // Arrange
      vi.mocked(batchRepository.findById).mockResolvedValue(mockBatch);
      vi.mocked(mockPrismaClient.scan.findMany).mockResolvedValue(mockScans);

      // Act
      const result = await getBatchStatus('batch-123', 'session-123');

      // Assert
      expect(result).toMatchObject({
        batchId: 'batch-123',
        status: 'RUNNING',
        totalUrls: 2,
        completedCount: 1,
        failedCount: 0,
        homepageUrl: 'https://example.com',
        wcagLevel: 'AA',
      });
      expect(result.urls).toHaveLength(2);
      expect(result.urls[0]).toMatchObject({
        id: 'scan-1',
        url: 'https://example.com',
        status: 'COMPLETED',
      });

      expect(batchRepository.findById).toHaveBeenCalledWith('batch-123');
      expect(mockPrismaClient.scan.findMany).toHaveBeenCalledWith({
        where: { batchId: 'batch-123' },
        orderBy: { createdAt: 'asc' },
        select: expect.any(Object),
      });
    });

    it('should validate session ownership (Requirement 7.3)', async () => {
      // Arrange
      vi.mocked(batchRepository.findById).mockResolvedValue(mockBatch);

      // Act & Assert - wrong session
      await expect(
        getBatchStatus('batch-123', 'wrong-session')
      ).rejects.toThrow(BatchServiceError);

      await expect(
        getBatchStatus('batch-123', 'wrong-session')
      ).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        message: expect.stringContaining('different session'),
      });
    });

    it('should throw error for non-existent batch', async () => {
      // Arrange
      vi.mocked(batchRepository.findById).mockResolvedValue(null);

      // Act & Assert
      await expect(
        getBatchStatus('invalid-batch', 'session-123')
      ).rejects.toThrow(BatchServiceError);

      await expect(
        getBatchStatus('invalid-batch', 'session-123')
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('should allow userId as alternative to guestSessionId', async () => {
      // Arrange
      const batchWithUserId = {
        ...mockBatch,
        guestSessionId: null,
        userId: 'user-456',
      };
      vi.mocked(batchRepository.findById).mockResolvedValue(batchWithUserId);
      vi.mocked(mockPrismaClient.scan.findMany).mockResolvedValue(mockScans);

      // Act
      const result = await getBatchStatus('batch-123', 'user-456');

      // Assert
      expect(result.batchId).toBe('batch-123');
    });

    it('should require valid batch ID', async () => {
      // Act & Assert
      await expect(
        getBatchStatus('', 'session-123')
      ).rejects.toThrow(BatchServiceError);

      await expect(
        getBatchStatus('', 'session-123')
      ).rejects.toMatchObject({
        code: 'INVALID_INPUT',
        message: expect.stringContaining('Batch ID'),
      });
    });

    it('should require valid session ID', async () => {
      // Act & Assert
      await expect(
        getBatchStatus('batch-123', '')
      ).rejects.toThrow(BatchServiceError);

      await expect(
        getBatchStatus('batch-123', '')
      ).rejects.toMatchObject({
        code: 'INVALID_INPUT',
        message: expect.stringContaining('Session ID'),
      });
    });
  });

  describe('cancelBatch', () => {
    const mockBatch: BatchScan = {
      id: 'batch-123',
      homepageUrl: 'https://example.com',
      wcagLevel: 'AA' as WcagLevel,
      totalUrls: 5,
      completedCount: 2,
      failedCount: 0,
      status: 'RUNNING',
      guestSessionId: 'session-123',
      userId: null,
      discoveryId: null,
      totalIssues: null,
      criticalCount: null,
      seriousCount: null,
      moderateCount: null,
      minorCount: null,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      completedAt: null,
      cancelledAt: null,
    };

    const mockCancelledBatch: BatchScan = {
      ...mockBatch,
      status: 'CANCELLED',
      cancelledAt: new Date('2024-01-01T00:05:00Z'),
    };

    const mockScans = [
      { id: 'scan-1', url: 'https://example.com/page1', status: 'COMPLETED' },
      { id: 'scan-2', url: 'https://example.com/page2', status: 'COMPLETED' },
      { id: 'scan-3', url: 'https://example.com/page3', status: 'RUNNING' },
      { id: 'scan-4', url: 'https://example.com/page4', status: 'PENDING' },
      { id: 'scan-5', url: 'https://example.com/page5', status: 'FAILED' },
    ];

    it('should cancel pending and running scans while preserving completed (Requirement 7.3)', async () => {
      // Arrange
      vi.mocked(batchRepository.findById).mockResolvedValue(mockBatch);
      vi.mocked(mockPrismaClient.scan.findMany).mockResolvedValue(mockScans);
      vi.mocked(mockPrismaClient.scan.updateMany).mockResolvedValue({ count: 2 });
      vi.mocked(batchRepository.updateStatus).mockResolvedValue(mockCancelledBatch);
      vi.mocked(mockRedisClient.setex).mockResolvedValue('OK' as never);

      // Mock removeJob
      vi.mocked(queueService.removeJob).mockResolvedValue();

      // Act
      const result = await cancelBatch('batch-123', 'session-123');

      // Assert
      expect(result).toMatchObject({
        batchId: 'batch-123',
        status: 'CANCELLED',
        completedCount: 3, // 2 completed + 1 failed
        cancelledCount: 2, // 1 running + 1 pending
        failedToCancel: 0,
      });

      // Verify only pending/running scans were updated
      expect(mockPrismaClient.scan.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['scan-3', 'scan-4'] },
          status: { in: ['PENDING', 'RUNNING'] },
        },
        data: {
          status: 'CANCELLED',
          completedAt: expect.any(Date),
        },
      });

      // Verify batch status updated
      expect(batchRepository.updateStatus).toHaveBeenCalledWith('batch-123', 'CANCELLED');
    });

    it('should validate session ownership', async () => {
      // Arrange
      vi.mocked(batchRepository.findById).mockResolvedValue(mockBatch);

      // Act & Assert
      await expect(
        cancelBatch('batch-123', 'wrong-session')
      ).rejects.toThrow(BatchServiceError);

      await expect(
        cancelBatch('batch-123', 'wrong-session')
      ).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    });

    it('should only allow cancellation of PENDING or RUNNING batches', async () => {
      // Arrange - already completed batch
      const completedBatch = {
        ...mockBatch,
        status: 'COMPLETED',
        completedAt: new Date(),
      };
      vi.mocked(batchRepository.findById).mockResolvedValue(completedBatch);

      // Act & Assert
      await expect(
        cancelBatch('batch-123', 'session-123')
      ).rejects.toThrow(BatchServiceError);

      await expect(
        cancelBatch('batch-123', 'session-123')
      ).rejects.toMatchObject({
        code: 'INVALID_STATE',
        message: expect.stringContaining('cannot be cancelled'),
      });
    });

    it('should handle already cancelled batches', async () => {
      // Arrange
      const cancelledBatch = {
        ...mockBatch,
        status: 'CANCELLED',
      };
      vi.mocked(batchRepository.findById).mockResolvedValue(cancelledBatch);

      // Act & Assert
      await expect(
        cancelBatch('batch-123', 'session-123')
      ).rejects.toThrow(BatchServiceError);

      await expect(
        cancelBatch('batch-123', 'session-123')
      ).rejects.toMatchObject({
        code: 'INVALID_STATE',
      });
    });

    it('should attempt to remove jobs from queue', async () => {
      // Arrange
      vi.mocked(batchRepository.findById).mockResolvedValue(mockBatch);
      vi.mocked(mockPrismaClient.scan.findMany).mockResolvedValue([
        { id: 'scan-1', url: 'https://example.com', status: 'PENDING' },
      ]);
      vi.mocked(mockPrismaClient.scan.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(batchRepository.updateStatus).mockResolvedValue(mockCancelledBatch);
      vi.mocked(queueService.removeJob).mockResolvedValue();

      // Act
      await cancelBatch('batch-123', 'session-123');

      // Assert - verify job removal was attempted
      expect(queueService.removeJob).toHaveBeenCalledWith('scan-scan-1', 'scan-page');
    });

    it('should handle job removal failures gracefully', async () => {
      // Arrange
      vi.mocked(batchRepository.findById).mockResolvedValue(mockBatch);
      vi.mocked(mockPrismaClient.scan.findMany).mockResolvedValue([
        { id: 'scan-1', url: 'https://example.com', status: 'PENDING' },
      ]);
      vi.mocked(mockPrismaClient.scan.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(batchRepository.updateStatus).mockResolvedValue(mockCancelledBatch);
      vi.mocked(queueService.removeJob).mockRejectedValue(new Error('Job not found'));

      // Act - should not throw
      const result = await cancelBatch('batch-123', 'session-123');

      // Assert - cancellation should succeed despite job removal failure
      expect(result.status).toBe('CANCELLED');
    });

    it('should throw error for non-existent batch', async () => {
      // Arrange
      vi.mocked(batchRepository.findById).mockResolvedValue(null);

      // Act & Assert
      await expect(
        cancelBatch('invalid-batch', 'session-123')
      ).rejects.toThrow(BatchServiceError);

      await expect(
        cancelBatch('invalid-batch', 'session-123')
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('should update Redis cache after cancellation', async () => {
      // Arrange
      vi.mocked(batchRepository.findById).mockResolvedValue(mockBatch);
      vi.mocked(mockPrismaClient.scan.findMany).mockResolvedValue([]);
      vi.mocked(mockPrismaClient.scan.updateMany).mockResolvedValue({ count: 0 });
      vi.mocked(batchRepository.updateStatus).mockResolvedValue(mockCancelledBatch);
      vi.mocked(mockRedisClient.setex).mockResolvedValue('OK' as never);

      // Act
      await cancelBatch('batch-123', 'session-123');

      // Assert
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'batch:batch-123:status',
        86400,
        expect.stringContaining('"status":"CANCELLED"')
      );
    });
  });

  describe('listBatches', () => {
    const mockBatches: BatchScan[] = [
      {
        id: 'batch-1',
        homepageUrl: 'https://example1.com',
        wcagLevel: 'AA' as WcagLevel,
        totalUrls: 5,
        completedCount: 5,
        failedCount: 0,
        status: 'COMPLETED',
        guestSessionId: 'session-123',
        userId: null,
        discoveryId: null,
        totalIssues: 42,
        criticalCount: 5,
        seriousCount: 10,
        moderateCount: 15,
        minorCount: 12,
        createdAt: new Date('2024-01-03T00:00:00Z'),
        completedAt: new Date('2024-01-03T00:05:00Z'),
        cancelledAt: null,
      },
      {
        id: 'batch-2',
        homepageUrl: 'https://example2.com',
        wcagLevel: 'AAA' as WcagLevel,
        totalUrls: 3,
        completedCount: 1,
        failedCount: 0,
        status: 'RUNNING',
        guestSessionId: 'session-123',
        userId: null,
        discoveryId: null,
        totalIssues: null,
        criticalCount: null,
        seriousCount: null,
        moderateCount: null,
        minorCount: null,
        createdAt: new Date('2024-01-02T00:00:00Z'),
        completedAt: null,
        cancelledAt: null,
      },
      {
        id: 'batch-3',
        homepageUrl: 'https://example3.com',
        wcagLevel: 'AA' as WcagLevel,
        totalUrls: 10,
        completedCount: 0,
        failedCount: 0,
        status: 'PENDING',
        guestSessionId: 'session-123',
        userId: null,
        discoveryId: null,
        totalIssues: null,
        criticalCount: null,
        seriousCount: null,
        moderateCount: null,
        minorCount: null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        completedAt: null,
        cancelledAt: null,
      },
    ];

    it('should list batches with pagination', async () => {
      // Arrange
      vi.mocked(batchRepository.findBySessionId).mockResolvedValue(mockBatches);

      // Act
      const result = await listBatches('session-123', { page: 1, limit: 2 });

      // Assert
      expect(result.batches).toHaveLength(2);
      expect(result.batches[0]?.id).toBe('batch-1'); // Newest first
      expect(result.batches[1]?.id).toBe('batch-2');
      expect(result.pagination).toEqual({
        page: 1,
        limit: 2,
        total: 3,
        totalPages: 2,
      });
    });

    it('should return second page correctly', async () => {
      // Arrange
      vi.mocked(batchRepository.findBySessionId).mockResolvedValue(mockBatches);

      // Act
      const result = await listBatches('session-123', { page: 2, limit: 2 });

      // Assert
      expect(result.batches).toHaveLength(1);
      expect(result.batches[0]?.id).toBe('batch-3');
      expect(result.pagination).toEqual({
        page: 2,
        limit: 2,
        total: 3,
        totalPages: 2,
      });
    });

    it('should use default pagination values', async () => {
      // Arrange
      vi.mocked(batchRepository.findBySessionId).mockResolvedValue(mockBatches);

      // Act
      const result = await listBatches('session-123');

      // Assert
      expect(result.batches).toHaveLength(3);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 3,
        totalPages: 1,
      });
    });

    it('should sort batches by createdAt descending (newest first)', async () => {
      // Arrange
      vi.mocked(batchRepository.findBySessionId).mockResolvedValue(mockBatches);

      // Act
      const result = await listBatches('session-123');

      // Assert
      expect(result.batches[0]?.createdAt.getTime()).toBeGreaterThan(
        result.batches[1]?.createdAt.getTime()!
      );
      expect(result.batches[1]?.createdAt.getTime()).toBeGreaterThan(
        result.batches[2]?.createdAt.getTime()!
      );
    });

    it('should include aggregate statistics', async () => {
      // Arrange
      vi.mocked(batchRepository.findBySessionId).mockResolvedValue([mockBatches[0]!]);

      // Act
      const result = await listBatches('session-123');

      // Assert
      expect(result.batches[0]).toMatchObject({
        totalIssues: 42,
        criticalCount: 5,
        seriousCount: 10,
        moderateCount: 15,
        minorCount: 12,
      });
    });

    it('should handle empty batch list', async () => {
      // Arrange
      vi.mocked(batchRepository.findBySessionId).mockResolvedValue([]);

      // Act
      const result = await listBatches('session-123');

      // Assert
      expect(result.batches).toHaveLength(0);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      });
    });

    it('should enforce maximum limit of 100', async () => {
      // Arrange
      vi.mocked(batchRepository.findBySessionId).mockResolvedValue(mockBatches);

      // Act
      const result = await listBatches('session-123', { page: 1, limit: 200 });

      // Assert
      expect(result.pagination.limit).toBe(20); // Falls back to default
    });

    it('should handle invalid page numbers', async () => {
      // Arrange
      vi.mocked(batchRepository.findBySessionId).mockResolvedValue(mockBatches);

      // Act
      const result = await listBatches('session-123', { page: 0, limit: 10 });

      // Assert
      expect(result.pagination.page).toBe(1); // Falls back to 1
    });

    it('should throw error for invalid session ID', async () => {
      // Act & Assert
      await expect(listBatches('')).rejects.toThrow(BatchServiceError);
      await expect(listBatches('')).rejects.toMatchObject({
        code: 'INVALID_INPUT',
        message: expect.stringContaining('Session ID'),
      });
    });
  });
});

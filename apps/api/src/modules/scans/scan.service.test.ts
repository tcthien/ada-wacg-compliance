/**
 * Scan Service Tests
 *
 * Unit tests for scan business logic layer
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Redis } from 'ioredis';
import type { Scan, ScanStatus, WcagLevel } from '@prisma/client';

// Create mock Redis client with proper options structure
const mockRedisClient = vi.hoisted(() => ({
  setex: vi.fn(),
  get: vi.fn(),
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

vi.mock('./scan.repository.js');
vi.mock('../../shared/utils/url-validator.js');
vi.mock('../../shared/queue/queue.service.js');

// Now safe to import
import {
  createScan,
  getScanStatus,
  getScanResult,
  listScans,
  ScanServiceError,
} from './scan.service.js';
import * as scanRepository from './scan.repository.js';
import * as urlValidator from '../../shared/utils/url-validator.js';
import * as queueService from '../../shared/queue/queue.service.js';
import * as redis from '../../config/redis.js';

describe('Scan Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createScan', () => {
    const validInput = {
      url: 'https://example.com',
      email: 'test@example.com',
      wcagLevel: 'AA' as WcagLevel,
    };

    const mockScan: Scan = {
      id: 'scan-123',
      url: 'https://example.com',
      email: 'test@example.com',
      wcagLevel: 'AA' as WcagLevel,
      status: 'PENDING' as ScanStatus,
      guestSessionId: 'session-123',
      userId: null,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      completedAt: null,
      errorMessage: null,
    };

    it('should create a scan successfully', async () => {
      // Arrange
      vi.mocked(urlValidator.validateUrl).mockResolvedValue({
        isValid: true,
        normalizedUrl: 'https://example.com',
        hostname: 'example.com',
        resolvedIp: '93.184.216.34',
      });

      vi.mocked(scanRepository.createScan).mockResolvedValue(mockScan);
      vi.mocked(queueService.addScanJob).mockResolvedValue('job-123');
      vi.mocked(mockRedisClient.setex).mockResolvedValue('OK' as never);

      // Act
      const result = await createScan('session-123', validInput);

      // Assert
      expect(result).toEqual(mockScan);
      expect(urlValidator.validateUrl).toHaveBeenCalledWith('https://example.com');
      expect(scanRepository.createScan).toHaveBeenCalledWith({
        url: 'https://example.com',
        email: 'test@example.com',
        wcagLevel: 'AA',
        guestSessionId: 'session-123',
        userId: null,
      });
      expect(queueService.addScanJob).toHaveBeenCalledWith(
        'scan-123',
        'https://example.com',
        'AA',
        { sessionId: 'session-123' }
      );
    });

    it('should throw error for invalid session ID', async () => {
      await expect(createScan('', validInput)).rejects.toThrow(ScanServiceError);
      await expect(createScan('', validInput)).rejects.toMatchObject({
        code: 'INVALID_INPUT',
        message: expect.stringContaining('Session ID'),
      });
    });

    it('should throw error for invalid URL', async () => {
      // Arrange
      vi.mocked(urlValidator.validateUrl).mockResolvedValue({
        isValid: false,
        error: 'Invalid URL format',
      });

      // Act & Assert
      await expect(
        createScan('session-123', { url: 'invalid-url' })
      ).rejects.toThrow(ScanServiceError);

      await expect(
        createScan('session-123', { url: 'invalid-url' })
      ).rejects.toMatchObject({
        code: 'INVALID_URL',
        message: 'Invalid URL format',
      });
    });

    it('should throw error for private IP addresses', async () => {
      // Arrange
      vi.mocked(urlValidator.validateUrl).mockResolvedValue({
        isValid: false,
        error: 'Resolved to private IP address: 192.168.1.1',
        hostname: 'internal.local',
        resolvedIp: '192.168.1.1',
      });

      // Act & Assert
      await expect(
        createScan('session-123', { url: 'http://internal.local' })
      ).rejects.toThrow(ScanServiceError);

      await expect(
        createScan('session-123', { url: 'http://internal.local' })
      ).rejects.toMatchObject({
        code: 'INVALID_URL',
      });
    });

    it('should use default WCAG level if not provided', async () => {
      // Arrange
      vi.mocked(urlValidator.validateUrl).mockResolvedValue({
        isValid: true,
        normalizedUrl: 'https://example.com',
        hostname: 'example.com',
        resolvedIp: '93.184.216.34',
      });

      vi.mocked(scanRepository.createScan).mockResolvedValue({
        ...mockScan,
        wcagLevel: 'AA',
      });

      vi.mocked(queueService.addScanJob).mockResolvedValue('job-123');

      // Act
      await createScan('session-123', { url: 'https://example.com' });

      // Assert
      expect(scanRepository.createScan).toHaveBeenCalledWith(
        expect.objectContaining({
          wcagLevel: 'AA',
        })
      );
    });

    it('should cache initial scan status in Redis', async () => {
      // Arrange
      vi.mocked(urlValidator.validateUrl).mockResolvedValue({
        isValid: true,
        normalizedUrl: 'https://example.com',
        hostname: 'example.com',
        resolvedIp: '93.184.216.34',
      });

      vi.mocked(scanRepository.createScan).mockResolvedValue(mockScan);
      vi.mocked(queueService.addScanJob).mockResolvedValue('job-123');
      vi.mocked(mockRedisClient.setex).mockResolvedValue('OK' as never);

      // Act
      await createScan('session-123', validInput);

      // Assert
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'scan:scan-123:status',
        86400,
        expect.stringContaining('"scanId":"scan-123"')
      );
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'scan:scan-123:progress',
        86400,
        '0'
      );
    });

    it('should continue if queue job fails', async () => {
      // Arrange
      vi.mocked(urlValidator.validateUrl).mockResolvedValue({
        isValid: true,
        normalizedUrl: 'https://example.com',
        hostname: 'example.com',
        resolvedIp: '93.184.216.34',
      });

      vi.mocked(scanRepository.createScan).mockResolvedValue(mockScan);
      vi.mocked(queueService.addScanJob).mockRejectedValue(
        new Error('Queue error')
      );
      vi.mocked(mockRedisClient.setex).mockResolvedValue('OK' as never);

      // Act
      const result = await createScan('session-123', validInput);

      // Assert
      expect(result).toEqual(mockScan);
    });

    it('should continue if Redis caching fails', async () => {
      // Arrange
      vi.mocked(urlValidator.validateUrl).mockResolvedValue({
        isValid: true,
        normalizedUrl: 'https://example.com',
        hostname: 'example.com',
        resolvedIp: '93.184.216.34',
      });

      vi.mocked(scanRepository.createScan).mockResolvedValue(mockScan);
      vi.mocked(queueService.addScanJob).mockResolvedValue('job-123');
      vi.mocked(mockRedisClient.setex).mockRejectedValue(
        new Error('Redis error')
      );

      // Act
      const result = await createScan('session-123', validInput);

      // Assert
      expect(result).toEqual(mockScan);
    });
  });

  describe('getScanStatus', () => {
    const mockScan: Scan = {
      id: 'scan-123',
      url: 'https://example.com',
      email: null,
      wcagLevel: 'AA' as WcagLevel,
      status: 'RUNNING' as ScanStatus,
      guestSessionId: 'session-123',
      userId: null,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      completedAt: null,
      errorMessage: null,
    };

    it('should return cached status from Redis', async () => {
      // Arrange
      const cachedStatus = JSON.stringify({
        scanId: 'scan-123',
        status: 'RUNNING',
        url: 'https://example.com',
        createdAt: '2024-01-01T00:00:00.000Z',
      });

      vi.mocked(mockRedisClient.get).mockResolvedValueOnce(cachedStatus);
      vi.mocked(mockRedisClient.get).mockResolvedValueOnce('50');

      // Act
      const result = await getScanStatus('scan-123');

      // Assert
      expect(result).toEqual({
        scanId: 'scan-123',
        status: 'RUNNING',
        progress: 50,
        url: 'https://example.com',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        completedAt: null,
        errorMessage: null,
      });

      expect(mockRedisClient.get).toHaveBeenCalledWith('scan:scan-123:status');
      expect(mockRedisClient.get).toHaveBeenCalledWith('scan:scan-123:progress');
      expect(scanRepository.getScanById).not.toHaveBeenCalled();
    });

    it('should query database on cache miss', async () => {
      // Arrange
      vi.mocked(mockRedisClient.get).mockResolvedValue(null);
      vi.mocked(scanRepository.getScanById).mockResolvedValue({
        ...mockScan,
        scanResult: null,
      });
      vi.mocked(mockRedisClient.setex).mockResolvedValue('OK' as never);

      // Act
      const result = await getScanStatus('scan-123');

      // Assert
      expect(result).toEqual({
        scanId: 'scan-123',
        status: 'RUNNING',
        progress: 50,
        url: 'https://example.com',
        createdAt: mockScan.createdAt,
        completedAt: null,
        errorMessage: null,
      });

      expect(scanRepository.getScanById).toHaveBeenCalledWith('scan-123');
      expect(mockRedisClient.setex).toHaveBeenCalled();
    });

    it('should return null for invalid scan ID', async () => {
      const result = await getScanStatus('');
      expect(result).toBeNull();
    });

    it('should return null for non-existent scan', async () => {
      // Arrange
      vi.mocked(mockRedisClient.get).mockResolvedValue(null);
      vi.mocked(scanRepository.getScanById).mockResolvedValue(null);

      // Act
      const result = await getScanStatus('scan-999');

      // Assert
      expect(result).toBeNull();
    });

    it('should calculate correct progress for different statuses', async () => {
      vi.mocked(mockRedisClient.get).mockResolvedValue(null);
      vi.mocked(mockRedisClient.setex).mockResolvedValue('OK' as never);

      // Test PENDING
      vi.mocked(scanRepository.getScanById).mockResolvedValue({
        ...mockScan,
        status: 'PENDING',
        scanResult: null,
      });
      let result = await getScanStatus('scan-123');
      expect(result?.progress).toBe(0);

      // Test RUNNING
      vi.mocked(scanRepository.getScanById).mockResolvedValue({
        ...mockScan,
        status: 'RUNNING',
        scanResult: null,
      });
      result = await getScanStatus('scan-123');
      expect(result?.progress).toBe(50);

      // Test COMPLETED
      vi.mocked(scanRepository.getScanById).mockResolvedValue({
        ...mockScan,
        status: 'COMPLETED',
        scanResult: null,
      });
      result = await getScanStatus('scan-123');
      expect(result?.progress).toBe(100);

      // Test FAILED
      vi.mocked(scanRepository.getScanById).mockResolvedValue({
        ...mockScan,
        status: 'FAILED',
        scanResult: null,
      });
      result = await getScanStatus('scan-123');
      expect(result?.progress).toBe(0);
    });

    it('should handle Redis errors gracefully', async () => {
      // Arrange
      vi.mocked(mockRedisClient.get).mockRejectedValue(
        new Error('Redis connection error')
      );
      vi.mocked(scanRepository.getScanById).mockResolvedValue({
        ...mockScan,
        scanResult: null,
      });
      vi.mocked(mockRedisClient.setex).mockResolvedValue('OK' as never);

      // Act
      const result = await getScanStatus('scan-123');

      // Assert
      expect(result).toBeDefined();
      expect(scanRepository.getScanById).toHaveBeenCalled();
    });
  });

  describe('getScanResult', () => {
    const mockScanWithResult = {
      id: 'scan-123',
      url: 'https://example.com',
      email: null,
      wcagLevel: 'AA' as WcagLevel,
      status: 'COMPLETED' as ScanStatus,
      guestSessionId: 'session-123',
      userId: null,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      completedAt: new Date('2024-01-01T00:05:00Z'),
      errorMessage: null,
      scanResult: {
        id: 'result-123',
        scanId: 'scan-123',
        totalIssues: 5,
        criticalCount: 1,
        seriousCount: 2,
        moderateCount: 1,
        minorCount: 1,
        passedRules: 45,
        testedRules: 50,
        scanDurationMs: 3500,
        createdAt: new Date('2024-01-01T00:05:00Z'),
        issues: [
          {
            id: 'issue-1',
            scanResultId: 'result-123',
            impact: 'CRITICAL',
            wcagCriterion: '1.1.1',
            description: 'Images must have alt text',
            helpUrl: 'https://example.com/help',
            selector: 'img.logo',
            htmlSnippet: '<img class="logo" src="logo.png">',
            createdAt: new Date('2024-01-01T00:05:00Z'),
          },
        ],
      },
    };

    it('should return scan result with issues', async () => {
      // Arrange
      vi.mocked(scanRepository.getScanById).mockResolvedValue(mockScanWithResult);

      // Act
      const result = await getScanResult('scan-123');

      // Assert
      expect(result).toEqual({
        scanId: 'scan-123',
        url: 'https://example.com',
        status: 'COMPLETED',
        wcagLevel: 'AA',
        createdAt: mockScanWithResult.createdAt,
        completedAt: mockScanWithResult.completedAt,
        result: {
          totalIssues: 5,
          criticalCount: 1,
          seriousCount: 2,
          moderateCount: 1,
          minorCount: 1,
          passedRules: 45,
          testedRules: 50,
          scanDurationMs: 3500,
          issues: [
            {
              id: 'issue-1',
              impact: 'CRITICAL',
              wcagCriterion: '1.1.1',
              description: 'Images must have alt text',
              helpUrl: 'https://example.com/help',
              selector: 'img.logo',
              htmlSnippet: '<img class="logo" src="logo.png">',
            },
          ],
        },
      });
    });

    it('should throw error for invalid scan ID', async () => {
      await expect(getScanResult('')).rejects.toThrow(ScanServiceError);
      await expect(getScanResult('')).rejects.toMatchObject({
        code: 'INVALID_INPUT',
      });
    });

    it('should throw error for non-existent scan', async () => {
      // Arrange
      vi.mocked(scanRepository.getScanById).mockResolvedValue(null);

      // Act & Assert
      await expect(getScanResult('scan-999')).rejects.toThrow(ScanServiceError);
      await expect(getScanResult('scan-999')).rejects.toMatchObject({
        code: 'SCAN_NOT_FOUND',
      });
    });

    it('should throw error for incomplete scan', async () => {
      // Arrange
      vi.mocked(scanRepository.getScanById).mockResolvedValue({
        ...mockScanWithResult,
        status: 'RUNNING',
      });

      // Act & Assert
      await expect(getScanResult('scan-123')).rejects.toThrow(ScanServiceError);
      await expect(getScanResult('scan-123')).rejects.toMatchObject({
        code: 'SCAN_NOT_COMPLETE',
        message: expect.stringContaining('RUNNING'),
      });
    });

    it('should handle scan without results', async () => {
      // Arrange
      vi.mocked(scanRepository.getScanById).mockResolvedValue({
        ...mockScanWithResult,
        scanResult: null,
      });

      // Act
      const result = await getScanResult('scan-123');

      // Assert
      expect(result?.result).toBeNull();
    });
  });

  describe('listScans', () => {
    const mockScans: Scan[] = [
      {
        id: 'scan-1',
        url: 'https://example.com',
        email: null,
        wcagLevel: 'AA' as WcagLevel,
        status: 'COMPLETED' as ScanStatus,
        guestSessionId: 'session-123',
        userId: null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        completedAt: new Date('2024-01-01T00:05:00Z'),
        errorMessage: null,
      },
      {
        id: 'scan-2',
        url: 'https://example.org',
        email: null,
        wcagLevel: 'AAA' as WcagLevel,
        status: 'PENDING' as ScanStatus,
        guestSessionId: 'session-123',
        userId: null,
        createdAt: new Date('2024-01-02T00:00:00Z'),
        completedAt: null,
        errorMessage: null,
      },
    ];

    it('should list scans for a session', async () => {
      // Arrange
      vi.mocked(scanRepository.listScansBySession).mockResolvedValue({
        items: mockScans,
        nextCursor: null,
        totalCount: 2,
      });

      // Act
      const result = await listScans('session-123');

      // Assert
      expect(result).toEqual({
        items: mockScans,
        nextCursor: null,
        totalCount: 2,
      });

      expect(scanRepository.listScansBySession).toHaveBeenCalledWith(
        'session-123',
        undefined
      );
    });

    it('should support pagination', async () => {
      // Arrange
      vi.mocked(scanRepository.listScansBySession).mockResolvedValue({
        items: [mockScans[0]!],
        nextCursor: 'scan-1',
        totalCount: 2,
      });

      // Act
      const result = await listScans('session-123', {
        limit: 1,
      });

      // Assert
      expect(result.items).toHaveLength(1);
      expect(result.nextCursor).toBe('scan-1');
      expect(result.totalCount).toBe(2);

      expect(scanRepository.listScansBySession).toHaveBeenCalledWith(
        'session-123',
        { limit: 1 }
      );
    });

    it('should throw error for invalid session ID', async () => {
      await expect(listScans('')).rejects.toThrow(ScanServiceError);
      await expect(listScans('')).rejects.toMatchObject({
        code: 'INVALID_INPUT',
      });
    });

    it('should handle empty results', async () => {
      // Arrange
      vi.mocked(scanRepository.listScansBySession).mockResolvedValue({
        items: [],
        nextCursor: null,
        totalCount: 0,
      });

      // Act
      const result = await listScans('session-123');

      // Assert
      expect(result.items).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });
  });
});

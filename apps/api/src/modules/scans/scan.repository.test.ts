/**
 * Scan Repository Unit Tests
 *
 * Tests database operations for scans using mocked Prisma client.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Scan, ScanResult, Issue, ScanStatus, WcagLevel } from '@prisma/client';
import {
  createScan,
  getScanById,
  listScansBySession,
  updateScanStatus,
  ScanRepositoryError,
  type CreateScanData,
  type ScanWithResult,
  type PaginationOptions,
} from './scan.repository.js';

// Mock database module
vi.mock('../../config/database.js', () => ({
  getPrismaClient: vi.fn(),
}));

// Import after mocking
import { getPrismaClient } from '../../config/database.js';

// Mock Prisma client
const mockPrismaClient = {
  scan: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
};

// Helper to create mock scan
function createMockScan(overrides: Partial<Scan> = {}): Scan {
  return {
    id: 'scan-123',
    guestSessionId: 'session-123',
    userId: null,
    url: 'https://example.com',
    email: 'test@example.com',
    status: 'PENDING' as ScanStatus,
    wcagLevel: 'AA' as WcagLevel,
    durationMs: null,
    errorMessage: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    completedAt: null,
    ...overrides,
  };
}

// Helper to create mock scan result
function createMockScanResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    id: 'result-123',
    scanId: 'scan-123',
    totalIssues: 5,
    criticalCount: 1,
    seriousCount: 2,
    moderateCount: 1,
    minorCount: 1,
    passedChecks: 10,
    inapplicableChecks: 3,
    createdAt: new Date('2024-01-01T00:10:00Z'),
    ...overrides,
  };
}

// Helper to create mock issue
function createMockIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: 'issue-123',
    scanResultId: 'result-123',
    ruleId: 'color-contrast',
    wcagCriteria: ['1.4.3'],
    impact: 'SERIOUS',
    description: 'Color contrast issue',
    helpText: 'Ensure sufficient color contrast',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.8/color-contrast',
    htmlSnippet: '<div>Text</div>',
    cssSelector: 'div.content',
    nodes: [],
    createdAt: new Date('2024-01-01T00:10:00Z'),
    ...overrides,
  };
}

describe('Scan Repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error - Mock implementation
    vi.mocked(getPrismaClient).mockReturnValue(mockPrismaClient);
    // Suppress console logs during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createScan', () => {
    it('should create a scan successfully', async () => {
      const mockScan = createMockScan();
      mockPrismaClient.scan.create.mockResolvedValue(mockScan);

      const data: CreateScanData = {
        url: 'https://example.com',
        email: 'test@example.com',
        wcagLevel: 'AA',
        guestSessionId: 'session-123',
      };

      const result = await createScan(data);

      expect(result).toEqual(mockScan);
      expect(mockPrismaClient.scan.create).toHaveBeenCalledWith({
        data: {
          url: 'https://example.com',
          email: 'test@example.com',
          wcagLevel: 'AA',
          guestSessionId: 'session-123',
          userId: null,
          status: 'PENDING',
        },
      });
    });

    it('should create a scan without email', async () => {
      const mockScan = createMockScan({ email: null });
      mockPrismaClient.scan.create.mockResolvedValue(mockScan);

      const data: CreateScanData = {
        url: 'https://example.com',
        wcagLevel: 'AA',
        guestSessionId: 'session-123',
      };

      const result = await createScan(data);

      expect(result).toEqual(mockScan);
      expect(mockPrismaClient.scan.create).toHaveBeenCalledWith({
        data: {
          url: 'https://example.com',
          email: null,
          wcagLevel: 'AA',
          guestSessionId: 'session-123',
          userId: null,
          status: 'PENDING',
        },
      });
    });

    it('should create a scan for authenticated user', async () => {
      const mockScan = createMockScan({
        guestSessionId: null,
        userId: 'user-123',
      });
      mockPrismaClient.scan.create.mockResolvedValue(mockScan);

      const data: CreateScanData = {
        url: 'https://example.com',
        email: 'test@example.com',
        wcagLevel: 'AA',
        userId: 'user-123',
      };

      const result = await createScan(data);

      expect(result).toEqual(mockScan);
      expect(mockPrismaClient.scan.create).toHaveBeenCalledWith({
        data: {
          url: 'https://example.com',
          email: 'test@example.com',
          wcagLevel: 'AA',
          guestSessionId: null,
          userId: 'user-123',
          status: 'PENDING',
        },
      });
    });

    it('should throw error if URL is missing', async () => {
      const data = {
        wcagLevel: 'AA' as WcagLevel,
        guestSessionId: 'session-123',
      } as CreateScanData;

      await expect(createScan(data)).rejects.toThrow(ScanRepositoryError);
      await expect(createScan(data)).rejects.toMatchObject({
        code: 'INVALID_INPUT',
        message: 'URL is required and must be a string',
      });
    });

    it('should throw error if WCAG level is missing', async () => {
      const data = {
        url: 'https://example.com',
        guestSessionId: 'session-123',
      } as CreateScanData;

      await expect(createScan(data)).rejects.toThrow(ScanRepositoryError);
      await expect(createScan(data)).rejects.toMatchObject({
        code: 'INVALID_INPUT',
        message: 'WCAG level is required',
      });
    });

    it('should throw error if neither session ID nor user ID is provided', async () => {
      const data: CreateScanData = {
        url: 'https://example.com',
        wcagLevel: 'AA',
      };

      await expect(createScan(data)).rejects.toThrow(ScanRepositoryError);
      await expect(createScan(data)).rejects.toMatchObject({
        code: 'INVALID_INPUT',
        message: 'Either guestSessionId or userId must be provided',
      });
    });

    it('should wrap database errors', async () => {
      mockPrismaClient.scan.create.mockRejectedValue(
        new Error('Database connection failed')
      );

      const data: CreateScanData = {
        url: 'https://example.com',
        wcagLevel: 'AA',
        guestSessionId: 'session-123',
      };

      await expect(createScan(data)).rejects.toThrow(ScanRepositoryError);
      await expect(createScan(data)).rejects.toMatchObject({
        code: 'CREATE_FAILED',
        message: 'Failed to create scan',
      });
    });
  });

  describe('getScanById', () => {
    it('should get scan with result and issues', async () => {
      const mockIssue = createMockIssue();
      const mockResult = createMockScanResult();
      const mockScan = createMockScan({ status: 'COMPLETED' });

      const mockScanWithResult: ScanWithResult = {
        ...mockScan,
        scanResult: {
          ...mockResult,
          issues: [mockIssue],
        },
      };

      mockPrismaClient.scan.findUnique.mockResolvedValue(mockScanWithResult);

      const result = await getScanById('scan-123');

      expect(result).toEqual(mockScanWithResult);
      expect(mockPrismaClient.scan.findUnique).toHaveBeenCalledWith({
        where: { id: 'scan-123' },
        include: {
          scanResult: {
            include: {
              issues: {
                orderBy: {
                  impact: 'asc',
                },
              },
            },
          },
        },
      });
    });

    it('should return scan without result if not completed', async () => {
      const mockScan = createMockScan();
      const mockScanWithResult: ScanWithResult = {
        ...mockScan,
        scanResult: null,
      };

      mockPrismaClient.scan.findUnique.mockResolvedValue(mockScanWithResult);

      const result = await getScanById('scan-123');

      expect(result).toEqual(mockScanWithResult);
      expect(result?.scanResult).toBeNull();
    });

    it('should return null if scan not found', async () => {
      mockPrismaClient.scan.findUnique.mockResolvedValue(null);

      const result = await getScanById('non-existent');

      expect(result).toBeNull();
    });

    it('should return null for invalid ID', async () => {
      const result = await getScanById('');

      expect(result).toBeNull();
      expect(mockPrismaClient.scan.findUnique).not.toHaveBeenCalled();
    });

    it('should wrap database errors', async () => {
      mockPrismaClient.scan.findUnique.mockRejectedValue(
        new Error('Database error')
      );

      await expect(getScanById('scan-123')).rejects.toThrow(ScanRepositoryError);
      await expect(getScanById('scan-123')).rejects.toMatchObject({
        code: 'GET_FAILED',
      });
    });
  });

  describe('listScansBySession', () => {
    it('should list scans with default pagination', async () => {
      const mockScans = [
        createMockScan({ id: 'scan-1' }),
        createMockScan({ id: 'scan-2' }),
        createMockScan({ id: 'scan-3' }),
      ];

      mockPrismaClient.scan.findMany.mockResolvedValue(mockScans);
      mockPrismaClient.scan.count.mockResolvedValue(3);

      const result = await listScansBySession('session-123');

      expect(result).toEqual({
        items: mockScans,
        nextCursor: null,
        totalCount: 3,
      });

      expect(mockPrismaClient.scan.findMany).toHaveBeenCalledWith({
        where: { guestSessionId: 'session-123' },
        take: 21, // limit + 1
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should list scans with custom limit', async () => {
      const mockScans = [
        createMockScan({ id: 'scan-1' }),
        createMockScan({ id: 'scan-2' }),
      ];

      mockPrismaClient.scan.findMany.mockResolvedValue(mockScans);
      mockPrismaClient.scan.count.mockResolvedValue(2);

      const options: PaginationOptions = { limit: 10 };
      const result = await listScansBySession('session-123', options);

      expect(result.items).toEqual(mockScans);
      expect(result.nextCursor).toBeNull();

      expect(mockPrismaClient.scan.findMany).toHaveBeenCalledWith({
        where: { guestSessionId: 'session-123' },
        take: 11, // limit + 1
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should handle cursor-based pagination', async () => {
      const mockScans = [
        createMockScan({ id: 'scan-2' }),
        createMockScan({ id: 'scan-3' }),
      ];

      mockPrismaClient.scan.findMany.mockResolvedValue(mockScans);
      mockPrismaClient.scan.count.mockResolvedValue(10);

      const options: PaginationOptions = {
        limit: 5,
        cursor: 'scan-1',
      };
      const result = await listScansBySession('session-123', options);

      expect(result.items).toEqual(mockScans);

      expect(mockPrismaClient.scan.findMany).toHaveBeenCalledWith({
        where: { guestSessionId: 'session-123' },
        take: 6, // limit + 1
        cursor: { id: 'scan-1' },
        skip: 1,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should detect next page when more items exist', async () => {
      // Return limit + 1 items to indicate more pages
      const mockScans = [
        createMockScan({ id: 'scan-1' }),
        createMockScan({ id: 'scan-2' }),
        createMockScan({ id: 'scan-3' }),
        createMockScan({ id: 'scan-4' }),
        createMockScan({ id: 'scan-5' }),
        createMockScan({ id: 'scan-6' }), // Extra item
      ];

      mockPrismaClient.scan.findMany.mockResolvedValue(mockScans);
      mockPrismaClient.scan.count.mockResolvedValue(20);

      const options: PaginationOptions = { limit: 5 };
      const result = await listScansBySession('session-123', options);

      expect(result.items).toHaveLength(5);
      expect(result.nextCursor).toBe('scan-5');
      expect(result.totalCount).toBe(20);
    });

    it('should throw error for invalid session ID', async () => {
      await expect(listScansBySession('')).rejects.toThrow(ScanRepositoryError);
      await expect(listScansBySession('')).rejects.toMatchObject({
        code: 'INVALID_INPUT',
        message: 'Session ID is required and must be a string',
      });
    });

    it('should wrap database errors', async () => {
      mockPrismaClient.scan.findMany.mockRejectedValue(
        new Error('Database error')
      );

      await expect(listScansBySession('session-123')).rejects.toThrow(
        ScanRepositoryError
      );
      await expect(listScansBySession('session-123')).rejects.toMatchObject({
        code: 'LIST_FAILED',
      });
    });
  });

  describe('updateScanStatus', () => {
    it('should update scan to RUNNING status', async () => {
      const existingScan = createMockScan();
      const updatedScan = createMockScan({ status: 'RUNNING' });

      mockPrismaClient.scan.findUnique.mockResolvedValue(existingScan);
      mockPrismaClient.scan.update.mockResolvedValue(updatedScan);

      const result = await updateScanStatus('scan-123', 'RUNNING');

      expect(result).toEqual(updatedScan);
      expect(mockPrismaClient.scan.update).toHaveBeenCalledWith({
        where: { id: 'scan-123' },
        data: {
          status: 'RUNNING',
        },
      });
    });

    it('should update scan to COMPLETED status with timestamp', async () => {
      const existingScan = createMockScan({ status: 'RUNNING' });
      const completedAt = new Date('2024-01-01T00:10:00Z');
      const updatedScan = createMockScan({
        status: 'COMPLETED',
        completedAt,
      });

      mockPrismaClient.scan.findUnique.mockResolvedValue(existingScan);
      mockPrismaClient.scan.update.mockResolvedValue(updatedScan);

      const result = await updateScanStatus('scan-123', 'COMPLETED');

      expect(result).toEqual(updatedScan);
      expect(mockPrismaClient.scan.update).toHaveBeenCalledWith({
        where: { id: 'scan-123' },
        data: {
          status: 'COMPLETED',
          completedAt: expect.any(Date),
        },
      });
    });

    it('should update scan to FAILED status with error message', async () => {
      const existingScan = createMockScan({ status: 'RUNNING' });
      const updatedScan = createMockScan({
        status: 'FAILED',
        errorMessage: 'Connection timeout',
        completedAt: new Date('2024-01-01T00:10:00Z'),
      });

      mockPrismaClient.scan.findUnique.mockResolvedValue(existingScan);
      mockPrismaClient.scan.update.mockResolvedValue(updatedScan);

      const result = await updateScanStatus(
        'scan-123',
        'FAILED',
        'Connection timeout'
      );

      expect(result).toEqual(updatedScan);
      expect(mockPrismaClient.scan.update).toHaveBeenCalledWith({
        where: { id: 'scan-123' },
        data: {
          status: 'FAILED',
          errorMessage: 'Connection timeout',
          completedAt: expect.any(Date),
        },
      });
    });

    it('should throw error if scan not found', async () => {
      mockPrismaClient.scan.findUnique.mockResolvedValue(null);

      await expect(updateScanStatus('non-existent', 'RUNNING')).rejects.toThrow(
        ScanRepositoryError
      );
      await expect(updateScanStatus('non-existent', 'RUNNING')).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'Scan not found: non-existent',
      });
    });

    it('should throw error for invalid ID', async () => {
      await expect(updateScanStatus('', 'RUNNING')).rejects.toThrow(
        ScanRepositoryError
      );
      await expect(updateScanStatus('', 'RUNNING')).rejects.toMatchObject({
        code: 'INVALID_INPUT',
        message: 'Scan ID is required and must be a string',
      });
    });

    it('should throw error for missing status', async () => {
      // @ts-expect-error - Testing invalid input
      await expect(updateScanStatus('scan-123', null)).rejects.toThrow(
        ScanRepositoryError
      );
      // @ts-expect-error - Testing invalid input
      await expect(updateScanStatus('scan-123', null)).rejects.toMatchObject({
        code: 'INVALID_INPUT',
        message: 'Status is required',
      });
    });

    it('should wrap database errors', async () => {
      mockPrismaClient.scan.findUnique.mockResolvedValue(createMockScan());
      mockPrismaClient.scan.update.mockRejectedValue(
        new Error('Database error')
      );

      await expect(updateScanStatus('scan-123', 'RUNNING')).rejects.toThrow(
        ScanRepositoryError
      );
      await expect(updateScanStatus('scan-123', 'RUNNING')).rejects.toMatchObject({
        code: 'UPDATE_FAILED',
      });
    });
  });
});

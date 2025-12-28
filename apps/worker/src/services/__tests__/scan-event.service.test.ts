/**
 * Scan Event Service Tests
 *
 * Tests for worker-side scan event logging functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Prisma } from '@prisma/client';
import type { ScanEvent } from '@prisma/client';

// Mock Prisma client
const mockCreate = vi.fn();
const mockPrisma = {
  scanEvent: {
    create: mockCreate,
  },
};

// Mock Redis client
const mockRpush = vi.fn();
const mockExpire = vi.fn();
const mockRedis = {
  rpush: mockRpush,
  expire: mockExpire,
};

// Mock the config modules BEFORE importing the service
vi.mock('../../config/prisma.js', () => ({
  getPrismaClient: vi.fn(() => mockPrisma),
}));

vi.mock('../../config/redis.js', () => ({
  getRedisClient: vi.fn(() => mockRedis),
}));

// Import after mocks are set up
const { logEvent, scanEventService } = await import('../scan-event.service.js');

describe('ScanEventService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('logEvent', () => {
    it('should create event in database and cache in Redis', async () => {
      const mockEvent: ScanEvent = {
        id: 'event-123',
        scanId: 'scan-123',
        type: 'FETCH',
        level: 'INFO',
        message: 'Fetching page',
        metadata: { url: 'https://example.com' },
        adminOnly: false,
        createdAt: new Date('2024-01-01T00:00:00Z'),
      };

      mockCreate.mockResolvedValue(mockEvent);
      mockRpush.mockResolvedValue(1);
      mockExpire.mockResolvedValue(1);

      const result = await logEvent({
        scanId: 'scan-123',
        type: 'FETCH',
        level: 'INFO',
        message: 'Fetching page',
        metadata: { url: 'https://example.com' },
        adminOnly: false,
      });

      expect(result).toEqual(mockEvent);
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          scanId: 'scan-123',
          type: 'FETCH',
          level: 'INFO',
          message: 'Fetching page',
          metadata: { url: 'https://example.com' },
          adminOnly: false,
        },
      });
      expect(mockRpush).toHaveBeenCalledWith(
        'scan:scan-123:events',
        expect.stringContaining('"id":"event-123"')
      );
      expect(mockExpire).toHaveBeenCalledWith('scan:scan-123:events', 86400);
    });

    it('should use default level INFO if not provided', async () => {
      const mockEvent: ScanEvent = {
        id: 'event-123',
        scanId: 'scan-123',
        type: 'QUEUE',
        level: 'INFO',
        message: 'Job queued',
        metadata: null,
        adminOnly: false,
        createdAt: new Date(),
      };

      mockCreate.mockResolvedValue(mockEvent);
      mockRpush.mockResolvedValue(1);
      mockExpire.mockResolvedValue(1);

      await logEvent({
        scanId: 'scan-123',
        type: 'QUEUE',
        message: 'Job queued',
      });

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          scanId: 'scan-123',
          type: 'QUEUE',
          level: 'INFO',
          message: 'Job queued',
          metadata: Prisma.DbNull,
          adminOnly: false,
        },
      });
    });

    it('should continue if Redis caching fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const mockEvent: ScanEvent = {
        id: 'event-123',
        scanId: 'scan-123',
        type: 'ERROR',
        level: 'ERROR',
        message: 'Something went wrong',
        metadata: null,
        adminOnly: true,
        createdAt: new Date(),
      };

      mockCreate.mockResolvedValue(mockEvent);
      mockRpush.mockRejectedValue(new Error('Redis connection failed'));

      const result = await logEvent({
        scanId: 'scan-123',
        type: 'ERROR',
        level: 'ERROR',
        message: 'Something went wrong',
        adminOnly: true,
      });

      expect(result).toEqual(mockEvent);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '⚠️ ScanEventService: Failed to cache event:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should return null if database write fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockCreate.mockRejectedValue(new Error('Database connection failed'));

      const result = await logEvent({
        scanId: 'scan-123',
        type: 'INIT',
        message: 'Starting scan',
      });

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ ScanEventService: Failed to log event:',
        'Database connection failed'
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('scanEventService', () => {
    it('should export logEvent function', () => {
      expect(scanEventService.logEvent).toBe(logEvent);
    });
  });
});

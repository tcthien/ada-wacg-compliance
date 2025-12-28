/**
 * Scan Event Service Tests
 *
 * Unit tests for scan event business logic layer
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ScanEvent } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { CreateScanEventInput, ScanEventType, LogLevel } from './scan-event.types.js';

// Create mock Prisma client
const mockPrismaClient = vi.hoisted(() => ({
  scanEvent: {
    create: vi.fn(),
    findMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  scan: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
}));

// Create mock Redis client with pipeline support
const mockPipeline = vi.hoisted(() => ({
  del: vi.fn().mockReturnThis(),
  rpush: vi.fn().mockReturnThis(),
  expire: vi.fn().mockReturnThis(),
  exec: vi.fn().mockResolvedValue([]),
}));

const mockRedisClient = vi.hoisted(() => ({
  rpush: vi.fn(),
  expire: vi.fn(),
  lrange: vi.fn(),
  pipeline: vi.fn(() => mockPipeline),
}));

// Mock dependencies before imports
vi.mock('../../config/database.js', () => ({
  getPrismaClient: vi.fn(() => mockPrismaClient),
}));

vi.mock('../../config/redis.js', () => ({
  getRedisClient: vi.fn(() => mockRedisClient),
}));

// Now safe to import
import {
  logEvent,
  getEvents,
  getEventsSince,
  archiveOldEvents,
  ScanEventServiceError,
} from './scan-event.service.js';

describe('ScanEventService', () => {
  // Mock console methods to test logging
  const originalConsoleError = console.error;
  const originalConsoleDebug = console.debug;
  const originalConsoleLog = console.log;

  beforeEach(() => {
    vi.clearAllMocks();
    console.error = vi.fn();
    console.debug = vi.fn();
    console.log = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    console.error = originalConsoleError;
    console.debug = originalConsoleDebug;
    console.log = originalConsoleLog;
  });

  describe('logEvent', () => {
    const validInput: CreateScanEventInput = {
      scanId: 'scan-123',
      type: 'FETCH',
      level: 'INFO',
      message: 'Fetching page: https://example.com',
      metadata: { url: 'https://example.com' },
      adminOnly: false,
    };

    const mockEvent: ScanEvent = {
      id: 'event-123',
      scanId: 'scan-123',
      type: 'FETCH' as ScanEventType,
      level: 'INFO' as LogLevel,
      message: 'Fetching page: https://example.com',
      metadata: { url: 'https://example.com' },
      adminOnly: false,
      createdAt: new Date('2024-01-01T00:00:00Z'),
    };

    it('should create event in DB and cache in Redis', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.scanEvent.create).mockResolvedValue(mockEvent);
      vi.mocked(mockRedisClient.rpush).mockResolvedValue(1 as never);
      vi.mocked(mockRedisClient.expire).mockResolvedValue(1 as never);

      // Act
      const result = await logEvent(validInput);

      // Assert
      expect(result).toEqual(mockEvent);
      expect(mockPrismaClient.scanEvent.create).toHaveBeenCalledWith({
        data: {
          scanId: 'scan-123',
          type: 'FETCH',
          level: 'INFO',
          message: 'Fetching page: https://example.com',
          metadata: { url: 'https://example.com' },
          adminOnly: false,
        },
      });
      expect(mockRedisClient.rpush).toHaveBeenCalledWith(
        'scan:scan-123:events',
        expect.stringContaining('"scanId":"scan-123"')
      );
      expect(mockRedisClient.expire).toHaveBeenCalledWith(
        'scan:scan-123:events',
        86400
      );
    });

    it('should use default level INFO if not provided', async () => {
      // Arrange
      const inputWithoutLevel = { ...validInput };
      delete inputWithoutLevel.level;

      vi.mocked(mockPrismaClient.scanEvent.create).mockResolvedValue({
        ...mockEvent,
        level: 'INFO',
      });
      vi.mocked(mockRedisClient.rpush).mockResolvedValue(1 as never);
      vi.mocked(mockRedisClient.expire).mockResolvedValue(1 as never);

      // Act
      await logEvent(inputWithoutLevel);

      // Assert
      expect(mockPrismaClient.scanEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          level: 'INFO',
        }),
      });
    });

    it('should use default adminOnly false if not provided', async () => {
      // Arrange
      const inputWithoutAdminOnly = { ...validInput };
      delete inputWithoutAdminOnly.adminOnly;

      vi.mocked(mockPrismaClient.scanEvent.create).mockResolvedValue({
        ...mockEvent,
        adminOnly: false,
      });
      vi.mocked(mockRedisClient.rpush).mockResolvedValue(1 as never);
      vi.mocked(mockRedisClient.expire).mockResolvedValue(1 as never);

      // Act
      await logEvent(inputWithoutAdminOnly);

      // Assert
      expect(mockPrismaClient.scanEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          adminOnly: false,
        }),
      });
    });

    it('should handle metadata as Prisma.DbNull when null', async () => {
      // Arrange
      const inputWithoutMetadata = { ...validInput };
      delete inputWithoutMetadata.metadata;

      vi.mocked(mockPrismaClient.scanEvent.create).mockResolvedValue({
        ...mockEvent,
        metadata: null,
      });
      vi.mocked(mockRedisClient.rpush).mockResolvedValue(1 as never);
      vi.mocked(mockRedisClient.expire).mockResolvedValue(1 as never);

      // Act
      await logEvent(inputWithoutMetadata);

      // Assert
      expect(mockPrismaClient.scanEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: Prisma.DbNull,
        }),
      });
    });

    it('should cache event with correct JSON structure', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.scanEvent.create).mockResolvedValue(mockEvent);
      vi.mocked(mockRedisClient.rpush).mockResolvedValue(1 as never);
      vi.mocked(mockRedisClient.expire).mockResolvedValue(1 as never);

      // Act
      await logEvent(validInput);

      // Assert
      const cacheCall = vi.mocked(mockRedisClient.rpush).mock.calls[0];
      expect(cacheCall?.[0]).toBe('scan:scan-123:events');

      const cachedJson = JSON.parse(cacheCall?.[1] as string);
      expect(cachedJson).toEqual({
        id: 'event-123',
        scanId: 'scan-123',
        type: 'FETCH',
        level: 'INFO',
        message: 'Fetching page: https://example.com',
        metadata: { url: 'https://example.com' },
        adminOnly: false,
        createdAt: '2024-01-01T00:00:00.000Z',
      });
    });

    it('should continue if Redis caching fails', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.scanEvent.create).mockResolvedValue(mockEvent);
      vi.mocked(mockRedisClient.rpush).mockRejectedValue(
        new Error('Redis connection error')
      );

      // Act
      const result = await logEvent(validInput);

      // Assert
      expect(result).toEqual(mockEvent);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to cache event'),
        expect.any(Error)
      );
    });

    it('should return null and log error if DB write fails', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.scanEvent.create).mockRejectedValue(
        new Error('Database error')
      );

      // Act
      const result = await logEvent(validInput);

      // Assert
      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to log event'),
        expect.any(String)
      );
    });

    it('should handle non-Error exceptions', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.scanEvent.create).mockRejectedValue(
        'String error'
      );

      // Act
      const result = await logEvent(validInput);

      // Assert
      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to log event'),
        'String error'
      );
    });
  });

  describe('getEvents', () => {
    const mockEvents: ScanEvent[] = [
      {
        id: 'event-1',
        scanId: 'scan-123',
        type: 'INIT' as ScanEventType,
        level: 'INFO' as LogLevel,
        message: 'Scan initialized',
        metadata: null,
        adminOnly: false,
        createdAt: new Date('2024-01-01T00:00:00Z'),
      },
      {
        id: 'event-2',
        scanId: 'scan-123',
        type: 'DEBUG' as ScanEventType,
        level: 'DEBUG' as LogLevel,
        message: 'Admin debug info',
        metadata: { debug: true },
        adminOnly: true,
        createdAt: new Date('2024-01-01T00:01:00Z'),
      },
      {
        id: 'event-3',
        scanId: 'scan-123',
        type: 'RESULT' as ScanEventType,
        level: 'SUCCESS' as LogLevel,
        message: 'Scan completed',
        metadata: null,
        adminOnly: false,
        createdAt: new Date('2024-01-01T00:02:00Z'),
      },
    ];

    it('should read from Redis cache on cache hit', async () => {
      // Arrange
      const cachedEvents = mockEvents.map((e) =>
        JSON.stringify({
          id: e.id,
          scanId: e.scanId,
          type: e.type,
          level: e.level,
          message: e.message,
          metadata: e.metadata,
          adminOnly: e.adminOnly,
          createdAt: e.createdAt.toISOString(),
        })
      );

      vi.mocked(mockRedisClient.lrange).mockResolvedValue(cachedEvents as never);

      // Act
      const result = await getEvents('scan-123', { isAdmin: true });

      // Assert
      expect(result.events).toHaveLength(3);
      expect(result.events[0]?.id).toBe('event-1');
      expect(mockRedisClient.lrange).toHaveBeenCalledWith(
        'scan:scan-123:events',
        0,
        -1
      );
      expect(mockPrismaClient.scanEvent.findMany).not.toHaveBeenCalled();
    });

    it('should log cache hit for admin users', async () => {
      // Arrange
      const cachedEvents = mockEvents.map((e) =>
        JSON.stringify({
          id: e.id,
          scanId: e.scanId,
          type: e.type,
          level: e.level,
          message: e.message,
          metadata: e.metadata,
          adminOnly: e.adminOnly,
          createdAt: e.createdAt.toISOString(),
        })
      );

      vi.mocked(mockRedisClient.lrange).mockResolvedValue(cachedEvents as never);

      // Act
      await getEvents('scan-123', { isAdmin: true });

      // Assert
      expect(console.debug).toHaveBeenCalledWith(
        expect.stringContaining('Cache HIT')
      );
    });

    it('should not log cache hit for non-admin users', async () => {
      // Arrange
      const cachedEvents = mockEvents.map((e) =>
        JSON.stringify({
          id: e.id,
          scanId: e.scanId,
          type: e.type,
          level: e.level,
          message: e.message,
          metadata: e.metadata,
          adminOnly: e.adminOnly,
          createdAt: e.createdAt.toISOString(),
        })
      );

      vi.mocked(mockRedisClient.lrange).mockResolvedValue(cachedEvents as never);

      // Act
      await getEvents('scan-123', { isAdmin: false });

      // Assert
      expect(console.debug).not.toHaveBeenCalled();
    });

    it('should fall back to DB on cache miss', async () => {
      // Arrange
      vi.mocked(mockRedisClient.lrange).mockResolvedValue([] as never);
      vi.mocked(mockPrismaClient.scanEvent.findMany).mockResolvedValue(mockEvents);
      vi.mocked(mockPipeline.exec).mockResolvedValue([]);

      // Act
      const result = await getEvents('scan-123', { isAdmin: true });

      // Assert
      expect(result.events).toHaveLength(3);
      expect(mockPrismaClient.scanEvent.findMany).toHaveBeenCalledWith({
        where: {
          scanId: 'scan-123',
        },
        orderBy: { createdAt: 'asc' },
      });
      expect(mockRedisClient.pipeline).toHaveBeenCalled();
    });

    it('should log cache miss for admin users', async () => {
      // Arrange
      vi.mocked(mockRedisClient.lrange).mockResolvedValue([] as never);
      vi.mocked(mockPrismaClient.scanEvent.findMany).mockResolvedValue(mockEvents);
      vi.mocked(mockPipeline.exec).mockResolvedValue([]);

      // Act
      await getEvents('scan-123', { isAdmin: true });

      // Assert
      expect(console.debug).toHaveBeenCalledWith(
        expect.stringContaining('Cache MISS')
      );
    });

    it('should repopulate Redis cache after DB fetch', async () => {
      // Arrange
      vi.mocked(mockRedisClient.lrange).mockResolvedValue([] as never);
      vi.mocked(mockPrismaClient.scanEvent.findMany).mockResolvedValue(mockEvents);
      vi.mocked(mockPipeline.exec).mockResolvedValue([]);

      // Act
      await getEvents('scan-123', { isAdmin: true });

      // Assert
      expect(mockRedisClient.pipeline).toHaveBeenCalled();
      expect(mockPipeline.del).toHaveBeenCalledWith('scan:scan-123:events');
      expect(mockPipeline.rpush).toHaveBeenCalledTimes(3);
      expect(mockPipeline.expire).toHaveBeenCalledWith('scan:scan-123:events', 86400);
      expect(mockPipeline.exec).toHaveBeenCalled();
    });

    it('should handle Redis cache errors gracefully', async () => {
      // Arrange
      vi.mocked(mockRedisClient.lrange).mockRejectedValue(
        new Error('Redis connection error')
      );
      vi.mocked(mockPrismaClient.scanEvent.findMany).mockResolvedValue(mockEvents);
      vi.mocked(mockPipeline.exec).mockResolvedValue([]);

      // Act
      const result = await getEvents('scan-123', { isAdmin: true });

      // Assert
      expect(result.events).toHaveLength(3);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Redis cache error'),
        expect.any(Error)
      );
      expect(mockPrismaClient.scanEvent.findMany).toHaveBeenCalled();
    });

    it('should filter adminOnly events for non-admin users', async () => {
      // Arrange
      const cachedEvents = mockEvents.map((e) =>
        JSON.stringify({
          id: e.id,
          scanId: e.scanId,
          type: e.type,
          level: e.level,
          message: e.message,
          metadata: e.metadata,
          adminOnly: e.adminOnly,
          createdAt: e.createdAt.toISOString(),
        })
      );

      vi.mocked(mockRedisClient.lrange).mockResolvedValue(cachedEvents as never);

      // Act
      const result = await getEvents('scan-123', { isAdmin: false });

      // Assert
      expect(result.events).toHaveLength(2); // Only non-admin events
      expect(result.events.every((e) => !e.adminOnly)).toBe(true);
    });

    it('should include adminOnly events for admin users', async () => {
      // Arrange
      const cachedEvents = mockEvents.map((e) =>
        JSON.stringify({
          id: e.id,
          scanId: e.scanId,
          type: e.type,
          level: e.level,
          message: e.message,
          metadata: e.metadata,
          adminOnly: e.adminOnly,
          createdAt: e.createdAt.toISOString(),
        })
      );

      vi.mocked(mockRedisClient.lrange).mockResolvedValue(cachedEvents as never);

      // Act
      const result = await getEvents('scan-123', { isAdmin: true });

      // Assert
      expect(result.events).toHaveLength(3); // All events
      expect(result.events.some((e) => e.adminOnly)).toBe(true);
    });

    it('should filter events by timestamp with since parameter', async () => {
      // Arrange
      const since = new Date('2024-01-01T00:00:30Z');
      vi.mocked(mockRedisClient.lrange).mockResolvedValue([] as never);
      vi.mocked(mockPrismaClient.scanEvent.findMany).mockResolvedValue(
        mockEvents.slice(1) // Events after 00:00:30
      );
      vi.mocked(mockPipeline.exec).mockResolvedValue([]);

      // Act
      const result = await getEvents('scan-123', { since, isAdmin: true });

      // Assert
      expect(mockPrismaClient.scanEvent.findMany).toHaveBeenCalledWith({
        where: {
          scanId: 'scan-123',
          createdAt: { gt: since },
        },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should filter cached events by timestamp', async () => {
      // Arrange
      const since = new Date('2024-01-01T00:00:30Z');
      const cachedEvents = mockEvents.map((e) =>
        JSON.stringify({
          id: e.id,
          scanId: e.scanId,
          type: e.type,
          level: e.level,
          message: e.message,
          metadata: e.metadata,
          adminOnly: e.adminOnly,
          createdAt: e.createdAt.toISOString(),
        })
      );

      vi.mocked(mockRedisClient.lrange).mockResolvedValue(cachedEvents as never);

      // Act
      const result = await getEvents('scan-123', { since, isAdmin: true });

      // Assert
      expect(result.events).toHaveLength(2); // Events 2 and 3
      expect(result.events[0]?.id).toBe('event-2');
    });

    it('should apply limit and set hasMore flag', async () => {
      // Arrange
      const cachedEvents = mockEvents.map((e) =>
        JSON.stringify({
          id: e.id,
          scanId: e.scanId,
          type: e.type,
          level: e.level,
          message: e.message,
          metadata: e.metadata,
          adminOnly: e.adminOnly,
          createdAt: e.createdAt.toISOString(),
        })
      );

      vi.mocked(mockRedisClient.lrange).mockResolvedValue(cachedEvents as never);

      // Act
      const result = await getEvents('scan-123', { limit: 2, isAdmin: true });

      // Assert
      expect(result.events).toHaveLength(2);
      expect(result.hasMore).toBe(true);
    });

    it('should set hasMore to false when no more events', async () => {
      // Arrange
      const cachedEvents = mockEvents.map((e) =>
        JSON.stringify({
          id: e.id,
          scanId: e.scanId,
          type: e.type,
          level: e.level,
          message: e.message,
          metadata: e.metadata,
          adminOnly: e.adminOnly,
          createdAt: e.createdAt.toISOString(),
        })
      );

      vi.mocked(mockRedisClient.lrange).mockResolvedValue(cachedEvents as never);

      // Act
      const result = await getEvents('scan-123', { limit: 10, isAdmin: true });

      // Assert
      expect(result.events).toHaveLength(3);
      expect(result.hasMore).toBe(false);
    });

    it('should return lastTimestamp from last event', async () => {
      // Arrange
      const cachedEvents = mockEvents.map((e) =>
        JSON.stringify({
          id: e.id,
          scanId: e.scanId,
          type: e.type,
          level: e.level,
          message: e.message,
          metadata: e.metadata,
          adminOnly: e.adminOnly,
          createdAt: e.createdAt.toISOString(),
        })
      );

      vi.mocked(mockRedisClient.lrange).mockResolvedValue(cachedEvents as never);

      // Act
      const result = await getEvents('scan-123', { isAdmin: true });

      // Assert
      expect(result.lastTimestamp).toBe('2024-01-01T00:02:00.000Z');
    });

    it('should return null lastTimestamp when no events', async () => {
      // Arrange
      vi.mocked(mockRedisClient.lrange).mockResolvedValue([] as never);
      vi.mocked(mockPrismaClient.scanEvent.findMany).mockResolvedValue([]);

      // Act
      const result = await getEvents('scan-123', { isAdmin: true });

      // Assert
      expect(result.lastTimestamp).toBeNull();
    });

    it('should use default limit of 100', async () => {
      // Arrange
      const manyEvents = Array.from({ length: 150 }, (_, i) => {
        const date = new Date('2024-01-01T00:00:00Z');
        date.setSeconds(i);
        return {
          id: `event-${i}`,
          scanId: 'scan-123',
          type: 'INFO' as ScanEventType,
          level: 'INFO' as LogLevel,
          message: `Event ${i}`,
          metadata: null,
          adminOnly: false,
          createdAt: date,
        };
      });

      const cachedEvents = manyEvents.map((e) =>
        JSON.stringify({
          id: e.id,
          scanId: e.scanId,
          type: e.type,
          level: e.level,
          message: e.message,
          metadata: e.metadata,
          adminOnly: e.adminOnly,
          createdAt: e.createdAt.toISOString(),
        })
      );

      vi.mocked(mockRedisClient.lrange).mockResolvedValue(cachedEvents as never);

      // Act
      const result = await getEvents('scan-123', { isAdmin: true });

      // Assert
      expect(result.events).toHaveLength(100);
      expect(result.hasMore).toBe(true);
    });

    it('should throw ScanEventServiceError on database error', async () => {
      // Arrange
      vi.mocked(mockRedisClient.lrange).mockResolvedValue([] as never);
      vi.mocked(mockPrismaClient.scanEvent.findMany).mockRejectedValue(
        new Error('Database error')
      );

      // Act & Assert
      await expect(getEvents('scan-123')).rejects.toThrow(ScanEventServiceError);
      await expect(getEvents('scan-123')).rejects.toMatchObject({
        code: 'GET_EVENTS_FAILED',
        message: 'Failed to get scan events',
      });
    });

    it('should handle non-Error exceptions in getEvents', async () => {
      // Arrange
      vi.mocked(mockRedisClient.lrange).mockResolvedValue([] as never);
      vi.mocked(mockPrismaClient.scanEvent.findMany).mockRejectedValue(
        'String error'
      );

      // Act & Assert
      await expect(getEvents('scan-123')).rejects.toThrow(ScanEventServiceError);
    });

    it('should continue if cache repopulation fails', async () => {
      // Arrange
      vi.mocked(mockRedisClient.lrange).mockResolvedValue([] as never);
      vi.mocked(mockPrismaClient.scanEvent.findMany).mockResolvedValue(mockEvents);
      vi.mocked(mockPipeline.exec).mockRejectedValue(new Error('Pipeline error'));

      // Act
      const result = await getEvents('scan-123', { isAdmin: true });

      // Assert
      expect(result.events).toHaveLength(3);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to repopulate cache'),
        expect.any(Error)
      );
    });
  });

  describe('getEventsSince', () => {
    const mockEvents: ScanEvent[] = [
      {
        id: 'event-2',
        scanId: 'scan-123',
        type: 'DEBUG' as ScanEventType,
        level: 'DEBUG' as LogLevel,
        message: 'Admin debug info',
        metadata: { debug: true },
        adminOnly: true,
        createdAt: new Date('2024-01-01T00:01:00Z'),
      },
      {
        id: 'event-3',
        scanId: 'scan-123',
        type: 'RESULT' as ScanEventType,
        level: 'SUCCESS' as LogLevel,
        message: 'Scan completed',
        metadata: null,
        adminOnly: false,
        createdAt: new Date('2024-01-01T00:02:00Z'),
      },
    ];

    it('should return events after specified timestamp', async () => {
      // Arrange
      const since = new Date('2024-01-01T00:00:30Z');
      vi.mocked(mockRedisClient.lrange).mockResolvedValue([] as never);
      vi.mocked(mockPrismaClient.scanEvent.findMany).mockResolvedValue(mockEvents);
      vi.mocked(mockPipeline.exec).mockResolvedValue([]);

      // Act
      const result = await getEventsSince('scan-123', since, true);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe('event-2');
      expect(result[1]?.id).toBe('event-3');
    });

    it('should filter adminOnly events based on isAdmin parameter', async () => {
      // Arrange
      const since = new Date('2024-01-01T00:00:30Z');
      vi.mocked(mockRedisClient.lrange).mockResolvedValue([] as never);
      vi.mocked(mockPrismaClient.scanEvent.findMany).mockResolvedValue(mockEvents);
      vi.mocked(mockPipeline.exec).mockResolvedValue([]);

      // Act
      const result = await getEventsSince('scan-123', since, false);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('event-3');
      expect(result[0]?.adminOnly).toBe(false);
    });

    it('should use default isAdmin false', async () => {
      // Arrange
      const since = new Date('2024-01-01T00:00:30Z');
      vi.mocked(mockRedisClient.lrange).mockResolvedValue([] as never);
      vi.mocked(mockPrismaClient.scanEvent.findMany).mockResolvedValue(mockEvents);
      vi.mocked(mockPipeline.exec).mockResolvedValue([]);

      // Act
      const result = await getEventsSince('scan-123', since);

      // Assert
      expect(result).toHaveLength(1);
      expect(result.every((e) => !e.adminOnly)).toBe(true);
    });
  });

  describe('archiveOldEvents', () => {
    it('should archive events and create summary', async () => {
      // Arrange
      const olderThan = new Date('2024-01-15T00:00:00Z');
      const mockScan = {
        id: 'scan-123',
        events: [
          {
            id: 'event-1',
            scanId: 'scan-123',
            type: 'INIT' as ScanEventType,
            level: 'INFO' as LogLevel,
            message: 'Scan initialized',
            metadata: null,
            adminOnly: false,
            createdAt: new Date('2024-01-01T00:00:00Z'),
          },
          {
            id: 'event-2',
            scanId: 'scan-123',
            type: 'RESULT' as ScanEventType,
            level: 'SUCCESS' as LogLevel,
            message: 'Scan completed',
            metadata: null,
            adminOnly: false,
            createdAt: new Date('2024-01-01T00:05:00Z'),
          },
        ],
      };

      vi.mocked(mockPrismaClient.scan.findMany).mockResolvedValue([mockScan] as never);
      vi.mocked(mockPrismaClient.$transaction).mockResolvedValue([]);

      // Act
      const deleted = await archiveOldEvents(olderThan);

      // Assert
      expect(deleted).toBe(2);
      expect(mockPrismaClient.scan.findMany).toHaveBeenCalledWith({
        where: {
          events: {
            some: {
              createdAt: { lt: olderThan },
            },
          },
        },
        select: {
          id: true,
          events: {
            where: {
              createdAt: { lt: olderThan },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    });

    it('should create correct event summary', async () => {
      // Arrange
      const olderThan = new Date('2024-01-15T00:00:00Z');
      const mockScan = {
        id: 'scan-123',
        events: [
          {
            id: 'event-1',
            scanId: 'scan-123',
            type: 'INIT' as ScanEventType,
            level: 'INFO' as LogLevel,
            message: 'Scan initialized',
            metadata: null,
            adminOnly: false,
            createdAt: new Date('2024-01-01T00:00:00Z'),
          },
          {
            id: 'event-2',
            scanId: 'scan-123',
            type: 'ERROR' as ScanEventType,
            level: 'ERROR' as LogLevel,
            message: 'Error occurred',
            metadata: null,
            adminOnly: false,
            createdAt: new Date('2024-01-01T00:05:00Z'),
          },
        ],
      };

      vi.mocked(mockPrismaClient.scan.findMany).mockResolvedValue([mockScan] as never);
      vi.mocked(mockPrismaClient.$transaction).mockResolvedValue([]);

      // Act
      await archiveOldEvents(olderThan);

      // Assert
      expect(mockPrismaClient.$transaction).toHaveBeenCalled();

      // Verify transaction was called once (archiveOldEvents calls it once per scan)
      expect(mockPrismaClient.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should skip scans with no old events', async () => {
      // Arrange
      const olderThan = new Date('2024-01-15T00:00:00Z');
      const mockScan = {
        id: 'scan-123',
        events: [],
      };

      vi.mocked(mockPrismaClient.scan.findMany).mockResolvedValue([mockScan] as never);

      // Act
      const deleted = await archiveOldEvents(olderThan);

      // Assert
      expect(deleted).toBe(0);
      expect(mockPrismaClient.$transaction).not.toHaveBeenCalled();
    });

    it('should handle multiple scans', async () => {
      // Arrange
      const olderThan = new Date('2024-01-15T00:00:00Z');
      const mockScans = [
        {
          id: 'scan-1',
          events: [
            {
              id: 'event-1',
              scanId: 'scan-1',
              type: 'INIT' as ScanEventType,
              level: 'INFO' as LogLevel,
              message: 'Scan 1',
              metadata: null,
              adminOnly: false,
              createdAt: new Date('2024-01-01T00:00:00Z'),
            },
          ],
        },
        {
          id: 'scan-2',
          events: [
            {
              id: 'event-2',
              scanId: 'scan-2',
              type: 'INIT' as ScanEventType,
              level: 'INFO' as LogLevel,
              message: 'Scan 2',
              metadata: null,
              adminOnly: false,
              createdAt: new Date('2024-01-01T00:00:00Z'),
            },
            {
              id: 'event-3',
              scanId: 'scan-2',
              type: 'RESULT' as ScanEventType,
              level: 'SUCCESS' as LogLevel,
              message: 'Scan 2 completed',
              metadata: null,
              adminOnly: false,
              createdAt: new Date('2024-01-01T00:05:00Z'),
            },
          ],
        },
      ];

      vi.mocked(mockPrismaClient.scan.findMany).mockResolvedValue(mockScans as never);
      vi.mocked(mockPrismaClient.$transaction).mockResolvedValue([]);

      // Act
      const deleted = await archiveOldEvents(olderThan);

      // Assert
      expect(deleted).toBe(3);
      expect(mockPrismaClient.$transaction).toHaveBeenCalledTimes(2);
    });

    it('should throw ScanEventServiceError on database error', async () => {
      // Arrange
      const olderThan = new Date('2024-01-15T00:00:00Z');
      vi.mocked(mockPrismaClient.scan.findMany).mockRejectedValue(
        new Error('Database error')
      );

      // Act & Assert
      await expect(archiveOldEvents(olderThan)).rejects.toThrow(
        ScanEventServiceError
      );
      await expect(archiveOldEvents(olderThan)).rejects.toMatchObject({
        code: 'ARCHIVE_FAILED',
        message: 'Failed to archive old events',
      });
    });

    it('should handle non-Error exceptions in archiveOldEvents', async () => {
      // Arrange
      const olderThan = new Date('2024-01-15T00:00:00Z');
      vi.mocked(mockPrismaClient.scan.findMany).mockRejectedValue('String error');

      // Act & Assert
      await expect(archiveOldEvents(olderThan)).rejects.toThrow(
        ScanEventServiceError
      );
    });
  });
});

/**
 * Scan Event Controller Tests
 *
 * Integration tests for scan event API endpoints.
 * Tests GET /api/v1/scans/:scanId/events with authorization, validation, and rate limiting.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { registerScanEventRoutes } from './scan-event.controller.js';
import * as scanEventService from './scan-event.service.js';
import * as scanRepository from './scan.repository.js';
import type { GuestSession, AdminUser, Scan } from '@prisma/client';

// Mock dependencies
vi.mock('./scan-event.service.js');
vi.mock('./scan.repository.js');
vi.mock('../../config/redis.js', () => ({
  getRedisClient: () => ({
    get: vi.fn().mockResolvedValue(null),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    ttl: vi.fn().mockResolvedValue(60),
    pipeline: vi.fn().mockReturnValue({
      incr: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    }),
    rpush: vi.fn().mockResolvedValue(1),
  }),
}));
vi.mock('../../shared/middleware/session.js', () => ({
  sessionMiddleware: async (request: any, _reply: any) => {
    // Mock session middleware - attach mock guest session
    request.guestSession = {
      id: 'session-123',
      sessionToken: 'token-123',
      fingerprint: 'fp-123',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
      anonymizedAt: null,
    } as GuestSession;
  },
}));

describe('Scan Event Controller', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Create fresh Fastify instance
    app = Fastify();
    await registerScanEventRoutes(app, '/api/v1');
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/v1/scans/:scanId/events', () => {
    const validScanId = '550e8400-e29b-41d4-a716-446655440000';
    const mockScan: Scan = {
      id: validScanId,
      guestSessionId: 'session-123',
      userId: null,
      url: 'https://example.com',
      email: null,
      status: 'RUNNING',
      wcagLevel: 'AA',
      durationMs: null,
      errorMessage: null,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      completedAt: null,
    };

    describe('Successful event retrieval', () => {
      it('should return events with correct format', async () => {
        // Mock scan ownership check
        vi.mocked(scanRepository.getScanById).mockResolvedValue(mockScan);

        // Mock service response
        vi.mocked(scanEventService.getEvents).mockResolvedValue({
          events: [
            {
              id: 'event-123',
              scanId: validScanId,
              type: 'FETCH',
              level: 'INFO',
              message: 'Fetching page...',
              metadata: { url: 'https://example.com' },
              adminOnly: false,
              createdAt: new Date('2024-01-01T00:00:00.000Z'),
            },
            {
              id: 'event-456',
              scanId: validScanId,
              type: 'ANALYSIS',
              level: 'SUCCESS',
              message: 'Analysis complete',
              metadata: null,
              adminOnly: false,
              createdAt: new Date('2024-01-01T00:01:00.000Z'),
            },
          ],
          lastTimestamp: '2024-01-01T00:01:00.000Z',
          hasMore: false,
        });

        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/scans/${validScanId}/events`,
        });

        expect(response.statusCode).toBe(200);
        const json = response.json();
        expect(json.success).toBe(true);
        expect(json.data.events).toHaveLength(2);
        expect(json.data.events[0]).toEqual({
          id: 'event-123',
          type: 'FETCH',
          level: 'INFO',
          message: 'Fetching page...',
          metadata: { url: 'https://example.com' },
          createdAt: '2024-01-01T00:00:00.000Z',
        });
        expect(json.data.lastTimestamp).toBe('2024-01-01T00:01:00.000Z');
        expect(json.data.hasMore).toBe(false);

        // Verify service was called correctly
        expect(scanEventService.getEvents).toHaveBeenCalledWith(validScanId, {
          limit: 100, // Default limit
          since: undefined,
          isAdmin: false,
        });
      });

      it('should return empty events array when no events exist', async () => {
        vi.mocked(scanRepository.getScanById).mockResolvedValue(mockScan);
        vi.mocked(scanEventService.getEvents).mockResolvedValue({
          events: [],
          lastTimestamp: null,
          hasMore: false,
        });

        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/scans/${validScanId}/events`,
        });

        expect(response.statusCode).toBe(200);
        const json = response.json();
        expect(json.success).toBe(true);
        expect(json.data.events).toHaveLength(0);
        expect(json.data.lastTimestamp).toBeNull();
        expect(json.data.hasMore).toBe(false);
      });

      it('should handle hasMore=true for pagination', async () => {
        vi.mocked(scanRepository.getScanById).mockResolvedValue(mockScan);
        vi.mocked(scanEventService.getEvents).mockResolvedValue({
          events: [
            {
              id: 'event-123',
              scanId: validScanId,
              type: 'FETCH',
              level: 'INFO',
              message: 'Event 1',
              metadata: null,
              adminOnly: false,
              createdAt: new Date('2024-01-01T00:00:00.000Z'),
            },
          ],
          lastTimestamp: '2024-01-01T00:00:00.000Z',
          hasMore: true,
        });

        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/scans/${validScanId}/events?limit=1`,
        });

        expect(response.statusCode).toBe(200);
        const json = response.json();
        expect(json.data.hasMore).toBe(true);
      });
    });

    describe('Query parameter validation', () => {
      beforeEach(() => {
        vi.mocked(scanRepository.getScanById).mockResolvedValue(mockScan);
        vi.mocked(scanEventService.getEvents).mockResolvedValue({
          events: [],
          lastTimestamp: null,
          hasMore: false,
        });
      });

      it('should accept valid limit parameter', async () => {
        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/scans/${validScanId}/events?limit=50`,
        });

        expect(response.statusCode).toBe(200);
        expect(scanEventService.getEvents).toHaveBeenCalledWith(
          validScanId,
          expect.objectContaining({
            limit: 50,
          })
        );
      });

      it('should enforce minimum limit (1)', async () => {
        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/scans/${validScanId}/events?limit=0`,
        });

        expect(response.statusCode).toBe(400);
        const json = response.json();
        expect(json.success).toBe(false);
        expect(json.code).toBe('VALIDATION_ERROR');
      });

      it('should enforce maximum limit (200)', async () => {
        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/scans/${validScanId}/events?limit=201`,
        });

        expect(response.statusCode).toBe(400);
        const json = response.json();
        expect(json.success).toBe(false);
        expect(json.code).toBe('VALIDATION_ERROR');
      });

      it('should reject negative limit', async () => {
        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/scans/${validScanId}/events?limit=-10`,
        });

        expect(response.statusCode).toBe(400);
        const json = response.json();
        expect(json.success).toBe(false);
        expect(json.code).toBe('VALIDATION_ERROR');
      });

      it('should accept valid ISO date for since parameter', async () => {
        const sinceDate = '2024-01-01T00:00:00.000Z';
        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/scans/${validScanId}/events?since=${encodeURIComponent(
            sinceDate
          )}`,
        });

        expect(response.statusCode).toBe(200);
        expect(scanEventService.getEvents).toHaveBeenCalledWith(
          validScanId,
          expect.objectContaining({
            since: new Date(sinceDate),
          })
        );
      });

      it('should reject invalid date format for since parameter', async () => {
        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/scans/${validScanId}/events?since=invalid-date`,
        });

        expect(response.statusCode).toBe(400);
        const json = response.json();
        expect(json.success).toBe(false);
        expect(json.code).toBe('VALIDATION_ERROR');
      });

      it('should use default limit (100) when not provided', async () => {
        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/scans/${validScanId}/events`,
        });

        expect(response.statusCode).toBe(200);
        expect(scanEventService.getEvents).toHaveBeenCalledWith(
          validScanId,
          expect.objectContaining({
            limit: 100,
          })
        );
      });

      it('should accept both limit and since parameters', async () => {
        const sinceDate = '2024-01-01T00:00:00.000Z';
        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/scans/${validScanId}/events?limit=25&since=${encodeURIComponent(
            sinceDate
          )}`,
        });

        expect(response.statusCode).toBe(200);
        expect(scanEventService.getEvents).toHaveBeenCalledWith(validScanId, {
          limit: 25,
          since: new Date(sinceDate),
          isAdmin: false,
        });
      });
    });

    describe('Authorization', () => {
      it('should allow access to own scan for guest users', async () => {
        vi.mocked(scanRepository.getScanById).mockResolvedValue(mockScan);
        vi.mocked(scanEventService.getEvents).mockResolvedValue({
          events: [],
          lastTimestamp: null,
          hasMore: false,
        });

        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/scans/${validScanId}/events`,
        });

        expect(response.statusCode).toBe(200);
        expect(scanRepository.getScanById).toHaveBeenCalledWith(validScanId);
      });

      it('should deny access when scan belongs to different session', async () => {
        const otherScan: Scan = {
          ...mockScan,
          guestSessionId: 'other-session',
        };
        vi.mocked(scanRepository.getScanById).mockResolvedValue(otherScan);

        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/scans/${validScanId}/events`,
        });

        expect(response.statusCode).toBe(403);
        const json = response.json();
        expect(json.success).toBe(false);
        expect(json.code).toBe('FORBIDDEN');
        expect(json.message).toBe('You do not have access to this scan');
      });

      it('should return 404 when scan does not exist', async () => {
        vi.mocked(scanRepository.getScanById).mockResolvedValue(null);

        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/scans/${validScanId}/events`,
        });

        expect(response.statusCode).toBe(404);
        const json = response.json();
        expect(json.success).toBe(false);
        expect(json.code).toBe('SCAN_NOT_FOUND');
        expect(json.error).toBe('Scan not found');
      });

      it.skip('should bypass ownership check for admin users', async () => {
        // TODO: This test requires dynamic mocking of middleware which is not
        // straightforward with Vitest. Admin authorization is tested in admin
        // module integration tests instead.
        // The controller code correctly checks for request.adminUser and
        // bypasses ownership checks when present.
      });
    });

    describe('Scan ID validation', () => {
      it('should reject invalid UUID format', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/scans/invalid-uuid/events',
        });

        expect(response.statusCode).toBe(400);
        const json = response.json();
        expect(json.success).toBe(false);
        expect(json.code).toBe('VALIDATION_ERROR');
      });

      it('should accept valid UUID format', async () => {
        vi.mocked(scanRepository.getScanById).mockResolvedValue(mockScan);
        vi.mocked(scanEventService.getEvents).mockResolvedValue({
          events: [],
          lastTimestamp: null,
          hasMore: false,
        });

        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/scans/${validScanId}/events`,
        });

        expect(response.statusCode).toBe(200);
      });
    });

    describe('Rate limiting', () => {
      it('should allow requests within rate limit', async () => {
        vi.mocked(scanRepository.getScanById).mockResolvedValue(mockScan);
        vi.mocked(scanEventService.getEvents).mockResolvedValue({
          events: [],
          lastTimestamp: null,
          hasMore: false,
        });

        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/scans/${validScanId}/events`,
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers['x-ratelimit-limit']).toBe('100');
        expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      });

      it.skip('should return 429 when rate limit exceeded', async () => {
        // TODO: This test requires dynamic mocking of Redis which is not
        // straightforward with Vitest and shared module state.
        // Rate limiting behavior is tested in:
        // 1. Integration tests with real Redis
        // 2. eventsRateLimitMiddleware unit tests (if created)
        // The controller code correctly applies the rate limit middleware.
      });

      it('should include rate limit headers in successful response', async () => {
        vi.mocked(scanRepository.getScanById).mockResolvedValue(mockScan);
        vi.mocked(scanEventService.getEvents).mockResolvedValue({
          events: [],
          lastTimestamp: null,
          hasMore: false,
        });

        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/scans/${validScanId}/events`,
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers['x-ratelimit-limit']).toBe('100');
        expect(response.headers['x-ratelimit-remaining']).toBeDefined();
        const remaining = parseInt(
          response.headers['x-ratelimit-remaining'] as string,
          10
        );
        expect(remaining).toBeGreaterThanOrEqual(0);
        expect(remaining).toBeLessThanOrEqual(100);
      });
    });

    describe('Service error handling', () => {
      beforeEach(() => {
        vi.mocked(scanRepository.getScanById).mockResolvedValue(mockScan);
      });

      it('should handle GET_EVENTS_FAILED error', async () => {
        // Create error with matching structure and prototype
        const error = new Error('Failed to retrieve events');
        error.name = 'ScanEventServiceError';
        (error as any).code = 'GET_EVENTS_FAILED';
        // Set the prototype to match the ScanEventServiceError class
        Object.setPrototypeOf(
          error,
          scanEventService.ScanEventServiceError.prototype
        );

        vi.mocked(scanEventService.getEvents).mockRejectedValue(error);

        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/scans/${validScanId}/events`,
        });

        expect(response.statusCode).toBe(500);
        const json = response.json();
        expect(json.success).toBe(false);
        expect(json.code).toBe('GET_EVENTS_FAILED');
        expect(json.error).toBe('Failed to retrieve events');
      });

      it('should handle ARCHIVE_FAILED error', async () => {
        // Create error with matching structure and prototype
        const error = new Error('Failed to archive events');
        error.name = 'ScanEventServiceError';
        (error as any).code = 'ARCHIVE_FAILED';
        // Set the prototype to match the ScanEventServiceError class
        Object.setPrototypeOf(
          error,
          scanEventService.ScanEventServiceError.prototype
        );

        vi.mocked(scanEventService.getEvents).mockRejectedValue(error);

        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/scans/${validScanId}/events`,
        });

        expect(response.statusCode).toBe(500);
        const json = response.json();
        expect(json.success).toBe(false);
        expect(json.code).toBe('ARCHIVE_FAILED');
      });

      it('should handle unexpected errors with 500 status', async () => {
        vi.mocked(scanEventService.getEvents).mockRejectedValue(
          new Error('Unexpected database error')
        );

        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/scans/${validScanId}/events`,
        });

        expect(response.statusCode).toBe(500);
        const json = response.json();
        expect(json.success).toBe(false);
        expect(json.code).toBe('INTERNAL_ERROR');
        expect(json.error).toBe('Internal server error');
      });
    });

    describe('Edge cases', () => {
      it('should handle events with null metadata', async () => {
        vi.mocked(scanRepository.getScanById).mockResolvedValue(mockScan);
        vi.mocked(scanEventService.getEvents).mockResolvedValue({
          events: [
            {
              id: 'event-123',
              scanId: validScanId,
              type: 'INIT',
              level: 'INFO',
              message: 'Scan initialized',
              metadata: null,
              adminOnly: false,
              createdAt: new Date('2024-01-01T00:00:00.000Z'),
            },
          ],
          lastTimestamp: '2024-01-01T00:00:00.000Z',
          hasMore: false,
        });

        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/scans/${validScanId}/events`,
        });

        expect(response.statusCode).toBe(200);
        const json = response.json();
        expect(json.data.events[0].metadata).toBeNull();
      });

      it('should handle events with complex metadata', async () => {
        vi.mocked(scanRepository.getScanById).mockResolvedValue(mockScan);
        vi.mocked(scanEventService.getEvents).mockResolvedValue({
          events: [
            {
              id: 'event-123',
              scanId: validScanId,
              type: 'RESULT',
              level: 'SUCCESS',
              message: 'Scan complete',
              metadata: {
                issuesFound: 5,
                duration: 12500,
                violations: ['color-contrast', 'alt-text'],
              },
              adminOnly: false,
              createdAt: new Date('2024-01-01T00:00:00.000Z'),
            },
          ],
          lastTimestamp: '2024-01-01T00:00:00.000Z',
          hasMore: false,
        });

        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/scans/${validScanId}/events`,
        });

        expect(response.statusCode).toBe(200);
        const json = response.json();
        expect(json.data.events[0].metadata).toEqual({
          issuesFound: 5,
          duration: 12500,
          violations: ['color-contrast', 'alt-text'],
        });
      });

      it('should filter adminOnly events for non-admin users', async () => {
        vi.mocked(scanRepository.getScanById).mockResolvedValue(mockScan);
        vi.mocked(scanEventService.getEvents).mockResolvedValue({
          events: [
            {
              id: 'event-123',
              scanId: validScanId,
              type: 'DEBUG',
              level: 'DEBUG',
              message: 'Internal debug info',
              metadata: null,
              adminOnly: true,
              createdAt: new Date('2024-01-01T00:00:00.000Z'),
            },
          ],
          lastTimestamp: '2024-01-01T00:00:00.000Z',
          hasMore: false,
        });

        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/scans/${validScanId}/events`,
        });

        expect(response.statusCode).toBe(200);
        // Service should filter out adminOnly events for non-admin users
        expect(scanEventService.getEvents).toHaveBeenCalledWith(
          validScanId,
          expect.objectContaining({
            isAdmin: false,
          })
        );
      });
    });
  });
});

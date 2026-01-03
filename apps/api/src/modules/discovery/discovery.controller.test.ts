/**
 * Discovery Controller Integration Tests
 *
 * Tests for website skeleton discovery endpoints.
 * Uses Fastify inject for testing without starting a server.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import { registerDiscoveryRoutes } from './index.js';
import * as discoveryService from './discovery.service.js';
import { DiscoveryServiceError } from './discovery.errors.js';
import type { Discovery, DiscoveryWithPages, DiscoveredPage } from './discovery.types.js';

// Mock the session middleware
vi.mock('../../shared/middleware/session.js', () => ({
  sessionMiddleware: vi.fn(async (request, _reply) => {
    // Attach mock session from request headers (for testing)
    const sessionId = request.headers['x-test-session-id'] as string;
    if (sessionId) {
      request.guestSession = {
        id: sessionId,
        sessionToken: 'test-token',
        fingerprint: 'test-fingerprint',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        anonymizedAt: null,
      };
    }
  }),
}));

// Mock the rate limit middleware
vi.mock('../../shared/middleware/rate-limit.js', () => ({
  createRateLimitMiddleware: vi.fn(() => {
    return vi.fn(async (_request, _reply) => {
      // Pass through for tests unless specifically testing rate limits
    });
  }),
  RATE_LIMIT_CONFIG: {
    MAX_REQUESTS: 10,
    WINDOW_MS: 3600000,
  },
}));

// Mock the discovery service
vi.mock('./discovery.service.js', async () => {
  const actual = await vi.importActual('./discovery.service.js');
  return {
    ...actual,
    createDiscovery: vi.fn(),
    getDiscovery: vi.fn(),
    getCacheMetadata: vi.fn(),
    cancelDiscovery: vi.fn(),
    addManualUrl: vi.fn(),
    addManualUrls: vi.fn(),
    removeManualUrl: vi.fn(),
    checkUsageLimit: vi.fn(),
  };
});

describe('Discovery Controller', () => {
  let app: FastifyInstance;
  const validSessionId = '660e8400-e29b-41d4-a716-446655440000';
  const validDiscoveryId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(async () => {
    // Create a fresh Fastify instance for each test
    app = Fastify();
    await app.register(cookie);
    await registerDiscoveryRoutes(app, '/api/v1');
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  describe('POST /api/v1/discoveries', () => {
    it('should create discovery and return 201', async () => {
      const mockDiscovery: Discovery = {
        id: validDiscoveryId,
        sessionId: validSessionId,
        homepageUrl: 'https://example.com',
        mode: 'AUTO',
        status: 'PENDING',
        maxPages: 10,
        maxDepth: 1,
        createdAt: new Date('2025-01-15T10:00:00.000Z'),
        updatedAt: new Date('2025-01-15T10:00:00.000Z'),
        completedAt: null,
      };

      vi.mocked(discoveryService.createDiscovery).mockResolvedValueOnce(mockDiscovery);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/discoveries',
        headers: {
          'x-test-session-id': validSessionId,
        },
        payload: {
          homepageUrl: 'https://example.com',
          mode: 'AUTO',
          maxPages: 10,
          maxDepth: 1,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: true,
        data: {
          discoveryId: validDiscoveryId,
          status: 'PENDING',
          homepageUrl: 'https://example.com',
          mode: 'AUTO',
          maxPages: 10,
          maxDepth: 1,
          createdAt: '2025-01-15T10:00:00.000Z',
        },
      });

      expect(discoveryService.createDiscovery).toHaveBeenCalledWith(
        validSessionId,
        expect.objectContaining({
          sessionId: validSessionId,
          homepageUrl: 'https://example.com',
          mode: 'AUTO',
          maxPages: 10,
          maxDepth: 1,
        })
      );
    });

    it('should return 400 for invalid URL', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/discoveries',
        headers: {
          'x-test-session-id': validSessionId,
        },
        payload: {
          homepageUrl: 'not-a-url',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.error).toBe('Invalid request body');
      expect(body.details).toBeDefined();
    });

    it('should return 400 for private IP addresses', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/discoveries',
        headers: {
          'x-test-session-id': validSessionId,
        },
        payload: {
          homepageUrl: 'http://192.168.1.1',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 429 when usage limit exceeded', async () => {
      vi.mocked(discoveryService.createDiscovery).mockRejectedValueOnce(
        new DiscoveryServiceError(
          'Monthly discovery limit (3) exceeded. Limit resets on 2025-02-01',
          'USAGE_LIMIT_EXCEEDED'
        )
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/discoveries',
        headers: {
          'x-test-session-id': validSessionId,
        },
        payload: {
          homepageUrl: 'https://example.com',
        },
      });

      expect(response.statusCode).toBe(429);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: false,
        error: 'Monthly discovery limit (3) exceeded. Limit resets on 2025-02-01',
        code: 'USAGE_LIMIT_EXCEEDED',
      });
    });

    it('should return 401 when session is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/discoveries',
        payload: {
          homepageUrl: 'https://example.com',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: false,
        error: 'Unauthorized',
        message: 'Valid session required',
        code: 'SESSION_REQUIRED',
      });

      expect(discoveryService.createDiscovery).not.toHaveBeenCalled();
    });

    it('should return 500 for unexpected errors', async () => {
      vi.mocked(discoveryService.createDiscovery).mockRejectedValueOnce(
        new Error('Unexpected database error')
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/discoveries',
        headers: {
          'x-test-session-id': validSessionId,
        },
        payload: {
          homepageUrl: 'https://example.com',
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    });

    it('should use default values for optional fields', async () => {
      const mockDiscovery: Discovery = {
        id: validDiscoveryId,
        sessionId: validSessionId,
        homepageUrl: 'https://example.com',
        mode: 'AUTO',
        status: 'PENDING',
        maxPages: 10,
        maxDepth: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
      };

      vi.mocked(discoveryService.createDiscovery).mockResolvedValueOnce(mockDiscovery);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/discoveries',
        headers: {
          'x-test-session-id': validSessionId,
        },
        payload: {
          homepageUrl: 'https://example.com',
        },
      });

      expect(response.statusCode).toBe(201);
      expect(discoveryService.createDiscovery).toHaveBeenCalledWith(
        validSessionId,
        expect.objectContaining({
          mode: 'AUTO',
          maxPages: 10,
          maxDepth: 1,
        })
      );
    });
  });

  describe('GET /api/v1/discoveries/:discoveryId', () => {
    it('should return discovery with pages on success', async () => {
      const mockPage: DiscoveredPage = {
        id: 'page-1',
        discoveryId: validDiscoveryId,
        url: 'https://example.com',
        source: 'HOMEPAGE',
        depth: 0,
        createdAt: new Date('2025-01-15T10:00:00.000Z'),
      };

      const mockDiscovery: DiscoveryWithPages = {
        id: validDiscoveryId,
        sessionId: validSessionId,
        homepageUrl: 'https://example.com',
        mode: 'AUTO',
        status: 'COMPLETED',
        maxPages: 10,
        maxDepth: 1,
        createdAt: new Date('2025-01-15T10:00:00.000Z'),
        updatedAt: new Date('2025-01-15T10:05:00.000Z'),
        completedAt: new Date('2025-01-15T10:05:00.000Z'),
        pages: [mockPage],
      };

      vi.mocked(discoveryService.getDiscovery).mockResolvedValueOnce(mockDiscovery);
      vi.mocked(discoveryService.getCacheMetadata).mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/discoveries/${validDiscoveryId}`,
        headers: {
          'x-test-session-id': validSessionId,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: true,
        data: {
          discovery: {
            id: validDiscoveryId,
            status: 'COMPLETED',
            homepageUrl: 'https://example.com',
            mode: 'AUTO',
            maxPages: 10,
            maxDepth: 1,
            createdAt: '2025-01-15T10:00:00.000Z',
            updatedAt: '2025-01-15T10:05:00.000Z',
            completedAt: '2025-01-15T10:05:00.000Z',
          },
          pages: [
            {
              id: 'page-1',
              url: 'https://example.com',
              source: 'HOMEPAGE',
              depth: 0,
              createdAt: '2025-01-15T10:00:00.000Z',
            },
          ],
        },
      });

      expect(discoveryService.getDiscovery).toHaveBeenCalledWith(validDiscoveryId);
    });

    it('should return 404 for non-existent discovery', async () => {
      vi.mocked(discoveryService.getDiscovery).mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/discoveries/${validDiscoveryId}`,
        headers: {
          'x-test-session-id': validSessionId,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: false,
        error: 'Discovery not found',
        code: 'DISCOVERY_NOT_FOUND',
      });
    });

    it('should include cache metadata when cached', async () => {
      const mockDiscovery: DiscoveryWithPages = {
        id: validDiscoveryId,
        sessionId: validSessionId,
        homepageUrl: 'https://example.com',
        mode: 'AUTO',
        status: 'COMPLETED',
        maxPages: 10,
        maxDepth: 1,
        createdAt: new Date('2025-01-15T10:00:00.000Z'),
        updatedAt: new Date('2025-01-15T10:05:00.000Z'),
        completedAt: new Date('2025-01-15T10:05:00.000Z'),
        pages: [],
      };

      vi.mocked(discoveryService.getDiscovery).mockResolvedValueOnce(mockDiscovery);
      vi.mocked(discoveryService.getCacheMetadata).mockResolvedValueOnce({
        cachedAt: new Date('2025-01-15T10:05:00.000Z'),
        pageCount: 5,
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/discoveries/${validDiscoveryId}`,
        headers: {
          'x-test-session-id': validSessionId,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.cacheMetadata).toEqual({
        cachedAt: '2025-01-15T10:05:00.000Z',
        pageCount: 5,
      });
    });

    it('should not include cache metadata when refresh=true', async () => {
      const mockDiscovery: DiscoveryWithPages = {
        id: validDiscoveryId,
        sessionId: validSessionId,
        homepageUrl: 'https://example.com',
        mode: 'AUTO',
        status: 'COMPLETED',
        maxPages: 10,
        maxDepth: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date(),
        pages: [],
      };

      vi.mocked(discoveryService.getDiscovery).mockResolvedValueOnce(mockDiscovery);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/discoveries/${validDiscoveryId}?refresh=true`,
        headers: {
          'x-test-session-id': validSessionId,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.cacheMetadata).toBeUndefined();
      expect(discoveryService.getCacheMetadata).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid discovery ID format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/discoveries/invalid-id',
        headers: {
          'x-test-session-id': validSessionId,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.error).toBe('Invalid discovery ID');
    });

    it('should include rate limit headers', async () => {
      const mockDiscovery: DiscoveryWithPages = {
        id: validDiscoveryId,
        sessionId: validSessionId,
        homepageUrl: 'https://example.com',
        mode: 'AUTO',
        status: 'COMPLETED',
        maxPages: 10,
        maxDepth: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date(),
        pages: [],
      };

      vi.mocked(discoveryService.getDiscovery).mockResolvedValueOnce(mockDiscovery);
      vi.mocked(discoveryService.getCacheMetadata).mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/discoveries/${validDiscoveryId}`,
        headers: {
          'x-test-session-id': validSessionId,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-ratelimit-limit']).toBe('10');
      expect(response.headers['x-ratelimit-remaining']).toBe('10');
    });
  });

  describe('DELETE /api/v1/discoveries/:discoveryId', () => {
    it('should cancel discovery and return 200', async () => {
      const mockDiscovery: Discovery = {
        id: validDiscoveryId,
        sessionId: validSessionId,
        homepageUrl: 'https://example.com',
        mode: 'AUTO',
        status: 'CANCELLED',
        maxPages: 10,
        maxDepth: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
      };

      vi.mocked(discoveryService.cancelDiscovery).mockResolvedValueOnce(mockDiscovery);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/discoveries/${validDiscoveryId}`,
        headers: {
          'x-test-session-id': validSessionId,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: true,
        data: {
          discoveryId: validDiscoveryId,
          status: 'CANCELLED',
          message: 'Discovery cancelled successfully',
        },
      });

      expect(discoveryService.cancelDiscovery).toHaveBeenCalledWith(validDiscoveryId);
    });

    it('should return 404 when discovery not found', async () => {
      vi.mocked(discoveryService.cancelDiscovery).mockRejectedValueOnce(
        new DiscoveryServiceError(
          `Discovery not found: ${validDiscoveryId}`,
          'DISCOVERY_NOT_FOUND'
        )
      );

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/discoveries/${validDiscoveryId}`,
        headers: {
          'x-test-session-id': validSessionId,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: false,
        error: `Discovery not found: ${validDiscoveryId}`,
        code: 'DISCOVERY_NOT_FOUND',
      });
    });

    it('should return 409 when discovery cannot be cancelled', async () => {
      vi.mocked(discoveryService.cancelDiscovery).mockRejectedValueOnce(
        new DiscoveryServiceError(
          'Cannot cancel discovery with status COMPLETED',
          'DISCOVERY_CANCELLED'
        )
      );

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/discoveries/${validDiscoveryId}`,
        headers: {
          'x-test-session-id': validSessionId,
        },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: false,
        error: 'Cannot cancel discovery with status COMPLETED',
        code: 'DISCOVERY_CANCELLED',
      });
    });

    it('should return 400 for invalid discovery ID format', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/discoveries/invalid-id',
        headers: {
          'x-test-session-id': validSessionId,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/discoveries/:discoveryId/pages', () => {
    it('should add valid URL and return 201', async () => {
      const mockPage: DiscoveredPage = {
        id: 'page-1',
        discoveryId: validDiscoveryId,
        url: 'https://example.com/contact',
        source: 'MANUAL',
        depth: 0,
        createdAt: new Date('2025-01-15T10:00:00.000Z'),
      };

      vi.mocked(discoveryService.addManualUrl).mockResolvedValueOnce({
        success: true,
        page: mockPage,
        message: 'URL added successfully',
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/discoveries/${validDiscoveryId}/pages`,
        headers: {
          'x-test-session-id': validSessionId,
        },
        payload: {
          url: 'https://example.com/contact',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: true,
        data: {
          page: {
            id: 'page-1',
            url: 'https://example.com/contact',
            source: 'MANUAL',
            depth: 0,
            createdAt: '2025-01-15T10:00:00.000Z',
          },
          message: 'URL added successfully',
        },
      });

      expect(discoveryService.addManualUrl).toHaveBeenCalledWith(
        validDiscoveryId,
        'https://example.com/contact'
      );
    });

    it('should return 400 when domain mismatch', async () => {
      vi.mocked(discoveryService.addManualUrl).mockResolvedValueOnce({
        success: false,
        message: 'URL must be from the same domain as homepage',
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/discoveries/${validDiscoveryId}/pages`,
        headers: {
          'x-test-session-id': validSessionId,
        },
        payload: {
          url: 'https://different-domain.com/page',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: false,
        error: 'URL must be from the same domain as homepage',
        code: 'DOMAIN_MISMATCH',
      });
    });

    it('should return 409 when URL already exists', async () => {
      vi.mocked(discoveryService.addManualUrl).mockResolvedValueOnce({
        success: false,
        message: 'URL already exists in discovery',
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/discoveries/${validDiscoveryId}/pages`,
        headers: {
          'x-test-session-id': validSessionId,
        },
        payload: {
          url: 'https://example.com/existing',
        },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: false,
        error: 'URL already exists in discovery',
        code: 'PAGE_ALREADY_EXISTS',
      });
    });

    it('should return 400 for invalid URL format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/discoveries/${validDiscoveryId}/pages`,
        headers: {
          'x-test-session-id': validSessionId,
        },
        payload: {
          url: 'not-a-url',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.error).toBe('Invalid request');
    });

    it('should return 404 when discovery not found', async () => {
      vi.mocked(discoveryService.addManualUrl).mockRejectedValueOnce(
        new DiscoveryServiceError(
          `Discovery not found: ${validDiscoveryId}`,
          'DISCOVERY_NOT_FOUND'
        )
      );

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/discoveries/${validDiscoveryId}/pages`,
        headers: {
          'x-test-session-id': validSessionId,
        },
        payload: {
          url: 'https://example.com/page',
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: false,
        error: `Discovery not found: ${validDiscoveryId}`,
        code: 'DISCOVERY_NOT_FOUND',
      });
    });
  });

  describe('POST /api/v1/discoveries/:discoveryId/pages/batch', () => {
    it('should return partial success results', async () => {
      const mockPage: DiscoveredPage = {
        id: 'page-1',
        discoveryId: validDiscoveryId,
        url: 'https://example.com/contact',
        source: 'MANUAL',
        depth: 0,
        createdAt: new Date('2025-01-15T10:00:00.000Z'),
      };

      vi.mocked(discoveryService.addManualUrls).mockResolvedValueOnce([
        {
          success: true,
          page: mockPage,
          message: 'URL added successfully',
        },
        {
          success: false,
          message: 'URL already exists in discovery',
        },
      ]);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/discoveries/${validDiscoveryId}/pages/batch`,
        headers: {
          'x-test-session-id': validSessionId,
        },
        payload: {
          urls: ['https://example.com/contact', 'https://example.com/existing'],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: true,
        data: {
          results: [
            {
              success: true,
              page: {
                id: 'page-1',
                url: 'https://example.com/contact',
                source: 'MANUAL',
                depth: 0,
                createdAt: '2025-01-15T10:00:00.000Z',
              },
              message: 'URL added successfully',
            },
            {
              success: false,
              message: 'URL already exists in discovery',
            },
          ],
          summary: {
            total: 2,
            successful: 1,
            failed: 1,
          },
        },
      });

      expect(discoveryService.addManualUrls).toHaveBeenCalledWith(validDiscoveryId, [
        'https://example.com/contact',
        'https://example.com/existing',
      ]);
    });

    it('should return 400 for invalid payload', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/discoveries/${validDiscoveryId}/pages/batch`,
        headers: {
          'x-test-session-id': validSessionId,
        },
        payload: {
          urls: [],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.error).toBe('Invalid request');
    });

    it('should return 400 for more than 10 URLs', async () => {
      const urls = Array.from({ length: 11 }, (_, i) => `https://example.com/page${i}`);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/discoveries/${validDiscoveryId}/pages/batch`,
        headers: {
          'x-test-session-id': validSessionId,
        },
        payload: {
          urls,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('should handle all successful results', async () => {
      vi.mocked(discoveryService.addManualUrls).mockResolvedValueOnce([
        {
          success: true,
          page: {
            id: 'page-1',
            discoveryId: validDiscoveryId,
            url: 'https://example.com/page1',
            source: 'MANUAL',
            depth: 0,
            createdAt: new Date(),
          },
          message: 'URL added successfully',
        },
        {
          success: true,
          page: {
            id: 'page-2',
            discoveryId: validDiscoveryId,
            url: 'https://example.com/page2',
            source: 'MANUAL',
            depth: 0,
            createdAt: new Date(),
          },
          message: 'URL added successfully',
        },
      ]);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/discoveries/${validDiscoveryId}/pages/batch`,
        headers: {
          'x-test-session-id': validSessionId,
        },
        payload: {
          urls: ['https://example.com/page1', 'https://example.com/page2'],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.summary).toEqual({
        total: 2,
        successful: 2,
        failed: 0,
      });
    });
  });

  describe('DELETE /api/v1/discoveries/:discoveryId/pages/:pageId', () => {
    const validPageId = '770e8400-e29b-41d4-a716-446655440000';

    it('should remove manual URL and return 200', async () => {
      vi.mocked(discoveryService.removeManualUrl).mockResolvedValueOnce(true);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/discoveries/${validDiscoveryId}/pages/${validPageId}`,
        headers: {
          'x-test-session-id': validSessionId,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: true,
        data: {
          message: 'Manual URL removed successfully',
        },
      });

      expect(discoveryService.removeManualUrl).toHaveBeenCalledWith(
        validDiscoveryId,
        validPageId
      );
    });

    it('should return 404 when page not found', async () => {
      vi.mocked(discoveryService.removeManualUrl).mockRejectedValueOnce(
        new DiscoveryServiceError(
          "Page not found or doesn't belong to discovery",
          'PAGE_NOT_FOUND'
        )
      );

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/discoveries/${validDiscoveryId}/pages/${validPageId}`,
        headers: {
          'x-test-session-id': validSessionId,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: false,
        error: "Page not found or doesn't belong to discovery",
        code: 'PAGE_NOT_FOUND',
      });
    });

    it('should return 403 when trying to remove non-manual page', async () => {
      vi.mocked(discoveryService.removeManualUrl).mockRejectedValueOnce(
        new DiscoveryServiceError('Can only remove manually added pages', 'INVALID_INPUT')
      );

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/discoveries/${validDiscoveryId}/pages/${validPageId}`,
        headers: {
          'x-test-session-id': validSessionId,
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: false,
        error: 'Can only remove manually added pages',
        code: 'INVALID_INPUT',
      });
    });

    it('should return 400 for invalid page ID format', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/discoveries/${validDiscoveryId}/pages/invalid-id`,
        headers: {
          'x-test-session-id': validSessionId,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.error).toBe('Invalid request parameters');
    });

    it('should return 500 when removal fails', async () => {
      vi.mocked(discoveryService.removeManualUrl).mockResolvedValueOnce(false);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/discoveries/${validDiscoveryId}/pages/${validPageId}`,
        headers: {
          'x-test-session-id': validSessionId,
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: false,
        error: 'Failed to remove page',
        code: 'DELETE_FAILED',
      });
    });
  });

  describe('Error response consistency', () => {
    it('should return consistent error format for all errors', async () => {
      // Test validation error
      const validationResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/discoveries',
        headers: {
          'x-test-session-id': validSessionId,
        },
        payload: {
          homepageUrl: 'invalid',
        },
      });

      const validationBody = JSON.parse(validationResponse.body);
      expect(validationBody).toHaveProperty('success', false);
      expect(validationBody).toHaveProperty('error');
      expect(validationBody).toHaveProperty('code');

      // Test service error
      vi.mocked(discoveryService.createDiscovery).mockRejectedValueOnce(
        new DiscoveryServiceError('Test error', 'USAGE_LIMIT_EXCEEDED')
      );

      const serviceResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/discoveries',
        headers: {
          'x-test-session-id': validSessionId,
        },
        payload: {
          homepageUrl: 'https://example.com',
        },
      });

      const serviceBody = JSON.parse(serviceResponse.body);
      expect(serviceBody).toHaveProperty('success', false);
      expect(serviceBody).toHaveProperty('error');
      expect(serviceBody).toHaveProperty('code');

      // Test unexpected error
      vi.mocked(discoveryService.createDiscovery).mockRejectedValueOnce(
        new Error('Unexpected error')
      );

      const unexpectedResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/discoveries',
        headers: {
          'x-test-session-id': validSessionId,
        },
        payload: {
          homepageUrl: 'https://example.com',
        },
      });

      const unexpectedBody = JSON.parse(unexpectedResponse.body);
      expect(unexpectedBody).toHaveProperty('success', false);
      expect(unexpectedBody).toHaveProperty('error');
      expect(unexpectedBody).toHaveProperty('code');
    });
  });
});

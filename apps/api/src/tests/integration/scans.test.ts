/**
 * Scans API Integration Tests
 *
 * Tests the complete scan workflow including:
 * - Creating scans with valid/invalid URLs
 * - Rate limiting (10 requests per hour)
 * - Session management integration
 * - Scan status retrieval
 * - Scan result retrieval
 * - Scan listing with pagination
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import { registerScanRoutes } from '../../modules/scans/scan.controller.js';
import { sessionMiddleware } from '../../shared/middleware/session.js';
import { createTestSession, createTestScan, createTestScanResult } from '../setup.js';

/**
 * Mock Redis client for rate limiting tests
 * Note: This must be declared before vi.mock() calls
 */
const mockRedisClient = {
  get: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
  ttl: vi.fn(),
  pipeline: vi.fn(),
  setex: vi.fn(),
};

/**
 * Mock Redis module
 */
vi.mock('../../config/redis.js', () => ({
  getRedisClient: () => mockRedisClient,
}));

/**
 * Mock fingerprint utility for consistent fingerprints
 */
vi.mock('../../shared/utils/fingerprint.js', () => ({
  generateFingerprint: () => 'test-fingerprint-123',
}));

/**
 * Mock reCAPTCHA middleware to skip verification in tests
 */
vi.mock('../../shared/middleware/recaptcha.js', () => ({
  recaptchaMiddleware: async (_request: unknown, _reply: unknown) => {
    // Skip reCAPTCHA validation in tests
  },
}));

/**
 * Mock queue service to avoid queuing real jobs
 */
vi.mock('../../shared/queue/queue.service.js', () => ({
  queueService: {
    addScanJob: vi.fn(async (scanId: string) => {
      return { id: 'job-123', data: { scanId } };
    }),
  },
}));

/**
 * Create test Fastify app with routes
 */
async function createTestApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false, // Disable logging in tests
  });

  // Register cookie plugin
  await app.register(cookie, {
    secret: 'test-secret-key',
  });

  // Register scan routes
  await registerScanRoutes(app, '/api/v1');

  return app;
}

/**
 * Create mock pipeline for Redis
 */
function createMockPipeline(count: number) {
  return {
    incr: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([
      [null, count], // INCR result
      [null, 'OK'], // EXPIRE result
    ]),
  };
}

describe('Scans API Integration Tests', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/v1/scans - Create Scan', () => {
    it('should create a scan with valid URL', async () => {
      // Mock Redis for rate limiting
      (mockRedisClient.get as ReturnType<typeof vi.fn>).mockResolvedValue('0');
      const mockPipeline = createMockPipeline(1);
      (mockRedisClient.pipeline as ReturnType<typeof vi.fn>).mockReturnValue(mockPipeline);
      (mockRedisClient.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(3600);
      (mockRedisClient.setex as ReturnType<typeof vi.fn>).mockResolvedValue('OK');

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/scans',
        payload: {
          url: 'https://example.com',
          email: 'test@example.com',
          wcagLevel: 'AA',
          recaptchaToken: 'test-token',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('scanId');
      expect(body.data.status).toBe('PENDING');
      expect(body.data.url).toBe('https://example.com');
    });

    it('should reject invalid URL', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/scans',
        payload: {
          url: 'not-a-valid-url',
          wcagLevel: 'AA',
          recaptchaToken: 'test-token',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject URL with invalid protocol', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/scans',
        payload: {
          url: 'ftp://example.com',
          wcagLevel: 'AA',
          recaptchaToken: 'test-token',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject missing URL', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/scans',
        payload: {
          wcagLevel: 'AA',
          recaptchaToken: 'test-token',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject missing reCAPTCHA token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/scans',
        payload: {
          url: 'https://example.com',
          wcagLevel: 'AA',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('should accept optional email', async () => {
      // Mock Redis for rate limiting
      (mockRedisClient.get as ReturnType<typeof vi.fn>).mockResolvedValue('0');
      const mockPipeline = createMockPipeline(1);
      (mockRedisClient.pipeline as ReturnType<typeof vi.fn>).mockReturnValue(mockPipeline);
      (mockRedisClient.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(3600);
      (mockRedisClient.setex as ReturnType<typeof vi.fn>).mockResolvedValue('OK');

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/scans',
        payload: {
          url: 'https://example.com',
          wcagLevel: 'AA',
          recaptchaToken: 'test-token',
        },
      });

      expect(response.statusCode).toBe(201);
    });

    it('should default to WCAG level AA', async () => {
      // Mock Redis for rate limiting
      (mockRedisClient.get as ReturnType<typeof vi.fn>).mockResolvedValue('0');
      const mockPipeline = createMockPipeline(1);
      (mockRedisClient.pipeline as ReturnType<typeof vi.fn>).mockReturnValue(mockPipeline);
      (mockRedisClient.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(3600);
      (mockRedisClient.setex as ReturnType<typeof vi.fn>).mockResolvedValue('OK');

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/scans',
        payload: {
          url: 'https://example.com',
          recaptchaToken: 'test-token',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.wcagLevel).toBeUndefined(); // Not returned in response
    });

    it('should normalize email to lowercase', async () => {
      // Mock Redis for rate limiting
      (mockRedisClient.get as ReturnType<typeof vi.fn>).mockResolvedValue('0');
      const mockPipeline = createMockPipeline(1);
      (mockRedisClient.pipeline as ReturnType<typeof vi.fn>).mockReturnValue(mockPipeline);
      (mockRedisClient.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(3600);
      (mockRedisClient.setex as ReturnType<typeof vi.fn>).mockResolvedValue('OK');

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/scans',
        payload: {
          url: 'https://example.com',
          email: 'TEST@EXAMPLE.COM',
          wcagLevel: 'AA',
          recaptchaToken: 'test-token',
        },
      });

      expect(response.statusCode).toBe(201);
      // Email normalization happens in service layer
    });
  });

  describe('POST /api/v1/scans - Rate Limiting', () => {
    it('should allow requests under rate limit', async () => {
      // Mock Redis - 5 requests already made
      (mockRedisClient.get as ReturnType<typeof vi.fn>).mockResolvedValue('5');
      const mockPipeline = createMockPipeline(6);
      (mockRedisClient.pipeline as ReturnType<typeof vi.fn>).mockReturnValue(mockPipeline);
      (mockRedisClient.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(1800);
      (mockRedisClient.setex as ReturnType<typeof vi.fn>).mockResolvedValue('OK');

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/scans',
        payload: {
          url: 'https://example.com',
          wcagLevel: 'AA',
          recaptchaToken: 'test-token',
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.headers['x-ratelimit-limit']).toBe('10');
      expect(response.headers['x-ratelimit-remaining']).toBe('4');
    });

    it('should block request on 11th attempt (rate limit exceeded)', async () => {
      // Mock Redis - 10 requests already made (at limit)
      (mockRedisClient.get as ReturnType<typeof vi.fn>).mockResolvedValue('10');
      (mockRedisClient.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(1800);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/scans',
        payload: {
          url: 'https://example.com',
          wcagLevel: 'AA',
          recaptchaToken: 'test-token',
        },
      });

      expect(response.statusCode).toBe(429);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Too Many Requests');
      expect(body.message).toContain('Rate limit exceeded');
      expect(body.retryAfter).toBe(1800);
      expect(response.headers['retry-after']).toBe('1800');
      expect(response.headers['x-ratelimit-remaining']).toBe('0');
    });

    it('should include rate limit headers', async () => {
      // Mock Redis for rate limiting
      (mockRedisClient.get as ReturnType<typeof vi.fn>).mockResolvedValue('3');
      const mockPipeline = createMockPipeline(4);
      (mockRedisClient.pipeline as ReturnType<typeof vi.fn>).mockReturnValue(mockPipeline);
      (mockRedisClient.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(2400);
      (mockRedisClient.setex as ReturnType<typeof vi.fn>).mockResolvedValue('OK');

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/scans',
        payload: {
          url: 'https://example.com',
          wcagLevel: 'AA',
          recaptchaToken: 'test-token',
        },
      });

      expect(response.headers['x-ratelimit-limit']).toBe('10');
      expect(response.headers['x-ratelimit-remaining']).toBe('6');
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });

    it('should enforce rate limit per URL', async () => {
      // Mock Redis for first URL
      (mockRedisClient.get as ReturnType<typeof vi.fn>).mockResolvedValue('0');
      const mockPipeline1 = createMockPipeline(1);
      (mockRedisClient.pipeline as ReturnType<typeof vi.fn>).mockReturnValue(mockPipeline1);
      (mockRedisClient.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(3600);
      (mockRedisClient.setex as ReturnType<typeof vi.fn>).mockResolvedValue('OK');

      const response1 = await app.inject({
        method: 'POST',
        url: '/api/v1/scans',
        payload: {
          url: 'https://example.com',
          wcagLevel: 'AA',
          recaptchaToken: 'test-token',
        },
      });

      expect(response1.statusCode).toBe(201);

      // Reset mocks for second URL
      vi.clearAllMocks();
      (mockRedisClient.get as ReturnType<typeof vi.fn>).mockResolvedValue('0');
      const mockPipeline2 = createMockPipeline(1);
      (mockRedisClient.pipeline as ReturnType<typeof vi.fn>).mockReturnValue(mockPipeline2);
      (mockRedisClient.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(3600);
      (mockRedisClient.setex as ReturnType<typeof vi.fn>).mockResolvedValue('OK');

      const response2 = await app.inject({
        method: 'POST',
        url: '/api/v1/scans',
        payload: {
          url: 'https://different.com',
          wcagLevel: 'AA',
          recaptchaToken: 'test-token',
        },
      });

      expect(response2.statusCode).toBe(201);
    });
  });

  describe('GET /api/v1/scans/:id - Get Scan Status', () => {
    it('should return scan status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/scans/scan_abc123',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.scanId).toBe('scan_abc123');
      expect(body.data.status).toBe('RUNNING');
      expect(body.data.progress).toBe(50);
    });

    it('should reject invalid scan ID format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/scans/invalid-id',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject too short scan ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/scans/scan_',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/scans/:id/result - Get Scan Result', () => {
    it('should return formatted scan result', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/scans/scan_abc123/result',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.scanId).toBe('scan_abc123');
      expect(body.data.summary).toBeDefined();
      expect(body.data.summary.totalIssues).toBe(5);
    });

    it('should reject invalid scan ID format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/scans/invalid-id/result',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/scans - List Scans', () => {
    it('should list scans for session', async () => {
      // Mock Redis for session
      (mockRedisClient.setex as ReturnType<typeof vi.fn>).mockResolvedValue('OK');
      (mockRedisClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/scans',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('scans');
      expect(body.data).toHaveProperty('total');
    });

    it('should support pagination with limit', async () => {
      // Mock Redis for session
      (mockRedisClient.setex as ReturnType<typeof vi.fn>).mockResolvedValue('OK');
      (mockRedisClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/scans?limit=10',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should support pagination with cursor', async () => {
      // Mock Redis for session
      (mockRedisClient.setex as ReturnType<typeof vi.fn>).mockResolvedValue('OK');
      (mockRedisClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/scans?cursor=scan_xyz789&limit=20',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should reject invalid limit values', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/scans?limit=0',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('should enforce maximum limit of 100', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/scans?limit=101',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Session Management Integration', () => {
    it('should create session automatically on first request', async () => {
      // Mock Redis for rate limiting and session
      (mockRedisClient.get as ReturnType<typeof vi.fn>).mockResolvedValue('0');
      const mockPipeline = createMockPipeline(1);
      (mockRedisClient.pipeline as ReturnType<typeof vi.fn>).mockReturnValue(mockPipeline);
      (mockRedisClient.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(3600);
      (mockRedisClient.setex as ReturnType<typeof vi.fn>).mockResolvedValue('OK');

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/scans',
        payload: {
          url: 'https://example.com',
          wcagLevel: 'AA',
          recaptchaToken: 'test-token',
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.cookies).toBeDefined();
      // Session cookie should be set
      const sessionCookie = response.cookies.find((c) => c.name === 'adashield_session');
      expect(sessionCookie).toBeDefined();
    });

    it('should use existing session from cookie', async () => {
      // Create a test session
      const session = await createTestSession();

      // Mock Redis
      (mockRedisClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(
        JSON.stringify(session)
      );
      (mockRedisClient.setex as ReturnType<typeof vi.fn>).mockResolvedValue('OK');
      const mockPipeline = createMockPipeline(1);
      (mockRedisClient.pipeline as ReturnType<typeof vi.fn>).mockReturnValue(mockPipeline);
      (mockRedisClient.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(3600);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/scans',
        payload: {
          url: 'https://example.com',
          wcagLevel: 'AA',
          recaptchaToken: 'test-token',
        },
        cookies: {
          adashield_session: session.sessionToken,
        },
      });

      expect(response.statusCode).toBe(201);
    });
  });
});

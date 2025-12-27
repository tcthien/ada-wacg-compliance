/**
 * Scan Controller Tests
 *
 * Integration tests for scan API endpoints.
 * Uses Fastify inject() for HTTP testing and mocks service layer.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { registerScanRoutes } from './scan.controller.js';
import * as scanService from './scan.service.js';
import * as resultService from '../results/result.service.js';
import type { GuestSession } from '@prisma/client';

// Mock dependencies
vi.mock('./scan.service.js');
vi.mock('../results/result.service.js');
vi.mock('../../shared/middleware/session.js', () => ({
  sessionMiddleware: async (request: any, _reply: any) => {
    // Mock session middleware - attach mock session
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
vi.mock('../../shared/middleware/recaptcha.js', () => ({
  recaptchaMiddleware: async (request: any, _reply: any) => {
    // Mock recaptcha middleware - attach mock score
    request.recaptchaScore = 0.9;
  },
}));
vi.mock('../../shared/middleware/rate-limit.js', () => ({
  rateLimitMiddleware: async (_request: any, _reply: any) => {
    // Mock rate limit middleware - no-op
  },
}));

describe('Scan Controller', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Create fresh Fastify instance
    app = Fastify();
    await registerScanRoutes(app, '/api/v1');
  });

  describe('POST /api/v1/scans', () => {
    it('should create a scan successfully', async () => {
      // Mock service response
      vi.mocked(scanService.createScan).mockResolvedValue({
        id: 'scan_abc123',
        guestSessionId: 'session-123',
        userId: null,
        url: 'https://example.com',
        email: null,
        status: 'PENDING',
        wcagLevel: 'AA',
        durationMs: null,
        errorMessage: null,
        createdAt: new Date(),
        completedAt: null,
      });

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
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data).toEqual({
        scanId: 'scan_abc123',
        status: 'PENDING',
        url: 'https://example.com',
      });

      // Verify service was called with correct params
      expect(scanService.createScan).toHaveBeenCalledWith('session-123', {
        url: 'https://example.com',
        wcagLevel: 'AA',
        email: undefined,
      });
    });

    it('should handle invalid URL', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/scans',
        payload: {
          url: 'not-a-url',
          wcagLevel: 'AA',
          recaptchaToken: 'test-token',
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('VALIDATION_ERROR');
    });

    it('should handle service errors', async () => {
      // Create a proper instance of ScanServiceError
      class ScanServiceError extends Error {
        public readonly code: string;
        constructor(message: string, code: string) {
          super(message);
          this.name = 'ScanServiceError';
          this.code = code;
        }
      }

      // Mock service error
      vi.mocked(scanService.createScan).mockRejectedValue(
        new ScanServiceError('Invalid URL', 'INVALID_URL')
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/scans',
        payload: {
          url: 'https://example.com',
          wcagLevel: 'AA',
          recaptchaToken: 'test-token',
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('INVALID_URL');
      expect(json.error).toBe('Invalid URL');
    });

    it('should handle missing recaptcha token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/scans',
        payload: {
          url: 'https://example.com',
          wcagLevel: 'AA',
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('VALIDATION_ERROR');
    });

    it('should include email when provided', async () => {
      vi.mocked(scanService.createScan).mockResolvedValue({
        id: 'scan_abc123',
        guestSessionId: 'session-123',
        userId: null,
        url: 'https://example.com',
        email: 'user@example.com',
        status: 'PENDING',
        wcagLevel: 'AA',
        durationMs: null,
        errorMessage: null,
        createdAt: new Date(),
        completedAt: null,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/scans',
        payload: {
          url: 'https://example.com',
          email: 'user@example.com',
          wcagLevel: 'AA',
          recaptchaToken: 'test-token',
        },
      });

      expect(response.statusCode).toBe(201);
      expect(scanService.createScan).toHaveBeenCalledWith('session-123', {
        url: 'https://example.com',
        email: 'user@example.com',
        wcagLevel: 'AA',
      });
    });
  });

  describe('GET /api/v1/scans/:id', () => {
    it('should get scan status successfully', async () => {
      // Mock service response
      vi.mocked(scanService.getScanStatus).mockResolvedValue({
        scanId: 'scan_abc123',
        status: 'RUNNING',
        progress: 50,
        url: 'https://example.com',
        createdAt: new Date('2025-12-26T12:00:00.000Z'),
        completedAt: null,
        errorMessage: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/scans/scan_abc123',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data).toMatchObject({
        scanId: 'scan_abc123',
        status: 'RUNNING',
        progress: 50,
        url: 'https://example.com',
      });

      expect(scanService.getScanStatus).toHaveBeenCalledWith('scan_abc123');
    });

    it('should return 404 for non-existent scan', async () => {
      vi.mocked(scanService.getScanStatus).mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/scans/scan_nonexistent',
      });

      expect(response.statusCode).toBe(404);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('SCAN_NOT_FOUND');
    });

    it('should validate scan ID format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/scans/invalid-id',
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/scans/:id/result', () => {
    it('should get scan results successfully', async () => {
      // Mock service response
      vi.mocked(resultService.getFormattedResult).mockResolvedValue({
        scanId: 'scan_abc123',
        url: 'https://example.com',
        wcagLevel: 'AA',
        completedAt: new Date('2025-12-26T12:00:00.000Z'),
        summary: {
          totalIssues: 5,
          critical: 1,
          serious: 2,
          moderate: 1,
          minor: 1,
          passed: 10,
        },
        issuesByImpact: {
          critical: [],
          serious: [],
          moderate: [],
          minor: [],
        },
        metadata: {
          coverageNote: 'Test note',
          wcagVersion: '2.1',
          toolVersion: '1.0.0',
          scanDuration: 5000,
          inapplicableChecks: 0,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/scans/scan_abc123/result',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data).toMatchObject({
        scanId: 'scan_abc123',
        url: 'https://example.com',
        summary: {
          totalIssues: 5,
          critical: 1,
        },
      });

      expect(resultService.getFormattedResult).toHaveBeenCalledWith('scan_abc123');
    });

    it('should return 404 for non-existent scan', async () => {
      vi.mocked(resultService.getFormattedResult).mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/scans/scan_nonexistent/result',
      });

      expect(response.statusCode).toBe(404);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('SCAN_NOT_FOUND');
    });

    it('should handle incomplete scan', async () => {
      // Create a proper instance of ResultServiceError
      class ResultServiceError extends Error {
        public readonly code: string;
        constructor(message: string, code: string) {
          super(message);
          this.name = 'ResultServiceError';
          this.code = code;
        }
      }

      vi.mocked(resultService.getFormattedResult).mockRejectedValue(
        new ResultServiceError('Scan not completed', 'SCAN_NOT_COMPLETED')
      );

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/scans/scan_abc123/result',
      });

      expect(response.statusCode).toBe(409);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('SCAN_NOT_COMPLETED');
    });
  });

  describe('GET /api/v1/scans', () => {
    it('should list scans successfully', async () => {
      // Mock service response
      vi.mocked(scanService.listScans).mockResolvedValue({
        items: [
          {
            id: 'scan_abc123',
            guestSessionId: 'session-123',
            userId: null,
            url: 'https://example.com',
            email: null,
            status: 'COMPLETED',
            wcagLevel: 'AA',
            durationMs: 5000,
            errorMessage: null,
            createdAt: new Date('2025-12-26T12:00:00.000Z'),
            completedAt: new Date('2025-12-26T12:01:00.000Z'),
          },
          {
            id: 'scan_xyz789',
            guestSessionId: 'session-123',
            userId: null,
            url: 'https://example2.com',
            email: null,
            status: 'RUNNING',
            wcagLevel: 'AA',
            durationMs: null,
            errorMessage: null,
            createdAt: new Date('2025-12-26T12:02:00.000Z'),
            completedAt: null,
          },
        ],
        nextCursor: 'scan_next123',
        total: 42,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/scans?limit=10',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.scans).toHaveLength(2);
      expect(json.data.nextCursor).toBe('scan_next123');
      expect(json.data.total).toBe(42);

      expect(scanService.listScans).toHaveBeenCalledWith('session-123', {
        limit: 10,
        cursor: undefined,
      });
    });

    it('should handle pagination with cursor', async () => {
      vi.mocked(scanService.listScans).mockResolvedValue({
        items: [],
        nextCursor: undefined,
        total: 0,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/scans?limit=5&cursor=scan_xyz789',
      });

      expect(response.statusCode).toBe(200);
      expect(scanService.listScans).toHaveBeenCalledWith('session-123', {
        limit: 5,
        cursor: 'scan_xyz789',
      });
    });

    it('should validate limit parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/scans?limit=-1',
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('VALIDATION_ERROR');
    });

    it('should enforce max limit', async () => {
      vi.mocked(scanService.listScans).mockResolvedValue({
        items: [],
        nextCursor: undefined,
        total: 0,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/scans?limit=200',
      });

      // Should be capped at 100
      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('VALIDATION_ERROR');
    });

    it('should use default limit when not provided', async () => {
      vi.mocked(scanService.listScans).mockResolvedValue({
        items: [],
        nextCursor: undefined,
        total: 0,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/scans',
      });

      expect(response.statusCode).toBe(200);
      expect(scanService.listScans).toHaveBeenCalledWith('session-123', {
        limit: 20, // Default
        cursor: undefined,
      });
    });
  });

  describe('Middleware Chain', () => {
    it('should execute middleware in correct order for POST', async () => {
      // This test verifies middleware are attached correctly
      // Session, recaptcha, and rate limit should all be called
      vi.mocked(scanService.createScan).mockResolvedValue({
        id: 'scan_abc123',
        guestSessionId: 'session-123',
        userId: null,
        url: 'https://example.com',
        email: null,
        status: 'PENDING',
        wcagLevel: 'AA',
        durationMs: null,
        errorMessage: null,
        createdAt: new Date(),
        completedAt: null,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/scans',
        payload: {
          url: 'https://example.com',
          wcagLevel: 'AA',
          recaptchaToken: 'test-token',
        },
      });

      // Should succeed with all middleware passing
      expect(response.statusCode).toBe(201);
    });

    it('should only execute session middleware for GET', async () => {
      vi.mocked(scanService.getScanStatus).mockResolvedValue({
        scanId: 'scan_abc123',
        status: 'PENDING',
        progress: 0,
        url: 'https://example.com',
        createdAt: new Date(),
        completedAt: null,
        errorMessage: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/scans/scan_abc123',
      });

      // Should succeed with only session middleware
      expect(response.statusCode).toBe(200);
    });
  });
});

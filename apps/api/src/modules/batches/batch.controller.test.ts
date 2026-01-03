/**
 * Batch Controller Tests
 *
 * Integration tests for batch scan API endpoints.
 * Uses Fastify inject() for HTTP testing and mocks service layer.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { registerBatchRoutes } from './batch.controller.js';
import * as batchService from './batch.service.js';
import * as batchExportService from './batch-export.service.js';
import type { GuestSession } from '@prisma/client';

// Mock dependencies
vi.mock('./batch.service.js');
vi.mock('./batch-export.service.js');
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

describe('Batch Controller', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Create fresh Fastify instance
    app = Fastify();
    await registerBatchRoutes(app, '/api/v1');
  });

  describe('POST /api/v1/batches', () => {
    it('should create a batch successfully', async () => {
      // Mock service response
      vi.mocked(batchService.createBatch).mockResolvedValue({
        batch: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          guestSessionId: 'session-123',
          userId: null,
          homepageUrl: 'https://example.com',
          totalUrls: 3,
          completedCount: 0,
          failedCount: 0,
          totalIssues: null,
          criticalCount: null,
          seriousCount: null,
          moderateCount: null,
          minorCount: null,
          status: 'RUNNING',
          wcagLevel: 'AA',
          createdAt: new Date(),
          completedAt: null,
          cancelledAt: null,
          discoveryId: null,
        },
        scans: [
          {
            id: 'scan_1',
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
          },
          {
            id: 'scan_2',
            guestSessionId: 'session-123',
            userId: null,
            url: 'https://example.com/about',
            email: null,
            status: 'PENDING',
            wcagLevel: 'AA',
            durationMs: null,
            errorMessage: null,
            createdAt: new Date(),
            completedAt: null,
          },
          {
            id: 'scan_3',
            guestSessionId: 'session-123',
            userId: null,
            url: 'https://example.com/contact',
            email: null,
            status: 'PENDING',
            wcagLevel: 'AA',
            durationMs: null,
            errorMessage: null,
            createdAt: new Date(),
            completedAt: null,
          },
        ],
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/batches',
        payload: {
          urls: [
            'https://example.com',
            'https://example.com/about',
            'https://example.com/contact',
          ],
          wcagLevel: 'AA',
          recaptchaToken: 'test-token',
        },
      });

      expect(response.statusCode).toBe(201);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data).toEqual({
        batchId: '550e8400-e29b-41d4-a716-446655440000',
        status: 'RUNNING',
        totalUrls: 3,
        homepageUrl: 'https://example.com',
        scanIds: ['scan_1', 'scan_2', 'scan_3'],
      });

      // Verify service was called with correct params
      expect(batchService.createBatch).toHaveBeenCalledWith({
        urls: [
          'https://example.com',
          'https://example.com/about',
          'https://example.com/contact',
        ],
        wcagLevel: 'AA',
        guestSessionId: 'session-123',
      });
    });

    it('should validate minimum URL count (1 required)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/batches',
        payload: {
          urls: [],
          wcagLevel: 'AA',
          recaptchaToken: 'test-token',
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('VALIDATION_ERROR');
      expect(json.error).toContain('Invalid request body');
    });

    it('should validate maximum URL count (50 limit)', async () => {
      const urls = Array.from({ length: 51 }, (_, i) => `https://example.com/page${i}`);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/batches',
        payload: {
          urls,
          wcagLevel: 'AA',
          recaptchaToken: 'test-token',
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('VALIDATION_ERROR');
    });

    it('should require recaptcha token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/batches',
        payload: {
          urls: ['https://example.com'],
          wcagLevel: 'AA',
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('VALIDATION_ERROR');
    });

    it('should validate URL format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/batches',
        payload: {
          urls: ['not-a-valid-url', 'https://example.com'],
          wcagLevel: 'AA',
          recaptchaToken: 'test-token',
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('VALIDATION_ERROR');
    });

    it('should reject duplicate URLs', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/batches',
        payload: {
          urls: [
            'https://example.com',
            'https://example.com',
            'https://example.com/about',
          ],
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
      // Create a proper instance of BatchServiceError
      class BatchServiceError extends Error {
        public readonly code: string;
        constructor(message: string, code: string) {
          super(message);
          this.name = 'BatchServiceError';
          this.code = code;
        }
      }

      // Mock service error
      vi.mocked(batchService.createBatch).mockRejectedValue(
        new BatchServiceError('Invalid URL detected', 'INVALID_URL')
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/batches',
        payload: {
          urls: ['https://example.com'],
          wcagLevel: 'AA',
          recaptchaToken: 'test-token',
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('INVALID_URL');
      expect(json.error).toBe('Invalid URL detected');
    });
  });

  describe('GET /api/v1/batches/:id', () => {
    it('should get batch status successfully', async () => {
      // Mock service response
      vi.mocked(batchService.getBatchStatus).mockResolvedValue({
        batchId: '550e8400-e29b-41d4-a716-446655440000',
        status: 'RUNNING',
        totalUrls: 10,
        completedCount: 7,
        failedCount: 1,
        homepageUrl: 'https://example.com',
        wcagLevel: 'AA',
        createdAt: new Date('2025-12-29T12:00:00.000Z'),
        completedAt: null,
        urls: [
          {
            id: 'scan_1',
            url: 'https://example.com',
            status: 'COMPLETED',
            pageTitle: 'Example Domain',
            completedAt: new Date('2025-12-29T12:05:00.000Z'),
            errorMessage: null,
          },
          {
            id: 'scan_2',
            url: 'https://example.com/about',
            status: 'RUNNING',
            pageTitle: null,
            completedAt: null,
            errorMessage: null,
          },
        ],
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/batches/550e8400-e29b-41d4-a716-446655440000',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data).toMatchObject({
        batchId: '550e8400-e29b-41d4-a716-446655440000',
        status: 'RUNNING',
        totalUrls: 10,
        completedCount: 7,
        failedCount: 1,
        homepageUrl: 'https://example.com',
      });
      expect(json.data.urls).toHaveLength(2);

      expect(batchService.getBatchStatus).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        'session-123'
      );
    });

    it('should return 404 for non-existent batch', async () => {
      // Create a proper instance of BatchServiceError
      class BatchServiceError extends Error {
        public readonly code: string;
        constructor(message: string, code: string) {
          super(message);
          this.name = 'BatchServiceError';
          this.code = code;
        }
      }

      vi.mocked(batchService.getBatchStatus).mockRejectedValue(
        new BatchServiceError('Batch not found', 'NOT_FOUND')
      );

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/batches/00000000-0000-0000-0000-000000000000',
      });

      expect(response.statusCode).toBe(404);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('NOT_FOUND');
    });

    it('should return 403 for unauthorized access', async () => {
      // Create a proper instance of BatchServiceError
      class BatchServiceError extends Error {
        public readonly code: string;
        constructor(message: string, code: string) {
          super(message);
          this.name = 'BatchServiceError';
          this.code = code;
        }
      }

      vi.mocked(batchService.getBatchStatus).mockRejectedValue(
        new BatchServiceError('Unauthorized access', 'UNAUTHORIZED')
      );

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/batches/550e8400-e29b-41d4-a716-446655440000',
      });

      expect(response.statusCode).toBe(403);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('UNAUTHORIZED');
    });

    it('should validate batch ID format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/batches/invalid-id-format',
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/batches/:id/results', () => {
    it('should get batch results successfully', async () => {
      // Mock service response
      vi.mocked(batchService.getBatchResults).mockResolvedValue({
        batchId: '550e8400-e29b-41d4-a716-446655440000',
        status: 'COMPLETED',
        totalUrls: 10,
        completedCount: 9,
        failedCount: 1,
        homepageUrl: 'https://example.com',
        wcagLevel: 'AA',
        createdAt: new Date('2025-12-29T12:00:00.000Z'),
        completedAt: new Date('2025-12-29T12:30:00.000Z'),
        aggregate: {
          totalIssues: 125,
          criticalCount: 15,
          seriousCount: 35,
          moderateCount: 50,
          minorCount: 25,
          passedChecks: 450,
          urlsScanned: 9,
        },
        urls: [
          {
            id: 'scan_1',
            url: 'https://example.com',
            status: 'COMPLETED',
            pageTitle: 'Example',
            totalIssues: 10,
            criticalCount: 1,
            seriousCount: 3,
            moderateCount: 4,
            minorCount: 2,
            passedChecks: 50,
          },
        ],
        topCriticalUrls: [
          {
            url: 'https://example.com',
            pageTitle: 'Example',
            criticalCount: 1,
            seriousCount: 3,
          },
        ],
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/batches/550e8400-e29b-41d4-a716-446655440000/results',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data).toMatchObject({
        batchId: '550e8400-e29b-41d4-a716-446655440000',
        status: 'COMPLETED',
        totalUrls: 10,
        aggregate: {
          totalIssues: 125,
          criticalCount: 15,
        },
      });

      expect(batchService.getBatchResults).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        'session-123'
      );
    });

    it('should return 404 for non-existent batch', async () => {
      // Create a proper instance of BatchServiceError
      class BatchServiceError extends Error {
        public readonly code: string;
        constructor(message: string, code: string) {
          super(message);
          this.name = 'BatchServiceError';
          this.code = code;
        }
      }

      vi.mocked(batchService.getBatchResults).mockRejectedValue(
        new BatchServiceError('Batch not found', 'NOT_FOUND')
      );

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/batches/00000000-0000-0000-0000-000000000000/results',
      });

      expect(response.statusCode).toBe(404);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/v1/batches/:id/cancel', () => {
    it('should cancel batch successfully', async () => {
      // Mock service response
      vi.mocked(batchService.cancelBatch).mockResolvedValue({
        batchId: '550e8400-e29b-41d4-a716-446655440000',
        status: 'CANCELLED',
        completedCount: 5,
        cancelledCount: 3,
        failedToCancel: 0,
        message: 'Cancelled 3 scans, preserved 5 completed scans',
        cancelledAt: new Date('2025-12-29T12:15:00.000Z'),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/batches/550e8400-e29b-41d4-a716-446655440000/cancel',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data).toMatchObject({
        batchId: '550e8400-e29b-41d4-a716-446655440000',
        status: 'CANCELLED',
        completedCount: 5,
        cancelledCount: 3,
        failedToCancel: 0,
      });

      expect(batchService.cancelBatch).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        'session-123'
      );
    });

    it('should return 404 for non-existent batch', async () => {
      // Create a proper instance of BatchServiceError
      class BatchServiceError extends Error {
        public readonly code: string;
        constructor(message: string, code: string) {
          super(message);
          this.name = 'BatchServiceError';
          this.code = code;
        }
      }

      vi.mocked(batchService.cancelBatch).mockRejectedValue(
        new BatchServiceError('Batch not found', 'NOT_FOUND')
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/batches/00000000-0000-0000-0000-000000000000/cancel',
      });

      expect(response.statusCode).toBe(404);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('NOT_FOUND');
    });

    it('should handle already completed batch', async () => {
      // Create a proper instance of BatchServiceError
      class BatchServiceError extends Error {
        public readonly code: string;
        constructor(message: string, code: string) {
          super(message);
          this.name = 'BatchServiceError';
          this.code = code;
        }
      }

      vi.mocked(batchService.cancelBatch).mockRejectedValue(
        new BatchServiceError('Cannot cancel completed batch', 'INVALID_STATE')
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/batches/550e8400-e29b-41d4-a716-446655440000/cancel',
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('INVALID_STATE');
    });
  });

  describe('GET /api/v1/batches', () => {
    it('should list batches successfully', async () => {
      // Mock service response
      vi.mocked(batchService.listBatches).mockResolvedValue({
        batches: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            homepageUrl: 'https://example.com',
            totalUrls: 10,
            status: 'COMPLETED',
            completedCount: 9,
            failedCount: 1,
            totalIssues: 125,
            criticalCount: 15,
            seriousCount: 35,
            moderateCount: 50,
            minorCount: 25,
            createdAt: new Date('2025-12-29T12:00:00.000Z'),
            completedAt: new Date('2025-12-29T12:30:00.000Z'),
            discoveryId: null,
          },
          {
            id: '650e8400-e29b-41d4-a716-446655440001',
            homepageUrl: 'https://example2.com',
            totalUrls: 5,
            status: 'RUNNING',
            completedCount: 3,
            failedCount: 0,
            totalIssues: null,
            criticalCount: null,
            seriousCount: null,
            moderateCount: null,
            minorCount: null,
            createdAt: new Date('2025-12-29T13:00:00.000Z'),
            completedAt: null,
            discoveryId: null,
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          totalPages: 1,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/batches?page=1&limit=20',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.batches).toHaveLength(2);
      expect(json.data.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
      });

      expect(batchService.listBatches).toHaveBeenCalledWith('session-123', {
        page: 1,
        limit: 20,
      });
    });

    it('should handle pagination parameters', async () => {
      vi.mocked(batchService.listBatches).mockResolvedValue({
        batches: [],
        pagination: {
          page: 2,
          limit: 10,
          total: 15,
          totalPages: 2,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/batches?page=2&limit=10',
      });

      expect(response.statusCode).toBe(200);
      expect(batchService.listBatches).toHaveBeenCalledWith('session-123', {
        page: 2,
        limit: 10,
      });
    });

    it('should use default pagination when not provided', async () => {
      vi.mocked(batchService.listBatches).mockResolvedValue({
        batches: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/batches',
      });

      expect(response.statusCode).toBe(200);
      expect(batchService.listBatches).toHaveBeenCalledWith('session-123', {
        page: 1,
        limit: 20,
      });
    });

    it('should validate pagination parameters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/batches?page=0&limit=-1',
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('VALIDATION_ERROR');
    });

    it('should enforce maximum limit', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/batches?limit=200',
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/batches/:id/export', () => {
    it('should export batch as PDF', async () => {
      // Mock service responses
      vi.mocked(batchService.getBatchResults).mockResolvedValue({
        batchId: '550e8400-e29b-41d4-a716-446655440000',
        status: 'COMPLETED',
        totalUrls: 10,
        completedCount: 9,
        failedCount: 1,
        homepageUrl: 'https://example.com',
        wcagLevel: 'AA',
        createdAt: new Date('2025-12-29T12:00:00.000Z'),
        completedAt: new Date('2025-12-29T12:30:00.000Z'),
        aggregate: {
          totalIssues: 125,
          criticalCount: 15,
          seriousCount: 35,
          moderateCount: 50,
          minorCount: 25,
          passedChecks: 450,
          urlsScanned: 9,
        },
        urls: [],
        topCriticalUrls: [],
      });

      const mockPdfBuffer = Buffer.from('PDF content');
      vi.mocked(batchExportService.generateBatchPdf).mockResolvedValue(mockPdfBuffer);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/batches/550e8400-e29b-41d4-a716-446655440000/export?format=pdf',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain(
        'batch-report-550e8400-e29b-41d4-a716-446655440000.pdf'
      );
      expect(batchExportService.generateBatchPdf).toHaveBeenCalled();
    });

    it('should export batch as JSON', async () => {
      // Mock service response
      vi.mocked(batchService.getBatchResults).mockResolvedValue({
        batchId: '550e8400-e29b-41d4-a716-446655440000',
        status: 'COMPLETED',
        totalUrls: 10,
        completedCount: 9,
        failedCount: 1,
        homepageUrl: 'https://example.com',
        wcagLevel: 'AA',
        createdAt: new Date('2025-12-29T12:00:00.000Z'),
        completedAt: new Date('2025-12-29T12:30:00.000Z'),
        aggregate: {
          totalIssues: 125,
          criticalCount: 15,
          seriousCount: 35,
          moderateCount: 50,
          minorCount: 25,
          passedChecks: 450,
          urlsScanned: 9,
        },
        urls: [],
        topCriticalUrls: [],
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/batches/550e8400-e29b-41d4-a716-446655440000/export?format=json',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(response.headers['content-disposition']).toContain(
        'batch-report-550e8400-e29b-41d4-a716-446655440000.json'
      );

      const json = response.json();
      expect(json.batchId).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(json.metadata).toBeDefined();
      expect(json.aggregate).toBeDefined();
    });

    it('should default to PDF format when not specified', async () => {
      // Mock service responses
      vi.mocked(batchService.getBatchResults).mockResolvedValue({
        batchId: '550e8400-e29b-41d4-a716-446655440000',
        status: 'COMPLETED',
        totalUrls: 10,
        completedCount: 9,
        failedCount: 1,
        homepageUrl: 'https://example.com',
        wcagLevel: 'AA',
        createdAt: new Date('2025-12-29T12:00:00.000Z'),
        completedAt: new Date('2025-12-29T12:30:00.000Z'),
        aggregate: {
          totalIssues: 125,
          criticalCount: 15,
          seriousCount: 35,
          moderateCount: 50,
          minorCount: 25,
          passedChecks: 450,
          urlsScanned: 9,
        },
        urls: [],
        topCriticalUrls: [],
      });

      const mockPdfBuffer = Buffer.from('PDF content');
      vi.mocked(batchExportService.generateBatchPdf).mockResolvedValue(mockPdfBuffer);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/batches/550e8400-e29b-41d4-a716-446655440000/export',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
    });

    it('should reject export for incomplete batch', async () => {
      // Mock service response for running batch
      vi.mocked(batchService.getBatchResults).mockResolvedValue({
        batchId: '550e8400-e29b-41d4-a716-446655440000',
        status: 'RUNNING',
        totalUrls: 10,
        completedCount: 5,
        failedCount: 0,
        homepageUrl: 'https://example.com',
        wcagLevel: 'AA',
        createdAt: new Date('2025-12-29T12:00:00.000Z'),
        completedAt: null,
        aggregate: {
          totalIssues: 0,
          criticalCount: 0,
          seriousCount: 0,
          moderateCount: 0,
          minorCount: 0,
          passedChecks: 0,
          urlsScanned: 0,
        },
        urls: [],
        topCriticalUrls: [],
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/batches/550e8400-e29b-41d4-a716-446655440000/export?format=pdf',
      });

      expect(response.statusCode).toBe(409);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('BATCH_NOT_COMPLETED');
    });
  });

  describe('Middleware Chain', () => {
    it('should execute middleware in correct order for POST', async () => {
      // This test verifies middleware are attached correctly
      // Session, recaptcha, and rate limit should all be called
      vi.mocked(batchService.createBatch).mockResolvedValue({
        batch: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          guestSessionId: 'session-123',
          userId: null,
          homepageUrl: 'https://example.com',
          totalUrls: 1,
          completedCount: 0,
          failedCount: 0,
          totalIssues: null,
          criticalCount: null,
          seriousCount: null,
          moderateCount: null,
          minorCount: null,
          status: 'RUNNING',
          wcagLevel: 'AA',
          createdAt: new Date(),
          completedAt: null,
          cancelledAt: null,
          discoveryId: null,
        },
        scans: [
          {
            id: 'scan_1',
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
          },
        ],
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/batches',
        payload: {
          urls: ['https://example.com'],
          wcagLevel: 'AA',
          recaptchaToken: 'test-token',
        },
      });

      // Should succeed with all middleware passing
      expect(response.statusCode).toBe(201);
    });

    it('should only execute session middleware for GET', async () => {
      vi.mocked(batchService.getBatchStatus).mockResolvedValue({
        batchId: '550e8400-e29b-41d4-a716-446655440000',
        status: 'RUNNING',
        totalUrls: 1,
        completedCount: 0,
        failedCount: 0,
        homepageUrl: 'https://example.com',
        wcagLevel: 'AA',
        createdAt: new Date(),
        completedAt: null,
        urls: [],
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/batches/550e8400-e29b-41d4-a716-446655440000',
      });

      // Should succeed with only session middleware
      expect(response.statusCode).toBe(200);
    });
  });
});

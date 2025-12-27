/**
 * Report Controller Tests
 *
 * Tests for the report download and generation endpoint.
 * Uses Fastify inject for testing without starting a server.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import { registerReportRoutes } from './report.controller.js';
import * as reportService from './report.service.js';
import { ReportServiceError } from './report.service.js';

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

// Mock the report service
vi.mock('./report.service.js', async () => {
  const actual = await vi.importActual('./report.service.js');
  return {
    ...actual,
    getOrGenerateReport: vi.fn(),
  };
});

describe('Report Controller', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    // Create a fresh Fastify instance for each test
    app = Fastify();
    await app.register(cookie);
    await registerReportRoutes(app, '/api/v1');
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  describe('GET /api/v1/reports/:scanId/:format', () => {
    const validScanId = '550e8400-e29b-41d4-a716-446655440000';
    const validSessionId = '660e8400-e29b-41d4-a716-446655440000';

    it('should return 200 with URL when report exists', async () => {
      // Mock service to return ready status
      vi.mocked(reportService.getOrGenerateReport).mockResolvedValueOnce({
        status: 'ready',
        url: 'https://s3.example.com/report.pdf?signed=true',
        expiresAt: new Date('2025-12-26T13:00:00.000Z'),
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/${validScanId}/pdf`,
        headers: {
          'x-test-session-id': validSessionId,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: true,
        data: {
          url: 'https://s3.example.com/report.pdf?signed=true',
          expiresAt: '2025-12-26T13:00:00.000Z',
        },
      });

      expect(reportService.getOrGenerateReport).toHaveBeenCalledWith(
        validScanId,
        'pdf',
        validSessionId
      );
    });

    it('should return 202 when report is generating', async () => {
      // Mock service to return generating status
      vi.mocked(reportService.getOrGenerateReport).mockResolvedValueOnce({
        status: 'generating',
        jobId: 'job-12345',
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/${validScanId}/json`,
        headers: {
          'x-test-session-id': validSessionId,
        },
      });

      expect(response.statusCode).toBe(202);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: true,
        data: {
          status: 'generating',
          jobId: 'job-12345',
        },
      });

      expect(reportService.getOrGenerateReport).toHaveBeenCalledWith(
        validScanId,
        'json',
        validSessionId
      );
    });

    it('should return 404 when scan not found', async () => {
      // Mock service to return not_found status
      vi.mocked(reportService.getOrGenerateReport).mockResolvedValueOnce({
        status: 'not_found',
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/${validScanId}/pdf`,
        headers: {
          'x-test-session-id': validSessionId,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: false,
        error: 'Scan not found',
        code: 'SCAN_NOT_FOUND',
      });
    });

    it('should return 403 when scan does not belong to session', async () => {
      // Mock service to throw FORBIDDEN error
      vi.mocked(reportService.getOrGenerateReport).mockRejectedValueOnce(
        new ReportServiceError('Scan does not belong to session', 'FORBIDDEN')
      );

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/${validScanId}/pdf`,
        headers: {
          'x-test-session-id': validSessionId,
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: false,
        error: 'Scan does not belong to session',
        code: 'FORBIDDEN',
      });
    });

    it('should return 409 when scan is not completed', async () => {
      // Mock service to throw SCAN_NOT_COMPLETED error
      vi.mocked(reportService.getOrGenerateReport).mockRejectedValueOnce(
        new ReportServiceError(
          'Scan must be completed before generating report',
          'SCAN_NOT_COMPLETED'
        )
      );

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/${validScanId}/pdf`,
        headers: {
          'x-test-session-id': validSessionId,
        },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: false,
        error: 'Scan must be completed before generating report',
        code: 'SCAN_NOT_COMPLETED',
      });
    });

    it('should return 401 when session is missing', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/${validScanId}/pdf`,
        // No session header
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: false,
        error: 'Unauthorized',
        message: 'Valid session required',
        code: 'SESSION_REQUIRED',
      });

      // Service should not be called without session
      expect(reportService.getOrGenerateReport).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid scan ID format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/reports/invalid-scan-id/pdf',
        headers: {
          'x-test-session-id': validSessionId,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.error).toBe('Invalid request parameters');
      expect(body.details).toBeDefined();
    });

    it('should return 400 for invalid format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/${validScanId}/xml`,
        headers: {
          'x-test-session-id': validSessionId,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.error).toBe('Invalid request parameters');
      expect(body.details).toBeDefined();
    });

    it('should return 500 for unexpected service errors', async () => {
      // Mock service to throw unexpected error
      vi.mocked(reportService.getOrGenerateReport).mockRejectedValueOnce(
        new Error('Unexpected database error')
      );

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/${validScanId}/pdf`,
        headers: {
          'x-test-session-id': validSessionId,
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

    it('should handle both pdf and json formats', async () => {
      // Test PDF format
      vi.mocked(reportService.getOrGenerateReport).mockResolvedValueOnce({
        status: 'ready',
        url: 'https://s3.example.com/report.pdf',
        expiresAt: new Date(),
      });

      const pdfResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/${validScanId}/pdf`,
        headers: {
          'x-test-session-id': validSessionId,
        },
      });

      expect(pdfResponse.statusCode).toBe(200);
      expect(reportService.getOrGenerateReport).toHaveBeenCalledWith(
        validScanId,
        'pdf',
        validSessionId
      );

      vi.clearAllMocks();

      // Test JSON format
      vi.mocked(reportService.getOrGenerateReport).mockResolvedValueOnce({
        status: 'ready',
        url: 'https://s3.example.com/report.json',
        expiresAt: new Date(),
      });

      const jsonResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/${validScanId}/json`,
        headers: {
          'x-test-session-id': validSessionId,
        },
      });

      expect(jsonResponse.statusCode).toBe(200);
      expect(reportService.getOrGenerateReport).toHaveBeenCalledWith(
        validScanId,
        'json',
        validSessionId
      );
    });
  });
});

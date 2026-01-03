/**
 * AI Campaign Controller Tests
 *
 * Integration tests for AI campaign API endpoints.
 * Uses Fastify inject() for HTTP testing and mocks service layer.
 *
 * Requirements: REQ-2, REQ-5
 */

import { describe, it, expect, beforeEach, vi, type MockInstance } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { registerAiCampaignRoutes } from './ai-campaign.controller.js';
import * as aiCampaignService from './ai-campaign.service.js';
import * as aiCampaignRepository from './ai-campaign.repository.js';
import type { CampaignStatusResponse, CampaignMetrics } from './ai-campaign.types.js';

// Mock dependencies
vi.mock('./ai-campaign.service.js');
vi.mock('./ai-campaign.repository.js');
vi.mock('../../shared/middleware/rate-limit.js', () => ({
  rateLimitMiddleware: async (_request: any, _reply: any) => {
    // Mock rate limit middleware - no-op
  },
}));

// Store adminUser for mock middleware
let mockAdminUser: { id: string; email: string; role: string } | null = null;

vi.mock('../admin/admin.middleware.js', () => ({
  adminAuthMiddleware: async (request: any, reply: any) => {
    if (!mockAdminUser) {
      return reply.code(401).send({
        success: false,
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
      });
    }
    request.adminUser = mockAdminUser;
  },
}));

describe('AI Campaign Controller', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();
    mockAdminUser = null;

    // Create fresh Fastify instance
    app = Fastify();
    await registerAiCampaignRoutes(app, '/api/v1');
  });

  describe('GET /api/v1/ai-campaign/status (Public)', () => {
    it('should return campaign status when active campaign exists', async () => {
      const mockStatus: CampaignStatusResponse = {
        active: true,
        slotsRemaining: 550,
        totalSlots: 1000,
        percentRemaining: 55,
        urgencyLevel: 'normal',
        message: 'AI-powered analysis available',
      };

      vi.mocked(aiCampaignService.getCampaignStatus).mockResolvedValue(mockStatus);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/ai-campaign/status',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data).toEqual(mockStatus);
      expect(json.data.active).toBe(true);
      expect(json.data.slotsRemaining).toBe(550);
    });

    it('should return null when no active campaign', async () => {
      vi.mocked(aiCampaignService.getCampaignStatus).mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/ai-campaign/status',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data).toBeNull();
    });

    it('should return urgency levels correctly', async () => {
      // Test final urgency (≤5%)
      const mockFinalStatus: CampaignStatusResponse = {
        active: true,
        slotsRemaining: 30,
        totalSlots: 1000,
        percentRemaining: 3,
        urgencyLevel: 'final',
        message: 'Final slots available!',
      };

      vi.mocked(aiCampaignService.getCampaignStatus).mockResolvedValue(mockFinalStatus);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/ai-campaign/status',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.urgencyLevel).toBe('final');
      expect(json.data.percentRemaining).toBe(3);
    });

    it('should handle service errors gracefully', async () => {
      vi.mocked(aiCampaignService.getCampaignStatus).mockRejectedValue(
        new aiCampaignService.AiCampaignServiceError(
          'Failed to get campaign status',
          'GET_STATUS_FAILED'
        )
      );

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/ai-campaign/status',
      });

      expect(response.statusCode).toBe(500);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('GET_STATUS_FAILED');
    });

    it('should handle unexpected errors', async () => {
      vi.mocked(aiCampaignService.getCampaignStatus).mockRejectedValue(
        new Error('Unexpected database error')
      );

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/ai-campaign/status',
      });

      expect(response.statusCode).toBe(500);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('GET /api/v1/admin/ai-campaign (Admin)', () => {
    it('should require admin authentication', async () => {
      // No admin user set
      mockAdminUser = null;

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/ai-campaign',
      });

      expect(response.statusCode).toBe(401);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('UNAUTHORIZED');
    });

    it('should return campaign metrics for admin', async () => {
      mockAdminUser = { id: 'admin-123', email: 'admin@test.com', role: 'ADMIN' };

      const mockMetrics: CampaignMetrics = {
        totalTokenBudget: 100000,
        usedTokens: 45000,
        remainingTokens: 55000,
        percentUsed: 45,
        reservedSlots: 500,
        completedScans: 450,
        failedScans: 10,
        pendingScans: 40,
        avgTokensPerScan: 100,
        projectedSlotsRemaining: 550,
        campaignStatus: 'ACTIVE',
        startsAt: new Date('2025-01-01T00:00:00.000Z'),
        endsAt: new Date('2025-02-01T00:00:00.000Z'),
      };

      vi.mocked(aiCampaignService.getCampaignMetrics).mockResolvedValue(mockMetrics);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/ai-campaign',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.totalTokenBudget).toBe(100000);
      expect(json.data.usedTokens).toBe(45000);
      expect(json.data.campaignStatus).toBe('ACTIVE');
    });

    it('should return null when no active campaign for admin', async () => {
      mockAdminUser = { id: 'admin-123', email: 'admin@test.com', role: 'ADMIN' };

      vi.mocked(aiCampaignService.getCampaignMetrics).mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/ai-campaign',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data).toBeNull();
    });

    it('should handle service errors for admin endpoint', async () => {
      mockAdminUser = { id: 'admin-123', email: 'admin@test.com', role: 'ADMIN' };

      vi.mocked(aiCampaignService.getCampaignMetrics).mockRejectedValue(
        new aiCampaignService.AiCampaignServiceError(
          'Failed to get metrics',
          'GET_METRICS_FAILED'
        )
      );

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/ai-campaign',
      });

      expect(response.statusCode).toBe(500);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('GET_METRICS_FAILED');
    });
  });

  describe('PATCH /api/v1/admin/ai-campaign (Admin)', () => {
    const mockCampaign = {
      id: 'campaign-123',
      name: 'Early Bird 2025',
      status: 'ACTIVE' as const,
      totalTokenBudget: 100000,
      usedTokens: 45000,
      avgTokensPerScan: 100,
      startsAt: new Date('2025-01-01T00:00:00.000Z'),
      endsAt: new Date('2025-02-01T00:00:00.000Z'),
      createdAt: new Date('2024-12-15T00:00:00.000Z'),
      updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    };

    it('should require admin authentication for update', async () => {
      mockAdminUser = null;

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/admin/ai-campaign',
        payload: { status: 'PAUSED' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should update campaign status successfully', async () => {
      mockAdminUser = { id: 'admin-123', email: 'admin@test.com', role: 'ADMIN' };

      const mockMetrics: CampaignMetrics = {
        totalTokenBudget: 100000,
        usedTokens: 45000,
        remainingTokens: 55000,
        percentUsed: 45,
        reservedSlots: 500,
        completedScans: 450,
        failedScans: 10,
        pendingScans: 40,
        avgTokensPerScan: 100,
        projectedSlotsRemaining: 550,
        campaignStatus: 'ACTIVE',
        startsAt: new Date(),
        endsAt: new Date(),
      };

      vi.mocked(aiCampaignService.getCampaignMetrics).mockResolvedValue(mockMetrics);
      vi.mocked(aiCampaignRepository.getActiveCampaign).mockResolvedValue(mockCampaign);
      vi.mocked(aiCampaignService.updateCampaign).mockResolvedValue({
        ...mockCampaign,
        status: 'PAUSED',
        updatedAt: new Date(),
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/admin/ai-campaign',
        payload: { status: 'PAUSED' },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe('PAUSED');
    });

    it('should validate update body - empty body', async () => {
      mockAdminUser = { id: 'admin-123', email: 'admin@test.com', role: 'ADMIN' };

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/admin/ai-campaign',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('VALIDATION_ERROR');
    });

    it('should validate update body - invalid status', async () => {
      mockAdminUser = { id: 'admin-123', email: 'admin@test.com', role: 'ADMIN' };

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/admin/ai-campaign',
        payload: { status: 'INVALID_STATUS' },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 when no active campaign', async () => {
      mockAdminUser = { id: 'admin-123', email: 'admin@test.com', role: 'ADMIN' };

      vi.mocked(aiCampaignService.getCampaignMetrics).mockResolvedValue(null);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/admin/ai-campaign',
        payload: { status: 'PAUSED' },
      });

      expect(response.statusCode).toBe(404);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/v1/admin/ai-campaign/pause (Admin)', () => {
    const mockCampaign = {
      id: 'campaign-123',
      name: 'Early Bird 2025',
      status: 'ACTIVE' as const,
      totalTokenBudget: 100000,
      usedTokens: 45000,
      avgTokensPerScan: 100,
      startsAt: new Date('2025-01-01T00:00:00.000Z'),
      endsAt: new Date('2025-02-01T00:00:00.000Z'),
      createdAt: new Date('2024-12-15T00:00:00.000Z'),
      updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    };

    it('should require admin authentication for pause', async () => {
      mockAdminUser = null;

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/ai-campaign/pause',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should pause active campaign successfully', async () => {
      mockAdminUser = { id: 'admin-123', email: 'admin@test.com', role: 'ADMIN' };

      vi.mocked(aiCampaignRepository.getActiveCampaign).mockResolvedValue(mockCampaign);
      vi.mocked(aiCampaignService.updateCampaign).mockResolvedValue({
        ...mockCampaign,
        status: 'PAUSED',
        updatedAt: new Date(),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/ai-campaign/pause',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe('PAUSED');
      expect(json.data.message).toBe('Campaign paused successfully');

      expect(aiCampaignService.updateCampaign).toHaveBeenCalledWith(
        'campaign-123',
        { status: 'PAUSED' },
        'admin-123'
      );
    });

    it('should return 404 when no active campaign', async () => {
      mockAdminUser = { id: 'admin-123', email: 'admin@test.com', role: 'ADMIN' };

      vi.mocked(aiCampaignRepository.getActiveCampaign).mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/ai-campaign/pause',
      });

      expect(response.statusCode).toBe(404);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('NOT_FOUND');
    });

    it('should return 400 when campaign already paused', async () => {
      mockAdminUser = { id: 'admin-123', email: 'admin@test.com', role: 'ADMIN' };

      vi.mocked(aiCampaignRepository.getActiveCampaign).mockResolvedValue({
        ...mockCampaign,
        status: 'PAUSED',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/ai-campaign/pause',
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('INVALID_STATE');
      expect(json.error).toBe('Campaign is already paused');
    });
  });

  describe('POST /api/v1/admin/ai-campaign/resume (Admin)', () => {
    const mockCampaign = {
      id: 'campaign-123',
      name: 'Early Bird 2025',
      status: 'PAUSED' as const,
      totalTokenBudget: 100000,
      usedTokens: 45000,
      avgTokensPerScan: 100,
      startsAt: new Date('2025-01-01T00:00:00.000Z'),
      endsAt: new Date('2025-02-01T00:00:00.000Z'),
      createdAt: new Date('2024-12-15T00:00:00.000Z'),
      updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    };

    it('should require admin authentication for resume', async () => {
      mockAdminUser = null;

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/ai-campaign/resume',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should resume paused campaign successfully', async () => {
      mockAdminUser = { id: 'admin-123', email: 'admin@test.com', role: 'ADMIN' };

      vi.mocked(aiCampaignRepository.getActiveCampaign).mockResolvedValue(mockCampaign);
      vi.mocked(aiCampaignService.updateCampaign).mockResolvedValue({
        ...mockCampaign,
        status: 'ACTIVE',
        updatedAt: new Date(),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/ai-campaign/resume',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe('ACTIVE');
      expect(json.data.message).toBe('Campaign resumed successfully');

      expect(aiCampaignService.updateCampaign).toHaveBeenCalledWith(
        'campaign-123',
        { status: 'ACTIVE' },
        'admin-123'
      );
    });

    it('should return 404 when no campaign found', async () => {
      mockAdminUser = { id: 'admin-123', email: 'admin@test.com', role: 'ADMIN' };

      vi.mocked(aiCampaignRepository.getActiveCampaign).mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/ai-campaign/resume',
      });

      expect(response.statusCode).toBe(404);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('NOT_FOUND');
    });

    it('should return 400 when campaign already active', async () => {
      mockAdminUser = { id: 'admin-123', email: 'admin@test.com', role: 'ADMIN' };

      vi.mocked(aiCampaignRepository.getActiveCampaign).mockResolvedValue({
        ...mockCampaign,
        status: 'ACTIVE',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/ai-campaign/resume',
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('INVALID_STATE');
      expect(json.error).toBe('Campaign is already active');
    });

    it('should return 400 when trying to resume depleted campaign', async () => {
      mockAdminUser = { id: 'admin-123', email: 'admin@test.com', role: 'ADMIN' };

      vi.mocked(aiCampaignRepository.getActiveCampaign).mockResolvedValue({
        ...mockCampaign,
        status: 'DEPLETED',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/ai-campaign/resume',
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('INVALID_STATE');
      expect(json.error).toBe('Cannot resume depleted campaign');
    });

    it('should return 400 when trying to resume ended campaign', async () => {
      mockAdminUser = { id: 'admin-123', email: 'admin@test.com', role: 'ADMIN' };

      vi.mocked(aiCampaignRepository.getActiveCampaign).mockResolvedValue({
        ...mockCampaign,
        status: 'ENDED',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/ai-campaign/resume',
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('INVALID_STATE');
      expect(json.error).toBe('Cannot resume ended campaign');
    });
  });

  describe('Error Handling', () => {
    it('should map service errors to correct status codes', async () => {
      mockAdminUser = { id: 'admin-123', email: 'admin@test.com', role: 'ADMIN' };

      // Test NOT_FOUND error code
      vi.mocked(aiCampaignService.getCampaignMetrics).mockRejectedValue(
        new aiCampaignService.AiCampaignServiceError(
          'Campaign not found',
          'NOT_FOUND'
        )
      );

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/ai-campaign',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should handle repository errors', async () => {
      mockAdminUser = { id: 'admin-123', email: 'admin@test.com', role: 'ADMIN' };

      vi.mocked(aiCampaignRepository.getActiveCampaign).mockRejectedValue(
        new aiCampaignRepository.AiCampaignRepositoryError(
          'Database error',
          'UPDATE_FAILED'
        )
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/ai-campaign/pause',
      });

      expect(response.statusCode).toBe(500);
      const json = response.json();
      expect(json.code).toBe('UPDATE_FAILED');
    });
  });

  describe('Route Registration', () => {
    it('should register all expected routes', async () => {
      const routes = app.printRoutes();

      // Verify public route is registered
      expect(routes).toContain('/api/v1/ai-campaign/status');

      // Verify admin routes are registered
      expect(routes).toContain('/api/v1/admin/ai-campaign');
      expect(routes).toContain('/api/v1/admin/ai-campaign/pause');
      expect(routes).toContain('/api/v1/admin/ai-campaign/resume');
    });
  });
});

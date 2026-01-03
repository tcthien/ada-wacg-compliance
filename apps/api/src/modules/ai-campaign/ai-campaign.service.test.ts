/**
 * AI Campaign Service Unit Tests
 *
 * Tests for AI Campaign business logic layer:
 * - Campaign status with cache hit/miss scenarios
 * - Atomic slot reservation with available/depleted slots
 * - Slot release restores slot count
 * - Token deduction updates DB and invalidates cache
 * - Urgency level calculation
 *
 * Requirements: REQ-3 (Campaign Quota Management)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AiCampaign, AiCampaignStatus } from '@prisma/client';

// Mock dependencies before imports
vi.mock('../../config/database.js');
vi.mock('../../config/redis.js');
vi.mock('./ai-campaign.repository.js');

// Now safe to import
import {
  getCampaignStatus,
  checkAndReserveSlotAtomic,
  releaseSlot,
  deductTokens,
  reserveSlot,
  getCampaignMetrics,
  updateCampaign,
  AiCampaignServiceError,
} from './ai-campaign.service.js';
import { getPrismaClient } from '../../config/database.js';
import { getRedisClient } from '../../config/redis.js';
import * as repository from './ai-campaign.repository.js';
import type { CampaignStatusResponse, CampaignMetrics } from './ai-campaign.types.js';

describe('AI Campaign Service', () => {
  let mockPrismaClient: any;
  let mockRedisClient: any;

  // Sample campaign data
  const mockCampaign: AiCampaign = {
    id: 'campaign-123',
    name: 'Early Bird Campaign',
    totalTokenBudget: 100000,
    usedTokens: 45000,
    reservedSlots: 0,
    avgTokensPerScan: 100,
    status: 'ACTIVE' as AiCampaignStatus,
    startsAt: new Date('2025-01-01T00:00:00.000Z'),
    endsAt: new Date('2025-03-31T23:59:59.999Z'),
    createdAt: new Date('2024-12-15T00:00:00.000Z'),
    updatedAt: new Date('2025-01-15T00:00:00.000Z'),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup Prisma mock
    mockPrismaClient = {
      aiCampaign: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      aiCampaignAudit: {
        create: vi.fn(),
      },
      scan: {
        count: vi.fn(),
      },
    };
    vi.mocked(getPrismaClient).mockReturnValue(mockPrismaClient);

    // Setup Redis mock
    mockRedisClient = {
      get: vi.fn(),
      set: vi.fn(),
      setex: vi.fn(),
      del: vi.fn(),
      exists: vi.fn(),
      incr: vi.fn(),
      decr: vi.fn(),
      eval: vi.fn(),
    };
    vi.mocked(getRedisClient).mockReturnValue(mockRedisClient);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // GET CAMPAIGN STATUS TESTS
  // ============================================================================

  describe('getCampaignStatus', () => {
    it('should return cached status on cache hit', async () => {
      // Arrange
      const cachedStatus: CampaignStatusResponse = {
        active: true,
        slotsRemaining: 550,
        totalSlots: 1000,
        percentRemaining: 55,
        urgencyLevel: 'normal',
        message: '550 slots remaining',
      };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedStatus));

      // Act
      const result = await getCampaignStatus();

      // Assert
      expect(result).toEqual(cachedStatus);
      expect(mockRedisClient.get).toHaveBeenCalledWith('ai_campaign:status');
      // Should NOT call database on cache hit
      expect(repository.getActiveCampaign).not.toHaveBeenCalled();
    });

    it('should query database and cache on cache miss', async () => {
      // Arrange
      mockRedisClient.get.mockResolvedValue(null); // Cache miss
      vi.mocked(repository.getActiveCampaign).mockResolvedValue(mockCampaign);
      mockRedisClient.setex.mockResolvedValue('OK');

      // Act
      const result = await getCampaignStatus();

      // Assert
      expect(result).not.toBeNull();
      expect(result!.active).toBe(true);
      expect(result!.slotsRemaining).toBe(550); // (100000-45000)/100
      expect(result!.totalSlots).toBe(1000); // 100000/100
      expect(result!.percentRemaining).toBe(55);
      expect(result!.urgencyLevel).toBe('normal');

      // Verify cache was set
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'ai_campaign:status',
        300, // 5 minutes TTL
        expect.any(String)
      );

      // Verify repository was called
      expect(repository.getActiveCampaign).toHaveBeenCalled();
    });

    it('should return null when no active campaign', async () => {
      // Arrange
      mockRedisClient.get.mockResolvedValue(null);
      vi.mocked(repository.getActiveCampaign).mockResolvedValue(null);

      // Act
      const result = await getCampaignStatus();

      // Assert
      expect(result).toBeNull();
      expect(mockRedisClient.setex).not.toHaveBeenCalled();
    });

    it('should handle cache read errors gracefully', async () => {
      // Arrange
      mockRedisClient.get.mockRejectedValue(new Error('Redis connection error'));
      vi.mocked(repository.getActiveCampaign).mockResolvedValue(mockCampaign);
      mockRedisClient.setex.mockResolvedValue('OK');

      // Act - should not throw, falls back to database
      const result = await getCampaignStatus();

      // Assert
      expect(result).not.toBeNull();
      expect(result!.active).toBe(true);
    });

    it('should handle cache write errors gracefully', async () => {
      // Arrange
      mockRedisClient.get.mockResolvedValue(null);
      vi.mocked(repository.getActiveCampaign).mockResolvedValue(mockCampaign);
      mockRedisClient.setex.mockRejectedValue(new Error('Redis write error'));

      // Act - should not throw
      const result = await getCampaignStatus();

      // Assert
      expect(result).not.toBeNull();
      expect(result!.active).toBe(true);
    });

    it('should calculate urgency levels correctly', async () => {
      // Test each urgency level
      const testCases = [
        { percentRemaining: 25, expected: 'normal' },
        { percentRemaining: 15, expected: 'limited' },
        { percentRemaining: 7, expected: 'almost_gone' },
        { percentRemaining: 3, expected: 'final' },
        { percentRemaining: 0, expected: 'depleted' },
      ];

      for (const { percentRemaining, expected } of testCases) {
        // Calculate tokens to achieve desired percentage
        const totalSlots = 1000;
        const slotsRemaining = Math.floor(totalSlots * (percentRemaining / 100));
        const usedTokens = mockCampaign.totalTokenBudget - (slotsRemaining * mockCampaign.avgTokensPerScan);

        const testCampaign = {
          ...mockCampaign,
          usedTokens,
        };

        mockRedisClient.get.mockResolvedValue(null);
        vi.mocked(repository.getActiveCampaign).mockResolvedValue(testCampaign);
        mockRedisClient.setex.mockResolvedValue('OK');

        const result = await getCampaignStatus();

        expect(result!.urgencyLevel).toBe(expected);
        vi.clearAllMocks();
      }
    });

    it('should set active=false when quota is depleted', async () => {
      // Arrange - all tokens used
      const depletedCampaign = {
        ...mockCampaign,
        usedTokens: 100000, // All tokens used
      };

      mockRedisClient.get.mockResolvedValue(null);
      vi.mocked(repository.getActiveCampaign).mockResolvedValue(depletedCampaign);
      mockRedisClient.setex.mockResolvedValue('OK');

      // Act
      const result = await getCampaignStatus();

      // Assert
      expect(result!.active).toBe(false);
      expect(result!.slotsRemaining).toBe(0);
      expect(result!.urgencyLevel).toBe('depleted');
    });
  });

  // ============================================================================
  // CHECK AND RESERVE SLOT ATOMIC TESTS
  // ============================================================================

  describe('checkAndReserveSlotAtomic', () => {
    const scanId = 'scan-123';

    it('should reserve slot when slots are available', async () => {
      // Arrange
      mockRedisClient.exists.mockResolvedValue(1); // Slot counter exists
      mockRedisClient.eval.mockResolvedValue([1, 549]); // Reserved, 549 remaining
      mockRedisClient.setex.mockResolvedValue('OK');

      // Act
      const result = await checkAndReserveSlotAtomic(scanId);

      // Assert
      expect(result.reserved).toBe(true);
      expect(result.slotsRemaining).toBe(549);
      expect(result.reason).toBe('success');

      // Verify scan reservation was tracked
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        `ai:campaign:slot:${scanId}`,
        1800, // 30 minute TTL
        '1'
      );
    });

    it('should fail when no slots available', async () => {
      // Arrange
      mockRedisClient.exists.mockResolvedValue(1);
      mockRedisClient.eval.mockResolvedValue([0, 0]); // Not reserved, 0 remaining

      // Act
      const result = await checkAndReserveSlotAtomic(scanId);

      // Assert
      expect(result.reserved).toBe(false);
      expect(result.slotsRemaining).toBe(0);
      expect(result.reason).toBe('quota_depleted');

      // Should NOT set reservation key
      expect(mockRedisClient.setex).not.toHaveBeenCalled();
    });

    it('should initialize Redis slots from database on cache miss', async () => {
      // Arrange
      mockRedisClient.exists.mockResolvedValue(0); // Slot counter doesn't exist
      vi.mocked(repository.getActiveCampaign).mockResolvedValue(mockCampaign);
      mockRedisClient.set.mockResolvedValue('OK');
      mockRedisClient.eval.mockResolvedValue([1, 549]);
      mockRedisClient.setex.mockResolvedValue('OK');

      // Act
      const result = await checkAndReserveSlotAtomic(scanId);

      // Assert
      expect(result.reserved).toBe(true);

      // Verify slots were initialized from database
      expect(repository.getActiveCampaign).toHaveBeenCalled();
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'ai:campaign:slots:available',
        '550' // (100000-45000)/100
      );
    });

    it('should fail when no active campaign for initialization', async () => {
      // Arrange
      mockRedisClient.exists.mockResolvedValue(0);
      vi.mocked(repository.getActiveCampaign).mockResolvedValue(null);

      // Act
      const result = await checkAndReserveSlotAtomic(scanId);

      // Assert
      expect(result.reserved).toBe(false);
      expect(result.reason).toBe('campaign_inactive');
    });

    it('should throw error for invalid scan ID', async () => {
      // Act & Assert
      await expect(checkAndReserveSlotAtomic('')).rejects.toThrow(AiCampaignServiceError);
      await expect(checkAndReserveSlotAtomic('')).rejects.toMatchObject({
        code: 'INVALID_INPUT',
      });
    });
  });

  // ============================================================================
  // RELEASE SLOT TESTS
  // ============================================================================

  describe('releaseSlot', () => {
    const scanId = 'scan-123';

    it('should release slot and increment counter', async () => {
      // Arrange
      mockRedisClient.exists.mockResolvedValue(1); // Reservation exists
      mockRedisClient.del.mockResolvedValue(1);
      mockRedisClient.incr.mockResolvedValue(551);

      // Act
      const result = await releaseSlot(scanId);

      // Assert
      expect(result).toBe(true);

      // Verify reservation was deleted
      expect(mockRedisClient.del).toHaveBeenCalledWith(`ai:campaign:slot:${scanId}`);

      // Verify slot counter was incremented
      expect(mockRedisClient.incr).toHaveBeenCalledWith('ai:campaign:slots:available');

      // Verify status cache was invalidated
      expect(mockRedisClient.del).toHaveBeenCalledWith('ai_campaign:status');
    });

    it('should return false when no reservation found', async () => {
      // Arrange
      mockRedisClient.exists.mockResolvedValue(0); // No reservation

      // Act
      const result = await releaseSlot(scanId);

      // Assert
      expect(result).toBe(false);

      // Should NOT modify counters
      expect(mockRedisClient.del).not.toHaveBeenCalled();
      expect(mockRedisClient.incr).not.toHaveBeenCalled();
    });

    it('should throw error for invalid scan ID', async () => {
      // Act & Assert
      await expect(releaseSlot('')).rejects.toThrow(AiCampaignServiceError);
      await expect(releaseSlot('')).rejects.toMatchObject({
        code: 'INVALID_INPUT',
      });
    });
  });

  // ============================================================================
  // DEDUCT TOKENS TESTS
  // ============================================================================

  describe('deductTokens', () => {
    const scanId = 'scan-123';
    const tokensUsed = 150;

    it('should deduct tokens and invalidate cache', async () => {
      // Arrange
      const updatedCampaign = {
        ...mockCampaign,
        usedTokens: mockCampaign.usedTokens + tokensUsed,
      };

      vi.mocked(repository.getActiveCampaign).mockResolvedValue(mockCampaign);
      vi.mocked(repository.updateCampaignTokens).mockResolvedValue(updatedCampaign);
      mockRedisClient.del.mockResolvedValue(1);
      mockRedisClient.exists.mockResolvedValue(1);
      mockRedisClient.set.mockResolvedValue('OK');

      // Act
      const result = await deductTokens(scanId, tokensUsed);

      // Assert
      expect(result.usedTokens).toBe(mockCampaign.usedTokens + tokensUsed);

      // Verify repository was called
      expect(repository.updateCampaignTokens).toHaveBeenCalledWith(
        mockCampaign.id,
        tokensUsed
      );

      // Verify status cache was invalidated
      expect(mockRedisClient.del).toHaveBeenCalledWith('ai_campaign:status');

      // Verify slot counter was updated
      expect(mockRedisClient.set).toHaveBeenCalled();
    });

    it('should throw error when no active campaign', async () => {
      // Arrange
      vi.mocked(repository.getActiveCampaign).mockResolvedValue(null);

      // Act & Assert
      await expect(deductTokens(scanId, tokensUsed)).rejects.toThrow(AiCampaignServiceError);
      await expect(deductTokens(scanId, tokensUsed)).rejects.toMatchObject({
        code: 'CAMPAIGN_NOT_FOUND',
      });
    });

    it('should throw error for invalid scan ID', async () => {
      // Act & Assert
      await expect(deductTokens('', tokensUsed)).rejects.toThrow(AiCampaignServiceError);
      await expect(deductTokens('', tokensUsed)).rejects.toMatchObject({
        code: 'INVALID_INPUT',
      });
    });

    it('should throw error for invalid tokens', async () => {
      // Act & Assert
      await expect(deductTokens(scanId, 0)).rejects.toThrow(AiCampaignServiceError);
      await expect(deductTokens(scanId, -50)).rejects.toThrow(AiCampaignServiceError);
    });

    it('should handle cache invalidation errors gracefully', async () => {
      // Arrange
      const updatedCampaign = {
        ...mockCampaign,
        usedTokens: mockCampaign.usedTokens + tokensUsed,
      };

      vi.mocked(repository.getActiveCampaign).mockResolvedValue(mockCampaign);
      vi.mocked(repository.updateCampaignTokens).mockResolvedValue(updatedCampaign);
      mockRedisClient.del.mockRejectedValue(new Error('Redis error'));

      // Act - should not throw
      const result = await deductTokens(scanId, tokensUsed);

      // Assert
      expect(result.usedTokens).toBe(mockCampaign.usedTokens + tokensUsed);
    });
  });

  // ============================================================================
  // RESERVE SLOT (NON-ATOMIC) TESTS
  // ============================================================================

  describe('reserveSlot', () => {
    it('should reserve slot when tokens available', async () => {
      // Arrange
      const tokensToReserve = 100;
      const updatedCampaign = {
        ...mockCampaign,
        usedTokens: mockCampaign.usedTokens + tokensToReserve,
      };

      vi.mocked(repository.getActiveCampaign).mockResolvedValue(mockCampaign);
      vi.mocked(repository.updateCampaignTokens).mockResolvedValue(updatedCampaign);
      mockRedisClient.del.mockResolvedValue(1);

      // Act
      const result = await reserveSlot(tokensToReserve);

      // Assert
      expect(result.reserved).toBe(true);
      expect(result.reason).toBe('success');
      expect(result.slotsRemaining).toBe(549); // (100000-45100)/100
    });

    it('should fail when quota depleted', async () => {
      // Arrange - only 50 tokens remaining
      const depletedCampaign = {
        ...mockCampaign,
        usedTokens: 99950, // Only 50 tokens left
      };

      vi.mocked(repository.getActiveCampaign).mockResolvedValue(depletedCampaign);

      // Act
      const result = await reserveSlot(100); // Request 100, but only 50 available

      // Assert
      expect(result.reserved).toBe(false);
      expect(result.reason).toBe('quota_depleted');
      expect(result.slotsRemaining).toBe(0);

      // Should NOT update tokens
      expect(repository.updateCampaignTokens).not.toHaveBeenCalled();
    });

    it('should fail when no active campaign', async () => {
      // Arrange
      vi.mocked(repository.getActiveCampaign).mockResolvedValue(null);

      // Act
      const result = await reserveSlot(100);

      // Assert
      expect(result.reserved).toBe(false);
      expect(result.reason).toBe('campaign_inactive');
    });

    it('should throw error for invalid tokens', async () => {
      // Act & Assert
      await expect(reserveSlot(0)).rejects.toThrow(AiCampaignServiceError);
      await expect(reserveSlot(-50)).rejects.toThrow(AiCampaignServiceError);
    });
  });

  // ============================================================================
  // GET CAMPAIGN METRICS TESTS
  // ============================================================================

  describe('getCampaignMetrics', () => {
    it('should return comprehensive metrics', async () => {
      // Arrange
      vi.mocked(repository.getActiveCampaign).mockResolvedValue(mockCampaign);
      mockPrismaClient.scan.count
        .mockResolvedValueOnce(100) // completed
        .mockResolvedValueOnce(5)   // failed
        .mockResolvedValueOnce(10); // pending
      mockRedisClient.exists.mockResolvedValue(1);
      mockRedisClient.get.mockResolvedValue('540');

      // Act
      const result = await getCampaignMetrics();

      // Assert
      expect(result).not.toBeNull();
      expect(result!.totalTokenBudget).toBe(100000);
      expect(result!.usedTokens).toBe(45000);
      expect(result!.remainingTokens).toBe(55000);
      expect(result!.percentUsed).toBe(45);
      expect(result!.completedScans).toBe(100);
      expect(result!.failedScans).toBe(5);
      expect(result!.pendingScans).toBe(10);
      expect(result!.avgTokensPerScan).toBe(100);
      expect(result!.projectedSlotsRemaining).toBe(550);
      expect(result!.campaignStatus).toBe('ACTIVE');
    });

    it('should return null when no active campaign', async () => {
      // Arrange
      vi.mocked(repository.getActiveCampaign).mockResolvedValue(null);

      // Act
      const result = await getCampaignMetrics();

      // Assert
      expect(result).toBeNull();
    });

    it('should handle Redis errors gracefully', async () => {
      // Arrange
      vi.mocked(repository.getActiveCampaign).mockResolvedValue(mockCampaign);
      mockPrismaClient.scan.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(10);
      mockRedisClient.exists.mockRejectedValue(new Error('Redis error'));

      // Act - should not throw
      const result = await getCampaignMetrics();

      // Assert
      expect(result).not.toBeNull();
      expect(result!.reservedSlots).toBe(0); // Falls back to 0
    });
  });

  // ============================================================================
  // UPDATE CAMPAIGN TESTS
  // ============================================================================

  describe('updateCampaign', () => {
    const campaignId = 'campaign-123';
    const adminId = 'admin-456';

    it('should update campaign and create audit log', async () => {
      // Arrange
      const updateData = { status: 'PAUSED' as AiCampaignStatus };
      const updatedCampaign = { ...mockCampaign, status: 'PAUSED' as AiCampaignStatus };

      vi.mocked(repository.getCampaignById).mockResolvedValue(mockCampaign);
      mockPrismaClient.aiCampaign.update.mockResolvedValue(updatedCampaign);
      vi.mocked(repository.createAuditLog).mockResolvedValue({
        id: 'audit-123',
        campaignId,
        action: 'CAMPAIGN_UPDATED',
        details: {},
        adminId,
        createdAt: new Date(),
      });
      mockRedisClient.del.mockResolvedValue(1);

      // Act
      const result = await updateCampaign(campaignId, updateData, adminId);

      // Assert
      expect(result.status).toBe('PAUSED');
      expect(mockPrismaClient.aiCampaign.update).toHaveBeenCalled();
      expect(repository.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          campaignId,
          action: 'CAMPAIGN_UPDATED',
          adminId,
        })
      );

      // Verify cache was invalidated
      expect(mockRedisClient.del).toHaveBeenCalledWith('ai_campaign:status');
    });

    it('should throw error when campaign not found', async () => {
      // Arrange
      vi.mocked(repository.getCampaignById).mockResolvedValue(null);

      // Act & Assert
      await expect(
        updateCampaign(campaignId, { status: 'PAUSED' as AiCampaignStatus }, adminId)
      ).rejects.toThrow(AiCampaignServiceError);

      await expect(
        updateCampaign(campaignId, { status: 'PAUSED' as AiCampaignStatus }, adminId)
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('should return existing campaign when no changes', async () => {
      // Arrange
      vi.mocked(repository.getCampaignById).mockResolvedValue(mockCampaign);

      // Act
      const result = await updateCampaign(campaignId, {}, adminId);

      // Assert
      expect(result).toEqual(mockCampaign);
      expect(mockPrismaClient.aiCampaign.update).not.toHaveBeenCalled();
      expect(repository.createAuditLog).not.toHaveBeenCalled();
    });

    it('should validate totalTokenBudget is non-negative', async () => {
      // Arrange
      vi.mocked(repository.getCampaignById).mockResolvedValue(mockCampaign);

      // Act & Assert
      await expect(
        updateCampaign(campaignId, { totalTokenBudget: -1000 }, adminId)
      ).rejects.toThrow(AiCampaignServiceError);

      await expect(
        updateCampaign(campaignId, { totalTokenBudget: -1000 }, adminId)
      ).rejects.toMatchObject({
        code: 'INVALID_INPUT',
      });
    });

    it('should validate avgTokensPerScan is positive', async () => {
      // Arrange
      vi.mocked(repository.getCampaignById).mockResolvedValue(mockCampaign);

      // Act & Assert
      await expect(
        updateCampaign(campaignId, { avgTokensPerScan: 0 }, adminId)
      ).rejects.toThrow(AiCampaignServiceError);

      await expect(
        updateCampaign(campaignId, { avgTokensPerScan: -50 }, adminId)
      ).rejects.toMatchObject({
        code: 'INVALID_INPUT',
      });
    });

    it('should update Redis slot counter when budget changes', async () => {
      // Arrange
      const updateData = { totalTokenBudget: 200000 };
      const updatedCampaign = { ...mockCampaign, totalTokenBudget: 200000 };

      vi.mocked(repository.getCampaignById).mockResolvedValue(mockCampaign);
      mockPrismaClient.aiCampaign.update.mockResolvedValue(updatedCampaign);
      vi.mocked(repository.createAuditLog).mockResolvedValue({
        id: 'audit-123',
        campaignId,
        action: 'CAMPAIGN_UPDATED',
        details: {},
        adminId,
        createdAt: new Date(),
      });
      mockRedisClient.del.mockResolvedValue(1);
      mockRedisClient.set.mockResolvedValue('OK');

      // Act
      await updateCampaign(campaignId, updateData, adminId);

      // Assert - slot counter should be updated
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'ai:campaign:slots:available',
        expect.any(String)
      );
    });
  });

  // ============================================================================
  // URGENCY LEVEL CALCULATION TESTS
  // ============================================================================

  describe('urgency level calculation', () => {
    it('should return normal for >20% remaining', async () => {
      const campaign = { ...mockCampaign, usedTokens: 70000 }; // 30% remaining
      mockRedisClient.get.mockResolvedValue(null);
      vi.mocked(repository.getActiveCampaign).mockResolvedValue(campaign);
      mockRedisClient.setex.mockResolvedValue('OK');

      const result = await getCampaignStatus();
      expect(result!.urgencyLevel).toBe('normal');
    });

    it('should return limited for 10-20% remaining', async () => {
      const campaign = { ...mockCampaign, usedTokens: 85000 }; // 15% remaining
      mockRedisClient.get.mockResolvedValue(null);
      vi.mocked(repository.getActiveCampaign).mockResolvedValue(campaign);
      mockRedisClient.setex.mockResolvedValue('OK');

      const result = await getCampaignStatus();
      expect(result!.urgencyLevel).toBe('limited');
    });

    it('should return almost_gone for 5-10% remaining', async () => {
      const campaign = { ...mockCampaign, usedTokens: 93000 }; // 7% remaining
      mockRedisClient.get.mockResolvedValue(null);
      vi.mocked(repository.getActiveCampaign).mockResolvedValue(campaign);
      mockRedisClient.setex.mockResolvedValue('OK');

      const result = await getCampaignStatus();
      expect(result!.urgencyLevel).toBe('almost_gone');
    });

    it('should return final for <5% remaining', async () => {
      const campaign = { ...mockCampaign, usedTokens: 97000 }; // 3% remaining
      mockRedisClient.get.mockResolvedValue(null);
      vi.mocked(repository.getActiveCampaign).mockResolvedValue(campaign);
      mockRedisClient.setex.mockResolvedValue('OK');

      const result = await getCampaignStatus();
      expect(result!.urgencyLevel).toBe('final');
    });

    it('should return depleted for 0% remaining', async () => {
      const campaign = { ...mockCampaign, usedTokens: 100000 }; // 0% remaining
      mockRedisClient.get.mockResolvedValue(null);
      vi.mocked(repository.getActiveCampaign).mockResolvedValue(campaign);
      mockRedisClient.setex.mockResolvedValue('OK');

      const result = await getCampaignStatus();
      expect(result!.urgencyLevel).toBe('depleted');
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('edge cases', () => {
    it('should handle zero avgTokensPerScan gracefully', async () => {
      const campaign = { ...mockCampaign, avgTokensPerScan: 0 };
      mockRedisClient.get.mockResolvedValue(null);
      vi.mocked(repository.getActiveCampaign).mockResolvedValue(campaign);
      mockRedisClient.setex.mockResolvedValue('OK');

      const result = await getCampaignStatus();

      // Should return 0 slots to prevent division by zero
      expect(result!.slotsRemaining).toBe(0);
    });

    it('should handle negative remaining tokens', async () => {
      // Edge case: usedTokens exceeds totalTokenBudget (should never happen, but be safe)
      const campaign = { ...mockCampaign, usedTokens: 150000 };
      mockRedisClient.get.mockResolvedValue(null);
      vi.mocked(repository.getActiveCampaign).mockResolvedValue(campaign);
      mockRedisClient.setex.mockResolvedValue('OK');

      const result = await getCampaignStatus();

      // Should return 0 slots (never negative)
      expect(result!.slotsRemaining).toBe(0);
      expect(result!.active).toBe(false);
    });
  });
});

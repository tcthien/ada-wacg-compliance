/**
 * AI Campaign Service - Atomic Slot Reservation Tests
 *
 * Tests for atomic slot reservation functionality using Redis Lua scripts.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Redis } from 'ioredis';
import type { AiCampaign } from '@prisma/client';
import { checkAndReserveSlotAtomic, releaseSlot } from '../ai-campaign.service.js';

// Mock Redis client
const mockRedis = {
  exists: vi.fn(),
  eval: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  incr: vi.fn(),
  set: vi.fn(),
  get: vi.fn(),
} as unknown as Redis;

// Mock getRedisClient
vi.mock('../../../config/redis.js', () => ({
  getRedisClient: vi.fn(() => mockRedis),
}));

// Mock repository
const mockCampaign: AiCampaign = {
  id: 'campaign-123',
  name: 'Early Bird Campaign',
  totalTokenBudget: 100000,
  usedTokens: 50000,
  avgTokensPerScan: 100,
  status: 'ACTIVE',
  startsAt: new Date('2025-01-01'),
  endsAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

vi.mock('../ai-campaign.repository.js', () => ({
  getActiveCampaign: vi.fn(async () => mockCampaign),
  updateCampaignTokens: vi.fn(async (_id: string, _tokens: number) => mockCampaign),
  AiCampaignRepositoryError: class extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
    }
  },
}));

describe('AI Campaign Service - Atomic Slot Reservation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('checkAndReserveSlotAtomic', () => {
    it('should successfully reserve a slot when available', async () => {
      // Mock Redis responses
      (mockRedis.exists as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      (mockRedis.eval as ReturnType<typeof vi.fn>).mockResolvedValue([1, 499]); // reserved=1, remaining=499
      (mockRedis.setex as ReturnType<typeof vi.fn>).mockResolvedValue('OK');

      const result = await checkAndReserveSlotAtomic('scan-123');

      expect(result).toEqual({
        reserved: true,
        slotsRemaining: 499,
        reason: 'success',
      });

      // Verify Redis operations
      expect(mockRedis.exists).toHaveBeenCalledWith('ai:campaign:slots:available');
      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining('local available'),
        1,
        'ai:campaign:slots:available'
      );
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'ai:campaign:slot:scan-123',
        1800, // 30 minutes TTL
        '1'
      );
    });

    it('should fail to reserve when quota depleted', async () => {
      // Mock Redis responses
      (mockRedis.exists as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      (mockRedis.eval as ReturnType<typeof vi.fn>).mockResolvedValue([0, 0]); // reserved=0, remaining=0

      const result = await checkAndReserveSlotAtomic('scan-456');

      expect(result).toEqual({
        reserved: false,
        slotsRemaining: 0,
        reason: 'quota_depleted',
      });

      // Should not create reservation
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });

    it('should initialize Redis from database on cache miss', async () => {
      // Mock Redis responses
      (mockRedis.exists as ReturnType<typeof vi.fn>).mockResolvedValue(0); // Key doesn't exist
      (mockRedis.set as ReturnType<typeof vi.fn>).mockResolvedValue('OK');
      (mockRedis.eval as ReturnType<typeof vi.fn>).mockResolvedValue([1, 499]);
      (mockRedis.setex as ReturnType<typeof vi.fn>).mockResolvedValue('OK');

      const result = await checkAndReserveSlotAtomic('scan-789');

      expect(result.reserved).toBe(true);

      // Verify initialization from database
      expect(mockRedis.set).toHaveBeenCalledWith(
        'ai:campaign:slots:available',
        '500' // 50000 remaining / 100 per scan
      );
    });

    it('should throw error for invalid scan ID', async () => {
      await expect(checkAndReserveSlotAtomic('')).rejects.toThrow('Scan ID is required');
    });
  });

  describe('releaseSlot', () => {
    it('should successfully release a reserved slot', async () => {
      // Mock Redis responses
      (mockRedis.exists as ReturnType<typeof vi.fn>).mockResolvedValue(1); // Reservation exists
      (mockRedis.del as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      (mockRedis.incr as ReturnType<typeof vi.fn>).mockResolvedValue(501);

      const result = await releaseSlot('scan-123');

      expect(result).toBe(true);

      // Verify Redis operations
      expect(mockRedis.exists).toHaveBeenCalledWith('ai:campaign:slot:scan-123');
      expect(mockRedis.del).toHaveBeenCalledWith('ai:campaign:slot:scan-123');
      expect(mockRedis.incr).toHaveBeenCalledWith('ai:campaign:slots:available');
    });

    it('should return false when no reservation found', async () => {
      // Mock Redis responses
      (mockRedis.exists as ReturnType<typeof vi.fn>).mockResolvedValue(0); // No reservation

      const result = await releaseSlot('scan-456');

      expect(result).toBe(false);

      // Should not increment counter
      expect(mockRedis.incr).not.toHaveBeenCalled();
    });

    it('should invalidate campaign status cache after release', async () => {
      // Mock Redis responses
      (mockRedis.exists as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      (mockRedis.del as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      (mockRedis.incr as ReturnType<typeof vi.fn>).mockResolvedValue(501);

      await releaseSlot('scan-789');

      // Verify cache invalidation
      expect(mockRedis.del).toHaveBeenCalledWith('ai_campaign:status');
    });

    it('should throw error for invalid scan ID', async () => {
      await expect(releaseSlot('')).rejects.toThrow('Scan ID is required');
    });
  });

  describe('Atomic Operations', () => {
    it('should prevent race conditions with Lua script', async () => {
      // Mock concurrent requests
      (mockRedis.exists as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      (mockRedis.setex as ReturnType<typeof vi.fn>).mockResolvedValue('OK');

      // First request gets slot
      (mockRedis.eval as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([1, 0]); // Last slot reserved

      const result1 = await checkAndReserveSlotAtomic('scan-001');

      expect(result1.reserved).toBe(true);
      expect(result1.slotsRemaining).toBe(0);

      // Second request fails (no slots available)
      (mockRedis.eval as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([0, 0]); // No slots available

      const result2 = await checkAndReserveSlotAtomic('scan-002');

      expect(result2.reserved).toBe(false);
      expect(result2.reason).toBe('quota_depleted');
    });
  });
});

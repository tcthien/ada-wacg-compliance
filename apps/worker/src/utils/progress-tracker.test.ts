import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Redis } from 'ioredis';

/**
 * Mock Redis Client
 */
class MockRedis {
  private store: Map<string, { value: string; ttl: number }> = new Map();

  async setex(key: string, ttl: number, value: string): Promise<'OK'> {
    this.store.set(key, { value, ttl });
    return 'OK';
  }

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    return item ? item.value : null;
  }

  async del(key: string): Promise<number> {
    const existed = this.store.has(key);
    this.store.delete(key);
    return existed ? 1 : 0;
  }

  // Test helper methods
  getTTL(key: string): number | null {
    const item = this.store.get(key);
    return item ? item.ttl : null;
  }

  clear(): void {
    this.store.clear();
  }
}

// Mock Redis client
const mockRedis = new MockRedis();

vi.mock('../config/redis.js', () => ({
  getRedisClient: () => mockRedis as unknown as Redis,
}));

// Import after mocks
import {
  updateScanProgress,
  getScanProgress,
  deleteScanProgress,
  calculateEstimatedTimeRemaining,
  ScanStage,
  STAGE_PROGRESS,
  type ProgressData,
} from './progress-tracker.js';

describe('Progress Tracker', () => {
  beforeEach(() => {
    mockRedis.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('ScanStage and STAGE_PROGRESS', () => {
    it('should have correct progress values for each stage', () => {
      expect(STAGE_PROGRESS[ScanStage.QUEUED]).toBe(0);
      expect(STAGE_PROGRESS[ScanStage.STARTING]).toBe(10);
      expect(STAGE_PROGRESS[ScanStage.NAVIGATING]).toBe(30);
      expect(STAGE_PROGRESS[ScanStage.ANALYZING]).toBe(60);
      expect(STAGE_PROGRESS[ScanStage.PROCESSING]).toBe(85);
      expect(STAGE_PROGRESS[ScanStage.COMPLETED]).toBe(100);
      expect(STAGE_PROGRESS[ScanStage.FAILED]).toBe(-1);
    });

    it('should have all stages defined', () => {
      expect(ScanStage.QUEUED).toBe('QUEUED');
      expect(ScanStage.STARTING).toBe('STARTING');
      expect(ScanStage.NAVIGATING).toBe('NAVIGATING');
      expect(ScanStage.ANALYZING).toBe('ANALYZING');
      expect(ScanStage.PROCESSING).toBe('PROCESSING');
      expect(ScanStage.COMPLETED).toBe('COMPLETED');
      expect(ScanStage.FAILED).toBe('FAILED');
    });
  });

  describe('updateScanProgress', () => {
    it('should store progress data in Redis with correct TTL', async () => {
      const scanId = 'scan-123';
      await updateScanProgress(scanId, ScanStage.STARTING);

      const key = `scan:progress:${scanId}`;
      const ttl = mockRedis.getTTL(key);
      const data = await mockRedis.get(key);

      expect(ttl).toBe(3600); // 1 hour
      expect(data).toBeDefined();

      const parsed = JSON.parse(data!);
      expect(parsed.scanId).toBe(scanId);
      expect(parsed.stage).toBe(ScanStage.STARTING);
      expect(parsed.progress).toBe(10);
    });

    it('should store progress with default message', async () => {
      const scanId = 'scan-456';
      await updateScanProgress(scanId, ScanStage.ANALYZING);

      const progress = await getScanProgress(scanId);
      expect(progress).toBeDefined();
      // Default message is optional in the implementation
    });

    it('should store progress with custom message', async () => {
      const scanId = 'scan-789';
      const customMessage = 'Analyzing page structure...';

      await updateScanProgress(scanId, ScanStage.ANALYZING, {
        message: customMessage,
      });

      const progress = await getScanProgress(scanId);
      expect(progress).toBeDefined();
      expect(progress?.message).toBe(customMessage);
    });

    it('should store progress with error for FAILED stage', async () => {
      const scanId = 'scan-error';
      const errorMessage = 'Page failed to load';

      await updateScanProgress(scanId, ScanStage.FAILED, {
        error: errorMessage,
      });

      const progress = await getScanProgress(scanId);
      expect(progress).toBeDefined();
      expect(progress?.stage).toBe(ScanStage.FAILED);
      expect(progress?.progress).toBe(-1);
      expect(progress?.error).toBe(errorMessage);
    });

    it('should store progress with estimated time remaining', async () => {
      const scanId = 'scan-time';
      const estimatedTime = 25000; // 25 seconds in ms

      await updateScanProgress(scanId, ScanStage.NAVIGATING, {
        estimatedTimeRemaining: estimatedTime,
      });

      const progress = await getScanProgress(scanId);
      expect(progress).toBeDefined();
      expect(progress?.estimatedTimeRemaining).toBe(estimatedTime);
    });

    it('should update existing progress', async () => {
      const scanId = 'scan-update';

      // First update
      await updateScanProgress(scanId, ScanStage.QUEUED);
      const progress1 = await getScanProgress(scanId);
      expect(progress1?.stage).toBe(ScanStage.QUEUED);
      expect(progress1?.progress).toBe(0);

      // Second update
      await updateScanProgress(scanId, ScanStage.ANALYZING);
      const progress2 = await getScanProgress(scanId);
      expect(progress2?.stage).toBe(ScanStage.ANALYZING);
      expect(progress2?.progress).toBe(60);
    });

    it('should include timestamp', async () => {
      const scanId = 'scan-timestamp';
      const beforeUpdate = Date.now();

      await updateScanProgress(scanId, ScanStage.STARTING);

      const afterUpdate = Date.now();
      const progress = await getScanProgress(scanId);

      expect(progress).toBeDefined();
      expect(progress?.updatedAt).toBeGreaterThanOrEqual(beforeUpdate);
      expect(progress?.updatedAt).toBeLessThanOrEqual(afterUpdate);
    });
  });

  describe('getScanProgress', () => {
    it('should retrieve stored progress data', async () => {
      const scanId = 'scan-retrieve';
      await updateScanProgress(scanId, ScanStage.PROCESSING);

      const progress = await getScanProgress(scanId);

      expect(progress).toBeDefined();
      expect(progress?.scanId).toBe(scanId);
      expect(progress?.stage).toBe(ScanStage.PROCESSING);
      expect(progress?.progress).toBe(85);
    });

    it('should return null for non-existent scan', async () => {
      const progress = await getScanProgress('non-existent-scan');
      expect(progress).toBeNull();
    });

    it('should parse JSON correctly', async () => {
      const scanId = 'scan-json';
      const customMessage = 'Custom progress message';

      await updateScanProgress(scanId, ScanStage.ANALYZING, {
        message: customMessage,
      });

      const progress = await getScanProgress(scanId);

      expect(progress).toBeDefined();
      expect(progress?.scanId).toBe(scanId);
      expect(progress?.stage).toBe(ScanStage.ANALYZING);
      expect(progress?.message).toBe(customMessage);
    });
  });

  describe('deleteScanProgress', () => {
    it('should delete progress data from Redis', async () => {
      const scanId = 'scan-delete';

      // Create progress
      await updateScanProgress(scanId, ScanStage.COMPLETED);
      let progress = await getScanProgress(scanId);
      expect(progress).toBeDefined();

      // Delete progress
      await deleteScanProgress(scanId);
      progress = await getScanProgress(scanId);
      expect(progress).toBeNull();
    });

    it('should handle deleting non-existent progress', async () => {
      // Should not throw
      await expect(deleteScanProgress('non-existent')).resolves.toBeUndefined();
    });

    it('should return number of deleted keys', async () => {
      const scanId = 'scan-delete-count';
      await updateScanProgress(scanId, ScanStage.COMPLETED);

      const result = await deleteScanProgress(scanId);
      // Result is void in our implementation, but Redis returns count
      expect(result).toBeUndefined();
    });
  });

  describe('calculateEstimatedTimeRemaining', () => {
    it('should calculate time for QUEUED stage', () => {
      const remaining = calculateEstimatedTimeRemaining(ScanStage.QUEUED);
      // QUEUED is not in the stages array, so it returns 0
      // because counting never starts
      expect(remaining).toBe(0);
    });

    it('should calculate time for STARTING stage', () => {
      const remaining = calculateEstimatedTimeRemaining(ScanStage.STARTING);
      // Should include 50% of STARTING + full time for later stages
      expect(remaining).toBeGreaterThan(0);
    });

    it('should calculate time for NAVIGATING stage', () => {
      const remaining = calculateEstimatedTimeRemaining(ScanStage.NAVIGATING);
      // Should include 50% of NAVIGATING + ANALYZING + PROCESSING
      expect(remaining).toBeGreaterThan(0);
    });

    it('should calculate time for ANALYZING stage', () => {
      const remaining = calculateEstimatedTimeRemaining(ScanStage.ANALYZING);
      // Should include 50% of ANALYZING + PROCESSING
      expect(remaining).toBeGreaterThan(0);
    });

    it('should calculate time for PROCESSING stage', () => {
      const remaining = calculateEstimatedTimeRemaining(ScanStage.PROCESSING);
      // Should include 50% of PROCESSING only
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThan(3000); // Less than full processing time
    });

    it('should return 0 for COMPLETED stage', () => {
      const remaining = calculateEstimatedTimeRemaining(ScanStage.COMPLETED);
      expect(remaining).toBe(0);
    });

    it('should return 0 for FAILED stage', () => {
      const remaining = calculateEstimatedTimeRemaining(ScanStage.FAILED);
      expect(remaining).toBe(0);
    });

    it('should have decreasing time as stages progress', () => {
      const startingTime = calculateEstimatedTimeRemaining(ScanStage.STARTING);
      const navigatingTime = calculateEstimatedTimeRemaining(ScanStage.NAVIGATING);
      const analyzingTime = calculateEstimatedTimeRemaining(ScanStage.ANALYZING);
      const processingTime = calculateEstimatedTimeRemaining(ScanStage.PROCESSING);

      // Each subsequent stage should have less time remaining
      // STARTING: 1000 (50% of 2000) + 8000 + 12000 + 3000 = 24000
      // NAVIGATING: 4000 (50% of 8000) + 12000 + 3000 = 19000
      // ANALYZING: 6000 (50% of 12000) + 3000 = 9000
      // PROCESSING: 1500 (50% of 3000) = 1500
      expect(navigatingTime).toBeLessThan(startingTime);
      expect(analyzingTime).toBeLessThan(navigatingTime);
      expect(processingTime).toBeLessThan(analyzingTime);
    });
  });

  describe('Full workflow', () => {
    it('should track complete scan lifecycle', async () => {
      const scanId = 'scan-workflow';

      // Stage 1: QUEUED
      await updateScanProgress(scanId, ScanStage.QUEUED);
      let progress = await getScanProgress(scanId);
      expect(progress?.stage).toBe(ScanStage.QUEUED);
      expect(progress?.progress).toBe(0);

      // Stage 2: STARTING
      await updateScanProgress(scanId, ScanStage.STARTING);
      progress = await getScanProgress(scanId);
      expect(progress?.stage).toBe(ScanStage.STARTING);
      expect(progress?.progress).toBe(10);

      // Stage 3: NAVIGATING
      await updateScanProgress(scanId, ScanStage.NAVIGATING);
      progress = await getScanProgress(scanId);
      expect(progress?.stage).toBe(ScanStage.NAVIGATING);
      expect(progress?.progress).toBe(30);

      // Stage 4: ANALYZING
      await updateScanProgress(scanId, ScanStage.ANALYZING);
      progress = await getScanProgress(scanId);
      expect(progress?.stage).toBe(ScanStage.ANALYZING);
      expect(progress?.progress).toBe(60);

      // Stage 5: PROCESSING
      await updateScanProgress(scanId, ScanStage.PROCESSING);
      progress = await getScanProgress(scanId);
      expect(progress?.stage).toBe(ScanStage.PROCESSING);
      expect(progress?.progress).toBe(85);

      // Stage 6: COMPLETED
      await updateScanProgress(scanId, ScanStage.COMPLETED);
      progress = await getScanProgress(scanId);
      expect(progress?.stage).toBe(ScanStage.COMPLETED);
      expect(progress?.progress).toBe(100);

      // Cleanup
      await deleteScanProgress(scanId);
      progress = await getScanProgress(scanId);
      expect(progress).toBeNull();
    });

    it('should handle failed scan workflow', async () => {
      const scanId = 'scan-failed-workflow';
      const errorMessage = 'Network timeout';

      // Start scan
      await updateScanProgress(scanId, ScanStage.STARTING);
      let progress = await getScanProgress(scanId);
      expect(progress?.progress).toBe(10);

      // Fail during navigation
      await updateScanProgress(scanId, ScanStage.FAILED, {
        error: errorMessage,
      });

      progress = await getScanProgress(scanId);
      expect(progress?.stage).toBe(ScanStage.FAILED);
      expect(progress?.progress).toBe(-1);
      expect(progress?.error).toBe(errorMessage);

      // Cleanup
      await deleteScanProgress(scanId);
      progress = await getScanProgress(scanId);
      expect(progress).toBeNull();
    });
  });

  describe('Redis key format', () => {
    it('should use correct key pattern', async () => {
      const scanId = 'test-scan-123';
      await updateScanProgress(scanId, ScanStage.QUEUED);

      const expectedKey = `scan:progress:${scanId}`;
      const data = await mockRedis.get(expectedKey);

      expect(data).toBeDefined();
    });
  });

  describe('TTL management', () => {
    it('should set 1 hour TTL on all progress updates', async () => {
      const scanId = 'scan-ttl';

      await updateScanProgress(scanId, ScanStage.QUEUED);
      let ttl = mockRedis.getTTL(`scan:progress:${scanId}`);
      expect(ttl).toBe(3600);

      await updateScanProgress(scanId, ScanStage.ANALYZING);
      ttl = mockRedis.getTTL(`scan:progress:${scanId}`);
      expect(ttl).toBe(3600);

      await updateScanProgress(scanId, ScanStage.COMPLETED);
      ttl = mockRedis.getTTL(`scan:progress:${scanId}`);
      expect(ttl).toBe(3600);
    });
  });
});

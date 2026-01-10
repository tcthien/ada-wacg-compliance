import { describe, it, expect } from 'vitest';
import { organizeBatches, Batch, MiniBatch } from '../src/batch-organizer.js';
import { PendingScan, WcagLevel } from '../src/types.js';

/**
 * Helper function to generate mock PendingScan arrays for testing
 * @param count - Number of mock scans to generate
 * @param wcagLevel - WCAG level for all scans (default: 'AA')
 * @returns Array of PendingScan objects
 */
function generateMockScans(count: number, wcagLevel: WcagLevel = 'AA'): PendingScan[] {
  const scans: PendingScan[] = [];
  for (let i = 1; i <= count; i++) {
    scans.push({
      scanId: `scan-${String(i).padStart(4, '0')}`,
      url: `https://example-${i}.com`,
      wcagLevel,
      email: `user${i}@example.com`,
      createdAt: `2024-01-01T10:${String(i % 60).padStart(2, '0')}:00Z`,
    });
  }
  return scans;
}

describe('Batch Organizer', () => {
  describe('Basic batch organization', () => {
    it('should organize 10 URLs with batchSize=100 into 1 batch with 10 URLs', () => {
      const scans = generateMockScans(10);
      const batches = organizeBatches(scans, 100, 5);

      // Should create 1 batch
      expect(batches).toHaveLength(1);

      // Verify batch structure
      expect(batches[0].batchNumber).toBe(1);
      expect(batches[0].scans).toHaveLength(10);

      // All scans should be in the batch
      expect(batches[0].scans).toEqual(scans);
    });

    it('should organize 150 URLs with batchSize=100 into 2 batches (100 + 50)', () => {
      const scans = generateMockScans(150);
      const batches = organizeBatches(scans, 100, 5);

      // Should create 2 batches
      expect(batches).toHaveLength(2);

      // Verify first batch
      expect(batches[0].batchNumber).toBe(1);
      expect(batches[0].scans).toHaveLength(100);

      // Verify second batch
      expect(batches[1].batchNumber).toBe(2);
      expect(batches[1].scans).toHaveLength(50);

      // Verify all scans are accounted for
      const totalScans = batches[0].scans.length + batches[1].scans.length;
      expect(totalScans).toBe(150);

      // Verify first scan of first batch
      expect(batches[0].scans[0].scanId).toBe('scan-0001');

      // Verify first scan of second batch
      expect(batches[1].scans[0].scanId).toBe('scan-0101');

      // Verify last scan of second batch
      expect(batches[1].scans[49].scanId).toBe('scan-0150');
    });
  });

  describe('Mini-batch organization', () => {
    it('should organize 100 URLs with miniBatchSize=5 into 20 mini-batches per batch', () => {
      const scans = generateMockScans(100);
      const batches = organizeBatches(scans, 100, 5);

      // Should create 1 batch
      expect(batches).toHaveLength(1);

      // Should create 20 mini-batches (100 / 5 = 20)
      expect(batches[0].miniBatches).toHaveLength(20);

      // Verify each mini-batch has 5 scans
      batches[0].miniBatches.forEach((miniBatch, index) => {
        expect(miniBatch.miniBatchNumber).toBe(index + 1);
        expect(miniBatch.scans).toHaveLength(5);
      });

      // Verify first mini-batch
      expect(batches[0].miniBatches[0].scans[0].scanId).toBe('scan-0001');
      expect(batches[0].miniBatches[0].scans[4].scanId).toBe('scan-0005');

      // Verify last mini-batch
      expect(batches[0].miniBatches[19].scans[0].scanId).toBe('scan-0096');
      expect(batches[0].miniBatches[19].scans[4].scanId).toBe('scan-0100');
    });

    it('should organize 7 URLs with miniBatchSize=5 into 2 mini-batches (5 + 2)', () => {
      const scans = generateMockScans(7);
      const batches = organizeBatches(scans, 100, 5);

      // Should create 1 batch
      expect(batches).toHaveLength(1);

      // Should create 2 mini-batches
      expect(batches[0].miniBatches).toHaveLength(2);

      // First mini-batch should have 5 scans
      expect(batches[0].miniBatches[0].miniBatchNumber).toBe(1);
      expect(batches[0].miniBatches[0].scans).toHaveLength(5);

      // Second mini-batch should have 2 scans
      expect(batches[0].miniBatches[1].miniBatchNumber).toBe(2);
      expect(batches[0].miniBatches[1].scans).toHaveLength(2);

      // Verify scan IDs
      expect(batches[0].miniBatches[0].scans[0].scanId).toBe('scan-0001');
      expect(batches[0].miniBatches[0].scans[4].scanId).toBe('scan-0005');
      expect(batches[0].miniBatches[1].scans[0].scanId).toBe('scan-0006');
      expect(batches[0].miniBatches[1].scans[1].scanId).toBe('scan-0007');
    });
  });

  describe('Edge cases', () => {
    it('should return empty array for empty input', () => {
      const scans: PendingScan[] = [];
      const batches = organizeBatches(scans, 100, 5);

      expect(batches).toHaveLength(0);
      expect(batches).toEqual([]);
    });

    it('should organize single URL into 1 batch with 1 mini-batch', () => {
      const scans = generateMockScans(1);
      const batches = organizeBatches(scans, 100, 5);

      // Should create 1 batch
      expect(batches).toHaveLength(1);
      expect(batches[0].batchNumber).toBe(1);
      expect(batches[0].scans).toHaveLength(1);

      // Should create 1 mini-batch
      expect(batches[0].miniBatches).toHaveLength(1);
      expect(batches[0].miniBatches[0].miniBatchNumber).toBe(1);
      expect(batches[0].miniBatches[0].scans).toHaveLength(1);

      // Verify the scan
      expect(batches[0].scans[0].scanId).toBe('scan-0001');
      expect(batches[0].miniBatches[0].scans[0].scanId).toBe('scan-0001');
    });
  });

  describe('Mini-batch size range validation (1-10)', () => {
    it('should clamp miniBatchSize=1 and create correct mini-batches', () => {
      const scans = generateMockScans(5);
      const batches = organizeBatches(scans, 100, 1);

      // Should create 1 batch
      expect(batches).toHaveLength(1);

      // Should create 5 mini-batches (1 scan each)
      expect(batches[0].miniBatches).toHaveLength(5);

      // Verify each mini-batch has exactly 1 scan
      batches[0].miniBatches.forEach((miniBatch, index) => {
        expect(miniBatch.miniBatchNumber).toBe(index + 1);
        expect(miniBatch.scans).toHaveLength(1);
        expect(miniBatch.scans[0].scanId).toBe(`scan-${String(index + 1).padStart(4, '0')}`);
      });
    });

    it('should clamp miniBatchSize=10 and create correct mini-batches', () => {
      const scans = generateMockScans(25);
      const batches = organizeBatches(scans, 100, 10);

      // Should create 1 batch
      expect(batches).toHaveLength(1);

      // Should create 3 mini-batches (10 + 10 + 5)
      expect(batches[0].miniBatches).toHaveLength(3);

      // First mini-batch should have 10 scans
      expect(batches[0].miniBatches[0].scans).toHaveLength(10);
      expect(batches[0].miniBatches[0].scans[0].scanId).toBe('scan-0001');
      expect(batches[0].miniBatches[0].scans[9].scanId).toBe('scan-0010');

      // Second mini-batch should have 10 scans
      expect(batches[0].miniBatches[1].scans).toHaveLength(10);
      expect(batches[0].miniBatches[1].scans[0].scanId).toBe('scan-0011');
      expect(batches[0].miniBatches[1].scans[9].scanId).toBe('scan-0020');

      // Third mini-batch should have 5 scans
      expect(batches[0].miniBatches[2].scans).toHaveLength(5);
      expect(batches[0].miniBatches[2].scans[0].scanId).toBe('scan-0021');
      expect(batches[0].miniBatches[2].scans[4].scanId).toBe('scan-0025');
    });

    it('should clamp miniBatchSize=0 to 1 (lower bound)', () => {
      const scans = generateMockScans(3);
      const batches = organizeBatches(scans, 100, 0);

      // Should create 1 batch with 3 mini-batches (clamped to size 1)
      expect(batches).toHaveLength(1);
      expect(batches[0].miniBatches).toHaveLength(3);

      // Each mini-batch should have 1 scan
      batches[0].miniBatches.forEach((miniBatch) => {
        expect(miniBatch.scans).toHaveLength(1);
      });
    });

    it('should clamp miniBatchSize=-5 to 1 (negative value)', () => {
      const scans = generateMockScans(4);
      const batches = organizeBatches(scans, 100, -5);

      // Should create 1 batch with 4 mini-batches (clamped to size 1)
      expect(batches).toHaveLength(1);
      expect(batches[0].miniBatches).toHaveLength(4);

      // Each mini-batch should have 1 scan
      batches[0].miniBatches.forEach((miniBatch) => {
        expect(miniBatch.scans).toHaveLength(1);
      });
    });

    it('should clamp miniBatchSize=15 to 10 (upper bound)', () => {
      const scans = generateMockScans(30);
      const batches = organizeBatches(scans, 100, 15);

      // Should create 1 batch with 3 mini-batches (clamped to size 10: 10 + 10 + 10)
      expect(batches).toHaveLength(1);
      expect(batches[0].miniBatches).toHaveLength(3);

      // Each mini-batch should have exactly 10 scans
      batches[0].miniBatches.forEach((miniBatch) => {
        expect(miniBatch.scans).toHaveLength(10);
      });
    });

    it('should clamp miniBatchSize=100 to 10 (very large value)', () => {
      const scans = generateMockScans(25);
      const batches = organizeBatches(scans, 100, 100);

      // Should create 1 batch with 3 mini-batches (clamped to size 10: 10 + 10 + 5)
      expect(batches).toHaveLength(1);
      expect(batches[0].miniBatches).toHaveLength(3);

      expect(batches[0].miniBatches[0].scans).toHaveLength(10);
      expect(batches[0].miniBatches[1].scans).toHaveLength(10);
      expect(batches[0].miniBatches[2].scans).toHaveLength(5);
    });

    it('should handle valid miniBatchSize=5 (middle of range)', () => {
      const scans = generateMockScans(15);
      const batches = organizeBatches(scans, 100, 5);

      // Should create 1 batch with 3 mini-batches (5 + 5 + 5)
      expect(batches).toHaveLength(1);
      expect(batches[0].miniBatches).toHaveLength(3);

      // All mini-batches should have exactly 5 scans
      batches[0].miniBatches.forEach((miniBatch) => {
        expect(miniBatch.scans).toHaveLength(5);
      });
    });
  });

  describe('Complex scenarios', () => {
    it('should handle 250 URLs with batchSize=100 and miniBatchSize=5', () => {
      const scans = generateMockScans(250);
      const batches = organizeBatches(scans, 100, 5);

      // Should create 3 batches (100 + 100 + 50)
      expect(batches).toHaveLength(3);

      // First batch: 100 scans, 20 mini-batches
      expect(batches[0].batchNumber).toBe(1);
      expect(batches[0].scans).toHaveLength(100);
      expect(batches[0].miniBatches).toHaveLength(20);

      // Second batch: 100 scans, 20 mini-batches
      expect(batches[1].batchNumber).toBe(2);
      expect(batches[1].scans).toHaveLength(100);
      expect(batches[1].miniBatches).toHaveLength(20);

      // Third batch: 50 scans, 10 mini-batches
      expect(batches[2].batchNumber).toBe(3);
      expect(batches[2].scans).toHaveLength(50);
      expect(batches[2].miniBatches).toHaveLength(10);

      // Verify total scans
      const totalScans = batches.reduce((sum, batch) => sum + batch.scans.length, 0);
      expect(totalScans).toBe(250);
    });

    it('should preserve scan data integrity across batches and mini-batches', () => {
      const scans = generateMockScans(12, 'AAA');
      const batches = organizeBatches(scans, 10, 3);

      // Should create 2 batches (10 + 2)
      expect(batches).toHaveLength(2);

      // Flatten all scans from batches
      const batchScans = batches.flatMap((batch) => batch.scans);
      expect(batchScans).toEqual(scans);

      // Flatten all scans from mini-batches
      const miniBatchScans = batches.flatMap((batch) =>
        batch.miniBatches.flatMap((miniBatch) => miniBatch.scans)
      );
      expect(miniBatchScans).toEqual(scans);

      // Verify WCAG level is preserved
      miniBatchScans.forEach((scan) => {
        expect(scan.wcagLevel).toBe('AAA');
      });

      // Verify scan IDs are sequential and unique
      miniBatchScans.forEach((scan, index) => {
        expect(scan.scanId).toBe(`scan-${String(index + 1).padStart(4, '0')}`);
      });
    });

    it('should handle exact batch size boundary (100 URLs, batchSize=100)', () => {
      const scans = generateMockScans(100);
      const batches = organizeBatches(scans, 100, 5);

      // Should create exactly 1 batch
      expect(batches).toHaveLength(1);
      expect(batches[0].scans).toHaveLength(100);
      expect(batches[0].miniBatches).toHaveLength(20);
    });

    it('should handle exact batch size boundary + 1 (101 URLs, batchSize=100)', () => {
      const scans = generateMockScans(101);
      const batches = organizeBatches(scans, 100, 5);

      // Should create 2 batches (100 + 1)
      expect(batches).toHaveLength(2);
      expect(batches[0].scans).toHaveLength(100);
      expect(batches[1].scans).toHaveLength(1);

      // First batch should have 20 mini-batches
      expect(batches[0].miniBatches).toHaveLength(20);

      // Second batch should have 1 mini-batch with 1 scan
      expect(batches[1].miniBatches).toHaveLength(1);
      expect(batches[1].miniBatches[0].scans).toHaveLength(1);
    });
  });

  describe('Data integrity verification', () => {
    it('should maintain correct mini-batch numbering across batches', () => {
      const scans = generateMockScans(150);
      const batches = organizeBatches(scans, 100, 10);

      // Verify first batch mini-batch numbers (1-10)
      expect(batches[0].miniBatches).toHaveLength(10);
      batches[0].miniBatches.forEach((miniBatch, index) => {
        expect(miniBatch.miniBatchNumber).toBe(index + 1);
      });

      // Verify second batch mini-batch numbers (1-5, reset per batch)
      expect(batches[1].miniBatches).toHaveLength(5);
      batches[1].miniBatches.forEach((miniBatch, index) => {
        expect(miniBatch.miniBatchNumber).toBe(index + 1);
      });
    });

    it('should ensure no scans are lost or duplicated', () => {
      const scans = generateMockScans(77);
      const batches = organizeBatches(scans, 50, 7);

      // Collect all scan IDs from batches
      const batchScanIds = batches.flatMap((batch) =>
        batch.scans.map((scan) => scan.scanId)
      );

      // Collect all scan IDs from mini-batches
      const miniBatchScanIds = batches.flatMap((batch) =>
        batch.miniBatches.flatMap((miniBatch) =>
          miniBatch.scans.map((scan) => scan.scanId)
        )
      );

      // Original scan IDs
      const originalScanIds = scans.map((scan) => scan.scanId);

      // All should be equal
      expect(batchScanIds).toEqual(originalScanIds);
      expect(miniBatchScanIds).toEqual(originalScanIds);

      // Verify no duplicates
      expect(new Set(batchScanIds).size).toBe(77);
      expect(new Set(miniBatchScanIds).size).toBe(77);
    });
  });
});

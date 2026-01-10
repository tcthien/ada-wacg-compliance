import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CheckpointManager, Checkpoint } from '../src/checkpoint-manager.js';
import { mkdtemp, rm, access, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('CheckpointManager', () => {
  let testDir: string;
  let checkpointPath: string;
  let manager: CheckpointManager;

  beforeEach(async () => {
    // Create a unique temporary directory for each test
    testDir = await mkdtemp(join(tmpdir(), 'checkpoint-test-'));
    checkpointPath = join(testDir, 'test-checkpoint.json');
    manager = new CheckpointManager(checkpointPath);
  });

  afterEach(async () => {
    // Clean up test directory and all its contents
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Save checkpoint', () => {
    it('should create JSON file with correct structure', async () => {
      // Create a checkpoint
      const checkpoint: Checkpoint = {
        inputFile: 'test-scans.csv',
        processedScanIds: ['scan-001', 'scan-002'],
        lastBatch: 0,
        lastMiniBatch: 0,
        startedAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T10:00:00Z',
      };

      // Save checkpoint
      await manager.saveCheckpoint(checkpoint);

      // Verify file exists
      await expect(access(checkpointPath)).resolves.toBeUndefined();

      // Read and parse the file
      const fileContent = await readFile(checkpointPath, 'utf-8');
      const savedCheckpoint = JSON.parse(fileContent);

      // Verify structure
      expect(savedCheckpoint).toHaveProperty('inputFile', 'test-scans.csv');
      expect(savedCheckpoint).toHaveProperty('processedScanIds');
      expect(savedCheckpoint.processedScanIds).toHaveLength(2);
      expect(savedCheckpoint.processedScanIds).toContain('scan-001');
      expect(savedCheckpoint.processedScanIds).toContain('scan-002');
      expect(savedCheckpoint).toHaveProperty('lastBatch', 0);
      expect(savedCheckpoint).toHaveProperty('lastMiniBatch', 0);
      expect(savedCheckpoint).toHaveProperty('startedAt');
      expect(savedCheckpoint).toHaveProperty('updatedAt');

      // Verify updatedAt was set to current time
      const updatedAt = new Date(savedCheckpoint.updatedAt);
      const now = new Date();
      const timeDiff = Math.abs(now.getTime() - updatedAt.getTime());
      expect(timeDiff).toBeLessThan(5000); // Within 5 seconds
    });

    it('should create properly formatted JSON with indentation', async () => {
      const checkpoint: Checkpoint = {
        inputFile: 'test.csv',
        processedScanIds: ['scan-001'],
        lastBatch: 1,
        lastMiniBatch: 2,
        startedAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T10:00:00Z',
      };

      await manager.saveCheckpoint(checkpoint);

      // Read raw file content
      const fileContent = await readFile(checkpointPath, 'utf-8');

      // Verify JSON is formatted (has newlines and indentation)
      expect(fileContent).toContain('\n');
      expect(fileContent).toContain('  ');
      expect(fileContent).toMatch(/"inputFile":\s+"test\.csv"/);
    });
  });

  describe('Load existing checkpoint', () => {
    it('should return Checkpoint object from existing file', async () => {
      // Create a checkpoint first
      const originalCheckpoint: Checkpoint = {
        inputFile: 'scans.csv',
        processedScanIds: ['scan-001', 'scan-002', 'scan-003'],
        lastBatch: 2,
        lastMiniBatch: 5,
        startedAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T11:30:00Z',
      };

      await manager.saveCheckpoint(originalCheckpoint);

      // Create a new manager instance to test loading
      const newManager = new CheckpointManager(checkpointPath);
      const loadedCheckpoint = await newManager.loadCheckpoint();

      // Verify loaded checkpoint matches original
      expect(loadedCheckpoint).not.toBeNull();
      expect(loadedCheckpoint?.inputFile).toBe('scans.csv');
      expect(loadedCheckpoint?.processedScanIds).toHaveLength(3);
      expect(loadedCheckpoint?.processedScanIds).toEqual(['scan-001', 'scan-002', 'scan-003']);
      expect(loadedCheckpoint?.lastBatch).toBe(2);
      expect(loadedCheckpoint?.lastMiniBatch).toBe(5);
      expect(loadedCheckpoint?.startedAt).toBe('2024-01-01T10:00:00Z');
      // updatedAt is set to current time when saveCheckpoint is called
      expect(loadedCheckpoint?.updatedAt).toBeDefined();
      expect(new Date(loadedCheckpoint!.updatedAt).getTime()).toBeGreaterThan(0);
    });

    it('should handle checkpoint with empty processedScanIds array', async () => {
      const checkpoint: Checkpoint = {
        inputFile: 'empty.csv',
        processedScanIds: [],
        lastBatch: 0,
        lastMiniBatch: 0,
        startedAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T10:00:00Z',
      };

      await manager.saveCheckpoint(checkpoint);

      const loadedCheckpoint = await manager.loadCheckpoint();
      expect(loadedCheckpoint).not.toBeNull();
      expect(loadedCheckpoint?.processedScanIds).toEqual([]);
      expect(loadedCheckpoint?.processedScanIds).toHaveLength(0);
    });

    it('should handle checkpoint with large number of processed IDs', async () => {
      // Create 1000 scan IDs
      const processedIds = Array.from({ length: 1000 }, (_, i) => `scan-${String(i + 1).padStart(4, '0')}`);

      const checkpoint: Checkpoint = {
        inputFile: 'large.csv',
        processedScanIds: processedIds,
        lastBatch: 10,
        lastMiniBatch: 25,
        startedAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T15:00:00Z',
      };

      await manager.saveCheckpoint(checkpoint);

      const loadedCheckpoint = await manager.loadCheckpoint();
      expect(loadedCheckpoint).not.toBeNull();
      expect(loadedCheckpoint?.processedScanIds).toHaveLength(1000);
      expect(loadedCheckpoint?.processedScanIds[0]).toBe('scan-0001');
      expect(loadedCheckpoint?.processedScanIds[999]).toBe('scan-1000');
    });
  });

  describe('Load non-existent checkpoint', () => {
    it('should return null when file does not exist', async () => {
      const nonExistentPath = join(testDir, 'non-existent-checkpoint.json');
      const newManager = new CheckpointManager(nonExistentPath);

      const checkpoint = await newManager.loadCheckpoint();

      expect(checkpoint).toBeNull();
    });

    it('should return null for invalid JSON file', async () => {
      // Write invalid JSON to the checkpoint file
      const invalidJsonPath = join(testDir, 'invalid.json');
      const { writeFile } = await import('fs/promises');
      await writeFile(invalidJsonPath, '{ invalid json content', 'utf-8');

      const newManager = new CheckpointManager(invalidJsonPath);
      const checkpoint = await newManager.loadCheckpoint();

      expect(checkpoint).toBeNull();
    });

    it('should return null and not throw for corrupted JSON', async () => {
      // Write corrupted JSON
      const fs = await import('fs/promises');
      await fs.writeFile(checkpointPath, '{"inputFile": "test.csv", "processedScanIds":', 'utf-8');

      const checkpoint = await manager.loadCheckpoint();

      expect(checkpoint).toBeNull();
    });
  });

  describe('Atomic write operation', () => {
    it('should create temp file and remove it after rename', async () => {
      const tempPath = `${checkpointPath}.tmp`;

      const checkpoint: Checkpoint = {
        inputFile: 'test.csv',
        processedScanIds: ['scan-001'],
        lastBatch: 0,
        lastMiniBatch: 0,
        startedAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T10:00:00Z',
      };

      await manager.saveCheckpoint(checkpoint);

      // Verify final file exists
      await expect(access(checkpointPath)).resolves.toBeUndefined();

      // Verify temp file does not exist
      await expect(access(tempPath)).rejects.toThrow();
    });

    it('should overwrite existing checkpoint file atomically', async () => {
      // Create initial checkpoint
      const checkpoint1: Checkpoint = {
        inputFile: 'first.csv',
        processedScanIds: ['scan-001'],
        lastBatch: 0,
        lastMiniBatch: 0,
        startedAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T10:00:00Z',
      };

      await manager.saveCheckpoint(checkpoint1);

      // Overwrite with new checkpoint
      const checkpoint2: Checkpoint = {
        inputFile: 'second.csv',
        processedScanIds: ['scan-002', 'scan-003'],
        lastBatch: 1,
        lastMiniBatch: 3,
        startedAt: '2024-01-01T11:00:00Z',
        updatedAt: '2024-01-01T11:00:00Z',
      };

      await manager.saveCheckpoint(checkpoint2);

      // Verify the second checkpoint is what's saved
      const loadedCheckpoint = await manager.loadCheckpoint();
      expect(loadedCheckpoint?.inputFile).toBe('second.csv');
      expect(loadedCheckpoint?.processedScanIds).toEqual(['scan-002', 'scan-003']);
      expect(loadedCheckpoint?.lastBatch).toBe(1);

      // Verify temp file is cleaned up
      const tempPath = `${checkpointPath}.tmp`;
      await expect(access(tempPath)).rejects.toThrow();
    });
  });

  describe('markProcessed() - buffer scan IDs in memory', () => {
    it('should buffer scan IDs without writing to disk', async () => {
      // Initialize checkpoint
      const checkpoint = manager.initCheckpoint('test.csv');
      await manager.saveCheckpoint(checkpoint);

      // Mark some IDs as processed
      manager.markProcessed(['scan-001', 'scan-002', 'scan-003']);

      // Verify file still has empty processedScanIds
      const fileContent = await readFile(checkpointPath, 'utf-8');
      const savedCheckpoint = JSON.parse(fileContent);
      expect(savedCheckpoint.processedScanIds).toEqual([]);
    });

    it('should buffer multiple markProcessed() calls', async () => {
      const checkpoint = manager.initCheckpoint('test.csv');
      await manager.saveCheckpoint(checkpoint);

      // Multiple markProcessed calls
      manager.markProcessed(['scan-001', 'scan-002']);
      manager.markProcessed(['scan-003']);
      manager.markProcessed(['scan-004', 'scan-005']);

      // Verify file still has empty processedScanIds
      const fileContent = await readFile(checkpointPath, 'utf-8');
      const savedCheckpoint = JSON.parse(fileContent);
      expect(savedCheckpoint.processedScanIds).toEqual([]);
    });

    it('should accept empty array without error', async () => {
      const checkpoint = manager.initCheckpoint('test.csv');
      await manager.saveCheckpoint(checkpoint);

      // Should not throw
      expect(() => manager.markProcessed([])).not.toThrow();

      // Verify file unchanged
      const fileContent = await readFile(checkpointPath, 'utf-8');
      const savedCheckpoint = JSON.parse(fileContent);
      expect(savedCheckpoint.processedScanIds).toEqual([]);
    });
  });

  describe('flush() - write buffered IDs to file', () => {
    it('should write buffered IDs to checkpoint file', async () => {
      const checkpoint = manager.initCheckpoint('test.csv');
      await manager.saveCheckpoint(checkpoint);

      // Buffer some IDs
      manager.markProcessed(['scan-001', 'scan-002', 'scan-003']);

      // Flush to disk
      await manager.flush();

      // Verify IDs are now in the file
      const fileContent = await readFile(checkpointPath, 'utf-8');
      const savedCheckpoint = JSON.parse(fileContent);
      expect(savedCheckpoint.processedScanIds).toEqual(['scan-001', 'scan-002', 'scan-003']);
    });

    it('should clear pending buffer after flush', async () => {
      const checkpoint = manager.initCheckpoint('test.csv');
      await manager.saveCheckpoint(checkpoint);

      // Buffer and flush
      manager.markProcessed(['scan-001']);
      await manager.flush();

      // Buffer new IDs
      manager.markProcessed(['scan-002']);
      await manager.flush();

      // Verify cumulative IDs
      const fileContent = await readFile(checkpointPath, 'utf-8');
      const savedCheckpoint = JSON.parse(fileContent);
      expect(savedCheckpoint.processedScanIds).toEqual(['scan-001', 'scan-002']);
    });

    it('should handle multiple markProcessed calls before flush', async () => {
      const checkpoint = manager.initCheckpoint('test.csv');
      await manager.saveCheckpoint(checkpoint);

      // Multiple markProcessed calls
      manager.markProcessed(['scan-001', 'scan-002']);
      manager.markProcessed(['scan-003']);
      manager.markProcessed(['scan-004', 'scan-005', 'scan-006']);

      // Single flush
      await manager.flush();

      // Verify all IDs are written
      const fileContent = await readFile(checkpointPath, 'utf-8');
      const savedCheckpoint = JSON.parse(fileContent);
      expect(savedCheckpoint.processedScanIds).toEqual([
        'scan-001',
        'scan-002',
        'scan-003',
        'scan-004',
        'scan-005',
        'scan-006',
      ]);
    });

    it('should not write to disk if no pending IDs', async () => {
      const checkpoint = manager.initCheckpoint('test.csv');
      await manager.saveCheckpoint(checkpoint);

      // Get initial updatedAt timestamp
      const initialContent = await readFile(checkpointPath, 'utf-8');
      const initialCheckpoint = JSON.parse(initialContent);
      const initialUpdatedAt = initialCheckpoint.updatedAt;

      // Wait a bit to ensure timestamp would change if file is written
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Flush with no pending IDs
      await manager.flush();

      // Verify file was not modified
      const afterContent = await readFile(checkpointPath, 'utf-8');
      const afterCheckpoint = JSON.parse(afterContent);
      expect(afterCheckpoint.updatedAt).toBe(initialUpdatedAt);
    });

    it('should throw error if no checkpoint is loaded', async () => {
      // Try to flush without initializing checkpoint
      manager.markProcessed(['scan-001']);

      await expect(manager.flush()).rejects.toThrow(
        'Cannot flush: no checkpoint loaded. Call loadCheckpoint() or initCheckpoint() first.'
      );
    });

    it('should update updatedAt timestamp on flush', async () => {
      const checkpoint = manager.initCheckpoint('test.csv');
      await manager.saveCheckpoint(checkpoint);

      // Get initial timestamp
      const initialTimestamp = checkpoint.updatedAt;

      // Wait a bit to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Mark and flush
      manager.markProcessed(['scan-001']);
      await manager.flush();

      // Verify timestamp was updated
      const fileContent = await readFile(checkpointPath, 'utf-8');
      const savedCheckpoint = JSON.parse(fileContent);
      expect(savedCheckpoint.updatedAt).not.toBe(initialTimestamp);
    });
  });

  describe('Clear checkpoint', () => {
    it('should remove checkpoint file from disk', async () => {
      // Create checkpoint
      const checkpoint = manager.initCheckpoint('test.csv');
      await manager.saveCheckpoint(checkpoint);

      // Verify file exists
      await expect(access(checkpointPath)).resolves.toBeUndefined();

      // Clear checkpoint
      await manager.clearCheckpoint();

      // Verify file is removed
      await expect(access(checkpointPath)).rejects.toThrow();
    });

    it('should not throw error if file does not exist', async () => {
      // Should not throw
      await expect(manager.clearCheckpoint()).resolves.toBeUndefined();
    });

    it('should clear in-memory checkpoint reference', async () => {
      // Create and load checkpoint
      const checkpoint = manager.initCheckpoint('test.csv');
      await manager.saveCheckpoint(checkpoint);
      await manager.loadCheckpoint();

      // Verify checkpoint is loaded in memory
      expect(manager.isProcessed('scan-001')).toBe(false);

      // Clear checkpoint
      await manager.clearCheckpoint();

      // Verify in-memory reference is cleared (isProcessed should return false)
      expect(manager.isProcessed('scan-001')).toBe(false);
    });
  });

  describe('Resume with 50 processed IDs', () => {
    it('should skip processed IDs via isProcessed() check', async () => {
      // Create checkpoint with 50 processed IDs
      const processedIds = Array.from({ length: 50 }, (_, i) => `scan-${String(i + 1).padStart(3, '0')}`);

      const checkpoint: Checkpoint = {
        inputFile: 'resume-test.csv',
        processedScanIds: processedIds,
        lastBatch: 5,
        lastMiniBatch: 10,
        startedAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T12:00:00Z',
      };

      await manager.saveCheckpoint(checkpoint);

      // Load checkpoint in a new manager instance
      const resumeManager = new CheckpointManager(checkpointPath);
      const loadedCheckpoint = await resumeManager.loadCheckpoint();

      expect(loadedCheckpoint).not.toBeNull();
      expect(loadedCheckpoint?.processedScanIds).toHaveLength(50);

      // Test isProcessed for all 50 IDs
      for (let i = 1; i <= 50; i++) {
        const scanId = `scan-${String(i).padStart(3, '0')}`;
        expect(resumeManager.isProcessed(scanId)).toBe(true);
      }

      // Test that unprocessed IDs return false
      expect(resumeManager.isProcessed('scan-051')).toBe(false);
      expect(resumeManager.isProcessed('scan-100')).toBe(false);
      expect(resumeManager.isProcessed('unprocessed-id')).toBe(false);
    });

    it('should correctly identify processed vs unprocessed IDs', async () => {
      const processedIds = [
        'scan-001',
        'scan-003',
        'scan-005',
        'scan-007',
        'scan-009', // Only odd numbers
      ];

      const checkpoint: Checkpoint = {
        inputFile: 'test.csv',
        processedScanIds: processedIds,
        lastBatch: 0,
        lastMiniBatch: 0,
        startedAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T10:00:00Z',
      };

      await manager.saveCheckpoint(checkpoint);
      await manager.loadCheckpoint();

      // Test odd numbers (processed)
      expect(manager.isProcessed('scan-001')).toBe(true);
      expect(manager.isProcessed('scan-003')).toBe(true);
      expect(manager.isProcessed('scan-005')).toBe(true);
      expect(manager.isProcessed('scan-007')).toBe(true);
      expect(manager.isProcessed('scan-009')).toBe(true);

      // Test even numbers (not processed)
      expect(manager.isProcessed('scan-002')).toBe(false);
      expect(manager.isProcessed('scan-004')).toBe(false);
      expect(manager.isProcessed('scan-006')).toBe(false);
      expect(manager.isProcessed('scan-008')).toBe(false);
      expect(manager.isProcessed('scan-010')).toBe(false);
    });

    it('should return false for isProcessed when no checkpoint loaded', async () => {
      // Don't load any checkpoint
      const newManager = new CheckpointManager(checkpointPath);

      expect(newManager.isProcessed('scan-001')).toBe(false);
      expect(newManager.isProcessed('any-id')).toBe(false);
    });
  });

  describe('initCheckpoint()', () => {
    it('should create checkpoint with initial values', () => {
      const checkpoint = manager.initCheckpoint('input.csv');

      expect(checkpoint.inputFile).toBe('input.csv');
      expect(checkpoint.processedScanIds).toEqual([]);
      expect(checkpoint.lastBatch).toBe(0);
      expect(checkpoint.lastMiniBatch).toBe(0);
      expect(checkpoint.startedAt).toBeDefined();
      expect(checkpoint.updatedAt).toBeDefined();
      expect(checkpoint.startedAt).toBe(checkpoint.updatedAt);
    });

    it('should set timestamps to current time', () => {
      const before = new Date();
      const checkpoint = manager.initCheckpoint('test.csv');
      const after = new Date();

      const startedAt = new Date(checkpoint.startedAt);
      const updatedAt = new Date(checkpoint.updatedAt);

      expect(startedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(startedAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(updatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('Integration - full workflow', () => {
    it('should handle complete checkpoint lifecycle', async () => {
      // 1. Initialize checkpoint
      const checkpoint = manager.initCheckpoint('scans.csv');
      await manager.saveCheckpoint(checkpoint);

      // 2. Process first batch and buffer IDs
      manager.markProcessed(['scan-001', 'scan-002']);
      await manager.flush();

      // 3. Process second batch and buffer IDs
      manager.markProcessed(['scan-003', 'scan-004', 'scan-005']);
      await manager.flush();

      // 4. Load checkpoint in new manager instance (simulate resume)
      const resumeManager = new CheckpointManager(checkpointPath);
      const loadedCheckpoint = await resumeManager.loadCheckpoint();

      // 5. Verify all processed IDs are tracked
      expect(loadedCheckpoint?.processedScanIds).toEqual([
        'scan-001',
        'scan-002',
        'scan-003',
        'scan-004',
        'scan-005',
      ]);

      // 6. Check isProcessed for all IDs
      expect(resumeManager.isProcessed('scan-001')).toBe(true);
      expect(resumeManager.isProcessed('scan-005')).toBe(true);
      expect(resumeManager.isProcessed('scan-006')).toBe(false);

      // 7. Process more IDs after resume
      resumeManager.markProcessed(['scan-006']);
      await resumeManager.flush();

      // 8. Verify cumulative state
      const finalContent = await readFile(checkpointPath, 'utf-8');
      const finalCheckpoint = JSON.parse(finalContent);
      expect(finalCheckpoint.processedScanIds).toEqual([
        'scan-001',
        'scan-002',
        'scan-003',
        'scan-004',
        'scan-005',
        'scan-006',
      ]);

      // 9. Clear checkpoint when done
      await resumeManager.clearCheckpoint();
      await expect(access(checkpointPath)).rejects.toThrow();
    });

    it('should handle resume scenario with partial progress', async () => {
      // Simulate interrupted processing
      const checkpoint: Checkpoint = {
        inputFile: 'scans.csv',
        processedScanIds: ['scan-001', 'scan-002', 'scan-003'],
        lastBatch: 1,
        lastMiniBatch: 2,
        startedAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T10:30:00Z',
      };

      await manager.saveCheckpoint(checkpoint);

      // Resume processing
      const resumeManager = new CheckpointManager(checkpointPath);
      await resumeManager.loadCheckpoint();

      // Skip already processed scans
      const allScans = ['scan-001', 'scan-002', 'scan-003', 'scan-004', 'scan-005'];
      const toProcess = allScans.filter((id) => !resumeManager.isProcessed(id));

      expect(toProcess).toEqual(['scan-004', 'scan-005']);

      // Process remaining scans
      resumeManager.markProcessed(toProcess);
      await resumeManager.flush();

      // Verify all scans are now processed
      const finalCheckpoint = await resumeManager.loadCheckpoint();
      expect(finalCheckpoint?.processedScanIds).toHaveLength(5);
      expect(finalCheckpoint?.processedScanIds).toEqual([
        'scan-001',
        'scan-002',
        'scan-003',
        'scan-004',
        'scan-005',
      ]);
    });
  });
});

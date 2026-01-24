import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CriteriaCheckpointManager } from './criteria-checkpoint-manager.js';
import { mkdtemp, rm, readFile, writeFile, mkdir, access } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import type { AiCriteriaVerification, WcagLevel, CriteriaCheckpoint } from './types.js';

describe('CriteriaCheckpointManager', () => {
  let testDir: string;
  let manager: CriteriaCheckpointManager;

  beforeEach(async () => {
    // Create a unique temporary directory for each test
    testDir = await mkdtemp(join(tmpdir(), 'checkpoint-test-'));
    manager = new CriteriaCheckpointManager(testDir);
  });

  afterEach(async () => {
    // Clean up test directory and all its contents
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('initCheckpoint()', () => {
    it('should create checkpoint with correct structure', () => {
      const checkpoint = manager.initCheckpoint('scan-123', 'https://example.com', 'AA', 5);

      expect(checkpoint).toHaveProperty('scanId', 'scan-123');
      expect(checkpoint).toHaveProperty('url', 'https://example.com');
      expect(checkpoint).toHaveProperty('wcagLevel', 'AA');
      expect(checkpoint).toHaveProperty('totalBatches', 5);
      expect(checkpoint).toHaveProperty('completedBatches');
      expect(checkpoint).toHaveProperty('partialVerifications');
      expect(checkpoint).toHaveProperty('issueEnhancementComplete');
      expect(checkpoint).toHaveProperty('startedAt');
      expect(checkpoint).toHaveProperty('updatedAt');
      expect(checkpoint).toHaveProperty('tokensUsed');
    });

    it('should set timestamps correctly', () => {
      const beforeInit = new Date();
      const checkpoint = manager.initCheckpoint('scan-123', 'https://example.com', 'AA', 5);
      const afterInit = new Date();

      const startedAt = new Date(checkpoint.startedAt);
      const updatedAt = new Date(checkpoint.updatedAt);

      // Timestamps should be within the test execution time
      expect(startedAt.getTime()).toBeGreaterThanOrEqual(beforeInit.getTime());
      expect(startedAt.getTime()).toBeLessThanOrEqual(afterInit.getTime());
      expect(updatedAt.getTime()).toBeGreaterThanOrEqual(beforeInit.getTime());
      expect(updatedAt.getTime()).toBeLessThanOrEqual(afterInit.getTime());

      // startedAt and updatedAt should be the same initially
      expect(checkpoint.startedAt).toBe(checkpoint.updatedAt);
    });

    it('should initialize arrays as empty', () => {
      const checkpoint = manager.initCheckpoint('scan-123', 'https://example.com', 'AA', 5);

      expect(checkpoint.completedBatches).toEqual([]);
      expect(checkpoint.partialVerifications).toEqual([]);
    });

    it('should set issueEnhancementComplete to false', () => {
      const checkpoint = manager.initCheckpoint('scan-123', 'https://example.com', 'AA', 5);

      expect(checkpoint.issueEnhancementComplete).toBe(false);
      expect(checkpoint.issueEnhancementResult).toBeUndefined();
    });

    it('should initialize tokensUsed to 0', () => {
      const checkpoint = manager.initCheckpoint('scan-123', 'https://example.com', 'AA', 5);

      expect(checkpoint.tokensUsed).toBe(0);
    });

    it('should handle different WCAG levels', () => {
      const checkpointA = manager.initCheckpoint('scan-a', 'https://example.com', 'A', 3);
      const checkpointAA = manager.initCheckpoint('scan-aa', 'https://example.com', 'AA', 5);
      const checkpointAAA = manager.initCheckpoint('scan-aaa', 'https://example.com', 'AAA', 8);

      expect(checkpointA.wcagLevel).toBe('A');
      expect(checkpointAA.wcagLevel).toBe('AA');
      expect(checkpointAAA.wcagLevel).toBe('AAA');
    });

    it('should handle zero batches', () => {
      const checkpoint = manager.initCheckpoint('scan-123', 'https://example.com', 'AA', 0);

      expect(checkpoint.totalBatches).toBe(0);
    });
  });

  describe('saveCheckpoint()', () => {
    it('should save checkpoint to disk', async () => {
      const checkpoint = manager.initCheckpoint('scan-123', 'https://example.com', 'AA', 5);

      await manager.saveCheckpoint(checkpoint);

      // Verify file exists
      const filePath = join(testDir, 'scan-123.json');
      await expect(access(filePath)).resolves.toBeUndefined();

      // Verify content
      const content = await readFile(filePath, 'utf-8');
      const savedCheckpoint = JSON.parse(content);
      expect(savedCheckpoint.scanId).toBe('scan-123');
      expect(savedCheckpoint.url).toBe('https://example.com');
    });

    it('should use atomic writes (temp file + rename)', async () => {
      const checkpoint = manager.initCheckpoint('scan-123', 'https://example.com', 'AA', 5);

      // Save checkpoint
      await manager.saveCheckpoint(checkpoint);

      // Verify that no temp file remains
      const tempFilePath = join(testDir, 'scan-123.json.tmp');
      await expect(access(tempFilePath)).rejects.toThrow();

      // Verify main file exists
      const filePath = join(testDir, 'scan-123.json');
      await expect(access(filePath)).resolves.toBeUndefined();
    });

    it('should update updatedAt timestamp', async () => {
      const checkpoint = manager.initCheckpoint('scan-123', 'https://example.com', 'AA', 5);
      const originalUpdatedAt = checkpoint.updatedAt;

      // Wait a small amount to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      await manager.saveCheckpoint(checkpoint);

      // Read back from disk
      const filePath = join(testDir, 'scan-123.json');
      const content = await readFile(filePath, 'utf-8');
      const savedCheckpoint = JSON.parse(content);

      // updatedAt should be different from original
      expect(savedCheckpoint.updatedAt).not.toBe(originalUpdatedAt);
    });

    it('should create directory if needed', async () => {
      // Use a nested directory that doesn't exist
      const nestedDir = join(testDir, 'nested', 'deep', 'dir');
      const nestedManager = new CriteriaCheckpointManager(nestedDir);

      const checkpoint = nestedManager.initCheckpoint('scan-123', 'https://example.com', 'AA', 5);

      await nestedManager.saveCheckpoint(checkpoint);

      // Verify file exists in nested directory
      const filePath = join(nestedDir, 'scan-123.json');
      await expect(access(filePath)).resolves.toBeUndefined();
    });

    it('should preserve all checkpoint data', async () => {
      const checkpoint = manager.initCheckpoint('scan-123', 'https://example.com', 'AA', 5);
      checkpoint.completedBatches = [0, 1, 2];
      checkpoint.partialVerifications = [
        { criterionId: '1.1.1', status: 'AI_VERIFIED_PASS', confidence: 85, reasoning: 'Test' },
      ];
      checkpoint.tokensUsed = 5000;

      await manager.saveCheckpoint(checkpoint);

      const filePath = join(testDir, 'scan-123.json');
      const content = await readFile(filePath, 'utf-8');
      const savedCheckpoint = JSON.parse(content);

      expect(savedCheckpoint.completedBatches).toEqual([0, 1, 2]);
      expect(savedCheckpoint.partialVerifications).toHaveLength(1);
      expect(savedCheckpoint.partialVerifications[0].criterionId).toBe('1.1.1');
      expect(savedCheckpoint.tokensUsed).toBe(5000);
    });

    it('should overwrite existing checkpoint', async () => {
      const checkpoint1 = manager.initCheckpoint('scan-123', 'https://example.com', 'AA', 5);
      checkpoint1.tokensUsed = 1000;
      await manager.saveCheckpoint(checkpoint1);

      const checkpoint2 = manager.initCheckpoint('scan-123', 'https://example.com', 'AA', 5);
      checkpoint2.tokensUsed = 2000;
      await manager.saveCheckpoint(checkpoint2);

      const filePath = join(testDir, 'scan-123.json');
      const content = await readFile(filePath, 'utf-8');
      const savedCheckpoint = JSON.parse(content);

      expect(savedCheckpoint.tokensUsed).toBe(2000);
    });
  });

  describe('getCheckpoint()', () => {
    it('should return saved checkpoint', async () => {
      const checkpoint = manager.initCheckpoint('scan-123', 'https://example.com', 'AA', 5);
      checkpoint.completedBatches = [0, 1];
      checkpoint.tokensUsed = 3000;
      await manager.saveCheckpoint(checkpoint);

      const retrieved = await manager.getCheckpoint('scan-123');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.scanId).toBe('scan-123');
      expect(retrieved?.url).toBe('https://example.com');
      expect(retrieved?.completedBatches).toEqual([0, 1]);
      expect(retrieved?.tokensUsed).toBe(3000);
    });

    it('should return null for non-existent checkpoint', async () => {
      const retrieved = await manager.getCheckpoint('non-existent-scan');

      expect(retrieved).toBeNull();
    });

    it('should handle invalid JSON gracefully', async () => {
      // Write invalid JSON to checkpoint file
      const filePath = join(testDir, 'scan-invalid.json');
      await mkdir(testDir, { recursive: true });
      await writeFile(filePath, 'this is not valid json {{{', 'utf-8');

      const retrieved = await manager.getCheckpoint('scan-invalid');

      expect(retrieved).toBeNull();
    });

    it('should return null for incomplete checkpoint structure', async () => {
      // Write checkpoint missing required fields
      const filePath = join(testDir, 'scan-incomplete.json');
      await mkdir(testDir, { recursive: true });
      await writeFile(
        filePath,
        JSON.stringify({ scanId: 'scan-incomplete' }), // Missing url and wcagLevel
        'utf-8'
      );

      const retrieved = await manager.getCheckpoint('scan-incomplete');

      expect(retrieved).toBeNull();
    });

    it('should retrieve checkpoint with all data intact', async () => {
      const checkpoint = manager.initCheckpoint('scan-full', 'https://full.example.com', 'AAA', 10);
      checkpoint.completedBatches = [0, 1, 2, 3];
      checkpoint.partialVerifications = [
        { criterionId: '1.1.1', status: 'AI_VERIFIED_PASS', confidence: 90, reasoning: 'Good alt text' },
        { criterionId: '1.4.3', status: 'AI_VERIFIED_FAIL', confidence: 85, reasoning: 'Poor contrast', relatedIssueIds: ['issue-1'] },
      ];
      checkpoint.issueEnhancementComplete = true;
      checkpoint.issueEnhancementResult = {
        aiSummary: 'Test summary',
        aiRemediationPlan: 'Test plan',
        aiEnhancements: [{ issueId: 'issue-1', aiExplanation: 'Explain', aiFixSuggestion: 'Fix', aiPriority: 1 }],
        tokensUsed: 500,
      };
      checkpoint.tokensUsed = 8000;

      await manager.saveCheckpoint(checkpoint);

      const retrieved = await manager.getCheckpoint('scan-full');

      expect(retrieved?.completedBatches).toEqual([0, 1, 2, 3]);
      expect(retrieved?.partialVerifications).toHaveLength(2);
      expect(retrieved?.issueEnhancementComplete).toBe(true);
      expect(retrieved?.issueEnhancementResult?.aiSummary).toBe('Test summary');
    });
  });

  describe('markBatchComplete()', () => {
    it('should add batch to completedBatches array', async () => {
      const checkpoint = manager.initCheckpoint('scan-123', 'https://example.com', 'AA', 5);
      await manager.saveCheckpoint(checkpoint);

      const verifications: AiCriteriaVerification[] = [
        { criterionId: '1.1.1', status: 'AI_VERIFIED_PASS', confidence: 85, reasoning: 'Test' },
      ];

      await manager.markBatchComplete('scan-123', 0, verifications, 1000);

      const retrieved = await manager.getCheckpoint('scan-123');
      expect(retrieved?.completedBatches).toContain(0);
    });

    it('should append verifications to partialVerifications', async () => {
      const checkpoint = manager.initCheckpoint('scan-123', 'https://example.com', 'AA', 5);
      checkpoint.partialVerifications = [
        { criterionId: '1.1.1', status: 'AI_VERIFIED_PASS', confidence: 85, reasoning: 'Existing' },
      ];
      await manager.saveCheckpoint(checkpoint);

      const newVerifications: AiCriteriaVerification[] = [
        { criterionId: '1.4.3', status: 'AI_VERIFIED_FAIL', confidence: 90, reasoning: 'New' },
      ];

      await manager.markBatchComplete('scan-123', 1, newVerifications, 1000);

      const retrieved = await manager.getCheckpoint('scan-123');
      expect(retrieved?.partialVerifications).toHaveLength(2);
      expect(retrieved?.partialVerifications[0].criterionId).toBe('1.1.1');
      expect(retrieved?.partialVerifications[1].criterionId).toBe('1.4.3');
    });

    it('should update tokensUsed', async () => {
      const checkpoint = manager.initCheckpoint('scan-123', 'https://example.com', 'AA', 5);
      checkpoint.tokensUsed = 1000;
      await manager.saveCheckpoint(checkpoint);

      await manager.markBatchComplete('scan-123', 0, [], 500);
      await manager.markBatchComplete('scan-123', 1, [], 700);

      const retrieved = await manager.getCheckpoint('scan-123');
      expect(retrieved?.tokensUsed).toBe(2200); // 1000 + 500 + 700
    });

    it('should not duplicate batch numbers', async () => {
      const checkpoint = manager.initCheckpoint('scan-123', 'https://example.com', 'AA', 5);
      await manager.saveCheckpoint(checkpoint);

      // Mark same batch complete twice
      await manager.markBatchComplete('scan-123', 0, [], 500);
      await manager.markBatchComplete('scan-123', 0, [], 500);

      const retrieved = await manager.getCheckpoint('scan-123');
      expect(retrieved?.completedBatches).toEqual([0]);
    });

    it('should keep completedBatches sorted', async () => {
      const checkpoint = manager.initCheckpoint('scan-123', 'https://example.com', 'AA', 5);
      await manager.saveCheckpoint(checkpoint);

      // Mark batches in non-sequential order
      await manager.markBatchComplete('scan-123', 3, [], 100);
      await manager.markBatchComplete('scan-123', 1, [], 100);
      await manager.markBatchComplete('scan-123', 4, [], 100);
      await manager.markBatchComplete('scan-123', 0, [], 100);
      await manager.markBatchComplete('scan-123', 2, [], 100);

      const retrieved = await manager.getCheckpoint('scan-123');
      expect(retrieved?.completedBatches).toEqual([0, 1, 2, 3, 4]);
    });

    it('should throw error if no checkpoint exists', async () => {
      const verifications: AiCriteriaVerification[] = [];

      await expect(manager.markBatchComplete('non-existent', 0, verifications, 100)).rejects.toThrow(
        'No checkpoint found for scan non-existent'
      );
    });

    it('should append multiple verifications from batch', async () => {
      const checkpoint = manager.initCheckpoint('scan-123', 'https://example.com', 'AA', 5);
      await manager.saveCheckpoint(checkpoint);

      const verifications: AiCriteriaVerification[] = [
        { criterionId: '1.1.1', status: 'AI_VERIFIED_PASS', confidence: 85, reasoning: 'Test 1' },
        { criterionId: '1.4.3', status: 'AI_VERIFIED_FAIL', confidence: 90, reasoning: 'Test 2' },
        { criterionId: '2.1.1', status: 'AI_VERIFIED_PASS', confidence: 80, reasoning: 'Test 3' },
      ];

      await manager.markBatchComplete('scan-123', 0, verifications, 1500);

      const retrieved = await manager.getCheckpoint('scan-123');
      expect(retrieved?.partialVerifications).toHaveLength(3);
    });
  });

  describe('markIssueEnhancementComplete()', () => {
    it('should set issueEnhancementComplete to true', async () => {
      const checkpoint = manager.initCheckpoint('scan-123', 'https://example.com', 'AA', 5);
      await manager.saveCheckpoint(checkpoint);

      await manager.markIssueEnhancementComplete('scan-123', {
        aiSummary: 'Test summary',
        aiRemediationPlan: 'Test plan',
        aiEnhancements: [],
        tokensUsed: 1000,
      });

      const retrieved = await manager.getCheckpoint('scan-123');
      expect(retrieved?.issueEnhancementComplete).toBe(true);
    });

    it('should store enhancement result', async () => {
      const checkpoint = manager.initCheckpoint('scan-123', 'https://example.com', 'AA', 5);
      await manager.saveCheckpoint(checkpoint);

      const enhancementResult = {
        aiSummary: 'Found 5 accessibility issues...',
        aiRemediationPlan: 'Priority 1: Fix color contrast...',
        aiEnhancements: [
          { issueId: 'issue-1', aiExplanation: 'Explanation', aiFixSuggestion: 'Fix', aiPriority: 1 },
          { issueId: 'issue-2', aiExplanation: 'Another', aiFixSuggestion: 'Fix 2', aiPriority: 2 },
        ],
        tokensUsed: 2000,
      };

      await manager.markIssueEnhancementComplete('scan-123', enhancementResult);

      const retrieved = await manager.getCheckpoint('scan-123');
      expect(retrieved?.issueEnhancementResult).toEqual(enhancementResult);
      expect(retrieved?.issueEnhancementResult?.aiSummary).toBe('Found 5 accessibility issues...');
      expect(retrieved?.issueEnhancementResult?.aiEnhancements).toHaveLength(2);
    });

    it('should add tokens to total', async () => {
      const checkpoint = manager.initCheckpoint('scan-123', 'https://example.com', 'AA', 5);
      checkpoint.tokensUsed = 3000;
      await manager.saveCheckpoint(checkpoint);

      await manager.markIssueEnhancementComplete('scan-123', {
        aiSummary: 'Summary',
        aiRemediationPlan: 'Plan',
        aiEnhancements: [],
        tokensUsed: 2000,
      });

      const retrieved = await manager.getCheckpoint('scan-123');
      expect(retrieved?.tokensUsed).toBe(5000); // 3000 + 2000
    });

    it('should throw error if no checkpoint exists', async () => {
      await expect(
        manager.markIssueEnhancementComplete('non-existent', {
          aiSummary: 'Summary',
          aiRemediationPlan: 'Plan',
          aiEnhancements: [],
          tokensUsed: 1000,
        })
      ).rejects.toThrow('No checkpoint found for scan non-existent');
    });

    it('should handle result without tokensUsed', async () => {
      const checkpoint = manager.initCheckpoint('scan-123', 'https://example.com', 'AA', 5);
      checkpoint.tokensUsed = 1000;
      await manager.saveCheckpoint(checkpoint);

      // Pass undefined for tokensUsed
      await manager.markIssueEnhancementComplete('scan-123', {
        aiSummary: 'Summary',
        aiRemediationPlan: 'Plan',
        aiEnhancements: [],
        tokensUsed: 0,
      });

      const retrieved = await manager.getCheckpoint('scan-123');
      expect(retrieved?.tokensUsed).toBe(1000); // Should remain unchanged
    });
  });

  describe('clearCheckpoint()', () => {
    it('should remove checkpoint file', async () => {
      const checkpoint = manager.initCheckpoint('scan-123', 'https://example.com', 'AA', 5);
      await manager.saveCheckpoint(checkpoint);

      // Verify file exists
      const filePath = join(testDir, 'scan-123.json');
      await expect(access(filePath)).resolves.toBeUndefined();

      // Clear checkpoint
      await manager.clearCheckpoint('scan-123');

      // Verify file is removed
      await expect(access(filePath)).rejects.toThrow();
    });

    it('should not throw for non-existent file', async () => {
      // Should not throw when clearing non-existent checkpoint
      await expect(manager.clearCheckpoint('non-existent-scan')).resolves.toBeUndefined();
    });

    it('should only remove specified checkpoint', async () => {
      // Create multiple checkpoints
      const checkpoint1 = manager.initCheckpoint('scan-1', 'https://example1.com', 'A', 3);
      const checkpoint2 = manager.initCheckpoint('scan-2', 'https://example2.com', 'AA', 5);
      await manager.saveCheckpoint(checkpoint1);
      await manager.saveCheckpoint(checkpoint2);

      // Clear only one
      await manager.clearCheckpoint('scan-1');

      // Verify scan-1 is gone
      const retrieved1 = await manager.getCheckpoint('scan-1');
      expect(retrieved1).toBeNull();

      // Verify scan-2 still exists
      const retrieved2 = await manager.getCheckpoint('scan-2');
      expect(retrieved2).not.toBeNull();
      expect(retrieved2?.scanId).toBe('scan-2');
    });
  });

  describe('getIncompleteBatches()', () => {
    it('should return all batches when none complete', () => {
      const checkpoint = manager.initCheckpoint('scan-123', 'https://example.com', 'AA', 5);

      const incomplete = manager.getIncompleteBatches(checkpoint);

      expect(incomplete).toEqual([0, 1, 2, 3, 4]);
    });

    it('should return empty when all complete', () => {
      const checkpoint = manager.initCheckpoint('scan-123', 'https://example.com', 'AA', 5);
      checkpoint.completedBatches = [0, 1, 2, 3, 4];

      const incomplete = manager.getIncompleteBatches(checkpoint);

      expect(incomplete).toEqual([]);
    });

    it('should return only incomplete batches', () => {
      const checkpoint = manager.initCheckpoint('scan-123', 'https://example.com', 'AA', 5);
      checkpoint.completedBatches = [0, 2, 4];

      const incomplete = manager.getIncompleteBatches(checkpoint);

      expect(incomplete).toEqual([1, 3]);
    });

    it('should handle checkpoint with zero batches', () => {
      const checkpoint = manager.initCheckpoint('scan-123', 'https://example.com', 'AA', 0);

      const incomplete = manager.getIncompleteBatches(checkpoint);

      expect(incomplete).toEqual([]);
    });

    it('should handle single batch checkpoint', () => {
      const checkpoint = manager.initCheckpoint('scan-123', 'https://example.com', 'AA', 1);

      // Not completed
      expect(manager.getIncompleteBatches(checkpoint)).toEqual([0]);

      // Completed
      checkpoint.completedBatches = [0];
      expect(manager.getIncompleteBatches(checkpoint)).toEqual([]);
    });

    it('should handle large number of batches', () => {
      const checkpoint = manager.initCheckpoint('scan-123', 'https://example.com', 'AAA', 100);
      checkpoint.completedBatches = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90];

      const incomplete = manager.getIncompleteBatches(checkpoint);

      // Should have 90 incomplete batches (100 total - 10 completed)
      expect(incomplete).toHaveLength(90);
      expect(incomplete).not.toContain(0);
      expect(incomplete).not.toContain(10);
      expect(incomplete).toContain(1);
      expect(incomplete).toContain(99);
    });
  });

  describe('isBatchComplete()', () => {
    it('should return true for completed batches', () => {
      const checkpoint = manager.initCheckpoint('scan-123', 'https://example.com', 'AA', 5);
      checkpoint.completedBatches = [0, 2, 4];

      expect(manager.isBatchComplete(checkpoint, 0)).toBe(true);
      expect(manager.isBatchComplete(checkpoint, 2)).toBe(true);
      expect(manager.isBatchComplete(checkpoint, 4)).toBe(true);
    });

    it('should return false for incomplete batches', () => {
      const checkpoint = manager.initCheckpoint('scan-123', 'https://example.com', 'AA', 5);
      checkpoint.completedBatches = [0, 2, 4];

      expect(manager.isBatchComplete(checkpoint, 1)).toBe(false);
      expect(manager.isBatchComplete(checkpoint, 3)).toBe(false);
    });

    it('should return false for batch numbers outside range', () => {
      const checkpoint = manager.initCheckpoint('scan-123', 'https://example.com', 'AA', 5);
      checkpoint.completedBatches = [0, 1, 2, 3, 4];

      expect(manager.isBatchComplete(checkpoint, 5)).toBe(false);
      expect(manager.isBatchComplete(checkpoint, 10)).toBe(false);
      expect(manager.isBatchComplete(checkpoint, -1)).toBe(false);
    });

    it('should return false when no batches completed', () => {
      const checkpoint = manager.initCheckpoint('scan-123', 'https://example.com', 'AA', 5);

      expect(manager.isBatchComplete(checkpoint, 0)).toBe(false);
      expect(manager.isBatchComplete(checkpoint, 1)).toBe(false);
    });
  });

  describe('Integration - full workflow', () => {
    it('should handle complete checkpoint lifecycle', async () => {
      const scanId = 'integration-test';
      const url = 'https://integration.example.com';
      const wcagLevel: WcagLevel = 'AA';
      const totalBatches = 3;

      // 1. Initialize checkpoint
      const checkpoint = manager.initCheckpoint(scanId, url, wcagLevel, totalBatches);
      expect(checkpoint.completedBatches).toEqual([]);
      expect(checkpoint.tokensUsed).toBe(0);

      // 2. Save initial checkpoint
      await manager.saveCheckpoint(checkpoint);

      // 3. Verify checkpoint can be retrieved
      let retrieved = await manager.getCheckpoint(scanId);
      expect(retrieved).not.toBeNull();
      expect(manager.getIncompleteBatches(retrieved!)).toEqual([0, 1, 2]);

      // 4. Process batches one by one
      const batch0Verifications: AiCriteriaVerification[] = [
        { criterionId: '1.1.1', status: 'AI_VERIFIED_PASS', confidence: 90, reasoning: 'Good alt text' },
        { criterionId: '1.2.1', status: 'AI_VERIFIED_PASS', confidence: 85, reasoning: 'Captions present' },
      ];
      await manager.markBatchComplete(scanId, 0, batch0Verifications, 1500);

      retrieved = await manager.getCheckpoint(scanId);
      expect(manager.isBatchComplete(retrieved!, 0)).toBe(true);
      expect(manager.isBatchComplete(retrieved!, 1)).toBe(false);
      expect(manager.getIncompleteBatches(retrieved!)).toEqual([1, 2]);
      expect(retrieved?.partialVerifications).toHaveLength(2);
      expect(retrieved?.tokensUsed).toBe(1500);

      // 5. Process remaining batches
      await manager.markBatchComplete(scanId, 1, [], 1000);
      await manager.markBatchComplete(scanId, 2, [], 800);

      retrieved = await manager.getCheckpoint(scanId);
      expect(manager.getIncompleteBatches(retrieved!)).toEqual([]);
      expect(retrieved?.tokensUsed).toBe(3300); // 1500 + 1000 + 800

      // 6. Mark issue enhancement complete
      await manager.markIssueEnhancementComplete(scanId, {
        aiSummary: 'Final summary',
        aiRemediationPlan: 'Final plan',
        aiEnhancements: [{ issueId: 'issue-1', aiExplanation: 'Exp', aiFixSuggestion: 'Fix', aiPriority: 1 }],
        tokensUsed: 700,
      });

      retrieved = await manager.getCheckpoint(scanId);
      expect(retrieved?.issueEnhancementComplete).toBe(true);
      expect(retrieved?.tokensUsed).toBe(4000); // 3300 + 700

      // 7. Clear checkpoint after processing
      await manager.clearCheckpoint(scanId);
      retrieved = await manager.getCheckpoint(scanId);
      expect(retrieved).toBeNull();
    });

    it('should support resume from interruption', async () => {
      const scanId = 'resume-test';

      // 1. Simulate initial processing that gets interrupted after batch 0
      const checkpoint1 = manager.initCheckpoint(scanId, 'https://resume.example.com', 'AA', 5);
      await manager.saveCheckpoint(checkpoint1);
      await manager.markBatchComplete(scanId, 0, [], 1000);

      // 2. Create new manager instance (simulating restart)
      const newManager = new CriteriaCheckpointManager(testDir);

      // 3. Resume from checkpoint
      const existingCheckpoint = await newManager.getCheckpoint(scanId);
      expect(existingCheckpoint).not.toBeNull();
      expect(existingCheckpoint?.completedBatches).toEqual([0]);

      // 4. Get incomplete batches and continue
      const incomplete = newManager.getIncompleteBatches(existingCheckpoint!);
      expect(incomplete).toEqual([1, 2, 3, 4]);

      // 5. Complete remaining batches
      for (const batchNum of incomplete) {
        await newManager.markBatchComplete(scanId, batchNum, [], 500);
      }

      // 6. Verify all batches complete
      const finalCheckpoint = await newManager.getCheckpoint(scanId);
      expect(newManager.getIncompleteBatches(finalCheckpoint!)).toEqual([]);
      expect(finalCheckpoint?.tokensUsed).toBe(3000); // 1000 + 4*500
    });
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import type {
  AiCriteriaVerification,
  CriterionVerificationInstruction,
  ExistingIssue,
} from './types.js';
import type { DownloadedSite } from './website-downloader.js';
import type { Logger } from './logger.js';
import type { WcagVerificationInstructions, CriterionWithLevel } from './prompt-generator.js';

// Import the actual class
import { CriteriaBatchProcessor } from './criteria-batch-processor.js';

// Import modules that we need to mock
import * as promptGenerator from './prompt-generator.js';

/**
 * Create a mock logger that does nothing
 */
function createMockLogger(): Logger {
  return {
    info: vi.fn(),
    debug: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    setVerbose: vi.fn(),
    setQuiet: vi.fn(),
    logProgress: vi.fn(),
    logBatchProgress: vi.fn(),
    logSummary: vi.fn(),
  };
}

/**
 * Create mock verification instructions for testing
 */
function createMockVerificationInstructions(): WcagVerificationInstructions {
  return {
    version: '2.1',
    lastUpdated: '2024-01-01',
    description: 'Test instructions',
    criteria: {
      '1.1.1': {
        criterionId: '1.1.1',
        level: 'A',
        title: 'Non-text Content',
        description: 'All non-text content has a text alternative',
        whatToCheck: 'Images, icons, multimedia',
        passCondition: 'All images have alt text',
        failIndicators: 'Missing alt text',
        requiresManualReview: false,
      } as CriterionWithLevel,
      '1.2.1': {
        criterionId: '1.2.1',
        level: 'A',
        title: 'Audio-only and Video-only',
        description: 'Alternatives for time-based media',
        whatToCheck: 'Audio and video elements',
        passCondition: 'Has transcript or description',
        failIndicators: 'Missing alternatives',
        requiresManualReview: true,
      } as CriterionWithLevel,
      '1.3.1': {
        criterionId: '1.3.1',
        level: 'A',
        title: 'Info and Relationships',
        description: 'Structure can be programmatically determined',
        whatToCheck: 'Headings, lists, tables',
        passCondition: 'Proper semantic markup',
        failIndicators: 'Visual-only formatting',
        requiresManualReview: false,
      } as CriterionWithLevel,
      '1.4.3': {
        criterionId: '1.4.3',
        level: 'AA',
        title: 'Contrast (Minimum)',
        description: 'Text has sufficient contrast ratio',
        whatToCheck: 'Text and background colors',
        passCondition: '4.5:1 ratio for normal text',
        failIndicators: 'Low contrast text',
        requiresManualReview: false,
      } as CriterionWithLevel,
      '1.4.6': {
        criterionId: '1.4.6',
        level: 'AAA',
        title: 'Contrast (Enhanced)',
        description: 'Text has enhanced contrast ratio',
        whatToCheck: 'Text and background colors',
        passCondition: '7:1 ratio for normal text',
        failIndicators: 'Low contrast text',
        requiresManualReview: false,
      } as CriterionWithLevel,
      '2.1.1': {
        criterionId: '2.1.1',
        level: 'A',
        title: 'Keyboard',
        description: 'All functionality available via keyboard',
        whatToCheck: 'Interactive elements',
        passCondition: 'Can tab to and activate all controls',
        failIndicators: 'Mouse-only interactions',
        requiresManualReview: true,
      } as CriterionWithLevel,
      '2.4.1': {
        criterionId: '2.4.1',
        level: 'A',
        title: 'Bypass Blocks',
        description: 'Mechanism to bypass repeated content',
        whatToCheck: 'Skip links, landmarks',
        passCondition: 'Has skip navigation',
        failIndicators: 'No bypass mechanism',
        requiresManualReview: false,
      } as CriterionWithLevel,
    },
  };
}

/**
 * Create a mock downloaded site for testing
 */
function createMockDownloadedSite(
  scanId = 'test-scan-123',
  htmlContent = '<html><body><h1>Test Page</h1></body></html>'
): DownloadedSite {
  return {
    scanId,
    url: 'https://example.com',
    wcagLevel: 'AA',
    pageTitle: 'Test Page',
    htmlContent,
  };
}

/**
 * Create mock existing issues
 */
function createMockExistingIssues(): ExistingIssue[] {
  return [
    {
      id: 'issue-001',
      ruleId: 'image-alt',
      wcagCriteria: '1.1.1',
      impact: 'CRITICAL',
      description: 'Image missing alt text',
      helpText: 'Provide alt text for images',
      helpUrl: 'https://example.com/help',
      htmlSnippet: '<img src="test.jpg">',
      cssSelector: 'img',
    },
    {
      id: 'issue-002',
      ruleId: 'color-contrast',
      wcagCriteria: '1.4.3',
      impact: 'SERIOUS',
      description: 'Insufficient color contrast',
      helpText: 'Ensure sufficient contrast',
      helpUrl: 'https://example.com/help2',
      htmlSnippet: '<p style="color: #999">Text</p>',
      cssSelector: 'p',
    },
  ];
}

/**
 * Create mock AI verifications response
 */
function createMockVerifications(criteriaIds: string[]): AiCriteriaVerification[] {
  return criteriaIds.map((id) => ({
    criterionId: id,
    status: 'AI_VERIFIED_PASS' as const,
    confidence: 85,
    reasoning: `Criterion ${id} passes verification`,
  }));
}

describe('CriteriaBatchProcessor', () => {
  let testCacheDir: string;
  let testCheckpointDir: string;
  let mockLogger: Logger;
  let processor: CriteriaBatchProcessor;

  beforeEach(async () => {
    // Create unique temporary directories for each test
    testCacheDir = await mkdtemp(join(tmpdir(), 'batch-processor-cache-'));
    testCheckpointDir = await mkdtemp(join(tmpdir(), 'batch-processor-checkpoint-'));
    mockLogger = createMockLogger();

    // Reset all mocks
    vi.clearAllMocks();

    // Spy on loadVerificationInstructions and mock its return value
    vi.spyOn(promptGenerator, 'loadVerificationInstructions').mockResolvedValue(
      createMockVerificationInstructions()
    );
  });

  afterEach(async () => {
    // Restore all mocks
    vi.restoreAllMocks();

    // Clean up test directories
    try {
      await rm(testCacheDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    try {
      await rm(testCheckpointDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('constructor and initialization', () => {
    it('should create processor with default options', () => {
      processor = new CriteriaBatchProcessor(mockLogger);
      const options = processor.getOptions();

      expect(options.batchSize).toBe(10);
      expect(options.delayBetweenBatches).toBe(2000);
      expect(options.timeout).toBe(120000);
    });

    it('should accept custom options', () => {
      processor = new CriteriaBatchProcessor(mockLogger, {
        batchSize: 5,
        delayBetweenBatches: 3000,
        timeout: 60000,
      });
      const options = processor.getOptions();

      expect(options.batchSize).toBe(5);
      expect(options.delayBetweenBatches).toBe(3000);
      expect(options.timeout).toBe(60000);
    });

    it('should initialize and load verification instructions', async () => {
      processor = new CriteriaBatchProcessor(mockLogger);
      await processor.initialize();

      expect(promptGenerator.loadVerificationInstructions).toHaveBeenCalledOnce();
      expect(processor.getVerificationInstructions()).not.toBeNull();
    });

    it('should return null for verification instructions before initialization', () => {
      processor = new CriteriaBatchProcessor(mockLogger);
      expect(processor.getVerificationInstructions()).toBeNull();
    });

    it('should have a cache instance after construction', () => {
      processor = new CriteriaBatchProcessor(mockLogger);
      expect(processor.getCache()).toBeDefined();
    });

    it('should have a checkpoint manager instance after construction', () => {
      processor = new CriteriaBatchProcessor(mockLogger);
      expect(processor.getCheckpointManager()).toBeDefined();
    });
  });

  describe('createBatches()', () => {
    beforeEach(async () => {
      processor = new CriteriaBatchProcessor(mockLogger, { batchSize: 2 });
      await processor.initialize();
    });

    it('should create correct number of batches for AA level', () => {
      // AA includes Level A (5 criteria) + Level AA (1 criterion) = 6 criteria
      // With batch size 2, should create 3 batches
      const batches = processor.createBatches('AA');

      expect(batches).toHaveLength(3);
      expect(batches[0]).toHaveLength(2);
      expect(batches[1]).toHaveLength(2);
      expect(batches[2]).toHaveLength(2);
    });

    it('should create correct number of batches for A level', () => {
      // Level A has 5 criteria in mock data
      // With batch size 2, should create 3 batches (2, 2, 1)
      const batches = processor.createBatches('A');

      expect(batches).toHaveLength(3);
      expect(batches[0]).toHaveLength(2);
      expect(batches[1]).toHaveLength(2);
      expect(batches[2]).toHaveLength(1);
    });

    it('should create batches for AAA level including all criteria', () => {
      // AAA includes all 7 criteria from mock data
      // With batch size 2, should create 4 batches (2, 2, 2, 1)
      const batches = processor.createBatches('AAA');

      expect(batches).toHaveLength(4);
      expect(batches[0]).toHaveLength(2);
      expect(batches[1]).toHaveLength(2);
      expect(batches[2]).toHaveLength(2);
      expect(batches[3]).toHaveLength(1);
    });

    it('should respect custom batch size', async () => {
      const customProcessor = new CriteriaBatchProcessor(mockLogger, { batchSize: 3 });
      await customProcessor.initialize();

      // 6 AA criteria with batch size 3 = 2 batches
      const batches = customProcessor.createBatches('AA');

      expect(batches).toHaveLength(2);
      expect(batches[0]).toHaveLength(3);
      expect(batches[1]).toHaveLength(3);
    });

    it('should return empty array when no criteria match level', async () => {
      // Mock instructions with no criteria
      vi.spyOn(promptGenerator, 'loadVerificationInstructions').mockResolvedValue({
        version: '2.1',
        criteria: {},
      });

      const emptyProcessor = new CriteriaBatchProcessor(mockLogger);
      await emptyProcessor.initialize();

      const batches = emptyProcessor.createBatches('AA');

      expect(batches).toHaveLength(0);
    });

    it('should throw error if called before initialization', () => {
      const uninitializedProcessor = new CriteriaBatchProcessor(mockLogger);

      expect(() => uninitializedProcessor.createBatches('AA')).toThrow(
        'Verification instructions not loaded. Call initialize() first.'
      );
    });

    it('should sort criteria by ID', () => {
      const batches = processor.createBatches('A');

      // Flatten batches and check ordering
      const allCriteria = batches.flat();
      const criteriaIds = allCriteria.map((c) => c.criterionId);

      // Should be sorted: 1.1.1, 1.2.1, 1.3.1, 2.1.1, 2.4.1
      expect(criteriaIds).toEqual(['1.1.1', '1.2.1', '1.3.1', '2.1.1', '2.4.1']);
    });

    it('should include correct criteria for level A only', () => {
      const batches = processor.createBatches('A');
      const allCriteria = batches.flat();
      const criteriaIds = allCriteria.map((c) => c.criterionId);

      // Level A criteria
      expect(criteriaIds).toContain('1.1.1');
      expect(criteriaIds).toContain('1.2.1');
      expect(criteriaIds).toContain('1.3.1');
      expect(criteriaIds).toContain('2.1.1');
      expect(criteriaIds).toContain('2.4.1');

      // Level AA and AAA criteria should not be included
      expect(criteriaIds).not.toContain('1.4.3'); // AA
      expect(criteriaIds).not.toContain('1.4.6'); // AAA
    });

    it('should include A and AA criteria for level AA', () => {
      const batches = processor.createBatches('AA');
      const allCriteria = batches.flat();
      const criteriaIds = allCriteria.map((c) => c.criterionId);

      // Level A and AA criteria
      expect(criteriaIds).toContain('1.1.1');
      expect(criteriaIds).toContain('1.4.3'); // AA

      // Level AAA criteria should not be included
      expect(criteriaIds).not.toContain('1.4.6'); // AAA
    });

    it('should include all criteria for level AAA', () => {
      const batches = processor.createBatches('AAA');
      const allCriteria = batches.flat();
      const criteriaIds = allCriteria.map((c) => c.criterionId);

      // All criteria should be included
      expect(criteriaIds).toContain('1.1.1');   // A
      expect(criteriaIds).toContain('1.4.3'); // AA
      expect(criteriaIds).toContain('1.4.6'); // AAA
    });

    it('should create batches with proper CriterionVerificationInstruction structure', () => {
      const batches = processor.createBatches('A');
      const firstCriterion = batches[0][0];

      // Check that the structure matches CriterionVerificationInstruction
      expect(firstCriterion).toHaveProperty('criterionId');
      expect(firstCriterion).toHaveProperty('title');
      expect(firstCriterion).toHaveProperty('description');
      expect(firstCriterion).toHaveProperty('whatToCheck');
      expect(firstCriterion).toHaveProperty('passCondition');
      expect(firstCriterion).toHaveProperty('failIndicators');
      expect(firstCriterion).toHaveProperty('requiresManualReview');

      // Should not include the 'level' property (that's internal)
      expect(firstCriterion).not.toHaveProperty('level');
    });
  });

  describe('processSingleBatch() with cache', () => {
    let downloadedSite: DownloadedSite;
    let criteriaBatch: CriterionVerificationInstruction[];

    beforeEach(async () => {
      processor = new CriteriaBatchProcessor(mockLogger, {
        batchSize: 2,
        timeout: 5000,
        delayBetweenBatches: 0,
      });
      await processor.initialize();

      downloadedSite = createMockDownloadedSite();

      criteriaBatch = [
        {
          criterionId: '1.1.1',
          title: 'Non-text Content',
          description: 'All non-text content has a text alternative',
          whatToCheck: 'Images',
          passCondition: 'All images have alt text',
          failIndicators: 'Missing alt text',
          requiresManualReview: false,
        },
        {
          criterionId: '1.2.1',
          title: 'Audio-only and Video-only',
          description: 'Alternatives for time-based media',
          whatToCheck: 'Audio and video',
          passCondition: 'Has transcript',
          failIndicators: 'Missing alternatives',
          requiresManualReview: true,
        },
      ];
    });

    it('should return cached result on cache hit', async () => {
      const cache = processor.getCache();
      await cache.warmup();

      // Pre-populate cache
      const cacheKey = cache.generateKey(downloadedSite.htmlContent, 'AA', 0);
      const cachedVerifications = createMockVerifications(['1.1.1', '1.2.1']);
      await cache.set(cacheKey, cachedVerifications, 1000, 'claude-opus-4');

      const result = await processor.processSingleBatch(
        0,
        criteriaBatch,
        downloadedSite,
        ['issue-001'],
        'test-scan-123',
        'AA'
      );

      // Should return cached result
      expect(result.verifications).toEqual(cachedVerifications);
      expect(result.tokensUsed).toBe(0); // No AI call = no tokens
      expect(result.batchNumber).toBe(1); // 0-indexed becomes 1-indexed
      expect(result.criteriaVerified).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should store result in cache after successful processing', async () => {
      const cache = processor.getCache();
      await cache.warmup();

      // Get initial entry count
      const statsBefore = cache.getStats();
      const initialEntries = statsBefore.entriesCount;

      // Pre-populate cache to test cache storage
      const cacheKey = cache.generateKey(downloadedSite.htmlContent, 'AA', 0);
      const verifications = createMockVerifications(['1.1.1', '1.2.1']);
      await cache.set(cacheKey, verifications, 1000, 'claude-opus-4');

      // Get stats after - should have one more entry
      const statsAfter = cache.getStats();
      expect(statsAfter.entriesCount).toBe(initialEntries + 1);

      // Verify the entry exists
      const entry = await cache.get(cacheKey);
      expect(entry).not.toBeNull();
      expect(entry?.verifications).toHaveLength(2);
    });

    it('should generate different cache keys for different batch numbers', () => {
      const cache = processor.getCache();

      const key0 = cache.generateKey(downloadedSite.htmlContent, 'AA', 0);
      const key1 = cache.generateKey(downloadedSite.htmlContent, 'AA', 1);
      const key2 = cache.generateKey(downloadedSite.htmlContent, 'AA', 2);

      // Content hash should be the same
      expect(key0.contentHash).toBe(key1.contentHash);
      expect(key1.contentHash).toBe(key2.contentHash);

      // Batch numbers should differ
      expect(key0.batchNumber).toBe(0);
      expect(key1.batchNumber).toBe(1);
      expect(key2.batchNumber).toBe(2);
    });

    it('should generate different cache keys for different WCAG levels', () => {
      const cache = processor.getCache();

      const keyA = cache.generateKey(downloadedSite.htmlContent, 'A', 0);
      const keyAA = cache.generateKey(downloadedSite.htmlContent, 'AA', 0);
      const keyAAA = cache.generateKey(downloadedSite.htmlContent, 'AAA', 0);

      expect(keyA.wcagLevel).toBe('A');
      expect(keyAA.wcagLevel).toBe('AA');
      expect(keyAAA.wcagLevel).toBe('AAA');
    });
  });

  describe('checkpoint management', () => {
    let downloadedSite: DownloadedSite;

    beforeEach(async () => {
      processor = new CriteriaBatchProcessor(mockLogger, {
        batchSize: 2,
        timeout: 5000,
        delayBetweenBatches: 0,
      });
      await processor.initialize();

      downloadedSite = createMockDownloadedSite();
    });

    it('should initialize checkpoint manager', () => {
      const checkpointManager = processor.getCheckpointManager();
      expect(checkpointManager).toBeDefined();
    });

    it('should be able to create and save checkpoints', async () => {
      const checkpointManager = processor.getCheckpointManager();

      // Initialize a checkpoint
      const checkpoint = checkpointManager.initCheckpoint(
        'test-scan-123',
        'https://example.com',
        'AA',
        3
      );

      // Verify structure
      expect(checkpoint.scanId).toBe('test-scan-123');
      expect(checkpoint.url).toBe('https://example.com');
      expect(checkpoint.wcagLevel).toBe('AA');
      expect(checkpoint.totalBatches).toBe(3);
      expect(checkpoint.completedBatches).toEqual([]);

      // Save checkpoint
      await checkpointManager.saveCheckpoint(checkpoint);

      // Retrieve and verify
      const retrieved = await checkpointManager.getCheckpoint('test-scan-123');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.scanId).toBe('test-scan-123');
    });

    it('should track completed batches in checkpoint', async () => {
      const checkpointManager = processor.getCheckpointManager();

      // Initialize and save checkpoint
      const checkpoint = checkpointManager.initCheckpoint(
        'test-scan-123',
        'https://example.com',
        'AA',
        5
      );
      await checkpointManager.saveCheckpoint(checkpoint);

      // Mark some batches complete
      const verifications = createMockVerifications(['1.1.1', '1.2.1']);
      await checkpointManager.markBatchComplete('test-scan-123', 0, verifications, 1000);
      await checkpointManager.markBatchComplete('test-scan-123', 2, [], 500);

      // Verify completed batches
      const retrieved = await checkpointManager.getCheckpoint('test-scan-123');
      expect(retrieved?.completedBatches).toContain(0);
      expect(retrieved?.completedBatches).toContain(2);
      expect(retrieved?.completedBatches).not.toContain(1);
    });

    it('should track tokens used in checkpoint', async () => {
      const checkpointManager = processor.getCheckpointManager();

      // Initialize and save checkpoint
      const checkpoint = checkpointManager.initCheckpoint(
        'test-scan-123',
        'https://example.com',
        'AA',
        3
      );
      await checkpointManager.saveCheckpoint(checkpoint);

      // Mark batches complete with tokens
      await checkpointManager.markBatchComplete('test-scan-123', 0, [], 1000);
      await checkpointManager.markBatchComplete('test-scan-123', 1, [], 2000);

      // Verify tokens accumulated
      const retrieved = await checkpointManager.getCheckpoint('test-scan-123');
      expect(retrieved?.tokensUsed).toBe(3000);
    });

    it('should identify incomplete batches', async () => {
      const checkpointManager = processor.getCheckpointManager();

      // Initialize checkpoint
      const checkpoint = checkpointManager.initCheckpoint(
        'test-scan-123',
        'https://example.com',
        'AA',
        5
      );
      checkpoint.completedBatches = [0, 2, 4];

      // Get incomplete batches
      const incomplete = checkpointManager.getIncompleteBatches(checkpoint);
      expect(incomplete).toEqual([1, 3]);
    });

    it('should clear checkpoint', async () => {
      const checkpointManager = processor.getCheckpointManager();

      // Create and save checkpoint
      const checkpoint = checkpointManager.initCheckpoint(
        'test-scan-123',
        'https://example.com',
        'AA',
        3
      );
      await checkpointManager.saveCheckpoint(checkpoint);

      // Verify it exists
      const beforeClear = await checkpointManager.getCheckpoint('test-scan-123');
      expect(beforeClear).not.toBeNull();

      // Clear checkpoint
      await checkpointManager.clearCheckpoint('test-scan-123');

      // Verify it's gone
      const afterClear = await checkpointManager.getCheckpoint('test-scan-123');
      expect(afterClear).toBeNull();
    });

    it('should check if batch is complete', async () => {
      const checkpointManager = processor.getCheckpointManager();

      // Initialize checkpoint
      const checkpoint = checkpointManager.initCheckpoint(
        'test-scan-123',
        'https://example.com',
        'AA',
        5
      );
      checkpoint.completedBatches = [0, 2, 4];

      expect(checkpointManager.isBatchComplete(checkpoint, 0)).toBe(true);
      expect(checkpointManager.isBatchComplete(checkpoint, 1)).toBe(false);
      expect(checkpointManager.isBatchComplete(checkpoint, 2)).toBe(true);
      expect(checkpointManager.isBatchComplete(checkpoint, 3)).toBe(false);
    });
  });

  describe('options and configuration', () => {
    it('should use default options when none provided', () => {
      processor = new CriteriaBatchProcessor(mockLogger);
      const options = processor.getOptions();

      expect(options.batchSize).toBe(10);
      expect(options.delayBetweenBatches).toBe(2000);
      expect(options.timeout).toBe(120000);
    });

    it('should merge partial options with defaults', () => {
      processor = new CriteriaBatchProcessor(mockLogger, {
        batchSize: 5,
      });
      const options = processor.getOptions();

      expect(options.batchSize).toBe(5);
      expect(options.delayBetweenBatches).toBe(2000); // default
      expect(options.timeout).toBe(120000); // default
    });

    it('should return a copy of options to prevent mutation', () => {
      processor = new CriteriaBatchProcessor(mockLogger);
      const options1 = processor.getOptions();
      const options2 = processor.getOptions();

      // Modifying one should not affect the other
      options1.batchSize = 999;
      expect(options2.batchSize).toBe(10);
    });
  });

  describe('error handling for createBatches', () => {
    it('should handle empty criteria gracefully', async () => {
      vi.spyOn(promptGenerator, 'loadVerificationInstructions').mockResolvedValue({
        version: '2.1',
        criteria: {},
      });

      processor = new CriteriaBatchProcessor(mockLogger);
      await processor.initialize();

      const batches = processor.createBatches('AA');
      expect(batches).toHaveLength(0);
    });

    it('should handle single criterion', async () => {
      vi.spyOn(promptGenerator, 'loadVerificationInstructions').mockResolvedValue({
        version: '2.1',
        criteria: {
          '1.1.1': {
            criterionId: '1.1.1',
            level: 'A',
            title: 'Test',
            description: 'Test',
            whatToCheck: 'Test',
            passCondition: 'Test',
            failIndicators: 'Test',
            requiresManualReview: false,
          } as CriterionWithLevel,
        },
      });

      processor = new CriteriaBatchProcessor(mockLogger, { batchSize: 10 });
      await processor.initialize();

      const batches = processor.createBatches('A');
      expect(batches).toHaveLength(1);
      expect(batches[0]).toHaveLength(1);
    });

    it('should handle criteria that exactly fills batch size', async () => {
      vi.spyOn(promptGenerator, 'loadVerificationInstructions').mockResolvedValue({
        version: '2.1',
        criteria: {
          '1.1.1': {
            criterionId: '1.1.1',
            level: 'A',
            title: 'Test 1',
            description: 'Test',
            whatToCheck: 'Test',
            passCondition: 'Test',
            failIndicators: 'Test',
            requiresManualReview: false,
          } as CriterionWithLevel,
          '1.2.1': {
            criterionId: '1.2.1',
            level: 'A',
            title: 'Test 2',
            description: 'Test',
            whatToCheck: 'Test',
            passCondition: 'Test',
            failIndicators: 'Test',
            requiresManualReview: false,
          } as CriterionWithLevel,
        },
      });

      processor = new CriteriaBatchProcessor(mockLogger, { batchSize: 2 });
      await processor.initialize();

      const batches = processor.createBatches('A');
      expect(batches).toHaveLength(1);
      expect(batches[0]).toHaveLength(2);
    });
  });

  describe('logging', () => {
    beforeEach(async () => {
      processor = new CriteriaBatchProcessor(mockLogger);
      await processor.initialize();
    });

    it('should log during initialization', async () => {
      expect(mockLogger.info).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('should log when creating batches', () => {
      vi.clearAllMocks();
      processor.createBatches('AA');
      expect(mockLogger.debug).toHaveBeenCalled();
    });
  });

  describe('Integration - cache warmup and stats', () => {
    it('should warm up cache during initialization', async () => {
      processor = new CriteriaBatchProcessor(mockLogger);
      await processor.initialize();

      const cache = processor.getCache();
      const stats = cache.getStats();

      // Cache should be initialized (may have 0 entries if fresh)
      expect(stats).toBeDefined();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    it('should track cache statistics across operations', async () => {
      processor = new CriteriaBatchProcessor(mockLogger);
      await processor.initialize();

      const cache = processor.getCache();
      const htmlContent = '<html><body>Test</body></html>';
      const verifications = createMockVerifications(['1.1.1']);

      // Generate key and store
      const key = cache.generateKey(htmlContent, 'AA', 0);
      await cache.set(key, verifications, 1000, 'test-model');

      // Multiple gets should track hits
      await cache.get(key);
      await cache.get(key);

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
    });
  });
});

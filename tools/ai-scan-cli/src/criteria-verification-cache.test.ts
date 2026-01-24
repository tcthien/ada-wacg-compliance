import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CriteriaVerificationCache } from './criteria-verification-cache.js';
import { mkdtemp, rm, readFile, writeFile, mkdir, access } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import type { AiCriteriaVerification, WcagLevel } from './types.js';

describe('CriteriaVerificationCache', () => {
  let testDir: string;
  let cache: CriteriaVerificationCache;

  beforeEach(async () => {
    // Create a unique temporary directory for each test
    testDir = await mkdtemp(join(tmpdir(), 'cache-test-'));
    cache = new CriteriaVerificationCache({
      cacheDir: testDir,
      ttlDays: 7,
      maxEntries: 100,
    });
    await cache.warmup();
  });

  afterEach(async () => {
    // Clean up test directory and all its contents
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('generateKey()', () => {
    it('should produce consistent hashes for same content', () => {
      const htmlContent = '<html><body><h1>Test Page</h1></body></html>';
      const wcagLevel: WcagLevel = 'AA';
      const batchNumber = 0;

      const key1 = cache.generateKey(htmlContent, wcagLevel, batchNumber);
      const key2 = cache.generateKey(htmlContent, wcagLevel, batchNumber);

      expect(key1.contentHash).toBe(key2.contentHash);
      expect(key1.wcagLevel).toBe(key2.wcagLevel);
      expect(key1.batchNumber).toBe(key2.batchNumber);
    });

    it('should produce different hashes for different content', () => {
      const htmlContent1 = '<html><body><h1>Page One</h1></body></html>';
      const htmlContent2 = '<html><body><h1>Page Two</h1></body></html>';
      const wcagLevel: WcagLevel = 'AA';
      const batchNumber = 0;

      const key1 = cache.generateKey(htmlContent1, wcagLevel, batchNumber);
      const key2 = cache.generateKey(htmlContent2, wcagLevel, batchNumber);

      expect(key1.contentHash).not.toBe(key2.contentHash);
    });

    it('should produce different keys for different WCAG levels', () => {
      const htmlContent = '<html><body><h1>Test Page</h1></body></html>';
      const batchNumber = 0;

      const keyA = cache.generateKey(htmlContent, 'A', batchNumber);
      const keyAA = cache.generateKey(htmlContent, 'AA', batchNumber);
      const keyAAA = cache.generateKey(htmlContent, 'AAA', batchNumber);

      // Content hash should be the same
      expect(keyA.contentHash).toBe(keyAA.contentHash);
      expect(keyAA.contentHash).toBe(keyAAA.contentHash);

      // WCAG levels should differ
      expect(keyA.wcagLevel).toBe('A');
      expect(keyAA.wcagLevel).toBe('AA');
      expect(keyAAA.wcagLevel).toBe('AAA');
    });

    it('should produce different keys for different batch numbers', () => {
      const htmlContent = '<html><body><h1>Test Page</h1></body></html>';
      const wcagLevel: WcagLevel = 'AA';

      const key0 = cache.generateKey(htmlContent, wcagLevel, 0);
      const key1 = cache.generateKey(htmlContent, wcagLevel, 1);
      const key2 = cache.generateKey(htmlContent, wcagLevel, 2);

      // Content hash should be the same
      expect(key0.contentHash).toBe(key1.contentHash);
      expect(key1.contentHash).toBe(key2.contentHash);

      // Batch numbers should differ
      expect(key0.batchNumber).toBe(0);
      expect(key1.batchNumber).toBe(1);
      expect(key2.batchNumber).toBe(2);
    });

    it('should produce 16-character content hash', () => {
      const htmlContent = '<html><body><h1>Test Page</h1></body></html>';
      const key = cache.generateKey(htmlContent, 'AA', 0);

      expect(key.contentHash).toHaveLength(16);
      // Should be hexadecimal
      expect(key.contentHash).toMatch(/^[0-9a-f]{16}$/);
    });

    it('should handle empty string content', () => {
      const key = cache.generateKey('', 'AA', 0);

      expect(key.contentHash).toHaveLength(16);
      expect(key.wcagLevel).toBe('AA');
      expect(key.batchNumber).toBe(0);
    });

    it('should handle very large content', () => {
      const largeContent = 'x'.repeat(1000000); // 1MB of content
      const key = cache.generateKey(largeContent, 'AA', 0);

      expect(key.contentHash).toHaveLength(16);
    });
  });

  describe('get/set roundtrip', () => {
    const createMockVerifications = (): AiCriteriaVerification[] => [
      {
        criterionId: '1.1.1',
        status: 'AI_VERIFIED_PASS',
        confidence: 85,
        reasoning: 'All images have appropriate alt text.',
      },
      {
        criterionId: '1.4.3',
        status: 'AI_VERIFIED_FAIL',
        confidence: 90,
        reasoning: 'Some text has insufficient contrast ratio.',
        relatedIssueIds: ['issue-001'],
      },
    ];

    it('should store and retrieve verifications correctly', async () => {
      const htmlContent = '<html><body><h1>Test</h1></body></html>';
      const key = cache.generateKey(htmlContent, 'AA', 0);
      const verifications = createMockVerifications();
      const tokensUsed = 4500;
      const aiModel = 'claude-opus-4';

      // Store
      await cache.set(key, verifications, tokensUsed, aiModel);

      // Retrieve
      const entry = await cache.get(key);

      expect(entry).not.toBeNull();
      expect(entry?.verifications).toEqual(verifications);
      expect(entry?.tokensUsed).toBe(tokensUsed);
      expect(entry?.aiModel).toBe(aiModel);
      expect(entry?.key).toEqual(key);
    });

    it('should return null for non-existent keys', async () => {
      const htmlContent = '<html><body><h1>Not Cached</h1></body></html>';
      const key = cache.generateKey(htmlContent, 'AA', 0);

      const entry = await cache.get(key);

      expect(entry).toBeNull();
    });

    it('should return null for expired entries', async () => {
      // Create cache with very short TTL
      const shortTtlCache = new CriteriaVerificationCache({
        cacheDir: testDir,
        ttlDays: 0, // 0 days = expire immediately
        maxEntries: 100,
      });
      await shortTtlCache.warmup();

      const htmlContent = '<html><body><h1>Test</h1></body></html>';
      const key = shortTtlCache.generateKey(htmlContent, 'AA', 0);
      const verifications = createMockVerifications();

      // Store with 0 TTL means it expires immediately
      await shortTtlCache.set(key, verifications, 1000, 'test-model');

      // Wait a small amount to ensure expiration
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Retrieve - should return null because entry expired
      const entry = await shortTtlCache.get(key);

      expect(entry).toBeNull();
    });

    it('should handle multiple entries with different keys', async () => {
      const verifications = createMockVerifications();

      // Store entries with different content
      const key1 = cache.generateKey('<h1>Page 1</h1>', 'AA', 0);
      const key2 = cache.generateKey('<h1>Page 2</h1>', 'AA', 0);
      const key3 = cache.generateKey('<h1>Page 1</h1>', 'AAA', 0);

      await cache.set(key1, verifications, 1000, 'model-a');
      await cache.set(key2, verifications, 2000, 'model-b');
      await cache.set(key3, verifications, 3000, 'model-c');

      // Retrieve each
      const entry1 = await cache.get(key1);
      const entry2 = await cache.get(key2);
      const entry3 = await cache.get(key3);

      expect(entry1?.tokensUsed).toBe(1000);
      expect(entry2?.tokensUsed).toBe(2000);
      expect(entry3?.tokensUsed).toBe(3000);
    });

    it('should overwrite existing entry with same key', async () => {
      const htmlContent = '<html><body><h1>Test</h1></body></html>';
      const key = cache.generateKey(htmlContent, 'AA', 0);

      const verifications1: AiCriteriaVerification[] = [
        { criterionId: '1.1.1', status: 'PASS', confidence: 70, reasoning: 'First' },
      ];
      const verifications2: AiCriteriaVerification[] = [
        { criterionId: '1.1.1', status: 'FAIL', confidence: 80, reasoning: 'Second' },
      ];

      // Store first version
      await cache.set(key, verifications1, 1000, 'model-1');

      // Overwrite with second version
      await cache.set(key, verifications2, 2000, 'model-2');

      // Retrieve - should get second version
      const entry = await cache.get(key);

      expect(entry?.verifications[0].status).toBe('FAIL');
      expect(entry?.verifications[0].reasoning).toBe('Second');
      expect(entry?.tokensUsed).toBe(2000);
      expect(entry?.aiModel).toBe('model-2');
    });

    it('should store correct timestamps', async () => {
      const beforeSet = new Date();

      const htmlContent = '<html><body><h1>Test</h1></body></html>';
      const key = cache.generateKey(htmlContent, 'AA', 0);
      const verifications = createMockVerifications();

      await cache.set(key, verifications, 1000, 'test-model');

      const afterSet = new Date();

      const entry = await cache.get(key);

      const createdAt = new Date(entry!.createdAt);
      const expiresAt = new Date(entry!.expiresAt);

      // createdAt should be within the time range of the test
      expect(createdAt.getTime()).toBeGreaterThanOrEqual(beforeSet.getTime());
      expect(createdAt.getTime()).toBeLessThanOrEqual(afterSet.getTime());

      // expiresAt should be 7 days after createdAt
      const expectedExpiry = new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
      expect(expiresAt.getTime()).toBe(expectedExpiry.getTime());
    });
  });

  describe('TTL expiration', () => {
    it('should not expire fresh entries', async () => {
      const htmlContent = '<html><body><h1>Test</h1></body></html>';
      const key = cache.generateKey(htmlContent, 'AA', 0);
      const verifications: AiCriteriaVerification[] = [
        { criterionId: '1.1.1', status: 'PASS', confidence: 90, reasoning: 'Good' },
      ];

      await cache.set(key, verifications, 1000, 'test-model');

      // Get immediately - should not be expired
      const entry = await cache.get(key);

      expect(entry).not.toBeNull();
      expect(entry?.verifications).toEqual(verifications);
    });

    it('should consider entries past TTL as expired', async () => {
      // Manually create an expired entry by writing directly to the cache file
      const htmlContent = '<html><body><h1>Test</h1></body></html>';
      const key = cache.generateKey(htmlContent, 'AA', 0);

      // Create an entry that expired in the past
      const expiredEntry = {
        key,
        verifications: [{ criterionId: '1.1.1', status: 'PASS', confidence: 90, reasoning: 'Old' }],
        tokensUsed: 1000,
        aiModel: 'test-model',
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days ago
        expiresAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago (expired)
      };

      // Write directly to cache file
      const entriesDir = join(testDir, 'entries');
      await mkdir(entriesDir, { recursive: true });
      const filename = `${key.contentHash}_${key.wcagLevel}_${key.batchNumber}.json`;
      await writeFile(join(entriesDir, filename), JSON.stringify(expiredEntry), 'utf-8');

      // Try to get the entry - should return null because it's expired
      const entry = await cache.get(key);

      expect(entry).toBeNull();
    });

    it('should track miss when entry is expired', async () => {
      // Manually create an expired entry
      const htmlContent = '<html><body><h1>Test</h1></body></html>';
      const key = cache.generateKey(htmlContent, 'AA', 0);

      const expiredEntry = {
        key,
        verifications: [],
        tokensUsed: 1000,
        aiModel: 'test-model',
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        expiresAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // Expired yesterday
      };

      const entriesDir = join(testDir, 'entries');
      await mkdir(entriesDir, { recursive: true });
      const filename = `${key.contentHash}_${key.wcagLevel}_${key.batchNumber}.json`;
      await writeFile(join(entriesDir, filename), JSON.stringify(expiredEntry), 'utf-8');

      // Reset stats by creating a new cache instance
      const freshCache = new CriteriaVerificationCache({
        cacheDir: testDir,
        ttlDays: 7,
        maxEntries: 100,
      });

      const statsBefore = freshCache.getStats();
      expect(statsBefore.misses).toBe(0);

      // Try to get expired entry
      await freshCache.get(key);

      const statsAfter = freshCache.getStats();
      expect(statsAfter.misses).toBe(1);
    });
  });

  describe('cleanup()', () => {
    it('should remove expired entries', async () => {
      const htmlContent = '<html><body><h1>Test</h1></body></html>';
      const key = cache.generateKey(htmlContent, 'AA', 0);

      // Create an expired entry
      const expiredEntry = {
        key,
        verifications: [],
        tokensUsed: 1000,
        aiModel: 'test-model',
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        expiresAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const entriesDir = join(testDir, 'entries');
      await mkdir(entriesDir, { recursive: true });
      const filename = `${key.contentHash}_${key.wcagLevel}_${key.batchNumber}.json`;
      const filePath = join(entriesDir, filename);
      await writeFile(filePath, JSON.stringify(expiredEntry), 'utf-8');

      // Verify file exists
      await expect(access(filePath)).resolves.toBeUndefined();

      // Run cleanup
      const removedCount = await cache.cleanup();

      expect(removedCount).toBe(1);

      // Verify file is removed
      await expect(access(filePath)).rejects.toThrow();
    });

    it('should keep valid entries', async () => {
      const htmlContent = '<html><body><h1>Test</h1></body></html>';
      const key = cache.generateKey(htmlContent, 'AA', 0);
      const verifications: AiCriteriaVerification[] = [
        { criterionId: '1.1.1', status: 'PASS', confidence: 90, reasoning: 'Good' },
      ];

      // Store a fresh entry
      await cache.set(key, verifications, 1000, 'test-model');

      const entriesDir = join(testDir, 'entries');
      const filename = `${key.contentHash}_${key.wcagLevel}_${key.batchNumber}.json`;
      const filePath = join(entriesDir, filename);

      // Run cleanup
      const removedCount = await cache.cleanup();

      expect(removedCount).toBe(0);

      // Verify file still exists
      await expect(access(filePath)).resolves.toBeUndefined();
    });

    it('should return correct count of removed entries', async () => {
      const entriesDir = join(testDir, 'entries');
      await mkdir(entriesDir, { recursive: true });

      // Create 3 expired entries
      for (let i = 0; i < 3; i++) {
        const key = cache.generateKey(`<h1>Page ${i}</h1>`, 'AA', 0);
        const expiredEntry = {
          key,
          verifications: [],
          tokensUsed: 1000,
          aiModel: 'test-model',
          createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
          expiresAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        };
        const filename = `${key.contentHash}_${key.wcagLevel}_${key.batchNumber}.json`;
        await writeFile(join(entriesDir, filename), JSON.stringify(expiredEntry), 'utf-8');
      }

      // Create 2 valid entries
      for (let i = 0; i < 2; i++) {
        const key = cache.generateKey(`<h1>Valid Page ${i}</h1>`, 'AA', 0);
        const verifications: AiCriteriaVerification[] = [
          { criterionId: '1.1.1', status: 'PASS', confidence: 90, reasoning: 'Good' },
        ];
        await cache.set(key, verifications, 1000, 'test-model');
      }

      // Run cleanup
      const removedCount = await cache.cleanup();

      expect(removedCount).toBe(3);
    });

    it('should handle empty cache directory', async () => {
      const removedCount = await cache.cleanup();
      expect(removedCount).toBe(0);
    });

    it('should remove invalid JSON files during cleanup', async () => {
      const entriesDir = join(testDir, 'entries');
      await mkdir(entriesDir, { recursive: true });

      // Create an invalid JSON file
      const invalidFilePath = join(entriesDir, 'invalid_AA_0.json');
      await writeFile(invalidFilePath, 'this is not valid json {', 'utf-8');

      // Run cleanup
      const removedCount = await cache.cleanup();

      expect(removedCount).toBe(1);

      // Verify file is removed
      await expect(access(invalidFilePath)).rejects.toThrow();
    });
  });

  describe('getStats()', () => {
    it('should track hits correctly', async () => {
      const htmlContent = '<html><body><h1>Test</h1></body></html>';
      const key = cache.generateKey(htmlContent, 'AA', 0);
      const verifications: AiCriteriaVerification[] = [
        { criterionId: '1.1.1', status: 'PASS', confidence: 90, reasoning: 'Good' },
      ];

      await cache.set(key, verifications, 1000, 'test-model');

      // Multiple gets should increment hits
      await cache.get(key);
      await cache.get(key);
      await cache.get(key);

      const stats = cache.getStats();
      expect(stats.hits).toBe(3);
    });

    it('should track misses correctly', async () => {
      // Request non-existent entries
      const key1 = cache.generateKey('<h1>Not Cached 1</h1>', 'AA', 0);
      const key2 = cache.generateKey('<h1>Not Cached 2</h1>', 'AA', 0);

      await cache.get(key1);
      await cache.get(key2);
      await cache.get(key1);

      const stats = cache.getStats();
      expect(stats.misses).toBe(3);
    });

    it('should update hit rate correctly', async () => {
      const htmlContent = '<html><body><h1>Test</h1></body></html>';
      const key = cache.generateKey(htmlContent, 'AA', 0);
      const verifications: AiCriteriaVerification[] = [
        { criterionId: '1.1.1', status: 'PASS', confidence: 90, reasoning: 'Good' },
      ];

      await cache.set(key, verifications, 1000, 'test-model');

      // 1 miss
      const nonExistentKey = cache.generateKey('<h1>Not Cached</h1>', 'AA', 0);
      await cache.get(nonExistentKey);

      // 3 hits
      await cache.get(key);
      await cache.get(key);
      await cache.get(key);

      const stats = cache.getStats();
      expect(stats.hits).toBe(3);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.75); // 3 / (3 + 1)
    });

    it('should track total saved tokens', async () => {
      const htmlContent = '<html><body><h1>Test</h1></body></html>';
      const key = cache.generateKey(htmlContent, 'AA', 0);
      const verifications: AiCriteriaVerification[] = [
        { criterionId: '1.1.1', status: 'PASS', confidence: 90, reasoning: 'Good' },
      ];

      await cache.set(key, verifications, 5000, 'test-model');

      // Each cache hit should add to totalSavedTokens
      await cache.get(key);
      await cache.get(key);

      const stats = cache.getStats();
      expect(stats.totalSavedTokens).toBe(10000); // 5000 * 2 hits
    });

    it('should return a copy of stats object', async () => {
      const stats1 = cache.getStats();
      const stats2 = cache.getStats();

      // Modifying one should not affect the other
      stats1.hits = 999;
      expect(stats2.hits).toBe(0);
    });

    it('should return zero hit rate when no requests made', () => {
      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('has()', () => {
    it('should return true for existing entries', async () => {
      const htmlContent = '<html><body><h1>Test</h1></body></html>';
      const key = cache.generateKey(htmlContent, 'AA', 0);
      const verifications: AiCriteriaVerification[] = [
        { criterionId: '1.1.1', status: 'PASS', confidence: 90, reasoning: 'Good' },
      ];

      await cache.set(key, verifications, 1000, 'test-model');

      const exists = await cache.has(key);
      expect(exists).toBe(true);
    });

    it('should return false for non-existent entries', async () => {
      const htmlContent = '<html><body><h1>Not Cached</h1></body></html>';
      const key = cache.generateKey(htmlContent, 'AA', 0);

      const exists = await cache.has(key);
      expect(exists).toBe(false);
    });

    it('should return false for expired entries', async () => {
      const htmlContent = '<html><body><h1>Test</h1></body></html>';
      const key = cache.generateKey(htmlContent, 'AA', 0);

      // Create an expired entry
      const expiredEntry = {
        key,
        verifications: [],
        tokensUsed: 1000,
        aiModel: 'test-model',
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        expiresAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const entriesDir = join(testDir, 'entries');
      await mkdir(entriesDir, { recursive: true });
      const filename = `${key.contentHash}_${key.wcagLevel}_${key.batchNumber}.json`;
      await writeFile(join(entriesDir, filename), JSON.stringify(expiredEntry), 'utf-8');

      const exists = await cache.has(key);
      expect(exists).toBe(false);
    });

    it('should not update statistics', async () => {
      const htmlContent = '<html><body><h1>Test</h1></body></html>';
      const key = cache.generateKey(htmlContent, 'AA', 0);
      const verifications: AiCriteriaVerification[] = [
        { criterionId: '1.1.1', status: 'PASS', confidence: 90, reasoning: 'Good' },
      ];

      await cache.set(key, verifications, 1000, 'test-model');

      const statsBefore = cache.getStats();

      // Multiple has() calls
      await cache.has(key);
      await cache.has(key);
      await cache.has(cache.generateKey('<h1>Not Cached</h1>', 'AA', 0));

      const statsAfter = cache.getStats();

      // Stats should be unchanged (has() doesn't track hits/misses)
      expect(statsAfter.hits).toBe(statsBefore.hits);
      expect(statsAfter.misses).toBe(statsBefore.misses);
    });

    it('should return false for invalid JSON files', async () => {
      const entriesDir = join(testDir, 'entries');
      await mkdir(entriesDir, { recursive: true });

      const key = cache.generateKey('<h1>Test</h1>', 'AA', 0);
      const filename = `${key.contentHash}_${key.wcagLevel}_${key.batchNumber}.json`;
      await writeFile(join(entriesDir, filename), 'invalid json', 'utf-8');

      const exists = await cache.has(key);
      expect(exists).toBe(false);
    });
  });

  describe('clearAll()', () => {
    it('should remove all entries', async () => {
      // Create multiple entries
      for (let i = 0; i < 5; i++) {
        const key = cache.generateKey(`<h1>Page ${i}</h1>`, 'AA', 0);
        const verifications: AiCriteriaVerification[] = [
          { criterionId: '1.1.1', status: 'PASS', confidence: 90, reasoning: 'Good' },
        ];
        await cache.set(key, verifications, 1000, 'test-model');
      }

      // Verify entries exist
      for (let i = 0; i < 5; i++) {
        const key = cache.generateKey(`<h1>Page ${i}</h1>`, 'AA', 0);
        expect(await cache.has(key)).toBe(true);
      }

      // Clear all
      await cache.clearAll();

      // Verify all entries are gone
      for (let i = 0; i < 5; i++) {
        const key = cache.generateKey(`<h1>Page ${i}</h1>`, 'AA', 0);
        expect(await cache.has(key)).toBe(false);
      }
    });

    it('should reset statistics', async () => {
      // Generate some activity
      const key = cache.generateKey('<h1>Test</h1>', 'AA', 0);
      const verifications: AiCriteriaVerification[] = [
        { criterionId: '1.1.1', status: 'PASS', confidence: 90, reasoning: 'Good' },
      ];
      await cache.set(key, verifications, 1000, 'test-model');

      await cache.get(key);
      await cache.get(key);
      await cache.get(cache.generateKey('<h1>Not Cached</h1>', 'AA', 0));

      const statsBefore = cache.getStats();
      expect(statsBefore.hits).toBe(2);
      expect(statsBefore.misses).toBe(1);

      // Clear all
      await cache.clearAll();

      const statsAfter = cache.getStats();
      expect(statsAfter.hits).toBe(0);
      expect(statsAfter.misses).toBe(0);
      expect(statsAfter.hitRate).toBe(0);
      expect(statsAfter.entriesCount).toBe(0);
      expect(statsAfter.totalSavedTokens).toBe(0);
    });

    it('should not throw when cache is already empty', async () => {
      await expect(cache.clearAll()).resolves.toBeUndefined();
    });

    it('should recreate entries directory after clearing', async () => {
      await cache.clearAll();

      // Should be able to set entries after clearing
      const key = cache.generateKey('<h1>Test</h1>', 'AA', 0);
      const verifications: AiCriteriaVerification[] = [
        { criterionId: '1.1.1', status: 'PASS', confidence: 90, reasoning: 'Good' },
      ];

      await expect(cache.set(key, verifications, 1000, 'test-model')).resolves.toBeUndefined();

      const entry = await cache.get(key);
      expect(entry).not.toBeNull();
    });
  });

  describe('warmup()', () => {
    it('should count valid entries during warmup', async () => {
      // Create some entries
      for (let i = 0; i < 3; i++) {
        const key = cache.generateKey(`<h1>Page ${i}</h1>`, 'AA', 0);
        const verifications: AiCriteriaVerification[] = [
          { criterionId: '1.1.1', status: 'PASS', confidence: 90, reasoning: 'Good' },
        ];
        await cache.set(key, verifications, 1000, 'test-model');
      }

      // Create a new cache instance and warm it up
      const newCache = new CriteriaVerificationCache({
        cacheDir: testDir,
        ttlDays: 7,
        maxEntries: 100,
      });
      await newCache.warmup();

      const stats = newCache.getStats();
      expect(stats.entriesCount).toBe(3);
    });

    it('should not count expired entries during warmup', async () => {
      // Create 2 valid entries
      for (let i = 0; i < 2; i++) {
        const key = cache.generateKey(`<h1>Valid Page ${i}</h1>`, 'AA', 0);
        const verifications: AiCriteriaVerification[] = [
          { criterionId: '1.1.1', status: 'PASS', confidence: 90, reasoning: 'Good' },
        ];
        await cache.set(key, verifications, 1000, 'test-model');
      }

      // Create 1 expired entry manually
      const entriesDir = join(testDir, 'entries');
      const expiredKey = cache.generateKey('<h1>Expired Page</h1>', 'AA', 0);
      const expiredEntry = {
        key: expiredKey,
        verifications: [],
        tokensUsed: 1000,
        aiModel: 'test-model',
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        expiresAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      };
      const filename = `${expiredKey.contentHash}_${expiredKey.wcagLevel}_${expiredKey.batchNumber}.json`;
      await writeFile(join(entriesDir, filename), JSON.stringify(expiredEntry), 'utf-8');

      // Create a new cache instance and warm it up
      const newCache = new CriteriaVerificationCache({
        cacheDir: testDir,
        ttlDays: 7,
        maxEntries: 100,
      });
      await newCache.warmup();

      const stats = newCache.getStats();
      expect(stats.entriesCount).toBe(2); // Only valid entries
    });

    it('should create cache directory if it does not exist', async () => {
      const newDir = join(testDir, 'new-cache-dir');

      const newCache = new CriteriaVerificationCache({
        cacheDir: newDir,
        ttlDays: 7,
        maxEntries: 100,
      });

      // Warmup should create the directory
      await newCache.warmup();

      // Should be able to add entries now
      const key = newCache.generateKey('<h1>Test</h1>', 'AA', 0);
      const verifications: AiCriteriaVerification[] = [
        { criterionId: '1.1.1', status: 'PASS', confidence: 90, reasoning: 'Good' },
      ];

      await expect(newCache.set(key, verifications, 1000, 'test-model')).resolves.toBeUndefined();
    });
  });

  describe('Configuration options', () => {
    it('should use default values when no options provided', () => {
      const defaultCache = new CriteriaVerificationCache();

      expect(defaultCache.getCacheDir()).toBe('.ai-scan-cache');
      expect(defaultCache.getTtlDays()).toBe(7);
      expect(defaultCache.getMaxEntries()).toBe(1000);
    });

    it('should respect custom cacheDir option', () => {
      const customCache = new CriteriaVerificationCache({
        cacheDir: '/custom/path',
      });

      expect(customCache.getCacheDir()).toBe('/custom/path');
    });

    it('should respect custom ttlDays option', () => {
      const customCache = new CriteriaVerificationCache({
        ttlDays: 14,
      });

      expect(customCache.getTtlDays()).toBe(14);
    });

    it('should respect custom maxEntries option', () => {
      const customCache = new CriteriaVerificationCache({
        maxEntries: 500,
      });

      expect(customCache.getMaxEntries()).toBe(500);
    });
  });

  describe('Integration - full workflow', () => {
    it('should handle complete caching lifecycle', async () => {
      const htmlContent1 = '<html><body><h1>Page 1</h1></body></html>';
      const htmlContent2 = '<html><body><h1>Page 2</h1></body></html>';

      const verifications1: AiCriteriaVerification[] = [
        { criterionId: '1.1.1', status: 'AI_VERIFIED_PASS', confidence: 85, reasoning: 'All images have alt text' },
        { criterionId: '1.4.3', status: 'AI_VERIFIED_PASS', confidence: 90, reasoning: 'Contrast is sufficient' },
      ];

      const verifications2: AiCriteriaVerification[] = [
        { criterionId: '1.1.1', status: 'AI_VERIFIED_FAIL', confidence: 80, reasoning: 'Missing alt text on 2 images' },
      ];

      // 1. Generate keys
      const key1 = cache.generateKey(htmlContent1, 'AA', 0);
      const key2 = cache.generateKey(htmlContent2, 'AA', 0);

      // 2. Check cache (should miss)
      expect(await cache.has(key1)).toBe(false);
      expect(await cache.has(key2)).toBe(false);

      // 3. Store verifications
      await cache.set(key1, verifications1, 4500, 'claude-opus-4');
      await cache.set(key2, verifications2, 3200, 'claude-opus-4');

      // 4. Check cache (should hit)
      expect(await cache.has(key1)).toBe(true);
      expect(await cache.has(key2)).toBe(true);

      // 5. Retrieve and verify
      const entry1 = await cache.get(key1);
      const entry2 = await cache.get(key2);

      expect(entry1?.verifications).toHaveLength(2);
      expect(entry1?.verifications[0].criterionId).toBe('1.1.1');
      expect(entry2?.verifications).toHaveLength(1);
      expect(entry2?.verifications[0].status).toBe('AI_VERIFIED_FAIL');

      // 6. Check stats
      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.entriesCount).toBeGreaterThanOrEqual(2);
      expect(stats.totalSavedTokens).toBe(4500 + 3200);

      // 7. Simulate restart by creating new cache instance
      const resumedCache = new CriteriaVerificationCache({
        cacheDir: testDir,
        ttlDays: 7,
        maxEntries: 100,
      });
      await resumedCache.warmup();

      // 8. Verify entries still exist after restart
      const resumedEntry1 = await resumedCache.get(key1);
      expect(resumedEntry1).not.toBeNull();
      expect(resumedEntry1?.verifications).toEqual(verifications1);

      // 9. Cleanup and clearAll
      const removed = await resumedCache.cleanup();
      expect(removed).toBe(0); // No expired entries

      await resumedCache.clearAll();
      expect(await resumedCache.has(key1)).toBe(false);
      expect(await resumedCache.has(key2)).toBe(false);
    });
  });
});

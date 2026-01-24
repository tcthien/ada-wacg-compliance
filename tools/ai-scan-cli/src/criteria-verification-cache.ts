import { createHash } from 'crypto';
import { mkdir, readdir, readFile, rm, unlink, writeFile } from 'fs/promises';
import { join } from 'path';

import { AiCriteriaVerification, CacheEntry, CacheKey, CacheStats, WcagLevel } from './types.js';

/**
 * Default cache directory for storing verification results
 */
const DEFAULT_CACHE_DIR = '.ai-scan-cache';

/**
 * Default time-to-live for cache entries in days
 */
const DEFAULT_TTL_DAYS = 7;

/**
 * Default maximum number of entries in the cache
 */
const DEFAULT_MAX_ENTRIES = 1000;

/**
 * Subdirectory for cache entry files
 */
const ENTRIES_DIR = 'entries';

/**
 * Options for configuring the CriteriaVerificationCache
 */
export interface CriteriaVerificationCacheOptions {
  /** Directory to store cache files (default: .ai-scan-cache/) */
  cacheDir?: string;
  /** Time-to-live for cache entries in days (default: 7) */
  ttlDays?: number;
  /** Maximum number of entries in the cache (default: 1000) */
  maxEntries?: number;
}

/**
 * Manages caching of AI verification results to avoid re-processing identical content
 *
 * The CriteriaVerificationCache stores verification results on disk, keyed by
 * a hash of the HTML content, WCAG level, and batch number. This enables:
 * - Instant results for re-scanned pages with identical content
 * - Token savings when processing similar pages
 * - Batch processing efficiency for multiple pages
 *
 * ## Cache Key Composition
 *
 * Cache keys are composed of three parts:
 * - `contentHash`: First 16 characters of SHA-256 hash of HTML content
 * - `wcagLevel`: WCAG conformance level (A, AA, or AAA)
 * - `batchNumber`: Batch index for the criteria set (0-indexed)
 *
 * This ensures that different content, WCAG levels, or batches produce unique keys,
 * while identical inputs always map to the same cache entry.
 *
 * ## Storage Structure
 *
 * ```
 * {cacheDir}/
 * └── entries/
 *     ├── a1b2c3d4e5f67890_AA_0.json
 *     ├── a1b2c3d4e5f67890_AA_1.json
 *     └── f9e8d7c6b5a43210_AAA_0.json
 * ```
 *
 * Each JSON file contains a {@link CacheEntry} with verification results,
 * token usage, timestamps, and expiration information.
 *
 * ## TTL (Time-To-Live) Behavior
 *
 * Cache entries expire after a configurable TTL (default: 7 days) to ensure
 * results stay fresh as AI models and verification logic improve. The TTL
 * is calculated from creation time and stored in each entry's `expiresAt` field.
 *
 * - Expired entries are treated as cache misses
 * - The `cleanup()` method removes expired entries from disk
 * - The `warmup()` method counts only non-expired entries
 *
 * ## Cache Statistics
 *
 * The cache tracks performance metrics including:
 * - `hits`: Number of successful cache lookups
 * - `misses`: Number of failed lookups (missing or expired)
 * - `hitRate`: Ratio of hits to total lookups
 * - `entriesCount`: Number of valid entries in cache
 * - `totalSavedTokens`: Cumulative tokens saved via cache hits
 *
 * @example
 * // Basic usage with default settings
 * const cache = new CriteriaVerificationCache();
 * await cache.warmup();
 *
 * const key = cache.generateKey(htmlContent, 'AA', 0);
 * const cached = await cache.get(key);
 *
 * if (cached) {
 *   console.log('Cache hit! Saved tokens:', cached.tokensUsed);
 *   return cached.verifications;
 * } else {
 *   const verifications = await processWithAI(htmlContent);
 *   await cache.set(key, verifications, tokensUsed, 'claude-opus-4');
 *   return verifications;
 * }
 *
 * @example
 * // Custom configuration with longer TTL
 * const cache = new CriteriaVerificationCache({
 *   cacheDir: './my-cache',
 *   ttlDays: 14,
 *   maxEntries: 500
 * });
 *
 * @example
 * // Monitoring cache performance
 * const stats = cache.getStats();
 * console.log(`Cache efficiency: ${(stats.hitRate * 100).toFixed(1)}%`);
 * console.log(`Total tokens saved: ${stats.totalSavedTokens}`);
 * console.log(`Active entries: ${stats.entriesCount}`);
 */
export class CriteriaVerificationCache {
  private cacheDir: string;
  private ttlDays: number;
  private maxEntriesLimit: number;
  private stats: CacheStats;

  /**
   * Creates a new CriteriaVerificationCache instance
   *
   * @param options - Configuration options for the cache
   *
   * @example
   * // Using defaults
   * const cache = new CriteriaVerificationCache();
   *
   * // Custom configuration
   * const cache = new CriteriaVerificationCache({
   *   cacheDir: './my-cache',
   *   ttlDays: 14,
   *   maxEntries: 500
   * });
   */
  constructor(options?: CriteriaVerificationCacheOptions) {
    this.cacheDir = options?.cacheDir ?? DEFAULT_CACHE_DIR;
    this.ttlDays = options?.ttlDays ?? DEFAULT_TTL_DAYS;
    this.maxEntriesLimit = options?.maxEntries ?? DEFAULT_MAX_ENTRIES;

    // Initialize stats
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      entriesCount: 0,
      totalSavedTokens: 0,
    };
  }

  /**
   * Generate a cache key from HTML content and parameters
   *
   * Creates a unique key using SHA-256 hash of the HTML content (first 16 chars),
   * combined with the WCAG level and batch number. This ensures different
   * content produces different keys while keeping keys readable.
   *
   * @param htmlContent - The HTML content to hash
   * @param wcagLevel - WCAG conformance level (A, AA, or AAA)
   * @param batchNumber - Batch number for the criteria set (0-indexed)
   * @returns A CacheKey object for cache operations
   *
   * @example
   * const key = cache.generateKey('<html>...</html>', 'AA', 0);
   * // key.contentHash = 'a1b2c3d4e5f67890'
   * // key.wcagLevel = 'AA'
   * // key.batchNumber = 0
   */
  generateKey(htmlContent: string, wcagLevel: WcagLevel, batchNumber: number): CacheKey {
    // Create SHA-256 hash of the HTML content
    const hash = createHash('sha256');
    hash.update(htmlContent);
    const fullHash = hash.digest('hex');

    // Use first 16 characters of the hash
    const contentHash = fullHash.substring(0, 16);

    return {
      contentHash,
      wcagLevel,
      batchNumber,
    };
  }

  /**
   * Get cached verifications for a given key
   *
   * Retrieves a cache entry if it exists and has not expired.
   * Updates cache statistics (hits/misses) for monitoring.
   *
   * @param key - The cache key to look up
   * @returns The cache entry if found and valid, null otherwise
   *
   * @example
   * const key = cache.generateKey(htmlContent, 'AA', 0);
   * const entry = await cache.get(key);
   *
   * if (entry) {
   *   console.log('Found', entry.verifications.length, 'cached verifications');
   *   console.log('Saved', entry.tokensUsed, 'tokens');
   * }
   */
  async get(key: CacheKey): Promise<CacheEntry | null> {
    const filePath = this.buildEntryPath(key);

    try {
      const content = await readFile(filePath, 'utf-8');
      const entry = JSON.parse(content) as CacheEntry;

      // Check if entry has expired
      const expiresAt = new Date(entry.expiresAt);
      const now = new Date();

      if (now > expiresAt) {
        // Entry is expired, treat as cache miss
        this.stats.misses++;
        this.updateHitRate();
        return null;
      }

      // Valid cache hit
      this.stats.hits++;
      this.stats.totalSavedTokens += entry.tokensUsed;
      this.updateHitRate();

      return entry;
    } catch (error) {
      // File doesn't exist or is invalid - cache miss
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.stats.misses++;
        this.updateHitRate();
        return null;
      }

      // For other errors (invalid JSON, permissions, etc), also treat as miss
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }
  }

  /**
   * Store verifications in the cache
   *
   * Saves verification results to disk with TTL information.
   * Creates the cache directory structure if it doesn't exist.
   *
   * @param key - The cache key for this entry
   * @param verifications - Array of AI verification results
   * @param tokensUsed - Number of tokens consumed by the AI call
   * @param aiModel - Name of the AI model used for verification
   *
   * @example
   * const key = cache.generateKey(htmlContent, 'AA', 0);
   * await cache.set(key, verifications, 4500, 'claude-opus-4');
   */
  async set(
    key: CacheKey,
    verifications: AiCriteriaVerification[],
    tokensUsed: number,
    aiModel: string
  ): Promise<void> {
    // Ensure cache directories exist
    await this.ensureDirectories();

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.ttlDays * 24 * 60 * 60 * 1000);

    const entry: CacheEntry = {
      key,
      verifications,
      tokensUsed,
      aiModel,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    const filePath = this.buildEntryPath(key);
    const content = JSON.stringify(entry, null, 2);

    await writeFile(filePath, content, 'utf-8');

    // Update entry count
    this.stats.entriesCount++;
  }

  /**
   * Get current cache statistics
   *
   * Returns statistics about cache performance including hit rate,
   * total entries, and tokens saved.
   *
   * @returns Current cache statistics
   *
   * @example
   * const stats = cache.getStats();
   * console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
   * console.log(`Tokens saved: ${stats.totalSavedTokens}`);
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Check if a valid (non-expired) cache entry exists
   *
   * Efficiently checks for cache entry existence without updating
   * hit/miss statistics. Useful for pre-flight checks before
   * initiating expensive operations.
   *
   * @param key - The cache key to check
   * @returns True if a valid, non-expired entry exists
   *
   * @example
   * const key = cache.generateKey(htmlContent, 'AA', 0);
   * if (await cache.has(key)) {
   *   console.log('Cache entry exists, safe to use get()');
   * }
   */
  async has(key: CacheKey): Promise<boolean> {
    const filePath = this.buildEntryPath(key);

    try {
      const content = await readFile(filePath, 'utf-8');
      const entry = JSON.parse(content) as CacheEntry;

      // Check if entry has expired
      const expiresAt = new Date(entry.expiresAt);
      const now = new Date();

      return now <= expiresAt;
    } catch {
      // File doesn't exist or is invalid
      return false;
    }
  }

  /**
   * Clear expired cache entries
   *
   * Scans all cache entries and removes those that have expired.
   * Updates the entriesCount statistic after cleanup.
   *
   * @returns Number of entries removed
   *
   * @example
   * const removedCount = await cache.cleanup();
   * console.log(`Cleaned up ${removedCount} expired entries`);
   */
  async cleanup(): Promise<number> {
    const entriesDir = join(this.cacheDir, ENTRIES_DIR);
    let removedCount = 0;

    try {
      const files = await readdir(entriesDir);
      const now = new Date();

      for (const file of files) {
        if (!file.endsWith('.json')) {
          continue;
        }

        const filePath = join(entriesDir, file);

        try {
          const content = await readFile(filePath, 'utf-8');
          const entry = JSON.parse(content) as CacheEntry;

          const expiresAt = new Date(entry.expiresAt);

          if (now > expiresAt) {
            await unlink(filePath);
            removedCount++;
          }
        } catch {
          // Invalid entry, remove it
          try {
            await unlink(filePath);
            removedCount++;
          } catch {
            // Ignore errors when removing invalid files
          }
        }
      }

      // Update entries count
      this.stats.entriesCount = Math.max(0, this.stats.entriesCount - removedCount);
    } catch (error) {
      // Directory doesn't exist, nothing to clean up
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    return removedCount;
  }

  /**
   * Clear all cache entries
   *
   * Removes all cached verification results and resets statistics.
   * The cache directory structure is recreated empty.
   *
   * @example
   * await cache.clearAll();
   * console.log('Cache has been completely cleared');
   */
  async clearAll(): Promise<void> {
    const entriesDir = join(this.cacheDir, ENTRIES_DIR);

    try {
      // Remove the entries directory and all its contents
      await rm(entriesDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore if directory doesn't exist
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    // Recreate empty entries directory
    await mkdir(entriesDir, { recursive: true });

    // Reset statistics
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      entriesCount: 0,
      totalSavedTokens: 0,
    };
  }

  /**
   * Warm up cache by loading index into memory
   *
   * Scans the entries directory and counts non-expired entries.
   * Updates the entriesCount statistic for accurate reporting.
   * Should be called when initializing the cache for accurate stats.
   *
   * @example
   * const cache = new CriteriaVerificationCache();
   * await cache.warmup();
   * console.log(`Cache loaded with ${cache.getStats().entriesCount} entries`);
   */
  async warmup(): Promise<void> {
    const entriesDir = join(this.cacheDir, ENTRIES_DIR);
    let validCount = 0;

    try {
      // Ensure directory exists
      await mkdir(entriesDir, { recursive: true });

      const files = await readdir(entriesDir);
      const now = new Date();

      for (const file of files) {
        if (!file.endsWith('.json')) {
          continue;
        }

        const filePath = join(entriesDir, file);

        try {
          const content = await readFile(filePath, 'utf-8');
          const entry = JSON.parse(content) as CacheEntry;

          const expiresAt = new Date(entry.expiresAt);

          if (now <= expiresAt) {
            validCount++;
          }
        } catch {
          // Invalid entry, skip it (will be cleaned up later)
        }
      }

      // Update entries count with valid entries
      this.stats.entriesCount = validCount;
    } catch (error) {
      // Directory doesn't exist, count is 0
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      this.stats.entriesCount = 0;
    }
  }

  /**
   * Get the maximum entries limit for this cache
   *
   * Used by cleanup() (task 9) to determine when to evict old entries.
   *
   * @returns The maximum number of entries allowed in the cache
   */
  getMaxEntries(): number {
    return this.maxEntriesLimit;
  }

  /**
   * Get the cache directory path
   *
   * @returns The path to the cache directory
   */
  getCacheDir(): string {
    return this.cacheDir;
  }

  /**
   * Get the TTL in days for cache entries
   *
   * @returns The time-to-live in days
   */
  getTtlDays(): number {
    return this.ttlDays;
  }

  /**
   * Build the file path for a cache entry
   *
   * Constructs a deterministic file path from the cache key components.
   * The filename format is: `{contentHash}_{wcagLevel}_{batchNumber}.json`
   *
   * @param key - The cache key containing contentHash, wcagLevel, and batchNumber
   * @returns Full file path for the cache entry (e.g., `.ai-scan-cache/entries/a1b2c3d4_AA_0.json`)
   *
   * @example
   * // Internal usage:
   * const key = { contentHash: 'a1b2c3d4e5f67890', wcagLevel: 'AA', batchNumber: 0 };
   * const path = this.buildEntryPath(key);
   * // path = '.ai-scan-cache/entries/a1b2c3d4e5f67890_AA_0.json'
   */
  private buildEntryPath(key: CacheKey): string {
    const filename = `${key.contentHash}_${key.wcagLevel}_${key.batchNumber}.json`;
    return join(this.cacheDir, ENTRIES_DIR, filename);
  }

  /**
   * Ensure cache directories exist
   *
   * Creates the cache directory and entries subdirectory if they don't exist.
   * Uses `recursive: true` to create parent directories as needed, similar to
   * `mkdir -p` in shell commands.
   *
   * This method is called before writing cache entries to ensure the
   * directory structure is in place. It's safe to call multiple times.
   *
   * @throws Error if directory creation fails for reasons other than already existing
   *
   * @example
   * // Internal usage - called automatically before set():
   * await this.ensureDirectories();
   * // Creates: .ai-scan-cache/entries/ (if not exists)
   */
  private async ensureDirectories(): Promise<void> {
    const entriesDir = join(this.cacheDir, ENTRIES_DIR);

    try {
      await mkdir(entriesDir, { recursive: true });
    } catch (error) {
      // Directory already exists, ignore
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Update the hit rate statistic
   *
   * Recalculates the hit rate as the ratio of cache hits to total lookups
   * (hits + misses). Returns 0 if no lookups have been performed.
   *
   * This method is called automatically after each get() operation
   * to keep the hitRate statistic current.
   *
   * @example
   * // Internal usage - called after cache lookups:
   * this.stats.hits++;
   * this.updateHitRate();
   * // If hits=80 and misses=20, hitRate becomes 0.8 (80%)
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}

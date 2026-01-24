/**
 * @fileoverview Criteria Batch Processor Module
 *
 * This module provides the core batch processing logic for AI-powered WCAG criteria verification.
 * It orchestrates the verification of WCAG success criteria against downloaded web pages,
 * managing caching, checkpointing, and error handling throughout the process.
 *
 * ## Architecture Overview
 *
 * The batch processing workflow consists of the following stages:
 *
 * 1. **Initialization**: Load verification instructions, warm up cache, clean expired entries
 * 2. **Batch Creation**: Filter criteria by WCAG level (A, AA, AAA) and split into manageable batches
 * 3. **Checkpoint Loading**: Check for existing checkpoint to support resume capability
 * 4. **Batch Processing**: For each batch:
 *    - Check cache for existing results (cache hit = skip AI call)
 *    - Generate prompt from template with criteria and HTML content
 *    - Invoke Claude AI for verification
 *    - Parse and validate AI response
 *    - Store results in cache and save checkpoint
 * 5. **Result Aggregation**: Combine all batch results and clear checkpoint on success
 *
 * ## Key Dependencies
 *
 * - **CriteriaVerificationCache**: Stores verification results to avoid re-processing identical content
 * - **CriteriaCheckpointManager**: Enables resuming interrupted processing sessions
 * - **prompt-generator**: Generates AI prompts from Handlebars templates
 * - **result-parser**: Parses and validates AI JSON responses
 * - **claude-invoker**: Handles Claude AI API invocation
 *
 * ## Error Handling Strategy
 *
 * The processor implements a resilient error handling strategy:
 * - **Rate Limits**: Exponential backoff with configurable retries (default: 3 retries, 60s initial delay)
 * - **Timeouts**: Marks criteria as NOT_TESTED and continues processing
 * - **Malformed JSON**: Retries AI invocation once, then marks as NOT_TESTED
 * - **Unexpected Errors**: Logs error, creates error result, continues with remaining batches
 *
 * @module criteria-batch-processor
 * @see {@link CriteriaVerificationCache} for caching implementation
 * @see {@link CriteriaCheckpointManager} for checkpoint management
 * @see {@link parseBatchVerificationOutput} for response parsing
 * @see {@link generateCriteriaVerificationPrompt} for prompt generation
 */

import type { Logger } from './logger.js';
import type {
  AiCriteriaVerification,
  CriteriaBatchProcessorOptions,
  CriteriaBatchResult,
  CriterionVerificationInstruction,
  ExistingIssue,
  WcagLevel,
} from './types.js';
import { ErrorType } from './types.js';
import {
  CriteriaVerificationCache,
  type CriteriaVerificationCacheOptions,
} from './criteria-verification-cache.js';
import { CriteriaCheckpointManager } from './criteria-checkpoint-manager.js';
import {
  loadVerificationInstructions,
  generateCriteriaVerificationPrompt,
  type WcagVerificationInstructions,
} from './prompt-generator.js';
import type { DownloadedSite } from './website-downloader.js';
import { invokeClaudeCode, type InvocationResult } from './claude-invoker.js';
import { parseBatchVerificationOutput } from './result-parser.js';

/**
 * Default batch size for processing criteria.
 *
 * This value balances token usage (smaller batches = less context per call)
 * against API call overhead (larger batches = fewer total calls).
 * A batch size of 10 typically processes in 30-60 seconds with Claude.
 *
 * @constant {number}
 * @default 10
 */
const DEFAULT_BATCH_SIZE = 10;

/**
 * Default delay between batches in milliseconds.
 *
 * This delay helps avoid rate limiting by spacing out API calls.
 * The value of 2000ms (2 seconds) is conservative and can be reduced
 * if using higher rate limit tiers.
 *
 * @constant {number}
 * @default 2000
 */
const DEFAULT_DELAY_BETWEEN_BATCHES = 2000;

/**
 * Default timeout per batch in milliseconds.
 *
 * AI verification of 10 criteria typically completes in 30-60 seconds.
 * The 120-second timeout provides headroom for complex pages or
 * slower API responses.
 *
 * @constant {number}
 * @default 120000
 */
const DEFAULT_TIMEOUT = 120000;

/**
 * Maximum number of retries for rate-limited requests.
 *
 * Rate limit errors trigger exponential backoff retries.
 * With 3 retries and 60s initial delay: 60s, 120s, 240s = 7 minutes max wait.
 *
 * @constant {number}
 * @default 3
 */
const MAX_RATE_LIMIT_RETRIES = 3;

/**
 * Initial delay for rate limit exponential backoff (60 seconds).
 *
 * When a rate limit is hit, the processor waits this amount before
 * the first retry. Subsequent retries double this delay (exponential backoff).
 *
 * @constant {number}
 * @default 60000
 */
const INITIAL_RATE_LIMIT_DELAY_MS = 60000;

/**
 * Maximum number of retries for malformed JSON responses.
 *
 * If the AI returns invalid JSON, we retry the invocation once.
 * More retries are typically not helpful as the same prompt tends
 * to produce similar output.
 *
 * @constant {number}
 * @default 1
 */
const MAX_JSON_PARSE_RETRIES = 1;

/**
 * Orchestrates batch processing of WCAG criteria verifications
 *
 * The CriteriaBatchProcessor handles the core logic for processing WCAG criteria
 * verifications in batches, managing caching, checkpointing, and progress tracking.
 * It coordinates between the verification cache, checkpoint manager, and AI invoker.
 *
 * Key features:
 * - Batch processing of criteria to manage API rate limits
 * - Caching of verification results to avoid re-processing identical content
 * - Checkpoint support for resuming interrupted processing
 * - Configurable batch size, delays, and timeouts
 *
 * @example
 * const processor = new CriteriaBatchProcessor(logger, {
 *   batchSize: 10,
 *   delayBetweenBatches: 2000,
 *   timeout: 120000
 * });
 *
 * await processor.initialize();
 *
 * const results = await processor.processCriteriaBatches(
 *   downloadedSite,
 *   existingIssues,
 *   'AA'
 * );
 */
export class CriteriaBatchProcessor {
  private logger: Logger;
  private options: Required<CriteriaBatchProcessorOptions>;
  private cache: CriteriaVerificationCache;
  private checkpointManager: CriteriaCheckpointManager;
  private verificationInstructions: WcagVerificationInstructions | null = null;

  /**
   * Creates a new CriteriaBatchProcessor instance
   *
   * @param logger - Logger instance for progress and error logging
   * @param options - Configuration options for the processor
   *
   * @example
   * // Using defaults
   * const processor = new CriteriaBatchProcessor(logger);
   *
   * // Custom configuration
   * const processor = new CriteriaBatchProcessor(logger, {
   *   batchSize: 5,
   *   delayBetweenBatches: 3000,
   *   timeout: 60000
   * });
   */
  constructor(logger: Logger, options?: Partial<CriteriaBatchProcessorOptions>) {
    this.logger = logger;

    // Set defaults for all options
    this.options = {
      batchSize: options?.batchSize ?? DEFAULT_BATCH_SIZE,
      delayBetweenBatches: options?.delayBetweenBatches ?? DEFAULT_DELAY_BETWEEN_BATCHES,
      timeout: options?.timeout ?? DEFAULT_TIMEOUT,
    };

    // Initialize cache and checkpoint manager
    this.cache = this.initCache();
    this.checkpointManager = this.initCheckpointManager();
  }

  /**
   * Initialize the verification cache
   *
   * Creates a CriteriaVerificationCache instance with default settings.
   * The cache is used to store and retrieve verification results to avoid
   * re-processing identical content.
   *
   * @returns A new CriteriaVerificationCache instance
   */
  private initCache(cacheOptions?: CriteriaVerificationCacheOptions): CriteriaVerificationCache {
    return new CriteriaVerificationCache(cacheOptions);
  }

  /**
   * Initialize the checkpoint manager
   *
   * Creates a CriteriaCheckpointManager instance for tracking processing progress.
   * The checkpoint manager enables resuming interrupted processing sessions.
   *
   * @returns A new CriteriaCheckpointManager instance
   */
  private initCheckpointManager(checkpointDir?: string): CriteriaCheckpointManager {
    return new CriteriaCheckpointManager(checkpointDir);
  }

  /**
   * Initialize the processor
   *
   * Performs startup tasks including:
   * - Loading verification instructions from disk
   * - Warming up the verification cache
   * - Running cache cleanup for expired entries
   *
   * This method should be called before processing any batches.
   *
   * @example
   * const processor = new CriteriaBatchProcessor(logger);
   * await processor.initialize();
   * // Now ready to process batches
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing CriteriaBatchProcessor...');

    // Load verification instructions
    this.logger.debug('Loading verification instructions...');
    this.verificationInstructions = await loadVerificationInstructions();
    this.logger.debug(
      `Loaded ${Object.keys(this.verificationInstructions.criteria).length} criteria instructions`
    );

    // Warm up the cache
    this.logger.debug('Warming up verification cache...');
    await this.cache.warmup();
    const cacheStats = this.cache.getStats();
    this.logger.debug(`Cache warmed up with ${cacheStats.entriesCount} entries`);

    // Clean up expired cache entries
    const cleanedCount = await this.cache.cleanup();
    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} expired cache entries`);
    }

    this.logger.info('CriteriaBatchProcessor initialized successfully');
  }

  /**
   * Get the verification instructions (must call initialize() first)
   *
   * Returns the loaded WCAG verification instructions that define how to verify
   * each criterion. These instructions include pass conditions, fail indicators,
   * and guidance for AI verification.
   *
   * @returns The loaded verification instructions, or null if not initialized
   *
   * @example
   * const processor = new CriteriaBatchProcessor(logger);
   * await processor.initialize();
   *
   * const instructions = processor.getVerificationInstructions();
   * if (instructions) {
   *   console.log(`Loaded ${Object.keys(instructions.criteria).length} criteria`);
   *   console.log(`Version: ${instructions.version}`);
   * }
   */
  getVerificationInstructions(): WcagVerificationInstructions | null {
    return this.verificationInstructions;
  }

  /**
   * Get the verification cache instance
   *
   * Provides access to the underlying cache for advanced operations like
   * manual cache invalidation or statistics retrieval.
   *
   * @returns The CriteriaVerificationCache instance used by this processor
   *
   * @example
   * const cache = processor.getCache();
   * const stats = cache.getStats();
   * console.log(`Cache has ${stats.entriesCount} entries`);
   * console.log(`Hit rate: ${stats.hitRate}%`);
   */
  getCache(): CriteriaVerificationCache {
    return this.cache;
  }

  /**
   * Get the checkpoint manager instance
   *
   * Provides access to the underlying checkpoint manager for advanced operations
   * like manual checkpoint inspection or clearing.
   *
   * @returns The CriteriaCheckpointManager instance used by this processor
   *
   * @example
   * const checkpointManager = processor.getCheckpointManager();
   * const checkpoint = await checkpointManager.getCheckpoint('scan-123');
   * if (checkpoint) {
   *   console.log(`Resume from batch ${checkpoint.completedBatches.length}`);
   * }
   */
  getCheckpointManager(): CriteriaCheckpointManager {
    return this.checkpointManager;
  }

  /**
   * Get the current processor options
   *
   * Returns a copy of the processor configuration options. Modifying the
   * returned object does not affect the processor's configuration.
   *
   * @returns A copy of the processor configuration options
   *
   * @example
   * const options = processor.getOptions();
   * console.log(`Batch size: ${options.batchSize}`);
   * console.log(`Timeout: ${options.timeout}ms`);
   * console.log(`Delay between batches: ${options.delayBetweenBatches}ms`);
   */
  getOptions(): Required<CriteriaBatchProcessorOptions> {
    return { ...this.options };
  }

  /**
   * Filter criteria from loaded verification instructions by WCAG level
   *
   * Filters the full set of WCAG criteria to include only those applicable
   * to the target conformance level. WCAG levels are cumulative:
   * - Level A: Only Level A criteria (~30 criteria)
   * - Level AA: Level A + Level AA criteria (~50 criteria)
   * - Level AAA: Level A + Level AA + Level AAA criteria (~78 criteria)
   *
   * Results are sorted by criterion ID for consistent processing order
   * (e.g., 1.1.1, 1.2.1, 1.2.2, ..., 4.1.3).
   *
   * @param wcagLevel - Target WCAG conformance level (A, AA, or AAA)
   * @returns Array of CriterionVerificationInstruction filtered and sorted by criterion ID
   * @throws Error if verification instructions are not loaded (call initialize() first)
   *
   * @example
   * // Internal usage - called by createBatches()
   * const levelACriteria = this.filterCriteriaByLevel('A');
   * console.log(`Level A has ${levelACriteria.length} criteria`);
   *
   * @private
   */
  private filterCriteriaByLevel(wcagLevel: WcagLevel): CriterionVerificationInstruction[] {
    if (!this.verificationInstructions) {
      throw new Error('Verification instructions not loaded. Call initialize() first.');
    }

    // Determine which levels to include based on the target level
    const includedLevels: Set<string> = new Set();
    switch (wcagLevel) {
      case 'A':
        includedLevels.add('A');
        break;
      case 'AA':
        includedLevels.add('A');
        includedLevels.add('AA');
        break;
      case 'AAA':
        includedLevels.add('A');
        includedLevels.add('AA');
        includedLevels.add('AAA');
        break;
    }

    const result: CriterionVerificationInstruction[] = [];

    // Filter criteria by level
    for (const [, criterion] of Object.entries(this.verificationInstructions.criteria)) {
      if (includedLevels.has(criterion.level)) {
        // Convert CriterionWithLevel to CriterionVerificationInstruction
        // by extracting only the fields defined in CriterionVerificationInstruction
        const verificationInstruction: CriterionVerificationInstruction = {
          criterionId: criterion.criterionId,
          title: criterion.title,
          description: criterion.description,
          whatToCheck: Array.isArray(criterion.whatToCheck)
            ? criterion.whatToCheck.join('\n')
            : criterion.whatToCheck,
          passCondition: criterion.passCondition,
          failIndicators: Array.isArray(criterion.failIndicators)
            ? criterion.failIndicators.join('\n')
            : criterion.failIndicators,
          requiresManualReview: criterion.requiresManualReview,
        };
        result.push(verificationInstruction);
      }
    }

    // Sort by criterion ID for consistent ordering (e.g., 1.1.1, 1.2.1, 1.3.1, ...)
    result.sort((a, b) => {
      const aParts = a.criterionId.split('.').map(Number);
      const bParts = b.criterionId.split('.').map(Number);
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aVal = aParts[i] ?? 0;
        const bVal = bParts[i] ?? 0;
        if (aVal !== bVal) {
          return aVal - bVal;
        }
      }
      return 0;
    });

    return result;
  }

  /**
   * Create batches of criteria for verification based on WCAG level
   *
   * Divides WCAG criteria into manageable batches for AI processing.
   * Criteria are filtered based on the target conformance level:
   * - Level A: Only includes Level A criteria (~30 criteria)
   * - Level AA: Includes Level A and AA criteria (~50 criteria)
   * - Level AAA: Includes all criteria (A, AA, AAA)
   *
   * @param wcagLevel - The WCAG conformance level (A, AA, AAA)
   * @returns Array of criteria batches, each containing up to batchSize criteria
   * @throws Error if verification instructions are not loaded (call initialize() first)
   *
   * @example
   * await processor.initialize();
   * const batches = processor.createBatches('AA');
   * // Returns ~5-6 batches for Level AA (50 criteria / 10 per batch)
   * console.log(`Created ${batches.length} batches`);
   *
   * @example
   * // With custom batch size (configured in constructor)
   * const processor = new CriteriaBatchProcessor(logger, { batchSize: 8 });
   * await processor.initialize();
   * const batches = processor.createBatches('A');
   * // Returns ~4 batches for Level A (30 criteria / 8 per batch)
   */
  createBatches(wcagLevel: WcagLevel): CriterionVerificationInstruction[][] {
    // Filter criteria by the target WCAG level
    const filteredCriteria = this.filterCriteriaByLevel(wcagLevel);

    // Split into batches of batchSize
    const batches: CriterionVerificationInstruction[][] = [];
    const batchSize = this.options.batchSize;

    for (let i = 0; i < filteredCriteria.length; i += batchSize) {
      const batch = filteredCriteria.slice(i, i + batchSize);
      batches.push(batch);
    }

    this.logger.debug(
      `Created ${batches.length} batches of ${batchSize} criteria for WCAG Level ${wcagLevel} ` +
        `(${filteredCriteria.length} total criteria)`
    );

    return batches;
  }

  /**
   * Process a single batch of criteria
   *
   * Processes one batch of WCAG criteria through the AI verification pipeline.
   * Uses caching to avoid re-processing identical content and saves checkpoints
   * for resilience against interruptions.
   *
   * Workflow:
   * 1. Generate cache key from HTML content, WCAG level, and batch number
   * 2. Check cache for existing results
   * 3. On cache hit: Return cached verifications (saves tokens)
   * 4. On cache miss: Generate prompt, invoke AI, parse response
   * 5. Store results in cache and save checkpoint
   * 6. Return CriteriaBatchResult with verifications and metrics
   *
   * @param batchNumber - The batch number (0-indexed)
   * @param criteriaBatch - The criteria to verify
   * @param downloadedSite - The downloaded site data
   * @param existingIssueIds - IDs of existing issues from axe-core
   * @param scanId - The scan ID for checkpointing
   * @param wcagLevel - The WCAG level being verified
   * @returns Promise resolving to CriteriaBatchResult
   *
   * @example
   * const result = await processor.processSingleBatch(
   *   0,
   *   criteriaBatch,
   *   downloadedSite,
   *   ['issue-1', 'issue-2'],
   *   'scan-123',
   *   'AA'
   * );
   * console.log(`Batch 0: ${result.criteriaVerified} criteria, ${result.tokensUsed} tokens`);
   */
  async processSingleBatch(
    batchNumber: number,
    criteriaBatch: CriterionVerificationInstruction[],
    downloadedSite: DownloadedSite,
    existingIssueIds: string[],
    scanId: string,
    wcagLevel: WcagLevel
  ): Promise<CriteriaBatchResult> {
    const startTime = Date.now();

    // Generate cache key from HTML content, WCAG level, and batch number
    const cacheKey = this.cache.generateKey(
      downloadedSite.htmlContent,
      wcagLevel,
      batchNumber
    );

    // Check cache first
    try {
      const cachedEntry = await this.cache.get(cacheKey);

      if (cachedEntry) {
        // Cache hit - return cached verifications
        this.logger.info(`Cache hit for batch ${batchNumber + 1}`);
        const durationMs = Date.now() - startTime;

        return {
          batchNumber: batchNumber + 1, // Convert to 1-indexed for output
          criteriaVerified: cachedEntry.verifications.length,
          verifications: cachedEntry.verifications,
          tokensUsed: 0, // No AI call was made
          durationMs,
          errors: [],
        };
      }
    } catch (cacheError) {
      // Log cache error but continue with AI invocation
      const cacheErrorMsg = cacheError instanceof Error ? cacheError.message : String(cacheError);
      this.logger.warning(`Cache lookup failed for batch ${batchNumber + 1}: ${cacheErrorMsg}`);
    }

    // Cache miss - need to call AI
    this.logger.info(
      `Cache miss for batch ${batchNumber + 1}, invoking AI for ${criteriaBatch.length} criteria...`
    );

    // Generate the prompt for criteria verification
    let prompt: string;
    try {
      prompt = await generateCriteriaVerificationPrompt(
        downloadedSite,
        criteriaBatch,
        existingIssueIds
      );
    } catch (promptError) {
      const errorMsg = `Prompt generation failed: ${promptError instanceof Error ? promptError.message : String(promptError)}`;
      this.logger.error(`Batch ${batchNumber + 1} failed: ${errorMsg}`);
      const durationMs = Date.now() - startTime;
      return this.createNotTestedFallback(batchNumber, criteriaBatch, errorMsg, durationMs);
    }

    // Helper function to invoke AI and parse response
    const invokeAndParse = async (): Promise<{ invocationResult: InvocationResult; prompt: string }> => {
      const result = await invokeClaudeCode(prompt, {
        timeout: this.options.timeout,
        logger: this.logger,
      });
      return { invocationResult: result, prompt };
    };

    // Attempt AI invocation with error handling
    let invocationResult: InvocationResult;
    let jsonParseRetryCount = 0;

    try {
      // Try with exponential backoff for rate limits
      const result = await this.retryWithBackoff(
        async () => {
          const { invocationResult: ir } = await invokeAndParse();

          // Check for rate limit errors and throw to trigger retry
          if (!ir.success && this.isRateLimitError(ir.error, ir.errorType)) {
            throw new Error(`Rate limit: ${ir.error}`);
          }

          return ir;
        },
        MAX_RATE_LIMIT_RETRIES,
        INITIAL_RATE_LIMIT_DELAY_MS
      );
      invocationResult = result;
    } catch (rateLimitError) {
      // Rate limit retries exhausted
      const errorMsg = `Rate limit retries exhausted after ${MAX_RATE_LIMIT_RETRIES} attempts`;
      this.logger.error(`Batch ${batchNumber + 1}: ${errorMsg}`);
      const durationMs = Date.now() - startTime;
      return this.createNotTestedFallback(batchNumber, criteriaBatch, errorMsg, durationMs);
    }

    // Handle timeout errors
    if (!invocationResult.success && this.isTimeoutError(invocationResult.error, invocationResult.errorType)) {
      const errorMsg = `Timeout after ${this.options.timeout}ms`;
      this.logger.warning(`Batch ${batchNumber + 1}: ${errorMsg}. Marking criteria as NOT_TESTED.`);
      const durationMs = Date.now() - startTime;
      return this.createNotTestedFallback(batchNumber, criteriaBatch, errorMsg, durationMs);
    }

    // Handle other invocation failures (non-rate-limit, non-timeout)
    if (!invocationResult.success || !invocationResult.output) {
      const errorMsg = invocationResult.error ?? 'Unknown error during AI invocation';
      this.logger.error(`Batch ${batchNumber + 1} failed: ${errorMsg}`);
      const durationMs = Date.now() - startTime;
      return this.createNotTestedFallback(batchNumber, criteriaBatch, errorMsg, durationMs);
    }

    // Parse the AI response with retry for malformed JSON
    let verifications: AiCriteriaVerification[] = [];
    let parseSuccessful = false;
    // Store output in a variable with guaranteed string type (we verified it exists above)
    let outputToParse = invocationResult.output!;

    while (!parseSuccessful && jsonParseRetryCount <= MAX_JSON_PARSE_RETRIES) {
      try {
        const parseResult = parseBatchVerificationOutput(outputToParse);
        verifications = parseResult.criteriaVerifications;

        // Check if we got any valid verifications
        if (verifications.length === 0) {
          throw new Error('No valid verifications parsed from output');
        }

        parseSuccessful = true;
      } catch (parseError) {
        const parseErrorMsg = parseError instanceof Error ? parseError.message : String(parseError);

        if (this.isJsonParseError(parseErrorMsg) && jsonParseRetryCount < MAX_JSON_PARSE_RETRIES) {
          // Retry with AI invocation again (hoping for better formatted response)
          this.logger.warning(
            `Batch ${batchNumber + 1}: JSON parse error, retrying AI invocation (${jsonParseRetryCount + 1}/${MAX_JSON_PARSE_RETRIES}): ${parseErrorMsg}`
          );
          jsonParseRetryCount++;

          try {
            // Re-invoke AI
            const retryResult = await invokeClaudeCode(prompt, {
              timeout: this.options.timeout,
              logger: this.logger,
            });

            if (retryResult.success && retryResult.output) {
              outputToParse = retryResult.output;
            } else {
              // Retry invocation also failed
              const errorMsg = `JSON parse retry failed: ${retryResult.error ?? 'No output'}`;
              this.logger.error(`Batch ${batchNumber + 1}: ${errorMsg}`);
              const durationMs = Date.now() - startTime;
              return this.createNotTestedFallback(batchNumber, criteriaBatch, errorMsg, durationMs);
            }
          } catch (retryError) {
            const errorMsg = `JSON parse retry invocation failed: ${retryError instanceof Error ? retryError.message : String(retryError)}`;
            this.logger.error(`Batch ${batchNumber + 1}: ${errorMsg}`);
            const durationMs = Date.now() - startTime;
            return this.createNotTestedFallback(batchNumber, criteriaBatch, errorMsg, durationMs);
          }
        } else {
          // Max retries reached or non-JSON error
          const errorMsg = `Failed to parse AI response after ${jsonParseRetryCount} retry(s): ${parseErrorMsg}`;
          this.logger.error(`Batch ${batchNumber + 1}: ${errorMsg}`);
          const durationMs = Date.now() - startTime;
          return this.createNotTestedFallback(batchNumber, criteriaBatch, errorMsg, durationMs);
        }
      }
    }

    // Estimate tokens used (rough estimation based on prompt + output length)
    // In a real implementation, this would come from the API response
    const estimatedTokens = Math.ceil(
      (prompt.length + outputToParse.length) / 4
    );

    // Store in cache (don't let cache errors fail the batch)
    try {
      await this.cache.set(cacheKey, verifications, estimatedTokens, 'claude-opus-4');
      this.logger.debug(`Cached batch ${batchNumber + 1} results`);
    } catch (cacheError) {
      const cacheErrorMsg = cacheError instanceof Error ? cacheError.message : String(cacheError);
      this.logger.warning(`Failed to cache batch ${batchNumber + 1} results: ${cacheErrorMsg}`);
    }

    // Save checkpoint (don't let checkpoint errors fail the batch)
    try {
      await this.checkpointManager.markBatchComplete(
        scanId,
        batchNumber,
        verifications,
        estimatedTokens
      );
      this.logger.debug(`Checkpoint saved for batch ${batchNumber + 1}`);
    } catch (checkpointError) {
      const checkpointErrorMsg = checkpointError instanceof Error ? checkpointError.message : String(checkpointError);
      this.logger.warning(`Failed to save checkpoint for batch ${batchNumber + 1}: ${checkpointErrorMsg}`);
    }

    const durationMs = Date.now() - startTime;
    this.logger.success(
      `Batch ${batchNumber + 1} completed: ${verifications.length} criteria verified in ${durationMs}ms`
    );

    return {
      batchNumber: batchNumber + 1,
      criteriaVerified: verifications.length,
      verifications,
      tokensUsed: estimatedTokens,
      durationMs,
      errors: [],
    };
  }

  /**
   * Sleep for a specified number of milliseconds
   *
   * Helper function to add configurable delays between batch processing
   * to avoid rate limiting and provide a smoother processing experience.
   *
   * @param ms - Number of milliseconds to sleep
   * @returns Promise that resolves after the specified delay
   *
   * @private
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Create a fallback result when a batch fails with NOT_TESTED status for all criteria
   *
   * This method generates a CriteriaBatchResult where all criteria in the batch
   * are marked as NOT_TESTED. This is used when:
   * - A timeout occurs during AI processing
   * - Rate limit retries are exhausted
   * - Malformed JSON cannot be parsed after retries
   *
   * @param batchNumber - The batch number (0-indexed internally, 1-indexed in output)
   * @param criteriaBatch - The criteria that were being verified
   * @param error - Description of the error that caused the fallback
   * @param durationMs - Time spent attempting to process before fallback
   * @returns CriteriaBatchResult with all criteria marked as NOT_TESTED
   *
   * @private
   */
  private createNotTestedFallback(
    batchNumber: number,
    criteriaBatch: CriterionVerificationInstruction[],
    error: string,
    durationMs: number
  ): CriteriaBatchResult {
    // Create NOT_TESTED verifications for each criterion in the batch
    const verifications: AiCriteriaVerification[] = criteriaBatch.map((criterion) => ({
      criterionId: criterion.criterionId,
      status: 'NOT_TESTED' as const,
      confidence: 0,
      reasoning: `Unable to verify: ${error}`,
      relatedIssueIds: [],
    }));

    return {
      batchNumber: batchNumber + 1, // Convert to 1-indexed for output
      criteriaVerified: verifications.length,
      verifications,
      tokensUsed: 0,
      durationMs,
      errors: [error],
    };
  }

  /**
   * Retry a function with exponential backoff
   *
   * Implements exponential backoff retry logic for handling rate limits and
   * transient failures. The delay doubles with each retry attempt:
   * - Attempt 1: initialDelayMs (e.g., 60s)
   * - Attempt 2: initialDelayMs * 2 (e.g., 120s)
   * - Attempt 3: initialDelayMs * 4 (e.g., 240s)
   *
   * @param fn - The async function to retry
   * @param maxRetries - Maximum number of retry attempts
   * @param initialDelayMs - Initial delay in milliseconds before first retry
   * @returns Promise resolving to the function result
   * @throws The last error if all retries are exhausted
   *
   * @private
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number,
    initialDelayMs: number
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries) {
          // Calculate exponential backoff delay: initialDelay * 2^attempt
          const delayMs = initialDelayMs * Math.pow(2, attempt);
          const delaySeconds = Math.round(delayMs / 1000);

          this.logger.warning(
            `Retry ${attempt + 1}/${maxRetries} after ${delaySeconds}s delay: ${lastError.message}`
          );

          await this.sleep(delayMs);
        }
      }
    }

    throw lastError;
  }

  /**
   * Detect if an error is a rate limit error
   *
   * Checks both the ErrorType enum and error message text for rate limit indicators.
   * Rate limit errors trigger exponential backoff retries.
   *
   * Detection patterns:
   * - ErrorType.RATE_LIMIT enum value
   * - "rate limit" in error message (case-insensitive)
   * - "429" HTTP status code in error message
   * - "too many requests" in error message
   * - "quota exceeded" in error message
   *
   * @param error - The error message string (may be undefined)
   * @param errorType - The ErrorType enum value from invocation result (may be undefined)
   * @returns True if this is a rate limit error, false otherwise
   *
   * @example
   * // Check if we should retry with backoff
   * if (this.isRateLimitError(result.error, result.errorType)) {
   *   await this.sleep(60000); // Wait 60 seconds before retry
   * }
   *
   * @private
   */
  private isRateLimitError(error: string | undefined, errorType: ErrorType | undefined): boolean {
    if (errorType === ErrorType.RATE_LIMIT) {
      return true;
    }
    if (error) {
      const lowerError = error.toLowerCase();
      return (
        lowerError.includes('rate limit') ||
        lowerError.includes('429') ||
        lowerError.includes('too many requests') ||
        lowerError.includes('quota exceeded')
      );
    }
    return false;
  }

  /**
   * Detect if an error is a timeout error
   *
   * Checks both the ErrorType enum and error message text for timeout indicators.
   * Timeout errors result in marking criteria as NOT_TESTED (no retry).
   *
   * Detection patterns:
   * - ErrorType.TIMEOUT enum value
   * - "timeout" in error message (case-insensitive)
   * - "timed out" in error message
   * - "etimedout" Node.js error code
   *
   * @param error - The error message string (may be undefined)
   * @param errorType - The ErrorType enum value from invocation result (may be undefined)
   * @returns True if this is a timeout error, false otherwise
   *
   * @example
   * // Handle timeout by marking criteria as NOT_TESTED
   * if (this.isTimeoutError(result.error, result.errorType)) {
   *   return this.createNotTestedFallback(batchNumber, criteria, 'Timeout', durationMs);
   * }
   *
   * @private
   */
  private isTimeoutError(error: string | undefined, errorType: ErrorType | undefined): boolean {
    if (errorType === ErrorType.TIMEOUT) {
      return true;
    }
    if (error) {
      const lowerError = error.toLowerCase();
      return (
        lowerError.includes('timeout') ||
        lowerError.includes('timed out') ||
        lowerError.includes('etimedout')
      );
    }
    return false;
  }

  /**
   * Detect if an error is a JSON parse error
   *
   * Checks error message text for JSON parsing failure indicators.
   * JSON parse errors trigger a retry of the AI invocation (up to MAX_JSON_PARSE_RETRIES).
   *
   * Detection patterns:
   * - "json" in error message (case-insensitive)
   * - "parse" in error message
   * - "unexpected token" JavaScript JSON.parse error
   * - "malformed" in error message
   *
   * @param error - The error message string (may be undefined)
   * @returns True if this is a JSON parse error, false otherwise
   *
   * @example
   * // Retry AI invocation if JSON parsing failed
   * if (this.isJsonParseError(parseError.message) && retryCount < MAX_JSON_PARSE_RETRIES) {
   *   const retryResult = await invokeClaudeCode(prompt, options);
   *   // ... parse retry result
   * }
   *
   * @private
   */
  private isJsonParseError(error: string | undefined): boolean {
    if (error) {
      const lowerError = error.toLowerCase();
      return (
        lowerError.includes('json') ||
        lowerError.includes('parse') ||
        lowerError.includes('unexpected token') ||
        lowerError.includes('malformed')
      );
    }
    return false;
  }

  /**
   * Process WCAG criteria verifications in batches
   *
   * This is the main entry point for criteria verification. It processes
   * all applicable WCAG criteria for the given site and level in batches,
   * using the cache and checkpoint manager for efficiency and resilience.
   *
   * Workflow:
   * 1. Extract scan info and create batches based on WCAG level
   * 2. Check for existing checkpoint to support resume capability
   * 3. If checkpoint exists, resume from where we left off
   * 4. If no checkpoint, initialize fresh processing state
   * 5. Loop through all batches, skipping already completed ones
   * 6. Add configurable delay between batches to avoid rate limiting
   * 7. Aggregate all verification results
   * 8. Clear checkpoint on successful completion
   * 9. Return array of CriteriaBatchResult objects
   *
   * @param downloadedSite - The downloaded site data to verify
   * @param existingIssues - Existing issues from axe-core scan
   * @param wcagLevel - Target WCAG conformance level (A, AA, or AAA)
   * @returns Promise resolving to array of CriteriaBatchResult objects
   *
   * @example
   * const results = await processor.processCriteriaBatches(
   *   downloadedSite,
   *   existingIssues,
   *   'AA'
   * );
   *
   * for (const batch of results) {
   *   console.log(`Batch ${batch.batchNumber}: ${batch.criteriaVerified} criteria verified`);
   * }
   */
  async processCriteriaBatches(
    downloadedSite: DownloadedSite,
    existingIssues: ExistingIssue[],
    wcagLevel: WcagLevel
  ): Promise<CriteriaBatchResult[]> {
    // Extract scanId from downloaded site
    const scanId = downloadedSite.scanId;

    // Extract existing issue IDs for reference during verification
    const existingIssueIds = existingIssues.map((issue) => issue.id);

    this.logger.info(
      `Starting criteria batch processing for scan ${scanId} at WCAG Level ${wcagLevel}`
    );
    this.logger.debug(`Found ${existingIssueIds.length} existing issues from axe-core`);

    // Create batches based on WCAG level
    const batches = this.createBatches(wcagLevel);
    const totalBatches = batches.length;

    if (totalBatches === 0) {
      this.logger.warning('No criteria batches to process');
      return [];
    }

    this.logger.info(`Created ${totalBatches} batches for processing`);

    // Results array to collect all batch results
    const results: CriteriaBatchResult[] = [];

    // Track which batches are already completed (for resume support)
    let completedBatchNumbers: Set<number> = new Set();

    // Check for existing checkpoint (resume support)
    const existingCheckpoint = await this.checkpointManager.getCheckpoint(scanId);

    if (existingCheckpoint) {
      // Resume from checkpoint
      this.logger.info(
        `Resuming from checkpoint: ${existingCheckpoint.completedBatches.length}/${totalBatches} batches completed`
      );

      // Get completed batch numbers from checkpoint
      completedBatchNumbers = new Set(existingCheckpoint.completedBatches);

      // Get incomplete batches that need processing
      const incompleteBatches = this.checkpointManager.getIncompleteBatches(existingCheckpoint);
      this.logger.debug(`Batches remaining to process: ${incompleteBatches.join(', ')}`);

      // Create partial results from checkpoint's completed verifications
      // Group partial verifications by batch for consistent result structure
      // Note: We don't have detailed batch results from checkpoint, so we only track
      // that completed batches exist. The verifications are already in partialVerifications.
      // For resumed runs, we'll only return results from newly processed batches.
    } else {
      // Initialize fresh checkpoint
      this.logger.info('No checkpoint found, starting fresh processing');

      const checkpoint = this.checkpointManager.initCheckpoint(
        scanId,
        downloadedSite.url,
        wcagLevel,
        totalBatches
      );

      await this.checkpointManager.saveCheckpoint(checkpoint);
      this.logger.debug('Initial checkpoint saved');
    }

    // Process each batch
    let processedCount = 0;
    let skippedCount = 0;

    for (let batchNumber = 0; batchNumber < totalBatches; batchNumber++) {
      // Skip if batch is already completed (from checkpoint)
      if (completedBatchNumbers.has(batchNumber)) {
        this.logger.debug(`Skipping batch ${batchNumber + 1}/${totalBatches} (already completed)`);
        skippedCount++;
        continue;
      }

      // Add delay between batches (except for the first one)
      if (processedCount > 0 && this.options.delayBetweenBatches > 0) {
        this.logger.debug(
          `Waiting ${this.options.delayBetweenBatches}ms before next batch...`
        );
        await this.sleep(this.options.delayBetweenBatches);
      }

      this.logger.info(
        `Processing batch ${batchNumber + 1}/${totalBatches} (${batches[batchNumber].length} criteria)`
      );

      try {
        // Process the single batch
        const batchResult = await this.processSingleBatch(
          batchNumber,
          batches[batchNumber],
          downloadedSite,
          existingIssueIds,
          scanId,
          wcagLevel
        );

        results.push(batchResult);
        processedCount++;

        // Log batch result
        if (batchResult.errors.length > 0) {
          this.logger.warning(
            `Batch ${batchNumber + 1} completed with ${batchResult.errors.length} error(s)`
          );
        } else {
          this.logger.debug(
            `Batch ${batchNumber + 1} completed: ${batchResult.criteriaVerified} criteria, ` +
              `${batchResult.tokensUsed} tokens, ${batchResult.durationMs}ms`
          );
        }
      } catch (error) {
        // Handle unexpected errors - continue with remaining batches
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.logger.error(`Batch ${batchNumber + 1} failed unexpectedly: ${errorMsg}`);

        // Create error result for this batch
        const errorResult: CriteriaBatchResult = {
          batchNumber: batchNumber + 1,
          criteriaVerified: 0,
          verifications: [],
          tokensUsed: 0,
          durationMs: 0,
          errors: [errorMsg],
        };

        results.push(errorResult);
        processedCount++;

        // Continue with remaining batches - don't stop processing
        continue;
      }
    }

    // Calculate totals for logging
    const totalVerified = results.reduce((sum, r) => sum + r.criteriaVerified, 0);
    const totalTokens = results.reduce((sum, r) => sum + r.tokensUsed, 0);
    const totalDuration = results.reduce((sum, r) => sum + r.durationMs, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

    // Log summary
    this.logger.info(
      `Batch processing complete: ${processedCount} batches processed, ${skippedCount} skipped`
    );
    this.logger.info(
      `Results: ${totalVerified} criteria verified, ${totalTokens} tokens used, ${totalDuration}ms total`
    );

    if (totalErrors > 0) {
      this.logger.warning(`Encountered ${totalErrors} error(s) during processing`);
    }

    // Clear checkpoint on successful completion
    // Only clear if all batches were processed (none remaining)
    const remainingBatches = totalBatches - skippedCount - processedCount;
    if (remainingBatches === 0) {
      this.logger.debug('All batches completed, clearing checkpoint');
      await this.checkpointManager.clearCheckpoint(scanId);
      this.logger.success(`Checkpoint cleared for scan ${scanId}`);
    } else {
      this.logger.warning(
        `${remainingBatches} batches remaining, checkpoint preserved for resume`
      );
    }

    return results;
  }
}

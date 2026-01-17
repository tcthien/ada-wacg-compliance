import type { ScanResult, ExistingIssue } from './types.js';
import { ErrorType } from './types.js';
import type { Logger } from './logger.js';
import type { MiniBatch, Batch } from './batch-organizer.js';
import { generateHtmlAnalysisPrompt, generateIssueEnhancementPrompt } from './prompt-generator.js';
import { invokeClaudeCode } from './claude-invoker.js';
import { parseClaudeOutput } from './result-parser.js';
import type { CheckpointManager } from './checkpoint-manager.js';
import { WebsiteDownloader, type DownloadedSite } from './website-downloader.js';

/**
 * Extended DownloadedSite with existing issues from the input CSV
 */
interface DownloadedSiteWithIssues extends DownloadedSite {
  /** Existing issues from axe-core scan to be enhanced */
  existingIssues?: ExistingIssue[];
}

/**
 * Options for configuring the MiniBatchProcessor
 */
export interface MiniBatchProcessorOptions {
  /**
   * Delay in seconds between mini-batches
   * @default 5
   */
  delay?: number;

  /**
   * Timeout per mini-batch in milliseconds
   * @default 180000
   */
  timeout?: number;

  /**
   * Maximum retries per mini-batch
   * @default 3
   */
  retries?: number;

  /**
   * Log prompts when true
   * @default false
   */
  verbose?: boolean;

  /**
   * Optional callback for progress updates
   */
  onProgress?: (progress: ProcessingProgress) => void;
}

/**
 * Progress information for mini-batch processing
 */
export interface ProcessingProgress {
  /** Current batch number (0-indexed) */
  batchNumber: number;

  /** Current mini-batch number within the batch (0-indexed) */
  miniBatchNumber: number;

  /** Total number of mini-batches in the current batch */
  totalMiniBatches: number;

  /** Number of URLs processed so far */
  processedUrls: number;

  /** Total number of URLs to process */
  totalUrls: number;

  /** The URL currently being processed (if any) */
  currentUrl?: string;
}

/**
 * Result of processing a single mini-batch
 */
export interface MiniBatchResult {
  /** Mini-batch number (0-indexed) */
  miniBatchNumber: number;

  /** Successfully processed scan results */
  results: ScanResult[];

  /** Failed scans within this mini-batch */
  failedScans: FailedScan[];

  /** Duration of mini-batch processing in milliseconds */
  durationMs: number;

  /** Number of retries attempted for this mini-batch */
  retryCount: number;
}

/**
 * Represents a failed scan
 */
export interface FailedScan {
  /** The scan ID that failed */
  scanId: string;

  /** The URL that failed to scan */
  url: string;

  /** Type of error that occurred */
  errorType: ErrorType;

  /** Human-readable error message */
  errorMessage: string;
}

/**
 * Orchestrates mini-batch processing for AI scans
 *
 * The MiniBatchProcessor handles the core logic for processing scans in small batches,
 * managing retries, timeouts, and progress tracking. It coordinates between the
 * prompt generator, Claude invoker, result parser, and checkpoint manager.
 *
 * @example
 * const processor = new MiniBatchProcessor(
 *   promptGenerator,
 *   claudeInvoker,
 *   resultParser,
 *   checkpointManager,
 *   logger,
 *   { delay: 5, timeout: 180000, retries: 3 }
 * );
 */
export class MiniBatchProcessor {
  private logger: Logger;
  private options: Required<Omit<MiniBatchProcessorOptions, 'onProgress'>> & {
    onProgress?: (progress: ProcessingProgress) => void;
  };
  private checkpointManager: CheckpointManager | null = null;
  private downloader: WebsiteDownloader;

  /**
   * Creates a new MiniBatchProcessor instance
   *
   * @param logger - Logger instance for progress and error logging
   * @param options - Configuration options for the processor
   * @param checkpointManager - Optional checkpoint manager for state tracking
   */
  constructor(
    logger: Logger,
    options: MiniBatchProcessorOptions = {},
    checkpointManager?: CheckpointManager
  ) {
    this.logger = logger;

    // Set defaults for all options
    this.options = {
      delay: options.delay ?? 5,
      timeout: options.timeout ?? 180000,
      retries: options.retries ?? 3,
      verbose: options.verbose ?? false,
      onProgress: options.onProgress,
    };

    this.checkpointManager = checkpointManager || null;

    // Initialize website downloader
    this.downloader = new WebsiteDownloader({
      captureScreenshot: true,
      captureAccessibility: true,
      timeout: 60000,  // 60 seconds timeout
      retries: 3,      // 3 retries for failed page loads
      headless: true,
      logger: this.logger,
    });
  }

  /**
   * Initialize the processor (starts browser)
   */
  async initialize(): Promise<void> {
    await this.downloader.initialize();
  }

  /**
   * Close the processor (stops browser)
   */
  async close(): Promise<void> {
    await this.downloader.close();
  }

  /**
   * Process a single mini-batch of scans using download-then-analyze approach
   *
   * @param miniBatch - The mini-batch to process
   * @param batchNumber - The batch number this mini-batch belongs to
   * @returns Promise resolving to MiniBatchResult with results and failures
   */
  async processMiniBatch(
    miniBatch: MiniBatch,
    batchNumber: number
  ): Promise<MiniBatchResult> {
    const startTime = Date.now();
    const results: ScanResult[] = [];
    const failedScans: FailedScan[] = [];
    let totalRetries = 0;

    this.logger.info(
      `Processing batch ${batchNumber}, mini-batch ${miniBatch.miniBatchNumber} (${miniBatch.scans.length} scans)`
    );

    // Phase 1: Download all websites in the mini-batch
    this.logger.info('Phase 1: Downloading website content...');
    const downloadedSites: DownloadedSiteWithIssues[] = [];

    for (const scan of miniBatch.scans) {
      const downloadedSite = await this.downloader.downloadSite(scan);

      if (downloadedSite.success) {
        // Attach existing issues from the scan for enhancement mode
        const siteWithIssues: DownloadedSiteWithIssues = {
          ...downloadedSite,
          existingIssues: scan.existingIssues,
        };
        downloadedSites.push(siteWithIssues);
      } else {
        // Website download failed
        failedScans.push({
          scanId: scan.scanId,
          url: scan.url,
          errorType: ErrorType.URL_UNREACHABLE,
          errorMessage: downloadedSite.error || 'Failed to download website',
        });
      }
    }

    this.logger.info(
      `Downloaded ${downloadedSites.length}/${miniBatch.scans.length} websites successfully`
    );

    // Phase 2: Analyze each downloaded site with Claude
    // Uses enhancement mode if existing issues are present, otherwise discovery mode
    const hasExistingIssues = downloadedSites.some(site => site.existingIssues && site.existingIssues.length > 0);
    this.logger.info(`Phase 2: Analyzing content with AI (${hasExistingIssues ? 'enhancement' : 'discovery'} mode)...`);

    for (const site of downloadedSites) {
      const scanResult = await this.analyzeSiteWithRetry(site);

      if (scanResult) {
        results.push(scanResult);
      } else {
        failedScans.push({
          scanId: site.scanId,
          url: site.url,
          errorType: ErrorType.INVALID_OUTPUT,
          errorMessage: 'Failed to analyze website with Claude after retries',
        });
      }

      // Clean up downloaded files for this scan
      await this.downloader.cleanupScan(site.scanId);
    }

    const durationMs = Date.now() - startTime;
    this.logger.success(
      `Mini-batch ${miniBatch.miniBatchNumber} completed: ${results.length} succeeded, ${failedScans.length} failed (${durationMs}ms)`
    );

    return {
      miniBatchNumber: miniBatch.miniBatchNumber,
      results,
      failedScans,
      durationMs,
      retryCount: totalRetries,
    };
  }

  /**
   * Analyze a single downloaded site with Claude, with retry logic
   *
   * Uses enhancement mode if existing issues are present (enhances axe-core results),
   * otherwise uses discovery mode (finds new issues from scratch).
   *
   * @param site - The downloaded site to analyze (may include existing issues)
   * @returns Promise resolving to ScanResult or null if analysis failed
   */
  private async analyzeSiteWithRetry(site: DownloadedSiteWithIssues): Promise<ScanResult | null> {
    let retryCount = 0;
    const useEnhancementMode = site.existingIssues && site.existingIssues.length > 0;

    while (retryCount <= this.options.retries) {
      try {
        // Generate prompt based on mode:
        // - Enhancement mode: Enhance existing axe-core issues with AI explanations
        // - Discovery mode: Analyze HTML and find issues from scratch
        let prompt: string;
        if (useEnhancementMode) {
          this.logger.debug(`Using enhancement mode for ${site.url} (${site.existingIssues!.length} existing issues)`);
          prompt = await generateIssueEnhancementPrompt(site, site.existingIssues!);
        } else {
          prompt = await generateHtmlAnalysisPrompt(site);
        }

        // Log prompt if verbose mode is enabled
        if (this.options.verbose) {
          this.logger.debug(`Generated prompt for ${site.url}:\n${prompt.substring(0, 500)}...`);
        }

        const modeLabel = useEnhancementMode ? 'enhancing issues' : 'analyzing';
        this.logger.info(`${modeLabel.charAt(0).toUpperCase() + modeLabel.slice(1)} ${site.url} with Claude...`);

        // Invoke Claude using claudeInvoker
        const invocationResult = await invokeClaudeCode(prompt, {
          timeout: this.options.timeout,
          maxRetries: 1, // Handle retries at this level
          logger: this.logger,
        });

        // Check if invocation was successful
        if (!invocationResult.success) {
          const errorType = invocationResult.errorType || ErrorType.UNKNOWN;

          if (retryCount < this.options.retries) {
            const delay = this.calculateRetryDelay(errorType, retryCount);
            const waitTimeSeconds = delay / 1000;

            if (errorType === ErrorType.RATE_LIMIT) {
              this.logger.warning(
                `Rate limit hit for ${site.url}. Waiting ${waitTimeSeconds}s before retry ${retryCount + 1}/${this.options.retries}`
              );
            } else {
              this.logger.warning(
                `Analysis failed for ${site.url}: ${invocationResult.error}. Waiting ${waitTimeSeconds}s before retry ${retryCount + 1}/${this.options.retries}`
              );
            }

            await this.sleep(delay);
            retryCount++;
            continue;
          } else {
            this.logger.error(
              `Analysis failed for ${site.url} after ${retryCount} retries: ${invocationResult.error}`
            );
            return null;
          }
        }

        // Parse results using resultParser
        const parsedResults = parseClaudeOutput(invocationResult.output || '');

        // Find the result for this scan (should be only one since we analyze one at a time)
        const scanResult = parsedResults.find((r) => r.scanId === site.scanId);

        if (scanResult) {
          // Add duration from invocation
          scanResult.durationMs = invocationResult.durationMs;
          this.logger.success(`Successfully analyzed ${site.url}`);
          return scanResult;
        } else if (parsedResults.length > 0) {
          // Use the first result if scanId doesn't match (Claude might not include it)
          const result = parsedResults[0];
          result.scanId = site.scanId;
          result.url = site.url;
          result.durationMs = invocationResult.durationMs;
          this.logger.success(`Successfully analyzed ${site.url}`);
          return result;
        } else {
          if (retryCount < this.options.retries) {
            this.logger.warning(
              `No valid result found for ${site.url}. Retrying ${retryCount + 1}/${this.options.retries}`
            );
            await this.sleep(5000);
            retryCount++;
            continue;
          } else {
            this.logger.error(
              `No valid result found for ${site.url} after ${retryCount} retries`
            );
            return null;
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (retryCount < this.options.retries) {
          const delay = this.calculateRetryDelay(ErrorType.UNKNOWN, retryCount);
          const waitTimeSeconds = delay / 1000;

          this.logger.warning(
            `Unexpected error analyzing ${site.url}: ${errorMessage}. Waiting ${waitTimeSeconds}s before retry ${retryCount + 1}/${this.options.retries}`
          );

          await this.sleep(delay);
          retryCount++;
          continue;
        } else {
          this.logger.error(
            `Unexpected error analyzing ${site.url} after ${retryCount} retries: ${errorMessage}`
          );
          return null;
        }
      }
    }

    return null;
  }

  /**
   * Calculate retry delay based on error type and attempt number
   * @param errorType - Type of error that occurred
   * @param attemptNumber - Current retry attempt number (0-indexed)
   * @returns Delay in milliseconds
   */
  private calculateRetryDelay(errorType: ErrorType, attemptNumber: number): number {
    if (errorType === ErrorType.RATE_LIMIT) {
      // Rate limit: 60s, 120s, 240s
      return 60000 * Math.pow(2, attemptNumber);
    } else {
      // General errors: 5s, 10s, 20s
      return 5000 * Math.pow(2, attemptNumber);
    }
  }

  /**
   * Sleep for specified milliseconds
   * @param ms - Number of milliseconds to sleep
   * @returns Promise that resolves after the delay
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Process all mini-batches within a single batch
   *
   * Iterates through all mini-batches in the batch, processing each one
   * sequentially with delays between them. Tracks progress using checkpoint
   * manager and calls progress callback if provided.
   *
   * @param batch - The batch to process
   * @returns Promise resolving to array of all MiniBatchResult objects
   *
   * @example
   * const results = await processor.processBatch(batch);
   * console.log(`Batch completed: ${results.length} mini-batches processed`);
   */
  async processBatch(batch: Batch): Promise<MiniBatchResult[]> {
    const results: MiniBatchResult[] = [];
    const totalMiniBatches = batch.miniBatches.length;

    // Initialize the downloader (browser) before processing
    await this.initialize();

    this.logger.info(
      `Starting batch ${batch.batchNumber} with ${totalMiniBatches} mini-batches (${batch.scans.length} total scans)`
    );

    for (let i = 0; i < batch.miniBatches.length; i++) {
      const miniBatch = batch.miniBatches[i];

      // Call progress callback if provided
      if (this.options.onProgress) {
        const processedUrls = results.reduce(
          (sum, result) => sum + result.results.length,
          0
        );

        this.options.onProgress({
          batchNumber: batch.batchNumber - 1, // Convert to 0-indexed
          miniBatchNumber: i,
          totalMiniBatches,
          processedUrls,
          totalUrls: batch.scans.length,
          currentUrl: miniBatch.scans[0]?.url,
        });
      }

      // Process the mini-batch
      const result = await this.processMiniBatch(miniBatch, batch.batchNumber);
      results.push(result);

      // Mark successful scans as processed in checkpoint
      if (this.checkpointManager && result.results.length > 0) {
        const processedScanIds = result.results.map((r) => r.scanId);
        this.checkpointManager.markProcessed(processedScanIds);
        await this.checkpointManager.flush();
      }

      // Apply delay between mini-batches (except after the last one)
      if (i < batch.miniBatches.length - 1) {
        const delayMs = this.options.delay * 1000;
        this.logger.info(`Waiting ${this.options.delay}s before next mini-batch...`);
        await this.sleep(delayMs);
      }
    }

    // Close the browser after processing the batch
    await this.close();

    return results;
  }

  /**
   * Process all batches sequentially
   *
   * Iterates through all batches, processing each one completely before
   * moving to the next. Logs completion statistics for each batch.
   *
   * @param batches - Array of batches to process
   * @returns Promise resolving to array of all MiniBatchResult objects across all batches
   *
   * @example
   * const allResults = await processor.processAllBatches(batches);
   * console.log(`All batches completed: ${allResults.length} mini-batches total`);
   */
  async processAllBatches(batches: Batch[]): Promise<MiniBatchResult[]> {
    const allResults: MiniBatchResult[] = [];

    this.logger.info(
      `Starting processing of ${batches.length} batches`
    );

    // Initialize the browser once for all batches
    await this.initialize();

    try {
      for (const batch of batches) {
        const batchResults = await this.processBatchInternal(batch);
        allResults.push(...batchResults);

        // Calculate success/failure counts for this batch
        const successCount = batchResults.reduce(
          (sum, result) => sum + result.results.length,
          0
        );
        const failureCount = batchResults.reduce(
          (sum, result) => sum + result.failedScans.length,
          0
        );

        this.logger.success(
          `Batch ${batch.batchNumber} completed: ${successCount} succeeded, ${failureCount} failed`
        );
      }

      this.logger.success(
        `All batches completed: ${allResults.length} mini-batches processed`
      );

      return allResults;
    } finally {
      // Always close the browser when done
      await this.close();
    }
  }

  /**
   * Internal method to process a batch without initializing/closing browser
   * Used by processAllBatches to share browser instance across batches
   */
  private async processBatchInternal(batch: Batch): Promise<MiniBatchResult[]> {
    const results: MiniBatchResult[] = [];
    const totalMiniBatches = batch.miniBatches.length;

    this.logger.info(
      `Starting batch ${batch.batchNumber} with ${totalMiniBatches} mini-batches (${batch.scans.length} total scans)`
    );

    for (let i = 0; i < batch.miniBatches.length; i++) {
      const miniBatch = batch.miniBatches[i];

      // Call progress callback if provided
      if (this.options.onProgress) {
        const processedUrls = results.reduce(
          (sum, result) => sum + result.results.length,
          0
        );

        this.options.onProgress({
          batchNumber: batch.batchNumber - 1, // Convert to 0-indexed
          miniBatchNumber: i,
          totalMiniBatches,
          processedUrls,
          totalUrls: batch.scans.length,
          currentUrl: miniBatch.scans[0]?.url,
        });
      }

      // Process the mini-batch
      const result = await this.processMiniBatch(miniBatch, batch.batchNumber);
      results.push(result);

      // Mark successful scans as processed in checkpoint
      if (this.checkpointManager && result.results.length > 0) {
        const processedScanIds = result.results.map((r) => r.scanId);
        this.checkpointManager.markProcessed(processedScanIds);
        await this.checkpointManager.flush();
      }

      // Apply delay between mini-batches (except after the last one)
      if (i < batch.miniBatches.length - 1) {
        const delayMs = this.options.delay * 1000;
        this.logger.info(`Waiting ${this.options.delay}s before next mini-batch...`);
        await this.sleep(delayMs);
      }
    }

    return results;
  }
}

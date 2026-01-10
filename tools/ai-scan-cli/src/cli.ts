#!/usr/bin/env node
/**
 * CLI Entry Point for AI Scan CLI
 * Handles argument parsing and orchestrates the scan processing workflow
 */

import { Command } from 'commander';
import { basename, join } from 'path';
import { ExitCode } from './types.js';
import { Logger } from './logger.js';
import { parseInputCsv } from './csv-parser.js';
import { organizeBatches } from './batch-organizer.js';
import { MiniBatchProcessor } from './mini-batch-processor.js';
import { transformToImportFormat } from './result-transformer.js';
import { writeCsv, generateOutputPath, writeFailedScansCsv, type FailedScanRow } from './csv-writer.js';
import { generateSummary, printJsonSummary, type SummaryStats, type ProcessingSummary } from './summary-generator.js';
import { CheckpointManager } from './checkpoint-manager.js';
import {
  checkPrerequisites,
  getInstallationInstructions,
  arePrerequisitesMet,
} from './prerequisites.js';
import { LockManager } from './lock-manager.js';
import {
  ensureSubdirectories,
  scanDirectory,
  moveToProcessed,
  moveToFailed,
} from './directory-scanner.js';

/**
 * Shutdown context for graceful shutdown handling
 * Tracks resources that need cleanup during shutdown
 */
interface ShutdownContext {
  checkpointManager: CheckpointManager | null;
  lockManager: LockManager | null;
  logger: Logger | null;
  isShuttingDown: boolean;
}

/**
 * Module-level shutdown context
 * Used by signal handlers to perform graceful shutdown
 */
const shutdownContext: ShutdownContext = {
  checkpointManager: null,
  lockManager: null,
  logger: null,
  isShuttingDown: false,
};

/**
 * CLI Options interface
 * Defines all command-line options available to the user
 */
export interface CliOptions {
  // Core options (Task 29a)
  input?: string;
  output: string;
  batchSize: number;
  miniBatchSize: number;
  delay: number;
  startBatch: number;

  // Directory mode options (Task 29b)
  inputDir?: string;
  maxFiles?: number;
  log?: string;

  // Checkpoint options (Task 29b)
  resume?: boolean;
  clearCheckpoint?: boolean;

  // Feature flags (Task 29b)
  promptTemplate?: string;
  dryRun?: boolean;
  checkPrerequisites?: boolean;
  verbose?: boolean;
  quiet?: boolean;
  jsonSummary?: boolean;
}

/**
 * Set up Commander.js program with core CLI options
 */
function setupCli(): Command {
  const program = new Command();

  program
    .name('ai-scan-cli')
    .version('1.0.0')
    .description('Local AI Scan CLI for ADAShield - Process accessibility scans using Claude Code');

  // Core options for single-file mode
  program
    .option('-i, --input <file>', 'Single CSV file to process')
    .option('-o, --output <path>', 'Output file or directory', './')
    .option('-b, --batch-size <n>', 'URLs per batch', parseIntOption, 100)
    .option(
      '-m, --mini-batch-size <n>',
      'URLs per Claude invocation (range: 1-10)',
      parseMiniBatchSize,
      5
    )
    .option('--delay <seconds>', 'Delay between mini-batches in seconds', parseIntOption, 5)
    .option('--start-batch <n>', 'Skip batches before this number', parseIntOption, 1);

  // Directory mode options
  program
    .option('-d, --input-dir <dir>', 'Directory to scan for CSV files')
    .option('--max-files <n>', 'Max CSV files to process per invocation', parseIntOption)
    .option('-l, --log <path>', 'Log file or directory');

  // Checkpoint options
  program
    .option('-r, --resume', 'Resume from checkpoint', false)
    .option('--clear-checkpoint', 'Clear checkpoint and start fresh', false);

  // Feature flags
  program
    .option('--prompt-template <file>', 'Custom prompt template path')
    .option('--dry-run', 'Validate without processing', false)
    .option('--check-prerequisites', 'Only validate environment', false)
    .option('-v, --verbose', 'Show detailed output including prompts', false)
    .option('-q, --quiet', 'Minimal output for cron', false)
    .option('-j, --json-summary', 'Output JSON summary at end', false);

  return program;
}

/**
 * Parse integer option with validation
 */
function parseIntOption(value: string): number {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Invalid number: ${value}`);
  }
  return parsed;
}

/**
 * Parse and validate mini-batch size (must be 1-10)
 */
function parseMiniBatchSize(value: string): number {
  const parsed = parseIntOption(value);
  if (parsed < 1 || parsed > 10) {
    throw new Error(`Mini-batch size must be between 1 and 10, got: ${parsed}`);
  }
  return parsed;
}

/**
 * Setup graceful shutdown handlers for SIGINT and SIGTERM
 * Ensures checkpoints are saved and locks are released on interruption
 */
function setupGracefulShutdown(): void {
  const shutdown = async (signal: string): Promise<void> => {
    // Prevent double-shutdown
    if (shutdownContext.isShuttingDown) {
      return;
    }
    shutdownContext.isShuttingDown = true;

    const logger = shutdownContext.logger;
    if (logger) {
      logger.info(`\nReceived ${signal}, shutting down gracefully...`);
    } else {
      console.log(`\nReceived ${signal}, shutting down gracefully...`);
    }

    try {
      // Flush checkpoint if checkpointManager exists
      if (shutdownContext.checkpointManager) {
        await shutdownContext.checkpointManager.flush();
        if (logger) {
          logger.success('Checkpoint saved successfully');
        } else {
          console.log('Checkpoint saved successfully');
        }
      }

      // Release lock if lockManager exists
      if (shutdownContext.lockManager) {
        await shutdownContext.lockManager.releaseLock();
        if (logger) {
          logger.info('Lock released');
        } else {
          console.log('Lock released');
        }
      }

      if (logger) {
        logger.info('Shutdown complete');
      } else {
        console.log('Shutdown complete');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (logger) {
        logger.error(`Error during shutdown: ${errorMsg}`);
      } else {
        console.error(`Error during shutdown: ${errorMsg}`);
      }
    }

    process.exit(ExitCode.SUCCESS);
  };

  // Register signal handlers
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

/**
 * Determine exit code based on processing summary status
 * @param summary Processing summary containing status and results
 * @returns Appropriate exit code
 */
function determineExitCode(summary: ProcessingSummary): number {
  if (summary.status === 'completed') {
    return ExitCode.SUCCESS;
  }
  if (summary.status === 'partial_failure') {
    return ExitCode.PARTIAL_FAILURE;
  }
  return ExitCode.COMPLETE_FAILURE;
}

/**
 * Main CLI entry point
 * Orchestrates the scan processing workflow based on CLI options
 */
async function main(): Promise<void> {
  // Setup graceful shutdown handlers early
  setupGracefulShutdown();

  const program = setupCli();

  // Parse command-line arguments
  program.parse(process.argv);

  // Get parsed options
  const options = program.opts<CliOptions>();

  // Handle --check-prerequisites first (doesn't require input)
  if (options.checkPrerequisites) {
    try {
      const result = await checkPrerequisites();

      // Display results
      console.log('\n=== Prerequisite Check ===\n');
      console.log(`Claude CLI: ${result.claudeInstalled ? '✓' : '✗'}`);
      if (result.claudeVersion) {
        console.log(`  Version: ${result.claudeVersion}`);
      }
      console.log(`\nPlaywright MCP: ${result.playwrightMcpConfigured ? '✓' : '✗'}`);
      if (result.mcpServers.length > 0) {
        console.log(`  Available MCP servers: ${result.mcpServers.join(', ')}`);
      }

      // Display errors and installation instructions if prerequisites not met
      if (!arePrerequisitesMet(result)) {
        console.log('\n=== Missing Prerequisites ===\n');
        if (result.errors.length > 0) {
          result.errors.forEach((error) => console.log(`  - ${error}`));
        }

        const instructions = getInstallationInstructions(result);
        if (instructions.length > 0) {
          console.log('\n=== Installation Instructions ===\n');
          instructions.forEach((instruction) => console.log(`  ${instruction}`));
        }

        process.exit(ExitCode.PREREQUISITES_MISSING);
      }

      // Prerequisites met
      console.log('\n✓ All prerequisites are met\n');
      process.exit(ExitCode.SUCCESS);
    } catch (error) {
      console.error('Error checking prerequisites:', error);
      process.exit(ExitCode.COMPLETE_FAILURE);
    }
  }

  // Validate core options
  if (!options.input && !options.inputDir) {
    console.error('Error: Either --input or --input-dir must be specified');
    program.help(); // Display help if no input specified
    process.exit(1);
  }

  // Validate mutually exclusive options
  if (options.input && options.inputDir) {
    console.error('Error: --input and --input-dir are mutually exclusive');
    process.exit(1);
  }

  // Validate mutually exclusive output modes
  if (options.verbose && options.quiet) {
    console.error('Error: --verbose and --quiet are mutually exclusive');
    process.exit(1);
  }

  // Validate checkpoint options
  if (options.resume && options.clearCheckpoint) {
    console.error('Error: --resume and --clear-checkpoint are mutually exclusive');
    process.exit(1);
  }

  try {
    // Handle single-file mode (--input)
    if (options.input) {
      await processSingleFile(options);
    }

    // Handle directory mode (--input-dir)
    if (options.inputDir) {
      await processDirectory(options);
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(ExitCode.COMPLETE_FAILURE);
  }
}

/**
 * Process a single CSV file in single-file mode
 */
async function processSingleFile(options: CliOptions): Promise<void> {
  const startTime = new Date();

  // 1. Create Logger instance with quiet/verbose options
  const logger = new Logger({
    quiet: options.quiet,
    verbose: options.verbose,
    logFilePath: options.log,
  });

  // Register logger in shutdown context
  shutdownContext.logger = logger;

  logger.info('AI Scan CLI - Single File Mode');
  logger.info(`Input file: ${options.input}`);

  try {
    // 2. Parse input CSV with csvParser.parseInputCsv()
    logger.info('Parsing input CSV...');
    const parseResult = await parseInputCsv(options.input!);

    // 3. Log parse results (total scans, skipped rows)
    logger.success(
      `Parsed ${parseResult.scans.length} scans (${parseResult.skipped.length} skipped, ${parseResult.totalRows} total rows)`
    );

    if (parseResult.skipped.length > 0 && options.verbose) {
      logger.warning('Skipped rows:');
      parseResult.skipped.forEach((skip) => {
        logger.warning(`  Row ${skip.row}: ${skip.reason}`);
      });
    }

    // Handle case where no valid scans were found
    if (parseResult.scans.length === 0) {
      logger.error('No valid scans found in input file');
      process.exit(ExitCode.COMPLETE_FAILURE);
    }

    // 4. Organize into batches with organizeBatches()
    const batches = organizeBatches(
      parseResult.scans,
      options.batchSize,
      options.miniBatchSize
    );

    const totalMiniBatches = batches.reduce((sum, batch) => sum + batch.miniBatches.length, 0);
    logger.info(
      `Organized into ${batches.length} batches with ${totalMiniBatches} mini-batches total`
    );

    // Handle --dry-run flag
    if (options.dryRun) {
      logger.info('\n=== Dry Run - Batch Plan ===');
      logger.info(`Total batches: ${batches.length}`);
      logger.info(`Total mini-batches: ${totalMiniBatches}`);
      logger.info(`Total URLs: ${parseResult.scans.length}`);
      logger.info(`Batch size: ${options.batchSize}`);
      logger.info(`Mini-batch size: ${options.miniBatchSize}`);

      batches.forEach((batch) => {
        logger.info(
          `  Batch ${batch.batchNumber}: ${batch.scans.length} scans, ${batch.miniBatches.length} mini-batches`
        );
      });

      process.exit(ExitCode.SUCCESS);
    }

    // 5. Handle --resume: Load checkpoint, skip already processed scan IDs
    let checkpointManager: CheckpointManager | undefined;
    let scansToProcess = parseResult.scans;

    if (options.resume || options.clearCheckpoint) {
      checkpointManager = new CheckpointManager();
      // Register checkpoint manager in shutdown context
      shutdownContext.checkpointManager = checkpointManager;

      if (options.clearCheckpoint) {
        await checkpointManager.clearCheckpoint();
        logger.info('Checkpoint cleared, starting fresh');
      } else if (options.resume) {
        const checkpoint = await checkpointManager.loadCheckpoint();
        if (checkpoint) {
          logger.info(
            `Resuming from checkpoint: ${checkpoint.processedScanIds.length} scans already processed`
          );

          // Filter out already processed scans
          scansToProcess = parseResult.scans.filter(
            (scan) => !checkpoint.processedScanIds.includes(scan.scanId)
          );

          logger.info(`${scansToProcess.length} scans remaining to process`);

          if (scansToProcess.length === 0) {
            logger.success('All scans already processed');
            process.exit(ExitCode.SUCCESS);
          }
        } else {
          logger.info('No checkpoint found, starting from beginning');
        }
      }
    }

    // 6. Create component instances
    // Note: MiniBatchProcessor handles creating PromptGenerator, ClaudeInvoker, and ResultParser internally

    // 7. Create MiniBatchProcessor with all dependencies
    const processor = new MiniBatchProcessor(
      logger,
      {
        delay: options.delay,
        timeout: 180000, // 3 minutes
        retries: 3,
        verbose: options.verbose,
      },
      checkpointManager
    );

    // Re-organize batches with filtered scans if using resume
    const batchesToProcess =
      scansToProcess !== parseResult.scans
        ? organizeBatches(scansToProcess, options.batchSize, options.miniBatchSize)
        : batches;

    // Apply --start-batch filter
    const filteredBatches =
      options.startBatch > 1
        ? batchesToProcess.filter((batch) => batch.batchNumber >= options.startBatch)
        : batchesToProcess;

    if (filteredBatches.length === 0) {
      logger.warning('No batches to process after applying filters');
      process.exit(ExitCode.SUCCESS);
    }

    logger.info(`Processing ${filteredBatches.length} batches...`);

    // 8. Process batches with processAllBatches()
    const miniBatchResults = await processor.processAllBatches(filteredBatches);

    // Collect all results and failed scans
    const allResults = miniBatchResults.flatMap((mbResult) => mbResult.results);
    const allFailedScans = miniBatchResults.flatMap((mbResult) => mbResult.failedScans);

    logger.success(
      `Processing complete: ${allResults.length} successful, ${allFailedScans.length} failed`
    );

    // 9. Transform results with transformToImportFormat()
    const importRows = transformToImportFormat(allResults);

    // 10. Write results with writeCsv()
    const inputBasename = basename(options.input!, '.csv');
    const outputPath = await generateOutputPath(options.output, inputBasename);

    await writeCsv(outputPath, importRows);
    logger.success(`Results written to: ${outputPath}`);

    // Write failed scans CSV if there are any failures
    let failedCsvPath = '';
    if (allFailedScans.length > 0) {
      const failedRows: FailedScanRow[] = allFailedScans.map((failed) => ({
        scan_id: failed.scanId,
        url: failed.url,
        error_type: failed.errorType,
        error_message: failed.errorMessage,
      }));

      const outputDir = options.output || '.';
      failedCsvPath = await writeFailedScansCsv(outputDir, failedRows);
      logger.warning(`Failed scans written to: ${failedCsvPath}`);
    }

    // Clear checkpoint if processing completed
    if (checkpointManager) {
      await checkpointManager.clearCheckpoint();
    }

    // 11. Generate summary with generateSummary()
    const endTime = new Date();
    const summaryStats: SummaryStats = {
      startTime,
      endTime,
      filesProcessed: 1,
      totalUrls: parseResult.scans.length,
      successful: allResults.length,
      failed: allFailedScans.length,
      skipped: parseResult.skipped.length,
      outputFiles: [outputPath],
      failedFiles: failedCsvPath ? [failedCsvPath] : [],
      errors: [],
    };

    const summary = generateSummary(summaryStats);

    // 12. Display or print summary based on --json-summary flag
    if (options.jsonSummary) {
      printJsonSummary(summary);
    } else {
      logger.info('\n=== Processing Summary ===');
      logger.info(`Status: ${summary.status}`);
      logger.info(`Files processed: ${summary.files_processed}`);
      logger.info(`Total URLs: ${summary.total_urls}`);
      logger.info(`Successful: ${summary.successful}`);
      logger.info(`Failed: ${summary.failed}`);
      logger.info(`Skipped: ${summary.skipped}`);
      logger.info(`Duration: ${summary.duration_seconds}s`);
      logger.info(`Output files: ${summary.output_files.join(', ')}`);
      if (summary.failed_files.length > 0) {
        logger.info(`Failed files: ${summary.failed_files.join(', ')}`);
      }
    }

    // Determine exit code based on summary status
    const exitCode = determineExitCode(summary);
    process.exit(exitCode);
  } catch (error) {
    logger.error(`Processing failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Process multiple CSV files in directory mode
 * Designed for cron automation with lock management
 */
async function processDirectory(options: CliOptions): Promise<void> {
  const startTime = new Date();

  // 1. Create Logger instance (default to quiet mode in directory mode)
  const logger = new Logger({
    quiet: options.quiet ?? true, // Default to quiet in directory mode
    verbose: options.verbose ?? false,
    logFilePath: options.log,
  });

  // Register logger in shutdown context
  shutdownContext.logger = logger;

  logger.info('AI Scan CLI - Directory Mode');
  logger.info(`Input directory: ${options.inputDir}`);

  try {
    // 2. Ensure subdirectories exist
    await ensureSubdirectories(options.inputDir!);
    logger.info('Subdirectories verified (processed/, failed/)');

    // 3. Acquire lock using LockManager
    const lockManager = new LockManager(join(options.inputDir!, '.ai-scan.lock'));
    const lockAcquired = await lockManager.acquireLock();

    if (!lockAcquired) {
      const lockInfo = await lockManager.readLockInfo();
      logger.warning(
        `Another instance is already running (PID ${lockInfo?.pid} on ${lockInfo?.hostname})`
      );
      process.exit(ExitCode.LOCK_EXISTS);
    }

    // Register lock manager in shutdown context
    shutdownContext.lockManager = lockManager;

    logger.info(`Lock acquired (PID ${process.pid})`);

    try {
      // 4. Scan directory for CSV files
      const scanResult = await scanDirectory(options.inputDir!, options.maxFiles, logger);

      // 5. If no files found, log message and exit with SUCCESS
      if (scanResult.files.length === 0) {
        logger.info('No CSV files to process');
        process.exit(ExitCode.SUCCESS);
      }

      logger.info(`Processing ${scanResult.files.length} of ${scanResult.totalFound} total files`);

      // Track aggregate statistics across all files
      const aggregateStats = {
        filesProcessed: 0,
        filesSucceeded: 0,
        filesFailed: 0,
        totalUrls: 0,
        totalSuccessful: 0,
        totalFailed: 0,
        totalSkipped: 0,
        outputFiles: [] as string[],
        failedFiles: [] as string[],
        errors: [] as string[],
      };

      // 6. Process each file sequentially
      for (const filePath of scanResult.files) {
        const fileBasename = basename(filePath);
        logger.info(`\n=== Processing file: ${fileBasename} ===`);

        try {
          // Track per-file results
          let fileSuccessful = false;
          let fileUrls = 0;
          let fileSuccessCount = 0;
          let fileFailCount = 0;
          let fileSkipCount = 0;

          try {
            // Parse input CSV
            logger.info(`Parsing ${fileBasename}...`);
            const parseResult = await parseInputCsv(filePath);

            fileUrls = parseResult.scans.length;
            fileSkipCount = parseResult.skipped.length;

            if (parseResult.scans.length === 0) {
              logger.warning(`No valid scans found in ${fileBasename}`);
              aggregateStats.errors.push(`${fileBasename}: No valid scans found`);
              // Move to failed directory
              await moveToFailed(filePath, options.inputDir!);
              aggregateStats.filesFailed++;
              continue;
            }

            logger.success(
              `Parsed ${parseResult.scans.length} scans (${parseResult.skipped.length} skipped)`
            );

            // Organize into batches
            const batches = organizeBatches(
              parseResult.scans,
              options.batchSize,
              options.miniBatchSize
            );

            const totalMiniBatches = batches.reduce(
              (sum, batch) => sum + batch.miniBatches.length,
              0
            );
            logger.info(
              `Organized into ${batches.length} batches with ${totalMiniBatches} mini-batches`
            );

            // Create MiniBatchProcessor
            const processor = new MiniBatchProcessor(
              logger,
              {
                delay: options.delay,
                timeout: 180000, // 3 minutes
                retries: 3,
                verbose: options.verbose ?? false,
              },
              undefined // No checkpoint in directory mode
            );

            // Process all batches
            const miniBatchResults = await processor.processAllBatches(batches);

            // Collect results
            const allResults = miniBatchResults.flatMap((mbResult) => mbResult.results);
            const allFailedScans = miniBatchResults.flatMap((mbResult) => mbResult.failedScans);

            fileSuccessCount = allResults.length;
            fileFailCount = allFailedScans.length;

            logger.success(
              `Processing complete: ${fileSuccessCount} successful, ${fileFailCount} failed`
            );

            // Transform and write results
            const importRows = transformToImportFormat(allResults);
            const inputBasename = basename(filePath, '.csv');
            const outputPath = await generateOutputPath(options.output, inputBasename);

            await writeCsv(outputPath, importRows);
            logger.success(`Results written to: ${outputPath}`);
            aggregateStats.outputFiles.push(outputPath);

            // Write failed scans CSV if there are any failures
            if (allFailedScans.length > 0) {
              const failedRows: FailedScanRow[] = allFailedScans.map((failed) => ({
                scan_id: failed.scanId,
                url: failed.url,
                error_type: failed.errorType,
                error_message: failed.errorMessage,
              }));

              const outputDir = options.output || '.';
              const failedCsvPath = await writeFailedScansCsv(outputDir, failedRows);
              logger.warning(`Failed scans written to: ${failedCsvPath}`);
              aggregateStats.failedFiles.push(failedCsvPath);
            }

            // Determine if file processing was successful
            // Success = at least some scans succeeded
            fileSuccessful = allResults.length > 0;

            // Update aggregate statistics
            aggregateStats.totalUrls += fileUrls;
            aggregateStats.totalSuccessful += fileSuccessCount;
            aggregateStats.totalFailed += fileFailCount;
            aggregateStats.totalSkipped += fileSkipCount;
          } catch (error) {
            logger.error(
              `Failed to process ${fileBasename}: ${error instanceof Error ? error.message : String(error)}`
            );
            aggregateStats.errors.push(
              `${fileBasename}: ${error instanceof Error ? error.message : String(error)}`
            );
            fileSuccessful = false;
          }

          // 7. Move file to appropriate subdirectory
          if (fileSuccessful) {
            // At least some scans succeeded
            await moveToProcessed(filePath, options.inputDir!);
            logger.success(`Moved ${fileBasename} to processed/`);
            aggregateStats.filesSucceeded++;
          } else {
            // Complete failure - no scans succeeded
            await moveToFailed(filePath, options.inputDir!);
            logger.warning(`Moved ${fileBasename} to failed/`);
            aggregateStats.filesFailed++;
          }

          aggregateStats.filesProcessed++;
        } catch (error) {
          // Catch-all for any unexpected errors during file handling
          logger.error(
            `Unexpected error processing ${fileBasename}: ${error instanceof Error ? error.message : String(error)}`
          );
          aggregateStats.errors.push(
            `${fileBasename}: ${error instanceof Error ? error.message : String(error)}`
          );

          // Try to move to failed directory
          try {
            await moveToFailed(filePath, options.inputDir!);
            logger.warning(`Moved ${fileBasename} to failed/`);
          } catch (moveError) {
            logger.error(
              `Failed to move ${fileBasename} to failed/: ${moveError instanceof Error ? moveError.message : String(moveError)}`
            );
          }

          aggregateStats.filesFailed++;
          aggregateStats.filesProcessed++;
        }
      }

      // 8. Generate aggregate summary
      const endTime = new Date();
      const summaryStats: SummaryStats = {
        startTime,
        endTime,
        filesProcessed: aggregateStats.filesProcessed,
        totalUrls: aggregateStats.totalUrls,
        successful: aggregateStats.totalSuccessful,
        failed: aggregateStats.totalFailed,
        skipped: aggregateStats.totalSkipped,
        outputFiles: aggregateStats.outputFiles,
        failedFiles: aggregateStats.failedFiles,
        errors: aggregateStats.errors,
      };

      const summary = generateSummary(summaryStats);

      // 9. Display JSON summary if --json-summary is enabled
      if (options.jsonSummary) {
        printJsonSummary(summary);
      } else {
        logger.info('\n=== Processing Summary ===');
        logger.info(`Status: ${summary.status}`);
        logger.info(`Files processed: ${summary.files_processed}`);
        logger.info(`Files succeeded: ${aggregateStats.filesSucceeded}`);
        logger.info(`Files failed: ${aggregateStats.filesFailed}`);
        logger.info(`Total URLs: ${summary.total_urls}`);
        logger.info(`Successful: ${summary.successful}`);
        logger.info(`Failed: ${summary.failed}`);
        logger.info(`Skipped: ${summary.skipped}`);
        logger.info(`Duration: ${summary.duration_seconds}s`);
        if (summary.output_files.length > 0) {
          logger.info(`Output files: ${summary.output_files.length}`);
        }
        if (summary.failed_files.length > 0) {
          logger.info(`Failed files: ${summary.failed_files.length}`);
        }
        if (summary.errors.length > 0) {
          logger.warning(`Errors: ${summary.errors.length}`);
          summary.errors.forEach((error) => logger.warning(`  - ${error}`));
        }
      }

      // Determine exit code based on summary status
      const exitCode = determineExitCode(summary);
      process.exit(exitCode);
    } finally {
      // 7. Release lock on completion and unregister from shutdown context
      await lockManager.releaseLock();
      shutdownContext.lockManager = null;
      logger.info('Lock released');
    }
  } catch (error) {
    logger.error(`Processing failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// Execute main function if this is the entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { setupCli, main };

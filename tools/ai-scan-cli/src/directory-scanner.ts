import { readdir, mkdir, rename } from 'fs/promises';
import { join, resolve, basename } from 'path';
import type { Logger } from './logger.js';

/**
 * Result of scanning a directory for CSV files
 */
export interface ScannerResult {
  /** Array of full absolute file paths for CSV files */
  files: string[];
  /** Total number of CSV files found before maxFiles limit was applied */
  totalFound: number;
}

/**
 * Ensures that processed/ and failed/ subdirectories exist in the target directory
 *
 * Creates the subdirectories if they don't already exist using recursive creation.
 * This is idempotent - calling multiple times is safe.
 *
 * @param dirPath - Path to the parent directory (relative or absolute)
 * @returns Promise<void>
 *
 * @throws Error if directories cannot be created
 *
 * @example
 * await ensureSubdirectories('./scans');
 * // Creates ./scans/processed/ and ./scans/failed/ if they don't exist
 */
export async function ensureSubdirectories(dirPath: string): Promise<void> {
  const absoluteDirPath = resolve(dirPath);

  // Create processed/ subdirectory
  await mkdir(join(absoluteDirPath, 'processed'), { recursive: true });

  // Create failed/ subdirectory
  await mkdir(join(absoluteDirPath, 'failed'), { recursive: true });
}

/**
 * Moves a file to the processed/ subdirectory
 *
 * Uses fs.rename for atomic file movement operation.
 * The original filename is preserved in the destination.
 *
 * @param filePath - Full path to the file to move
 * @param dirPath - Path to the parent directory containing processed/ subdirectory
 * @returns Promise<string> - New file path after moving
 *
 * @throws Error if file cannot be moved
 *
 * @example
 * const newPath = await moveToProcessed('/path/to/scans/file.csv', '/path/to/scans');
 * // Returns: '/path/to/scans/processed/file.csv'
 */
export async function moveToProcessed(
  filePath: string,
  dirPath: string
): Promise<string> {
  const absoluteDirPath = resolve(dirPath);
  const filename = basename(filePath);
  const newPath = join(absoluteDirPath, 'processed', filename);

  await rename(filePath, newPath);

  return newPath;
}

/**
 * Moves a file to the failed/ subdirectory
 *
 * Uses fs.rename for atomic file movement operation.
 * The original filename is preserved in the destination.
 *
 * @param filePath - Full path to the file to move
 * @param dirPath - Path to the parent directory containing failed/ subdirectory
 * @returns Promise<string> - New file path after moving
 *
 * @throws Error if file cannot be moved
 *
 * @example
 * const newPath = await moveToFailed('/path/to/scans/file.csv', '/path/to/scans');
 * // Returns: '/path/to/scans/failed/file.csv'
 */
export async function moveToFailed(
  filePath: string,
  dirPath: string
): Promise<string> {
  const absoluteDirPath = resolve(dirPath);
  const filename = basename(filePath);
  const newPath = join(absoluteDirPath, 'failed', filename);

  await rename(filePath, newPath);

  return newPath;
}

/**
 * Scans a directory for CSV files to process
 *
 * Finds all CSV files (case-insensitive) in the specified directory.
 * Automatically excludes files in processed/ and failed/ subdirectories.
 * Files are sorted alphabetically by filename, which aligns with the
 * oldest-first convention (assuming filenames follow a date-based naming pattern).
 *
 * If no CSV files are found (after filtering), returns { files: [], totalFound: 0 }.
 * This is not an error condition - just means no work to do.
 *
 * @param dirPath - Path to the directory to scan (relative or absolute)
 * @param maxFiles - Optional maximum number of files to return (default: all files)
 * @param logger - Optional Logger instance for logging scan results
 * @returns Promise<ScannerResult> with files array and totalFound count
 *
 * @throws Error if directory cannot be read or doesn't exist
 *
 * @example
 * // Scan directory for all CSV files
 * const result = await scanDirectory('./scans');
 * console.log(`Found ${result.totalFound} CSV files, returning ${result.files.length}`);
 *
 * @example
 * // Scan directory with limit
 * const result = await scanDirectory('./scans', 10);
 * console.log(`Processing first ${result.files.length} of ${result.totalFound} files`);
 *
 * @example
 * // Scan directory with logging
 * const logger = new Logger({ verbose: true });
 * const result = await scanDirectory('./scans', undefined, logger);
 */
export async function scanDirectory(
  dirPath: string,
  maxFiles?: number,
  logger?: Logger
): Promise<ScannerResult> {
  // Resolve to absolute path
  const absoluteDirPath = resolve(dirPath);

  // Read directory contents
  const entries = await readdir(absoluteDirPath, { withFileTypes: true });

  // Filter for CSV files (case-insensitive)
  // Exclude directories, non-CSV files, and files in processed/failed subdirectories
  const csvFiles = entries
    .filter((entry) => {
      // Must be a file (not a directory)
      if (!entry.isFile()) {
        return false;
      }

      // Exclude files in processed/ and failed/ subdirectories
      // (These would appear if we recursively scanned, but we only scan the top level)
      // This check is defensive in case the directory structure changes
      const lowerName = entry.name.toLowerCase();
      if (lowerName === 'processed' || lowerName === 'failed') {
        return false;
      }

      // Must have .csv extension (case-insensitive)
      return lowerName.endsWith('.csv');
    })
    .map((entry) => entry.name);

  // Sort alphabetically (oldest first by filename convention)
  csvFiles.sort((a, b) => a.localeCompare(b));

  // Get total count before applying limit
  const totalFound = csvFiles.length;

  // Handle empty directory case
  if (totalFound === 0) {
    if (logger) {
      logger.info(`No pending files found in ${dirPath}`);
    }
    return {
      files: [],
      totalFound: 0,
    };
  }

  // Log found files
  if (logger) {
    logger.info(`Found ${totalFound} CSV files to process`);
  }

  // Apply maxFiles limit if provided
  const limitedFiles = maxFiles !== undefined ? csvFiles.slice(0, maxFiles) : csvFiles;

  // Convert to full absolute paths
  const files = limitedFiles.map((filename) => join(absoluteDirPath, filename));

  return {
    files,
    totalFound,
  };
}

/**
 * Quick check if there are any CSV files to process in a directory
 *
 * This is a lightweight utility function useful for early exit in cron jobs
 * or scripts that need to determine if there's work to do without fully scanning.
 * Returns true if at least one CSV file exists (excluding processed/failed subdirectories).
 *
 * @param dirPath - Path to the directory to check (relative or absolute)
 * @returns Promise<boolean> - true if at least one CSV file exists, false otherwise
 *
 * @throws Error if directory cannot be read or doesn't exist
 *
 * @example
 * // Early exit in cron job
 * if (!(await hasFilesToProcess('./scans'))) {
 *   console.log('No files to process, exiting');
 *   process.exit(0);
 * }
 *
 * @example
 * // Conditional processing
 * const hasWork = await hasFilesToProcess('./scans');
 * if (hasWork) {
 *   await processFiles();
 * }
 */
export async function hasFilesToProcess(dirPath: string): Promise<boolean> {
  // Resolve to absolute path
  const absoluteDirPath = resolve(dirPath);

  // Read directory contents
  const entries = await readdir(absoluteDirPath, { withFileTypes: true });

  // Check if at least one CSV file exists (excluding processed/failed)
  return entries.some((entry) => {
    // Must be a file (not a directory)
    if (!entry.isFile()) {
      return false;
    }

    // Exclude files in processed/ and failed/ subdirectories
    const lowerName = entry.name.toLowerCase();
    if (lowerName === 'processed' || lowerName === 'failed') {
      return false;
    }

    // Must have .csv extension (case-insensitive)
    return lowerName.endsWith('.csv');
  });
}

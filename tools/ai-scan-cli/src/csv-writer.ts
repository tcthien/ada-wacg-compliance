import { stringify } from 'csv-stringify';
import { writeFile, access, chmod, stat } from 'fs/promises';
import { constants } from 'fs';
import { resolve, extname, join } from 'path';
import { ImportRow } from './types.js';

/**
 * Failed scan row format for tracking retry-able failures
 */
export interface FailedScanRow {
  scan_id: string;
  url: string;
  error_type: string;
  error_message: string;
}

/**
 * Options for CSV writing operations
 */
export interface WriteCsvOptions {
  /**
   * Append to existing file instead of overwriting
   * @default false
   */
  append?: boolean;

  /**
   * Include header row in the output
   * @default true (but automatically set to false when appending to existing file)
   */
  includeHeader?: boolean;
}

/**
 * Column headers for the CSV output file
 * Must match the API schema at /api/v1/admin/ai-queue/import
 */
const CSV_HEADERS = [
  'scan_id',
  'ai_summary',
  'ai_remediation_plan',
  'ai_issues_json',
  'tokens_used',
  'ai_model',
  'processing_time',
];

/**
 * Column headers for the failed scans CSV file
 */
const FAILED_SCANS_HEADERS = [
  'scan_id',
  'url',
  'error_type',
  'error_message',
];

/**
 * Checks if a file exists
 *
 * @param filePath - Path to the file to check
 * @returns True if file exists, false otherwise
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if a path exists and is a directory
 *
 * @param path - Path to check
 * @returns True if path exists and is a directory, false otherwise
 */
export async function isDirectory(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    return stats.isDirectory();
  } catch {
    // Path doesn't exist or is inaccessible
    return false;
  }
}

/**
 * Generates a default output path for CSV results
 *
 * @returns Default output path: ./ai-scan-results-{timestamp}.csv
 *
 * @example
 * // Returns: ./ai-scan-results-20260103-143022.csv
 * const path = generateDefaultOutputPath();
 */
export function generateDefaultOutputPath(): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '-')
    .slice(0, 15); // YYYYMMDD-HHmmss

  return `./ai-scan-results-${timestamp}.csv`;
}

/**
 * Generates an appropriate output path based on the provided option
 *
 * @param outputOption - User-provided output option (file path or directory)
 * @param inputFilename - Optional input filename (without extension) to use in generated name
 * @returns Resolved absolute output path
 *
 * @example
 * // If outputOption ends with .csv, return as-is
 * generateOutputPath('/path/to/output.csv') // -> /path/to/output.csv
 *
 * @example
 * // If outputOption is a directory, generate filename
 * generateOutputPath('/path/to/dir', 'input-file') // -> /path/to/dir/ai-results-input-file-20260103-143022.csv
 *
 * @example
 * // If no inputFilename provided, use "batch" as default
 * generateOutputPath('./results') // -> ./results/ai-results-batch-20260103-143022.csv
 */
export async function generateOutputPath(
  outputOption: string,
  inputFilename?: string
): Promise<string> {
  // If outputOption ends with .csv, treat it as a file path
  if (extname(outputOption).toLowerCase() === '.csv') {
    return resolve(outputOption);
  }

  // Check if outputOption is a directory
  const isDir = await isDirectory(outputOption);

  if (isDir) {
    // Generate filename with timestamp
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace('T', '-')
      .slice(0, 15); // YYYYMMDD-HHmmss

    const baseName = inputFilename || 'batch';
    const filename = `ai-results-${baseName}-${timestamp}.csv`;

    return resolve(join(outputOption, filename));
  }

  // If path doesn't exist or is not a directory, treat it as a file path
  // (user may want to create a new file at this location)
  return resolve(outputOption);
}

/**
 * Writes scan results to a CSV file for database import
 *
 * The CSV format follows the ImportRow interface and can be imported directly
 * into the database using the backend's import endpoint.
 *
 * @param filePath - Absolute path to the output CSV file
 * @param rows - Array of ImportRow objects to write
 * @param options - Optional writing configuration
 * @param options.append - If true, append to existing file (default: false)
 * @param options.includeHeader - If true, include header row (default: true, auto-disabled when appending)
 *
 * @throws Error if file operations fail or CSV generation fails
 *
 * @example
 * // Create new CSV file
 * await writeCsv('/path/to/output.csv', [row1, row2]);
 *
 * @example
 * // Append to existing CSV file (streaming mode)
 * await writeCsv('/path/to/output.csv', [row3], { append: true });
 */
export async function writeCsv(
  filePath: string,
  rows: ImportRow[],
  options: WriteCsvOptions = {}
): Promise<void> {
  const { append = false, includeHeader = true } = options;

  // Check if file exists when appending
  const exists = append ? await fileExists(filePath) : false;

  // Determine if we should include headers
  // - Don't include headers if appending to an existing file
  // - Include headers if creating new file or if explicitly requested
  const shouldIncludeHeader = includeHeader && (!append || !exists);

  // Convert ImportRow objects to arrays matching the header order
  const records = rows.map((row) => [
    row.scan_id,
    row.ai_summary,
    row.ai_remediation_plan,
    row.ai_issues_json, // Already stringified JSON
    row.tokens_used,
    row.ai_model,
    row.processing_time,
  ]);

  return new Promise((resolve, reject) => {
    stringify(
      records,
      {
        header: shouldIncludeHeader,
        columns: shouldIncludeHeader ? CSV_HEADERS : undefined,
        quoted: true, // Quote all fields for safety
        quoted_string: true, // Ensure strings are quoted
        escape: '"', // Use double quote for escaping
        record_delimiter: '\n',
        cast: {
          number: (value) => String(value), // Convert numbers to strings
          boolean: (value) => String(value), // Convert booleans to strings
        },
      },
      async (err, output) => {
        if (err) {
          reject(new Error(`CSV generation error: ${err.message}`));
          return;
        }

        try {
          // Write or append to file
          if (append && exists) {
            // Append to existing file
            const { appendFile } = await import('fs/promises');
            await appendFile(filePath, output, 'utf8');
          } else {
            // Create new file or overwrite
            await writeFile(filePath, output, 'utf8');
          }

          // Set file permissions to 0o644 (rw-r--r--)
          await chmod(filePath, 0o644);

          resolve();
        } catch (error) {
          reject(
            new Error(
              `File write error: ${error instanceof Error ? error.message : String(error)}`
            )
          );
        }
      }
    );
  });
}

/**
 * Generates a file path for failed scans CSV with timestamp
 *
 * @param outputDir - Directory where the failed scans CSV will be created
 * @returns Full path to the failed scans CSV file: {outputDir}/failed-scans-{timestamp}.csv
 *
 * @example
 * // Returns: ./failed-scans-20260103-143022.csv
 * const path = generateFailedScansPath('.');
 *
 * @example
 * // Returns: /path/to/output/failed-scans-20260103-143022.csv
 * const path = generateFailedScansPath('/path/to/output');
 */
export function generateFailedScansPath(outputDir: string): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '-')
    .slice(0, 15); // YYYYMMDD-HHmmss

  return resolve(join(outputDir, `failed-scans-${timestamp}.csv`));
}

/**
 * Writes failed scans to a CSV file for retry tracking
 *
 * The CSV contains minimal information about failed scans to enable retry operations.
 * Skips writing if the failedScans array is empty.
 *
 * @param outputDir - Directory where the CSV file will be created
 * @param failedScans - Array of FailedScanRow objects to write
 * @returns Full path to the created CSV file, or empty string if no scans to write
 *
 * @throws Error if file operations fail or CSV generation fails
 *
 * @example
 * // Create failed scans CSV
 * const failedScans = [
 *   { scan_id: 'scan-123', url: 'https://example.com', error_type: 'TIMEOUT', error_message: 'Request timeout' },
 *   { scan_id: 'scan-456', url: 'https://test.com', error_type: 'RATE_LIMIT', error_message: 'API rate limit exceeded' }
 * ];
 * const csvPath = await writeFailedScansCsv('./output', failedScans);
 * console.log(`Failed scans written to: ${csvPath}`);
 *
 * @example
 * // Skip writing if no failed scans
 * const csvPath = await writeFailedScansCsv('./output', []);
 * console.log(csvPath); // Returns: ""
 */
export async function writeFailedScansCsv(
  outputDir: string,
  failedScans: FailedScanRow[]
): Promise<string> {
  // Skip writing if there are no failed scans
  if (failedScans.length === 0) {
    return '';
  }

  // Generate file path with timestamp
  const filePath = generateFailedScansPath(outputDir);

  // Convert FailedScanRow objects to arrays matching the header order
  const records = failedScans.map((row) => [
    row.scan_id,
    row.url,
    row.error_type,
    row.error_message,
  ]);

  return new Promise((resolve, reject) => {
    stringify(
      records,
      {
        header: true,
        columns: FAILED_SCANS_HEADERS,
        quoted: true, // Quote all fields for safety
        quoted_string: true, // Ensure strings are quoted
        escape: '"', // Use double quote for escaping
        record_delimiter: '\n',
      },
      async (err, output) => {
        if (err) {
          reject(new Error(`Failed scans CSV generation error: ${err.message}`));
          return;
        }

        try {
          // Write CSV file
          await writeFile(filePath, output, 'utf8');

          // Set file permissions to 0o644 (rw-r--r--)
          await chmod(filePath, 0o644);

          resolve(filePath);
        } catch (error) {
          reject(
            new Error(
              `Failed scans file write error: ${error instanceof Error ? error.message : String(error)}`
            )
          );
        }
      }
    );
  });
}

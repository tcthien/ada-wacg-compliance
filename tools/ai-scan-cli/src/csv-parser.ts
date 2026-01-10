import { parse } from 'csv-parse';
import { createReadStream } from 'fs';
import { PendingScan, WcagLevel, ExistingIssue } from './types.js';

/**
 * Result of parsing a CSV file containing pending scans
 */
export interface ParseResult {
  scans: PendingScan[];
  skipped: { row: number; reason: string }[];
  totalRows: number;
}

/**
 * Valid WCAG levels for validation
 */
const VALID_WCAG_LEVELS: WcagLevel[] = ['A', 'AA', 'AAA'];

/**
 * Validates if a string is a valid WCAG level
 */
function isValidWcagLevel(level: string): level is WcagLevel {
  return VALID_WCAG_LEVELS.includes(level as WcagLevel);
}

/**
 * Validates if a URL is non-empty and appears to be valid
 */
function isValidUrl(url: string): boolean {
  if (!url || url.trim() === '') {
    return false;
  }

  // Basic URL validation - must start with http:// or https://
  const trimmedUrl = url.trim();
  return trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://');
}

/**
 * Parses the input CSV file containing pending scans
 *
 * Expected CSV format:
 * - Headers: scan_id, url, email, wcag_level, issues_json, created_at, page_title
 * - Required fields: scan_id, url, wcag_level
 * - Optional fields: email, created_at
 *
 * @param filePath - Absolute path to the CSV file
 * @returns ParseResult with scans array, skipped rows, and totalRows
 *
 * @example
 * const result = await parseInputCsv('/path/to/scans.csv');
 * console.log(`Parsed ${result.scans.length} scans, skipped ${result.skipped.length}`);
 */
export async function parseInputCsv(filePath: string): Promise<ParseResult> {
  const scans: PendingScan[] = [];
  const skipped: { row: number; reason: string }[] = [];
  let totalRows = 0;

  return new Promise((resolve, reject) => {
    const parser = parse({
      columns: true, // Use first row as headers
      skip_empty_lines: true,
      trim: true,
      cast: false, // Keep all values as strings for validation
      relax_quotes: true, // Handle quotes in JSON fields
      relax_column_count: true, // Allow variable column counts
    });

    const stream = createReadStream(filePath);

    parser.on('readable', () => {
      let record;
      while ((record = parser.read()) !== null) {
        totalRows++;
        const rowNumber = totalRows + 1; // +1 for header row

        // Extract and validate fields
        const scanId = record.scan_id?.trim();
        const url = record.url?.trim();
        const wcagLevel = record.wcag_level?.trim();
        const email = record.email?.trim();
        const createdAt = record.created_at?.trim();
        const pageTitle = record.page_title?.trim();
        const issuesJson = record.issues_json?.trim();

        // Validate scan_id
        if (!scanId) {
          skipped.push({
            row: rowNumber,
            reason: 'Missing scan_id',
          });
          continue;
        }

        // Validate URL
        if (!url || !isValidUrl(url)) {
          skipped.push({
            row: rowNumber,
            reason: url ? 'Invalid URL format (must start with http:// or https://)' : 'Empty URL',
          });
          continue;
        }

        // Validate WCAG level
        if (!wcagLevel || !isValidWcagLevel(wcagLevel)) {
          skipped.push({
            row: rowNumber,
            reason: wcagLevel
              ? `Invalid wcag_level '${wcagLevel}' (must be A, AA, or AAA)`
              : 'Missing wcag_level',
          });
          continue;
        }

        // Build PendingScan object
        const scan: PendingScan = {
          scanId,
          url,
          wcagLevel,
        };

        // Add optional fields if present
        if (email) {
          scan.email = email;
        }
        if (createdAt) {
          scan.createdAt = createdAt;
        }
        if (pageTitle) {
          scan.pageTitle = pageTitle;
        }

        // Parse existing issues from JSON if present
        if (issuesJson) {
          try {
            const parsedIssues = JSON.parse(issuesJson);
            if (Array.isArray(parsedIssues)) {
              scan.existingIssues = parsedIssues as ExistingIssue[];
            }
          } catch (parseError) {
            // Log warning but don't skip the scan - issues_json is optional
            console.warn(`Warning: Could not parse issues_json for scan ${scanId}`);
          }
        }

        scans.push(scan);
      }
    });

    parser.on('error', (error) => {
      reject(new Error(`CSV parsing error: ${error.message}`));
    });

    parser.on('end', () => {
      resolve({
        scans,
        skipped,
        totalRows,
      });
    });

    stream.on('error', (error) => {
      reject(new Error(`File read error: ${error.message}`));
    });

    // Pipe the file stream to the parser
    stream.pipe(parser);
  });
}

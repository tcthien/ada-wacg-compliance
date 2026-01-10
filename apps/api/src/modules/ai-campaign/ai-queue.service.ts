/**
 * AI Queue Service
 *
 * Business logic layer for AI scan queue operations.
 * Handles exporting pending AI scans to CSV and managing aiStatus transitions.
 */

import { parse } from 'csv-parse/sync';
import { getPrismaClient } from '../../config/database.js';
import {
  csvImportRowSchema,
  type CsvImportRow,
} from './ai-campaign.schema.js';
import { deductTokens } from './ai-campaign.service.js';
import { sendEmailQueue } from '../../shared/queue/queues.js';
import type { EmailJobData } from '../../shared/queue/types.js';
import type { ImportResult } from './ai-campaign.types.js';

/**
 * AI Queue Service Error
 */
export class AiQueueServiceError extends Error {
  public readonly code: string;
  public readonly cause?: Error | undefined;

  constructor(message: string, code: string, cause?: Error | undefined) {
    super(message);
    this.name = 'AiQueueServiceError';
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Scan data for CSV export
 */
interface ScanExportData {
  scanId: string;
  url: string;
  email: string | null;
  wcagLevel: string;
  issuesJson: string;
  createdAt: string;
  pageTitle: string | null;
}

/**
 * Export result containing CSV data and metadata
 */
export interface ExportPendingScansResult {
  /** CSV string with header and rows */
  csv: string;
  /** Number of scans exported */
  count: number;
  /** Array of scan IDs that were exported */
  scanIds: string[];
}

/**
 * Escape CSV field value
 *
 * Wraps field in quotes and escapes internal quotes by doubling them.
 * Follows RFC 4180 CSV specification.
 *
 * @param value - Field value to escape
 * @returns Escaped and quoted field value
 *
 * @example
 * ```typescript
 * escapeCsvField('Hello "World"')  // Returns: "Hello ""World"""
 * escapeCsvField('Simple text')     // Returns: "Simple text"
 * ```
 */
function escapeCsvField(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return '""';
  }
  // Escape quotes by doubling them, then wrap in quotes
  return `"${String(value).replace(/"/g, '""')}"`;
}

/**
 * Export pending AI scans to CSV
 *
 * Queries scans with aiEnabled=true and aiStatus=PENDING, generates CSV,
 * and atomically updates their status to DOWNLOADED using a transaction.
 *
 * Requirements:
 * - REQ-4 AC 1: Export CSV with scan_id, url, email, wcag_level, issues_json, created_at, page_title
 * - REQ-4 AC 2: Update aiStatus from PENDING to DOWNLOADED atomically
 *
 * @returns Export result with CSV string, count, and scan IDs
 * @throws {AiQueueServiceError} If export fails or no scans available
 *
 * @example
 * ```typescript
 * const result = await exportPendingScans();
 * console.log(`Exported ${result.count} scans`);
 * console.log(`CSV:\n${result.csv}`);
 * console.log(`Scan IDs: ${result.scanIds.join(', ')}`);
 * ```
 */
export async function exportPendingScans(): Promise<ExportPendingScansResult> {
  const prisma = getPrismaClient();

  try {
    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Step 1: Query pending AI scans with their issues
      const scans = await tx.scan.findMany({
        where: {
          aiEnabled: true,
          aiStatus: 'PENDING',
        },
        include: {
          scanResult: {
            include: {
              issues: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      // Check if any scans found
      if (scans.length === 0) {
        throw new AiQueueServiceError(
          'No pending AI scans available for export',
          'NO_PENDING_SCANS'
        );
      }

      // Step 2: Extract scan IDs for batch update
      const scanIds = scans.map((scan) => scan.id);

      // Step 3: Format scan data for CSV
      const exportData: ScanExportData[] = scans.map((scan) => {
        // Serialize issues to JSON string
        const issuesJson = JSON.stringify(scan.scanResult?.issues ?? []);

        return {
          scanId: scan.id,
          url: scan.url,
          email: scan.email,
          wcagLevel: scan.wcagLevel,
          issuesJson,
          createdAt: scan.createdAt.toISOString(),
          pageTitle: scan.pageTitle,
        };
      });

      // Step 4: Generate CSV
      const header = 'scan_id,url,email,wcag_level,issues_json,created_at,page_title\n';

      const rows = exportData.map((data) => {
        return [
          escapeCsvField(data.scanId),
          escapeCsvField(data.url),
          escapeCsvField(data.email),
          escapeCsvField(data.wcagLevel),
          escapeCsvField(data.issuesJson),
          escapeCsvField(data.createdAt),
          escapeCsvField(data.pageTitle),
        ].join(',');
      });

      const csv = header + rows.join('\n');

      // Step 5: Update all exported scans to DOWNLOADED status atomically
      await tx.scan.updateMany({
        where: {
          id: {
            in: scanIds,
          },
        },
        data: {
          aiStatus: 'DOWNLOADED',
        },
      });

      console.log(
        `✅ AI Queue Service: Exported ${scanIds.length} pending scans and updated status to DOWNLOADED`
      );

      return {
        csv,
        count: scanIds.length,
        scanIds,
      };
    });

    return result;
  } catch (error) {
    // Re-throw AiQueueServiceError as-is
    if (error instanceof AiQueueServiceError) {
      throw error;
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ AI Queue Service: Failed to export pending scans:', err.message);
    throw new AiQueueServiceError(
      'Failed to export pending AI scans',
      'EXPORT_FAILED',
      err
    );
  }
}

/**
 * Validation result for scan eligibility
 */
export interface ScanValidationResult {
  /** Whether the scan is eligible for AI result import */
  isValid: boolean;
  /** Error message if validation failed, undefined if valid */
  error?: string;
  /** Error code for programmatic handling */
  errorCode?: string;
}

/**
 * Validate scan eligibility for AI result import
 *
 * Checks that:
 * 1. Scan exists in the database
 * 2. Scan has aiEnabled = true
 * 3. Scan has aiStatus = DOWNLOADED (ready for import)
 *
 * This validation ensures that only scans that have been exported for AI processing
 * can receive AI-enhanced results.
 *
 * Requirements:
 * - REQ-4 AC 3: Validate scans before importing AI results
 * - REQ-4 AC 4: Only import for scans with aiEnabled=true and aiStatus=DOWNLOADED
 *
 * @param scanId - UUID of the scan to validate
 * @returns Validation result with success/error information
 *
 * @example
 * ```typescript
 * const result = await validateScanEligibility('550e8400-e29b-41d4-a716-446655440000');
 * if (!result.isValid) {
 *   console.error(`Validation failed: ${result.error}`);
 *   throw new Error(result.error);
 * }
 * console.log('Scan is eligible for AI import');
 * ```
 */
export async function validateScanEligibility(
  scanId: string
): Promise<ScanValidationResult> {
  const prisma = getPrismaClient();

  try {
    // Query the scan from database
    const scan = await prisma.scan.findUnique({
      where: { id: scanId },
      select: {
        id: true,
        aiEnabled: true,
        aiStatus: true,
      },
    });

    // Check 1: Scan exists
    if (!scan) {
      return {
        isValid: false,
        error: `Scan not found: ${scanId}`,
        errorCode: 'SCAN_NOT_FOUND',
      };
    }

    // Check 2: AI must be enabled
    if (!scan.aiEnabled) {
      return {
        isValid: false,
        error: `Scan ${scanId} does not have AI enabled (aiEnabled=false)`,
        errorCode: 'AI_NOT_ENABLED',
      };
    }

    // Check 3: Status must be DOWNLOADED
    if (scan.aiStatus !== 'DOWNLOADED') {
      return {
        isValid: false,
        error: `Scan ${scanId} has invalid aiStatus: ${scan.aiStatus ?? 'null'} (expected: DOWNLOADED)`,
        errorCode: 'INVALID_AI_STATUS',
      };
    }

    // All checks passed
    return {
      isValid: true,
    };
  } catch (error) {
    // Handle database errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(
      `❌ AI Queue Service: Failed to validate scan eligibility for ${scanId}:`,
      err.message
    );

    return {
      isValid: false,
      error: `Database error during scan validation: ${err.message}`,
      errorCode: 'DATABASE_ERROR',
    };
  }
}

/**
 * Parse and validate CSV import data
 *
 * Parses CSV string containing AI-processed results and validates each row
 * against the csvImportRowSchema. Used by operators to upload locally-processed
 * AI enhancements back to the system.
 *
 * Expected CSV format:
 * ```
 * scan_id,ai_summary,ai_remediation_plan,ai_issues_json,tokens_used,ai_model,processing_time
 * "550e8400-e29b-41d4-a716-446655440000","Summary...","Plan...","{}",4500,"claude-3-opus",45
 * ```
 *
 * Requirements:
 * - REQ-4 AC 3: Parse and validate CSV import file with proper error handling
 * - REQ-5: Store AI enhancements for validated scans
 *
 * @param csv - CSV string with header and data rows
 * @returns Array of validated CsvImportRow objects
 * @throws {AiQueueServiceError} If CSV parsing fails or validation errors occur
 *
 * @example
 * ```typescript
 * const csv = 'scan_id,ai_summary,...\n"uuid","summary",...';
 * const rows = parseAndValidateCsv(csv);
 * console.log(`Parsed ${rows.length} valid rows`);
 * ```
 */
export function parseAndValidateCsv(csv: string): CsvImportRow[] {
  try {
    // Parse CSV using csv-parse library
    // - columns: true => first row is header, return array of objects
    // - skip_empty_lines: true => ignore blank lines
    // - trim: true => trim whitespace from values
    // - relax_quotes: true => allow quotes in unquoted fields
    // - cast: true => attempt to cast values to appropriate types
    const records = parse(csv, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      cast: true,
      cast_date: false, // Don't auto-cast dates, we'll handle those explicitly
    }) as Record<string, unknown>[];

    // Validate that we have records
    if (records.length === 0) {
      throw new AiQueueServiceError(
        'CSV file is empty or contains no data rows',
        'EMPTY_CSV'
      );
    }

    // Validate each row against the schema
    const validatedRows: CsvImportRow[] = [];
    const errors: Array<{ row: number; errors: string[] }> = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowNumber = i + 2; // +2 because: 1-indexed + header row

      try {
        // Validate row against schema
        const validatedRow = csvImportRowSchema.parse(record);
        validatedRows.push(validatedRow);
      } catch (error) {
        // Collect validation errors for this row
        if (error && typeof error === 'object' && 'errors' in error) {
          const zodError = error as { errors: Array<{ path: string[]; message: string }> };
          const rowErrors = zodError.errors.map(
            (err) => `${err.path.join('.')}: ${err.message}`
          );
          errors.push({ row: rowNumber, errors: rowErrors });
        } else {
          const errMsg = error instanceof Error ? error.message : String(error);
          errors.push({ row: rowNumber, errors: [errMsg] });
        }
      }
    }

    // If there are validation errors, throw with detailed information
    if (errors.length > 0) {
      const errorMessage = errors
        .map((err) => `Row ${err.row}: ${err.errors.join(', ')}`)
        .join('\n');

      throw new AiQueueServiceError(
        `CSV validation failed:\n${errorMessage}`,
        'VALIDATION_FAILED'
      );
    }

    console.log(`✅ AI Queue Service: Successfully parsed and validated ${validatedRows.length} CSV rows`);

    return validatedRows;
  } catch (error) {
    // Re-throw AiQueueServiceError as-is
    if (error instanceof AiQueueServiceError) {
      throw error;
    }

    // Handle CSV parsing errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ AI Queue Service: Failed to parse CSV:', err.message);

    throw new AiQueueServiceError(
      `Failed to parse CSV file: ${err.message}`,
      'PARSE_FAILED',
      err
    );
  }
}

/**
 * AI data for scan update
 */
export interface AiScanData {
  /** AI-generated summary of accessibility issues */
  aiSummary: string;
  /** AI-generated remediation plan */
  aiRemediationPlan: string;
  /** Number of input tokens used */
  aiInputTokens?: number;
  /** Number of output tokens generated */
  aiOutputTokens?: number;
  /** Total tokens used */
  aiTotalTokens?: number;
  /** AI model used for processing */
  aiModel?: string;
}

/**
 * Update scan with AI-generated results
 *
 * Updates the Scan record with AI-generated summary, remediation plan, processing timestamp,
 * and token usage information. This method is designed to be called within a Prisma transaction
 * to ensure atomic updates alongside issue updates.
 *
 * Requirements:
 * - REQ-5 AC 1: Update Scan with aiSummary and aiRemediationPlan
 * - REQ-5 AC 2: Update Scan with aiProcessedAt timestamp and token fields
 *
 * @param tx - Prisma transaction client for atomic operations
 * @param scanId - UUID of the scan to update
 * @param aiData - AI-generated data to store
 * @returns Updated scan record
 * @throws {Error} If database update fails
 *
 * @example
 * ```typescript
 * await prisma.$transaction(async (tx) => {
 *   await updateScanWithAiResults(tx, scanId, {
 *     aiSummary: 'Found 5 critical accessibility issues...',
 *     aiRemediationPlan: '1. Fix form labels...',
 *     aiInputTokens: 2500,
 *     aiOutputTokens: 2000,
 *     aiTotalTokens: 4500,
 *     aiModel: 'claude-3-opus',
 *   });
 * });
 * ```
 */
export async function updateScanWithAiResults(
  tx: any,
  scanId: string,
  aiData: AiScanData
): Promise<void> {
  try {
    await tx.scan.update({
      where: { id: scanId },
      data: {
        // AI content fields
        aiSummary: aiData.aiSummary,
        aiRemediationPlan: aiData.aiRemediationPlan,
        aiProcessedAt: new Date(),

        // AI token tracking fields
        aiInputTokens: aiData.aiInputTokens,
        aiOutputTokens: aiData.aiOutputTokens,
        aiTotalTokens: aiData.aiTotalTokens,
        aiModel: aiData.aiModel,

        // Update aiStatus to COMPLETED
        aiStatus: 'COMPLETED',
      },
    });

    console.log(`✅ AI Queue Service: Updated scan ${scanId} with AI results`);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(
      `❌ AI Queue Service: Failed to update scan ${scanId} with AI results:`,
      err.message
    );
    throw err;
  }
}

/**
 * AI-enhanced issue data
 */
export interface AiIssueData {
  /** Issue ID to update */
  issueId: string;
  /** AI-generated plain language explanation */
  aiExplanation: string;
  /** AI-generated fix suggestion with code examples */
  aiFixSuggestion: string;
  /** AI-calculated business impact priority (1-10) */
  aiPriority: number;
}

/**
 * Update issues with AI-generated enhancements
 *
 * Bulk updates Issue records with AI-generated explanations, fix suggestions, and
 * priority scores. This method is designed to be called within a Prisma transaction
 * to ensure atomic updates alongside scan updates.
 *
 * Requirements:
 * - REQ-5 AC 1: Update Issue records with aiExplanation, aiFixSuggestion, aiPriority
 * - REQ-5 AC 2: Use Prisma transaction for atomic updates
 *
 * @param tx - Prisma transaction client for atomic operations
 * @param scanId - UUID of the scan (for logging purposes)
 * @param aiIssuesJson - Array of AI-enhanced issue data parsed from CSV
 * @returns Number of issues updated
 * @throws {Error} If database update fails
 *
 * @example
 * ```typescript
 * await prisma.$transaction(async (tx) => {
 *   const aiIssues = [
 *     {
 *       issueId: 'uuid-1',
 *       aiExplanation: 'This form field lacks a label...',
 *       aiFixSuggestion: '<label for="email">Email</label>...',
 *       aiPriority: 9,
 *     },
 *   ];
 *   const count = await updateIssuesWithAi(tx, scanId, aiIssues);
 *   console.log(`Updated ${count} issues`);
 * });
 * ```
 */
export async function updateIssuesWithAi(
  tx: any,
  scanId: string,
  aiIssuesJson: AiIssueData[]
): Promise<number> {
  try {
    // Validate that we have issues to update
    if (!aiIssuesJson || aiIssuesJson.length === 0) {
      console.log(`ℹ️ AI Queue Service: No AI-enhanced issues to update for scan ${scanId}`);
      return 0;
    }

    // Update each issue individually to handle different data per issue
    // Note: Prisma doesn't support updateMany with different data per record
    let updateCount = 0;

    for (const aiIssue of aiIssuesJson) {
      try {
        await tx.issue.update({
          where: { id: aiIssue.issueId },
          data: {
            aiExplanation: aiIssue.aiExplanation,
            aiFixSuggestion: aiIssue.aiFixSuggestion,
            aiPriority: aiIssue.aiPriority,
          },
        });
        updateCount++;
      } catch (issueError) {
        // Log individual issue update failure but continue with others
        const err = issueError instanceof Error ? issueError : new Error(String(issueError));
        console.warn(
          `⚠️ AI Queue Service: Failed to update issue ${aiIssue.issueId}:`,
          err.message
        );
      }
    }

    console.log(
      `✅ AI Queue Service: Updated ${updateCount}/${aiIssuesJson.length} issues with AI enhancements for scan ${scanId}`
    );

    return updateCount;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(
      `❌ AI Queue Service: Failed to update issues for scan ${scanId}:`,
      err.message
    );
    throw err;
  }
}

/**
 * Import AI-processed results from CSV
 *
 * Main orchestration method for importing AI-enhanced scan results. This method:
 * 1. Parses and validates the CSV file
 * 2. For each row, validates scan eligibility
 * 3. Updates scan and issue records atomically within a transaction
 * 4. Deducts total tokens used from the campaign budget
 * 5. Queues email notifications for completed scans
 * 6. Returns comprehensive import results with success/failure counts
 *
 * Requirements:
 * - REQ-4 AC 3: Validate scans before import
 * - REQ-4 AC 4: Update aiStatus to COMPLETED for successful imports
 * - REQ-5: Store AI enhancements atomically
 * - REQ-6: Queue email notifications for completed scans
 *
 * @param csv - CSV string containing AI-processed results
 * @returns Import result with success/failed counts, errors, and tokens deducted
 * @throws {AiQueueServiceError} If CSV parsing fails or critical errors occur
 *
 * @example
 * ```typescript
 * const csvData = 'scan_id,ai_summary,...\n"uuid","summary",...';
 * const result = await importAiResults(csvData);
 * console.log(`Processed: ${result.processed}, Failed: ${result.failed}`);
 * console.log(`Tokens deducted: ${result.tokensDeducted}`);
 * if (result.errors.length > 0) {
 *   console.error('Import errors:', result.errors);
 * }
 * ```
 */
export async function importAiResults(csv: string): Promise<ImportResult> {
  const prisma = getPrismaClient();

  try {
    console.log('🔄 AI Queue Service: Starting AI results import...');

    // Step 1: Parse and validate CSV
    const rows = parseAndValidateCsv(csv);
    console.log(`✅ AI Queue Service: Parsed ${rows.length} CSV rows`);

    // Initialize result tracking
    const result: ImportResult = {
      success: true,
      processed: 0,
      failed: 0,
      errors: [],
      tokensDeducted: 0,
    };

    let totalTokensUsed = 0;

    // Step 2: Process each row
    for (const row of rows) {
      try {
        // Step 2a: Validate scan eligibility
        const validation = await validateScanEligibility(row.scan_id);

        if (!validation.isValid) {
          result.failed++;
          result.errors.push({
            scanId: row.scan_id,
            error: validation.error ?? 'Unknown validation error',
          });
          console.warn(
            `⚠️ AI Queue Service: Skipping scan ${row.scan_id}: ${validation.error}`
          );
          continue;
        }

        // Step 2b: Update records atomically within transaction
        await prisma.$transaction(async (tx) => {
          // Update scan with AI results
          await updateScanWithAiResults(tx, row.scan_id, {
            aiSummary: row.ai_summary,
            aiRemediationPlan: row.ai_remediation_plan,
            aiTotalTokens: row.tokens_used,
            aiModel: row.ai_model,
          });

          // Parse and update issues with AI enhancements
          if (row.ai_issues_json) {
            const aiIssues = JSON.parse(row.ai_issues_json) as AiIssueData[];
            if (aiIssues && aiIssues.length > 0) {
              await updateIssuesWithAi(tx, row.scan_id, aiIssues);
            }
          }
        });

        // Track successful processing
        result.processed++;
        totalTokensUsed += row.tokens_used;

        console.log(
          `✅ AI Queue Service: Successfully imported AI results for scan ${row.scan_id} (${row.tokens_used} tokens)`
        );

        // Step 2c: Queue email notification for completed scan
        // Only queue email if scan has an email address
        const scan = await prisma.scan.findUnique({
          where: { id: row.scan_id },
          select: { email: true, url: true },
        });

        if (scan?.email) {
          try {
            // Use correct EmailJobData format expected by send-email processor
            const emailJobData: EmailJobData = {
              scanId: row.scan_id,
              email: scan.email,
              type: 'ai_scan_complete',
            };

            const emailJob = await sendEmailQueue.add('send-email', emailJobData, {
              attempts: 5,
              backoff: {
                type: 'exponential',
                delay: 2000,
              },
            });

            console.log(
              `✅ AI Queue Service: Queued email notification for scan ${row.scan_id} to ${scan.email} (job: ${emailJob.id})`
            );
          } catch (emailError) {
            // Log email queue failure but don't fail the import
            const err = emailError instanceof Error ? emailError : new Error(String(emailError));
            console.warn(
              `⚠️ AI Queue Service: Failed to queue email for scan ${row.scan_id}:`,
              err.message
            );
          }
        }
      } catch (rowError) {
        // Track row processing failure
        result.failed++;
        const err = rowError instanceof Error ? rowError : new Error(String(rowError));
        result.errors.push({
          scanId: row.scan_id,
          error: err.message,
        });

        console.error(
          `❌ AI Queue Service: Failed to import AI results for scan ${row.scan_id}:`,
          err.message
        );
      }
    }

    // Step 3: Deduct total tokens from campaign budget
    if (totalTokensUsed > 0 && result.processed > 0) {
      try {
        // Use the first successfully processed scan ID for token deduction
        const firstSuccessfulScanId = rows.find(
          (row) => !result.errors.some((e) => e.scanId === row.scan_id)
        )?.scan_id;

        if (firstSuccessfulScanId) {
          await deductTokens(firstSuccessfulScanId, totalTokensUsed);
          result.tokensDeducted = totalTokensUsed;

          console.log(
            `✅ AI Queue Service: Deducted ${totalTokensUsed} tokens from campaign budget`
          );
        }
      } catch (tokenError) {
        // Log token deduction failure but don't fail the import
        const err = tokenError instanceof Error ? tokenError : new Error(String(tokenError));
        console.error(
          `❌ AI Queue Service: Failed to deduct tokens from campaign:`,
          err.message
        );
        // Token deduction failure doesn't invalidate the import
        // The scans were still processed successfully
      }
    }

    // Step 4: Determine overall success
    result.success = result.failed === 0;

    console.log(
      `✅ AI Queue Service: Import completed - ` +
      `Processed: ${result.processed}, Failed: ${result.failed}, Tokens: ${result.tokensDeducted}`
    );

    return result;
  } catch (error) {
    // Re-throw AiQueueServiceError as-is
    if (error instanceof AiQueueServiceError) {
      throw error;
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ AI Queue Service: Failed to import AI results:', err.message);
    throw new AiQueueServiceError(
      'Failed to import AI results from CSV',
      'IMPORT_FAILED',
      err
    );
  }
}

/**
 * AI queue statistics
 *
 * Comprehensive statistics about the AI scan queue including
 * counts by status and total token usage.
 */
export interface QueueStats {
  /** Total scans with AI enabled */
  totalScans: number;
  /** Scans by status breakdown */
  byStatus: {
    PENDING: number;
    DOWNLOADED: number;
    PROCESSING: number;
    COMPLETED: number;
    FAILED: number;
  };
  /** Total tokens used across all completed scans */
  totalTokensUsed: number;
  /** Average tokens per completed scan */
  avgTokensPerScan: number;
}

/**
 * Get AI queue statistics
 *
 * Returns comprehensive statistics about the AI scan queue including
 * counts by aiStatus and total token usage. Used for monitoring queue
 * health and campaign progress.
 *
 * Requirements:
 * - REQ-4 AC 5: Provide queue statistics for monitoring
 * - REQ-8 AC 2: Track token usage across scans
 *
 * @returns Queue statistics with counts and token usage
 *
 * @example
 * ```typescript
 * const stats = await getQueueStats();
 * console.log(`Total AI scans: ${stats.totalScans}`);
 * console.log(`Pending: ${stats.byStatus.PENDING}`);
 * console.log(`Completed: ${stats.byStatus.COMPLETED}`);
 * console.log(`Total tokens used: ${stats.totalTokensUsed}`);
 * console.log(`Avg tokens per scan: ${stats.avgTokensPerScan}`);
 * ```
 */
export async function getQueueStats(): Promise<QueueStats> {
  const prisma = getPrismaClient();

  try {
    // Get total count of AI-enabled scans
    const totalScans = await prisma.scan.count({
      where: {
        aiEnabled: true,
      },
    });

    // Get counts by status
    const statusCounts = await prisma.scan.groupBy({
      by: ['aiStatus'],
      where: {
        aiEnabled: true,
      },
      _count: {
        id: true,
      },
    });

    // Initialize status breakdown with zeros
    const byStatus = {
      PENDING: 0,
      DOWNLOADED: 0,
      PROCESSING: 0,
      COMPLETED: 0,
      FAILED: 0,
    };

    // Populate status counts
    for (const statusCount of statusCounts) {
      if (statusCount.aiStatus) {
        byStatus[statusCount.aiStatus] = statusCount._count.id;
      }
    }

    // Calculate total tokens used
    const tokenStats = await prisma.scan.aggregate({
      where: {
        aiEnabled: true,
        aiStatus: 'COMPLETED',
        aiTotalTokens: {
          not: null,
        },
      },
      _sum: {
        aiTotalTokens: true,
      },
      _count: {
        id: true,
      },
    });

    const totalTokensUsed = tokenStats._sum.aiTotalTokens ?? 0;
    const completedCount = tokenStats._count.id;
    const avgTokensPerScan = completedCount > 0 ? Math.round(totalTokensUsed / completedCount) : 0;

    const stats: QueueStats = {
      totalScans,
      byStatus,
      totalTokensUsed,
      avgTokensPerScan,
    };

    console.log(`✅ AI Queue Service: Retrieved queue stats - Total: ${totalScans}, Tokens: ${totalTokensUsed}`);

    return stats;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ AI Queue Service: Failed to get queue stats:', err.message);
    throw new AiQueueServiceError(
      'Failed to retrieve queue statistics',
      'STATS_FAILED',
      err
    );
  }
}

/**
 * AI scan list item for paginated results
 */
export interface AiScanListItem {
  /** Scan ID */
  id: string;
  /** URL being scanned */
  url: string;
  /** Email address for notification */
  email: string | null;
  /** WCAG level */
  wcagLevel: string;
  /** AI status */
  aiStatus: string;
  /** AI summary (if available) */
  aiSummary: string | null;
  /** Total tokens used */
  aiTotalTokens: number | null;
  /** AI model used */
  aiModel: string | null;
  /** When AI processing completed */
  aiProcessedAt: Date | null;
  /** Scan creation timestamp */
  createdAt: Date;
}

/**
 * Paginated AI scan list result
 */
export interface PaginatedAiScans {
  /** Array of AI scans */
  items: AiScanListItem[];
  /** Cursor for next page (null if no more items) */
  nextCursor: string | null;
  /** Total count of matching scans */
  totalCount: number;
}

/**
 * List AI-enabled scans with filters and pagination
 *
 * Returns a paginated list of AI-enabled scans with optional filters
 * for status and date range. Uses cursor-based pagination for efficient
 * querying of large datasets.
 *
 * Requirements:
 * - REQ-4 AC 5: List scans with status and date filters
 * - REQ-8 AC 2: Display token usage information
 *
 * @param filters - Filter and pagination options
 * @returns Paginated list of AI scans
 *
 * @example
 * ```typescript
 * // List all COMPLETED scans
 * const result = await listAiScans({
 *   status: ['COMPLETED'],
 *   limit: 50
 * });
 *
 * // List scans from January 2025
 * const januaryScans = await listAiScans({
 *   dateFrom: new Date('2025-01-01'),
 *   dateTo: new Date('2025-01-31'),
 *   limit: 100
 * });
 *
 * // Paginate through results
 * const nextPage = await listAiScans({
 *   cursor: result.nextCursor,
 *   limit: 50
 * });
 * ```
 */
export async function listAiScans(
  filters: import('./ai-campaign.types.js').AiScanFilters = {}
): Promise<PaginatedAiScans> {
  const prisma = getPrismaClient();

  try {
    const limit = filters.limit ?? 50; // Default limit
    const cursor = filters.cursor;

    // Build where clause
    const where: any = {
      aiEnabled: true,
    };

    // Add status filter if provided
    if (filters.status && filters.status.length > 0) {
      where.aiStatus = {
        in: filters.status,
      };
    }

    // Add date range filters if provided
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) {
        where.createdAt.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        where.createdAt.lte = filters.dateTo;
      }
    }

    // Build query options
    const queryOptions: any = {
      where,
      take: limit + 1, // Fetch one extra to determine if there's a next page
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        url: true,
        email: true,
        wcagLevel: true,
        aiStatus: true,
        aiSummary: true,
        aiTotalTokens: true,
        aiModel: true,
        aiProcessedAt: true,
        createdAt: true,
      },
    };

    // Add cursor if provided
    if (cursor) {
      queryOptions.cursor = { id: cursor };
      queryOptions.skip = 1; // Skip the cursor itself
    }

    // Execute query
    const scans = await prisma.scan.findMany(queryOptions);

    // Get total count
    const totalCount = await prisma.scan.count({ where });

    // Determine if there's a next page
    const hasMore = scans.length > limit;
    const items = hasMore ? scans.slice(0, limit) : scans;
    const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

    console.log(
      `✅ AI Queue Service: Listed ${items.length} AI scans (total: ${totalCount})`
    );

    return {
      items: items.map((scan) => ({
        id: scan.id,
        url: scan.url,
        email: scan.email,
        wcagLevel: scan.wcagLevel,
        aiStatus: scan.aiStatus ?? 'PENDING',
        aiSummary: scan.aiSummary,
        aiTotalTokens: scan.aiTotalTokens,
        aiModel: scan.aiModel,
        aiProcessedAt: scan.aiProcessedAt,
        createdAt: scan.createdAt,
      })),
      nextCursor,
      totalCount,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ AI Queue Service: Failed to list AI scans:', err.message);
    throw new AiQueueServiceError(
      'Failed to list AI scans',
      'LIST_FAILED',
      err
    );
  }
}

/**
 * Retry result
 */
export interface RetryResult {
  /** Whether the retry was successful */
  success: boolean;
  /** Current AI status after retry */
  aiStatus: string;
  /** Message describing the result */
  message: string;
}

/**
 * Retry a failed AI scan
 *
 * Resets a failed AI scan's aiStatus to PENDING so it can be re-exported
 * and processed again. This allows operators to retry scans that failed
 * during AI processing.
 *
 * Requirements:
 * - REQ-4 AC 5: Support retry of failed scans
 * - REQ-8 AC 2: Reset scan status for reprocessing
 *
 * @param scanId - UUID of the scan to retry
 * @returns Retry result with success status and message
 * @throws {AiQueueServiceError} If scan not found or update fails
 *
 * @example
 * ```typescript
 * const result = await retryFailedScan('550e8400-e29b-41d4-a716-446655440000');
 * if (result.success) {
 *   console.log(`Scan reset to ${result.aiStatus}: ${result.message}`);
 * } else {
 *   console.error(`Retry failed: ${result.message}`);
 * }
 * ```
 */
export async function retryFailedScan(scanId: string): Promise<RetryResult> {
  const prisma = getPrismaClient();

  try {
    // Validate scan ID
    if (!scanId || typeof scanId !== 'string') {
      throw new AiQueueServiceError(
        'Scan ID is required and must be a string',
        'INVALID_INPUT'
      );
    }

    // Check if scan exists and get current status
    const scan = await prisma.scan.findUnique({
      where: { id: scanId },
      select: {
        id: true,
        aiEnabled: true,
        aiStatus: true,
        url: true,
      },
    });

    if (!scan) {
      throw new AiQueueServiceError(
        `Scan not found: ${scanId}`,
        'SCAN_NOT_FOUND'
      );
    }

    // Check if AI is enabled
    if (!scan.aiEnabled) {
      return {
        success: false,
        aiStatus: scan.aiStatus ?? 'null',
        message: 'Scan does not have AI enabled (aiEnabled=false)',
      };
    }

    // Check if scan is in a retryable state (FAILED)
    if (scan.aiStatus !== 'FAILED') {
      return {
        success: false,
        aiStatus: scan.aiStatus ?? 'null',
        message: `Scan is not in FAILED status (current: ${scan.aiStatus ?? 'null'}). Only FAILED scans can be retried.`,
      };
    }

    // Reset aiStatus to PENDING
    await prisma.scan.update({
      where: { id: scanId },
      data: {
        aiStatus: 'PENDING',
        // Clear error message if any
        errorMessage: null,
      },
    });

    console.log(
      `✅ AI Queue Service: Reset scan ${scanId} (${scan.url}) from FAILED to PENDING for retry`
    );

    return {
      success: true,
      aiStatus: 'PENDING',
      message: `Scan ${scanId} has been reset to PENDING and is ready for re-export`,
    };
  } catch (error) {
    // Re-throw AiQueueServiceError as-is
    if (error instanceof AiQueueServiceError) {
      throw error;
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(
      `❌ AI Queue Service: Failed to retry scan ${scanId}:`,
      err.message
    );
    throw new AiQueueServiceError(
      `Failed to retry failed scan ${scanId}`,
      'RETRY_FAILED',
      err
    );
  }
}

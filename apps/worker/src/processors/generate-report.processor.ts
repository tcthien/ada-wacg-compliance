/**
 * Generate Report Processor
 *
 * Processes report generation (PDF/JSON) from scan results.
 * Implements retry logic and proper error handling for report generation workflow.
 */

import { Job } from 'bullmq';
import { getPrismaClient } from '../config/prisma.js';
import { generatePdfReport, uploadToS3 as uploadPdfToS3 } from './reporter/pdf-generator.js';
import { exportJsonReport, uploadJsonToS3 } from './reporter/json-exporter.js';
import { formatResult } from '../utils/result-formatter.js';
import type { ScanWithResult } from '../utils/result-formatter.js';

/**
 * Report Job Data interface
 */
interface ReportJobData {
  scanId: string;
  format: 'PDF' | 'JSON';
  requestedBy?: string; // Optional session ID
}

/**
 * Report Job Result interface
 */
interface ReportJobResult {
  reportId: string;
  scanId: string;
  format: string;
  storageKey: string;
  storageUrl: string;
  generatedAt: Date;
}

/**
 * Report Generation Error
 */
export class ReportGenerationError extends Error {
  public readonly code: string;
  public override readonly cause?: Error | undefined;

  constructor(message: string, code: string, cause?: Error | undefined) {
    super(message);
    this.name = 'ReportGenerationError';
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Generate Report Processor
 *
 * Main processor function for generating reports from scan results.
 * Supports both PDF and JSON formats with automatic retry on failure.
 *
 * @param job - BullMQ job containing report generation parameters
 * @returns Report generation result
 * @throws ReportGenerationError if generation fails
 *
 * @example
 * ```typescript
 * // Job data
 * {
 *   scanId: 'scan-123',
 *   format: 'PDF',
 *   requestedBy: 'session-456'
 * }
 * ```
 */
export async function processGenerateReport(
  job: Job<ReportJobData>
): Promise<ReportJobResult> {
  const { scanId, format, requestedBy } = job.data;

  console.log(`📄 Processing report generation job: ${job.id}`);
  console.log(`   Scan ID: ${scanId}`);
  console.log(`   Format: ${format}`);
  console.log(`   Requested By: ${requestedBy ?? 'N/A'}`);

  const prisma = getPrismaClient();

  try {
    // Update job progress: Fetching scan data
    await job.updateProgress(10);

    // 1. Fetch scan with results
    const scan = await prisma.scan.findUnique({
      where: { id: scanId },
      include: {
        scanResult: {
          include: {
            issues: {
              orderBy: {
                impact: 'asc', // CRITICAL first (enum order)
              },
            },
          },
        },
      },
    });

    if (!scan) {
      throw new ReportGenerationError(
        `Scan not found: ${scanId}`,
        'SCAN_NOT_FOUND'
      );
    }

    if (!scan.scanResult) {
      throw new ReportGenerationError(
        `Scan ${scanId} has no result data. The scan may not be complete.`,
        'SCAN_NOT_COMPLETE'
      );
    }

    if (scan.status !== 'COMPLETED') {
      throw new ReportGenerationError(
        `Scan ${scanId} is not complete (status: ${scan.status})`,
        'SCAN_NOT_COMPLETE'
      );
    }

    // Update job progress: Formatting result
    await job.updateProgress(30);

    // 2. Format result for report generation
    const formattedResult = formatResult(scan as ScanWithResult);

    console.log(`📊 Formatted result for scan ${scanId}`);
    console.log(`   Total Issues: ${formattedResult.summary.totalIssues}`);
    console.log(`   Critical: ${formattedResult.summary.critical}`);
    console.log(`   Serious: ${formattedResult.summary.serious}`);

    // Update job progress: Generating report
    await job.updateProgress(50);

    // 3. Generate report based on format
    let buffer: Buffer;
    let storageKey: string;
    let storageUrl: string;

    if (format === 'PDF') {
      // Generate PDF report
      console.log(`📄 Generating PDF report...`);
      buffer = await generatePdfReport(formattedResult);
      storageKey = `reports/${scanId}/report.pdf`;

      // Upload to S3 (stub implementation)
      storageUrl = await uploadPdfToS3(buffer, storageKey);

      console.log(`✅ PDF generated: ${buffer.length} bytes`);
    } else {
      // Generate JSON report
      console.log(`📄 Generating JSON report...`);
      const result = await exportJsonReport(formattedResult);
      buffer = result.buffer;
      storageKey = result.key;

      // Upload to S3 (stub implementation)
      storageUrl = await uploadJsonToS3(buffer, storageKey);

      console.log(`✅ JSON generated: ${buffer.length} bytes`);
    }

    // Update job progress: Saving report record
    await job.updateProgress(80);

    // 4. Calculate expiration date (30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // 5. Save Report record to database
    const report = await prisma.report.create({
      data: {
        scanId,
        format,
        storageKey,
        storageUrl,
        fileSizeBytes: buffer.length,
        expiresAt,
      },
    });

    console.log(`💾 Report saved to database: ${report.id}`);

    // Update job progress: Complete
    await job.updateProgress(100);

    const result: ReportJobResult = {
      reportId: report.id,
      scanId,
      format,
      storageKey,
      storageUrl,
      generatedAt: report.createdAt,
    };

    console.log(`✅ Completed report generation job: ${job.id}`);
    return result;
  } catch (error) {
    // Log error for debugging
    console.error(`❌ Report generation failed for scan ${scanId}:`, error);

    // Re-throw ReportGenerationError as-is
    if (error instanceof ReportGenerationError) {
      throw error;
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    throw new ReportGenerationError(
      `Failed to generate report for scan ${scanId}`,
      'GENERATION_FAILED',
      err
    );
  }
}

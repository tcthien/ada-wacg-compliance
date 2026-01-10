/**
 * Processing summary status types
 */
export type ProcessingStatus = 'completed' | 'partial_failure' | 'complete_failure';

/**
 * Summary of processing results for cron mode
 */
export interface ProcessingSummary {
  status: ProcessingStatus;
  files_processed: number;
  total_urls: number;
  successful: number;
  failed: number;
  skipped: number;
  duration_seconds: number;
  output_files: string[];
  failed_files: string[];
  errors: string[];
}

/**
 * Statistics used to generate processing summary
 */
export interface SummaryStats {
  startTime: Date;
  endTime: Date;
  filesProcessed: number;
  totalUrls: number;
  successful: number;
  failed: number;
  skipped: number;
  outputFiles: string[];
  failedFiles: string[];
  errors: string[];
}

/**
 * Determine processing status based on success/failure counts
 * @param successful Number of successful scans
 * @param failed Number of failed scans
 * @returns Processing status
 */
function determineStatus(successful: number, failed: number): ProcessingStatus {
  if (failed === 0) {
    return 'completed';
  }

  if (successful === 0 && failed > 0) {
    return 'complete_failure';
  }

  return 'partial_failure';
}

/**
 * Calculate duration in seconds between two dates
 * @param startTime Start time
 * @param endTime End time
 * @returns Duration in seconds (rounded to 2 decimal places)
 */
function calculateDuration(startTime: Date, endTime: Date): number {
  const durationMs = endTime.getTime() - startTime.getTime();
  const durationSeconds = durationMs / 1000;
  return Math.round(durationSeconds * 100) / 100;
}

/**
 * Generate processing summary from statistics
 * @param stats Summary statistics
 * @returns Processing summary object
 */
export function generateSummary(stats: SummaryStats): ProcessingSummary {
  const status = determineStatus(stats.successful, stats.failed);
  const duration = calculateDuration(stats.startTime, stats.endTime);

  return {
    status,
    files_processed: stats.filesProcessed,
    total_urls: stats.totalUrls,
    successful: stats.successful,
    failed: stats.failed,
    skipped: stats.skipped,
    duration_seconds: duration,
    output_files: stats.outputFiles,
    failed_files: stats.failedFiles,
    errors: stats.errors,
  };
}

/**
 * Get JSON string representation of processing summary
 * @param summary Processing summary object
 * @returns JSON string with 2-space indentation
 */
export function getJsonSummary(summary: ProcessingSummary): string {
  return JSON.stringify(summary, null, 2);
}

/**
 * Print processing summary as JSON to stdout
 * @param summary Processing summary object
 */
export function printJsonSummary(summary: ProcessingSummary): void {
  console.log(JSON.stringify(summary, null, 2));
}

/**
 * Scan Events Cleanup Job
 *
 * Scheduled job that runs daily to archive and delete old scan events.
 * Implements the data retention policy (30 days) from requirements.
 */

import { archiveOldEvents } from '../modules/scans/scan-event.service.js';

/**
 * Retention period in days
 */
const RETENTION_DAYS = 30;

/**
 * Job interval in milliseconds (24 hours)
 */
const JOB_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Timer reference for cleanup
 */
let cleanupTimer: NodeJS.Timeout | null = null;

/**
 * Flag to track if job is currently running
 */
let isRunning = false;

/**
 * Run the cleanup job
 *
 * Archives and deletes scan events older than the retention period.
 * Prevents concurrent runs using isRunning flag.
 *
 * @returns Number of events archived
 */
export async function runCleanupJob(): Promise<number> {
  if (isRunning) {
    console.log('⏳ ScanEventsCleanup: Job already running, skipping...');
    return 0;
  }

  isRunning = true;
  const startTime = Date.now();

  try {
    console.log('🧹 ScanEventsCleanup: Starting cleanup job...');

    // Calculate cutoff date (30 days ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

    // Run archive and cleanup
    const deletedCount = await archiveOldEvents(cutoffDate);

    const duration = Date.now() - startTime;
    console.log(
      `✅ ScanEventsCleanup: Completed in ${duration}ms. Archived ${deletedCount} events.`
    );

    return deletedCount;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ ScanEventsCleanup: Job failed:', err.message);
    return 0;
  } finally {
    isRunning = false;
  }
}

/**
 * Start the scheduled cleanup job
 *
 * Runs immediately on start, then every 24 hours.
 * Call this from the main app initialization.
 *
 * @example
 * ```typescript
 * // In index.ts or app initialization
 * import { startCleanupScheduler } from './jobs/cleanup-scan-events.job.js';
 *
 * // Start after server is ready
 * startCleanupScheduler();
 * ```
 */
export function startCleanupScheduler(): void {
  if (cleanupTimer) {
    console.log('⚠️ ScanEventsCleanup: Scheduler already running');
    return;
  }

  console.log(
    `📅 ScanEventsCleanup: Starting scheduler (interval: ${JOB_INTERVAL_MS / 1000 / 60 / 60}h, retention: ${RETENTION_DAYS} days)`
  );

  // Run immediately on start (with delay to let server initialize)
  setTimeout(() => {
    void runCleanupJob();
  }, 5000);

  // Schedule recurring runs every 24 hours
  cleanupTimer = setInterval(() => {
    void runCleanupJob();
  }, JOB_INTERVAL_MS);

  // Ensure timer doesn't prevent process exit
  cleanupTimer.unref();
}

/**
 * Stop the scheduled cleanup job
 *
 * Call this during graceful shutdown.
 *
 * @example
 * ```typescript
 * // In shutdown handler
 * import { stopCleanupScheduler } from './jobs/cleanup-scan-events.job.js';
 *
 * process.on('SIGTERM', () => {
 *   stopCleanupScheduler();
 *   process.exit(0);
 * });
 * ```
 */
export function stopCleanupScheduler(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
    console.log('🛑 ScanEventsCleanup: Scheduler stopped');
  }
}

/**
 * Get cleanup job status
 *
 * @returns Status object with scheduler and job state
 */
export function getCleanupJobStatus(): {
  schedulerRunning: boolean;
  jobRunning: boolean;
  retentionDays: number;
  intervalHours: number;
} {
  return {
    schedulerRunning: cleanupTimer !== null,
    jobRunning: isRunning,
    retentionDays: RETENTION_DAYS,
    intervalHours: JOB_INTERVAL_MS / 1000 / 60 / 60,
  };
}

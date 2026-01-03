/**
 * Batch Stale Checker Job
 *
 * Scheduled job that runs hourly to detect and mark stale batches.
 * A batch is considered stale if it remains in PENDING or RUNNING status for more than 24 hours.
 *
 * Requirements:
 * - 5.5: Stale batches (>24h old) shall be marked with warning status
 */

import { getPrismaClient } from '../config/database.js';
import type { BatchStatus } from '@prisma/client';

/**
 * Stale threshold in hours (24 hours)
 */
const STALE_THRESHOLD_HOURS = 24;

/**
 * Job interval in milliseconds (1 hour)
 */
const JOB_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Timer reference for cleanup
 */
let staleCheckerTimer: NodeJS.Timeout | null = null;

/**
 * Flag to track if job is currently running
 */
let isRunning = false;

/**
 * Find and mark stale batches
 *
 * Queries for batches that are in PENDING or RUNNING status
 * and have been in that state for more than 24 hours.
 * Updates their status to STALE.
 *
 * @returns Number of batches marked as stale
 */
async function markStaleBatches(): Promise<number> {
  const prisma = getPrismaClient();

  try {
    // Calculate cutoff date (24 hours ago)
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - STALE_THRESHOLD_HOURS);

    // Find batches in PENDING or RUNNING status older than cutoff
    const staleBatches = await prisma.batchScan.findMany({
      where: {
        status: {
          in: ['PENDING', 'RUNNING'] as BatchStatus[],
        },
        createdAt: {
          lt: cutoffDate,
        },
      },
      select: {
        id: true,
        homepageUrl: true,
        status: true,
        createdAt: true,
      },
    });

    if (staleBatches.length === 0) {
      return 0;
    }

    // Update all stale batches to STALE status
    const updateResult = await prisma.batchScan.updateMany({
      where: {
        id: {
          in: staleBatches.map((batch) => batch.id),
        },
        status: {
          in: ['PENDING', 'RUNNING'] as BatchStatus[],
        },
      },
      data: {
        status: 'STALE',
      },
    });

    // Log stale batch details for monitoring
    console.log(`📊 BatchStaleChecker: Marked ${updateResult.count} stale batches:`);
    staleBatches.forEach((batch) => {
      const age = Date.now() - batch.createdAt.getTime();
      const ageHours = Math.floor(age / (1000 * 60 * 60));
      console.log(
        `   - ${batch.id} (${batch.homepageUrl}) - ${batch.status} for ${ageHours}h`
      );
    });

    return updateResult.count;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ BatchStaleChecker: Failed to mark stale batches:', err.message);
    throw err;
  }
}

/**
 * Run the stale batch checker job
 *
 * Finds batches in PENDING or RUNNING status older than 24 hours
 * and marks them as STALE.
 * Prevents concurrent runs using isRunning flag.
 *
 * @returns Number of batches marked as stale
 *
 * @example
 * ```typescript
 * // Manually trigger the job
 * const staleCount = await runStaleCheckerJob();
 * console.log(`Marked ${staleCount} batches as stale`);
 * ```
 */
export async function runStaleCheckerJob(): Promise<number> {
  if (isRunning) {
    console.log('⏳ BatchStaleChecker: Job already running, skipping...');
    return 0;
  }

  isRunning = true;
  const startTime = Date.now();

  try {
    console.log('🔍 BatchStaleChecker: Starting stale batch check...');

    // Find and mark stale batches
    const staleCount = await markStaleBatches();

    const duration = Date.now() - startTime;

    if (staleCount > 0) {
      console.log(
        `⚠️ BatchStaleChecker: Completed in ${duration}ms. Marked ${staleCount} batches as STALE.`
      );
    } else {
      console.log(
        `✅ BatchStaleChecker: Completed in ${duration}ms. No stale batches found.`
      );
    }

    return staleCount;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ BatchStaleChecker: Job failed:', err.message);
    return 0;
  } finally {
    isRunning = false;
  }
}

/**
 * Start the scheduled stale batch checker job
 *
 * Runs immediately on start (after 10s delay), then every hour.
 * Call this from the main app initialization.
 *
 * @example
 * ```typescript
 * // In index.ts or app initialization
 * import { startStaleCheckerScheduler } from './jobs/batch-stale-checker.job.js';
 *
 * // Start after server is ready
 * startStaleCheckerScheduler();
 * ```
 */
export function startStaleCheckerScheduler(): void {
  if (staleCheckerTimer) {
    console.log('⚠️ BatchStaleChecker: Scheduler already running');
    return;
  }

  console.log(
    `📅 BatchStaleChecker: Starting scheduler (interval: ${JOB_INTERVAL_MS / 1000 / 60}min, threshold: ${STALE_THRESHOLD_HOURS}h)`
  );

  // Run immediately on start (with delay to let server initialize)
  setTimeout(() => {
    void runStaleCheckerJob();
  }, 10000);

  // Schedule recurring runs every hour
  staleCheckerTimer = setInterval(() => {
    void runStaleCheckerJob();
  }, JOB_INTERVAL_MS);

  // Ensure timer doesn't prevent process exit
  staleCheckerTimer.unref();
}

/**
 * Stop the scheduled stale batch checker job
 *
 * Call this during graceful shutdown.
 *
 * @example
 * ```typescript
 * // In shutdown handler
 * import { stopStaleCheckerScheduler } from './jobs/batch-stale-checker.job.js';
 *
 * process.on('SIGTERM', () => {
 *   stopStaleCheckerScheduler();
 *   process.exit(0);
 * });
 * ```
 */
export function stopStaleCheckerScheduler(): void {
  if (staleCheckerTimer) {
    clearInterval(staleCheckerTimer);
    staleCheckerTimer = null;
    console.log('🛑 BatchStaleChecker: Scheduler stopped');
  }
}

/**
 * Get stale checker job status
 *
 * @returns Status object with scheduler and job state
 *
 * @example
 * ```typescript
 * const status = getStaleCheckerJobStatus();
 * console.log(`Scheduler running: ${status.schedulerRunning}`);
 * console.log(`Job running: ${status.jobRunning}`);
 * console.log(`Stale threshold: ${status.staleThresholdHours} hours`);
 * ```
 */
export function getStaleCheckerJobStatus(): {
  schedulerRunning: boolean;
  jobRunning: boolean;
  staleThresholdHours: number;
  intervalMinutes: number;
} {
  return {
    schedulerRunning: staleCheckerTimer !== null,
    jobRunning: isRunning,
    staleThresholdHours: STALE_THRESHOLD_HOURS,
    intervalMinutes: JOB_INTERVAL_MS / 1000 / 60,
  };
}

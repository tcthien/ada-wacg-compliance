/**
 * AI Stale Cleanup Job
 *
 * Scheduled job that runs every 6 hours to detect and cleanup stale AI scans.
 * A scan is considered stale if it has aiEnabled=true and aiStatus=PENDING
 * for more than 48 hours.
 *
 * Requirements:
 * - REQ-4: Offline AI processing with batch export/import
 * - Task 11.3: Stale slot cleanup job
 *
 * The job:
 * 1. Finds PENDING AI scans older than 48 hours
 * 2. Releases their reserved slots via ai-campaign.service
 * 3. Updates their aiStatus to FAILED
 */

import { getPrismaClient } from '../config/database.js';
import { releaseSlot } from '../modules/ai-campaign/ai-campaign.service.js';

/**
 * Stale threshold in hours (48 hours)
 * Configurable via environment variable
 */
const STALE_THRESHOLD_HOURS = parseInt(process.env['AI_STALE_THRESHOLD_HOURS'] || '48', 10);

/**
 * Job interval in milliseconds (6 hours)
 */
const JOB_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Timer reference for cleanup
 */
let staleCleanupTimer: NodeJS.Timeout | null = null;

/**
 * Flag to track if job is currently running
 */
let isRunning = false;

/**
 * Find and cleanup stale AI scans
 *
 * Queries for scans that have aiEnabled=true and aiStatus=PENDING
 * and have been in that state for more than 48 hours.
 * Releases their slots and updates status to FAILED.
 *
 * @returns Number of scans cleaned up
 */
async function cleanupStaleAiScans(): Promise<number> {
  const prisma = getPrismaClient();

  try {
    // Calculate cutoff date (48 hours ago)
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - STALE_THRESHOLD_HOURS);

    // Find stale AI scans in PENDING or DOWNLOADED status
    const staleScans = await prisma.scan.findMany({
      where: {
        aiEnabled: true,
        aiStatus: {
          in: ['PENDING', 'DOWNLOADED'],
        },
        createdAt: {
          lt: cutoffDate,
        },
      },
      select: {
        id: true,
        url: true,
        aiStatus: true,
        createdAt: true,
      },
    });

    if (staleScans.length === 0) {
      return 0;
    }

    console.log(`📊 AiStaleCleanup: Found ${staleScans.length} stale AI scans to cleanup`);

    let cleanedCount = 0;
    const errors: string[] = [];

    // Process each stale scan
    for (const scan of staleScans) {
      try {
        // Release the reserved slot
        const released = await releaseSlot(scan.id);

        if (released) {
          console.log(`   - Released slot for scan ${scan.id}`);
        }

        // Update scan status to FAILED
        await prisma.scan.update({
          where: { id: scan.id },
          data: {
            aiStatus: 'FAILED',
            errorMessage: `AI scan timed out after ${STALE_THRESHOLD_HOURS} hours in ${scan.aiStatus} status`,
          },
        });

        cleanedCount++;

        const age = Date.now() - scan.createdAt.getTime();
        const ageHours = Math.floor(age / (1000 * 60 * 60));
        console.log(
          `   ✅ ${scan.id} (${scan.url}) - ${scan.aiStatus} for ${ageHours}h → FAILED`
        );
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        errors.push(`${scan.id}: ${err.message}`);
        console.error(`   ❌ Failed to cleanup ${scan.id}:`, err.message);
      }
    }

    if (errors.length > 0) {
      console.warn(
        `⚠️  AiStaleCleanup: ${errors.length} scans failed to cleanup:\n` +
        errors.map((e) => `   - ${e}`).join('\n')
      );
    }

    return cleanedCount;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ AiStaleCleanup: Failed to cleanup stale scans:', err.message);
    throw err;
  }
}

/**
 * Run the stale AI cleanup job
 *
 * Finds AI scans in PENDING or DOWNLOADED status older than 48 hours,
 * releases their slots, and marks them as FAILED.
 * Prevents concurrent runs using isRunning flag.
 *
 * @returns Number of scans cleaned up
 *
 * @example
 * ```typescript
 * // Manually trigger the job
 * const cleanedCount = await runAiStaleCleanupJob();
 * console.log(`Cleaned up ${cleanedCount} stale AI scans`);
 * ```
 */
export async function runAiStaleCleanupJob(): Promise<number> {
  if (isRunning) {
    console.log('⏳ AiStaleCleanup: Job already running, skipping...');
    return 0;
  }

  isRunning = true;
  const startTime = Date.now();

  try {
    console.log('🔍 AiStaleCleanup: Starting stale AI scan cleanup...');

    // Find and cleanup stale scans
    const cleanedCount = await cleanupStaleAiScans();

    const duration = Date.now() - startTime;

    if (cleanedCount > 0) {
      console.log(
        `⚠️  AiStaleCleanup: Completed in ${duration}ms. Cleaned up ${cleanedCount} stale AI scans.`
      );
    } else {
      console.log(
        `✅ AiStaleCleanup: Completed in ${duration}ms. No stale AI scans found.`
      );
    }

    return cleanedCount;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ AiStaleCleanup: Job failed:', err.message);
    return 0;
  } finally {
    isRunning = false;
  }
}

/**
 * Start the scheduled AI stale cleanup job
 *
 * Runs immediately on start (after 30s delay), then every 6 hours.
 * Call this from the main app initialization.
 *
 * @example
 * ```typescript
 * // In index.ts or app initialization
 * import { startAiStaleCleanupScheduler } from './jobs/ai-stale-cleanup.job.js';
 *
 * // Start after server is ready
 * startAiStaleCleanupScheduler();
 * ```
 */
export function startAiStaleCleanupScheduler(): void {
  if (staleCleanupTimer) {
    console.log('⚠️  AiStaleCleanup: Scheduler already running');
    return;
  }

  console.log(
    `📅 AiStaleCleanup: Starting scheduler (interval: ${JOB_INTERVAL_MS / 1000 / 60 / 60}h, threshold: ${STALE_THRESHOLD_HOURS}h)`
  );

  // Run immediately on start (with delay to let server initialize)
  setTimeout(() => {
    void runAiStaleCleanupJob();
  }, 30000); // 30 second delay

  // Schedule recurring runs every 6 hours
  staleCleanupTimer = setInterval(() => {
    void runAiStaleCleanupJob();
  }, JOB_INTERVAL_MS);

  // Ensure timer doesn't prevent process exit
  staleCleanupTimer.unref();
}

/**
 * Stop the scheduled AI stale cleanup job
 *
 * Call this during graceful shutdown.
 *
 * @example
 * ```typescript
 * // In shutdown handler
 * import { stopAiStaleCleanupScheduler } from './jobs/ai-stale-cleanup.job.js';
 *
 * process.on('SIGTERM', () => {
 *   stopAiStaleCleanupScheduler();
 *   process.exit(0);
 * });
 * ```
 */
export function stopAiStaleCleanupScheduler(): void {
  if (staleCleanupTimer) {
    clearInterval(staleCleanupTimer);
    staleCleanupTimer = null;
    console.log('🛑 AiStaleCleanup: Scheduler stopped');
  }
}

/**
 * Get AI stale cleanup job status
 *
 * @returns Status object with scheduler and job state
 *
 * @example
 * ```typescript
 * const status = getAiStaleCleanupJobStatus();
 * console.log(`Scheduler running: ${status.schedulerRunning}`);
 * console.log(`Job running: ${status.jobRunning}`);
 * console.log(`Stale threshold: ${status.staleThresholdHours} hours`);
 * ```
 */
export function getAiStaleCleanupJobStatus(): {
  schedulerRunning: boolean;
  jobRunning: boolean;
  staleThresholdHours: number;
  intervalHours: number;
} {
  return {
    schedulerRunning: staleCleanupTimer !== null,
    jobRunning: isRunning,
    staleThresholdHours: STALE_THRESHOLD_HOURS,
    intervalHours: JOB_INTERVAL_MS / 1000 / 60 / 60,
  };
}

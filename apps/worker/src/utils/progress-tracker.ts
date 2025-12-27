import { getRedisClient } from '../config/redis.js';

/**
 * Progress Tracker for Scan Jobs
 *
 * Tracks real-time scan progress using Redis for fast updates.
 * Frontend can poll GET /api/scans/:id/progress for updates.
 */

/**
 * Scan stage enumeration
 */
export enum ScanStage {
  QUEUED = 'QUEUED',
  STARTING = 'STARTING',
  NAVIGATING = 'NAVIGATING',
  ANALYZING = 'ANALYZING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

/**
 * Progress percentage for each stage
 */
export const STAGE_PROGRESS: Record<ScanStage, number> = {
  [ScanStage.QUEUED]: 0,
  [ScanStage.STARTING]: 10,
  [ScanStage.NAVIGATING]: 30,
  [ScanStage.ANALYZING]: 60,
  [ScanStage.PROCESSING]: 85,
  [ScanStage.COMPLETED]: 100,
  [ScanStage.FAILED]: -1,
};

/**
 * Average duration for each stage (in milliseconds)
 * Used for time remaining estimation
 */
const STAGE_DURATION: Record<ScanStage, number> = {
  [ScanStage.QUEUED]: 0,
  [ScanStage.STARTING]: 2000,
  [ScanStage.NAVIGATING]: 8000,
  [ScanStage.ANALYZING]: 12000,
  [ScanStage.PROCESSING]: 3000,
  [ScanStage.COMPLETED]: 0,
  [ScanStage.FAILED]: 0,
};

/**
 * Progress data stored in Redis
 */
export interface ProgressData {
  scanId: string;
  stage: ScanStage;
  progress: number;
  message?: string;
  estimatedTimeRemaining?: number;
  error?: string;
  updatedAt: number;
}

/**
 * Generate Redis key for scan progress
 */
function getProgressKey(scanId: string): string {
  return `scan:progress:${scanId}`;
}

/**
 * Update scan progress in Redis
 *
 * @param scanId - Scan ID
 * @param stage - Current scan stage
 * @param options - Optional message, error, and time estimation
 */
export async function updateScanProgress(
  scanId: string,
  stage: ScanStage,
  options: {
    message?: string;
    error?: string;
    estimatedTimeRemaining?: number;
  } = {}
): Promise<void> {
  const redis = getRedisClient();
  const key = getProgressKey(scanId);

  const progressData: ProgressData = {
    scanId,
    stage,
    progress: STAGE_PROGRESS[stage],
    message: options.message,
    estimatedTimeRemaining: options.estimatedTimeRemaining,
    error: options.error,
    updatedAt: Date.now(),
  };

  // Store in Redis with 1 hour TTL
  await redis.setex(key, 3600, JSON.stringify(progressData));
}

/**
 * Get scan progress from Redis
 *
 * @param scanId - Scan ID
 * @returns Progress data or null if not found
 */
export async function getScanProgress(
  scanId: string
): Promise<ProgressData | null> {
  const redis = getRedisClient();
  const key = getProgressKey(scanId);

  const data = await redis.get(key);
  if (!data) {
    return null;
  }

  return JSON.parse(data) as ProgressData;
}

/**
 * Delete scan progress from Redis
 *
 * Called after scan completes to clean up
 *
 * @param scanId - Scan ID
 */
export async function deleteScanProgress(scanId: string): Promise<void> {
  const redis = getRedisClient();
  const key = getProgressKey(scanId);
  await redis.del(key);
}

/**
 * Calculate estimated time remaining based on current stage
 *
 * @param currentStage - Current scan stage
 * @returns Estimated time remaining in milliseconds
 */
export function calculateEstimatedTimeRemaining(
  currentStage: ScanStage
): number {
  // Sum up duration of remaining stages
  let timeRemaining = 0;
  let counting = false;

  const stages: ScanStage[] = [
    ScanStage.STARTING,
    ScanStage.NAVIGATING,
    ScanStage.ANALYZING,
    ScanStage.PROCESSING,
  ];

  for (const stage of stages) {
    if (stage === currentStage) {
      counting = true;
      // Add remaining time for current stage (assume 50% done)
      timeRemaining += STAGE_DURATION[stage] * 0.5;
    } else if (counting) {
      // Add full time for upcoming stages
      timeRemaining += STAGE_DURATION[stage];
    }
  }

  return Math.round(timeRemaining);
}

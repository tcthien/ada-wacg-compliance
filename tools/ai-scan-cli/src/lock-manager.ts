import { readFile, unlink, writeFile } from 'fs/promises';
import { hostname } from 'os';

/**
 * Information about the process holding a lock
 */
export interface LockInfo {
  /** Process ID that holds the lock */
  pid: number;
  /** ISO timestamp when lock was acquired */
  startedAt: string;
  /** Machine hostname where lock was acquired */
  hostname: string;
}

/**
 * Manages file-based locks to prevent concurrent execution
 *
 * The LockManager provides functionality to acquire and release exclusive locks
 * using atomic file creation. This prevents race conditions when multiple
 * processes try to execute in the same directory simultaneously.
 *
 * Lock files contain information about the process holding the lock,
 * including PID, hostname, and acquisition timestamp.
 *
 * @example
 * const manager = new LockManager('.ai-scan.lock');
 * const acquired = await manager.acquireLock();
 * if (!acquired) {
 *   console.log('Another instance is running');
 *   process.exit(1);
 * }
 * try {
 *   // ... perform work ...
 * } finally {
 *   await manager.releaseLock();
 * }
 */
export class LockManager {
  private lockFilePath: string;

  /**
   * Creates a new LockManager instance
   *
   * @param lockFilePath - Path to the lock file
   *
   * @example
   * const manager = new LockManager('.ai-scan.lock');
   */
  constructor(lockFilePath: string) {
    this.lockFilePath = lockFilePath;
  }

  /**
   * Checks if a process with the given PID is currently running
   *
   * Uses process.kill(pid, 0) as a zero-signal test to check process existence.
   * This doesn't actually send a signal but checks if the process exists and
   * we have permission to send signals to it.
   *
   * @param pid - Process ID to check
   * @returns true if process is running, false otherwise
   *
   * @example
   * if (this.isProcessRunning(12345)) {
   *   console.log('Process 12345 is running');
   * }
   */
  private isProcessRunning(pid: number): boolean {
    try {
      // Send signal 0 - doesn't actually send a signal, just checks if process exists
      process.kill(pid, 0);
      return true;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      // ESRCH: No such process - process doesn't exist
      if (err.code === 'ESRCH') {
        return false;
      }
      // EPERM: Operation not permitted - process exists but we can't signal it
      if (err.code === 'EPERM') {
        return true;
      }
      // For any other error, assume process doesn't exist
      return false;
    }
  }

  /**
   * Checks if a lock is stale (orphaned from a dead process)
   *
   * A lock is considered stale if:
   * 1. The process that created it is no longer running, OR
   * 2. The lock is older than 24 hours (fallback for zombie processes)
   *
   * @param lockInfo - Lock information to check
   * @returns true if lock is stale, false if it's still active
   *
   * @example
   * const lockInfo = await manager.readLockInfo();
   * if (lockInfo && this.isLockStale(lockInfo)) {
   *   console.log('Stale lock detected, will remove it');
   * }
   */
  private isLockStale(lockInfo: LockInfo): boolean {
    // Check if the process is still running
    if (!this.isProcessRunning(lockInfo.pid)) {
      return true;
    }

    // Check if lock is older than 24 hours (fallback for zombie processes)
    const lockAge = Date.now() - new Date(lockInfo.startedAt).getTime();
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
    if (lockAge > TWENTY_FOUR_HOURS_MS) {
      return true;
    }

    return false;
  }

  /**
   * Attempts to acquire an exclusive lock
   *
   * Uses exclusive file creation (flag 'wx') to prevent race conditions.
   * If the lock file already exists, checks if it's stale (orphaned).
   * Stale locks are automatically removed and acquisition is retried.
   *
   * @returns true if lock was acquired, false if an active lock exists
   *
   * @example
   * const acquired = await manager.acquireLock();
   * if (!acquired) {
   *   const lockInfo = await manager.readLockInfo();
   *   console.log(`Lock held by PID ${lockInfo?.pid}`);
   * }
   */
  async acquireLock(): Promise<boolean> {
    const lockInfo: LockInfo = {
      pid: process.pid,
      startedAt: new Date().toISOString(),
      hostname: hostname(),
    };

    try {
      // Use 'wx' flag for exclusive creation - fails if file exists
      await writeFile(this.lockFilePath, JSON.stringify(lockInfo, null, 2), {
        encoding: 'utf-8',
        flag: 'wx',
      });
      return true;
    } catch (error) {
      // EEXIST means lock file already exists - check if it's stale
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        // Read existing lock information
        const existingLock = await this.readLockInfo();

        // If we can read the lock and it's stale, remove it and try again
        if (existingLock && this.isLockStale(existingLock)) {
          await this.releaseLock();
          // Try to acquire lock again after removing stale lock
          return this.acquireLock();
        }

        // Lock exists and is active (not stale)
        return false;
      }
      // Other errors (permissions, disk full, etc.) should propagate
      throw error;
    }
  }

  /**
   * Releases the lock by removing the lock file
   *
   * Ignores ENOENT errors if the file has already been deleted.
   *
   * @example
   * await manager.releaseLock();
   * console.log('Lock released');
   */
  async releaseLock(): Promise<void> {
    try {
      await unlink(this.lockFilePath);
    } catch (error) {
      // Ignore if file doesn't exist (already deleted)
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Reads lock information from the lock file
   *
   * @returns The lock information if file exists and is valid, null otherwise
   *
   * @example
   * const lockInfo = await manager.readLockInfo();
   * if (lockInfo) {
   *   console.log(`Lock held by PID ${lockInfo.pid} on ${lockInfo.hostname}`);
   *   console.log(`Acquired at: ${lockInfo.startedAt}`);
   * }
   */
  async readLockInfo(): Promise<LockInfo | null> {
    try {
      const content = await readFile(this.lockFilePath, 'utf-8');
      return JSON.parse(content) as LockInfo;
    } catch (error) {
      // File doesn't exist
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      // For other errors (invalid JSON, permissions, etc), also return null
      // but could log the error in a real implementation
      return null;
    }
  }

  /**
   * Gets the lock file path
   *
   * @returns The path to the lock file
   *
   * @example
   * const path = manager.getLockFilePath();
   * console.log(`Lock file location: ${path}`);
   */
  getLockFilePath(): string {
    return this.lockFilePath;
  }
}

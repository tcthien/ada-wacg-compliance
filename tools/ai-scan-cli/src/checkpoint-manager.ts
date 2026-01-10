import { readFile, unlink, writeFile, rename } from 'fs/promises';

/**
 * Represents a checkpoint for resumable scan processing
 */
export interface Checkpoint {
  /** Path to the input CSV file being processed */
  inputFile: string;
  /** Array of scan IDs that have been successfully processed */
  processedScanIds: string[];
  /** Last completed batch number (0-indexed) */
  lastBatch: number;
  /** Last completed mini-batch number within the batch (0-indexed) */
  lastMiniBatch: number;
  /** ISO timestamp when checkpoint was first created */
  startedAt: string;
  /** ISO timestamp when checkpoint was last updated */
  updatedAt: string;
}

/**
 * Default checkpoint file name
 */
const DEFAULT_CHECKPOINT_FILE = '.ai-scan-checkpoint.json';

/**
 * Manages checkpoint state for resumable scan processing
 *
 * The CheckpointManager provides functionality to track progress during
 * AI scan processing, enabling resume capability if the process is interrupted.
 * It stores which scan IDs have been processed and tracks batch/mini-batch progress.
 *
 * @example
 * const manager = new CheckpointManager('.ai-scan-checkpoint.json');
 * const checkpoint = await manager.loadCheckpoint();
 * if (checkpoint && manager.isProcessed('scan-123')) {
 *   console.log('Scan already processed, skipping');
 * }
 */
export class CheckpointManager {
  private checkpointPath: string;
  private checkpoint: Checkpoint | null = null;
  private pendingIds: string[] = [];

  /**
   * Creates a new CheckpointManager instance
   *
   * @param checkpointPath - Path to the checkpoint file (default: .ai-scan-checkpoint.json)
   */
  constructor(checkpointPath: string = DEFAULT_CHECKPOINT_FILE) {
    this.checkpointPath = checkpointPath;
  }

  /**
   * Loads checkpoint data from the JSON file
   *
   * @returns The checkpoint data if it exists and is valid, null otherwise
   *
   * @example
   * const checkpoint = await manager.loadCheckpoint();
   * if (checkpoint) {
   *   console.log(`Resuming from batch ${checkpoint.lastBatch}`);
   * }
   */
  async loadCheckpoint(): Promise<Checkpoint | null> {
    try {
      const content = await readFile(this.checkpointPath, 'utf-8');
      this.checkpoint = JSON.parse(content) as Checkpoint;
      return this.checkpoint;
    } catch (error) {
      // File doesn't exist or is invalid - return null
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.checkpoint = null;
        return null;
      }
      // For other errors (invalid JSON, permissions, etc), also return null
      // but could log the error in a real implementation
      this.checkpoint = null;
      return null;
    }
  }

  /**
   * Deletes the checkpoint file
   *
   * This is typically called when processing completes successfully
   * or when the user explicitly requests a fresh start.
   *
   * @example
   * await manager.clearCheckpoint();
   * console.log('Checkpoint cleared, starting fresh');
   */
  async clearCheckpoint(): Promise<void> {
    try {
      await unlink(this.checkpointPath);
      this.checkpoint = null;
    } catch (error) {
      // Ignore errors if file doesn't exist
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Checks if a scan ID has already been processed
   *
   * @param scanId - The scan ID to check
   * @returns true if the scan ID is in the processed list, false otherwise
   *
   * @example
   * if (manager.isProcessed('scan-123')) {
   *   console.log('Already processed, skipping');
   * } else {
   *   await processScan('scan-123');
   * }
   */
  isProcessed(scanId: string): boolean {
    if (!this.checkpoint) {
      return false;
    }
    return this.checkpoint.processedScanIds.includes(scanId);
  }

  /**
   * Saves checkpoint data to disk using atomic write operation
   *
   * Performs an atomic write by first writing to a temporary file,
   * then renaming it to the target path. This ensures checkpoint integrity
   * even if the process crashes during the write operation.
   *
   * @param checkpoint - The checkpoint data to save
   *
   * @example
   * const checkpoint = manager.initCheckpoint('scans.csv');
   * await manager.saveCheckpoint(checkpoint);
   */
  async saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
    // Update timestamp before saving
    checkpoint.updatedAt = new Date().toISOString();

    const tempPath = `${this.checkpointPath}.tmp`;
    const content = JSON.stringify(checkpoint, null, 2);

    // Atomic write: write to temp file first, then rename
    await writeFile(tempPath, content, 'utf-8');
    await rename(tempPath, this.checkpointPath);

    // Update in-memory checkpoint
    this.checkpoint = checkpoint;
  }

  /**
   * Buffers scan IDs to be marked as processed
   *
   * This method adds scan IDs to an internal buffer without immediately
   * writing to disk. Call flush() to persist buffered changes.
   * This approach improves performance by batching disk writes.
   *
   * @param scanIds - Array of scan IDs to mark as processed
   *
   * @example
   * manager.markProcessed(['scan-1', 'scan-2', 'scan-3']);
   * // ... process more scans ...
   * await manager.flush(); // Write all buffered IDs to disk
   */
  markProcessed(scanIds: string[]): void {
    this.pendingIds.push(...scanIds);
  }

  /**
   * Writes buffered changes to disk
   *
   * Persists all scan IDs added via markProcessed() to the checkpoint file.
   * Updates batch/mini-batch tracking if the checkpoint is available.
   * Clears the pending buffer after successful write.
   *
   * @example
   * manager.markProcessed(['scan-1', 'scan-2']);
   * await manager.flush(); // Writes to disk
   * // pendingIds buffer is now empty
   */
  async flush(): Promise<void> {
    if (this.pendingIds.length === 0) {
      return;
    }

    if (!this.checkpoint) {
      throw new Error('Cannot flush: no checkpoint loaded. Call loadCheckpoint() or initCheckpoint() first.');
    }

    // Add pending IDs to checkpoint
    this.checkpoint.processedScanIds.push(...this.pendingIds);

    // Save to disk
    await this.saveCheckpoint(this.checkpoint);

    // Clear pending buffer after successful write
    this.pendingIds = [];
  }

  /**
   * Initializes a new checkpoint object
   *
   * Creates a new checkpoint with initial values for starting a fresh
   * scan processing session. All timestamps are set to the current time,
   * and tracking arrays are empty.
   *
   * @param inputFile - Path to the input CSV file being processed
   * @returns A new Checkpoint object with initial values
   *
   * @example
   * const checkpoint = manager.initCheckpoint('ai-pending-scans.csv');
   * await manager.saveCheckpoint(checkpoint);
   * console.log('New checkpoint initialized');
   */
  initCheckpoint(inputFile: string): Checkpoint {
    const now = new Date().toISOString();

    return {
      inputFile,
      processedScanIds: [],
      lastBatch: 0,
      lastMiniBatch: 0,
      startedAt: now,
      updatedAt: now,
    };
  }
}

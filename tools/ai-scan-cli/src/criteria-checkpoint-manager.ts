import { mkdir, readFile, rename, writeFile, access, constants, unlink } from 'fs/promises';
import { join, dirname } from 'path';
import { AiCriteriaVerification, CriteriaCheckpoint, WcagLevel } from './types.js';

/**
 * Default checkpoint directory for storing criteria verification checkpoints
 */
const DEFAULT_CHECKPOINT_DIR = '.ai-scan-checkpoints';

/**
 * Manages checkpoint state for resumable WCAG criteria verification processing
 *
 * The CriteriaCheckpointManager provides functionality to track progress during
 * AI criteria verification processing, enabling resume capability if the process
 * is interrupted. It stores partial verifications and tracks batch progress for
 * each scan.
 *
 * ## Checkpoint File Structure
 *
 * Checkpoints are stored as JSON files in the checkpoint directory, one per scan ID.
 *
 * ```
 * {checkpointDir}/
 * ├── scan-001.json
 * ├── scan-002.json
 * └── scan-003.json
 * ```
 *
 * Each checkpoint file contains a {@link CriteriaCheckpoint} object with:
 * - `scanId`: Unique identifier for the scan
 * - `url`: The URL being scanned
 * - `wcagLevel`: WCAG conformance level (A, AA, or AAA)
 * - `totalBatches`: Total number of criteria batches to process
 * - `completedBatches`: Array of completed batch indices (0-indexed)
 * - `partialVerifications`: Accumulated verification results
 * - `issueEnhancementComplete`: Whether issue enhancement step is done
 * - `startedAt`, `updatedAt`: ISO timestamps for tracking
 * - `tokensUsed`: Cumulative token usage
 *
 * ## Atomic Write Pattern (Crash Safety)
 *
 * All checkpoint saves use an atomic write pattern to ensure data integrity:
 *
 * 1. Write data to a temporary file (`{scanId}.json.tmp`)
 * 2. Rename temp file to final path (`{scanId}.json`)
 *
 * This ensures that if a crash occurs during write, the original checkpoint
 * remains intact. The rename operation is atomic on most filesystems (POSIX),
 * meaning the checkpoint file is either fully updated or unchanged.
 *
 * ## Resume Workflow
 *
 * The typical resume workflow follows these steps:
 *
 * 1. **Check for existing checkpoint**: `getCheckpoint(scanId)`
 * 2. **If found**: Get incomplete batches via `getIncompleteBatches(checkpoint)`
 * 3. **Process remaining batches**: For each batch, call `markBatchComplete()`
 * 4. **Run issue enhancement**: Call `markIssueEnhancementComplete()` when done
 * 5. **Clean up**: Call `clearCheckpoint()` after saving results to database
 *
 * @example
 * // Basic checkpoint lifecycle
 * const manager = new CriteriaCheckpointManager();
 *
 * // Check for existing checkpoint
 * let checkpoint = await manager.getCheckpoint('scan-123');
 *
 * if (checkpoint) {
 *   console.log(`Resuming from batch ${checkpoint.completedBatches.length} of ${checkpoint.totalBatches}`);
 * } else {
 *   // Initialize new checkpoint
 *   checkpoint = manager.initCheckpoint('scan-123', 'https://example.com', 'AA', 5);
 *   await manager.saveCheckpoint(checkpoint);
 * }
 *
 * // Process incomplete batches
 * const incompleteBatches = manager.getIncompleteBatches(checkpoint);
 * for (const batchNum of incompleteBatches) {
 *   const verifications = await processBatch(batchNum);
 *   await manager.markBatchComplete('scan-123', batchNum, verifications, 1500);
 * }
 *
 * // Clean up after successful completion
 * await manager.clearCheckpoint('scan-123');
 *
 * @example
 * // Handling issue enhancement phase
 * if (!checkpoint.issueEnhancementComplete) {
 *   const enhancementResult = await enhanceIssues(checkpoint.partialVerifications);
 *   await manager.markIssueEnhancementComplete('scan-123', {
 *     aiSummary: enhancementResult.summary,
 *     aiRemediationPlan: enhancementResult.plan,
 *     aiEnhancements: enhancementResult.enhancements,
 *     tokensUsed: enhancementResult.tokens
 *   });
 * }
 */
export class CriteriaCheckpointManager {
  private checkpointDir: string;

  /**
   * Creates a new CriteriaCheckpointManager instance
   *
   * The checkpoint directory is created automatically when saving the first checkpoint.
   * Multiple managers can share the same directory safely, as each scan has its own file.
   *
   * @param checkpointDir - Path to the checkpoint directory (default: .ai-scan-checkpoints)
   *
   * @example
   * // Using default directory
   * const manager = new CriteriaCheckpointManager();
   * // Checkpoints saved to: .ai-scan-checkpoints/
   *
   * @example
   * // Custom directory
   * const manager = new CriteriaCheckpointManager('/tmp/my-checkpoints');
   * // Checkpoints saved to: /tmp/my-checkpoints/
   */
  constructor(checkpointDir: string = DEFAULT_CHECKPOINT_DIR) {
    this.checkpointDir = checkpointDir;
  }

  /**
   * Gets the file path for a scan's checkpoint
   *
   * Constructs the full path to a checkpoint file based on the scan ID.
   * The file path follows the pattern: `{checkpointDir}/{scanId}.json`
   *
   * @param scanId - The scan ID (used as the filename without extension)
   * @returns The full path to the checkpoint file
   *
   * @example
   * // Internal usage:
   * const path = this.getCheckpointPath('scan-123');
   * // path = '.ai-scan-checkpoints/scan-123.json'
   */
  private getCheckpointPath(scanId: string): string {
    return join(this.checkpointDir, `${scanId}.json`);
  }

  /**
   * Gets checkpoint data for a scan from disk
   *
   * Reads and parses the checkpoint file for the specified scan ID.
   * Returns null in the following cases:
   * - Checkpoint file does not exist (scan not started or already cleared)
   * - File contains invalid JSON (corrupted checkpoint)
   * - File is missing required fields (scanId, url, wcagLevel)
   *
   * This is typically the first method called when starting a scan to
   * determine if there's an existing checkpoint to resume from.
   *
   * @param scanId - The scan ID to get checkpoint for
   * @returns The checkpoint data if it exists and is valid, null otherwise
   *
   * @example
   * // Check for existing checkpoint before starting processing
   * const checkpoint = await manager.getCheckpoint('scan-123');
   *
   * if (checkpoint) {
   *   console.log(`Resuming scan with ${checkpoint.partialVerifications.length} verifications`);
   *   console.log(`Completed batches: ${checkpoint.completedBatches.join(', ')}`);
   *   console.log(`Tokens used so far: ${checkpoint.tokensUsed}`);
   * } else {
   *   console.log('No existing checkpoint found, starting fresh');
   * }
   */
  async getCheckpoint(scanId: string): Promise<CriteriaCheckpoint | null> {
    const checkpointPath = this.getCheckpointPath(scanId);

    try {
      // Check if file exists
      await access(checkpointPath, constants.F_OK);

      // Read and parse the checkpoint file
      const content = await readFile(checkpointPath, 'utf-8');
      const checkpoint = JSON.parse(content) as CriteriaCheckpoint;

      // Validate that it has the expected structure
      if (!checkpoint.scanId || !checkpoint.url || !checkpoint.wcagLevel) {
        return null;
      }

      return checkpoint;
    } catch (error) {
      // File doesn't exist or is invalid - return null
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      // For other errors (invalid JSON, permissions, etc), also return null
      return null;
    }
  }

  /**
   * Initializes a new checkpoint object for a scan
   *
   * Creates a new checkpoint with initial values for starting a fresh
   * criteria verification session. All timestamps are set to the current time,
   * and tracking arrays are empty.
   *
   * This method only creates the checkpoint object in memory - you must call
   * `saveCheckpoint()` to persist it to disk.
   *
   * ## Initial Checkpoint State
   *
   * - `completedBatches`: Empty array (no batches completed)
   * - `partialVerifications`: Empty array (no verifications yet)
   * - `issueEnhancementComplete`: false
   * - `startedAt` / `updatedAt`: Current ISO timestamp
   * - `tokensUsed`: 0
   *
   * @param scanId - The scan ID to create checkpoint for
   * @param url - The URL being scanned
   * @param wcagLevel - The WCAG conformance level (A, AA, or AAA)
   * @param totalBatches - Total number of criteria batches to process
   * @returns A new CriteriaCheckpoint object with initial values
   *
   * @example
   * // Initialize and immediately save a new checkpoint
   * const checkpoint = manager.initCheckpoint('scan-123', 'https://example.com', 'AA', 5);
   * await manager.saveCheckpoint(checkpoint);
   * console.log(`Started scan at ${checkpoint.startedAt}`);
   *
   * @example
   * // Initialize checkpoint for different WCAG levels
   * const checkpointA = manager.initCheckpoint('scan-001', 'https://site.com', 'A', 3);
   * const checkpointAA = manager.initCheckpoint('scan-002', 'https://site.com', 'AA', 5);
   * const checkpointAAA = manager.initCheckpoint('scan-003', 'https://site.com', 'AAA', 8);
   */
  initCheckpoint(
    scanId: string,
    url: string,
    wcagLevel: WcagLevel,
    totalBatches: number
  ): CriteriaCheckpoint {
    const now = new Date().toISOString();

    return {
      scanId,
      url,
      wcagLevel,
      totalBatches,
      completedBatches: [],
      partialVerifications: [],
      issueEnhancementComplete: false,
      startedAt: now,
      updatedAt: now,
      tokensUsed: 0,
    };
  }

  /**
   * Saves checkpoint data to disk using atomic write operation
   *
   * Performs an atomic write by first writing to a temporary file,
   * then renaming it to the target path. This ensures checkpoint integrity
   * even if the process crashes during the write operation.
   *
   * ## Atomic Write Process
   *
   * 1. Update `updatedAt` timestamp to current time
   * 2. Create checkpoint directory if it doesn't exist
   * 3. Serialize checkpoint to JSON with pretty formatting
   * 4. Write to temporary file: `{scanId}.json.tmp`
   * 5. Atomically rename temp file to: `{scanId}.json`
   *
   * The rename operation (step 5) is atomic on POSIX filesystems, ensuring
   * the checkpoint is either fully written or unchanged if a crash occurs.
   *
   * @param checkpoint - The checkpoint data to save (mutates updatedAt field)
   *
   * @example
   * // Save initial checkpoint
   * const checkpoint = manager.initCheckpoint('scan-123', 'https://example.com', 'AA', 5);
   * await manager.saveCheckpoint(checkpoint);
   *
   * @example
   * // Update and save checkpoint with new data
   * checkpoint.completedBatches.push(0);
   * checkpoint.partialVerifications.push(...batchVerifications);
   * checkpoint.tokensUsed += 1500;
   * await manager.saveCheckpoint(checkpoint);
   * // updatedAt is automatically set to current time
   */
  async saveCheckpoint(checkpoint: CriteriaCheckpoint): Promise<void> {
    // Update timestamp before saving
    checkpoint.updatedAt = new Date().toISOString();

    const checkpointPath = this.getCheckpointPath(checkpoint.scanId);
    const tempPath = `${checkpointPath}.tmp`;

    // Ensure checkpoint directory exists
    await mkdir(dirname(checkpointPath), { recursive: true });

    const content = JSON.stringify(checkpoint, null, 2);

    // Atomic write: write to temp file first, then rename
    await writeFile(tempPath, content, 'utf-8');
    await rename(tempPath, checkpointPath);
  }

  /**
   * Marks a batch as completed and saves the verification results
   *
   * Loads the existing checkpoint, adds the batch to completedBatches,
   * appends the verifications to partialVerifications, and updates
   * the total tokens used. The checkpoint is saved atomically after
   * all updates are applied.
   *
   * This is the primary method for tracking batch progress. It should
   * be called after each batch is successfully processed by the AI.
   *
   * ## Behavior Details
   *
   * - If the batch is already marked complete, it won't be added again
   * - Completed batches are kept sorted in ascending order
   * - Verifications are appended to existing partial results
   * - Token count is accumulated (added to existing total)
   *
   * @param scanId - The scan ID to update
   * @param batchNumber - The batch number that was completed (0-indexed)
   * @param verifications - The verification results from this batch
   * @param tokensUsed - Number of tokens used for this batch
   * @throws Error if no checkpoint exists for the scan (must call initCheckpoint first)
   *
   * @example
   * // Mark single batch complete
   * await manager.markBatchComplete('scan-123', 0, batchVerifications, 1500);
   * console.log('Batch 0 marked as complete');
   *
   * @example
   * // Process all batches in sequence
   * for (let i = 0; i < checkpoint.totalBatches; i++) {
   *   if (!manager.isBatchComplete(checkpoint, i)) {
   *     const result = await processBatch(i);
   *     await manager.markBatchComplete('scan-123', i, result.verifications, result.tokens);
   *   }
   * }
   */
  async markBatchComplete(
    scanId: string,
    batchNumber: number,
    verifications: AiCriteriaVerification[],
    tokensUsed: number
  ): Promise<void> {
    const checkpoint = await this.getCheckpoint(scanId);

    if (!checkpoint) {
      throw new Error(`No checkpoint found for scan ${scanId}`);
    }

    // Add batch number to completedBatches if not already present
    if (!checkpoint.completedBatches.includes(batchNumber)) {
      checkpoint.completedBatches.push(batchNumber);
      // Keep batches sorted for consistent ordering
      checkpoint.completedBatches.sort((a, b) => a - b);
    }

    // Append verifications to partial verifications
    checkpoint.partialVerifications.push(...verifications);

    // Add tokens to total
    checkpoint.tokensUsed += tokensUsed;

    // Save the updated checkpoint
    await this.saveCheckpoint(checkpoint);
  }

  /**
   * Marks issue enhancement as complete and saves the results
   *
   * Loads the existing checkpoint, sets issueEnhancementComplete to true,
   * stores the enhancement result, and adds the tokens used. The checkpoint
   * is saved atomically after all updates are applied.
   *
   * This method should be called after all criteria batches are complete
   * and the issue enhancement phase has finished processing.
   *
   * ## Enhancement Result Structure
   *
   * The result object typically contains:
   * - `aiSummary`: High-level summary of accessibility findings
   * - `aiRemediationPlan`: Prioritized list of fixes
   * - `aiEnhancements`: Detailed enhancements for each issue
   * - `tokensUsed`: Tokens consumed by the enhancement call
   *
   * @param scanId - The scan ID to update
   * @param result - The issue enhancement result containing summary, plan, enhancements, and token count
   * @throws Error if no checkpoint exists for the scan (must call initCheckpoint first)
   *
   * @example
   * // Mark enhancement complete after processing
   * const enhancementResult = await enhanceIssues(checkpoint.partialVerifications);
   * await manager.markIssueEnhancementComplete('scan-123', {
   *   aiSummary: 'Found 5 accessibility issues affecting keyboard navigation...',
   *   aiRemediationPlan: 'Priority 1: Fix color contrast ratios (3 issues)...',
   *   aiEnhancements: enhancementResult.enhancements,
   *   tokensUsed: 2000
   * });
   *
   * @example
   * // Check enhancement status before processing
   * const checkpoint = await manager.getCheckpoint('scan-123');
   * if (checkpoint && !checkpoint.issueEnhancementComplete) {
   *   // Run enhancement and mark complete
   * }
   */
  async markIssueEnhancementComplete(
    scanId: string,
    result: CriteriaCheckpoint['issueEnhancementResult']
  ): Promise<void> {
    const checkpoint = await this.getCheckpoint(scanId);

    if (!checkpoint) {
      throw new Error(`No checkpoint found for scan ${scanId}`);
    }

    // Mark enhancement as complete
    checkpoint.issueEnhancementComplete = true;

    // Store the enhancement result
    checkpoint.issueEnhancementResult = result;

    // Add tokens from enhancement to total (if result has tokensUsed)
    if (result?.tokensUsed) {
      checkpoint.tokensUsed += result.tokensUsed;
    }

    // Save the updated checkpoint
    await this.saveCheckpoint(checkpoint);
  }

  /**
   * Deletes the checkpoint file for a scan after successful completion
   *
   * Used to clean up checkpoint data once processing is fully complete
   * and results have been saved elsewhere (e.g., to a database).
   *
   * This method is idempotent - it handles the case where the file
   * doesn't exist gracefully, making it safe to call multiple times.
   *
   * ## When to Call
   *
   * Call this method only after:
   * 1. All criteria batches have been processed
   * 2. Issue enhancement is complete
   * 3. Results have been successfully persisted to the database
   *
   * If the save-to-database step fails, do NOT call this method,
   * as the checkpoint enables resuming the scan later.
   *
   * @param scanId - The scan ID whose checkpoint should be deleted
   *
   * @example
   * // Complete workflow with cleanup
   * try {
   *   await saveResultsToDatabase(checkpoint.partialVerifications);
   *   await manager.clearCheckpoint('scan-123');
   *   console.log('Checkpoint cleaned up successfully');
   * } catch (error) {
   *   console.error('Failed to save, keeping checkpoint for retry');
   * }
   *
   * @example
   * // Safe to call even if checkpoint doesn't exist
   * await manager.clearCheckpoint('non-existent-scan'); // No error thrown
   */
  async clearCheckpoint(scanId: string): Promise<void> {
    const checkpointPath = this.getCheckpointPath(scanId);

    try {
      await unlink(checkpointPath);
    } catch (error) {
      // File not found is not an error - checkpoint may have already been cleared
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Gets the list of incomplete batch numbers for resuming
   *
   * Generates an array of all batch numbers from 0 to totalBatches-1,
   * then filters out the ones that have already been completed.
   * Returns the remaining batch numbers that need to be processed.
   *
   * This method is essential for resume workflows - it tells you exactly
   * which batches still need processing after a restart.
   *
   * ## Algorithm
   *
   * 1. Generate all batch indices: [0, 1, 2, ..., totalBatches-1]
   * 2. Create a Set from completedBatches for O(1) lookups
   * 3. Filter out completed batches
   * 4. Return remaining batches in ascending order
   *
   * @param checkpoint - The checkpoint to check for incomplete batches
   * @returns Array of incomplete batch numbers (0-indexed), sorted ascending
   *
   * @example
   * // Get batches remaining after resuming
   * const checkpoint = await manager.getCheckpoint('scan-123');
   * if (checkpoint) {
   *   const incomplete = manager.getIncompleteBatches(checkpoint);
   *   console.log(`Batches remaining: ${incomplete.length} of ${checkpoint.totalBatches}`);
   *   console.log(`Batches to process: [${incomplete.join(', ')}]`);
   *   // If totalBatches=5 and completedBatches=[0,1,3], returns [2,4]
   * }
   *
   * @example
   * // Use in resume loop
   * const incompleteBatches = manager.getIncompleteBatches(checkpoint);
   * for (const batchNum of incompleteBatches) {
   *   const result = await processBatch(batchNum);
   *   await manager.markBatchComplete(scanId, batchNum, result.verifications, result.tokens);
   * }
   */
  getIncompleteBatches(checkpoint: CriteriaCheckpoint): number[] {
    // Generate array of all batch numbers [0, 1, 2, ..., totalBatches-1]
    const allBatches = Array.from({ length: checkpoint.totalBatches }, (_, i) => i);

    // Filter out completed batches
    const completedSet = new Set(checkpoint.completedBatches);
    return allBatches.filter((batchNum) => !completedSet.has(batchNum));
  }

  /**
   * Checks if a specific batch has been completed
   *
   * Simple lookup to determine if a batch number exists in the
   * completedBatches array of the checkpoint. This is a convenience
   * method for checking individual batches without iterating.
   *
   * For checking multiple batches at once, prefer `getIncompleteBatches()`
   * which is more efficient for that use case.
   *
   * @param checkpoint - The checkpoint to check
   * @param batchNumber - The batch number to check (0-indexed)
   * @returns true if the batch is complete, false otherwise
   *
   * @example
   * // Check specific batch status
   * const checkpoint = await manager.getCheckpoint('scan-123');
   * if (checkpoint) {
   *   for (let i = 0; i < checkpoint.totalBatches; i++) {
   *     const status = manager.isBatchComplete(checkpoint, i) ? 'done' : 'pending';
   *     console.log(`Batch ${i}: ${status}`);
   *   }
   * }
   *
   * @example
   * // Skip already-completed batches
   * const checkpoint = await manager.getCheckpoint('scan-123');
   * if (checkpoint && !manager.isBatchComplete(checkpoint, 2)) {
   *   const result = await processBatch(2);
   *   await manager.markBatchComplete('scan-123', 2, result.verifications, result.tokens);
   * }
   */
  isBatchComplete(checkpoint: CriteriaCheckpoint, batchNumber: number): boolean {
    return checkpoint.completedBatches.includes(batchNumber);
  }
}

import type { PendingScan } from './types.js';

/**
 * Represents a mini-batch within a batch
 */
export interface MiniBatch {
  miniBatchNumber: number;
  scans: PendingScan[];
}

/**
 * Represents a batch of scans organized into mini-batches
 */
export interface Batch {
  batchNumber: number;
  scans: PendingScan[];
  miniBatches: MiniBatch[];
}

/**
 * Organizes pending scans into batches and mini-batches for efficient processing
 *
 * @param scans - Array of pending scans to organize
 * @param batchSize - Maximum number of scans per batch (default: 100)
 * @param miniBatchSize - Maximum number of scans per mini-batch (default: 5, range: 1-10)
 * @returns Array of organized batches with mini-batches
 *
 * @example
 * ```ts
 * const scans = [{ scanId: '1', url: 'https://example.com', wcagLevel: 'AA' }];
 * const batches = organizeBatches(scans, 100, 5);
 * // Returns: [{ batchNumber: 1, scans: [...], miniBatches: [...] }]
 * ```
 */
export function organizeBatches(
  scans: PendingScan[],
  batchSize: number = 100,
  miniBatchSize: number = 5
): Batch[] {
  // Handle edge case: empty array
  if (scans.length === 0) {
    return [];
  }

  // Validate and constrain miniBatchSize to range 1-10
  const constrainedMiniBatchSize = Math.max(1, Math.min(10, miniBatchSize));

  const batches: Batch[] = [];
  let batchNumber = 1;

  // Split scans into batches
  for (let i = 0; i < scans.length; i += batchSize) {
    const batchScans = scans.slice(i, i + batchSize);
    const miniBatches: MiniBatch[] = [];
    let miniBatchNumber = 1;

    // Split batch into mini-batches
    for (let j = 0; j < batchScans.length; j += constrainedMiniBatchSize) {
      const miniBatchScans = batchScans.slice(j, j + constrainedMiniBatchSize);

      miniBatches.push({
        miniBatchNumber,
        scans: miniBatchScans,
      });

      miniBatchNumber++;
    }

    batches.push({
      batchNumber,
      scans: batchScans,
      miniBatches,
    });

    batchNumber++;
  }

  return batches;
}

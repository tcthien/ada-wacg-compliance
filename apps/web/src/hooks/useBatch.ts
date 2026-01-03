import { useState, useEffect, useCallback, useRef } from 'react';
import {
  batchApi,
  BatchStatus as ApiBatchStatus,
  BatchStatusResponse,
} from '@/lib/batch-api';

interface BatchState {
  id: string;
  status: ApiBatchStatus;
  homepageUrl: string;
  wcagLevel: 'A' | 'AA' | 'AAA';
  totalUrls: number;
  completedCount: number;
  failedCount: number;
  progress: number;
  urls: BatchStatusResponse['urls'];
  createdAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
}

interface UseBatchOptions {
  pollInterval?: number; // ms, default 2000
}

/**
 * React hook for fetching and polling batch scan status
 *
 * Automatically polls the batch status endpoint at regular intervals (default: 2s)
 * until the batch reaches a terminal state (COMPLETED, FAILED, CANCELLED, or STALE).
 *
 * @param batchId - Unique batch identifier
 * @param options - Configuration options (pollInterval)
 * @returns Batch state, loading status, error, cancel function, and refetch function
 *
 * @example
 * ```tsx
 * function BatchResults({ batchId }: { batchId: string }) {
 *   const { batch, loading, error, cancel } = useBatch(batchId);
 *
 *   if (loading) return <div>Loading batch status...</div>;
 *   if (error) return <div>Error: {error}</div>;
 *   if (!batch) return <div>Batch not found</div>;
 *
 *   return (
 *     <div>
 *       <h1>Batch Progress: {batch.progress}%</h1>
 *       <p>Completed: {batch.completedCount}/{batch.totalUrls}</p>
 *       {batch.status === 'RUNNING' && (
 *         <button onClick={cancel}>Cancel Batch</button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useBatch(batchId: string, options: UseBatchOptions = {}) {
  const { pollInterval = 2000 } = options;
  const [batch, setBatch] = useState<BatchState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await batchApi.getStatus(batchId);
      setBatch({
        id: data.batchId,
        status: data.status,
        homepageUrl: data.homepageUrl,
        wcagLevel: data.wcagLevel,
        totalUrls: data.totalUrls,
        completedCount: data.completedCount,
        failedCount: data.failedCount,
        progress: data.progress ?? 0,
        urls: data.urls,
        createdAt: data.createdAt,
        completedAt: data.completedAt,
        cancelledAt: data.cancelledAt ?? null,
      });
      setError(null);

      // Stop polling if batch is in a terminal state
      const terminalStates: ApiBatchStatus[] = [
        'COMPLETED',
        'FAILED',
        'CANCELLED',
        'STALE',
      ];
      if (terminalStates.includes(data.status)) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch batch status');
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  const cancelBatch = useCallback(async () => {
    try {
      await batchApi.cancel(batchId);
      // Immediately fetch updated status after cancellation
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel batch');
      throw err; // Re-throw so caller can handle UI feedback
    }
  }, [batchId, fetchStatus]);

  useEffect(() => {
    // Initial fetch
    fetchStatus();

    // Set up polling
    intervalRef.current = setInterval(fetchStatus, pollInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchStatus, pollInterval]);

  return { batch, loading, error, cancel: cancelBatch, refetch: fetchStatus };
}

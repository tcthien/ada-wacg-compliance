import { useState, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  adminApi,
  type AdminBatchDetail,
  type AdminBatchInfo,
  type AdminBatchScan,
  type AdminTopCriticalUrl,
  type AggregateStats,
  type AdminSessionInfo,
  type BatchExportResponse,
} from '@/lib/admin-api';

/**
 * Return type for useAdminBatchDetail hook
 */
export interface UseAdminBatchDetailReturn {
  /** Full batch detail response from API */
  data: AdminBatchDetail | null;
  /** Batch core information (shortcut to data.batch) */
  batch: AdminBatchInfo | null;
  /** Individual scans in the batch (shortcut to data.scans) */
  scans: AdminBatchScan[];
  /** Aggregate statistics (shortcut to data.aggregate) */
  aggregate: AggregateStats | null;
  /** Top URLs with critical issues (shortcut to data.topCriticalUrls) */
  topCriticalUrls: AdminTopCriticalUrl[];
  /** Session info if available (shortcut to data.sessionInfo) */
  sessionInfo: AdminSessionInfo | null;
  isLoading: boolean;
  error: string | null;
  cancelBatch: () => Promise<void>;
  deleteBatch: () => Promise<void>;
  retryFailed: () => Promise<void>;
  exportBatch: (format: 'pdf' | 'json' | 'csv') => Promise<void>;
  isActionLoading: boolean;
}

/**
 * Admin batch detail hook for fetching batch information and performing actions
 * Uses admin API endpoints to manage batch scans
 *
 * @param batchId - The batch ID to fetch and manage
 * @returns Batch details and action methods
 */
export function useAdminBatchDetail(batchId: string): UseAdminBatchDetailReturn {
  const queryClient = useQueryClient();
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  // Fetch batch details using React Query
  const {
    data: apiData,
    isLoading,
    error: queryError,
  } = useQuery<AdminBatchDetail, Error>({
    queryKey: ['admin', 'batches', batchId],
    queryFn: () => adminApi.batches.get(batchId),
    enabled: !!batchId,
    refetchInterval: (query) => {
      // Auto-refresh if batch is running or pending
      const data = query.state.data;
      if (data?.batch?.status === 'RUNNING' || data?.batch?.status === 'PENDING') {
        return 5000; // Poll every 5 seconds
      }
      return false; // Don't auto-refresh for completed/failed/cancelled batches
    },
  });

  /**
   * Cancel the batch scan
   * Preserves completed scans, stops pending scans
   */
  const cancelBatch = useCallback(async () => {
    setIsActionLoading(true);
    setActionError(null);

    try {
      await adminApi.batches.cancel(batchId);

      // Invalidate and refetch batch details
      await queryClient.invalidateQueries({ queryKey: ['admin', 'batches', batchId] });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'batches'] });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to cancel batch';
      setActionError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsActionLoading(false);
    }
  }, [batchId, queryClient]);

  /**
   * Delete the batch and all associated scan data
   */
  const deleteBatch = useCallback(async () => {
    setIsActionLoading(true);
    setActionError(null);

    try {
      await adminApi.batches.delete(batchId);

      // Invalidate batch list query
      await queryClient.invalidateQueries({ queryKey: ['admin', 'batches'] });

      // Remove this batch from cache
      queryClient.removeQueries({ queryKey: ['admin', 'batches', batchId] });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete batch';
      setActionError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsActionLoading(false);
    }
  }, [batchId, queryClient]);

  /**
   * Retry all failed scans in the batch
   */
  const retryFailed = useCallback(async () => {
    setIsActionLoading(true);
    setActionError(null);

    try {
      await adminApi.batches.retry(batchId);

      // Invalidate and refetch batch details
      await queryClient.invalidateQueries({ queryKey: ['admin', 'batches', batchId] });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'batches'] });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to retry failed scans';
      setActionError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsActionLoading(false);
    }
  }, [batchId, queryClient]);

  /**
   * Download file from URL (for async exports)
   */
  const downloadFile = useCallback(async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.statusText}`);
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();

      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (err) {
      // Fallback: open in new tab
      console.warn('Direct download failed, opening in new tab:', err);
      window.open(url, '_blank');
    }
  }, []);

  /**
   * Poll for async export completion
   */
  const pollForExport = useCallback(async (format: 'pdf' | 'json'): Promise<string | null> => {
    const maxAttempts = 30;
    let attempts = 0;
    let delay = 1000;

    while (attempts < maxAttempts) {
      if (cancelledRef.current) return null;

      await new Promise(resolve => setTimeout(resolve, delay));

      if (cancelledRef.current) return null;

      try {
        const response = await adminApi.batches.getExportStatus(batchId, format);

        if (response.status === 'ready') {
          return response.url;
        }

        if (response.status === 'failed') {
          throw new Error(response.errorMessage || 'Export generation failed');
        }

        // Still generating, increase delay
        delay = Math.min(delay * 1.5, 5000);
        attempts++;
      } catch (err) {
        if (err instanceof Error && err.message.includes('Export generation failed')) {
          throw err;
        }
        attempts++;
      }
    }

    throw new Error('Export generation timed out. Please try again.');
  }, [batchId]);

  /**
   * Export batch results in the specified format
   * Uses async API for PDF/JSON, sync API for CSV
   * Downloads the file to the user's device
   */
  const exportBatch = useCallback(async (format: 'pdf' | 'json' | 'csv') => {
    cancelledRef.current = false;
    setIsActionLoading(true);
    setActionError(null);

    try {
      if (format === 'csv') {
        // CSV uses synchronous blob export
        const blob = await adminApi.batches.exportCsv(batchId);

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `batch-${batchId}-results.csv`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();

        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        // PDF and JSON use async export API
        const response = await adminApi.batches.requestExport(batchId, format);

        if (response.status === 'ready') {
          await downloadFile(response.url, `batch-${batchId}-report.${format}`);
        } else if (response.status === 'generating') {
          // Poll until ready
          const url = await pollForExport(format);
          if (url && !cancelledRef.current) {
            await downloadFile(url, `batch-${batchId}-report.${format}`);
          }
        } else if (response.status === 'failed') {
          throw new Error(response.errorMessage || 'Export generation failed');
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to export batch';
      setActionError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsActionLoading(false);
    }
  }, [batchId, downloadFile, pollForExport]);

  // Combine query error and action error
  const error = queryError?.message || actionError || null;

  return {
    data: apiData || null,
    batch: apiData?.batch || null,
    scans: apiData?.scans || [],
    aggregate: apiData?.aggregate || null,
    topCriticalUrls: apiData?.topCriticalUrls || [],
    sessionInfo: apiData?.sessionInfo || null,
    isLoading,
    error,
    cancelBatch,
    deleteBatch,
    retryFailed,
    exportBatch,
    isActionLoading,
  };
}

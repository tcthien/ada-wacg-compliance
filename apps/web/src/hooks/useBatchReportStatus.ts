'use client';

import { useState, useCallback, useEffect } from 'react';
import { getBatchExportStatus, type BatchExportResponse } from '@/lib/batch-api';

/**
 * Options for useBatchReportStatus hook
 */
interface UseBatchReportStatusOptions {
  /** Only fetch when true (default: true) */
  enabled?: boolean;
}

/**
 * Report info with URL and metadata (when report is ready)
 */
export interface BatchReportInfo {
  exists: true;
  url: string;
  reportId: string;
  expiresAt: string;
}

/**
 * Report status for both PDF and JSON formats
 */
export interface BatchReportStatus {
  pdf: BatchReportInfo | null;
  json: BatchReportInfo | null;
}

/**
 * Return type for useBatchReportStatus hook
 */
interface UseBatchReportStatusReturn {
  status: BatchReportStatus | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and cache report status for a batch scan
 *
 * Checks if PDF and JSON reports already exist for a batch.
 * Does NOT trigger report generation - only checks status.
 *
 * @param batchId - The batch ID to fetch report status for
 * @param options - Configuration options
 * @returns Report status, loading state, error state, and refetch function
 *
 * @example
 * ```tsx
 * const { status, isLoading, error, refetch } = useBatchReportStatus(batchId);
 *
 * if (isLoading) return <Spinner />;
 * if (error) return <Error message={error} />;
 * if (status?.pdf) {
 *   // PDF report exists - show download link
 * }
 * ```
 */
export function useBatchReportStatus(
  batchId: string,
  options: UseBatchReportStatusOptions = {}
): UseBatchReportStatusReturn {
  const { enabled = true } = options;
  const [status, setStatus] = useState<BatchReportStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!enabled || !batchId) return;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch both PDF and JSON status in parallel
      const [pdfResponse, jsonResponse] = await Promise.allSettled([
        getBatchExportStatus(batchId, 'pdf'),
        getBatchExportStatus(batchId, 'json'),
      ]);

      // Parse PDF response
      let pdfInfo: BatchReportInfo | null = null;
      if (pdfResponse.status === 'fulfilled') {
        const pdfData = pdfResponse.value;
        if (pdfData.status === 'ready' && pdfData.url) {
          pdfInfo = {
            exists: true,
            url: pdfData.url,
            reportId: pdfData.reportId || '',
            expiresAt: pdfData.expiresAt || '',
          };
        }
      }

      // Parse JSON response
      let jsonInfo: BatchReportInfo | null = null;
      if (jsonResponse.status === 'fulfilled') {
        const jsonData = jsonResponse.value;
        if (jsonData.status === 'ready' && jsonData.url) {
          jsonInfo = {
            exists: true,
            url: jsonData.url,
            reportId: jsonData.reportId || '',
            expiresAt: jsonData.expiresAt || '',
          };
        }
      }

      setStatus({ pdf: pdfInfo, json: jsonInfo });
    } catch (err) {
      // Don't set error for "not found" responses - that's expected
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch report status';
      if (!errorMessage.includes('not found') && !errorMessage.includes('404')) {
        setError(errorMessage);
      }
      setStatus({ pdf: null, json: null });
    } finally {
      setIsLoading(false);
    }
  }, [batchId, enabled]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return { status, isLoading, error, refetch: fetchStatus };
}

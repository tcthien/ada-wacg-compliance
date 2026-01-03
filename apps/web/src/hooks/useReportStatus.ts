import { useState, useCallback, useEffect } from 'react';
import { api, type ReportInfo } from '@/lib/api';

/**
 * Options for useReportStatus hook
 */
interface UseReportStatusOptions {
  enabled?: boolean;  // Only fetch when true (default: true)
}

/**
 * Report status for both PDF and JSON formats
 */
interface ReportStatus {
  pdf: ReportInfo | null;
  json: ReportInfo | null;
}

/**
 * Return type for useReportStatus hook
 */
interface UseReportStatusReturn {
  status: ReportStatus | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and cache report status for a scan
 *
 * @param scanId - The scan ID to fetch report status for
 * @param options - Configuration options
 * @returns Report status, loading state, error state, and refetch function
 *
 * @example
 * ```tsx
 * const { status, isLoading, error, refetch } = useReportStatus(scanId);
 *
 * if (isLoading) return <Spinner />;
 * if (error) return <Error message={error} />;
 * if (status?.pdf) {
 *   // PDF report exists
 * }
 * ```
 */
export function useReportStatus(
  scanId: string,
  options: UseReportStatusOptions = {}
): UseReportStatusReturn {
  const { enabled = true } = options;
  const [status, setStatus] = useState<ReportStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!enabled || !scanId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.scans.getReportStatus(scanId);
      setStatus(response.reports);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch report status');
    } finally {
      setIsLoading(false);
    }
  }, [scanId, enabled]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return { status, isLoading, error, refetch: fetchStatus };
}

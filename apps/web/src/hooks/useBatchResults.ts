'use client';

import { useQuery } from '@tanstack/react-query';
import {
  batchApi,
  type BatchResultsResponse,
  type BatchStatus,
  type UrlIssueSummaryDetailed,
  type BatchAggregateStats,
} from '@/lib/batch-api';

/**
 * Options for useBatchResults hook
 */
interface UseBatchResultsOptions {
  /** Only fetch when enabled is true (default: true) */
  enabled?: boolean;
  /** Polling interval in ms for in-progress batches (default: 3000) */
  pollInterval?: number;
}

/**
 * Computed aggregate statistics for completed scans only
 */
interface CompletedAggregateStats {
  totalIssues: number;
  criticalCount: number;
  seriousCount: number;
  moderateCount: number;
  minorCount: number;
  passedChecks: number;
  urlsScanned: number;
  averageIssuesPerPage: number;
}

/**
 * Return type for useBatchResults hook
 */
interface UseBatchResultsReturn {
  /** Full batch results response from API */
  results: BatchResultsResponse | null;
  /** Completed scans only (filtered by status=COMPLETED) */
  completedScans: UrlIssueSummaryDetailed[];
  /** Aggregate statistics for completed scans only */
  aggregateStats: CompletedAggregateStats | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Manual refetch function */
  refetch: () => void;
}

/**
 * Hook to fetch and manage batch scan results with partial result support
 *
 * Fetches aggregate statistics and individual URL results for a batch scan.
 * Supports partial results - returns completed scans even while the batch is still running.
 * Automatically polls for updates when batch is in progress.
 *
 * Features:
 * - Automatic polling while batch is PENDING or RUNNING
 * - Filters completed scans from partial results
 * - Calculates aggregate statistics for completed scans only
 * - React Query caching and automatic refetching
 *
 * @param batchId - The ID of the batch to fetch results for
 * @param options - Hook options (enabled, pollInterval)
 * @returns Object containing results data, completed scans, aggregate stats, loading state, and error
 *
 * @example
 * ```tsx
 * // Fetch partial results while batch is running
 * const { completedScans, aggregateStats, isLoading } = useBatchResults(batchId);
 *
 * // Display completed results even if batch is still running
 * if (completedScans.length > 0) {
 *   return (
 *     <div>
 *       <p>Completed: {completedScans.length} URLs</p>
 *       <p>Total Issues: {aggregateStats?.totalIssues}</p>
 *       <p>Average per page: {aggregateStats?.averageIssuesPerPage.toFixed(1)}</p>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Only fetch when batch is in a specific state
 * const { results, completedScans } = useBatchResults(batchId, {
 *   enabled: batch?.status !== 'PENDING',
 *   pollInterval: 2000 // Poll every 2 seconds
 * });
 *
 * // Navigate to individual scan results
 * {completedScans.map(scan => (
 *   <Link href={`/scan/${scan.id}`} key={scan.id}>
 *     {scan.url} - {scan.totalIssues} issues
 *   </Link>
 * ))}
 * ```
 */
export function useBatchResults(
  batchId: string,
  options: UseBatchResultsOptions = {}
): UseBatchResultsReturn {
  const { enabled = true, pollInterval = 3000 } = options;

  // Fetch batch results using React Query
  const {
    data: results,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery<BatchResultsResponse, Error>({
    queryKey: ['batches', batchId, 'results'],
    queryFn: () => batchApi.getResults(batchId),
    enabled: enabled && !!batchId,
    refetchInterval: (query) => {
      // Auto-refresh if batch is running or pending
      const data = query.state.data;
      const inProgressStatuses: BatchStatus[] = ['PENDING', 'RUNNING'];

      if (data?.status && inProgressStatuses.includes(data.status)) {
        return pollInterval; // Poll at specified interval
      }

      return false; // Don't auto-refresh for completed/failed/cancelled batches
    },
    // Keep previous data while refetching to prevent UI flicker
    placeholderData: (previousData) => previousData,
  });

  // Filter completed scans only
  const completedScans: UrlIssueSummaryDetailed[] = results?.urls
    ? results.urls.filter((scan) => scan.status === 'COMPLETED')
    : [];

  // Calculate aggregate statistics for completed scans only
  const aggregateStats: CompletedAggregateStats | null = completedScans.length > 0
    ? {
        totalIssues: completedScans.reduce((sum, scan) => sum + scan.totalIssues, 0),
        criticalCount: completedScans.reduce((sum, scan) => sum + scan.criticalCount, 0),
        seriousCount: completedScans.reduce((sum, scan) => sum + scan.seriousCount, 0),
        moderateCount: completedScans.reduce((sum, scan) => sum + scan.moderateCount, 0),
        minorCount: completedScans.reduce((sum, scan) => sum + scan.minorCount, 0),
        passedChecks: results?.aggregate?.passedChecks || 0,
        urlsScanned: completedScans.length,
        averageIssuesPerPage: completedScans.length > 0
          ? completedScans.reduce((sum, scan) => sum + scan.totalIssues, 0) / completedScans.length
          : 0,
      }
    : null;

  return {
    results: results || null,
    completedScans,
    aggregateStats,
    isLoading,
    error: queryError?.message || null,
    refetch: () => {
      refetch();
    },
  };
}

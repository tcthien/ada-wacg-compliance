import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  adminApi,
  AiQueueScan,
  AiQueueFilters,
  AiQueueStats,
  AiImportResult,
  AiStatus,
} from '@/lib/admin-api';

/**
 * Pagination metadata for AI queue list
 */
export interface AiQueuePaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Filter parameters for AI queue list
 */
export interface AiQueueListFilters {
  status?: AiStatus | AiStatus[];
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Return type for useAdminAiQueue hook
 */
export interface UseAdminAiQueueReturn {
  /** AI scans in the queue */
  scans: AiQueueScan[];
  /** Pagination metadata */
  pagination: AiQueuePaginationMeta;
  /** Queue statistics by status */
  stats: AiQueueStats | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message if request failed */
  error: string | null;
  /** Current filters */
  filters: AiQueueListFilters;
  /** Update filters */
  setFilters: (filters: AiQueueListFilters) => void;
  /** Manually refetch queue data */
  refetch: () => void;
  /** Export pending scans as CSV */
  exportCsv: () => Promise<void>;
  /** Whether export is in progress */
  isExporting: boolean;
  /** Import AI results from CSV file */
  importCsv: (file: File) => Promise<AiImportResult>;
  /** Whether import is in progress */
  isImporting: boolean;
  /** Last import result */
  importResult: AiImportResult | null;
  /** Retry a failed AI scan */
  retryFailedScan: (scanId: string) => Promise<void>;
  /** Whether retry is in progress */
  isRetrying: boolean;
}

/**
 * React hook for fetching and managing AI queue
 *
 * Provides queue list with filtering, CSV export/import, and retry functionality.
 *
 * @param initialFilters - Initial filter parameters (optional)
 * @returns AI queue state with filters, export/import, and retry functions
 *
 * @example
 * ```tsx
 * function AiQueueTable() {
 *   const {
 *     scans,
 *     stats,
 *     isLoading,
 *     exportCsv,
 *     importCsv,
 *     retryFailedScan,
 *   } = useAdminAiQueue();
 *
 *   const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
 *     const file = e.target.files?.[0];
 *     if (file) {
 *       const result = await importCsv(file);
 *       console.log(`Imported ${result.processed} scans`);
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={exportCsv}>Export Pending</button>
 *       <input type="file" onChange={handleFileChange} accept=".csv" />
 *       {scans.map(scan => (
 *         <div key={scan.id}>
 *           {scan.url} - {scan.aiStatus}
 *           {scan.aiStatus === 'FAILED' && (
 *             <button onClick={() => retryFailedScan(scan.id)}>Retry</button>
 *           )}
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useAdminAiQueue(initialFilters?: AiQueueListFilters): UseAdminAiQueueReturn {
  const queryClient = useQueryClient();

  // Default filter values
  const defaultFilters: AiQueueListFilters = {
    page: 1,
    pageSize: 20,
    ...initialFilters,
  };

  const [filters, setFilters] = useState<AiQueueListFilters>(defaultFilters);
  const [importResult, setImportResult] = useState<AiImportResult | null>(null);

  // Fetch AI queue list
  const {
    data: queueData,
    isLoading: isLoadingQueue,
    error: queueError,
    refetch: refetchQueue,
  } = useQuery({
    queryKey: ['admin', 'ai-queue', 'list', filters],
    queryFn: () => {
      const apiFilters: AiQueueFilters = {
        status: filters.status,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        page: filters.page,
        pageSize: filters.pageSize,
      };
      return adminApi.aiCampaign.listQueue(apiFilters);
    },
    staleTime: 15000, // 15 seconds
  });

  // Fetch queue statistics
  const { data: statsData } = useQuery({
    queryKey: ['admin', 'ai-queue', 'stats'],
    queryFn: () => adminApi.aiCampaign.getQueueStats(),
    staleTime: 30000, // 30 seconds
  });

  // Export mutation
  const exportMutation = useMutation({
    mutationFn: async () => {
      const blob = await adminApi.aiCampaign.exportPendingScans();
      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-pending-scans-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const result = await adminApi.aiCampaign.importResults(file);
      setImportResult(result);
      return result;
    },
    onSuccess: () => {
      // Refetch queue and stats after import
      queryClient.invalidateQueries({ queryKey: ['admin', 'ai-queue'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'ai-campaign'] });
    },
  });

  // Retry mutation
  const retryMutation = useMutation({
    mutationFn: (scanId: string) => adminApi.aiCampaign.retryScan(scanId),
    onSuccess: () => {
      // Refetch queue after retry
      queryClient.invalidateQueries({ queryKey: ['admin', 'ai-queue'] });
    },
  });

  const updateFilters = useCallback((newFilters: AiQueueListFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  // Calculate pagination from cursor-based response
  const pageSize = filters.pageSize || 20;
  const currentPage = filters.page || 1;
  const totalCount = queueData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    scans: queueData?.items || [],
    pagination: {
      page: currentPage,
      limit: pageSize,
      total: totalCount,
      totalPages: totalPages,
    },
    stats: statsData || null,
    isLoading: isLoadingQueue,
    error:
      queueError?.message ||
      exportMutation.error?.message ||
      importMutation.error?.message ||
      retryMutation.error?.message ||
      null,
    filters,
    setFilters: updateFilters,
    refetch: refetchQueue,
    exportCsv: exportMutation.mutateAsync,
    isExporting: exportMutation.isPending,
    importCsv: importMutation.mutateAsync,
    isImporting: importMutation.isPending,
    importResult,
    retryFailedScan: retryMutation.mutateAsync,
    isRetrying: retryMutation.isPending,
  };
}

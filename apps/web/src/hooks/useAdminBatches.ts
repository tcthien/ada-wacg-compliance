import { useState, useEffect, useCallback } from 'react';
import {
  adminApi,
  AdminBatchFilters,
  AdminBatchSummary,
  BatchStatus,
} from '@/lib/admin-api';

/**
 * Pagination metadata for batch list
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Filter parameters for batch list
 */
export interface BatchListFilters {
  status?: BatchStatus;
  sessionId?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: 'createdAt' | 'completedAt' | 'totalUrls' | 'totalIssues';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

/**
 * Return type for useAdminBatches hook
 */
export interface UseAdminBatchesReturn {
  batches: AdminBatchSummary[];
  pagination: PaginationMeta;
  isLoading: boolean;
  error: string | null;
  filters: BatchListFilters;
  setFilters: (filters: BatchListFilters) => void;
  refetch: () => void;
}

/**
 * React hook for fetching and managing admin batch list
 *
 * Provides batch list with filtering, pagination, and sorting capabilities.
 * Automatically refetches when filters change.
 *
 * @param initialFilters - Initial filter parameters (optional)
 * @returns Batch list state with filters and pagination
 *
 * @example
 * ```tsx
 * function BatchList() {
 *   const { batches, pagination, isLoading, error, filters, setFilters } = useAdminBatches({
 *     status: 'COMPLETED',
 *     page: 1,
 *     pageSize: 20,
 *   });
 *
 *   if (isLoading) return <div>Loading batches...</div>;
 *   if (error) return <div>Error: {error}</div>;
 *
 *   return (
 *     <div>
 *       {batches.map(batch => (
 *         <div key={batch.id}>{batch.homepageUrl}</div>
 *       ))}
 *       <button onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>
 *         Next Page
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useAdminBatches(initialFilters?: BatchListFilters): UseAdminBatchesReturn {
  // Default filter values
  const defaultFilters: BatchListFilters = {
    page: 1,
    pageSize: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc',
    ...initialFilters,
  };

  const [batches, setBatches] = useState<AdminBatchSummary[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: defaultFilters.page || 1,
    limit: defaultFilters.pageSize || 20,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<BatchListFilters>(defaultFilters);

  // Sync external initialFilters with internal filters state
  // This fixes the issue where the hook ignored filter changes from the parent component
  useEffect(() => {
    if (initialFilters) {
      setFilters(prev => ({
        ...prev,
        ...initialFilters,
      }));
    }
  }, [
    initialFilters?.page,
    initialFilters?.status,
    initialFilters?.startDate,
    initialFilters?.endDate,
    initialFilters?.sessionId,
    initialFilters?.sortBy,
    initialFilters?.sortOrder,
    initialFilters?.pageSize,
  ]);

  const fetchBatches = useCallback(async () => {
    setIsLoading(true);
    try {
      // Map BatchListFilters to AdminBatchFilters for API call
      const apiFilters: AdminBatchFilters = {
        status: filters.status,
        sessionId: filters.sessionId,
        startDate: filters.startDate,
        endDate: filters.endDate,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        page: filters.page,
        pageSize: filters.pageSize,
      };

      const response = await adminApi.batches.list(apiFilters);

      setBatches(response.batches);
      setPagination(response.pagination);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load batches');
      setBatches([]);
      setPagination({
        page: filters.page || 1,
        limit: filters.pageSize || 20,
        total: 0,
        totalPages: 0,
      });
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  // Fetch batches whenever filters change
  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  return {
    batches,
    pagination,
    isLoading,
    error,
    filters,
    setFilters,
    refetch: fetchBatches,
  };
}

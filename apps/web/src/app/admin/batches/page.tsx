'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { BatchFilters, BatchFilterState } from '@/components/admin/BatchFilters';
import { BatchSummaryBar } from '@/components/admin/BatchSummaryBar';
import { BatchTable } from '@/components/admin/BatchTable';
import { useAdminBatches } from '@/hooks/useAdminBatches';
import { BatchStatus } from '@/lib/admin-api';

/**
 * Admin Batch Management Page
 *
 * This page:
 * - Displays all batch scans with filters for status, date range, and homepage URL
 * - Shows summary statistics (total batches, total URLs, aggregate issue counts)
 * - Provides pagination controls (Previous/Next buttons, page info)
 * - Uses BatchFilters, BatchSummaryBar, and BatchTable components
 * - Handles loading and error states with retry functionality
 * - Allows users to reset all filters to their default values
 *
 * Requirements:
 * - REQ 1.1: Display paginated list of all batch scans sorted by creation date (newest first)
 * - REQ 1.3: Filter by Status, Date range, Homepage URL
 * - REQ 1.6: Summary bar at top showing total batches, total URLs, and aggregate issue counts
 * - REQ 1.7: If batch data fetch fails, display error message with retry button
 */
export default function AdminBatchesPage() {
  // Filter state managed locally, passed to useAdminBatches hook
  const [filterState, setFilterState] = useState<BatchFilterState>({
    status: 'ALL',
    startDate: '',
    endDate: '',
    homepageUrl: '',
  });

  // Pagination state
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Build filters object for the hook
  const filters = useMemo(() => {
    const baseFilters = {
      page,
      pageSize,
      sortBy: 'createdAt' as const,
      sortOrder: 'desc' as const,
    };

    // Add optional filters if they have values
    if (filterState.status !== 'ALL') {
      return {
        ...baseFilters,
        status: filterState.status as BatchStatus,
      };
    }

    const result: any = { ...baseFilters };
    if (filterState.startDate) result.startDate = filterState.startDate;
    if (filterState.endDate) result.endDate = filterState.endDate;
    if (filterState.homepageUrl) result.sessionId = filterState.homepageUrl;

    return result;
  }, [filterState, page, pageSize]);

  // Fetch batches using the hook
  const {
    batches,
    pagination,
    isLoading,
    error,
    refetch,
  } = useAdminBatches(filters);

  /**
   * Handle filter changes
   * Reset to page 1 when filters change
   */
  const handleFilterChange = (newFilters: BatchFilterState) => {
    setFilterState(newFilters);
    setPage(1);
  };

  /**
   * Calculate aggregate statistics from current batch list
   */
  const aggregateStats = useMemo(() => {
    return (batches || []).reduce(
      (acc, batch) => ({
        totalIssues: acc.totalIssues + batch.totalIssues,
        criticalCount: acc.criticalCount + batch.criticalCount,
        seriousCount: acc.seriousCount + batch.seriousCount,
        moderateCount: acc.moderateCount + batch.moderateCount,
        minorCount: acc.minorCount + batch.minorCount,
      }),
      {
        totalIssues: 0,
        criticalCount: 0,
        seriousCount: 0,
        moderateCount: 0,
        minorCount: 0,
      }
    );
  }, [batches]);

  /**
   * Calculate total URLs across all batches
   */
  const totalUrls = useMemo(() => {
    return (batches || []).reduce((sum, batch) => sum + batch.totalUrls, 0);
  }, [batches]);

  /**
   * Handle retry after error
   */
  const handleRetry = () => {
    refetch();
  };

  /**
   * Calculate total pages
   */
  const totalPages = pagination.totalPages;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Batch Scans</h1>
        <p className="mt-1 text-sm text-gray-600">
          View and manage all batch accessibility scans
        </p>
      </div>

      {/* Filter controls */}
      <BatchFilters filters={filterState} onChange={handleFilterChange} />

      {/* Summary bar */}
      <BatchSummaryBar
        totalBatches={pagination.total}
        totalUrls={totalUrls}
        aggregateIssues={aggregateStats}
        loading={isLoading}
      />

      {/* Error state with retry button (REQ 1.7) */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-red-800">Failed to load batches</h3>
              <p className="mt-1 text-sm text-red-700">
                {error}. Please try again.
              </p>
              <div className="mt-3">
                <button
                  onClick={handleRetry}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Batch table */}
      <BatchTable batches={batches || []} loading={isLoading} />

      {/* Pagination controls */}
      {!isLoading && pagination.total > 0 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border border-gray-200 rounded-lg shadow-sm">
          {/* Mobile view - simplified */}
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>

          {/* Desktop view - full pagination */}
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing{' '}
                <span className="font-medium">{(page - 1) * pageSize + 1}</span>{' '}
                to{' '}
                <span className="font-medium">
                  {Math.min(page * pageSize, pagination.total)}
                </span>{' '}
                of <span className="font-medium">{pagination.total}</span> results
              </p>
            </div>
            <div>
              <nav
                className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
                aria-label="Pagination"
              >
                {/* Previous button */}
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Previous</span>
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>

                {/* Page info */}
                <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                  Page {page} of {totalPages}
                </span>

                {/* Next button */}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Next</span>
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* No results message */}
      {!isLoading && pagination.total === 0 && !error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-yellow-400"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                No batches found
              </h3>
              <p className="mt-1 text-sm text-yellow-700">
                {filterState.status !== 'ALL' ||
                filterState.startDate ||
                filterState.endDate ||
                filterState.homepageUrl
                  ? 'Try adjusting your filters to see more results.'
                  : 'No batch scans have been created yet.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

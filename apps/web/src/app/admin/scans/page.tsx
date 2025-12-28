'use client';

import { useEffect, useState } from 'react';
import { ScanTable } from '@/components/admin/ScanTable';
import { adminApi, type ScanFilters } from '@/lib/admin-api';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

/**
 * Admin Scans List Page
 *
 * This page:
 * - Displays all scans with filters for status, date range, and customer email
 * - Provides pagination controls (Previous/Next buttons, page info)
 * - Uses the ScanTable component for display with sorting
 * - Handles delete and retry actions with API calls and refetch
 * - Shows loading and error states
 * - Allows users to reset all filters to their default values
 *
 * Requirements:
 * - REQ 3.1: Return all scans with pagination (default 20 per page)
 * - REQ 3.2: Filter by status (PENDING, RUNNING, COMPLETED, FAILED)
 * - REQ 3.3: Filter by date range
 * - REQ 3.4: Filter by customer email
 * - REQ 7.3: Display data in responsive tables with sorting, filtering, and pagination controls
 */
export default function AdminScansPage() {
  // Filter state
  const [status, setStatus] = useState<ScanFilters['status'] | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [email, setEmail] = useState('');

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  // Data state
  const [scans, setScans] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch scans data from API
   */
  const fetchScans = async () => {
    try {
      setLoading(true);
      setError(null);

      const filters: ScanFilters = {
        page,
        pageSize,
      };

      if (status) filters.status = status;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      if (email) filters.userEmail = email;

      const response = await adminApi.scans.list(filters);
      // Transform to add userEmail for backward compatibility with ScanTable
      const scansWithUserEmail = (response.items || []).map(scan => ({
        ...scan,
        userEmail: scan.email, // Map email to userEmail for ScanTable
      }));
      setScans(scansWithUserEmail);
      setTotal(response.pagination?.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch scans');
      console.error('Failed to fetch scans:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch scans when filters or page changes
   */
  useEffect(() => {
    fetchScans();
  }, [status, startDate, endDate, email, page]);

  /**
   * Reset all filters to default values
   */
  const handleResetFilters = () => {
    setStatus('');
    setStartDate('');
    setEndDate('');
    setEmail('');
    setPage(1);
  };

  /**
   * Handle delete scan action
   */
  const handleDelete = async (scanId: string) => {
    if (!confirm('Are you sure you want to delete this scan?')) {
      return;
    }

    try {
      await adminApi.scans.delete(scanId);
      // Refetch scans after deletion
      fetchScans();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete scan');
      console.error('Failed to delete scan:', err);
    }
  };

  /**
   * Handle retry scan action
   */
  const handleRetry = async (scanId: string) => {
    try {
      await adminApi.scans.retry(scanId);
      // Refetch scans after retry
      fetchScans();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to retry scan');
      console.error('Failed to retry scan:', err);
    }
  };

  /**
   * Calculate total pages
   */
  const totalPages = Math.ceil(total / pageSize);

  /**
   * Check if filters are active
   */
  const hasActiveFilters = status || startDate || endDate || email;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Scans</h1>
        <p className="mt-1 text-sm text-gray-600">
          View and manage all accessibility scans
        </p>
      </div>

      {/* Filter bar */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Status filter */}
          <div>
            <label
              htmlFor="status-filter"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Status
            </label>
            <select
              id="status-filter"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as ScanFilters['status'] | '');
                setPage(1); // Reset to first page when filter changes
              }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="RUNNING">Running</option>
              <option value="COMPLETED">Completed</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>

          {/* Start date filter */}
          <div>
            <label
              htmlFor="start-date-filter"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Start Date
            </label>
            <input
              type="date"
              id="start-date-filter"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* End date filter */}
          <div>
            <label
              htmlFor="end-date-filter"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              End Date
            </label>
            <input
              type="date"
              id="end-date-filter"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Email search filter */}
          <div>
            <label
              htmlFor="email-filter"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Customer Email
            </label>
            <input
              type="text"
              id="email-filter"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setPage(1);
              }}
              placeholder="Search by email..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Reset filters button */}
        {hasActiveFilters && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <X className="h-4 w-4" />
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading scans</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Scans table */}
      <ScanTable
        scans={scans}
        loading={loading}
        onDelete={handleDelete}
        onRetry={handleRetry}
      />

      {/* Pagination controls */}
      {!loading && total > 0 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border border-gray-200 rounded-lg shadow-sm">
          {/* Results info */}
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
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing{' '}
                <span className="font-medium">{(page - 1) * pageSize + 1}</span>{' '}
                to{' '}
                <span className="font-medium">
                  {Math.min(page * pageSize, total)}
                </span>{' '}
                of <span className="font-medium">{total}</span> results
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
      {!loading && total === 0 && hasActiveFilters && (
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
                No scans found
              </h3>
              <p className="mt-1 text-sm text-yellow-700">
                Try adjusting your filters or reset them to see all scans.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

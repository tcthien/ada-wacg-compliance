'use client';

import { useEffect, useState } from 'react';
import { AuditLogTable } from '@/components/admin/AuditLogTable';
import { adminApi, type AuditFilters } from '@/lib/admin-api';
import { ChevronLeft, ChevronRight, X, Download } from 'lucide-react';

/**
 * Admin Audit Log Page
 *
 * This page:
 * - Displays all audit log entries with filtering and pagination
 * - Provides filters for date range, admin email/ID, and action type dropdown
 * - Includes export functionality for CSV and JSON formats
 * - Uses AuditLogTable component for display with sorting
 * - Provides pagination controls (Previous/Next buttons, page info)
 * - Shows loading and error states
 * - Allows users to reset all filters to their default values
 *
 * Requirements:
 * - REQ 6.2: Return logs with pagination and filtering by date range, admin, and action type
 * - REQ 6.3: Export audit logs in JSON or CSV format
 * - REQ 7.3: Display data in responsive tables with sorting, filtering, and pagination controls
 */
export default function AdminAuditPage() {
  // Filter state
  const [adminEmail, setAdminEmail] = useState('');
  const [action, setAction] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  // Data state
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Export state
  const [exporting, setExporting] = useState(false);

  /**
   * Fetch audit logs data from API
   */
  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const filters: AuditFilters = {
        page,
        pageSize,
      };

      if (adminEmail) filters.adminEmail = adminEmail;
      if (action) filters.action = action;
      if (resourceType) filters.resourceType = resourceType;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;

      const response = await adminApi.audit.list(filters);
      setLogs(response.items || []);
      setTotal(response.pagination?.totalCount || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch audit logs');
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch logs when filters or page changes
   */
  useEffect(() => {
    fetchLogs();
  }, [adminEmail, action, resourceType, startDate, endDate, page]);

  /**
   * Reset all filters to default values
   */
  const handleResetFilters = () => {
    setAdminEmail('');
    setAction('');
    setResourceType('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  /**
   * Handle export action
   */
  const handleExport = async (format: 'csv' | 'json') => {
    try {
      setExporting(true);

      // Build filters for export
      const filters: AuditFilters = {};
      if (adminEmail) filters.adminEmail = adminEmail;
      if (action) filters.action = action;
      if (resourceType) filters.resourceType = resourceType;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;

      const blob = await adminApi.audit.export(filters);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Determine file extension based on format
      const extension = format === 'json' ? 'json' : 'csv';
      link.download = `audit-logs-${new Date().toISOString().split('T')[0]}.${extension}`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to export audit logs');
      console.error('Failed to export audit logs:', err);
    } finally {
      setExporting(false);
    }
  };

  /**
   * Calculate total pages
   */
  const totalPages = Math.ceil(total / pageSize);

  /**
   * Check if filters are active
   */
  const hasActiveFilters = adminEmail || action || resourceType || startDate || endDate;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
          <p className="mt-1 text-sm text-gray-600">
            View administrative action history and security events
          </p>
        </div>

        {/* Export buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting || logs.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            onClick={() => handleExport('json')}
            disabled={exporting || logs.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4" />
            Export JSON
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Admin email filter */}
          <div>
            <label
              htmlFor="admin-email-filter"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Admin Email
            </label>
            <input
              type="text"
              id="admin-email-filter"
              value={adminEmail}
              onChange={(e) => {
                setAdminEmail(e.target.value);
                setPage(1);
              }}
              placeholder="Search by email..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Action type dropdown */}
          <div>
            <label
              htmlFor="action-filter"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Action Type
            </label>
            <select
              id="action-filter"
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Actions</option>
              <option value="login">Login</option>
              <option value="logout">Logout</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
              <option value="export">Export</option>
            </select>
          </div>

          {/* Resource type filter */}
          <div>
            <label
              htmlFor="resource-type-filter"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Resource Type
            </label>
            <select
              id="resource-type-filter"
              value={resourceType}
              onChange={(e) => {
                setResourceType(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Resources</option>
              <option value="admin">Admin</option>
              <option value="scan">Scan</option>
              <option value="customer">Customer</option>
              <option value="system">System</option>
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
              <h3 className="text-sm font-medium text-red-800">Error loading audit logs</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Audit logs table */}
      <AuditLogTable
        logs={logs}
        loading={loading}
      />

      {/* Pagination controls */}
      {!loading && total > 0 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border border-gray-200 rounded-lg shadow-sm">
          {/* Mobile pagination */}
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

          {/* Desktop pagination */}
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
                No audit logs found
              </h3>
              <p className="mt-1 text-sm text-yellow-700">
                Try adjusting your filters or reset them to see all audit logs.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

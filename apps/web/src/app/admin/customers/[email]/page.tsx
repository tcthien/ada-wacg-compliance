'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { adminApi, type Customer, type Scan } from '@/lib/admin-api';
import { ArrowLeft, ChevronLeft, ChevronRight, Calendar, Activity } from 'lucide-react';

/**
 * Status badge component
 */
function StatusBadge({ status }: { status: Scan['status'] }) {
  const statusConfig = {
    PENDING: {
      label: 'Pending',
      className: 'bg-gray-100 text-gray-800',
    },
    RUNNING: {
      label: 'Running',
      className: 'bg-blue-100 text-blue-800',
    },
    COMPLETED: {
      label: 'Completed',
      className: 'bg-green-100 text-green-800',
    },
    FAILED: {
      label: 'Failed',
      className: 'bg-red-100 text-red-800',
    },
  } as const;

  const config = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}

/**
 * Skeleton row for loading state
 */
function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="h-6 w-20 bg-gray-200 rounded"></div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="h-4 w-32 bg-gray-200 rounded"></div>
      </td>
      <td className="px-6 py-4">
        <div className="h-4 w-64 bg-gray-200 rounded"></div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="h-4 w-16 bg-gray-200 rounded"></div>
      </td>
    </tr>
  );
}

/**
 * Empty state component
 */
function EmptyState() {
  return (
    <tr>
      <td colSpan={4} className="px-6 py-12 text-center">
        <div className="flex flex-col items-center justify-center">
          <div className="text-gray-400 mb-2">
            <svg
              className="h-12 w-12 mx-auto"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-gray-900">No scans found</h3>
          <p className="mt-1 text-sm text-gray-500">
            This customer has not created any scans yet.
          </p>
        </div>
      </td>
    </tr>
  );
}

/**
 * Admin Customer Detail Page
 *
 * This page:
 * - Displays customer information (email)
 * - Shows summary statistics (total scans, first/last scan dates, avg issues)
 * - Lists all scans for this customer with status, date, URL, and issues count
 * - Provides pagination controls (Previous/Next buttons, page info)
 * - Shows loading and error states
 * - Includes back link to customers list
 *
 * Requirements:
 * - REQ 4.2: Return all scans associated with an email address, ordered by date
 */
export default function AdminCustomerDetailPage() {
  const params = useParams();
  const email = decodeURIComponent(params['email'] as string);

  // Customer state
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerLoading, setCustomerLoading] = useState(true);
  const [customerError, setCustomerError] = useState<string | null>(null);

  // Scans state
  const [scans, setScans] = useState<Scan[]>([]);
  const [scansLoading, setScansLoading] = useState(true);
  const [scansError, setScansError] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);

  /**
   * Fetch customer details
   */
  const fetchCustomer = async () => {
    try {
      setCustomerLoading(true);
      setCustomerError(null);

      const response = await adminApi.customers.get(email);
      setCustomer(response.customer);
    } catch (err) {
      setCustomerError(err instanceof Error ? err.message : 'Failed to fetch customer details');
      console.error('Failed to fetch customer:', err);
    } finally {
      setCustomerLoading(false);
    }
  };

  /**
   * Fetch customer scans
   */
  const fetchScans = async () => {
    try {
      setScansLoading(true);
      setScansError(null);

      const response = await adminApi.customers.getScans(email, {
        page,
        pageSize,
      });

      setScans(response.scans);
      setTotal(response.total);
    } catch (err) {
      setScansError(err instanceof Error ? err.message : 'Failed to fetch customer scans');
      console.error('Failed to fetch scans:', err);
    } finally {
      setScansLoading(false);
    }
  };

  /**
   * Fetch data on mount and when page changes
   */
  useEffect(() => {
    fetchCustomer();
  }, [email]);

  useEffect(() => {
    fetchScans();
  }, [email, page]);

  /**
   * Format date for display
   */
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  /**
   * Truncate URL for display
   */
  const truncateUrl = (url: string, maxLength = 50) => {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + '...';
  };

  /**
   * Calculate total pages
   */
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div>
        <Link
          href="/admin/customers"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Customers
        </Link>
      </div>

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Customer Details</h1>
        <p className="mt-1 text-sm text-gray-600">
          View scan history and statistics for this customer
        </p>
      </div>

      {/* Customer info and stats */}
      {customerLoading ? (
        <div className="animate-pulse bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="h-8 w-64 bg-gray-200 rounded mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="h-20 bg-gray-100 rounded"></div>
            <div className="h-20 bg-gray-100 rounded"></div>
            <div className="h-20 bg-gray-100 rounded"></div>
            <div className="h-20 bg-gray-100 rounded"></div>
          </div>
        </div>
      ) : customerError ? (
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
              <h3 className="text-sm font-medium text-red-800">Error loading customer</h3>
              <p className="mt-1 text-sm text-red-700">{customerError}</p>
            </div>
          </div>
        </div>
      ) : customer ? (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          {/* Email */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">{customer.email}</h2>
          </div>

          {/* Statistics grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Total Scans */}
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <Activity className="h-8 w-8 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-900">Total Scans</p>
                  <p className="text-2xl font-bold text-blue-600">{customer.totalScans}</p>
                </div>
              </div>
            </div>

            {/* First Scan */}
            <div className="bg-green-50 rounded-lg p-4 border border-green-100">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <Calendar className="h-8 w-8 text-green-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-green-900">First Scan</p>
                  <p className="text-sm font-semibold text-green-700 truncate">
                    {formatDate(customer.firstScanAt)}
                  </p>
                </div>
              </div>
            </div>

            {/* Last Scan */}
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <Calendar className="h-8 w-8 text-purple-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-purple-900">Last Scan</p>
                  <p className="text-sm font-semibold text-purple-700 truncate">
                    {formatDate(customer.lastScanAt)}
                  </p>
                </div>
              </div>
            </div>

            {/* Average Issues */}
            <div className="bg-orange-50 rounded-lg p-4 border border-orange-100">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <svg
                    className="h-8 w-8 text-orange-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-orange-900">Avg Issues</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {customer.avgIssuesPerScan.toFixed(1)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Scans section header */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">Scan History</h2>
        <p className="text-sm text-gray-600">
          {total} {total === 1 ? 'scan' : 'scans'} total
        </p>
      </div>

      {/* Scans error state */}
      {scansError && (
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
              <p className="mt-1 text-sm text-red-700">{scansError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Scans table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {/* Status Column */}
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Status
              </th>

              {/* Created Date Column */}
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Created
              </th>

              {/* URL Column */}
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                URL
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {/* Loading State */}
            {scansLoading && (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            )}

            {/* Empty State */}
            {!scansLoading && scans.length === 0 && <EmptyState />}

            {/* Data Rows */}
            {!scansLoading &&
              scans.map((scan) => (
                <tr key={scan.id} className="hover:bg-gray-50 transition-colors">
                  {/* Status */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={scan.status} />
                  </td>

                  {/* Created Date */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(scan.createdAt)}
                  </td>

                  {/* URL */}
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <Link
                      href={`/admin/scans/${scan.id}`}
                      className="text-blue-600 hover:text-blue-800 hover:underline"
                      title={scan.url}
                    >
                      {truncateUrl(scan.url)}
                    </Link>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {!scansLoading && total > 0 && (
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
    </div>
  );
}

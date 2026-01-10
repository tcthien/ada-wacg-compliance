'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Scan } from '@/lib/admin-api';
import {
  Eye,
  Trash2,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Layers,
  ExternalLink
} from 'lucide-react';

/**
 * Sort configuration
 */
type SortField = 'status' | 'createdAt' | 'email' | 'url';
type SortOrder = 'asc' | 'desc';

interface SortConfig {
  field: SortField;
  order: SortOrder;
}

/**
 * Props for the ScanTable component
 */
interface ScanTableProps {
  /** Array of scans to display */
  scans: Scan[];
  /** Loading state - shows skeleton rows when true */
  loading?: boolean;
  /** Callback when delete button is clicked */
  onDelete: (scanId: string) => void;
  /** Callback when retry button is clicked (only for failed scans) */
  onRetry: (scanId: string) => void;
}

/**
 * Status badge component
 * Note: API returns uppercase status values (PENDING, RUNNING, COMPLETED, FAILED)
 */
function StatusBadge({ status }: { status: Scan['status'] }) {
  const statusConfig: Record<string, { label: string; className: string }> = {
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
  };

  const config = statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-800' };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}

/**
 * Sort icon component
 */
function SortIcon({
  field,
  currentSort
}: {
  field: SortField;
  currentSort: SortConfig | null;
}) {
  if (currentSort?.field !== field) {
    return <ArrowUpDown className="ml-1 h-4 w-4 text-gray-400" />;
  }

  return currentSort.order === 'asc'
    ? <ArrowUp className="ml-1 h-4 w-4 text-blue-600" />
    : <ArrowDown className="ml-1 h-4 w-4 text-blue-600" />;
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
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="h-4 w-40 bg-gray-200 rounded"></div>
      </td>
      <td className="px-6 py-4">
        <div className="h-4 w-64 bg-gray-200 rounded"></div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="h-6 w-20 bg-gray-200 rounded"></div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex gap-2">
          <div className="h-8 w-8 bg-gray-200 rounded"></div>
          <div className="h-8 w-8 bg-gray-200 rounded"></div>
        </div>
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
      <td colSpan={6} className="px-6 py-12 text-center">
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
            No accessibility scans have been created yet.
          </p>
        </div>
      </td>
    </tr>
  );
}

/**
 * ScanTable component
 *
 * This component:
 * - Displays scans in a table with status, date, email, URL columns
 * - Provides sortable column headers (click to toggle sort direction)
 * - Shows status badges with color coding (pending=gray, running=blue, completed=green, failed=red)
 * - Includes action buttons: View (link to detail), Delete, Retry (for failed scans only)
 * - Displays loading state with skeleton rows
 * - Shows empty state when no scans are available
 *
 * Requirements:
 * - REQ 3.5: Display full scan data with results, issues, and session info
 * - REQ 7.3: Responsive tables with sorting, filtering, and pagination controls
 * - NFR-Usability: Intuitive table interface with clear status indicators
 */
export function ScanTable({
  scans,
  loading = false,
  onDelete,
  onRetry
}: ScanTableProps) {
  const router = useRouter();
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  /**
   * Handle row click to navigate to scan detail
   */
  const handleRowClick = (scanId: string) => {
    router.push(`/admin/scans/${scanId}`);
  };

  /**
   * Handle column header click for sorting
   */
  const handleSort = (field: SortField) => {
    setSortConfig((current) => {
      // If clicking the same field, toggle order
      if (current?.field === field) {
        return {
          field,
          order: current.order === 'asc' ? 'desc' : 'asc',
        };
      }
      // Default to descending for new field
      return { field, order: 'desc' };
    });
  };

  // Ensure scans is always an array (defensive coding)
  const safeScans = scans || [];

  /**
   * Sort scans based on current sort configuration
   */
  const sortedScans = sortConfig
    ? [...safeScans].sort((a, b) => {
        const { field, order } = sortConfig;
        let aValue: string | number;
        let bValue: string | number;

        switch (field) {
          case 'status':
            aValue = a.status;
            bValue = b.status;
            break;
          case 'createdAt':
            aValue = new Date(a.createdAt).getTime();
            bValue = new Date(b.createdAt).getTime();
            break;
          case 'email':
            aValue = a.email.toLowerCase();
            bValue = b.email.toLowerCase();
            break;
          case 'url':
            aValue = a.url.toLowerCase();
            bValue = b.url.toLowerCase();
            break;
          default:
            return 0;
        }

        if (aValue < bValue) {
          return order === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return order === 'asc' ? 1 : -1;
        }
        return 0;
      })
    : safeScans;

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

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {/* Status Column */}
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSort('status')}
            >
              <div className="flex items-center">
                Status
                <SortIcon field="status" currentSort={sortConfig} />
              </div>
            </th>

            {/* Created Date Column */}
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSort('createdAt')}
            >
              <div className="flex items-center">
                Created
                <SortIcon field="createdAt" currentSort={sortConfig} />
              </div>
            </th>

            {/* Email Column */}
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSort('email')}
            >
              <div className="flex items-center">
                Email
                <SortIcon field="email" currentSort={sortConfig} />
              </div>
            </th>

            {/* URL Column */}
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSort('url')}
            >
              <div className="flex items-center">
                URL
                <SortIcon field="url" currentSort={sortConfig} />
              </div>
            </th>

            {/* Batch Column */}
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Batch
            </th>

            {/* Actions Column */}
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {/* Loading State */}
          {loading && (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          )}

          {/* Empty State */}
          {!loading && sortedScans.length === 0 && <EmptyState />}

          {/* Data Rows */}
          {!loading &&
            sortedScans.map((scan) => (
              <tr
                key={scan.id}
                onClick={() => handleRowClick(scan.id)}
                className="hover:bg-gray-50 transition-colors cursor-pointer"
              >
                {/* Status */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <StatusBadge status={scan.status} />
                </td>

                {/* Created Date */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatDate(scan.createdAt)}
                </td>

                {/* Email */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {scan.email}
                </td>

                {/* URL */}
                <td className="px-6 py-4 text-sm text-gray-900">
                  <a
                    href={scan.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 hover:underline"
                    title={scan.url}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {truncateUrl(scan.url)}
                  </a>
                </td>

                {/* Batch */}
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {scan.batchScanId ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                        <Layers className="h-3 w-3" />
                        Batch
                      </span>
                      {scan.batchHomepageUrl && (
                        <span className="text-gray-600 truncate max-w-[120px]" title={scan.batchHomepageUrl}>
                          {scan.batchHomepageUrl.length > 30
                            ? scan.batchHomepageUrl.substring(0, 30) + '...'
                            : scan.batchHomepageUrl}
                        </span>
                      )}
                      <Link
                        href={`/admin/batches/${scan.batchScanId}`}
                        className="inline-flex items-center justify-center p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="View batch details"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span className="sr-only">View batch</span>
                      </Link>
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>

                {/* Actions */}
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex items-center gap-2">
                    {/* View Button */}
                    <Link
                      href={`/admin/scans/${scan.id}`}
                      className="inline-flex items-center justify-center p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                      title="View details"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Eye className="h-4 w-4" />
                      <span className="sr-only">View</span>
                    </Link>

                    {/* Retry Button (only for failed scans) */}
                    {scan.status === 'FAILED' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRetry(scan.id);
                        }}
                        className="inline-flex items-center justify-center p-2 text-green-600 hover:bg-green-50 rounded-md transition-colors"
                        title="Retry scan"
                      >
                        <RefreshCw className="h-4 w-4" />
                        <span className="sr-only">Retry</span>
                      </button>
                    )}

                    {/* Delete Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(scan.id);
                      }}
                      className="inline-flex items-center justify-center p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title="Delete scan"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

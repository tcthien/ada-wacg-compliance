'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminBatchSummary } from '@/lib/admin-api';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

/**
 * Sort configuration
 */
type SortField = 'status' | 'createdAt' | 'homepageUrl' | 'totalUrls' | 'totalIssues';
type SortOrder = 'asc' | 'desc';

interface SortConfig {
  field: SortField;
  order: SortOrder;
}

/**
 * Props for the BatchTable component
 */
interface BatchTableProps {
  /** Array of batch summaries to display */
  batches: AdminBatchSummary[];
  /** Loading state - shows skeleton rows when true */
  loading?: boolean;
}

/**
 * Status badge component
 * Displays batch status with color coding
 */
function StatusBadge({ status }: { status: AdminBatchSummary['status'] }) {
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
    CANCELLED: {
      label: 'Cancelled',
      className: 'bg-yellow-100 text-yellow-800',
    },
    STALE: {
      label: 'Stale',
      className: 'bg-orange-100 text-orange-800',
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
      <td className="px-6 py-4">
        <div className="h-4 w-64 bg-gray-200 rounded"></div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="h-4 w-16 bg-gray-200 rounded"></div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="h-6 w-20 bg-gray-200 rounded"></div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="h-4 w-32 bg-gray-200 rounded"></div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="h-4 w-32 bg-gray-200 rounded"></div>
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
      <td colSpan={5} className="px-6 py-12 text-center">
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
          <h3 className="text-sm font-medium text-gray-900">No batches found</h3>
          <p className="mt-1 text-sm text-gray-500">
            No batch scans have been created yet.
          </p>
        </div>
      </td>
    </tr>
  );
}

/**
 * BatchTable component
 *
 * This component:
 * - Displays batch scans in a table with homepage URL, total URLs, status, issues, and created date columns
 * - Provides sortable column headers (click to toggle sort direction)
 * - Shows status badges with color coding (pending=gray, running=blue, completed=green, failed=red, cancelled=yellow, stale=orange)
 * - Clicking on a row navigates to the batch detail view
 * - Displays loading state with skeleton rows
 * - Shows empty state when no batches are available
 *
 * Requirements:
 * - REQ 1.2: Display batch entry with homepage URL, total URLs, status, aggregate issue counts, creation timestamp
 * - REQ 1.5: Clicking on batch row navigates to batch detail view
 * - NFR-Usability: Intuitive table interface with clear status indicators
 */
export function BatchTable({
  batches,
  loading = false,
}: BatchTableProps) {
  const router = useRouter();
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

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

  /**
   * Handle row click to navigate to batch detail
   */
  const handleRowClick = (batchId: string) => {
    router.push(`/admin/batches/${batchId}`);
  };

  // Ensure batches is always an array (defensive coding)
  const safeBatches = batches || [];

  /**
   * Sort batches based on current sort configuration
   */
  const sortedBatches = sortConfig
    ? [...safeBatches].sort((a, b) => {
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
          case 'homepageUrl':
            aValue = a.homepageUrl.toLowerCase();
            bValue = b.homepageUrl.toLowerCase();
            break;
          case 'totalUrls':
            aValue = a.totalUrls;
            bValue = b.totalUrls;
            break;
          case 'totalIssues':
            aValue = a.totalIssues;
            bValue = b.totalIssues;
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
    : safeBatches;

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
   * Format issue counts for display
   */
  const formatIssueCounts = (batch: AdminBatchSummary) => {
    if (batch.totalIssues === 0) {
      return <span className="text-gray-500">No issues</span>;
    }

    const parts: string[] = [];
    if (batch.criticalCount > 0) parts.push(`${batch.criticalCount} Critical`);
    if (batch.seriousCount > 0) parts.push(`${batch.seriousCount} Serious`);
    if (batch.moderateCount > 0) parts.push(`${batch.moderateCount} Moderate`);
    if (batch.minorCount > 0) parts.push(`${batch.minorCount} Minor`);

    return (
      <div className="flex flex-col gap-0.5">
        <span className="font-medium">{batch.totalIssues} total</span>
        <span className="text-xs text-gray-600">{parts.join(', ')}</span>
      </div>
    );
  };

  /**
   * Format completion status for display
   */
  const formatCompletionStatus = (batch: AdminBatchSummary) => {
    const total = batch.totalUrls;
    const completed = batch.completedCount;
    const failed = batch.failedCount;
    const pending = total - completed - failed;

    return (
      <div className="flex flex-col gap-0.5">
        <span className="font-medium">{total} URLs</span>
        <span className="text-xs text-gray-600">
          {completed} done, {failed} failed, {pending} pending
        </span>
      </div>
    );
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {/* Homepage URL Column */}
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSort('homepageUrl')}
            >
              <div className="flex items-center">
                Homepage URL
                <SortIcon field="homepageUrl" currentSort={sortConfig} />
              </div>
            </th>

            {/* URLs Column */}
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSort('totalUrls')}
            >
              <div className="flex items-center">
                URLs
                <SortIcon field="totalUrls" currentSort={sortConfig} />
              </div>
            </th>

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

            {/* Issues Column */}
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSort('totalIssues')}
            >
              <div className="flex items-center">
                Issues
                <SortIcon field="totalIssues" currentSort={sortConfig} />
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
          {!loading && sortedBatches.length === 0 && <EmptyState />}

          {/* Data Rows */}
          {!loading &&
            sortedBatches.map((batch) => (
              <tr
                key={batch.id}
                onClick={() => handleRowClick(batch.id)}
                className="hover:bg-gray-50 transition-colors cursor-pointer"
              >
                {/* Homepage URL */}
                <td className="px-6 py-4 text-sm text-gray-900">
                  <a
                    href={batch.homepageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 hover:underline"
                    title={batch.homepageUrl}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {truncateUrl(batch.homepageUrl)}
                  </a>
                </td>

                {/* URLs */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatCompletionStatus(batch)}
                </td>

                {/* Status */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <StatusBadge status={batch.status} />
                </td>

                {/* Issues */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatIssueCounts(batch)}
                </td>

                {/* Created Date */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatDate(batch.createdAt)}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

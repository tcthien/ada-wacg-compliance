'use client';

import { useState } from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

/**
 * Audit log type based on API response
 */
export interface AuditLog {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details: Record<string, unknown>;
  ipAddress: string;
  createdAt: string;
}

/**
 * Sort configuration
 */
type SortField = 'createdAt' | 'adminEmail' | 'action' | 'resourceType';
type SortOrder = 'asc' | 'desc';

interface SortConfig {
  field: SortField;
  order: SortOrder;
}

/**
 * Props for the AuditLogTable component
 */
interface AuditLogTableProps {
  /** Array of audit logs to display */
  logs: AuditLog[];
  /** Loading state - shows skeleton rows when true */
  loading?: boolean;
}

/**
 * Action type badge component with color coding
 */
function ActionBadge({ action }: { action: string }) {
  // Map action types to colors
  const getActionColor = (actionType: string): string => {
    const normalizedAction = actionType.toLowerCase();

    if (normalizedAction.includes('create')) {
      return 'bg-green-100 text-green-800';
    }
    if (normalizedAction.includes('update') || normalizedAction.includes('edit')) {
      return 'bg-blue-100 text-blue-800';
    }
    if (normalizedAction.includes('delete') || normalizedAction.includes('deactivate')) {
      return 'bg-red-100 text-red-800';
    }
    if (normalizedAction.includes('login') || normalizedAction.includes('auth')) {
      return 'bg-purple-100 text-purple-800';
    }
    if (normalizedAction.includes('export') || normalizedAction.includes('download')) {
      return 'bg-orange-100 text-orange-800';
    }

    // Default color
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getActionColor(action)}`}
    >
      {action}
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
        <div className="h-4 w-32 bg-gray-200 rounded"></div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="h-4 w-40 bg-gray-200 rounded"></div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="h-6 w-24 bg-gray-200 rounded"></div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="h-4 w-20 bg-gray-200 rounded"></div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="h-4 w-32 bg-gray-200 rounded"></div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="h-4 w-28 bg-gray-200 rounded"></div>
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
          <h3 className="text-sm font-medium text-gray-900">No audit logs found</h3>
          <p className="mt-1 text-sm text-gray-500">
            No audit log entries match the current filters.
          </p>
        </div>
      </td>
    </tr>
  );
}

/**
 * AuditLogTable component
 *
 * This component:
 * - Displays audit logs in a table with timestamp, admin email, action, target type, target ID, and IP address
 * - Provides sortable column headers (click to toggle sort direction)
 * - Shows action badges with color coding based on action type
 * - Displays loading state with skeleton rows
 * - Shows empty state when no logs are available
 *
 * Requirements:
 * - REQ 6.2: Return logs with pagination and filtering by date range, admin, and action type
 * - REQ 7.3: Display data in responsive tables with sorting, filtering, and pagination controls
 * - NFR-Usability: Intuitive table interface with clear action indicators
 */
export function AuditLogTable({
  logs,
  loading = false
}: AuditLogTableProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({
    field: 'createdAt',
    order: 'desc'
  });

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
   * Sort logs based on current sort configuration
   */
  const sortedLogs = sortConfig
    ? [...logs].sort((a, b) => {
        const { field, order } = sortConfig;
        let aValue: string | number;
        let bValue: string | number;

        switch (field) {
          case 'createdAt':
            aValue = new Date(a.createdAt).getTime();
            bValue = new Date(b.createdAt).getTime();
            break;
          case 'adminEmail':
            aValue = a.adminEmail.toLowerCase();
            bValue = b.adminEmail.toLowerCase();
            break;
          case 'action':
            aValue = a.action.toLowerCase();
            bValue = b.action.toLowerCase();
            break;
          case 'resourceType':
            aValue = a.resourceType.toLowerCase();
            bValue = b.resourceType.toLowerCase();
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
    : logs;

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
      second: '2-digit',
    });
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {/* Timestamp Column */}
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSort('createdAt')}
            >
              <div className="flex items-center">
                Timestamp
                <SortIcon field="createdAt" currentSort={sortConfig} />
              </div>
            </th>

            {/* Admin Email Column */}
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSort('adminEmail')}
            >
              <div className="flex items-center">
                Admin Email
                <SortIcon field="adminEmail" currentSort={sortConfig} />
              </div>
            </th>

            {/* Action Column */}
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSort('action')}
            >
              <div className="flex items-center">
                Action
                <SortIcon field="action" currentSort={sortConfig} />
              </div>
            </th>

            {/* Target Type Column */}
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSort('resourceType')}
            >
              <div className="flex items-center">
                Target Type
                <SortIcon field="resourceType" currentSort={sortConfig} />
              </div>
            </th>

            {/* Target ID Column */}
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Target ID
            </th>

            {/* IP Address Column */}
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              IP Address
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
          {!loading && sortedLogs.length === 0 && <EmptyState />}

          {/* Data Rows */}
          {!loading &&
            sortedLogs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                {/* Timestamp */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatDate(log.createdAt)}
                </td>

                {/* Admin Email */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {log.adminEmail}
                </td>

                {/* Action */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <ActionBadge action={log.action} />
                </td>

                {/* Target Type */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {log.resourceType}
                </td>

                {/* Target ID */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                  {log.resourceId.substring(0, 8)}...
                </td>

                {/* IP Address */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                  {log.ipAddress}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

/**
 * Customer type based on API response
 */
export interface Customer {
  email: string;
  totalScans: number;
  firstScanAt: string;
  lastScanAt: string;
  avgIssuesPerScan: number;
}

/**
 * Sort configuration
 */
type SortField = 'email' | 'totalScans' | 'firstScanAt' | 'lastScanAt' | 'avgIssuesPerScan';
type SortOrder = 'asc' | 'desc';

interface SortConfig {
  field: SortField;
  order: SortOrder;
}

/**
 * Props for the CustomerTable component
 */
interface CustomerTableProps {
  /** Array of customers to display */
  customers: Customer[];
  /** Loading state - shows skeleton rows when true */
  loading?: boolean;
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
        <div className="h-4 w-48 bg-gray-200 rounded"></div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="h-4 w-12 bg-gray-200 rounded"></div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="h-4 w-32 bg-gray-200 rounded"></div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="h-4 w-32 bg-gray-200 rounded"></div>
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
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-gray-900">No customers found</h3>
          <p className="mt-1 text-sm text-gray-500">
            No customers have created scans yet.
          </p>
        </div>
      </td>
    </tr>
  );
}

/**
 * CustomerTable component
 *
 * This component:
 * - Displays customers in a table with email, total scans, first scan date, last scan date, and average issues
 * - Provides sortable column headers (click to toggle sort direction)
 * - Email column links to customer detail page
 * - Displays loading state with skeleton rows
 * - Shows empty state when no customers are available
 *
 * Requirements:
 * - REQ 4.1: Return unique emails with aggregated statistics (total scans, last scan date)
 * - REQ 7.3: Display data in responsive tables with sorting, filtering, and pagination controls
 * - NFR-Usability: Intuitive table interface with clear data presentation
 */
export function CustomerTable({
  customers,
  loading = false
}: CustomerTableProps) {
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
   * Sort customers based on current sort configuration
   */
  const sortedCustomers = sortConfig
    ? [...customers].sort((a, b) => {
        const { field, order } = sortConfig;
        let aValue: string | number;
        let bValue: string | number;

        switch (field) {
          case 'email':
            aValue = a.email.toLowerCase();
            bValue = b.email.toLowerCase();
            break;
          case 'totalScans':
            aValue = a.totalScans;
            bValue = b.totalScans;
            break;
          case 'firstScanAt':
            aValue = new Date(a.firstScanAt).getTime();
            bValue = new Date(b.firstScanAt).getTime();
            break;
          case 'lastScanAt':
            aValue = new Date(a.lastScanAt).getTime();
            bValue = new Date(b.lastScanAt).getTime();
            break;
          case 'avgIssuesPerScan':
            aValue = a.avgIssuesPerScan;
            bValue = b.avgIssuesPerScan;
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
    : customers;

  /**
   * Format date for display
   */
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
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

            {/* Total Scans Column */}
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSort('totalScans')}
            >
              <div className="flex items-center">
                Total Scans
                <SortIcon field="totalScans" currentSort={sortConfig} />
              </div>
            </th>

            {/* First Scan Column */}
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSort('firstScanAt')}
            >
              <div className="flex items-center">
                First Scan
                <SortIcon field="firstScanAt" currentSort={sortConfig} />
              </div>
            </th>

            {/* Last Scan Column */}
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSort('lastScanAt')}
            >
              <div className="flex items-center">
                Last Scan
                <SortIcon field="lastScanAt" currentSort={sortConfig} />
              </div>
            </th>

            {/* Avg Issues Column */}
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSort('avgIssuesPerScan')}
            >
              <div className="flex items-center">
                Avg Issues
                <SortIcon field="avgIssuesPerScan" currentSort={sortConfig} />
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
          {!loading && sortedCustomers.length === 0 && <EmptyState />}

          {/* Data Rows */}
          {!loading &&
            sortedCustomers.map((customer) => (
              <tr key={customer.email} className="hover:bg-gray-50 transition-colors">
                {/* Email - Link to customer detail page */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <Link
                    href={`/admin/customers/${encodeURIComponent(customer.email)}`}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {customer.email}
                  </Link>
                </td>

                {/* Total Scans */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {customer.totalScans}
                </td>

                {/* First Scan Date */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatDate(customer.firstScanAt)}
                </td>

                {/* Last Scan Date */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatDate(customer.lastScanAt)}
                </td>

                {/* Average Issues */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {customer.avgIssuesPerScan.toFixed(1)}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

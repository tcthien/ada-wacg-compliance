'use client';

import { X } from 'lucide-react';
import { BatchStatus } from '@/lib/admin-api';

/**
 * Filter state interface
 */
export interface BatchFilterState {
  status: BatchStatus | 'ALL';
  startDate: string;
  endDate: string;
  homepageUrl: string;
}

/**
 * Props for the BatchFilters component
 */
interface BatchFiltersProps {
  /** Current filter values */
  filters: BatchFilterState;
  /** Callback when any filter changes */
  onChange: (filters: BatchFilterState) => void;
}

/**
 * Status options for the dropdown
 */
const STATUS_OPTIONS: Array<{ value: BatchStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'RUNNING', label: 'Running' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'STALE', label: 'Stale' },
];

/**
 * BatchFilters component
 *
 * This component:
 * - Provides filtering controls for batch scan list
 * - Status dropdown with all 6 status options + "All" option
 * - Date range inputs (start date, end date)
 * - Homepage URL text input for search
 * - Clear all filters button
 * - Controlled component pattern (receives values from props, emits changes via callback)
 *
 * Requirements:
 * - REQ 1.3: Filter by Status (PENDING, RUNNING, COMPLETED, FAILED, CANCELLED, STALE),
 *            Date range (start date, end date), Homepage URL (partial match)
 * - NFR-Usability: Intuitive filter interface with clear controls
 *
 * Design Patterns:
 * - Follows existing admin component styling (gray backgrounds, borders, shadows)
 * - Uses Tailwind CSS utility classes consistent with other admin components
 * - Controlled component pattern for predictable state management
 * - Individual change handlers for each filter type
 */
export function BatchFilters({ filters, onChange }: BatchFiltersProps) {
  /**
   * Handle status filter change
   */
  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({
      ...filters,
      status: e.target.value as BatchStatus | 'ALL',
    });
  };

  /**
   * Handle start date change
   */
  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...filters,
      startDate: e.target.value,
    });
  };

  /**
   * Handle end date change
   */
  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...filters,
      endDate: e.target.value,
    });
  };

  /**
   * Handle homepage URL search change
   */
  const handleHomepageUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...filters,
      homepageUrl: e.target.value,
    });
  };

  /**
   * Clear all filters to default values
   */
  const handleClearFilters = () => {
    onChange({
      status: 'ALL',
      startDate: '',
      endDate: '',
      homepageUrl: '',
    });
  };

  /**
   * Check if any filters are active
   */
  const hasActiveFilters =
    filters.status !== 'ALL' ||
    filters.startDate !== '' ||
    filters.endDate !== '' ||
    filters.homepageUrl !== '';

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-700">Filters</h3>
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            title="Clear all filters"
          >
            <X className="h-3 w-3" />
            Clear All
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Status Filter */}
        <div className="flex flex-col">
          <label
            htmlFor="status-filter"
            className="text-xs font-medium text-gray-700 mb-1"
          >
            Status
          </label>
          <select
            id="status-filter"
            value={filters.status}
            onChange={handleStatusChange}
            className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Start Date Filter */}
        <div className="flex flex-col">
          <label
            htmlFor="start-date-filter"
            className="text-xs font-medium text-gray-700 mb-1"
          >
            Start Date
          </label>
          <input
            id="start-date-filter"
            type="date"
            value={filters.startDate}
            onChange={handleStartDateChange}
            className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
          />
        </div>

        {/* End Date Filter */}
        <div className="flex flex-col">
          <label
            htmlFor="end-date-filter"
            className="text-xs font-medium text-gray-700 mb-1"
          >
            End Date
          </label>
          <input
            id="end-date-filter"
            type="date"
            value={filters.endDate}
            onChange={handleEndDateChange}
            className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
          />
        </div>

        {/* Homepage URL Search */}
        <div className="flex flex-col">
          <label
            htmlFor="url-filter"
            className="text-xs font-medium text-gray-700 mb-1"
          >
            Homepage URL
          </label>
          <input
            id="url-filter"
            type="text"
            value={filters.homepageUrl}
            onChange={handleHomepageUrlChange}
            placeholder="Search by URL..."
            className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
          />
        </div>
      </div>
    </div>
  );
}

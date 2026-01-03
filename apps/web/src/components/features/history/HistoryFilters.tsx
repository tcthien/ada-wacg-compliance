'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Search, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { useHistoryFilterStore } from '@/stores/history-filter-store';
import { useAnalyticsContext } from '@/components/features/analytics';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ScanType } from '@/lib/analytics.types';
import type {
  HistoryDateRangeEvent,
  HistoryScanTypeFilterEvent,
  HistorySearchEvent,
  HistoryFilterAppliedEvent,
} from '@/lib/analytics.types';

/**
 * Scan type options for filter chips
 */
const SCAN_TYPE_OPTIONS: Array<{ value: ScanType; label: string }> = [
  { value: 'single', label: 'Single' },
  { value: 'batch', label: 'Batch' },
];

/**
 * HistoryFilters component
 *
 * This component:
 * - Provides filtering controls for scan history list
 * - Date range inputs (start date, end date)
 * - Scan type filter chips (Single, Batch)
 * - URL search input with debounce (300ms delay)
 * - Connected to historyFilterStore for state management
 * - Clear all filters button
 * - Responsive: Collapsible drawer on mobile, inline on desktop
 *
 * Requirements:
 * - REQ 9.1: Filter by date range (start date, end date)
 * - REQ 9.2: Filter by scan type (Single, Batch)
 * - REQ 9.3: Search by URL with debounce
 * - REQ 10.5: Collapsible filters for mobile (<640px)
 *
 * Design Patterns:
 * - Follows existing filter styling (white background, borders, shadows)
 * - Uses Tailwind CSS utility classes consistent with BatchFilters
 * - Debounced search input to reduce re-renders
 * - Filter chips for scan types with toggle behavior
 * - Mobile: Collapsible drawer with filter count badge
 * - Desktop: Always expanded inline filters
 */
export function HistoryFilters() {
  const {
    dateRange,
    scanTypes,
    searchQuery,
    setDateRange,
    toggleScanType,
    setSearchQuery,
    resetFilters,
  } = useHistoryFilterStore();
  const { track } = useAnalyticsContext();

  // Helper to get session ID
  const getSessionId = () =>
    typeof window !== 'undefined' ? window.sessionStorage.getItem('sessionId') || '' : '';

  // Local state for search input (for debouncing)
  const [searchInput, setSearchInput] = useState(searchQuery);

  // Mobile collapse state
  const [isExpanded, setIsExpanded] = useState(false);

  // Detect mobile viewport
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };

    // Initial check
    checkMobile();

    // Add resize listener
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Track search result count for analytics
  const lastSearchResultCount = useRef<number | null>(null);

  // Debounce search query updates (300ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);

      // Track search event when query changes
      if (searchInput !== '') {
        const event: HistorySearchEvent = {
          event: 'history_search',
          query_length: searchInput.length,
          result_count: lastSearchResultCount.current ?? 0,
          timestamp: new Date().toISOString(),
          sessionId: getSessionId(),
        };
        track(event);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput, setSearchQuery, track]);

  // Sync local input with store when external changes occur
  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  /**
   * Handle start date change
   */
  const handleStartDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newStart = e.target.value ? new Date(e.target.value) : null;
      setDateRange({
        ...dateRange,
        start: newStart,
      });

      // Track date range filter event
      const dateRangeEvent: HistoryDateRangeEvent = {
        event: 'history_date_range_changed',
        start_date: newStart ? newStart.toISOString().split('T')[0] ?? null : null,
        end_date: dateRange.end ? dateRange.end.toISOString().split('T')[0] ?? null : null,
        timestamp: new Date().toISOString(),
        sessionId: getSessionId(),
      };
      track(dateRangeEvent);

      // Track filter applied event
      const filterEvent: HistoryFilterAppliedEvent = {
        event: 'history_filter_applied',
        filter_type: 'date_range',
        timestamp: new Date().toISOString(),
        sessionId: getSessionId(),
      };
      track(filterEvent);
    },
    [dateRange, setDateRange, track]
  );

  /**
   * Handle end date change
   */
  const handleEndDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newEnd = e.target.value ? new Date(e.target.value) : null;
      setDateRange({
        ...dateRange,
        end: newEnd,
      });

      // Track date range filter event
      const dateRangeEvent: HistoryDateRangeEvent = {
        event: 'history_date_range_changed',
        start_date: dateRange.start ? dateRange.start.toISOString().split('T')[0] ?? null : null,
        end_date: newEnd ? newEnd.toISOString().split('T')[0] ?? null : null,
        timestamp: new Date().toISOString(),
        sessionId: getSessionId(),
      };
      track(dateRangeEvent);

      // Track filter applied event
      const filterEvent: HistoryFilterAppliedEvent = {
        event: 'history_filter_applied',
        filter_type: 'date_range',
        timestamp: new Date().toISOString(),
        sessionId: getSessionId(),
      };
      track(filterEvent);
    },
    [dateRange, setDateRange, track]
  );

  /**
   * Handle search input change (local state only, debounced update)
   */
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  };

  /**
   * Handle scan type toggle with analytics
   */
  const handleToggleScanType = (scanType: ScanType) => {
    // Calculate new scan types after toggle
    let newScanTypes: ScanType[];
    if (scanTypes.includes(scanType)) {
      newScanTypes = scanTypes.filter((t) => t !== scanType);
    } else {
      newScanTypes = [...scanTypes, scanType];
    }

    // Toggle in store
    toggleScanType(scanType);

    // Track scan type filter event
    const scanTypeEvent: HistoryScanTypeFilterEvent = {
      event: 'history_scan_type_filter',
      scan_types: newScanTypes,
      timestamp: new Date().toISOString(),
      sessionId: getSessionId(),
    };
    track(scanTypeEvent);

    // Track filter applied event
    const filterEvent: HistoryFilterAppliedEvent = {
      event: 'history_filter_applied',
      filter_type: 'scan_type',
      timestamp: new Date().toISOString(),
      sessionId: getSessionId(),
    };
    track(filterEvent);
  };

  /**
   * Clear all filters to default values
   */
  const handleClearFilters = () => {
    setSearchInput('');
    resetFilters();
  };

  /**
   * Check if any filters are active
   */
  const hasActiveFilters =
    dateRange.start !== null ||
    dateRange.end !== null ||
    scanTypes.length > 0 ||
    searchQuery !== '';

  /**
   * Count active filters for badge display
   */
  const activeFilterCount = [
    dateRange.start !== null,
    dateRange.end !== null,
    scanTypes.length > 0,
    searchQuery !== '',
  ].filter(Boolean).length;

  /**
   * Format date for input value (YYYY-MM-DD)
   */
  const formatDateForInput = (date: Date | null): string => {
    if (!date) return '';
    const isoString = date.toISOString().split('T')[0];
    return isoString || '';
  };

  /**
   * Toggle filter expansion on mobile
   */
  const toggleExpansion = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-6">
      {/* Mobile: Collapsible Header Button */}
      {isMobile && (
        <button
          onClick={toggleExpansion}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          aria-expanded={isExpanded}
          aria-controls="filter-content"
        >
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Filters</span>
            {activeFilterCount > 0 && (
              <Badge
                variant="default"
                className="bg-blue-600 text-white"
              >
                {activeFilterCount}
              </Badge>
            )}
          </div>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-gray-600" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-600" />
          )}
        </button>
      )}

      {/* Desktop: Static Header */}
      {!isMobile && (
        <div className="flex items-center justify-between p-4 pb-3">
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
      )}

      {/* Filter Content - Collapsible on Mobile */}
      <div
        id="filter-content"
        className={cn(
          'overflow-hidden transition-all duration-300 ease-in-out',
          isMobile && !isExpanded && 'max-h-0',
          isMobile && isExpanded && 'max-h-[1000px]',
          !isMobile && 'max-h-none'
        )}
      >
        <div className={cn('space-y-4', isMobile ? 'px-4 pb-4' : 'px-4 pb-4')}>
          {/* Mobile: Clear All Button (inside collapsed section) */}
          {isMobile && hasActiveFilters && (
            <div className="flex justify-end">
              <button
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                title="Clear all filters"
              >
                <X className="h-3 w-3" />
                Clear All
              </button>
            </div>
          )}

          {/* Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Start Date */}
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
                value={formatDateForInput(dateRange.start)}
                onChange={handleStartDateChange}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              />
            </div>

            {/* End Date */}
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
                value={formatDateForInput(dateRange.end)}
                onChange={handleEndDateChange}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              />
            </div>
          </div>

          {/* Scan Type Filter Chips */}
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-700 mb-2">
              Scan Type
            </label>
            <div className="flex flex-wrap gap-2">
              {SCAN_TYPE_OPTIONS.map((option) => {
                const isSelected = scanTypes.includes(option.value);
                return (
                  <button
                    key={option.value}
                    onClick={() => handleToggleScanType(option.value)}
                    className={`
                      px-4 py-2 text-sm font-medium rounded-md transition-colors
                      ${
                        isSelected
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                      }
                    `}
                    aria-pressed={isSelected}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* URL Search */}
          <div className="flex flex-col">
            <label
              htmlFor="url-search-filter"
              className="text-xs font-medium text-gray-700 mb-1"
            >
              Search by URL
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                id="url-search-filter"
                type="text"
                value={searchInput}
                onChange={handleSearchChange}
                placeholder="Search by URL..."
                className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useHistoryFilterStore, type SortBy } from '@/stores/history-filter-store';
import { useAnalyticsContext } from '@/components/features/analytics';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { HistorySortChangedEvent, HistorySortOption } from '@/lib/analytics.types';

/**
 * Sort control component for history page
 * Provides dropdown for sort field selection and toggle button for sort direction
 *
 * Features:
 * - Sort by date, issue count, or URL (requirement 9.4)
 * - Ascending/descending toggle
 * - Connected to historyFilterStore
 * - Accessible keyboard navigation
 */
export function HistorySortControls() {
  const { sortBy, sortOrder, setSortBy, toggleSortOrder } = useHistoryFilterStore();
  const { track } = useAnalyticsContext();

  // Helper to get session ID
  const getSessionId = () =>
    typeof window !== 'undefined' ? window.sessionStorage.getItem('sessionId') || '' : '';

  // Map SortBy to HistorySortOption
  const mapSortByToAnalytics = (sort: SortBy): HistorySortOption => {
    switch (sort) {
      case 'date':
        return 'date';
      case 'issues':
        return 'issue_count';
      case 'url':
        return 'url';
      default:
        return 'date';
    }
  };

  /**
   * Handle sort field change with analytics
   */
  const handleSortByChange = (value: string) => {
    const newSortBy = value as SortBy;
    setSortBy(newSortBy);

    // Track sort change event
    const event: HistorySortChangedEvent = {
      event: 'history_sort_changed',
      sort_by: mapSortByToAnalytics(newSortBy),
      sort_order: sortOrder,
      timestamp: new Date().toISOString(),
      sessionId: getSessionId(),
    };
    track(event);
  };

  /**
   * Handle sort order toggle with analytics
   */
  const handleToggleSortOrder = () => {
    const newSortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    toggleSortOrder();

    // Track sort change event
    const event: HistorySortChangedEvent = {
      event: 'history_sort_changed',
      sort_by: mapSortByToAnalytics(sortBy),
      sort_order: newSortOrder,
      timestamp: new Date().toISOString(),
      sessionId: getSessionId(),
    };
    track(event);
  };

  /**
   * Get the appropriate icon based on current sort order
   */
  const getSortIcon = () => {
    if (sortOrder === 'asc') {
      return <ArrowUp className="h-4 w-4" aria-hidden="true" />;
    }
    return <ArrowDown className="h-4 w-4" aria-hidden="true" />;
  };

  /**
   * Get user-friendly label for sort direction
   */
  const getSortOrderLabel = () => {
    return sortOrder === 'asc' ? 'Ascending' : 'Descending';
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="sort-by" className="text-sm font-medium shrink-0">
        Sort by:
      </label>

      {/* Sort field selector */}
      <Select value={sortBy} onValueChange={handleSortByChange}>
        <SelectTrigger
          id="sort-by"
          className="w-[180px]"
          aria-label="Select sort field"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="date">Date</SelectItem>
          <SelectItem value="issues">Issue Count</SelectItem>
          <SelectItem value="url">URL</SelectItem>
        </SelectContent>
      </Select>

      {/* Sort order toggle button */}
      <Button
        variant="outline"
        size="icon"
        onClick={handleToggleSortOrder}
        aria-label={`Sort order: ${getSortOrderLabel()}. Click to toggle.`}
        title={`Toggle sort order (current: ${getSortOrderLabel()})`}
        className="shrink-0"
      >
        {getSortIcon()}
      </Button>
    </div>
  );
}

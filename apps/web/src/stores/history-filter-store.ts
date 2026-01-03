import { create } from 'zustand';
import type { ScanType } from '@/lib/analytics.types';

/**
 * Date range for filtering history
 */
export interface DateRange {
  /** Start date of the range (null for no start limit) */
  start: Date | null;
  /** End date of the range (null for no end limit) */
  end: Date | null;
}

/**
 * Sort field options for history
 */
export type SortBy = 'date' | 'issues' | 'url';

/**
 * Sort direction
 */
export type SortOrder = 'asc' | 'desc';

/**
 * History filter state
 */
interface HistoryFilterState {
  /** Date range for filtering scans */
  dateRange: DateRange;
  /** Array of selected scan types for filtering */
  scanTypes: ScanType[];
  /** Search query for filtering by URL */
  searchQuery: string;
  /** Field to sort by */
  sortBy: SortBy;
  /** Sort direction (ascending or descending) */
  sortOrder: SortOrder;
  /** Set of selected scan IDs for bulk operations */
  selectedIds: Set<string>;
}

/**
 * History filter actions
 */
interface HistoryFilterActions {
  /**
   * Set the date range filter
   * @param range - Date range with start and end dates
   */
  setDateRange: (range: DateRange) => void;

  /**
   * Toggle a scan type in the filter
   * @param type - Scan type to toggle ('single' or 'batch')
   */
  toggleScanType: (type: ScanType) => void;

  /**
   * Set the search query for URL filtering
   * @param query - Search query string
   */
  setSearchQuery: (query: string) => void;

  /**
   * Set the sort field
   * @param sortBy - Field to sort by ('date', 'issues', or 'url')
   */
  setSortBy: (sortBy: SortBy) => void;

  /**
   * Toggle the sort order between ascending and descending
   */
  toggleSortOrder: () => void;

  /**
   * Toggle selection of a single scan
   * @param id - Scan ID to toggle
   */
  toggleSelection: (id: string) => void;

  /**
   * Select all scans
   * @param ids - Array of all scan IDs to select
   */
  selectAll: (ids: string[]) => void;

  /**
   * Clear all selections
   */
  clearSelection: () => void;

  /**
   * Reset all filters to default state
   */
  resetFilters: () => void;
}

/**
 * Combined store type
 */
type HistoryFilterStore = HistoryFilterState & HistoryFilterActions;

/**
 * History filter store
 * Manages scan history UI state including filtering, sorting, and bulk selection
 *
 * Usage:
 * ```tsx
 * const { dateRange, setDateRange, selectedIds, toggleSelection } = useHistoryFilterStore();
 * ```
 *
 * Features:
 * - Date range filtering (9.1)
 * - Scan type filtering (9.2)
 * - URL search (9.3)
 * - Sorting by date, issue count, or URL (9.4)
 * - Bulk selection for deletion (9.5)
 */
export const useHistoryFilterStore = create<HistoryFilterStore>((set) => ({
  // Initial state
  dateRange: {
    start: null,
    end: null,
  },
  scanTypes: [],
  searchQuery: '',
  sortBy: 'date',
  sortOrder: 'desc',
  selectedIds: new Set<string>(),

  // Actions
  setDateRange: (range: DateRange) => {
    set({ dateRange: range });
  },

  toggleScanType: (type: ScanType) => {
    set((state) => {
      const newTypes = state.scanTypes.includes(type)
        ? state.scanTypes.filter((t) => t !== type)
        : [...state.scanTypes, type];
      return { scanTypes: newTypes };
    });
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  setSortBy: (sortBy: SortBy) => {
    set({ sortBy });
  },

  toggleSortOrder: () => {
    set((state) => ({
      sortOrder: state.sortOrder === 'asc' ? 'desc' : 'asc',
    }));
  },

  toggleSelection: (id: string) => {
    set((state) => {
      const newSelected = new Set(state.selectedIds);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      return { selectedIds: newSelected };
    });
  },

  selectAll: (ids: string[]) => {
    set({ selectedIds: new Set(ids) });
  },

  clearSelection: () => {
    set({ selectedIds: new Set<string>() });
  },

  resetFilters: () => {
    set({
      dateRange: {
        start: null,
        end: null,
      },
      scanTypes: [],
      searchQuery: '',
      sortBy: 'date',
      sortOrder: 'desc',
      selectedIds: new Set<string>(),
    });
  },
}));

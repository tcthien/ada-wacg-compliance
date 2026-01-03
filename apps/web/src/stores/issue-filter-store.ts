import { create } from 'zustand';

/**
 * Severity levels for accessibility issues
 */
export type Severity = 'critical' | 'serious' | 'moderate' | 'minor';

/**
 * Issue filter state
 */
interface IssueFilterState {
  /** Set of expanded issue IDs for expand/collapse functionality */
  expandedIssueIds: Set<string>;
  /** Array of selected severity levels for filtering */
  selectedSeverities: Severity[];
  /** Search query for filtering issues by text */
  searchQuery: string;
}

/**
 * Issue filter actions
 */
interface IssueFilterActions {
  /**
   * Toggle the expanded state of a single issue
   * @param id - Issue ID to toggle
   */
  toggleIssueExpanded: (id: string) => void;

  /**
   * Expand all issues by adding all IDs to the expanded set
   * @param ids - Array of all issue IDs to expand
   */
  expandAllIssues: (ids: string[]) => void;

  /**
   * Collapse all issues by clearing the expanded set
   */
  collapseAllIssues: () => void;

  /**
   * Set the severity filter
   * @param severities - Array of severity levels to filter by
   */
  setSeverityFilter: (severities: Severity[]) => void;

  /**
   * Set the search query for text filtering
   * @param query - Search query string
   */
  setSearchQuery: (query: string) => void;

  /**
   * Reset all filters to default state
   */
  resetFilters: () => void;
}

/**
 * Combined store type
 */
type IssueFilterStore = IssueFilterState & IssueFilterActions;

/**
 * Issue filter store
 * Manages issue list UI state including expand/collapse and filtering
 *
 * Usage:
 * ```tsx
 * const { expandedIssueIds, toggleIssueExpanded } = useIssueFilterStore();
 * ```
 */
export const useIssueFilterStore = create<IssueFilterStore>((set) => ({
  // Initial state
  expandedIssueIds: new Set<string>(),
  selectedSeverities: [],
  searchQuery: '',

  // Actions
  toggleIssueExpanded: (id: string) => {
    set((state) => {
      const newExpanded = new Set(state.expandedIssueIds);
      if (newExpanded.has(id)) {
        newExpanded.delete(id);
      } else {
        newExpanded.add(id);
      }
      return { expandedIssueIds: newExpanded };
    });
  },

  expandAllIssues: (ids: string[]) => {
    set({ expandedIssueIds: new Set(ids) });
  },

  collapseAllIssues: () => {
    set({ expandedIssueIds: new Set<string>() });
  },

  setSeverityFilter: (severities: Severity[]) => {
    set({ selectedSeverities: severities });
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  resetFilters: () => {
    set({
      selectedSeverities: [],
      searchQuery: '',
    });
  },
}));

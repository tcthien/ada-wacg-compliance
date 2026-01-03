/**
 * Unit tests for issue filter store
 *
 * Tests:
 * - Initial state values
 * - toggleIssueExpanded (expand, collapse, toggle)
 * - expandAllIssues with array of IDs
 * - collapseAllIssues clears all expanded
 * - setSeverityFilter with different severity arrays
 * - setSearchQuery
 * - resetFilters clears all state
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIssueFilterStore, type Severity } from './issue-filter-store';

describe('useIssueFilterStore', () => {
  // Reset store before each test
  beforeEach(() => {
    const { result } = renderHook(() => useIssueFilterStore());
    act(() => {
      result.current.resetFilters();
      result.current.collapseAllIssues();
    });
  });

  describe('Initial state', () => {
    it('should initialize with empty expanded set', () => {
      const { result } = renderHook(() => useIssueFilterStore());

      expect(result.current.expandedIssueIds).toBeInstanceOf(Set);
      expect(result.current.expandedIssueIds.size).toBe(0);
    });

    it('should initialize with empty severity filter', () => {
      const { result } = renderHook(() => useIssueFilterStore());

      expect(result.current.selectedSeverities).toEqual([]);
    });

    it('should initialize with empty search query', () => {
      const { result } = renderHook(() => useIssueFilterStore());

      expect(result.current.searchQuery).toBe('');
    });
  });

  describe('toggleIssueExpanded', () => {
    it('should expand a collapsed issue', () => {
      const { result } = renderHook(() => useIssueFilterStore());
      const issueId = 'issue-1';

      act(() => {
        result.current.toggleIssueExpanded(issueId);
      });

      expect(result.current.expandedIssueIds.has(issueId)).toBe(true);
      expect(result.current.expandedIssueIds.size).toBe(1);
    });

    it('should collapse an expanded issue', () => {
      const { result } = renderHook(() => useIssueFilterStore());
      const issueId = 'issue-1';

      // First expand it
      act(() => {
        result.current.toggleIssueExpanded(issueId);
      });

      expect(result.current.expandedIssueIds.has(issueId)).toBe(true);

      // Then collapse it
      act(() => {
        result.current.toggleIssueExpanded(issueId);
      });

      expect(result.current.expandedIssueIds.has(issueId)).toBe(false);
      expect(result.current.expandedIssueIds.size).toBe(0);
    });

    it('should toggle issue multiple times', () => {
      const { result } = renderHook(() => useIssueFilterStore());
      const issueId = 'issue-1';

      // Expand
      act(() => {
        result.current.toggleIssueExpanded(issueId);
      });
      expect(result.current.expandedIssueIds.has(issueId)).toBe(true);

      // Collapse
      act(() => {
        result.current.toggleIssueExpanded(issueId);
      });
      expect(result.current.expandedIssueIds.has(issueId)).toBe(false);

      // Expand again
      act(() => {
        result.current.toggleIssueExpanded(issueId);
      });
      expect(result.current.expandedIssueIds.has(issueId)).toBe(true);
    });

    it('should handle multiple different issues', () => {
      const { result } = renderHook(() => useIssueFilterStore());
      const issueIds = ['issue-1', 'issue-2', 'issue-3'];

      act(() => {
        issueIds.forEach((id) => result.current.toggleIssueExpanded(id));
      });

      expect(result.current.expandedIssueIds.size).toBe(3);
      issueIds.forEach((id) => {
        expect(result.current.expandedIssueIds.has(id)).toBe(true);
      });
    });

    it('should only affect the specified issue', () => {
      const { result } = renderHook(() => useIssueFilterStore());

      act(() => {
        result.current.toggleIssueExpanded('issue-1');
        result.current.toggleIssueExpanded('issue-2');
      });

      expect(result.current.expandedIssueIds.has('issue-1')).toBe(true);
      expect(result.current.expandedIssueIds.has('issue-2')).toBe(true);

      // Collapse only issue-1
      act(() => {
        result.current.toggleIssueExpanded('issue-1');
      });

      expect(result.current.expandedIssueIds.has('issue-1')).toBe(false);
      expect(result.current.expandedIssueIds.has('issue-2')).toBe(true);
      expect(result.current.expandedIssueIds.size).toBe(1);
    });
  });

  describe('expandAllIssues', () => {
    it('should expand all provided issue IDs', () => {
      const { result } = renderHook(() => useIssueFilterStore());
      const issueIds = ['issue-1', 'issue-2', 'issue-3', 'issue-4'];

      act(() => {
        result.current.expandAllIssues(issueIds);
      });

      expect(result.current.expandedIssueIds.size).toBe(4);
      issueIds.forEach((id) => {
        expect(result.current.expandedIssueIds.has(id)).toBe(true);
      });
    });

    it('should replace previously expanded issues', () => {
      const { result } = renderHook(() => useIssueFilterStore());

      // First expand some issues
      act(() => {
        result.current.expandAllIssues(['issue-1', 'issue-2']);
      });

      expect(result.current.expandedIssueIds.size).toBe(2);

      // Then expand a different set
      act(() => {
        result.current.expandAllIssues(['issue-3', 'issue-4', 'issue-5']);
      });

      expect(result.current.expandedIssueIds.size).toBe(3);
      expect(result.current.expandedIssueIds.has('issue-1')).toBe(false);
      expect(result.current.expandedIssueIds.has('issue-2')).toBe(false);
      expect(result.current.expandedIssueIds.has('issue-3')).toBe(true);
      expect(result.current.expandedIssueIds.has('issue-4')).toBe(true);
      expect(result.current.expandedIssueIds.has('issue-5')).toBe(true);
    });

    it('should handle empty array', () => {
      const { result } = renderHook(() => useIssueFilterStore());

      // First expand some issues
      act(() => {
        result.current.expandAllIssues(['issue-1', 'issue-2']);
      });

      expect(result.current.expandedIssueIds.size).toBe(2);

      // Then expand with empty array
      act(() => {
        result.current.expandAllIssues([]);
      });

      expect(result.current.expandedIssueIds.size).toBe(0);
    });

    it('should handle large number of issues', () => {
      const { result } = renderHook(() => useIssueFilterStore());
      const issueIds = Array.from({ length: 100 }, (_, i) => `issue-${i}`);

      act(() => {
        result.current.expandAllIssues(issueIds);
      });

      expect(result.current.expandedIssueIds.size).toBe(100);
      issueIds.forEach((id) => {
        expect(result.current.expandedIssueIds.has(id)).toBe(true);
      });
    });
  });

  describe('collapseAllIssues', () => {
    it('should clear all expanded issues', () => {
      const { result } = renderHook(() => useIssueFilterStore());

      // First expand some issues
      act(() => {
        result.current.expandAllIssues(['issue-1', 'issue-2', 'issue-3']);
      });

      expect(result.current.expandedIssueIds.size).toBe(3);

      // Then collapse all
      act(() => {
        result.current.collapseAllIssues();
      });

      expect(result.current.expandedIssueIds.size).toBe(0);
    });

    it('should work when no issues are expanded', () => {
      const { result } = renderHook(() => useIssueFilterStore());

      expect(result.current.expandedIssueIds.size).toBe(0);

      act(() => {
        result.current.collapseAllIssues();
      });

      expect(result.current.expandedIssueIds.size).toBe(0);
    });

    it('should create a new empty Set', () => {
      const { result } = renderHook(() => useIssueFilterStore());

      act(() => {
        result.current.expandAllIssues(['issue-1', 'issue-2']);
      });

      const firstSet = result.current.expandedIssueIds;

      act(() => {
        result.current.collapseAllIssues();
      });

      const secondSet = result.current.expandedIssueIds;

      // Should be different Set instances
      expect(firstSet).not.toBe(secondSet);
      expect(secondSet.size).toBe(0);
    });
  });

  describe('setSeverityFilter', () => {
    it('should set single severity filter', () => {
      const { result } = renderHook(() => useIssueFilterStore());
      const severities: Severity[] = ['critical'];

      act(() => {
        result.current.setSeverityFilter(severities);
      });

      expect(result.current.selectedSeverities).toEqual(['critical']);
    });

    it('should set multiple severity filters', () => {
      const { result } = renderHook(() => useIssueFilterStore());
      const severities: Severity[] = ['critical', 'serious', 'moderate'];

      act(() => {
        result.current.setSeverityFilter(severities);
      });

      expect(result.current.selectedSeverities).toEqual([
        'critical',
        'serious',
        'moderate',
      ]);
    });

    it('should set all severity levels', () => {
      const { result } = renderHook(() => useIssueFilterStore());
      const severities: Severity[] = ['critical', 'serious', 'moderate', 'minor'];

      act(() => {
        result.current.setSeverityFilter(severities);
      });

      expect(result.current.selectedSeverities).toEqual([
        'critical',
        'serious',
        'moderate',
        'minor',
      ]);
    });

    it('should replace previous severity filter', () => {
      const { result } = renderHook(() => useIssueFilterStore());

      act(() => {
        result.current.setSeverityFilter(['critical', 'serious']);
      });

      expect(result.current.selectedSeverities).toEqual(['critical', 'serious']);

      act(() => {
        result.current.setSeverityFilter(['moderate', 'minor']);
      });

      expect(result.current.selectedSeverities).toEqual(['moderate', 'minor']);
    });

    it('should handle empty severity array', () => {
      const { result } = renderHook(() => useIssueFilterStore());

      act(() => {
        result.current.setSeverityFilter(['critical', 'serious']);
      });

      expect(result.current.selectedSeverities.length).toBe(2);

      act(() => {
        result.current.setSeverityFilter([]);
      });

      expect(result.current.selectedSeverities).toEqual([]);
    });
  });

  describe('setSearchQuery', () => {
    it('should set search query string', () => {
      const { result } = renderHook(() => useIssueFilterStore());
      const query = 'form label';

      act(() => {
        result.current.setSearchQuery(query);
      });

      expect(result.current.searchQuery).toBe('form label');
    });

    it('should update existing search query', () => {
      const { result } = renderHook(() => useIssueFilterStore());

      act(() => {
        result.current.setSearchQuery('first query');
      });

      expect(result.current.searchQuery).toBe('first query');

      act(() => {
        result.current.setSearchQuery('second query');
      });

      expect(result.current.searchQuery).toBe('second query');
    });

    it('should handle empty string', () => {
      const { result } = renderHook(() => useIssueFilterStore());

      act(() => {
        result.current.setSearchQuery('some query');
      });

      expect(result.current.searchQuery).toBe('some query');

      act(() => {
        result.current.setSearchQuery('');
      });

      expect(result.current.searchQuery).toBe('');
    });

    it('should preserve whitespace', () => {
      const { result } = renderHook(() => useIssueFilterStore());
      const query = '  leading and trailing  ';

      act(() => {
        result.current.setSearchQuery(query);
      });

      expect(result.current.searchQuery).toBe('  leading and trailing  ');
    });
  });

  describe('resetFilters', () => {
    it('should reset severity filter to empty array', () => {
      const { result } = renderHook(() => useIssueFilterStore());

      act(() => {
        result.current.setSeverityFilter(['critical', 'serious', 'moderate']);
      });

      expect(result.current.selectedSeverities.length).toBe(3);

      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.selectedSeverities).toEqual([]);
    });

    it('should reset search query to empty string', () => {
      const { result } = renderHook(() => useIssueFilterStore());

      act(() => {
        result.current.setSearchQuery('test query');
      });

      expect(result.current.searchQuery).toBe('test query');

      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.searchQuery).toBe('');
    });

    it('should reset both severity and search query', () => {
      const { result } = renderHook(() => useIssueFilterStore());

      act(() => {
        result.current.setSeverityFilter(['critical', 'serious']);
        result.current.setSearchQuery('accessibility');
      });

      expect(result.current.selectedSeverities.length).toBe(2);
      expect(result.current.searchQuery).toBe('accessibility');

      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.selectedSeverities).toEqual([]);
      expect(result.current.searchQuery).toBe('');
    });

    it('should NOT reset expanded issues', () => {
      const { result } = renderHook(() => useIssueFilterStore());

      act(() => {
        result.current.expandAllIssues(['issue-1', 'issue-2']);
        result.current.setSeverityFilter(['critical']);
        result.current.setSearchQuery('test');
      });

      expect(result.current.expandedIssueIds.size).toBe(2);

      act(() => {
        result.current.resetFilters();
      });

      // Expanded issues should remain expanded
      expect(result.current.expandedIssueIds.size).toBe(2);
      expect(result.current.expandedIssueIds.has('issue-1')).toBe(true);
      expect(result.current.expandedIssueIds.has('issue-2')).toBe(true);
    });

    it('should work when filters are already empty', () => {
      const { result } = renderHook(() => useIssueFilterStore());

      expect(result.current.selectedSeverities).toEqual([]);
      expect(result.current.searchQuery).toBe('');

      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.selectedSeverities).toEqual([]);
      expect(result.current.searchQuery).toBe('');
    });
  });

  describe('Combined operations', () => {
    it('should handle multiple state changes in sequence', () => {
      const { result } = renderHook(() => useIssueFilterStore());

      act(() => {
        result.current.toggleIssueExpanded('issue-1');
        result.current.setSeverityFilter(['critical']);
        result.current.setSearchQuery('button');
      });

      expect(result.current.expandedIssueIds.has('issue-1')).toBe(true);
      expect(result.current.selectedSeverities).toEqual(['critical']);
      expect(result.current.searchQuery).toBe('button');
    });

    it('should handle expand all followed by toggle', () => {
      const { result } = renderHook(() => useIssueFilterStore());

      act(() => {
        result.current.expandAllIssues(['issue-1', 'issue-2', 'issue-3']);
      });

      expect(result.current.expandedIssueIds.size).toBe(3);

      // Toggle one issue off
      act(() => {
        result.current.toggleIssueExpanded('issue-2');
      });

      expect(result.current.expandedIssueIds.size).toBe(2);
      expect(result.current.expandedIssueIds.has('issue-1')).toBe(true);
      expect(result.current.expandedIssueIds.has('issue-2')).toBe(false);
      expect(result.current.expandedIssueIds.has('issue-3')).toBe(true);
    });

    it('should maintain filter state when toggling expanded issues', () => {
      const { result } = renderHook(() => useIssueFilterStore());

      act(() => {
        result.current.setSeverityFilter(['critical', 'serious']);
        result.current.setSearchQuery('form');
        result.current.toggleIssueExpanded('issue-1');
      });

      expect(result.current.selectedSeverities).toEqual(['critical', 'serious']);
      expect(result.current.searchQuery).toBe('form');
      expect(result.current.expandedIssueIds.has('issue-1')).toBe(true);
    });

    it('should maintain expanded state when changing filters', () => {
      const { result } = renderHook(() => useIssueFilterStore());

      act(() => {
        result.current.expandAllIssues(['issue-1', 'issue-2']);
        result.current.setSeverityFilter(['critical']);
        result.current.setSearchQuery('test');
      });

      expect(result.current.expandedIssueIds.size).toBe(2);
      expect(result.current.selectedSeverities).toEqual(['critical']);
      expect(result.current.searchQuery).toBe('test');
    });
  });
});

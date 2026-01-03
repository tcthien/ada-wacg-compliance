'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIssueFilterStore, type Severity } from '@/stores/issue-filter-store';
import { useAnalyticsContext } from '@/components/features/analytics';
import type { IssueListInteractionEvent, IssueSeverityFilterEvent } from '@/lib/analytics.types';
import type { Issue } from './IssueList';

interface IssueListControlsProps {
  issues: Issue[];
}

/**
 * IssueListControls component provides expand/collapse buttons, issue counts,
 * and severity filter chips for managing the issue list display.
 */
export function IssueListControls({ issues }: IssueListControlsProps) {
  const {
    selectedSeverities,
    setSeverityFilter,
    expandAllIssues,
    collapseAllIssues,
  } = useIssueFilterStore();
  const { track } = useAnalyticsContext();

  // Helper to get session ID
  const getSessionId = () =>
    typeof window !== 'undefined' ? window.sessionStorage.getItem('sessionId') || '' : '';

  // Calculate issue counts by severity
  const counts = {
    critical: issues.filter((i) => i.impact === 'critical').length,
    serious: issues.filter((i) => i.impact === 'serious').length,
    moderate: issues.filter((i) => i.impact === 'moderate').length,
    minor: issues.filter((i) => i.impact === 'minor').length,
  };

  const totalCount = issues.length;

  // Handle expand all issues
  const handleExpandAll = () => {
    const allIds = issues.map((issue) => issue.id);
    expandAllIssues(allIds);

    // Track expand all analytics event
    const event: IssueListInteractionEvent = {
      event: 'issue_expand_all',
      issue_count: totalCount,
      timestamp: new Date().toISOString(),
      sessionId: getSessionId(),
    };
    track(event);
  };

  // Handle collapse all issues
  const handleCollapseAll = () => {
    collapseAllIssues();

    // Track collapse all analytics event
    const event: IssueListInteractionEvent = {
      event: 'issue_collapse_all',
      issue_count: totalCount,
      timestamp: new Date().toISOString(),
      sessionId: getSessionId(),
    };
    track(event);
  };

  // Toggle severity filter
  const toggleSeverity = (severity: Severity) => {
    let newSeverities: Severity[];
    if (selectedSeverities.includes(severity)) {
      // Remove severity from filter
      newSeverities = selectedSeverities.filter((s) => s !== severity);
    } else {
      // Add severity to filter
      newSeverities = [...selectedSeverities, severity];
    }

    setSeverityFilter(newSeverities);

    // Calculate filtered count for analytics
    const filteredCount =
      newSeverities.length > 0
        ? issues.filter((i) => newSeverities.includes(i.impact as Severity)).length
        : totalCount;

    // Track severity filter analytics event
    const event: IssueSeverityFilterEvent = {
      event: 'issue_severity_filter',
      severities: newSeverities,
      filtered_count: filteredCount,
      total_count: totalCount,
      timestamp: new Date().toISOString(),
      sessionId: getSessionId(),
    };
    track(event);
  };

  // Check if a severity is active
  const isSeverityActive = (severity: Severity) => {
    return selectedSeverities.includes(severity);
  };

  // Severity badge styling
  const severityStyles = {
    critical: {
      active: 'bg-red-500 text-white hover:bg-red-600 border-red-500',
      inactive: 'bg-red-50 text-red-700 hover:bg-red-100 border-red-200',
    },
    serious: {
      active: 'bg-orange-500 text-white hover:bg-orange-600 border-orange-500',
      inactive: 'bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200',
    },
    moderate: {
      active: 'bg-yellow-500 text-white hover:bg-yellow-600 border-yellow-500',
      inactive: 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200',
    },
    minor: {
      active: 'bg-blue-500 text-white hover:bg-blue-600 border-blue-500',
      inactive: 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200',
    },
  };

  return (
    <div className="space-y-4">
      {/* Top row: Expand/Collapse buttons and issue counts */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Expand/Collapse buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExpandAll}
            className="gap-2"
            aria-label="Expand all issues"
          >
            <ChevronDown className="h-4 w-4" />
            Expand All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCollapseAll}
            className="gap-2"
            aria-label="Collapse all issues"
          >
            <ChevronUp className="h-4 w-4" />
            Collapse All
          </Button>
        </div>

        {/* Issue counts summary */}
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium">{totalCount} total issues:</span>
          {counts.critical > 0 && (
            <span className="text-red-600 font-medium">
              {counts.critical} Critical
            </span>
          )}
          {counts.serious > 0 && (
            <>
              {counts.critical > 0 && <span>•</span>}
              <span className="text-orange-600 font-medium">
                {counts.serious} Serious
              </span>
            </>
          )}
          {counts.moderate > 0 && (
            <>
              {(counts.critical > 0 || counts.serious > 0) && <span>•</span>}
              <span className="text-yellow-600 font-medium">
                {counts.moderate} Moderate
              </span>
            </>
          )}
          {counts.minor > 0 && (
            <>
              {(counts.critical > 0 || counts.serious > 0 || counts.moderate > 0) && (
                <span>•</span>
              )}
              <span className="text-blue-600 font-medium">
                {counts.minor} Minor
              </span>
            </>
          )}
        </div>
      </div>

      {/* Severity filter chips (only show if >20 issues) */}
      {totalCount > 20 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by severity">
          {(Object.keys(counts) as Severity[]).map((severity) => {
            const count = counts[severity];
            if (count === 0) return null;

            const isActive = isSeverityActive(severity);
            const styles = severityStyles[severity];

            return (
              <button
                key={severity}
                onClick={() => toggleSeverity(severity)}
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                  isActive ? styles.active : styles.inactive
                }`}
                aria-pressed={isActive}
                aria-label={`${isActive ? 'Hide' : 'Show'} ${severity} issues (${count})`}
              >
                {severity.charAt(0).toUpperCase() + severity.slice(1)} ({count})
              </button>
            );
          })}
          {selectedSeverities.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSeverityFilter([])}
              className="h-7 text-xs"
              aria-label="Clear all filters"
            >
              Clear filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

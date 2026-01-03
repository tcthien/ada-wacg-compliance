'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import type { UrlIssueSummaryDetailed } from '@/lib/batch-api';
import { getStatusColors } from '@/lib/status-colors';

interface BatchUrlListProps {
  urls: UrlIssueSummaryDetailed[];
}

type SortOption = 'issue-count' | 'severity' | 'url';

const SORT_STORAGE_KEY = 'batch-url-list-sort';

/**
 * Custom hook for responsive mobile detection
 * Detects viewport width < 640px (mobile breakpoint)
 */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Check initial viewport
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };

    checkMobile();

    // Listen for resize events
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return { isMobile, mounted };
}

/**
 * BatchUrlList Component
 *
 * Displays a list of URLs from a batch scan with issue counts and status.
 * Each URL can be expanded to show detailed severity breakdown.
 * Clicking a URL navigates to its individual scan result page.
 *
 * Requirements:
 * - 3.3: User can navigate between URL results within batch
 * - 3.5: Results shall include per-URL issue breakdown
 * - 3.6: Clicking URL navigates to individual scan results page
 * - 5.3: Allow sorting by issue count, severity, or URL
 * - 5.4: Display specific failure reason inline for failed URLs
 * - 8.5: Collapse URL details by default on mobile with tap-to-expand
 *
 * Features:
 * - Expandable/collapsible URL cards
 * - Color-coded severity badges
 * - Failed URLs show error message inline (always visible)
 * - Link to individual scan result page (/scan/{scanId})
 * - Status indicators (completed, failed, running, pending)
 * - Sorting controls for completed scans (issue count, severity, URL)
 * - Sort preference persisted in sessionStorage
 * - Leverages IssueCard/IssueList component pattern
 * - Mobile-responsive: Collapsed by default on mobile (<640px)
 * - Full-width cards with touch-friendly spacing on mobile
 *
 * @example
 * ```tsx
 * <BatchUrlList urls={batchResults.urls} />
 * ```
 */
export function BatchUrlList({ urls }: BatchUrlListProps) {
  const { isMobile, mounted: mobileDetected } = useIsMobile();
  // Load sort preference from sessionStorage
  const [sortBy, setSortBy] = useState<SortOption>('issue-count');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedSort = sessionStorage.getItem(SORT_STORAGE_KEY);
    if (savedSort && ['issue-count', 'severity', 'url'].includes(savedSort)) {
      setSortBy(savedSort as SortOption);
    }
  }, []);

  // Persist sort preference to sessionStorage
  const handleSortChange = (newSort: SortOption) => {
    setSortBy(newSort);
    sessionStorage.setItem(SORT_STORAGE_KEY, newSort);
  };

  // Sort URLs (only completed scans)
  const sortedUrls = useMemo(() => {
    const completedUrls = urls.filter((url) => url.status === 'COMPLETED');
    const otherUrls = urls.filter((url) => url.status !== 'COMPLETED');

    // Sort completed URLs based on selected option
    const sorted = [...completedUrls].sort((a, b) => {
      if (sortBy === 'issue-count') {
        return b.totalIssues - a.totalIssues; // Descending (most issues first)
      } else if (sortBy === 'severity') {
        // Sort by highest severity level first (critical > serious > moderate > minor)
        const getSeverityScore = (url: UrlIssueSummaryDetailed) => {
          if (url.criticalCount > 0) return 4;
          if (url.seriousCount > 0) return 3;
          if (url.moderateCount > 0) return 2;
          if (url.minorCount > 0) return 1;
          return 0;
        };
        return getSeverityScore(b) - getSeverityScore(a); // Descending
      } else {
        // Sort alphabetically by URL
        return a.url.localeCompare(b.url); // Ascending
      }
    });

    // Return sorted completed URLs followed by other URLs (maintain original order)
    return [...sorted, ...otherUrls];
  }, [urls, sortBy]);

  const hasCompletedScans = urls.some((url) => url.status === 'COMPLETED');

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-3">
        <h3 className="text-lg font-semibold">URL Results</h3>

        {/* Sort Controls - Only show if there are completed scans */}
        {hasCompletedScans && mounted && (
          <div className="flex items-center gap-2">
            <label htmlFor="sort-select" className="text-sm text-muted-foreground">
              Sort by:
            </label>
            <select
              id="sort-select"
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value as SortOption)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="issue-count">Issue Count</option>
              <option value="severity">Severity</option>
              <option value="url">URL (A-Z)</option>
            </select>
          </div>
        )}
      </div>

      {urls.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          No URLs in this batch.
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-3">
          {sortedUrls.map((url) => (
            <UrlCard key={url.id} url={url} isMobile={isMobile} mobileDetected={mobileDetected} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * UrlCard Component
 *
 * Individual URL card with expandable details.
 * Shows status, issue counts, and links to detailed results.
 *
 * Mobile-friendly features:
 * - Collapsed by default on mobile (<640px)
 * - Touch-friendly tap-to-expand interaction
 * - Full-width cards with adequate spacing for touch targets
 */
interface UrlCardProps {
  url: UrlIssueSummaryDetailed;
  isMobile: boolean;
  mobileDetected: boolean;
}

function UrlCard({ url, isMobile, mobileDetected }: UrlCardProps) {
  // Initialize expanded state based on viewport:
  // - Mobile (<640px): Collapsed by default
  // - Desktop (>=640px): Expanded by default
  const [expanded, setExpanded] = useState(false);

  // Update expanded state when viewport changes, only after mobile detection is complete
  useEffect(() => {
    if (mobileDetected) {
      // On mobile: collapsed by default
      // On desktop: keep current state (user may have toggled)
      if (isMobile) {
        setExpanded(false);
      }
    }
  }, [isMobile, mobileDetected]);

  // Status-based styling
  const isCompleted = url.status === 'COMPLETED';
  const isFailed = url.status === 'FAILED';
  const isRunning = url.status === 'RUNNING';
  const isPending = url.status === 'PENDING';

  // Border color based on status or severity
  let borderColorClass = '';
  if (isFailed) {
    borderColorClass = getStatusColors('failed').border;
  } else if (isRunning) {
    borderColorClass = getStatusColors('running').border;
  } else if (isPending) {
    borderColorClass = getStatusColors('pending').border;
  } else if (isCompleted) {
    // For completed scans, use status color by default
    // (severity-based border colors are handled separately for issue severity breakdown)
    borderColorClass = getStatusColors('completed').border;
  } else {
    // Fallback for any other status
    borderColorClass = getStatusColors('pending').border;
  }

  return (
    <div className={`border rounded-lg ${borderColorClass} bg-card w-full`}>
      {/* Header - Always visible, with touch-friendly padding on mobile */}
      <button
        className="w-full p-4 sm:p-4 text-left flex justify-between items-start hover:bg-accent/50 transition-colors active:bg-accent/70 touch-manipulation min-h-[80px] sm:min-h-0"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-label={expanded ? 'Collapse URL details' : 'Expand URL details'}
      >
        <div className="flex-1 min-w-0 pr-4">
          {/* URL and Title */}
          <div className="mb-2">
            {url.pageTitle && (
              <div className="font-medium text-sm text-gray-900 truncate mb-1">
                {url.pageTitle}
              </div>
            )}
            <div
              className="text-sm text-muted-foreground truncate"
              title={url.url}
            >
              {url.url}
            </div>
          </div>

          {/* Status and Issue Count Summary */}
          <div className="flex items-center gap-3 flex-wrap">
            <StatusBadge status={url.status} />

            {isCompleted && (
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-gray-900">
                  {url.totalIssues}
                </span>{' '}
                issue{url.totalIssues !== 1 ? 's' : ''}
              </div>
            )}
          </div>

          {/* Inline Error Message for Failed URLs */}
          {isFailed && url.errorMessage && (
            <div className={`mt-3 p-3 rounded-md border ${getStatusColors('failed').bg} ${getStatusColors('failed').border}`}>
              <div className="flex items-start gap-2">
                <svg
                  className={`w-5 h-5 flex-shrink-0 mt-0.5 ${getStatusColors('failed').icon}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div className="flex-1">
                  <p className={`text-sm font-medium mb-1 ${getStatusColors('failed').text}`}>Scan Failed</p>
                  <p className={`text-sm ${getStatusColors('failed').text}`}>{url.errorMessage}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Expand/Collapse Icon */}
        <ChevronIcon expanded={expanded} />
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t">
          {/* Completed URL - Show Severity Breakdown */}
          {isCompleted && (
            <div className="pt-4 space-y-4">
              {/* Severity Breakdown */}
              <div>
                <h4 className="text-sm font-medium mb-3">Issue Breakdown</h4>
                <div className="grid grid-cols-2 gap-3 sm:gap-2">
                  <SeverityItem
                    label="Critical"
                    count={url.criticalCount}
                    color="critical"
                  />
                  <SeverityItem
                    label="Serious"
                    count={url.seriousCount}
                    color="serious"
                  />
                  <SeverityItem
                    label="Moderate"
                    count={url.moderateCount}
                    color="moderate"
                  />
                  <SeverityItem
                    label="Minor"
                    count={url.minorCount}
                    color="minor"
                  />
                </div>
              </div>

              {/* View Full Results Link */}
              <Link
                href={`/scan/${url.id}`}
                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium min-h-[44px] sm:min-h-0 touch-manipulation active:text-blue-900"
              >
                View Full Results
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            </div>
          )}

          {/* Running/Pending Status */}
          {(isRunning || isPending) && (
            <div className="pt-4">
              <div className={`p-3 rounded border text-sm ${isRunning ? getStatusColors('running').bg : getStatusColors('pending').bg} ${isRunning ? getStatusColors('running').border : getStatusColors('pending').border} ${isRunning ? getStatusColors('running').text : getStatusColors('pending').text}`}>
                {isRunning
                  ? 'This scan is currently running...'
                  : 'This scan is pending...'}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * StatusBadge Component
 *
 * Displays scan status with appropriate color coding.
 * Uses centralized status colors from lib/status-colors for consistency.
 */
interface StatusBadgeProps {
  status: string;
}

function StatusBadge({ status }: StatusBadgeProps) {
  // Map database status values to color system status values
  const statusMap: Record<string, string> = {
    COMPLETED: 'completed',
    FAILED: 'failed',
    RUNNING: 'running',
    PENDING: 'pending',
    CANCELLED: 'cancelled',
    STALE: 'stale',
  };

  const normalizedStatus = statusMap[status] || 'pending';
  const colors = getStatusColors(normalizedStatus);

  return (
    <span
      className={`inline-block px-2 py-1 rounded text-xs font-medium border ${colors.bg} ${colors.text} ${colors.border}`}
    >
      {status}
    </span>
  );
}

/**
 * SeverityItem Component
 *
 * Displays a single severity level count with color coding.
 * Follows the same pattern as BatchSummary's SummaryCard.
 * Note: These are severity colors (for WCAG issue levels), not status colors.
 */
interface SeverityItemProps {
  label: string;
  count: number;
  color: 'critical' | 'serious' | 'moderate' | 'minor';
}

function SeverityItem({ label, count, color }: SeverityItemProps) {
  // Severity colors with dark mode support
  const colorClasses = {
    critical: 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200 border-red-200 dark:border-red-700',
    serious: 'bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-700',
    moderate: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-700',
    minor: 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700',
  };

  return (
    <div className={`p-3 rounded-lg border ${colorClasses[color]}`}>
      <div className="text-lg font-bold">{count}</div>
      <div className="text-xs">{label}</div>
    </div>
  );
}

/**
 * ChevronIcon Component
 *
 * Expand/collapse indicator icon.
 * Reused pattern from IssueCard component.
 */
interface ChevronIconProps {
  expanded: boolean;
}

function ChevronIcon({ expanded }: ChevronIconProps) {
  return (
    <svg
      className={`w-5 h-5 transition-transform flex-shrink-0 ${
        expanded ? 'transform rotate-180' : ''
      }`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );
}

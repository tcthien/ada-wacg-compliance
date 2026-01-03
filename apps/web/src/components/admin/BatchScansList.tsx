'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UrlIssueSummaryDetailed } from '@/lib/batch-api';

/**
 * Props for the BatchScansList component
 */
interface BatchScansListProps {
  /** Array of scans in the batch with detailed issue counts */
  scans: UrlIssueSummaryDetailed[];
  /** Loading state - shows skeleton when true */
  loading?: boolean;
  /** ID of scan to highlight and scroll to */
  highlightScanId?: string | null;
}

/**
 * Skeleton loading state component
 */
function SkeletonRow() {
  return (
    <div className="border-b border-gray-200 p-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-4 w-4 bg-gray-200 rounded"></div>
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 bg-gray-200 rounded"></div>
          <div className="h-3 w-1/2 bg-gray-200 rounded"></div>
        </div>
        <div className="flex gap-2">
          <div className="h-6 w-16 bg-gray-200 rounded-full"></div>
          <div className="h-6 w-20 bg-gray-200 rounded-full"></div>
        </div>
      </div>
    </div>
  );
}

/**
 * Status badge component
 */
function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    PENDING: {
      label: 'Pending',
      className: 'bg-gray-100 text-gray-800 border-gray-300',
      icon: <Clock className="h-3 w-3" />,
    },
    RUNNING: {
      label: 'Running',
      className: 'bg-blue-100 text-blue-800 border-blue-300',
      icon: <Clock className="h-3 w-3 animate-spin" />,
    },
    COMPLETED: {
      label: 'Completed',
      className: 'bg-green-100 text-green-800 border-green-300',
      icon: <CheckCircle className="h-3 w-3" />,
    },
    FAILED: {
      label: 'Failed',
      className: 'bg-red-100 text-red-800 border-red-300',
      icon: <XCircle className="h-3 w-3" />,
    },
  };

  const config = statusConfig[status] || {
    label: status,
    className: 'bg-gray-100 text-gray-800 border-gray-300',
    icon: <AlertCircle className="h-3 w-3" />,
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border',
        config.className
      )}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

/**
 * Issue breakdown badges component
 */
function IssueBreakdown({ scan }: { scan: UrlIssueSummaryDetailed }) {
  if (scan.status !== 'COMPLETED' || scan.totalIssues === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {scan.criticalCount > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold bg-red-100 text-red-800 rounded border border-red-300">
          <AlertTriangle className="h-3 w-3" />
          {scan.criticalCount} Critical
        </span>
      )}
      {scan.seriousCount > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded border border-orange-300">
          {scan.seriousCount} Serious
        </span>
      )}
      {scan.moderateCount > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded border border-yellow-300">
          {scan.moderateCount} Moderate
        </span>
      )}
      {scan.minorCount > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded border border-blue-300">
          {scan.minorCount} Minor
        </span>
      )}
    </div>
  );
}

/**
 * Props for ScanRow component
 */
interface ScanRowProps {
  scan: UrlIssueSummaryDetailed;
  isHighlighted?: boolean;
}

/**
 * Expandable scan row component
 */
function ScanRow({ scan, isHighlighted = false }: ScanRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showHighlight, setShowHighlight] = useState(isHighlighted);
  const rowRef = useRef<HTMLDivElement>(null);
  const hasCriticalIssues = scan.criticalCount > 0;
  const hasError = scan.status === 'FAILED' && scan.errorMessage;
  const isExpandable = hasError || (scan.status === 'COMPLETED' && scan.totalIssues > 0);

  // Handle highlight animation and scroll on mount
  useEffect(() => {
    if (isHighlighted && rowRef.current) {
      // Scroll into view
      rowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Remove highlight after 3 seconds
      const timer = setTimeout(() => {
        setShowHighlight(false);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isHighlighted]);

  /**
   * Truncate URL for display
   */
  const truncateUrl = (url: string, maxLength = 60) => {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + '...';
  };

  return (
    <div
      ref={rowRef}
      className={cn(
        'border-b border-gray-200 transition-colors duration-500',
        hasCriticalIssues && !showHighlight && 'bg-red-50 border-red-200',
        showHighlight && 'bg-yellow-100 border-yellow-300',
        !showHighlight && 'hover:bg-gray-50'
      )}
    >
      {/* Main Row */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Expand/Collapse Button */}
          {isExpandable && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex-shrink-0 p-1 hover:bg-gray-200 rounded transition-colors"
              aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
              aria-expanded={isExpanded}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-gray-600" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-600" />
              )}
            </button>
          )}
          {!isExpandable && <div className="w-6" />}

          {/* Scan Info */}
          <div className="flex-1 min-w-0">
            {/* Page Title */}
            {scan.pageTitle && (
              <div className="font-medium text-sm text-gray-900 mb-1">
                {scan.pageTitle}
              </div>
            )}

            {/* URL */}
            <div className="flex items-center gap-2 mb-2">
              <a
                href={scan.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800 hover:underline truncate"
                title={scan.url}
              >
                {truncateUrl(scan.url)}
              </a>
              <ExternalLink className="h-3 w-3 text-gray-400 flex-shrink-0" />
            </div>

            {/* Issue Breakdown (inline for completed scans) */}
            {scan.status === 'COMPLETED' && (
              <IssueBreakdown scan={scan} />
            )}
          </div>

          {/* Status and Issue Count */}
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <StatusBadge status={scan.status} />

            {scan.status === 'COMPLETED' && (
              <div className="flex items-center gap-2">
                {hasCriticalIssues && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold bg-red-600 text-white rounded">
                    <AlertTriangle className="h-3 w-3" />
                    CRITICAL
                  </span>
                )}
                <span className="text-sm font-semibold text-gray-900">
                  {scan.totalIssues} {scan.totalIssues === 1 ? 'issue' : 'issues'}
                </span>
              </div>
            )}

            {/* Link to Detail Page */}
            {scan.status === 'COMPLETED' && (
              <Link
                href={`/admin/scans/${scan.id}`}
                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
              >
                View Details
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-0">
          <div className="pl-9 border-l-2 border-gray-300 ml-3">
            {/* Error Details for Failed Scans */}
            {hasError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-3">
                <div className="flex items-start gap-2 mb-2">
                  <XCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-red-900 mb-1">
                      Error Details
                    </h4>
                    <p className="text-sm text-red-800 mb-2">
                      {scan.errorMessage}
                    </p>

                    {/* Show error stack trace if available */}
                    {scan.errorMessage && scan.errorMessage.includes('\n') && (
                      <details className="mt-2">
                        <summary className="text-xs font-medium text-red-900 cursor-pointer hover:text-red-700">
                          View Stack Trace
                        </summary>
                        <pre className="mt-2 p-3 bg-red-100 rounded text-xs font-mono text-red-900 overflow-x-auto whitespace-pre-wrap break-words">
                          {scan.errorMessage}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Issue Breakdown for Completed Scans */}
            {scan.status === 'COMPLETED' && scan.totalIssues > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">
                  Issue Breakdown by Severity
                </h4>
                <div className="space-y-2">
                  {scan.criticalCount > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Critical</span>
                      <span className="text-sm font-semibold text-red-600">
                        {scan.criticalCount}
                      </span>
                    </div>
                  )}
                  {scan.seriousCount > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Serious</span>
                      <span className="text-sm font-semibold text-orange-600">
                        {scan.seriousCount}
                      </span>
                    </div>
                  )}
                  {scan.moderateCount > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Moderate</span>
                      <span className="text-sm font-semibold text-yellow-600">
                        {scan.moderateCount}
                      </span>
                    </div>
                  )}
                  {scan.minorCount > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Minor</span>
                      <span className="text-sm font-semibold text-blue-600">
                        {scan.minorCount}
                      </span>
                    </div>
                  )}
                  <div className="pt-2 mt-2 border-t border-gray-300">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-900">Total</span>
                      <span className="text-sm font-bold text-gray-900">
                        {scan.totalIssues}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Link to Detail Page */}
                <div className="mt-4 pt-3 border-t border-gray-300">
                  <Link
                    href={`/admin/scans/${scan.id}`}
                    className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View Full Scan Details
                  </Link>
                </div>
              </div>
            )}

            {/* No Issues State */}
            {scan.status === 'COMPLETED' && scan.totalIssues === 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm font-semibold text-green-900">
                      No Accessibility Issues Found
                    </p>
                    <p className="text-sm text-green-700 mt-1">
                      This page passed all automated accessibility checks.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Empty state component
 */
function EmptyState() {
  return (
    <div className="p-12 text-center">
      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
        <AlertCircle className="h-6 w-6 text-gray-400" />
      </div>
      <p className="text-sm font-medium text-gray-900 mb-1">
        No Scans Found
      </p>
      <p className="text-sm text-gray-600">
        This batch does not contain any scans yet.
      </p>
    </div>
  );
}

/**
 * BatchScansList component
 *
 * This component:
 * - Displays a list of all individual scans in a batch
 * - Shows URL (truncated), page title, status badge, and issue counts
 * - Expandable rows for additional details:
 *   - Error message and stack trace for failed scans
 *   - Issue breakdown by severity level for completed scans
 *   - Link to individual scan detail page (/admin/scans/:id)
 * - Visual highlighting for rows with critical issues (red background)
 * - Collapsible accordion pattern for row expansion
 * - Provides loading skeleton state
 *
 * Requirements:
 * - REQ 2.2: Display list of all individual scans showing: URL, Page title, Status, Issue counts, Error message, Completion time
 * - REQ 2.3: Allow expanding individual scan rows to see: Full error stack trace (for failed scans), Issue breakdown by impact level, Link to individual scan detail page
 *
 * Design Pattern:
 * - Follows the expandable row pattern from BatchCriticalUrlsCard
 * - Uses accordion/collapsible pattern with ChevronDown/ChevronRight icons
 * - Consistent with admin table styling from ScanTable and BatchTable
 * - Visual indicators for critical issues (red background, warning badges)
 * - Clean card-based layout with proper spacing and borders
 */
export function BatchScansList({
  scans,
  loading = false,
  highlightScanId,
}: BatchScansListProps) {
  // Show skeleton during loading
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Individual Scans</h3>
        </div>
        <div>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Individual Scans</h3>
          <span className="text-sm text-gray-600">
            {scans.length} {scans.length === 1 ? 'scan' : 'scans'}
          </span>
        </div>
      </div>

      {/* Scans List */}
      {scans.length > 0 ? (
        <div>
          {scans.map((scan) => (
            <ScanRow
              key={scan.id}
              scan={scan}
              isHighlighted={highlightScanId === scan.id}
            />
          ))}
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

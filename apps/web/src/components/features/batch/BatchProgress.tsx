'use client';

import { useState, useMemo } from 'react';
import type { BatchStatusResponse } from '@/lib/batch-api';
import { useBatchResults } from '@/hooks/useBatchResults';

interface BatchScanInfo {
  id: string;
  url: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  pageTitle?: string | null | undefined;
  errorMessage?: string | null | undefined;
  completedAt?: string | null | undefined;
}

interface BatchAggregateStats {
  totalUrls: number;
  completedUrls: number;
  failedUrls: number;
  totalIssues: number;
  issuesBySeverity: {
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  };
  averageIssuesPerPage: number;
  worstPerformingUrls: { url: string; pageTitle?: string | null; issueCount: number }[];
}

interface BatchProgressData {
  totalUrls: number;
  completedCount: number;
  failedCount: number;
  urls?: BatchScanInfo[] | null | undefined;
  scans?: BatchScanInfo[] | null | undefined;
}

interface BatchProgressProps {
  batch: BatchProgressData;
  batchId: string;
}

interface BatchUrlGrouping {
  pending: BatchScanInfo[];
  scanning: BatchScanInfo[];
  completed: BatchScanInfo[];
  failed: BatchScanInfo[];
}

interface StatusGroupProps {
  title: string;
  icon: string;
  count: number;
  scans: BatchScanInfo[];
  expanded: boolean;
  onToggle: () => void;
  statusConfig: {
    PENDING: { icon: string; label: string; color: string };
    RUNNING: { icon: string; label: string; color: string };
    COMPLETED: { icon: string; label: string; color: string };
    FAILED: { icon: string; label: string; color: string };
  };
  headerClassName?: string;
  badgeClassName?: string;
}

/**
 * StatusGroup Component
 *
 * Collapsible group of URLs with the same status.
 * Includes count badge and status-specific styling.
 */
function StatusGroup({
  title,
  icon,
  count,
  scans,
  expanded,
  onToggle,
  statusConfig,
  headerClassName = 'bg-gray-50 border-gray-300',
  badgeClassName = 'bg-gray-100 text-gray-700',
}: StatusGroupProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Group Header - Clickable to expand/collapse */}
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between p-3 border ${headerClassName} hover:opacity-80 transition-opacity`}
        aria-expanded={expanded}
        aria-controls={`${title.toLowerCase()}-group`}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg" role="img" aria-label={`${title} status`}>
            {icon}
          </span>
          <h5 className="font-semibold text-sm">{title}</h5>
          {/* Count Badge */}
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${badgeClassName}`}
            aria-label={`${count} URLs`}
          >
            {count}
          </span>
        </div>
        {/* Expand/Collapse Icon */}
        <svg
          className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Group Content - Collapsible */}
      {expanded && (
        <div
          id={`${title.toLowerCase()}-group`}
          className="divide-y divide-gray-200 max-h-96 overflow-y-auto"
        >
          {scans.map((scan) => {
            const config = statusConfig[scan.status] ?? statusConfig.PENDING;

            return (
              <div
                key={scan.id}
                className="flex items-start gap-3 p-3 bg-white hover:bg-gray-50 transition-colors"
              >
                {/* Status icon */}
                <span
                  className={`text-xl flex-shrink-0 ${config.color}`}
                  role="img"
                  aria-label={`${config.label} status`}
                >
                  {config.icon}
                </span>

                {/* URL and title */}
                <div className="flex-1 min-w-0">
                  {scan.pageTitle && (
                    <div className="font-medium text-sm text-gray-900 truncate">
                      {scan.pageTitle}
                    </div>
                  )}
                  <div className="text-sm text-muted-foreground truncate" title={scan.url}>
                    {scan.url}
                  </div>

                  {/* Error message for failed scans */}
                  {scan.status === 'FAILED' && scan.errorMessage && (
                    <div className="mt-1 text-xs text-red-600 bg-red-50 p-2 rounded">
                      <strong>Error:</strong> {scan.errorMessage}
                    </div>
                  )}
                </div>

                {/* Status label */}
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full flex-shrink-0 ${
                    scan.status === 'COMPLETED'
                      ? 'bg-green-100 text-green-700'
                      : scan.status === 'FAILED'
                      ? 'bg-red-100 text-red-700'
                      : scan.status === 'RUNNING'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {config.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * BatchProgress Component
 *
 * Displays overall progress of a batch scan with individual URL statuses.
 * Includes accessibility features with ARIA live regions for screen readers.
 *
 * Features:
 * - Aggregate statistics card showing total issues, average per page, severity breakdown
 * - Overall progress bar showing X/Y scans complete
 * - Status grouping with collapsible sections (Pending, Scanning, Completed, Failed)
 * - Count badges for each status group
 * - ARIA live regions for dynamic updates
 * - Color-coded status icons for quick visual scanning
 * - Highlighted Failed group with red styling
 * - Real-time updates as scans complete
 *
 * @example
 * ```tsx
 * <BatchProgress batch={batchStatus} batchId={batchId} />
 * ```
 */
export function BatchProgress({ batch, batchId }: BatchProgressProps) {
  const totalComplete = batch.completedCount + batch.failedCount;
  const percentComplete = Math.round((totalComplete / batch.totalUrls) * 100);

  // Support both 'urls' and 'scans' property names
  const scanList = (batch.urls ?? batch.scans) ?? [];

  // Fetch batch results to get issue data for completed scans
  const { completedScans, aggregateStats } = useBatchResults(batchId, {
    enabled: batch.completedCount > 0, // Only fetch when there are completed scans
    pollInterval: 3000, // Poll every 3 seconds
  });

  // Calculate aggregate statistics from completed scans in real-time
  const stats: BatchAggregateStats | null = useMemo(() => {
    if (!aggregateStats || completedScans.length === 0) {
      return null;
    }

    // Get worst performing URLs (top 3 by total issues)
    const worstUrls = [...completedScans]
      .sort((a, b) => b.totalIssues - a.totalIssues)
      .slice(0, 3)
      .map((scan) => ({
        url: scan.url,
        pageTitle: scan.pageTitle,
        issueCount: scan.totalIssues,
      }));

    return {
      totalUrls: batch.totalUrls,
      completedUrls: batch.completedCount,
      failedUrls: batch.failedCount,
      totalIssues: aggregateStats.totalIssues,
      issuesBySeverity: {
        critical: aggregateStats.criticalCount,
        serious: aggregateStats.seriousCount,
        moderate: aggregateStats.moderateCount,
        minor: aggregateStats.minorCount,
      },
      averageIssuesPerPage: aggregateStats.averageIssuesPerPage,
      worstPerformingUrls: worstUrls,
    };
  }, [aggregateStats, completedScans, batch.totalUrls, batch.completedCount, batch.failedCount]);

  // Group URLs by status
  const groupedUrls: BatchUrlGrouping = {
    pending: scanList.filter(scan => scan.status === 'PENDING'),
    scanning: scanList.filter(scan => scan.status === 'RUNNING'),
    completed: scanList.filter(scan => scan.status === 'COMPLETED'),
    failed: scanList.filter(scan => scan.status === 'FAILED'),
  };

  // State for collapsible sections (default: all expanded, failed always visible)
  const [expandedSections, setExpandedSections] = useState({
    pending: true,
    scanning: true,
    completed: true,
    failed: true,
  });

  const toggleSection = (section: keyof BatchUrlGrouping) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Status icons and colors
  const statusConfig = {
    PENDING: { icon: '⏳', label: 'Pending', color: 'text-gray-500' },
    RUNNING: { icon: '🔄', label: 'Running', color: 'text-blue-600' },
    COMPLETED: { icon: '✅', label: 'Completed', color: 'text-green-600' },
    FAILED: { icon: '❌', label: 'Failed', color: 'text-red-600' },
  };

  return (
    <div className="space-y-6">
      {/* Aggregate Statistics Card - Shown when completed scans have results */}
      {stats && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">
            Scan Results Summary
          </h3>

          {/* Main Statistics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {/* Total Issues */}
            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
              <div className="text-3xl font-bold text-gray-900">{stats.totalIssues}</div>
              <div className="text-sm text-gray-600 mt-1">Total Issues</div>
            </div>

            {/* Average Issues Per Page */}
            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
              <div className="text-3xl font-bold text-gray-900">
                {stats.averageIssuesPerPage.toFixed(1)}
              </div>
              <div className="text-sm text-gray-600 mt-1">Avg. Issues/Page</div>
            </div>

            {/* Completed URLs */}
            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
              <div className="text-3xl font-bold text-green-600">{stats.completedUrls}</div>
              <div className="text-sm text-gray-600 mt-1">Completed</div>
            </div>

            {/* Failed URLs */}
            {stats.failedUrls > 0 && (
              <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                <div className="text-3xl font-bold text-red-600">{stats.failedUrls}</div>
                <div className="text-sm text-gray-600 mt-1">Failed</div>
              </div>
            )}
          </div>

          {/* Severity Breakdown */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
              Issues by Severity
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Critical */}
              <div className="bg-red-100 rounded-lg p-3 border border-red-200">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-red-800">
                    {stats.issuesBySeverity.critical}
                  </span>
                  <div className="text-xs text-red-700">
                    <div className="font-semibold">Critical</div>
                  </div>
                </div>
              </div>

              {/* Serious */}
              <div className="bg-orange-100 rounded-lg p-3 border border-orange-200">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-orange-800">
                    {stats.issuesBySeverity.serious}
                  </span>
                  <div className="text-xs text-orange-700">
                    <div className="font-semibold">Serious</div>
                  </div>
                </div>
              </div>

              {/* Moderate */}
              <div className="bg-yellow-100 rounded-lg p-3 border border-yellow-200">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-yellow-800">
                    {stats.issuesBySeverity.moderate}
                  </span>
                  <div className="text-xs text-yellow-700">
                    <div className="font-semibold">Moderate</div>
                  </div>
                </div>
              </div>

              {/* Minor */}
              <div className="bg-blue-100 rounded-lg p-3 border border-blue-200">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-blue-800">
                    {stats.issuesBySeverity.minor}
                  </span>
                  <div className="text-xs text-blue-700">
                    <div className="font-semibold">Minor</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Worst Performing URLs */}
          {stats.worstPerformingUrls.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                Pages with Most Issues
              </h4>
              <div className="space-y-2">
                {stats.worstPerformingUrls.map((item, index) => (
                  <div
                    key={item.url}
                    className="bg-white rounded-lg p-3 border border-gray-200 flex items-center gap-3 hover:border-gray-300 transition-colors"
                  >
                    {/* Rank Badge */}
                    <div className="flex-shrink-0 w-7 h-7 bg-gray-700 text-white rounded-full flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </div>

                    {/* URL and Title */}
                    <div className="flex-1 min-w-0">
                      {item.pageTitle && (
                        <div className="font-medium text-sm text-gray-900 truncate">
                          {item.pageTitle}
                        </div>
                      )}
                      <div className="text-xs text-gray-600 truncate" title={item.url}>
                        {item.url}
                      </div>
                    </div>

                    {/* Issue Count Badge */}
                    <div className="flex-shrink-0 px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-bold border border-red-200">
                      {item.issueCount} issues
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Note about partial results */}
          {stats.completedUrls < stats.totalUrls && (
            <div className="mt-4 text-xs text-gray-600 bg-blue-50 p-3 rounded border border-blue-200">
              <span className="font-medium">Note:</span> Showing partial results for{' '}
              {stats.completedUrls} of {stats.totalUrls} URLs. Statistics will update as more
              scans complete.
            </div>
          )}
        </div>
      )}

      {/* Overall Progress Section */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Batch Progress</h3>
          <span
            className="text-sm font-medium text-muted-foreground"
            aria-label={`${totalComplete} of ${batch.totalUrls} scans complete`}
          >
            {totalComplete}/{batch.totalUrls} complete
          </span>
        </div>

        {/* Progress bar */}
        <div className="relative">
          <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-500 ease-out"
              style={{ width: `${percentComplete}%` }}
              role="progressbar"
              aria-valuenow={percentComplete}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Batch scan progress"
            />
          </div>
          <span className="absolute right-2 top-0 text-xs font-medium text-gray-700">
            {percentComplete}%
          </span>
        </div>

        {/* Status counts */}
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>
            <span className="font-medium text-green-600">{batch.completedCount}</span> completed
          </span>
          {batch.failedCount > 0 && (
            <span>
              <span className="font-medium text-red-600">{batch.failedCount}</span> failed
            </span>
          )}
          <span>
            <span className="font-medium text-gray-600">
              {batch.totalUrls - totalComplete}
            </span> remaining
          </span>
        </div>
      </div>

      {/* ARIA live region for status updates - announces changes to screen readers */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {percentComplete === 100
          ? `Batch scan complete. ${batch.completedCount} successful, ${batch.failedCount} failed.`
          : `Scanning in progress. ${totalComplete} of ${batch.totalUrls} scans complete. ${percentComplete} percent done.`}
      </div>

      {/* Grouped URL Status List */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Individual Scans
        </h4>

        {/* Pending Group */}
        {groupedUrls.pending.length > 0 && (
          <StatusGroup
            title="Pending"
            icon="⏳"
            count={groupedUrls.pending.length}
            scans={groupedUrls.pending}
            expanded={expandedSections.pending}
            onToggle={() => toggleSection('pending')}
            statusConfig={statusConfig}
            headerClassName="bg-gray-50 border-gray-300"
            badgeClassName="bg-gray-100 text-gray-700"
          />
        )}

        {/* Scanning Group */}
        {groupedUrls.scanning.length > 0 && (
          <StatusGroup
            title="Scanning"
            icon="🔄"
            count={groupedUrls.scanning.length}
            scans={groupedUrls.scanning}
            expanded={expandedSections.scanning}
            onToggle={() => toggleSection('scanning')}
            statusConfig={statusConfig}
            headerClassName="bg-blue-50 border-blue-300"
            badgeClassName="bg-blue-100 text-blue-700"
          />
        )}

        {/* Completed Group */}
        {groupedUrls.completed.length > 0 && (
          <StatusGroup
            title="Completed"
            icon="✅"
            count={groupedUrls.completed.length}
            scans={groupedUrls.completed}
            expanded={expandedSections.completed}
            onToggle={() => toggleSection('completed')}
            statusConfig={statusConfig}
            headerClassName="bg-green-50 border-green-300"
            badgeClassName="bg-green-100 text-green-700"
          />
        )}

        {/* Failed Group - Highlighted with red styling */}
        {groupedUrls.failed.length > 0 && (
          <StatusGroup
            title="Failed"
            icon="❌"
            count={groupedUrls.failed.length}
            scans={groupedUrls.failed}
            expanded={expandedSections.failed}
            onToggle={() => toggleSection('failed')}
            statusConfig={statusConfig}
            headerClassName="bg-red-50 border-red-400 border-2"
            badgeClassName="bg-red-100 text-red-700 font-bold"
          />
        )}
      </div>

      {/* Additional ARIA live region for individual scan updates */}
      <div
        className="sr-only"
        role="log"
        aria-live="polite"
        aria-atomic="false"
      >
        {scanList
          .filter((scan) => scan.status === 'COMPLETED' || scan.status === 'FAILED')
          .map((scan) => (
            <div key={scan.id}>
              Scan {scan.status.toLowerCase()} for {scan.url}
              {scan.status === 'FAILED' && scan.errorMessage
                ? `. Error: ${scan.errorMessage}`
                : ''}
            </div>
          ))}
      </div>
    </div>
  );
}

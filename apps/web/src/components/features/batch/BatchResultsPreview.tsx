'use client';

import React from 'react';
import Link from 'next/link';
import type { UrlIssueSummaryDetailed } from '@/lib/batch-api';

interface BatchResultsPreviewProps {
  completedScans: UrlIssueSummaryDetailed[];
  totalScans: number;
}

/**
 * BatchResultsPreview Component
 *
 * Displays partial batch results as scans complete, allowing users to view
 * available results before the entire batch finishes.
 *
 * Requirements:
 * - 5.5: Allow viewing available results before batch completion
 *
 * Features:
 * - Show completed scans with issue counts
 * - Display severity summary per URL
 * - Link to individual scan results (/scan/{id})
 * - Progress indicator: "X of Y complete"
 * - Color-coded severity badges
 * - Responsive grid layout
 *
 * @example
 * ```tsx
 * <BatchResultsPreview
 *   completedScans={batch.urls.filter(u => u.status === 'COMPLETED')}
 *   totalScans={batch.totalUrls}
 * />
 * ```
 */
export function BatchResultsPreview({
  completedScans,
  totalScans,
}: BatchResultsPreviewProps) {
  const completedCount = completedScans.length;

  // Filter only successfully completed scans (not failed)
  const successfulScans = completedScans.filter(
    (scan) => scan.status === 'COMPLETED'
  );

  if (completedCount === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground bg-gray-50 rounded-lg border border-gray-200">
        <div className="text-2xl mb-2">⏳</div>
        <p className="text-sm">No results available yet. Scans are in progress...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress Header */}
      <div className="flex justify-between items-center pb-3 border-b">
        <h3 className="text-lg font-semibold">Available Results</h3>
        <span className="text-sm font-medium text-muted-foreground">
          {completedCount} of {totalScans} complete
        </span>
      </div>

      {/* Info Banner */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-2">
          <span className="text-blue-600 text-lg flex-shrink-0">ℹ️</span>
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Partial Results Available</p>
            <p className="text-blue-700">
              {successfulScans.length} {successfulScans.length === 1 ? 'scan has' : 'scans have'} completed successfully.
              You can view {successfulScans.length === 1 ? 'this result' : 'these results'} while the remaining scans finish.
            </p>
          </div>
        </div>
      </div>

      {/* Completed Scans Grid */}
      {successfulScans.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {successfulScans.map((scan) => (
            <ResultPreviewCard key={scan.id} scan={scan} />
          ))}
        </div>
      ) : (
        <div className="p-6 text-center text-muted-foreground bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm">
            All completed scans have failed. Check the progress section for error details.
          </p>
        </div>
      )}

      {/* Footer Note */}
      {completedCount < totalScans && (
        <div className="pt-3 text-xs text-muted-foreground text-center">
          {totalScans - completedCount} {totalScans - completedCount === 1 ? 'scan' : 'scans'} still in progress.
          This section will update automatically as more scans complete.
        </div>
      )}
    </div>
  );
}

/**
 * ResultPreviewCard Component
 *
 * Individual card showing a completed scan's summary with issue counts.
 * Provides quick overview and link to detailed results.
 */
interface ResultPreviewCardProps {
  scan: UrlIssueSummaryDetailed;
}

function ResultPreviewCard({ scan }: ResultPreviewCardProps) {
  // Determine card border color based on highest severity
  let borderColorClass = 'border-green-300';
  let headerBgClass = 'bg-green-50';

  if (scan.criticalCount > 0) {
    borderColorClass = 'border-red-300';
    headerBgClass = 'bg-red-50';
  } else if (scan.seriousCount > 0) {
    borderColorClass = 'border-orange-300';
    headerBgClass = 'bg-orange-50';
  } else if (scan.moderateCount > 0) {
    borderColorClass = 'border-yellow-300';
    headerBgClass = 'bg-yellow-50';
  } else if (scan.minorCount > 0) {
    borderColorClass = 'border-blue-300';
    headerBgClass = 'bg-blue-50';
  }

  return (
    <div
      className={`border rounded-lg overflow-hidden ${borderColorClass} bg-card hover:shadow-md transition-shadow`}
    >
      {/* Header */}
      <div className={`p-4 ${headerBgClass} border-b ${borderColorClass}`}>
        {scan.pageTitle && (
          <div className="font-medium text-sm text-gray-900 mb-1 truncate">
            {scan.pageTitle}
          </div>
        )}
        <div className="text-xs text-muted-foreground truncate" title={scan.url}>
          {scan.url}
        </div>
      </div>

      {/* Issue Summary */}
      <div className="p-4 space-y-3">
        {/* Total Issues */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Total Issues</span>
          <span className="text-lg font-bold text-gray-900">
            {scan.totalIssues}
          </span>
        </div>

        {/* Severity Breakdown */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Severity Breakdown
          </div>
          <div className="grid grid-cols-2 gap-2">
            <SeverityBadge
              label="Critical"
              count={scan.criticalCount}
              color="critical"
            />
            <SeverityBadge
              label="Serious"
              count={scan.seriousCount}
              color="serious"
            />
            <SeverityBadge
              label="Moderate"
              count={scan.moderateCount}
              color="moderate"
            />
            <SeverityBadge label="Minor" count={scan.minorCount} color="minor" />
          </div>
        </div>

        {/* View Details Link */}
        <Link
          href={`/scan/${scan.id}`}
          className="inline-flex items-center justify-center w-full gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
        >
          View Details
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
    </div>
  );
}

/**
 * SeverityBadge Component
 *
 * Compact badge showing severity count with color coding.
 * Used in the results preview grid.
 */
interface SeverityBadgeProps {
  label: string;
  count: number;
  color: 'critical' | 'serious' | 'moderate' | 'minor';
}

function SeverityBadge({ label, count, color }: SeverityBadgeProps) {
  const colorClasses = {
    critical: 'bg-red-100 text-red-800 border-red-200',
    serious: 'bg-orange-100 text-orange-800 border-orange-200',
    moderate: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    minor: 'bg-blue-100 text-blue-800 border-blue-200',
  };

  return (
    <div
      className={`flex items-center justify-between px-3 py-2 rounded-lg border ${colorClasses[color]}`}
    >
      <span className="text-xs font-medium">{label}</span>
      <span className="text-sm font-bold">{count}</span>
    </div>
  );
}

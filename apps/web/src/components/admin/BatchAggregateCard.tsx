'use client';

import { AlertTriangle, CheckCircle2 } from 'lucide-react';

/**
 * Aggregate statistics interface
 */
export interface AggregateStats {
  totalIssues: number;
  criticalCount: number;
  seriousCount: number;
  moderateCount: number;
  minorCount: number;
  passedChecks: number;
}

/**
 * Props for the BatchAggregateCard component
 */
interface BatchAggregateCardProps {
  /** Aggregate statistics across selected batches */
  stats: AggregateStats;
  /** Loading state - shows skeleton when true */
  loading?: boolean;
}

/**
 * Issue count row component with progress indicator
 */
interface IssueRowProps {
  label: string;
  count: number;
  color: string;
  bgColor: string;
  totalIssues: number;
}

function IssueRow({ label, count, color, bgColor, totalIssues }: IssueRowProps) {
  const percentage = totalIssues > 0 ? (count / totalIssues) * 100 : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className={`text-sm font-semibold ${color}`}>
          {count.toLocaleString()}
        </span>
      </div>
      {/* Progress bar */}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${bgColor} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
          aria-label={`${percentage.toFixed(1)}% of total issues`}
        />
      </div>
    </div>
  );
}

/**
 * Skeleton loading state component
 */
function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
      <div className="animate-pulse space-y-4">
        <div className="h-5 w-40 bg-gray-200 rounded"></div>
        <div className="h-16 bg-gray-200 rounded"></div>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-1">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-2 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
    </div>
  );
}

/**
 * BatchAggregateCard component
 *
 * This component:
 * - Displays aggregate statistics in a card format
 * - Shows total issues count prominently
 * - Breaks down issues by severity level with color coding:
 *   - Critical: red
 *   - Serious: orange
 *   - Moderate: yellow
 *   - Minor: gray
 * - Shows passed checks count in green
 * - Includes visual progress bars showing issue distribution
 * - Provides loading skeleton state
 * - Designed to be used on batch detail pages or in aggregate views
 *
 * Requirements:
 * - REQ 2.1: Aggregate statistics (total issues, issues by impact level, passed checks)
 * - NFR-Usability: Clear visual hierarchy with color-coded severity indicators
 * - NFR-Accessibility: Progress bars include aria-labels for screen readers
 *
 * Design Pattern:
 * - Follows the MetricCard pattern from DashboardMetrics
 * - Uses color coding consistent with IssueCard and BatchSummaryBar
 * - Clean card layout with proper spacing and visual indicators
 */
export function BatchAggregateCard({
  stats,
  loading = false,
}: BatchAggregateCardProps) {
  // Show skeleton during loading
  if (loading) {
    return <SkeletonCard />;
  }

  const {
    totalIssues,
    criticalCount,
    seriousCount,
    moderateCount,
    minorCount,
    passedChecks,
  } = stats;

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="h-5 w-5 text-gray-400" aria-hidden="true" />
        <h3 className="text-lg font-semibold text-gray-900">
          Aggregate Statistics
        </h3>
      </div>

      {/* Total Issues - Prominent Display */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="text-sm text-gray-600 mb-1">Total Issues</div>
        <div className="flex items-baseline gap-2">
          <span className={`text-4xl font-bold ${
            totalIssues > 0 ? 'text-red-600' : 'text-gray-400'
          }`}>
            {totalIssues.toLocaleString()}
          </span>
          {totalIssues > 0 && (
            <span className="text-sm text-gray-500">
              issues found
            </span>
          )}
        </div>
      </div>

      {/* Issue Breakdown by Severity */}
      {totalIssues > 0 ? (
        <div className="space-y-4 mb-6">
          <h4 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
            By Severity
          </h4>

          {/* Critical Issues (Red) */}
          <IssueRow
            label="Critical"
            count={criticalCount}
            color="text-red-700"
            bgColor="bg-red-500"
            totalIssues={totalIssues}
          />

          {/* Serious Issues (Orange) */}
          <IssueRow
            label="Serious"
            count={seriousCount}
            color="text-orange-700"
            bgColor="bg-orange-500"
            totalIssues={totalIssues}
          />

          {/* Moderate Issues (Yellow) */}
          <IssueRow
            label="Moderate"
            count={moderateCount}
            color="text-yellow-700"
            bgColor="bg-yellow-500"
            totalIssues={totalIssues}
          />

          {/* Minor Issues (Gray) */}
          <IssueRow
            label="Minor"
            count={minorCount}
            color="text-gray-700"
            bgColor="bg-gray-500"
            totalIssues={totalIssues}
          />
        </div>
      ) : (
        <div className="mb-6 text-center py-4">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" aria-hidden="true" />
          <p className="text-sm text-gray-600">No issues found</p>
        </div>
      )}

      {/* Passed Checks Count (Green) */}
      <div className="pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" aria-hidden="true" />
            <span className="text-sm font-medium text-gray-700">
              Passed Checks
            </span>
          </div>
          <span className="text-lg font-semibold text-green-600">
            {passedChecks.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

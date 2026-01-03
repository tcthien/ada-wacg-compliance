'use client';

import { Layers, Link, AlertTriangle } from 'lucide-react';

/**
 * Aggregate issue statistics
 */
interface AggregateStats {
  totalIssues: number;
  criticalCount: number;
  seriousCount: number;
  moderateCount: number;
  minorCount: number;
}

/**
 * Props for the BatchSummaryBar component
 */
interface BatchSummaryBarProps {
  /** Total number of batches in filtered view */
  totalBatches: number;
  /** Total number of URLs across all filtered batches */
  totalUrls: number;
  /** Aggregate issue counts across all filtered batches */
  aggregateIssues: AggregateStats;
  /** Loading state - shows skeleton when true */
  loading?: boolean;
}

/**
 * Metric item component for displaying individual statistics
 */
interface MetricItemProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color?: string;
}

function MetricItem({ icon, label, value, color = 'text-gray-700' }: MetricItemProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-shrink-0 text-gray-400">
        {icon}
      </div>
      <div className="flex flex-col">
        <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
        <span className={`text-lg font-semibold ${color}`}>{value}</span>
      </div>
    </div>
  );
}

/**
 * Issue count badge component
 */
interface IssueBadgeProps {
  count: number;
  label: string;
  color: string;
  bgColor: string;
}

function IssueBadge({ count, label, color, bgColor }: IssueBadgeProps) {
  if (count === 0) return null;

  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md ${bgColor}`}>
      <span className={`text-sm font-medium ${color}`}>{count.toLocaleString()}</span>
      <span className={`text-xs ${color} opacity-75`}>{label}</span>
    </div>
  );
}

/**
 * Skeleton loading state component
 */
function SkeletonSummary() {
  return (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8 animate-pulse">
            <div className="h-12 w-24 bg-gray-200 rounded"></div>
            <div className="h-12 w-24 bg-gray-200 rounded"></div>
            <div className="h-12 w-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * BatchSummaryBar component
 *
 * This component:
 * - Displays summary statistics at the top of the batch management page
 * - Shows total batches count in the filtered view
 * - Shows total URLs across all filtered batches
 * - Shows aggregate issue counts broken down by severity (critical, serious, moderate, minor)
 * - Updates dynamically when filters change
 * - Uses color coding: critical (red), serious (orange), moderate (yellow), minor (gray)
 * - Provides a clean, compact horizontal layout
 *
 * Requirements:
 * - REQ 1.6: Summary bar at top showing total batches, total URLs, and aggregate issue counts
 * - NFR-Usability: Clear visual hierarchy with color-coded severity indicators
 * - NFR-Performance: Presentational component with efficient rendering
 *
 * Design Pattern:
 * - Follows the same pattern as DashboardMetrics component
 * - Presentational component receiving data via props
 * - Consistent styling with existing admin UI components
 */
export function BatchSummaryBar({
  totalBatches,
  totalUrls,
  aggregateIssues,
  loading = false,
}: BatchSummaryBarProps) {
  // Show skeleton during loading
  if (loading) {
    return <SkeletonSummary />;
  }

  const { totalIssues, criticalCount, seriousCount, moderateCount, minorCount } = aggregateIssues;

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Left Section: Core Metrics */}
          <div className="flex items-center gap-8">
            {/* Total Batches */}
            <MetricItem
              icon={<Layers className="h-5 w-5" aria-hidden="true" />}
              label="Batches"
              value={totalBatches.toLocaleString()}
            />

            {/* Total URLs */}
            <MetricItem
              icon={<Link className="h-5 w-5" aria-hidden="true" />}
              label="Total URLs"
              value={totalUrls.toLocaleString()}
            />

            {/* Total Issues */}
            <MetricItem
              icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />}
              label="Total Issues"
              value={totalIssues.toLocaleString()}
              color={totalIssues > 0 ? 'text-red-600' : 'text-gray-700'}
            />
          </div>

          {/* Right Section: Issue Breakdown */}
          {totalIssues > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Critical Issues (Red) */}
              <IssueBadge
                count={criticalCount}
                label="Critical"
                color="text-red-700"
                bgColor="bg-red-50 border border-red-200"
              />

              {/* Serious Issues (Orange) */}
              <IssueBadge
                count={seriousCount}
                label="Serious"
                color="text-orange-700"
                bgColor="bg-orange-50 border border-orange-200"
              />

              {/* Moderate Issues (Yellow) */}
              <IssueBadge
                count={moderateCount}
                label="Moderate"
                color="text-yellow-700"
                bgColor="bg-yellow-50 border border-yellow-200"
              />

              {/* Minor Issues (Gray) */}
              <IssueBadge
                count={minorCount}
                label="Minor"
                color="text-gray-700"
                bgColor="bg-gray-50 border border-gray-200"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

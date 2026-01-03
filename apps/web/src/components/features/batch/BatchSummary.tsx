'use client';

import React from 'react';
import type { BatchResultsResponse } from '@/lib/batch-api';

interface BatchSummaryProps {
  results: BatchResultsResponse;
}

/**
 * BatchSummary Component
 *
 * Displays aggregate statistics for a completed batch scan.
 * Shows severity breakdown, passed checks, and top critical URLs.
 *
 * Requirements:
 * - 3.1: Aggregate issue counts grouped by severity
 * - 3.2: Issues grouped by axe-core impact level (critical/serious/moderate/minor)
 * - 3.4: Top 5 URLs with highest critical issue count
 * - 3.7: Aggregate stats include passed checks count
 *
 * Features:
 * - Color-coded severity cards (red=critical, orange=serious, yellow=moderate, blue=minor)
 * - Total issues count
 * - Passed checks count (green)
 * - Top 5 URLs with highest critical issues
 * - Follows ResultsSummary component pattern
 *
 * @example
 * ```tsx
 * <BatchSummary results={batchResults} />
 * ```
 */
export function BatchSummary({ results }: BatchSummaryProps) {
  const { aggregate, topCriticalUrls } = results;

  return (
    <div className="space-y-6">
      {/* Aggregate Statistics Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Overall Results</h3>

        {/* Severity Breakdown Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
          <SummaryCard
            label="Critical"
            count={aggregate.criticalCount}
            color="critical"
          />
          <SummaryCard
            label="Serious"
            count={aggregate.seriousCount}
            color="serious"
          />
          <SummaryCard
            label="Moderate"
            count={aggregate.moderateCount}
            color="moderate"
          />
          <SummaryCard
            label="Minor"
            count={aggregate.minorCount}
            color="minor"
          />
          <SummaryCard
            label="Passed"
            count={aggregate.passedChecks}
            color="success"
          />
        </div>

        {/* Additional Stats */}
        <div className="flex gap-6 text-sm text-muted-foreground">
          <div>
            <span className="font-medium text-gray-900">{aggregate.totalIssues}</span> total issues
          </div>
          <div>
            <span className="font-medium text-gray-900">{aggregate.urlsScanned}</span> URLs scanned
          </div>
        </div>
      </div>

      {/* Top Critical URLs Section */}
      {topCriticalUrls.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">
            Top URLs with Critical Issues
          </h3>

          <div className="space-y-2">
            {topCriticalUrls.map((item, index) => (
              <div
                key={item.url}
                className="flex items-start gap-3 p-4 bg-red-50 rounded-lg border border-red-200 hover:border-red-300 transition-colors"
              >
                {/* Rank Badge */}
                <div className="flex-shrink-0 w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  {index + 1}
                </div>

                {/* URL and Title */}
                <div className="flex-1 min-w-0">
                  {item.pageTitle && (
                    <div className="font-medium text-sm text-gray-900 truncate">
                      {item.pageTitle}
                    </div>
                  )}
                  <div
                    className="text-sm text-muted-foreground truncate"
                    title={item.url}
                  >
                    {item.url}
                  </div>
                </div>

                {/* Critical Count Badge */}
                <div className="flex-shrink-0 px-3 py-1 bg-red-600 text-white rounded-full text-sm font-bold">
                  {item.criticalCount} critical
                </div>
              </div>
            ))}
          </div>

          {/* Help Text */}
          {topCriticalUrls.length === 5 && results.urls.length > 5 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Showing top 5 URLs. View full results below for all URLs.
            </p>
          )}
        </div>
      )}

      {/* No Critical Issues Message */}
      {topCriticalUrls.length === 0 && aggregate.criticalCount === 0 && (
        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-center gap-2 text-green-800">
            <span className="text-2xl" role="img" aria-label="Success">✅</span>
            <span className="font-medium">No critical issues found!</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * SummaryCard Component
 *
 * Individual card displaying a single severity level count.
 * Reused pattern from ResultsSummary component.
 */
interface SummaryCardProps {
  label: string;
  count: number;
  color: 'critical' | 'serious' | 'moderate' | 'minor' | 'success';
}

function SummaryCard({ label, count, color }: SummaryCardProps) {
  const colorClasses = {
    critical: 'bg-red-100 text-red-800 border-red-200',
    serious: 'bg-orange-100 text-orange-800 border-orange-200',
    moderate: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    minor: 'bg-blue-100 text-blue-800 border-blue-200',
    success: 'bg-green-100 text-green-800 border-green-200',
  };

  return (
    <div className={`p-4 rounded-lg border ${colorClasses[color]}`}>
      <div className="text-2xl font-bold">{count}</div>
      <div className="text-sm">{label}</div>
    </div>
  );
}

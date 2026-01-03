'use client';

import Link from 'next/link';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import type { TopCriticalUrl } from '@/lib/batch-api';

/**
 * Props for the BatchCriticalUrlsCard component
 */
interface BatchCriticalUrlsCardProps {
  /** Array of top critical URLs (max 5) */
  topCriticalUrls: TopCriticalUrl[];
  /** Loading state - shows skeleton when true */
  loading?: boolean;
}

/**
 * Skeleton loading state component
 */
function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
      <div className="animate-pulse space-y-4">
        <div className="h-5 w-40 bg-gray-200 rounded"></div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * BatchCriticalUrlsCard component
 *
 * This component:
 * - Displays top 5 URLs with highest critical issues in a card format
 * - Shows URL (truncated), page title, and critical count for each URL
 * - Each row is clickable and links to /admin/scans/:scanId
 * - Visual highlighting with red/warning indicators for critical issues
 * - Handles empty state when no URLs have critical issues
 * - Shows help text when 5 URLs are displayed
 * - Provides loading skeleton state
 *
 * Requirements:
 * - REQ 2.4: Highlight URLs with critical issues using visual indicators
 * - REQ 2.5: Display top 5 URLs with highest critical issue count, sorted by critical count descending then by URL alphabetically for ties
 *
 * Design Pattern:
 * - Follows the card pattern from BatchAggregateCard
 * - Uses red color scheme for critical issues (consistent with IssueCard)
 * - Clean card layout with proper spacing and visual indicators
 * - Clickable rows for navigation to individual scan details
 */
export function BatchCriticalUrlsCard({
  topCriticalUrls,
  loading = false,
}: BatchCriticalUrlsCardProps) {
  // Show skeleton during loading
  if (loading) {
    return <SkeletonCard />;
  }

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="h-5 w-5 text-red-500" aria-hidden="true" />
        <h3 className="text-lg font-semibold text-gray-900">Critical Issues</h3>
      </div>

      {/* URLs List */}
      {topCriticalUrls.length > 0 ? (
        <>
          <div className="space-y-2">
            {topCriticalUrls.map((item, index) => (
              <Link
                key={item.scanId}
                href={`/admin/scans/${item.scanId}`}
                className="block p-4 bg-red-50 rounded-lg border border-red-200 hover:border-red-400 hover:bg-red-100 transition-colors group"
              >
                <div className="flex items-start gap-3">
                  {/* Rank Badge */}
                  <div className="flex-shrink-0 w-7 h-7 bg-red-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                    {index + 1}
                  </div>

                  {/* URL and Title */}
                  <div className="flex-1 min-w-0">
                    {item.pageTitle && (
                      <div className="font-medium text-sm text-gray-900 truncate mb-1">
                        {item.pageTitle}
                      </div>
                    )}
                    <div
                      className="text-sm text-gray-600 truncate"
                      title={item.url}
                    >
                      {item.url}
                    </div>
                  </div>

                  {/* Critical Count Badge and Link Icon */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="px-3 py-1 bg-red-600 text-white rounded-full text-sm font-bold">
                      {item.criticalCount} critical
                    </div>
                    <ExternalLink
                      className="h-4 w-4 text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Help Text */}
          {topCriticalUrls.length === 5 && (
            <p className="mt-4 text-xs text-gray-500">
              Showing top 5 URLs with highest critical issue count. Click any row to view detailed scan results.
            </p>
          )}
        </>
      ) : (
        /* Empty State */
        <div className="p-6 text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg
              className="h-6 w-6 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-900 mb-1">
            No Critical Issues
          </p>
          <p className="text-sm text-gray-600">
            All scans completed without critical accessibility issues
          </p>
        </div>
      )}
    </div>
  );
}

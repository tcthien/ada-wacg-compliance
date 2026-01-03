'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi, type BatchMetricsResponse } from '@/lib/admin-api';
import { Layers, Clock, Target, TrendingUp, ExternalLink } from 'lucide-react';

/**
 * Metric card component for batch stats
 */
interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description?: string;
  iconBgClass?: string;
}

function MetricCard({
  title,
  value,
  icon,
  description,
  iconBgClass = 'bg-purple-100 text-purple-600',
}: MetricCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900">{value}</p>
          {description && (
            <p className="mt-1 text-xs text-gray-500">{description}</p>
          )}
        </div>
        <div className="flex-shrink-0">
          <div className={`flex h-12 w-12 items-center justify-center rounded-md ${iconBgClass}`}>
            {icon}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Get batch status badge styling
 */
function getStatusStyle(status: string) {
  switch (status.toUpperCase()) {
    case 'COMPLETED':
      return 'bg-green-100 text-green-800';
    case 'RUNNING':
      return 'bg-blue-100 text-blue-800';
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-800';
    case 'FAILED':
      return 'bg-red-100 text-red-800';
    case 'CANCELLED':
      return 'bg-gray-100 text-gray-800';
    case 'STALE':
      return 'bg-orange-100 text-orange-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Format date to relative time
 */
function formatRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Format duration from milliseconds
 */
function formatDuration(ms: number) {
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${minutes.toFixed(1)}m`;
  const hours = minutes / 60;
  return `${hours.toFixed(1)}h`;
}

/**
 * DashboardBatchMetrics component
 *
 * This component:
 * - Fetches batch metrics from the API
 * - Displays batch counts (today/week/month), avg URLs, completion rate
 * - Shows recent batches widget with last 5 batches
 * - Auto-refreshes every 5 minutes
 *
 * Requirements:
 * - REQ 5.1: Display batch metrics (today/week/month counts, avg URLs, completion rate)
 * - REQ 5.2: Display recent batches widget
 */
export function DashboardBatchMetrics() {
  const [metrics, setMetrics] = useState<BatchMetricsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    try {
      setError(null);
      const data = await adminApi.batches.getMetrics();
      setMetrics(data);
    } catch (err) {
      console.error('Failed to fetch batch metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load batch metrics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();

    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchMetrics, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Section header skeleton */}
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-48 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-64"></div>
        </div>

        {/* Metrics cards skeleton */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse bg-white rounded-lg shadow p-6">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>

        {/* Recent batches skeleton */}
        <div className="animate-pulse bg-white rounded-lg shadow p-6">
          <div className="h-5 bg-gray-200 rounded w-32 mb-4"></div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex justify-between items-center py-3 border-b">
              <div className="h-4 bg-gray-200 rounded w-48"></div>
              <div className="h-4 bg-gray-200 rounded w-16"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error || !metrics) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-red-400"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">
              Failed to load batch metrics
            </h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error || 'An unexpected error occurred'}</p>
            </div>
            <div className="mt-4">
              <button
                onClick={fetchMetrics}
                className="rounded-md bg-red-100 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Layers className="h-5 w-5 text-purple-600" />
            Batch Scans
          </h2>
          <p className="text-sm text-gray-600">
            Multi-URL batch scanning metrics
          </p>
        </div>
        <Link
          href="/admin/batches"
          className="text-sm font-medium text-purple-600 hover:text-purple-800 flex items-center gap-1"
        >
          View all batches
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Batch metrics cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Batches Today */}
        <MetricCard
          title="Batches Today"
          value={metrics.totals.today.toLocaleString()}
          icon={<Layers className="h-6 w-6" aria-hidden="true" />}
          description="Created in the last 24 hours"
        />

        {/* Batches This Week */}
        <MetricCard
          title="Batches This Week"
          value={metrics.totals.thisWeek.toLocaleString()}
          icon={<Layers className="h-6 w-6" aria-hidden="true" />}
          description="Since start of week"
        />

        {/* Avg URLs per Batch */}
        <MetricCard
          title="Avg URLs per Batch"
          value={metrics.averages.urlsPerBatch.toFixed(1)}
          icon={<TrendingUp className="h-6 w-6" aria-hidden="true" />}
          description="Average URLs scanned per batch"
        />

        {/* Completion Rate */}
        <MetricCard
          title="Completion Rate"
          value={`${metrics.averages.completionRate.toFixed(1)}%`}
          icon={<Target className="h-6 w-6" aria-hidden="true" />}
          description="Successfully completed batches"
        />
      </div>

      {/* Additional metrics row */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Batches This Month */}
        <MetricCard
          title="Batches This Month"
          value={metrics.totals.thisMonth.toLocaleString()}
          icon={<Layers className="h-6 w-6" aria-hidden="true" />}
          description="Since start of month"
        />

        {/* Avg Processing Time */}
        <MetricCard
          title="Avg Processing Time"
          value={formatDuration(metrics.averages.processingTimeMs)}
          icon={<Clock className="h-6 w-6" aria-hidden="true" />}
          description="Average batch processing duration"
        />
      </div>

      {/* Recent Batches Widget */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Batches</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {metrics.recentBatches.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              <Layers className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p>No batches yet</p>
            </div>
          ) : (
            metrics.recentBatches.map((batch) => (
              <Link
                key={batch.id}
                href={`/admin/batches/${batch.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {batch.homepageUrl}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {batch.progress} • {formatRelativeTime(batch.createdAt)}
                  </p>
                </div>
                <span
                  className={`ml-4 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusStyle(batch.status)}`}
                >
                  {batch.status}
                </span>
              </Link>
            ))
          )}
        </div>
        {metrics.recentBatches.length > 0 && (
          <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
            <Link
              href="/admin/batches"
              className="text-sm font-medium text-purple-600 hover:text-purple-800"
            >
              View all batches →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

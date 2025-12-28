'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/admin-api';
import { Activity, Users, Target, Clock } from 'lucide-react';

/**
 * Dashboard metrics interface matching the API response
 */
interface DashboardMetrics {
  scans: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    total: number;
  };
  successRate: number;
  activeSessions: number;
  uniqueCustomers: number;
  avgScanDuration: number;
}

/**
 * Metric card component
 */
interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description?: string;
}

function MetricCard({ title, value, icon, description }: MetricCardProps) {
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
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-blue-100 text-blue-600">
            {icon}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Dashboard metrics display component
 *
 * This component:
 * - Fetches dashboard metrics from the API
 * - Displays scan counts, success rate, active sessions, and customer metrics
 * - Shows loading states during data fetch
 * - Handles errors gracefully
 * - Auto-refreshes data every 5 minutes (cache TTL)
 *
 * Requirements:
 * - REQ 5.1: Display key metrics (scans, success rate, sessions, customers)
 * - REQ 7.1: Dashboard displayed when authenticated
 */
export function DashboardMetrics() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    try {
      setError(null);
      const data = await adminApi.dashboard.getMetrics();
      setMetrics(data as unknown as DashboardMetrics);
    } catch (err) {
      console.error('Failed to fetch dashboard metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load metrics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();

    // Auto-refresh every 5 minutes to sync with cache TTL
    const interval = setInterval(fetchMetrics, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="animate-pulse bg-white rounded-lg shadow p-6"
          >
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
            <div className="h-8 bg-gray-200 rounded w-3/4"></div>
          </div>
        ))}
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
              Failed to load dashboard metrics
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

  // Format scan duration (milliseconds to seconds)
  const formatDuration = (ms: number) => {
    const seconds = ms / 1000;
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    }
    const minutes = seconds / 60;
    return `${minutes.toFixed(1)}m`;
  };

  // Success metrics display
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {/* Scans Today */}
      <MetricCard
        title="Scans Today"
        value={metrics.scans.today.toLocaleString()}
        icon={<Activity className="h-6 w-6" aria-hidden="true" />}
        description="Created in the last 24 hours"
      />

      {/* Scans This Week */}
      <MetricCard
        title="Scans This Week"
        value={metrics.scans.thisWeek.toLocaleString()}
        icon={<Activity className="h-6 w-6" aria-hidden="true" />}
        description="Since start of week (Sunday)"
      />

      {/* Scans This Month */}
      <MetricCard
        title="Scans This Month"
        value={metrics.scans.thisMonth.toLocaleString()}
        icon={<Activity className="h-6 w-6" aria-hidden="true" />}
        description="Since start of month"
      />

      {/* Total Scans */}
      <MetricCard
        title="Total Scans"
        value={metrics.scans.total.toLocaleString()}
        icon={<Activity className="h-6 w-6" aria-hidden="true" />}
        description="All-time scan count"
      />

      {/* Success Rate */}
      <MetricCard
        title="Success Rate"
        value={`${metrics.successRate}%`}
        icon={<Target className="h-6 w-6" aria-hidden="true" />}
        description="Completed vs failed scans"
      />

      {/* Active Sessions */}
      <MetricCard
        title="Active Sessions"
        value={metrics.activeSessions.toLocaleString()}
        icon={<Users className="h-6 w-6" aria-hidden="true" />}
        description="Non-expired guest sessions"
      />

      {/* Unique Customers */}
      <MetricCard
        title="Unique Customers"
        value={metrics.uniqueCustomers.toLocaleString()}
        icon={<Users className="h-6 w-6" aria-hidden="true" />}
        description="Distinct email addresses"
      />

      {/* Average Scan Duration */}
      <MetricCard
        title="Avg Scan Duration"
        value={formatDuration(metrics.avgScanDuration)}
        icon={<Clock className="h-6 w-6" aria-hidden="true" />}
        description="Mean duration for completed scans"
      />
    </div>
  );
}

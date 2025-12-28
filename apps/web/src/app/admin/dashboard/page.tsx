import { DashboardMetrics } from '@/components/admin/DashboardMetrics';
import { DashboardCharts } from '@/components/admin/DashboardCharts';

/**
 * Admin Dashboard Page
 *
 * This page:
 * - Displays key metrics cards (scans, success rate, sessions, customers)
 * - Shows visual analytics (scan trends, issue distribution)
 * - Auto-refreshes data every 5 minutes to sync with cache TTL
 * - Shows loading states and handles errors gracefully
 * - Provides a comprehensive overview of system activity
 *
 * Requirements:
 * - REQ 5.1: Display key metrics (scans today/week/month, success rate, active sessions, unique customers)
 * - REQ 5.2: Display a chart of scans over time (daily for last 30 days)
 * - REQ 5.3: Display breakdown of issues by severity (critical, serious, moderate, minor)
 * - REQ 7.1: Dashboard displayed when authenticated
 */
export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Overview of system activity and key performance metrics
        </p>
      </div>

      {/* Dashboard metrics */}
      <DashboardMetrics />

      {/* Dashboard charts */}
      <DashboardCharts />
    </div>
  );
}

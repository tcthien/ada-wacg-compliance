'use client';

import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { adminApi, type ScanTrend, type IssueDistribution } from '@/lib/admin-api';

/**
 * Dashboard Charts Component
 *
 * Displays visual analytics for the admin dashboard:
 * - Line chart showing daily scan trends (success/failed breakdown)
 * - Pie chart showing issue distribution by severity
 */
export function DashboardCharts() {
  const [trendsData, setTrendsData] = useState<ScanTrend[]>([]);
  const [issuesData, setIssuesData] = useState<IssueDistribution | null>(null);
  const [trendsLoading, setTrendsLoading] = useState(true);
  const [issuesLoading, setIssuesLoading] = useState(true);
  const [trendsError, setTrendsError] = useState<string | null>(null);
  const [issuesError, setIssuesError] = useState<string | null>(null);

  // Fetch scan trends data
  useEffect(() => {
    const fetchTrends = async () => {
      try {
        setTrendsLoading(true);
        setTrendsError(null);
        const data = await adminApi.dashboard.getTrends({ days: 30 });
        setTrendsData(data);
      } catch (error) {
        setTrendsError(error instanceof Error ? error.message : 'Failed to load trends');
        console.error('Error fetching scan trends:', error);
      } finally {
        setTrendsLoading(false);
      }
    };

    fetchTrends();
  }, []);

  // Fetch issue distribution data
  useEffect(() => {
    const fetchIssues = async () => {
      try {
        setIssuesLoading(true);
        setIssuesError(null);
        const data = await adminApi.dashboard.getIssues();
        setIssuesData(data);
      } catch (error) {
        setIssuesError(error instanceof Error ? error.message : 'Failed to load issues');
        console.error('Error fetching issue distribution:', error);
      } finally {
        setIssuesLoading(false);
      }
    };

    fetchIssues();
  }, []);

  // Transform issue distribution data for pie chart
  const pieChartData = issuesData
    ? [
        { name: 'Critical', value: issuesData.critical, color: '#dc2626' },
        { name: 'Serious', value: issuesData.serious, color: '#ea580c' },
        { name: 'Moderate', value: issuesData.moderate, color: '#f59e0b' },
        { name: 'Minor', value: issuesData.minor, color: '#84cc16' },
      ]
    : [];

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Scan Trends Chart */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold">Scan Trends (Last 30 Days)</h3>

        {trendsLoading && (
          <div className="flex h-[300px] items-center justify-center">
            <p className="text-muted-foreground">Loading trends...</p>
          </div>
        )}

        {trendsError && (
          <div className="flex h-[300px] items-center justify-center">
            <p className="text-sm text-destructive">{trendsError}</p>
          </div>
        )}

        {!trendsLoading && !trendsError && trendsData.length === 0 && (
          <div className="flex h-[300px] items-center justify-center">
            <p className="text-muted-foreground">No trend data available</p>
          </div>
        )}

        {!trendsLoading && !trendsError && trendsData.length > 0 && (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendsData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => {
                  // Format date as MM/DD
                  const date = new Date(value);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                }}
                labelFormatter={(value) => {
                  // Format date as full date
                  const date = new Date(value as string);
                  return date.toLocaleDateString();
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="successCount"
                stroke="#22c55e"
                strokeWidth={2}
                name="Successful"
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="failedCount"
                stroke="#ef4444"
                strokeWidth={2}
                name="Failed"
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Issue Distribution Chart */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold">Issue Distribution by Severity</h3>

        {issuesLoading && (
          <div className="flex h-[300px] items-center justify-center">
            <p className="text-muted-foreground">Loading issues...</p>
          </div>
        )}

        {issuesError && (
          <div className="flex h-[300px] items-center justify-center">
            <p className="text-sm text-destructive">{issuesError}</p>
          </div>
        )}

        {!issuesLoading && !issuesError && !issuesData && (
          <div className="flex h-[300px] items-center justify-center">
            <p className="text-muted-foreground">No issue data available</p>
          </div>
        )}

        {!issuesLoading && !issuesError && issuesData && (
          <>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value, percent }) =>
                    `${name}: ${value} (${((percent || 0) * 100).toFixed(0)}%)`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              {pieChartData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-sm"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-sm text-muted-foreground">
                    {entry.name}: {entry.value}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

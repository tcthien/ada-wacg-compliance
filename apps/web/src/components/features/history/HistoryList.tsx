'use client';

import { useState } from 'react';
import { useScanHistory } from '@/hooks/useScanHistory';
import { HistoryCard } from './HistoryCard';
import { ScanStatus } from '@/lib/api';

type SortField = 'date' | 'url' | 'issues';
type StatusFilter = 'all' | ScanStatus;

export function HistoryList() {
  const [sortBy, setSortBy] = useState<SortField>('date');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const { scans, loading, error, loadMore, hasMore } = useScanHistory();

  // Sort scans
  const sortedScans = [...scans].sort((a, b) => {
    switch (sortBy) {
      case 'date':
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      case 'url':
        return a.url.localeCompare(b.url);
      case 'issues':
        return (b.issueCount || 0) - (a.issueCount || 0);
      default:
        return 0;
    }
  });

  // Filter scans
  const filteredScans =
    statusFilter === 'all'
      ? sortedScans
      : sortedScans.filter((s) => s.status === statusFilter);

  if (loading && scans.length === 0) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (error) {
    return <div className="text-red-600">{error}</div>;
  }

  if (scans.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No scans yet. Start by scanning a website on the home page.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-4 justify-between">
        {/* Sort */}
        <div className="flex items-center gap-2">
          <label className="text-sm">Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortField)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="date">Date</option>
            <option value="url">URL</option>
            <option value="issues">Issue Count</option>
          </select>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="all">All</option>
            <option value="COMPLETED">Completed</option>
            <option value="RUNNING">Running</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </div>

      {/* Scan list */}
      <div className="space-y-3">
        {filteredScans.map((scan) => (
          <HistoryCard key={scan.id} scan={scan} />
        ))}
      </div>

      {/* Load more */}
      {hasMore && (
        <button
          onClick={loadMore}
          disabled={loading}
          className="w-full py-2 text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Loading...' : 'Load More'}
        </button>
      )}
    </div>
  );
}

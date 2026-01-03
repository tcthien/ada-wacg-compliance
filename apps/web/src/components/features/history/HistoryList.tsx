'use client';

import { useState, useEffect } from 'react';
import { useScanHistory } from '@/hooks/useScanHistory';
import { HistoryCard } from './HistoryCard';
import { ScanStatus } from '@/lib/api';
import { batchApi, BatchStatusResponse } from '@/lib/batch-api';
import { useHistoryFilterStore } from '@/stores/history-filter-store';
import { EmptyHistory, EmptySearchResults } from '@/components/ui/empty-state';
import { HistoryItemSkeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';

type ItemType = 'scan' | 'batch';
// Extended status type that includes batch-specific statuses
type HistoryStatus = ScanStatus | 'CANCELLED' | 'STALE';

// Unified history item interface
interface HistoryItem {
  id: string;
  type: ItemType;
  url: string;
  status: HistoryStatus;
  wcagLevel: string;
  createdAt: string;
  completedAt?: string | null | undefined;
  issueCount?: number | undefined;
  // Batch-specific fields
  totalUrls?: number | undefined;
  completedCount?: number | undefined;
  failedCount?: number | undefined;
}

export function HistoryList() {
  const router = useRouter();

  // Get filter/sort state from the store
  const {
    dateRange,
    scanTypes,
    searchQuery,
    sortBy,
    sortOrder,
    selectedIds,
    toggleSelection,
    resetFilters,
  } = useHistoryFilterStore();

  const { scans, loading: scansLoading, error: scansError, loadMore, hasMore } = useScanHistory();
  const [batches, setBatches] = useState<BatchStatusResponse[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(true);
  const [batchesError, setBatchesError] = useState<string | null>(null);

  // Fetch batches on mount
  useEffect(() => {
    async function fetchBatches() {
      try {
        setBatchesLoading(true);
        const response = await batchApi.list({ page: 1, limit: 100 });
        setBatches(response.batches);
        setBatchesError(null);
      } catch (err) {
        setBatchesError(err instanceof Error ? err.message : 'Failed to load batches');
      } finally {
        setBatchesLoading(false);
      }
    }
    fetchBatches();
  }, []);

  // Convert batches and scans to unified HistoryItem format
  const batchItems: HistoryItem[] = batches.map(batch => ({
    id: batch.batchId,
    type: 'batch' as const,
    url: batch.homepageUrl,
    status: batch.status as HistoryStatus,
    wcagLevel: batch.wcagLevel,
    createdAt: batch.createdAt,
    completedAt: batch.completedAt,
    totalUrls: batch.totalUrls,
    completedCount: batch.completedCount,
    failedCount: batch.failedCount,
    // issueCount is intentionally omitted for batches - will be undefined
  }));

  const scanItems: HistoryItem[] = scans.map(scan => ({
    id: scan.id,
    type: 'scan' as const,
    url: scan.url,
    status: scan.status,
    wcagLevel: scan.wcagLevel,
    createdAt: scan.createdAt,
    completedAt: scan.completedAt,
    issueCount: scan.issueCount,
  }));

  // Combine all items
  const allItems = [...batchItems, ...scanItems];

  // Apply filters
  let filteredItems = allItems;

  // Filter by date range
  if (dateRange.start) {
    filteredItems = filteredItems.filter(
      (item) => new Date(item.createdAt) >= dateRange.start!
    );
  }
  if (dateRange.end) {
    filteredItems = filteredItems.filter(
      (item) => new Date(item.createdAt) <= dateRange.end!
    );
  }

  // Filter by scan type
  if (scanTypes.length > 0) {
    filteredItems = filteredItems.filter((item) => {
      const itemType = item.type === 'batch' ? 'batch' : 'single';
      return scanTypes.includes(itemType as any);
    });
  }

  // Filter by search query (URL)
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filteredItems = filteredItems.filter((item) =>
      item.url.toLowerCase().includes(query)
    );
  }

  // Sort items
  const sortedItems = [...filteredItems].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'date':
        comparison = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        break;
      case 'url':
        comparison = a.url.localeCompare(b.url);
        break;
      case 'issues':
        comparison = (b.issueCount || 0) - (a.issueCount || 0);
        break;
      default:
        comparison = 0;
    }

    // Apply sort order (ascending or descending)
    return sortOrder === 'asc' ? -comparison : comparison;
  });

  const loading = scansLoading || batchesLoading;
  const error = scansError || batchesError;

  // Determine if filters are active
  const hasActiveFilters =
    dateRange.start !== null ||
    dateRange.end !== null ||
    scanTypes.length > 0 ||
    searchQuery.trim() !== '';

  // Loading state with skeleton
  if (loading && allItems.length === 0) {
    return (
      <div className="space-y-3">
        <HistoryItemSkeleton />
        <HistoryItemSkeleton />
        <HistoryItemSkeleton />
      </div>
    );
  }

  // Error state
  if (error) {
    return <div className="text-red-600">{error}</div>;
  }

  // Empty state - no scans at all
  if (allItems.length === 0) {
    return (
      <EmptyHistory
        onAction={() => router.push('/')}
      />
    );
  }

  /**
   * Handle selection toggle for an item
   */
  const handleSelectionToggle = (item: HistoryItem) => {
    const itemId = `${item.type}-${item.id}`;
    toggleSelection(itemId);
  };

  /**
   * Check if an item is selected
   */
  const isItemSelected = (item: HistoryItem): boolean => {
    const itemId = `${item.type}-${item.id}`;
    return selectedIds.has(itemId);
  };

  return (
    <div className="space-y-4">
      {/* History list */}
      {sortedItems.length === 0 ? (
        // No results after filtering - show empty search state
        hasActiveFilters ? (
          <EmptySearchResults onAction={resetFilters} />
        ) : (
          <EmptySearchResults />
        )
      ) : (
        <div className="space-y-3">
          {sortedItems.map((item) => (
            <HistoryCard
              key={`${item.type}-${item.id}`}
              item={item}
              isSelected={isItemSelected(item)}
              onSelectionChange={() => handleSelectionToggle(item)}
            />
          ))}
        </div>
      )}

      {/* Load more (only for single scans) */}
      {hasMore && (
        <button
          onClick={loadMore}
          disabled={scansLoading}
          className="w-full py-2 text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {scansLoading ? 'Loading...' : 'Load More'}
        </button>
      )}
    </div>
  );
}

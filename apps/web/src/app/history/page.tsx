'use client';

import Link from 'next/link';
import { PublicLayout } from '@/components/layouts/PublicLayout';
import {
  HistoryList,
  HistoryFilters,
  HistorySortControls,
  HistoryBulkActions
} from '@/components/features/history';
import { useHistoryFilterStore } from '@/stores/history-filter-store';
import { api } from '@/lib/api';
import { batchApi } from '@/lib/batch-api';
import { Button } from '@/components/ui/button';

export default function HistoryPage() {
  const { selectedIds, clearSelection } = useHistoryFilterStore();

  /**
   * Handle bulk deletion of selected scans and batches
   * IDs are in format "scan-{id}" or "batch-{id}"
   */
  const handleBulkDelete = async (ids: Set<string>) => {
    const scanIds: string[] = [];
    const batchIds: string[] = [];

    // Separate scan IDs from batch IDs
    ids.forEach((id) => {
      if (id.startsWith('scan-')) {
        scanIds.push(id.replace('scan-', ''));
      } else if (id.startsWith('batch-')) {
        batchIds.push(id.replace('batch-', ''));
      }
    });

    // Delete scans (using session token deletion as proxy for now)
    // TODO: Implement proper scan deletion API endpoint
    const scanDeletions = scanIds.map((id) =>
      api.sessions.delete(id).catch((err) => {
        console.error(`Failed to delete scan ${id}:`, err);
        throw err;
      })
    );

    // Delete batches (admin API not accessible to regular users)
    // TODO: Implement proper batch deletion API endpoint for users
    const batchDeletions = batchIds.map((id) =>
      // Placeholder - batches can't be deleted by regular users yet
      Promise.reject(new Error('Batch deletion not yet implemented'))
    );

    await Promise.all([...scanDeletions, ...batchDeletions]);

    // Clear selection after successful deletion
    clearSelection();

    // Refresh the page to show updated list
    window.location.reload();
  };

  return (
    <PublicLayout
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'History' }
      ]}
      headerActions={
        <>
          <Button asChild variant="outline" size="sm">
            <Link href="/discovery">Discover Pages</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/">New Scan</Link>
          </Button>
        </>
      }
    >
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Scan History</h1>
            <p className="text-muted-foreground">
              View and manage your past accessibility scans
            </p>
          </div>

          {/* Filters Section */}
          <HistoryFilters />

          {/* Sort Controls and Bulk Actions Bar */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <HistorySortControls />
            </div>

            {/* Bulk Actions - only shown when items are selected */}
            <HistoryBulkActions
              selectedIds={selectedIds}
              onDelete={handleBulkDelete}
              onClearSelection={clearSelection}
            />
          </div>

          {/* History List */}
          <HistoryList />
        </div>
      </div>
    </PublicLayout>
  );
}

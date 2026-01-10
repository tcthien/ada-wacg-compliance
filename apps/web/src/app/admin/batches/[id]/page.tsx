'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { useAdminBatchDetail } from '@/hooks/useAdminBatchDetail';
import { BatchDetailHeader } from '@/components/admin/BatchDetailHeader';
import { BatchDetailActions } from '@/components/admin/BatchDetailActions';
import { BatchAggregateCard } from '@/components/admin/BatchAggregateCard';
import { BatchCriticalUrlsCard } from '@/components/admin/BatchCriticalUrlsCard';
import { BatchScansList } from '@/components/admin/BatchScansList';
import type { UrlIssueSummaryDetailed } from '@/lib/batch-api';
import type { TopCriticalUrl } from '@/lib/batch-api';

/**
 * Admin Batch Detail Page
 *
 * This page displays comprehensive batch information:
 * - BatchDetailHeader: Batch ID, URL, WCAG level, status, timestamps
 * - BatchDetailActions: Cancel, Delete, Retry Failed, Export buttons
 * - BatchAggregateCard: Aggregate statistics (total issues, by severity, passed checks)
 * - BatchCriticalUrlsCard: Top 5 URLs with highest critical issue count
 * - BatchScansList: List of all individual scans with expandable details
 *
 * Features:
 * - Loading and error states with back button
 * - Auto-refresh for running/pending batches (5 second polling)
 * - Toast notifications for action errors
 * - Navigation back to batch list
 *
 * Requirements:
 * - REQ 2.1: Display comprehensive batch information including ID, URL, WCAG level,
 *   completion counts, aggregate statistics, timestamps, and discovery ID
 * - REQ 2.6: Error page with batch ID, error message, and back button
 */
export default function BatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const batchId = params?.['id'] as string;
  const highlightScanId = searchParams?.get('highlightScanId');

  const {
    batch,
    scans,
    aggregate,
    topCriticalUrls,
    isLoading,
    error,
    cancelBatch,
    deleteBatch,
    retryFailed,
    exportBatch,
    isActionLoading,
  } = useAdminBatchDetail(batchId);

  /**
   * Handle delete action - navigate back to list after successful delete
   */
  const handleDelete = async () => {
    await deleteBatch();
    router.push('/admin/batches');
  };

  /**
   * Loading state
   */
  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Back button */}
        <button
          onClick={() => router.push('/admin/batches')}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md"
          aria-label="Back to batch list"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span className="text-sm font-medium">Back to Batches</span>
        </button>

        {/* Loading skeleton */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="h-20 bg-gray-200 rounded"></div>
              <div className="h-20 bg-gray-200 rounded"></div>
              <div className="h-20 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /**
   * Error state
   */
  if (error || !batch) {
    return (
      <div className="space-y-6">
        {/* Back button */}
        <button
          onClick={() => router.push('/admin/batches')}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md"
          aria-label="Back to batch list"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span className="text-sm font-medium">Back to Batches</span>
        </button>

        {/* Error card */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <AlertCircle className="h-6 w-6 text-red-600" aria-hidden="true" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-red-900">
                Error Loading Batch
              </h2>
              <div className="mt-2 space-y-2">
                <p className="text-sm text-red-800">
                  <span className="font-medium">Batch ID:</span>{' '}
                  <span className="font-mono">{batchId}</span>
                </p>
                <p className="text-sm text-red-800">
                  <span className="font-medium">Error:</span>{' '}
                  {error || 'Batch not found'}
                </p>
              </div>
              <div className="mt-4">
                <button
                  onClick={() => router.push('/admin/batches')}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-red-700 bg-red-100 border border-red-300 rounded-md hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  Back to List
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Transform scans to UrlIssueSummaryDetailed format for BatchScansList
  const scansForList: UrlIssueSummaryDetailed[] = scans.map((scan) => ({
    id: scan.id,
    url: scan.url,
    status: scan.status,
    pageTitle: scan.pageTitle,
    totalIssues: scan.totalIssues,
    criticalCount: scan.criticalCount,
    seriousCount: scan.seriousCount,
    moderateCount: scan.moderateCount,
    minorCount: scan.minorCount,
    errorMessage: scan.errorMessage,
    aiEnabled: scan.aiEnabled,
    aiStatus: scan.aiStatus,
  }));

  // Calculate AI scan statistics
  const aiEnabledScans = scans.filter((scan) => scan.aiEnabled);
  const aiStats = aiEnabledScans.length > 0 ? {
    total: aiEnabledScans.length,
    pending: aiEnabledScans.filter((s) => s.aiStatus === 'PENDING').length,
    processing: aiEnabledScans.filter((s) => s.aiStatus === 'PROCESSING' || s.aiStatus === 'DOWNLOADED').length,
    completed: aiEnabledScans.filter((s) => s.aiStatus === 'COMPLETED').length,
    failed: aiEnabledScans.filter((s) => s.aiStatus === 'FAILED').length,
  } : null;

  // Transform topCriticalUrls to TopCriticalUrl format for BatchCriticalUrlsCard
  const criticalUrlsForCard: TopCriticalUrl[] = topCriticalUrls.map((url) => ({
    scanId: url.scanId,
    url: url.url,
    pageTitle: url.pageTitle ?? null,
    criticalCount: url.criticalCount,
  }));

  return (
    <div className="space-y-6">
      {/* Header with back navigation, batch info, and status */}
      <BatchDetailHeader
        batchId={batch.id}
        homepageUrl={batch.homepageUrl}
        wcagLevel={batch.wcagLevel}
        status={batch.status}
        createdAt={batch.createdAt}
        completedAt={batch.completedAt}
        cancelledAt={batch.cancelledAt}
        discoveryId={null}
        aiStats={aiStats}
      />

      {/* Action buttons */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <BatchDetailActions
          batchId={batch.id}
          status={batch.status}
          failedCount={batch.failedCount}
          completedCount={batch.completedCount}
          totalUrls={batch.totalUrls}
          onCancel={cancelBatch}
          onDelete={handleDelete}
          onRetry={retryFailed}
          onExport={(_batchId, format) => exportBatch(format)}
        />
      </div>

      {/* Two-column layout for stats and critical URLs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Aggregate Statistics Card */}
        <BatchAggregateCard
          stats={
            aggregate || {
              totalIssues: 0,
              criticalCount: 0,
              seriousCount: 0,
              moderateCount: 0,
              minorCount: 0,
              passedChecks: 0,
            }
          }
          loading={false}
        />

        {/* Critical URLs Card */}
        <BatchCriticalUrlsCard
          topCriticalUrls={criticalUrlsForCard}
          loading={false}
        />
      </div>

      {/* Individual Scans List */}
      <BatchScansList
        scans={scansForList}
        loading={false}
        highlightScanId={highlightScanId}
      />
    </div>
  );
}

'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useBatch } from '@/hooks/useBatch';
import { useBatchResults } from '@/hooks/useBatchResults';
import { useBatchReportStatus } from '@/hooks/useBatchReportStatus';
import { BatchProgress } from '@/components/features/batch/BatchProgress';
import { BatchSummary } from '@/components/features/batch/BatchSummary';
import { BatchUrlList } from '@/components/features/batch/BatchUrlList';
import { BatchExport } from '@/components/features/batch/BatchExport';
import { ReportArtifacts } from '@/components/features/export/ReportArtifacts';
import { ShareButton } from '@/components/ui/share-button';
import { PublicLayout } from '@/components/layouts/PublicLayout';

/**
 * Batch Scan Results Page
 *
 * Displays the status and progress of a batch scan operation.
 * Automatically polls the batch status endpoint every 2 seconds while in progress.
 *
 * Status Flow:
 * 1. PENDING → Shows progress with "Waiting in queue..." message
 * 2. RUNNING → Shows BatchProgress component with real-time updates
 * 3. COMPLETED → Shows final results summary
 * 4. FAILED → Shows error message with partial results and retry option
 * 5. CANCELLED → Shows cancellation message
 * 6. STALE → Shows warning banner with partial results and cancel option
 *
 * Features:
 * - Real-time status polling (2s interval)
 * - Progress visualization with BatchProgress component
 * - Individual scan status tracking
 * - Error handling with retry options
 * - Cancel batch functionality
 * - Accessible loading and error states
 *
 * Requirements:
 * - 2.1: Status endpoint returns batch status, counts
 * - 2.4: Frontend polls status endpoint every 2s while in progress
 * - 2.7: User shall see clear visual progress indication
 * - 5.5: Stale batches (>24h old) shall be marked with warning status
 *
 * @example
 * // Route: /batch/[id]
 * // URL: /batch/batch_abc123
 */
export default function BatchResultPage() {
  const params = useParams();
  const router = useRouter();
  const batchId = params['id'] as string;
  const [cancelling, setCancelling] = useState(false);

  // Poll for batch status - automatically stops when batch reaches terminal state
  const { batch, loading, error, cancel } = useBatch(batchId, {
    pollInterval: 2000, // 2 seconds as per requirement 2.4
  });

  // Fetch full results when batch is completed, failed, or stale (to show partial results)
  const shouldFetchResults = batch?.status === 'COMPLETED' || batch?.status === 'FAILED' || batch?.status === 'STALE';
  const {
    results,
    completedScans,
    aggregateStats,
    isLoading: resultsLoading,
    error: resultsError,
  } = useBatchResults(batchId, {
    enabled: shouldFetchResults,
  });

  // Fetch report status to display available report artifacts (PDF/JSON)
  const {
    status: reportStatus,
    isLoading: reportStatusLoading,
  } = useBatchReportStatus(batchId, {
    enabled: batch?.status === 'COMPLETED',
  });

  // Reusable cancel handler with confirmation and loading state
  const handleCancelBatch = async () => {
    if (
      !window.confirm(
        'Are you sure you want to cancel this batch scan? This cannot be undone. Completed scans will be preserved, but pending scans will be cancelled.'
      )
    ) {
      return;
    }

    setCancelling(true);
    try {
      await cancel();
      // The useBatch hook will automatically refetch after cancellation
    } catch (err) {
      alert(
        'Failed to cancel batch scan. Please try again or contact support.'
      );
    } finally {
      setCancelling(false);
    }
  };

  // Loading state - initial fetch
  if (loading && !batch) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading batch scan...</p>
        </div>
      </div>
    );
  }

  // Error state - batch not found or fetch error
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold mb-2">Batch Scan Not Found</h1>
          <p className="text-muted-foreground mb-6">
            {error || 'Unable to load batch scan information.'}
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Start New Scan
          </button>
        </div>
      </div>
    );
  }

  // No batch data
  if (!batch) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold mb-2">Batch Scan Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The requested batch scan does not exist or has been deleted.
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Start New Scan
          </button>
        </div>
      </div>
    );
  }

  // Failed batch state - show partial results if any scans completed
  // Requirement 2.6: If ANY scan fails, batch status is FAILED with partial results
  if (batch.status === 'FAILED') {
    // If we have results data, show partial results
    if (results && !resultsLoading) {
      return (
        <div className="min-h-screen bg-gray-50 py-8 px-4">
          <div className="max-w-4xl mx-auto">
            {/* Failed Header with Partial Results Notice */}
            <div className="mb-8">
              <div className="flex items-start gap-3 mb-4">
                <div className="text-4xl">⚠️</div>
                <div className="flex-1">
                  <h1 className="text-3xl font-bold mb-2">Batch Scan Failed</h1>
                  <p className="text-muted-foreground mb-2">
                    Some scans in this batch failed. Partial results are shown below.
                  </p>
                  <p className="text-muted-foreground mb-1">
                    <span className="font-medium">Homepage:</span>{' '}
                    <a
                      href={batch.homepageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline break-all"
                    >
                      {batch.homepageUrl}
                    </a>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    WCAG {batch.wcagLevel} | {batch.completedCount} of {batch.totalUrls} scans
                    completed
                  </p>
                </div>
              </div>

              {/* Error Warning Banner */}
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">
                  <strong>Note:</strong> {batch.failedCount} scan(s) failed. Check individual URL
                  status below for error details.
                </p>
              </div>
            </div>

            {/* Partial Results - only if some scans completed */}
            {batch.completedCount > 0 && (
              <>
                {/* Summary Card - Partial Results */}
                <div className="bg-white rounded-lg border shadow-sm p-6 mb-6">
                  <h2 className="text-xl font-semibold mb-4">
                    Partial Results Summary ({batch.completedCount} URLs)
                  </h2>
                  <BatchSummary results={results} />
                </div>

                {/* URL List with Issues */}
                <div className="bg-white rounded-lg border shadow-sm p-6 mb-6">
                  <BatchUrlList urls={results.urls} />
                </div>
              </>
            )}

            {/* No Completed Scans */}
            {batch.completedCount === 0 && (
              <div className="bg-white rounded-lg border shadow-sm p-6 mb-6">
                <p className="text-center text-muted-foreground py-8">
                  No scans completed successfully. All {batch.totalUrls} scans failed.
                </p>
              </div>
            )}

            {/* Footer Actions */}
            <div className="flex justify-center gap-4 py-8 border-t">
              <button
                onClick={() => router.push('/')}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => router.push('/history')}
                className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                View History
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Loading partial results
    if (resultsLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
            <p className="mt-4 text-muted-foreground">Loading partial results...</p>
          </div>
        </div>
      );
    }

    // No results available - show simple error
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold mb-2">Batch Scan Failed</h1>
          <p className="text-muted-foreground mb-6">
            An error occurred while processing the batch scan.
            {resultsError && ` (${resultsError})`}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Cancelled batch state
  // Requirement 7.5: Show cancellation summary (completed vs cancelled counts)
  if (batch.status === 'CANCELLED') {
    const cancelledCount = batch.totalUrls - batch.completedCount - batch.failedCount;
    const hasCompletedScans = batch.completedCount > 0;

    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Cancelled Header */}
          <div className="mb-8">
            <div className="flex items-start gap-3 mb-4">
              <div className="text-4xl">🛑</div>
              <div className="flex-1">
                <h1 className="text-3xl font-bold mb-2">Batch Scan Cancelled</h1>
                <p className="text-muted-foreground mb-2">
                  <span className="font-medium">Homepage:</span>{' '}
                  <a
                    href={batch.homepageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline break-all"
                  >
                    {batch.homepageUrl}
                  </a>
                </p>
                <p className="text-sm text-muted-foreground">
                  Cancelled on{' '}
                  {batch.cancelledAt
                    ? new Date(batch.cancelledAt).toLocaleString()
                    : 'unknown date'}{' '}
                  | WCAG {batch.wcagLevel}
                </p>
              </div>
            </div>

            {/* Cancellation Summary Card */}
            <div className="bg-white rounded-lg border shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4">Cancellation Summary</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Completed Scans */}
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="text-3xl font-bold text-green-700 mb-1">
                    {batch.completedCount}
                  </div>
                  <div className="text-sm text-green-600 font-medium">
                    Completed Successfully
                  </div>
                </div>

                {/* Cancelled Scans */}
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="text-3xl font-bold text-gray-700 mb-1">
                    {cancelledCount}
                  </div>
                  <div className="text-sm text-gray-600 font-medium">
                    Cancelled
                  </div>
                </div>

                {/* Failed Scans (if any) */}
                {batch.failedCount > 0 && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="text-3xl font-bold text-red-700 mb-1">
                      {batch.failedCount}
                    </div>
                    <div className="text-sm text-red-600 font-medium">
                      Failed Before Cancellation
                    </div>
                  </div>
                )}
              </div>

              {/* Summary Text */}
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-700">
                  <strong>Total URLs:</strong> {batch.totalUrls}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  {hasCompletedScans ? (
                    <>
                      {batch.completedCount} scan{batch.completedCount !== 1 ? 's' : ''} completed
                      before cancellation. Results for completed scans have been preserved.
                    </>
                  ) : (
                    <>
                      No scans were completed before cancellation. All scans were either pending or
                      cancelled.
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-center gap-4 py-8 border-t">
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Start New Scan
            </button>
            <button
              onClick={() => router.push('/history')}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              View History
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Stale batch state - show warning banner with partial results
  // Requirement 5.5: Stale batches (>24h old) shall be marked with warning status
  if (batch.status === 'STALE') {
    // If we have results data, show partial results with warning banner
    if (results && !resultsLoading) {
      return (
        <div className="min-h-screen bg-gray-50 py-8 px-4">
          <div className="max-w-4xl mx-auto">
            {/* Stale Header */}
            <div className="mb-8">
              <div className="flex items-start gap-3 mb-4">
                <div className="text-4xl">⏱️</div>
                <div className="flex-1">
                  <h1 className="text-3xl font-bold mb-2">Batch Scan Running Too Long</h1>
                  <p className="text-muted-foreground mb-2">
                    <span className="font-medium">Homepage:</span>{' '}
                    <a
                      href={batch.homepageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline break-all"
                    >
                      {batch.homepageUrl}
                    </a>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    WCAG {batch.wcagLevel} | {batch.completedCount} of {batch.totalUrls} scans
                    completed
                  </p>
                </div>
              </div>

              {/* Warning Banner - Yellow/Orange for stale status */}
              <div className="p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded-lg shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">⚠️</div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-yellow-900 mb-1">
                      This batch scan has been running for over 24 hours and may not complete.
                    </h3>
                    <p className="text-sm text-yellow-800 mb-3">
                      Some scans may be stuck or experiencing issues. Partial results are shown
                      below. You can cancel this batch and start a new scan if needed.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={handleCancelBatch}
                        disabled={cancelling}
                        className="px-4 py-2 text-sm bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {cancelling ? 'Cancelling...' : 'Cancel Batch'}
                      </button>
                      <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 text-sm border border-yellow-300 text-yellow-900 rounded-lg hover:bg-yellow-100 transition-colors"
                      >
                        Refresh Status
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Partial Results - only if some scans completed */}
            {batch.completedCount > 0 && (
              <>
                {/* Summary Card - Partial Results */}
                <div className="bg-white rounded-lg border shadow-sm p-6 mb-6">
                  <h2 className="text-xl font-semibold mb-4">
                    Partial Results Summary ({batch.completedCount} URLs completed)
                  </h2>
                  <BatchSummary results={results} />
                </div>

                {/* URL List with Issues */}
                <div className="bg-white rounded-lg border shadow-sm p-6 mb-6">
                  <BatchUrlList urls={results.urls} />
                </div>
              </>
            )}

            {/* No Completed Scans Yet */}
            {batch.completedCount === 0 && (
              <div className="bg-white rounded-lg border shadow-sm p-6 mb-6">
                <p className="text-center text-muted-foreground py-8">
                  No scans have completed yet. The batch may be stuck or experiencing issues.
                </p>
              </div>
            )}

            {/* Footer Actions */}
            <div className="flex justify-center gap-4 py-8 border-t">
              <button
                onClick={() => router.push('/')}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Start New Scan
              </button>
              <button
                onClick={() => router.push('/history')}
                className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                View History
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Loading partial results
    if (resultsLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin h-12 w-12 border-4 border-yellow-600 border-t-transparent rounded-full mx-auto" />
            <p className="mt-4 text-muted-foreground">Loading partial results...</p>
          </div>
        </div>
      );
    }

    // No results available yet - show simple stale message with cancel option
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-6xl mb-4">⏱️</div>
          <h1 className="text-2xl font-bold mb-2">Batch Scan Running Too Long</h1>

          {/* Warning Banner */}
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-6 text-left">
            <p className="text-sm text-yellow-800 mb-2">
              <strong>Warning:</strong> This batch scan has been running for over 24 hours and may not complete.
            </p>
            <p className="text-sm text-yellow-700">
              Progress: {batch.completedCount} of {batch.totalUrls} scans completed
            </p>
          </div>

          <p className="text-muted-foreground mb-6">
            {resultsError && `Unable to load results: ${resultsError}`}
            {!resultsError && 'The batch scan is taking too long. You can cancel it and start a new scan.'}
          </p>

          <div className="flex gap-3 justify-center">
            <button
              onClick={handleCancelBatch}
              disabled={cancelling}
              className="px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancelling ? 'Cancelling...' : 'Cancel Batch'}
            </button>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Start New Scan
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Scanning in progress state (PENDING or RUNNING)
  // Requirement 2.7: Clear visual progress indication
  if (batch.status === 'PENDING' || batch.status === 'RUNNING') {
    const isWaiting = batch.status === 'PENDING';

    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header Section */}
          <div className="text-center mb-8">
            <div className="animate-pulse text-6xl mb-4">
              {isWaiting ? '⏳' : '🔍'}
            </div>
            <h1 className="text-3xl font-bold mb-2">
              {isWaiting ? 'Batch Scan Queued' : 'Batch Scan in Progress'}
            </h1>
            <p className="text-muted-foreground mb-1">
              <span className="font-medium">Homepage:</span>{' '}
              <a
                href={batch.homepageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline break-all"
              >
                {batch.homepageUrl}
              </a>
            </p>
            <p className="text-sm text-muted-foreground">
              Batch ID: {batchId} | WCAG {batch.wcagLevel}
            </p>
          </div>

          {/* Progress Card */}
          <div className="bg-white rounded-lg border shadow-sm p-6 mb-6">
            {isWaiting ? (
              <div className="text-center py-8">
                <p className="text-lg font-medium mb-2">Waiting in queue...</p>
                <p className="text-sm text-muted-foreground">
                  Your batch scan will start shortly. Discovering {batch.totalUrls} URLs
                  from the homepage.
                </p>
              </div>
            ) : (
              <BatchProgress batch={batch} batchId={batchId} />
            )}
          </div>

          {/* Actions and Info */}
          <div className="space-y-4">
            {/* Cancel Button - show during PENDING and RUNNING */}
            {/* Requirement 7.1: User can cancel an in-progress batch scan */}
            {(batch.status === 'PENDING' || batch.status === 'RUNNING') && (
              <div className="flex justify-center">
                <button
                  onClick={handleCancelBatch}
                  disabled={cancelling}
                  className="px-6 py-2 text-sm border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cancelling ? 'Cancelling...' : 'Cancel Batch Scan'}
                </button>
              </div>
            )}

            {/* Auto-update notice */}
            <p className="text-center text-sm text-muted-foreground">
              This page will automatically update every 2 seconds.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Completed batch state
  // Requirements: 3.1 (aggregate stats), 3.2 (severity grouping), 3.4 (top critical URLs)
  if (batch.status === 'COMPLETED') {
    // Loading results
    if (resultsLoading || !results) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
            <p className="mt-4 text-muted-foreground">Loading results...</p>
          </div>
        </div>
      );
    }

    // Results error
    if (resultsError) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center max-w-md mx-auto px-4">
            <div className="text-6xl mb-4">❌</div>
            <h1 className="text-2xl font-bold mb-2">Failed to Load Results</h1>
            <p className="text-muted-foreground mb-6">{resultsError}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    // Display completed results with BatchSummary and BatchUrlList
    return (
      <PublicLayout
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'History', href: '/history' },
          { label: 'Batch Results' },
        ]}
        showBackButton={true}
        headerActions={
          <>
            <BatchExport
              batchId={batchId}
              status={batch.status}
            />
            <ShareButton
              resultType="batch"
              resultId={batchId}
            />
          </>
        }
      >
        <div className="bg-gray-50 py-8 px-4">
          <div className="max-w-4xl mx-auto">
            {/* Header Section */}
            <div className="mb-8">
              <div className="flex items-start gap-3 mb-2">
                <div className="text-4xl">✅</div>
                <h1 className="text-3xl font-bold">Batch Scan Complete</h1>
              </div>
              <p className="text-muted-foreground mb-1">
                <span className="font-medium">Homepage:</span>{' '}
                <a
                  href={batch.homepageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline break-all"
                >
                  {batch.homepageUrl}
                </a>
              </p>
              <p className="text-sm text-muted-foreground">
                Completed on{' '}
                {batch.completedAt
                  ? new Date(batch.completedAt).toLocaleString()
                  : 'unknown date'}{' '}
                | WCAG {batch.wcagLevel}
              </p>

              {/* Report Artifacts - show available PDF/JSON reports */}
              {(reportStatus?.pdf || reportStatus?.json) && (
                <div className="mt-4">
                  <ReportArtifacts
                    status={reportStatus}
                    isLoading={reportStatusLoading}
                    resourceId={batchId}
                    resourceType="batch"
                  />
                </div>
              )}
            </div>

            {/* Aggregate Results Summary */}
            <div className="bg-white rounded-lg border shadow-sm p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Results Summary</h2>
              <BatchSummary results={results} />
            </div>

            {/* Per-URL Results List */}
            <div className="bg-white rounded-lg border shadow-sm p-6 mb-6">
              <BatchUrlList urls={results.urls} />
            </div>

            {/* Footer Actions */}
            <div className="flex justify-center gap-4 py-8 border-t">
              <button
                onClick={() => router.push('/')}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Start New Scan
              </button>
              <button
                onClick={() => router.push('/history')}
                className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                View History
              </button>
            </div>
          </div>
        </div>
      </PublicLayout>
    );
  }

  // Fallback for unknown status
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="text-6xl mb-4">🤔</div>
        <h1 className="text-2xl font-bold mb-2">Unknown Status</h1>
        <p className="text-muted-foreground mb-6">
          The batch scan is in an unknown state. Please try refreshing the page.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Refresh
          </button>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
}

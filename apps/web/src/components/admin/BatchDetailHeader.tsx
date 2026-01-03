'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { BatchStatus, WcagLevel } from '@/lib/admin-api';

/**
 * Props for BatchDetailHeader component
 */
interface BatchDetailHeaderProps {
  /** Batch ID */
  batchId: string;
  /** Homepage URL being scanned */
  homepageUrl: string;
  /** WCAG level (A, AA, or AAA) */
  wcagLevel: WcagLevel;
  /** Current batch status */
  status: BatchStatus;
  /** Creation timestamp */
  createdAt: string;
  /** Completion timestamp (if completed) */
  completedAt?: string | null;
  /** Cancellation timestamp (if cancelled) */
  cancelledAt?: string | null;
  /** Discovery ID (if created from discovery) */
  discoveryId?: string | null;
}

/**
 * Get status badge color based on batch status
 */
function getStatusColor(status: BatchStatus): string {
  const statusColors: Record<BatchStatus, string> = {
    PENDING: 'bg-gray-100 text-gray-800',
    RUNNING: 'bg-blue-100 text-blue-800',
    COMPLETED: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800',
    CANCELLED: 'bg-yellow-100 text-yellow-800',
    STALE: 'bg-orange-100 text-orange-800',
  };

  return statusColors[status] || 'bg-gray-100 text-gray-800';
}

/**
 * Get WCAG level badge color
 */
function getWcagLevelColor(level: WcagLevel): string {
  const levelColors: Record<WcagLevel, string> = {
    A: 'bg-blue-100 text-blue-800 border-blue-200',
    AA: 'bg-purple-100 text-purple-800 border-purple-200',
    AAA: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  };

  return levelColors[level] || 'bg-gray-100 text-gray-800 border-gray-200';
}

/**
 * Format date to human-readable string
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * BatchDetailHeader Component
 *
 * This component displays comprehensive batch information at the top of batch detail pages:
 * - Back navigation button to return to batch list
 * - Batch ID display
 * - Homepage URL with external link
 * - WCAG level badge (A, AA, AAA)
 * - Status badge with color coding
 * - Creation timestamp
 * - Completion timestamp (if completed)
 * - Cancellation timestamp (if cancelled)
 * - Discovery ID link (if batch was created from discovery)
 *
 * The layout is clean and organized with proper spacing and visual hierarchy.
 *
 * Requirements:
 * - REQ 2.1: Display comprehensive batch information including ID, URL, WCAG level,
 *   status, timestamps, and discovery ID
 *
 * @example
 * ```tsx
 * <BatchDetailHeader
 *   batchId={batch.id}
 *   homepageUrl={batch.homepageUrl}
 *   wcagLevel={batch.wcagLevel}
 *   status={batch.status}
 *   createdAt={batch.createdAt}
 *   completedAt={batch.completedAt}
 *   cancelledAt={batch.cancelledAt}
 *   discoveryId={batch.discoveryId}
 * />
 * ```
 */
export function BatchDetailHeader({
  batchId,
  homepageUrl,
  wcagLevel,
  status,
  createdAt,
  completedAt = null,
  cancelledAt = null,
  discoveryId = null,
}: BatchDetailHeaderProps) {
  const router = useRouter();

  /**
   * Navigate back to batch list
   */
  const handleBackClick = () => {
    router.push('/admin/batches');
  };

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button
        onClick={handleBackClick}
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md"
        aria-label="Back to batch list"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        <span className="text-sm font-medium">Back to Batches</span>
      </button>

      {/* Header card */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        {/* Batch ID and status row */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h1 className="text-2xl font-bold text-gray-900">
            Batch Scan
          </h1>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(
              status
            )}`}
          >
            {status}
          </span>
          <span
            className={`inline-flex items-center rounded border px-2.5 py-0.5 text-xs font-semibold ${getWcagLevelColor(
              wcagLevel
            )}`}
          >
            WCAG {wcagLevel}
          </span>
        </div>

        {/* Batch ID */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
            Batch ID
          </label>
          <p className="text-sm font-mono text-gray-900 break-all">{batchId}</p>
        </div>

        {/* Homepage URL */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
            Homepage URL
          </label>
          <div className="flex items-center gap-2">
            <a
              href={homepageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline break-all flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
              title={`Open ${homepageUrl} in new tab`}
            >
              {homepageUrl}
              <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            </a>
          </div>
        </div>

        {/* Timestamps grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Created timestamp */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
              Created
            </label>
            <p className="text-sm text-gray-900">{formatDate(createdAt)}</p>
          </div>

          {/* Completed timestamp */}
          {completedAt && (
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                Completed
              </label>
              <p className="text-sm text-gray-900">{formatDate(completedAt)}</p>
            </div>
          )}

          {/* Cancelled timestamp */}
          {cancelledAt && (
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                Cancelled
              </label>
              <p className="text-sm text-gray-900">{formatDate(cancelledAt)}</p>
            </div>
          )}
        </div>

        {/* Discovery ID link */}
        {discoveryId && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
              Discovery Session
            </label>
            <button
              onClick={() => router.push(`/admin/discovery/${discoveryId}`)}
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
              title="View discovery session details"
            >
              View Discovery #{discoveryId.slice(0, 8)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

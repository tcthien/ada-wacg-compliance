'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { adminApi, AiStatus } from '@/lib/admin-api';
import { ArrowLeft, Trash2, RotateCw, AlertCircle, Layers, ExternalLink, Sparkles, Clock, Cpu } from 'lucide-react';
import Link from 'next/link';
import { AdminScanConsole } from '@/components/admin/ScanConsole';
import { AdminExportButton } from '@/components/admin/AdminExportButton';
import { AiStatusBadge, AiSummarySection } from '@/components/features/ai';

/**
 * Admin Scan Detail Page
 *
 * This page:
 * - Displays full scan data with results and issues
 * - Shows scan info: URL, status, date, email, session info
 * - Displays scan results: issue counts by severity
 * - Lists all issues with WCAG criteria, element, and message
 * - Provides action buttons: Delete (with confirmation), Retry (for failed scans)
 * - Shows AdminScanConsole for real-time scan event monitoring
 * - Handles loading and error states
 * - Color-codes issues by severity
 *
 * Requirements:
 * - REQ 3.5: Return full scan data with results, issues, and session info
 * - REQ 3.6: Delete scan with soft-delete option
 * - REQ 3.7: Retry failed scan by queueing new job
 * - REQ 4.1: Display real-time scan events in admin console (scan-console-logger spec)
 * - REQ 7.4: Display appropriate loading states and success/error notifications
 */

interface Issue {
  id: string;
  ruleId: string;
  impact: 'CRITICAL' | 'SERIOUS' | 'MODERATE' | 'MINOR';
  description: string;
  helpText: string;
  helpUrl: string;
  wcagCriteria: string[];
  htmlSnippet: string | null;
  cssSelector: string | null;
  nodes: any;
  createdAt: string;
  // AI Enhancement Fields
  aiExplanation: string | null;
  aiFixSuggestion: string | null;
  aiPriority: number | null;
}

interface ScanResult {
  id: string;
  totalIssues: number;
  criticalCount: number;
  seriousCount: number;
  moderateCount: number;
  minorCount: number;
  passedChecks: number;
  inapplicableChecks: number;
  createdAt: string;
  issues: Issue[];
}

interface GuestSession {
  id: string;
  fingerprint: string;
  createdAt: string;
}

interface BatchContext {
  id: string;
  homepageUrl: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'STALE';
  totalUrls: number;
  completedCount: number;
  failedCount: number;
}

interface ScanDetails {
  id: string;
  url: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  wcagLevel: 'A' | 'AA' | 'AAA';
  email: string;
  guestSessionId: string | null;
  userId: string | null;
  createdAt: string;
  completedAt: string | null;
  durationMs: number | null;
  errorMessage: string | null;
  scanResult: ScanResult | null;
  guestSession: GuestSession | null;
  batchScanId: string | null;
  batchScan: BatchContext | null;
  // AI fields
  aiEnabled?: boolean;
  aiStatus?: AiStatus | null;
  aiSummary?: string | null;
  aiRemediationPlan?: string | null;
  aiProcessedAt?: string | null;
  aiInputTokens?: number | null;
  aiOutputTokens?: number | null;
  aiTotalTokens?: number | null;
  aiModel?: string | null;
  aiProcessingTime?: number | null;
}

/**
 * Get status badge color based on scan status
 */
function getStatusColor(status: ScanDetails['status']) {
  switch (status) {
    case 'COMPLETED':
      return 'bg-green-100 text-green-800';
    case 'RUNNING':
      return 'bg-blue-100 text-blue-800';
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-800';
    case 'FAILED':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Get batch status badge color
 */
function getBatchStatusColor(status: BatchContext['status']) {
  switch (status) {
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
 * Get issue severity color
 */
function getIssueColor(impact: Issue['impact']) {
  switch (impact) {
    case 'CRITICAL':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'SERIOUS':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'MODERATE':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'MINOR':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

/**
 * Format date to human-readable string
 */
function formatDate(dateString: string) {
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
 * Format duration in milliseconds to human-readable string
 */
function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export default function ScanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const scanId = params?.['id'] as string;

  const [scan, setScan] = useState<ScanDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  /**
   * Fetch scan details from API
   */
  const fetchScanDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await adminApi.scans.get(scanId);
      setScan(response as unknown as ScanDetails);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch scan details');
      console.error('Failed to fetch scan details:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch scan details on mount
   */
  useEffect(() => {
    if (scanId) {
      fetchScanDetails();
    }
  }, [scanId]);

  /**
   * Handle delete scan action
   */
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this scan? This action cannot be undone.')) {
      return;
    }

    try {
      setActionLoading(true);
      await adminApi.scans.delete(scanId);

      // Show success message and navigate back
      alert('Scan deleted successfully');
      router.push('/admin/scans');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete scan');
      console.error('Failed to delete scan:', err);
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Handle retry scan action
   */
  const handleRetry = async () => {
    try {
      setActionLoading(true);
      await adminApi.scans.retry(scanId);

      // Show success message and refetch
      alert('Scan retry queued successfully');
      await fetchScanDetails();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to retry scan');
      console.error('Failed to retry scan:', err);
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Loading state
   */
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/admin/scans')}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Scans
          </button>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          </div>
        </div>
      </div>
    );
  }

  /**
   * Error state
   */
  if (error || !scan) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/admin/scans')}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Scans
          </button>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading scan</h3>
              <p className="mt-1 text-sm text-red-700">{error || 'Scan not found'}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header with back button */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push('/admin/scans')}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Scans
        </button>

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          {/* Export button - only show for completed scans */}
          <AdminExportButton
            scanId={scanId}
            scanStatus={scan.status}
          />

          {/* Retry button - only show for failed scans */}
          {scan.status === 'FAILED' && (
            <button
              onClick={handleRetry}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCw className={`h-4 w-4 ${actionLoading ? 'animate-spin' : ''}`} />
              Retry Scan
            </button>
          )}

          {/* Delete button */}
          <button
            onClick={handleDelete}
            disabled={actionLoading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      </div>

      {/* Scan info card */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Scan Information</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
            <p className="text-sm text-gray-900 break-all">{scan.url}</p>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(scan.status)}`}>
              {scan.status}
            </span>
          </div>

          {/* WCAG Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">WCAG Level</label>
            <p className="text-sm text-gray-900">{scan.wcagLevel}</p>
          </div>

          {/* Created date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Created</label>
            <p className="text-sm text-gray-900">{formatDate(scan.createdAt)}</p>
          </div>

          {/* Completed date */}
          {scan.completedAt && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Completed</label>
              <p className="text-sm text-gray-900">{formatDate(scan.completedAt)}</p>
            </div>
          )}

          {/* Duration */}
          {scan.durationMs && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
              <p className="text-sm text-gray-900">{formatDuration(scan.durationMs)}</p>
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer Email</label>
            <p className="text-sm text-gray-900">{scan.email}</p>
          </div>

          {/* Session info */}
          {scan.guestSession && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Session</label>
              <p className="text-sm text-gray-900 font-mono text-xs">
                {scan.guestSession.id.substring(0, 8)}...
              </p>
            </div>
          )}

          {/* Error message for failed scans */}
          {scan.errorMessage && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Error Message</label>
              <p className="text-sm text-red-600">{scan.errorMessage}</p>
            </div>
          )}
        </div>
      </div>

      {/* AI Analysis section - shown if AI is enabled */}
      {scan.aiEnabled && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-purple-600" />
            <h2 className="text-xl font-bold text-gray-900">AI Analysis</h2>
            {scan.aiStatus && (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                scan.aiStatus === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                scan.aiStatus === 'FAILED' ? 'bg-red-100 text-red-800' :
                scan.aiStatus === 'PROCESSING' ? 'bg-purple-100 text-purple-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {scan.aiStatus}
              </span>
            )}
          </div>

          {/* AI Status Badge for non-completed states */}
          {scan.aiStatus && scan.aiStatus !== 'COMPLETED' && (
            <div className="mb-4">
              <AiStatusBadge status={scan.aiStatus} email={scan.email} />
            </div>
          )}

          {/* AI Metrics - shown when processing is complete or in progress */}
          {(scan.aiModel || scan.aiTotalTokens || scan.aiProcessingTime) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {/* Model used */}
              {scan.aiModel && (
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  <Cpu className="h-4 w-4 text-gray-500" />
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Model</label>
                    <p className="text-sm text-gray-900 font-mono">{scan.aiModel}</p>
                  </div>
                </div>
              )}

              {/* Tokens used */}
              {scan.aiTotalTokens !== null && scan.aiTotalTokens !== undefined && (
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  <Sparkles className="h-4 w-4 text-gray-500" />
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Tokens Used</label>
                    <p className="text-sm text-gray-900">
                      {scan.aiTotalTokens.toLocaleString()}
                      {scan.aiInputTokens && scan.aiOutputTokens && (
                        <span className="text-gray-500 ml-1 text-xs">
                          ({scan.aiInputTokens.toLocaleString()} in / {scan.aiOutputTokens.toLocaleString()} out)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Processing time */}
              {scan.aiProcessingTime !== null && scan.aiProcessingTime !== undefined && (
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Processing Time</label>
                    <p className="text-sm text-gray-900">
                      {scan.aiProcessingTime < 1000
                        ? `${scan.aiProcessingTime}ms`
                        : `${(scan.aiProcessingTime / 1000).toFixed(1)}s`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AI processed timestamp */}
          {scan.aiProcessedAt && (
            <p className="text-xs text-gray-500 mb-4">
              Processed at: {formatDate(scan.aiProcessedAt)}
            </p>
          )}

          {/* AI Summary Section with accordion */}
          {scan.aiStatus === 'COMPLETED' && (scan.aiSummary || scan.aiRemediationPlan) && (
            <AiSummarySection
              aiSummary={scan.aiSummary ?? null}
              aiRemediationPlan={scan.aiRemediationPlan ?? null}
            />
          )}

          {/* No analysis available message */}
          {scan.aiStatus === 'COMPLETED' && !scan.aiSummary && !scan.aiRemediationPlan && (
            <div className="text-center py-4 text-gray-500 text-sm">
              AI processing completed but no analysis was generated.
            </div>
          )}

          {/* Failed state message */}
          {scan.aiStatus === 'FAILED' && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">
                AI analysis failed. This may be due to processing limits or temporary service issues.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Batch context section - shown if scan belongs to a batch */}
      {scan.batchScanId && scan.batchScan && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">Batch Context</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Batch ID with link */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Batch ID</label>
              <Link
                href={`/admin/batches/${scan.batchScanId}?highlightScanId=${scan.id}`}
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline font-mono"
              >
                {scan.batchScanId.substring(0, 8)}...
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>

            {/* Homepage URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Homepage URL</label>
              <a
                href={scan.batchScan.homepageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800 hover:underline break-all"
              >
                {scan.batchScan.homepageUrl}
              </a>
            </div>

            {/* Batch status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Batch Status</label>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getBatchStatusColor(scan.batchScan.status)}`}>
                {scan.batchScan.status}
              </span>
            </div>

            {/* Progress */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Batch Progress</label>
              <p className="text-sm text-gray-900">
                {scan.batchScan.completedCount + scan.batchScan.failedCount} / {scan.batchScan.totalUrls} URLs
                <span className="text-gray-500 ml-1">
                  ({scan.batchScan.completedCount} completed, {scan.batchScan.failedCount} failed)
                </span>
              </p>
            </div>
          </div>

          {/* View batch button */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <Link
              href={`/admin/batches/${scan.batchScanId}?highlightScanId=${scan.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Layers className="h-4 w-4" />
              View Batch Details
            </Link>
          </div>
        </div>
      )}

      {/* Scan results section */}
      {scan.scanResult && (
        <>
          {/* Results summary */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Scan Results</h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Total issues */}
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{scan.scanResult.totalIssues}</p>
                <p className="text-sm text-gray-600 mt-1">Total Issues</p>
              </div>

              {/* Critical */}
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-2xl font-bold text-red-700">{scan.scanResult.criticalCount}</p>
                <p className="text-sm text-red-600 mt-1">Critical</p>
              </div>

              {/* Serious */}
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <p className="text-2xl font-bold text-orange-700">{scan.scanResult.seriousCount}</p>
                <p className="text-sm text-orange-600 mt-1">Serious</p>
              </div>

              {/* Moderate */}
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <p className="text-2xl font-bold text-yellow-700">{scan.scanResult.moderateCount}</p>
                <p className="text-sm text-yellow-600 mt-1">Moderate</p>
              </div>

              {/* Minor */}
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-700">{scan.scanResult.minorCount}</p>
                <p className="text-sm text-blue-600 mt-1">Minor</p>
              </div>

              {/* Passed checks */}
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-700">{scan.scanResult.passedChecks}</p>
                <p className="text-sm text-green-600 mt-1">Passed</p>
              </div>

              {/* Inapplicable checks */}
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-700">{scan.scanResult.inapplicableChecks}</p>
                <p className="text-sm text-gray-600 mt-1">Inapplicable</p>
              </div>
            </div>
          </div>

          {/* Issues list */}
          {scan.scanResult.issues.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Issues Found ({scan.scanResult.issues.length})
              </h2>

              <div className="space-y-4">
                {scan.scanResult.issues.map((issue) => (
                  <div
                    key={issue.id}
                    className={`border rounded-lg p-4 ${getIssueColor(issue.impact)}`}
                  >
                    {/* Issue header */}
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                            issue.impact === 'CRITICAL' ? 'bg-red-600 text-white' :
                            issue.impact === 'SERIOUS' ? 'bg-orange-600 text-white' :
                            issue.impact === 'MODERATE' ? 'bg-yellow-600 text-white' :
                            'bg-blue-600 text-white'
                          }`}>
                            {issue.impact}
                          </span>
                          <span className="text-xs font-mono text-gray-600">{issue.ruleId}</span>
                        </div>
                        <h3 className="text-sm font-semibold text-gray-900">{issue.description}</h3>
                      </div>
                    </div>

                    {/* WCAG criteria */}
                    {issue.wcagCriteria.length > 0 && (
                      <div className="mb-3">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          WCAG Criteria
                        </label>
                        <div className="flex flex-wrap gap-1">
                          {issue.wcagCriteria.map((criteria, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white text-gray-700 border border-gray-300"
                            >
                              {criteria}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Help text */}
                    <div className="mb-3">
                      <p className="text-xs text-gray-700">{issue.helpText}</p>
                    </div>

                    {/* Element info */}
                    {issue.cssSelector && (
                      <div className="mb-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Element
                        </label>
                        <code className="block text-xs font-mono bg-white text-gray-800 p-2 rounded border border-gray-300 break-all">
                          {issue.cssSelector}
                        </code>
                      </div>
                    )}

                    {/* HTML snippet */}
                    {issue.htmlSnippet && (
                      <div className="mb-3">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          HTML Snippet
                        </label>
                        <code className="block text-xs font-mono bg-white text-gray-800 p-2 rounded border border-gray-300 overflow-x-auto">
                          {issue.htmlSnippet}
                        </code>
                      </div>
                    )}

                    {/* Help URL */}
                    <div>
                      <a
                        href={issue.helpUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-800 underline"
                      >
                        Learn more about this issue
                      </a>
                    </div>

                    {/* AI Enhancement Section - Only show if any AI data exists */}
                    {(issue.aiExplanation || issue.aiFixSuggestion || issue.aiPriority) && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex items-center gap-2 mb-3">
                          <Sparkles className="h-4 w-4 text-purple-600" />
                          <span className="text-sm font-medium text-purple-800">AI Analysis</span>
                          {issue.aiPriority && (
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800">
                              Priority: {issue.aiPriority}/10
                            </span>
                          )}
                        </div>

                        {issue.aiExplanation && (
                          <div className="mb-3">
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              AI Explanation
                            </label>
                            <p className="text-sm text-gray-700 bg-purple-50 p-3 rounded whitespace-pre-wrap">
                              {issue.aiExplanation}
                            </p>
                          </div>
                        )}

                        {issue.aiFixSuggestion && (
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              AI Fix Suggestion
                            </label>
                            <pre className="text-xs font-mono bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto whitespace-pre-wrap">
                              {issue.aiFixSuggestion}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* No results message */}
      {!scan.scanResult && scan.status === 'COMPLETED' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">No results available</h3>
              <p className="mt-1 text-sm text-yellow-700">
                This scan completed but no results were found.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Admin Scan Console */}
      <AdminScanConsole scanId={scanId} scanStatus={scan.status} defaultView="expanded" />
    </div>
  );
}

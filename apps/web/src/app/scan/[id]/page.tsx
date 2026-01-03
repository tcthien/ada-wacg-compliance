'use client';

import { useMemo, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useScan } from '@/hooks/useScan';
import { useScanResult } from '@/hooks/useScanResult';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAiScanStatus } from '@/hooks/useAiScanStatus';
import { useReportStatus } from '@/hooks/useReportStatus';
import { ScanProgress } from '@/components/features/scan/ScanProgress';
import { ResultsSummary } from '@/components/features/results/ResultsSummary';
import { IssueList, type Issue } from '@/components/features/results/IssueList';
import { ExportButton } from '@/components/features/export/ExportButton';
import { ReportArtifacts } from '@/components/features/export/ReportArtifacts';
import { ShareButton } from '@/components/ui/share-button';
import { CoverageDisclaimer } from '@/components/features/compliance/CoverageDisclaimer';
import { AiStatusBadge } from '@/components/features/ai/AiStatusBadge';
import { AiSummarySection } from '@/components/features/ai/AiSummarySection';
import { PublicLayout } from '@/components/layouts/PublicLayout';
import type { IssuesByImpact } from '@/lib/api';

/**
 * Flatten issuesByImpact into a single array for the IssueList component
 * Converts API issue format to component-expected format with AI data
 */
function flattenIssues(issuesByImpact: IssuesByImpact): Issue[] {
  const allIssues: Issue[] = [];

  const impactLevels: (keyof IssuesByImpact)[] = ['critical', 'serious', 'moderate', 'minor'];

  for (const level of impactLevels) {
    const issues = issuesByImpact[level] || [];
    for (const issue of issues) {
      allIssues.push({
        id: issue.id,
        impact: level,
        description: issue.description,
        help: issue.helpText,
        helpUrl: issue.helpUrl,
        tags: issue.wcagCriteria,
        nodes: issue.nodes,
        // Include AI enhancement data if available (REQ-6 AC 3-4)
        aiExplanation: issue.aiExplanation ?? null,
        aiFixSuggestion: issue.aiFixSuggestion ?? null,
        aiPriority: issue.aiPriority ?? null,
      });
    }
  }

  return allIssues;
}

export default function ScanResultPage() {
  const params = useParams();
  const router = useRouter();
  const scanId = params['id'] as string;
  const { track } = useAnalytics();

  // Ref to track if scan_completed has been tracked (prevent duplicates)
  const scanCompletedTrackedRef = useRef(false);

  // Poll for scan status
  const { scan, loading: statusLoading, error: statusError } = useScan(scanId, {
    pollInterval: 2000,
  });

  // Fetch results only when scan is completed
  const {
    result,
    loading: resultLoading,
    error: resultError,
  } = useScanResult(scanId, {
    enabled: scan?.status === 'COMPLETED',
  });

  // Poll for AI status if AI is enabled
  const { aiStatus } = useAiScanStatus(scanId, {
    initialInterval: 30000, // 30 seconds
    maxInterval: 120000, // 2 minutes
  });

  // Fetch report status to display available report artifacts (PDF/JSON)
  const {
    status: reportStatus,
    isLoading: reportStatusLoading,
  } = useReportStatus(scanId, {
    enabled: scan?.status === 'COMPLETED',
  });

  // Flatten issues from issuesByImpact for IssueList component
  // Must be called unconditionally (React hooks rule)
  const flattenedIssues = useMemo(
    () => (result?.issuesByImpact ? flattenIssues(result.issuesByImpact) : []),
    [result?.issuesByImpact]
  );

  // Track funnel_scan_results_viewed on page load
  useEffect(() => {
    const funnelSessionId = sessionStorage.getItem('funnel_session_id');
    if (funnelSessionId) {
      track('funnel_scan_results_viewed', {
        funnel_session_id: funnelSessionId,
        timestamp: new Date().toISOString(),
        sessionId: funnelSessionId,
      });
    }
  }, [scanId, track]);

  // Track scan_completed when scan transitions to COMPLETED status
  useEffect(() => {
    if (scan?.status === 'COMPLETED' && result && !scanCompletedTrackedRef.current) {
      // Calculate scan duration if timestamps are available
      let duration = 0;
      if (scan.createdAt && result.completedAt) {
        const startTime = new Date(scan.createdAt).getTime();
        const endTime = new Date(result.completedAt).getTime();
        duration = Math.round(endTime - startTime); // Duration in milliseconds
      }

      // Count issues by severity
      const critical = result.issuesByImpact?.critical?.length || 0;
      const serious = result.issuesByImpact?.serious?.length || 0;
      const moderate = result.issuesByImpact?.moderate?.length || 0;
      const minor = result.issuesByImpact?.minor?.length || 0;

      // Track the scan_completed event
      const funnelSessionId = sessionStorage.getItem('funnel_session_id') || scanId;
      track('scan_completed', {
        scan_duration_ms: duration,
        issue_count: {
          critical,
          serious,
          moderate,
          minor,
        },
        wcag_level: result.wcagLevel,
        timestamp: new Date().toISOString(),
        sessionId: funnelSessionId,
      });

      // Mark as tracked to prevent duplicates
      scanCompletedTrackedRef.current = true;
    }
  }, [scan, result, scanId, track]);

  // Loading state - initial fetch
  if (statusLoading && !scan) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading scan...</p>
        </div>
      </div>
    );
  }

  // Error state - scan not found or fetch error
  if (statusError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold mb-2">Scan Not Found</h1>
          <p className="text-muted-foreground mb-6">
            {statusError || 'Unable to load scan information.'}
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

  // No scan data
  if (!scan) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold mb-2">Scan Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The requested scan does not exist or has been deleted.
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

  // Failed scan state
  if (scan.status === 'FAILED') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold mb-2">Scan Failed</h1>
          <p className="text-muted-foreground mb-6">
            {scan.errorMessage ||
              'An error occurred while scanning the page. Please try again.'}
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

  // Scanning in progress state
  if (scan.status === 'PENDING' || scan.status === 'RUNNING') {
    // Map status to user-friendly stages
    // When AI is enabled and progress is high, show AI allocation message
    const isAiPending = scan.aiEnabled && (scan.progress || 0) >= 90;

    const stageMap: Record<string, { text: string; progress: number }> = {
      PENDING: { text: 'Waiting in queue...', progress: 10 },
      RUNNING: { text: 'Scanning page...', progress: scan.progress || 50 },
    };

    const currentStage = stageMap[scan.status] || {
      text: 'Processing...',
      progress: 50,
    };

    // Use the current stage text
    const stageText = currentStage.text;

    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="animate-pulse text-6xl mb-4">🔍</div>
            <h1 className="text-2xl font-bold mb-2">Scanning in Progress</h1>
            <p className="text-muted-foreground text-sm">Scan ID: {scanId}</p>
          </div>

          <ScanProgress
            progress={currentStage.progress}
            stage={stageText}
            aiPending={isAiPending || false}
            aiNotificationEmail={scan.aiEnabled && scan.email ? scan.email : undefined}
          />

          <p className="text-center text-sm text-muted-foreground mt-6">
            This page will automatically update when the scan is complete.
          </p>
        </div>
      </div>
    );
  }

  // Completed scan - show results
  if (scan.status === 'COMPLETED') {
    // Loading results
    if (resultLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
            <p className="mt-4 text-muted-foreground">Loading results...</p>
          </div>
        </div>
      );
    }

    // Error loading results
    if (resultError) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center max-w-md mx-auto px-4">
            <div className="text-6xl mb-4">❌</div>
            <h1 className="text-2xl font-bold mb-2">Error Loading Results</h1>
            <p className="text-muted-foreground mb-6">{resultError}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Retry
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

    // No results data
    if (!result) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center max-w-md mx-auto px-4">
            <div className="text-6xl mb-4">🔍</div>
            <h1 className="text-2xl font-bold mb-2">No Results Available</h1>
            <p className="text-muted-foreground mb-6">
              Results for this scan are not available.
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

    // Display full results
    return (
      <PublicLayout
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'History', href: '/history' },
          { label: 'Scan Results' },
        ]}
        showBackButton={true}
        headerActions={
          <>
            <ExportButton scanId={scanId} />
            <ShareButton resultType="scan" resultId={scanId} />
          </>
        }
      >
        <div className="bg-gray-50 py-8">
          <div className="max-w-7xl mx-auto px-4">
            {/* Page Title and Metadata */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">
                Accessibility Scan Results
              </h1>
              <p className="text-muted-foreground">
                <span className="font-medium">URL:</span>{' '}
                <a
                  href={result.url.split('\n')[0]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline break-all"
                >
                  {result.url.split('\n')[0]}
                </a>
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Scanned on {new Date(result.completedAt).toLocaleString()} |
                WCAG {result.wcagLevel}
              </p>

              {/* Report Artifacts - show available PDF/JSON reports */}
              {(reportStatus?.pdf || reportStatus?.json) && (
                <div className="mt-4">
                  <ReportArtifacts
                    status={reportStatus}
                    isLoading={reportStatusLoading}
                    resourceId={scanId}
                    resourceType="scan"
                  />
                </div>
              )}

              {/* AI Status Badge - Show if AI was enabled for this scan */}
              {scan.aiEnabled && aiStatus && (
                <div className="mt-3">
                  <AiStatusBadge
                    status={aiStatus.status}
                    {...(scan.email ? { email: scan.email } : {})}
                  />
                </div>
              )}

              {/* Coverage Disclaimer */}
              <div className="mt-4">
                <CoverageDisclaimer />
              </div>
            </div>

          {/* AI Summary Section - Show when AI is completed */}
          {scan.aiEnabled && aiStatus?.status === 'COMPLETED' && (
            <div className="mb-8">
              <AiSummarySection
                aiSummary={aiStatus.summary ?? null}
                aiRemediationPlan={aiStatus.remediationPlan ?? null}
              />
            </div>
          )}

          {/* Results Summary */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Summary</h2>
            <ResultsSummary summary={result.summary} />
          </div>

          {/* Issue List */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">
              Issues Found ({result.summary.totalIssues})
            </h2>
            {flattenedIssues.length > 0 ? (
              <IssueList
                issues={flattenedIssues}
                aiLoading={
                  !!(scan.aiEnabled &&
                  aiStatus?.status &&
                  ['PENDING', 'DOWNLOADED', 'PROCESSING'].includes(aiStatus.status))
                }
              />
            ) : (
              <div className="bg-white rounded-lg border p-8 text-center">
                <div className="text-6xl mb-4">✅</div>
                <h3 className="text-xl font-semibold mb-2">
                  No Issues Detected
                </h3>
                <p className="text-muted-foreground">
                  Great job! No automated accessibility issues were found on
                  this page.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Remember: Manual testing is still recommended for complete
                  compliance verification.
                </p>
              </div>
            )}
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
          The scan is in an unknown state. Please try refreshing the page.
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
